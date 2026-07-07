import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./components/Sidebar.jsx";

// Page shell: dark navy sidebar on the left, light workspace on the right.
// On phones the sidebar hides behind a hamburger button instead.
export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-workspace font-sans text-ink">
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
