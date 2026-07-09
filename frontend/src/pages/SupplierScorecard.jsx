import { useEffect, useMemo, useState } from "react";
import { Factory, Star, Clock, Award, ArrowUpDown } from "lucide-react";
import { apiGet } from "../api.js";
import StatCard from "../components/StatCard.jsx";

const fmt = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fulfilled = (r) => (r.order_count ? Math.round((r.delivered_orders / r.order_count) * 100) : 0);

// colour cues so the eye can scan the table fast
const ratingClass = (r) =>
  r >= 4 ? "text-green-400 bg-green-400/10" : r >= 3.4 ? "text-orange bg-orange/10" : "text-red-400 bg-red-400/10";
const leadClass = (d) => (d <= 30 ? "text-green-400" : d <= 60 ? "text-ink" : "text-red-400");

// columns that can be sorted, and how each value is read out of a row
const COLUMNS = [
  { key: "company_name", label: "Supplier", align: "left", get: (r) => r.company_name },
  { key: "country", label: "Country", align: "left", get: (r) => r.country },
  { key: "rating", label: "Rating", align: "right", get: (r) => Number(r.rating) },
  { key: "lead_time_days", label: "Lead Time", align: "right", get: (r) => r.lead_time_days },
  { key: "product_count", label: "Products", align: "right", get: (r) => r.product_count },
  { key: "order_count", label: "Orders", align: "right", get: (r) => r.order_count },
  { key: "units_ordered", label: "Units", align: "right", get: (r) => r.units_ordered },
  { key: "fulfilled", label: "Fulfilled", align: "right", get: fulfilled },
];

export default function SupplierScorecard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState({ key: "rating", dir: "desc" });

  useEffect(() => {
    apiGet("/api/suppliers")
      .then((d) => setRows(d.suppliers))
      .catch((e) => setError(e.message));
  }, []);

  // sort a copy whenever the data or the chosen column changes
  const sorted = useMemo(() => {
    if (!rows) return [];
    const col = COLUMNS.find((c) => c.key === sort.key);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.get(a), bv = col.get(b);
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [rows, sort]);

  // click a header: same column flips direction, new column starts descending
  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  if (error) return <div className="text-red-600">Could not load suppliers: {error}</div>;
  if (!rows) return <div className="text-gray-500">Loading supplier scorecard...</div>;

  const avgRating = (rows.reduce((s, r) => s + Number(r.rating), 0) / rows.length).toFixed(1);
  const avgLead = Math.round(rows.reduce((s, r) => s + r.lead_time_days, 0) / rows.length);
  const topRated = [...rows].sort((a, b) => Number(b.rating) - Number(a.rating))[0];

  return (
    <div>
      <h1 className="page-title">Supplier Scorecard</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Rating, lead time and production volume for every factory - the sourcing view
      </p>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Factory} label="Suppliers" value={fmt(rows.length)} />
        <StatCard icon={Star} label="Avg Rating" value={avgRating} />
        <StatCard icon={Clock} label="Avg Lead Time" value={`${avgLead}d`} />
        <StatCard icon={Award} label="Top Rated" value={topRated.company_name} />
      </div>

      {/* Scorecard table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-line text-gray-400">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggle(c.key)}
                  className={`px-4 py-3 font-semibold cursor-pointer select-none hover:text-ink
                    ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.align === "right" && <ArrowUpDown size={12} className={sort.key === c.key ? "text-orange" : "opacity-40"} />}
                    {c.label}
                    {c.align === "left" && <ArrowUpDown size={12} className={sort.key === c.key ? "text-orange" : "opacity-40"} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.supplier_id} className="border-b border-line/60 hover:bg-workspace">
                <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{r.company_name}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{r.country}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${ratingClass(Number(r.rating))}`}>
                    {Number(r.rating).toFixed(1)} ★
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${leadClass(r.lead_time_days)}`}>
                  {r.lead_time_days}d
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{fmt(r.product_count)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{fmt(r.order_count)}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink">{fmt(r.units_ordered)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 bg-track rounded-full overflow-hidden">
                      <div className="h-full bg-orange rounded-full" style={{ width: `${fulfilled(r)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-9 text-right">{fulfilled(r)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Fulfilled = share of a supplier's orders marked <span className="text-gray-400">Delivered</span>.
        Rating and lead time come straight from the supplier master; products, orders and units are rolled up from
        the orders placed against each factory's styles.
      </p>
    </div>
  );
}
