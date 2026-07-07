import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { apiGet } from "../api.js";

// One garment in a results grid. Shows the fields the brief asks for:
// image, style number, name, fabric, GSM, supplier, selling price.
// Also has a "Find similar" button that opens a vector-similarity popup
// (hidden inside the popup itself via showSimilar, to avoid popups in popups).
export default function ProductCard({ product, showSimilar = true }) {
  const [open, setOpen] = useState(false);
  const [similar, setSimilar] = useState(null);
  const [loading, setLoading] = useState(false);

  async function findSimilar() {
    setOpen(true);
    if (similar) return; // already fetched once
    setLoading(true);
    try {
      setSimilar(await apiGet(`/api/search/similar/${product.style_number}?limit=8`));
    } catch {
      setSimilar({ hits: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card overflow-hidden group hover:shadow-md transition-shadow duration-200">
      <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative">
        <img
          src={product.image_url}
          alt={product.style_name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {showSimilar && (
          <button
            onClick={findSimilar}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5
                       bg-navy/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full
                       backdrop-blur-sm hover:bg-orange transition-colors duration-200"
          >
            <Sparkles size={12} /> Find similar
          </button>
        )}
      </div>
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400 font-medium">{product.style_number}</span>
          {product.match_score != null && (
            <span className="text-[11px] font-semibold text-orange bg-orange/10 rounded-full px-2 py-0.5">
              {Math.round(product.match_score * 100)}% match
            </span>
          )}
        </div>
        <div className="font-semibold text-navy text-sm mt-0.5 truncate">{product.style_name}</div>
        <div className="text-xs text-gray-500 mt-1 truncate">
          {product.fabric} · {product.gsm} GSM
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-xs text-gray-400 truncate pr-2">{product.supplier_name}</span>
          <span className="text-sm font-bold text-orange">₹{Number(product.selling_price).toFixed(0)}</span>
        </div>
      </div>

      {/* Similar-products popup */}
      {open && (
        <div
          className="fixed inset-0 bg-navy/60 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-workspace rounded-xl p-5 max-w-4xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">
                Similar to <span className="text-orange">{product.style_name}</span>
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-orange transition-colors duration-200"
              >
                <X size={20} />
              </button>
            </div>
            {loading && <div className="text-sm text-gray-500 py-8 text-center">Finding similar garments...</div>}
            {similar && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {similar.hits.map((p) => (
                  <ProductCard key={p.style_number} product={p} showSimilar={false} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
