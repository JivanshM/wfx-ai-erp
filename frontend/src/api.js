// One place for all backend calls.
// In local dev the backend runs on port 8000; on Vercel we set VITE_API_URL
// to the deployed Render URL instead.
export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// --- cold-start awareness -------------------------------------------------
// The backend runs on Render's free tier, which puts the service to sleep
// after ~15 min of inactivity. The next request then has to wait 30-60s to
// wake it. Only the normally-fast GET calls (the /health poll, dashboard,
// search) feed this flag: if one of them stalls past the threshold, the
// backend is almost certainly asleep, so we flip a global "waking" flag to
// reassure the user. The AI query and image search take several seconds by
// design and are intentionally NOT tracked - otherwise the banner would pop
// up on every normal request.
const WAKE_AFTER_MS = 8000;
let inFlight = 0;
let wakeTimer = null;
let waking = false;
const wakeListeners = new Set();

function emitWaking(value) {
  if (waking === value) return;
  waking = value;
  wakeListeners.forEach((fn) => fn(waking));
}

// Subscribe to the "server is waking up" flag. Calls fn immediately with the
// current value and returns an unsubscribe function (handy in a React effect).
export function onWaking(fn) {
  wakeListeners.add(fn);
  fn(waking);
  return () => wakeListeners.delete(fn);
}

function requestStarted() {
  inFlight += 1;
  if (inFlight === 1) wakeTimer = setTimeout(() => emitWaking(true), WAKE_AFTER_MS);
}

function requestFinished() {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight === 0) {
    clearTimeout(wakeTimer);
    emitWaking(false);
  }
}

export async function apiGet(path) {
  requestStarted();
  try {
    const res = await fetch(API_URL + path);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json();
  } finally {
    requestFinished();
  }
}

// apiPost (AI query) and apiUpload (image search) do NOT feed the waking flag
// on purpose - they are meant to take several seconds, so their slowness is
// normal, not a cold start.
export async function apiPost(path, body) {
  const res = await fetch(API_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return await res.json();
}

export async function apiUpload(path, formData) {
  // no Content-Type header here: the browser sets the correct
  // multipart boundary by itself when given a FormData body
  const res = await fetch(API_URL + path, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}
