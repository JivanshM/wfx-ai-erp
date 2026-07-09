// One place for all backend calls.
// In local dev the backend runs on port 8000; on Vercel we set VITE_API_URL
// to the deployed Render URL instead.
export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// --- cold-start awareness -------------------------------------------------
// The backend runs on Render's free tier, which puts the service to sleep
// after ~15 min of inactivity. The next request then has to wait 30-60s for
// it to wake up. If ANY request stays pending past this threshold we flip a
// global "waking" flag so the UI can reassure the user instead of looking
// frozen. Normal warm requests finish well under this, so the banner only
// appears when something is genuinely slow (a cold start).
const WAKE_AFTER_MS = 6000;
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

export async function apiPost(path, body) {
  requestStarted();
  try {
    const res = await fetch(API_URL + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json();
  } finally {
    requestFinished();
  }
}

export async function apiUpload(path, formData) {
  requestStarted();
  try {
    // no Content-Type header here: the browser sets the correct
    // multipart boundary by itself when given a FormData body
    const res = await fetch(API_URL + path, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
    return data;
  } finally {
    requestFinished();
  }
}
