// One place for all backend calls.
// In local dev the backend runs on port 8000; on Vercel we set VITE_API_URL
// to the deployed Render URL instead.
export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function apiGet(path) {
  const res = await fetch(API_URL + path);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(API_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function apiUpload(path, formData) {
  // no Content-Type header here: the browser sets the correct
  // multipart boundary by itself when given a FormData body
  const res = await fetch(API_URL + path, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}
