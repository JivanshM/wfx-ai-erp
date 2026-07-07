import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, MessageSquareText, Search, Image, Shirt } from "lucide-react";
import { apiGet } from "../api.js";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/query", label: "AI Query", icon: MessageSquareText },
  { to: "/search", label: "Product Search", icon: Search },
  { to: "/image-search", label: "Image Search", icon: Image },
  { to: "/explorer", label: "Goods Explorer", icon: Shirt },
];

export default function Sidebar({ open, onClose }) {
  // Poll the backend every 15s so the status dot reflects real connectivity
  const [online, setOnline] = useState(null);
  useEffect(() => {
    const check = () =>
      apiGet("/health").then(() => setOnline(true)).catch(() => setOnline(false));
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* dark backdrop behind the slide-in menu (mobile only) */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`w-60 shrink-0 bg-navy text-white flex flex-col border-r border-line
          fixed inset-y-0 left-0 z-40 transform transition-transform duration-200
          md:static md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
      <div className="px-5 py-6">
        <div className="text-xl font-extrabold tracking-tight">
          WFX <span className="text-orange">AI ERP</span>
        </div>
        <div className="text-xs text-white/50 mt-1">Apparel intelligence platform</div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
               transition-colors duration-200
               ${isActive ? "bg-orange text-white shadow-lg shadow-orange/20" : "text-white/70 hover:bg-navy-light hover:text-white"}`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Pulsing status indicator for real-time connectivity */}
      <div className="px-5 py-4 border-t border-white/10 flex items-center gap-2.5 text-xs">
        <span className="relative flex h-2.5 w-2.5">
          {online && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
          )}
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              online === null ? "bg-gray-400" : online ? "bg-green-400" : "bg-red-500"
            }`}
          />
        </span>
        <span className="text-white/60">
          {online === null ? "Connecting..." : online ? "API connected" : "API offline"}
        </span>
      </div>
      </aside>
    </>
  );
}
