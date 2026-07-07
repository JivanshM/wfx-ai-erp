// One garment in a results grid. Shows the fields the brief asks for:
// image, style number, name, fabric, GSM, supplier, selling price.
export default function ProductCard({ product }) {
  return (
    <div className="card overflow-hidden group hover:shadow-md transition-shadow duration-200">
      <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
        <img
          src={product.image_url}
          alt={product.style_name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
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
    </div>
  );
}
