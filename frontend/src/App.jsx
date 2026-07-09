import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Loader2 } from "lucide-react";
import Sidebar from "./components/Sidebar.jsx";
import { onWaking } from "./api.js";

// Shown while a backend request is unusually slow. The free-tier backend
// sleeps when idle, so the first request can take up to a minute to wake it -
// this reassures the user that the app isn't frozen. onWaking() flips true
// only after a request has been pending past the threshold in api.js.
function ColdStartBanner() {
  const [waking, setWaking] = useState(false);
  useEffect(() => onWaking(setWaking), []);
  if (!waking) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[90%]
                 flex items-center gap-2.5 bg-card border border-orange text-ink
                 rounded-full shadow-lg px-4 py-2.5 text-sm"
      role="status"
    >
      <Loader2 size={18} className="shrink-0 animate-spin text-orange" />
      <span className="font-medium">Waking up the server…</span>
    </div>
  );
}

// Page shell: dark navy sidebar on the left, light workspace on the right.
// On phones the sidebar hides behind a hamburger button instead.
export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-workspace font-sans text-ink">
      <ColdStartBanner />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="flex-1 p-4 md:p-8 min-w-0">
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden mb-4 flex items-center gap-2 bg-card border border-line text-ink
                     text-sm font-semibold px-3 py-2 rounded-lg"
        >
          <Menu size={16} /> Menu
        </button>
        <Outlet />
      </main>
    </div>
  );
}
