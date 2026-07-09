import { useEffect, useMemo, useState } from "react";
import { Users, Wallet, Package, Award, ArrowUpDown } from "lucide-react";
import { apiGet } from "../api.js";
import StatCard from "../components/StatCard.jsx";

const fmt = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const paidPct = (r) => (r.invoice_count ? Math.round((r.paid_invoices / r.invoice_count) * 100) : 0);

// colour cues so the eye can scan the table fast
const paidClass = (p) =>
  p >= 60 ? "text-green-400" : p >= 45 ? "text-ink" : "text-red-400";

// columns that can be sorted, and how each value is read out of a row
const COLUMNS = [
  { key: "company_name", label: "Buyer", align: "left", get: (r) => r.company_name },
  { key: "country", label: "Country", align: "left", get: (r) => r.country },
  { key: "buyer_category", label: "Segment", align: "left", get: (r) => r.buyer_category },
  { key: "order_count", label: "Orders", align: "right", get: (r) => r.order_count },
  { key: "units_ordered", label: "Units", align: "right", get: (r) => r.units_ordered },
  { key: "invoice_count", label: "Invoices", align: "right", get: (r) => r.invoice_count },
  { key: "paid_pct", label: "Paid %", align: "right", get: paidPct },
  { key: "overdue_invoices", label: "Overdue", align: "right", get: (r) => r.overdue_invoices },
];

export default function BuyerScorecard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState({ key: "units_ordered", dir: "desc" });

  useEffect(() => {
    apiGet("/api/buyers")
      .then((d) => setRows(d.buyers))
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

  if (error) return <div className="text-red-600">Could not load buyers: {error}</div>;
  if (!rows) return <div className="text-gray-500">Loading buyer scorecard...</div>;

  const totalUnits = rows.reduce((s, r) => s + Number(r.units_ordered), 0);
  const withInv = rows.filter((r) => r.invoice_count > 0);
  const avgPaid = withInv.length
    ? Math.round(withInv.reduce((s, r) => s + paidPct(r), 0) / withInv.length)
    : 0;
  const topBuyer = [...rows].sort((a, b) => Number(b.units_ordered) - Number(a.units_ordered))[0];

  return (
    <div>
      <h1 className="page-title">Buyer Scorecard</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Order volume, segment and payment reliability for every buyer - the commercial view
      </p>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Users} label="Buyers" value={fmt(rows.length)} />
        <StatCard icon={Wallet} label="Avg Paid Rate" value={`${avgPaid}%`} />
        <StatCard icon={Package} label="Total Units" value={fmt(totalUnits)} />
        <StatCard icon={Award} label="Top Buyer" value={topBuyer.company_name} />
      </div>

      {/* Scorecard table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
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
              <tr key={r.buyer_id} className="border-b border-line/60 hover:bg-workspace">
                <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{r.company_name}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{r.country}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-navy text-gray-300">{r.buyer_category}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{fmt(r.order_count)}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink">{fmt(r.units_ordered)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{fmt(r.invoice_count)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 bg-track rounded-full overflow-hidden">
                      <div className="h-full bg-orange rounded-full" style={{ width: `${paidPct(r)}%` }} />
                    </div>
                    <span className={`text-xs font-semibold w-9 text-right ${paidClass(paidPct(r))}`}>{paidPct(r)}%</span>
                  </div>
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${r.overdue_invoices > 12 ? "text-red-400" : "text-gray-400"}`}>
                  {r.overdue_invoices}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Paid % = share of a buyer's invoices marked <span className="text-gray-400">Paid</span>;
        Overdue = count marked <span className="text-gray-400">Overdue</span>. Payment health is shown as invoice
        counts, not summed amounts, because invoices span multiple currencies.
      </p>
    </div>
  );
}
