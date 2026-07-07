import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiGet } from "../api.js";

const fmt = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

// Full product popup: attributes, supplier, tech pack and order history.
export default function ProductDetail({ styleNumber, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet(`/api/products/${styleNumber}`).then(setData).catch((e) => setError(e.message));
  }, [styleNumber]);

  return (
    <div
      className="fixed inset-0 bg-navy/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl max-w-3xl w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {error && <div className="p-6 text-sm text-red-600">{error}</div>}
        {!data && !error && <div className="p-6 text-sm text-gray-500">Loading product...</div>}

        {data && (
          <div className="grid md:grid-cols-[240px_1fr]">
            {/* Photo */}
            <img
              src={data.product.image_url}
              alt={data.product.style_name}
              className="w-full h-56 md:h-full object-cover"
            />

            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-gray-400">{data.product.style_number}</div>
                  <h2 className="section-title">{data.product.style_name}</h2>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-orange transition-colors duration-200">
                  <X size={20} />
                </button>
              </div>

              {/* Attributes */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mt-3">
                {[
                  ["Category", data.product.category],
                  ["Fabric", data.product.fabric],
                  ["GSM", data.product.gsm],
                  ["Color", data.product.color],
                  ["Print", data.product.print],
                  ["Season", data.product.season],
                  ["Brand", data.product.brand],
                  ["Cost", `₹${fmt(data.product.cost)}`],
                  ["Selling price", `₹${fmt(data.product.selling_price)}`],
                  [
                    "Margin",
                    `${Math.round(((data.product.selling_price - data.product.cost) / data.product.cost) * 100)}%`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-line py-1">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-ink">{value}</span>
                  </div>
                ))}
              </div>

              {/* Supplier */}
              <div className="text-sm mt-3 bg-workspace rounded-lg p-3">
                <span className="font-semibold text-ink">{data.product.supplier_name}</span>
                <span className="text-gray-500">
                  {" "}· {data.product.supplier_country} · {data.product.lead_time_days} days lead time
                  · rating {data.product.supplier_rating}
                </span>
              </div>

              {/* Tech pack - the garment's technical specification */}
              {data.tech_pack && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-ink mb-2">Tech Pack</h3>
                  <div className="text-sm space-y-1">
                    <div><span className="text-gray-500">Fabric:</span> {data.tech_pack.fabric_details}</div>
                    <div><span className="text-gray-500">Construction:</span> {data.tech_pack.construction}</div>
                    <div><span className="text-gray-500">Care:</span> {data.tech_pack.wash_instructions}</div>
                  </div>
                </div>
              )}

              {/* Order history */}
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-ink mb-2">
                  Orders: {data.order_summary.orders} · {fmt(data.order_summary.total_pieces)} pieces
                  · ₹{fmt(data.order_summary.total_value)}
                </h3>
                {data.recent_orders.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="py-1 font-medium">Order</th>
                        <th className="py-1 font-medium">Buyer</th>
                        <th className="py-1 font-medium">Qty</th>
                        <th className="py-1 font-medium">Shipment</th>
                        <th className="py-1 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_orders.map((o) => (
                        <tr key={o.order_number} className="border-t border-line hover:bg-[#1e1f23] transition-colors duration-200">
                          <td className="py-1.5">{o.order_number}</td>
                          <td className="py-1.5">{o.buyer}</td>
                          <td className="py-1.5">{fmt(o.quantity)}</td>
                          <td className="py-1.5">{o.shipment_date}</td>
                          <td className="py-1.5">
                            <span className="bg-orange/10 text-orange rounded-full px-2 py-0.5 font-medium">
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
