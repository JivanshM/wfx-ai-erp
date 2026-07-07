import { Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";

// Page shell: dark navy sidebar on the left, light workspace on the right
export default function App() {
  return (
    <div className="flex min-h-screen bg-workspace font-sans text-navy">
      <Sidebar />
      <main className="flex-1 p-8 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
