import { useEffect, useState } from "react";
import { Shirt, Factory, Users, ShoppingCart } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { apiGet } from "../api.js";
import StatCard from "../components/StatCard.jsx";

const CURRENCY_SYMBOL = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
const fmt = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/dashboard/stats").then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="text-red-600">Could not load stats: {error}</div>;
  if (!stats) return <div className="text-gray-500">Loading dashboard...</div>;

  const totalOrders = stats.orders_by_status.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">Live summary of the ERP data</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Shirt} label="Finished Goods" value={fmt(stats.total_finished_goods)} />
        <StatCard icon={Factory} label="Suppliers" value={fmt(stats.total_suppliers)} />
        <StatCard icon={Users} label="Buyers" value={fmt(stats.total_buyers)} />
        <StatCard icon={ShoppingCart} label="Sales Orders" value={fmt(stats.total_orders)} />
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mt-4">
        {/* Revenue: shown per currency because mixing currencies would be wrong */}
        <div className="card p-5">
          <h2 className="section-title mb-1">Total Revenue</h2>
          <p className="text-xs text-gray-400 mb-4">Invoiced amounts, per currency</p>
          <div className="space-y-3">
            {stats.revenue_by_currency.map((r) => (
              <div key={r.currency} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">{r.currency}</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-navy">
                    {CURRENCY_SYMBOL[r.currency]}{fmt(r.total_invoiced)}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {CURRENCY_SYMBOL[r.currency]}{fmt(r.total_paid)} received
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Orders by status - bar chart */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Orders by Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.orders_by_status}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} angle={-20} dy={8} />
              <YAxis tick={{ fontSize: 11 }} width={36} />
              <Tooltip cursor={{ fill: "#f9fafb" }} />
              {/* animation off: bars show instantly (also in screenshots/recordings) */}
              <Bar dataKey="count" fill="#ff6b35" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Same data as progress bars (6px, rounded - per design spec) */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Order Pipeline Share</h2>
          <div className="space-y-4">
            {stats.orders_by_status.map((s) => (
              <div key={s.status}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600">{s.status}</span>
                  <span className="font-semibold text-navy">
                    {Math.round((s.count / totalOrders) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange rounded-full transition-all duration-500"
                    style={{ width: `${(s.count / totalOrders) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
