import { useEffect, useState } from "react";
import { Shirt, Factory, Users, ShoppingCart, Sparkles } from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { apiGet } from "../api.js";
import StatCard from "../components/StatCard.jsx";
import AskData from "../components/AskData.jsx";

const CURRENCY_SYMBOL = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
const fmt = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null); // loads separately (slower)

  useEffect(() => {
    apiGet("/api/dashboard/stats").then(setStats).catch((e) => setError(e.message));
    apiGet("/api/dashboard/insights").then(setInsights).catch(() => setInsights({ insights: [] }));
  }, []);

  if (error) return <div className="text-red-600">Could not load stats: {error}</div>;
  if (!stats) return <div className="text-gray-500">Loading dashboard...</div>;

  const totalOrders = stats.orders_by_status.reduce((sum, s) => sum + s.count, 0);
  const maxBuyerPieces = Math.max(...stats.top_buyers.map((b) => b.pieces));
  const maxMargin = Math.max(...stats.category_margins.map((c) => c.margin_pct));

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

      {/* AI-written insights about the data */}
      <div className="card p-5 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-orange" />
          <h2 className="section-title">AI Insights</h2>
          <AskData />
        </div>
        {!insights ? (
          <div className="text-sm text-gray-400">Analysing the data...</div>
        ) : insights.insights.length === 0 ? (
          <div className="text-sm text-gray-400">Insights unavailable right now.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {insights.insights.map((text, i) => (
              <div key={i} className="bg-workspace rounded-lg p-3.5 text-sm text-gray-300">
                {text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mt-4">
        {/* Revenue: shown per currency because mixing currencies would be wrong */}
        <div className="card p-5">
          <h2 className="section-title mb-1">Total Revenue</h2>
          <p className="text-xs text-gray-400 mb-4">Invoiced amounts, per currency</p>
          <div className="space-y-3">
            {stats.revenue_by_currency.map((r) => (
              <div key={r.currency} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-400">{r.currency}</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-ink">
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#26272b" />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: "#9ca3af" }} interval={0} angle={-20} dy={8} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={36} />
              <Tooltip cursor={{ fill: "#1e1f23" }} contentStyle={{ background: "#1b1c1f", border: "1px solid #2a2b2f", borderRadius: 8, color: "#f4f4f5" }} labelStyle={{ color: "#f4f4f5" }} />
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
                  <span className="text-gray-400">{s.status}</span>
                  <span className="font-semibold text-ink">
                    {Math.round((s.count / totalOrders) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-track rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange rounded-full transition-all duration-500"
                    style={{ width: `${(s.count / totalOrders) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Orders shipped per month - the trend over time */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Monthly Order Volume</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.monthly_orders}>
              <defs>
                <linearGradient id="orangeFade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b35" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ff6b35" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#26272b" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} interval={3} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={36} />
              <Tooltip cursor={{ stroke: "#3a3b40" }} contentStyle={{ background: "#1b1c1f", border: "1px solid #2a2b2f", borderRadius: 8, color: "#f4f4f5" }} labelStyle={{ color: "#f4f4f5" }} />
              <Area
                type="monotone" dataKey="orders" stroke="#ff6b35" strokeWidth={2}
                fill="url(#orangeFade)" isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top buyers by pieces ordered */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Top Buyers by Volume</h2>
          <div className="space-y-4">
            {stats.top_buyers.map((b) => (
              <div key={b.company_name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400 truncate pr-2">{b.company_name}</span>
                  <span className="font-semibold text-ink whitespace-nowrap">
                    {fmt(b.pieces)} pcs
                  </span>
                </div>
                <div className="h-1.5 bg-track rounded-full overflow-hidden">
                  <div
                    className="h-full bg-navy rounded-full"
                    style={{ width: `${(b.pieces / maxBuyerPieces) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Average profit margin per category */}
        <div className="card p-5">
          <h2 className="section-title mb-1">Margin by Category</h2>
          <p className="text-xs text-gray-400 mb-4">Average (selling − cost) / cost</p>
          <div className="space-y-3">
            {stats.category_margins.slice(0, 6).map((c) => (
              <div key={c.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{c.category}</span>
                  <span className="font-semibold text-ink">{c.margin_pct}%</span>
                </div>
                <div className="h-1.5 bg-track rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange rounded-full"
                    style={{ width: `${(c.margin_pct / maxMargin) * 100}%` }}
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
