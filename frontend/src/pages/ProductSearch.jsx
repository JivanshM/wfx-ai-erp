import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiGet } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";

export default function ProductSearch() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // load category options once for the filter dropdown
  useEffect(() => {
    apiGet("/api/products/filters")
      .then((f) => setCategories(f.categories))
      .catch(() => {});
  }, []);

  // Debounce: wait 400ms after the user stops typing, then search.
  // Without this we would hit the API on every single keystroke.
  useEffect(() => {
    if (!query.trim()) { setResult(null); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, limit: 24 });
      if (category) params.set("category", category);
      apiGet(`/api/search?${params}`)
        .then(setResult)
        .catch(() => setResult({ found: 0, hits: [] }))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query, category]);

  return (
    <div>
      <h1 className="page-title">Product Search</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Search by meaning, not just keywords - try "warm winter jacket" or "blue floral dress"
      </p>

      <div className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Describe what you're looking for..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading && <div className="text-sm text-gray-500 mt-6">Searching...</div>}

      {!loading && result && (
        <>
          <div className="text-sm text-gray-500 mt-6 mb-3">
            {result.found} garments found
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {result.hits.map((p) => <ProductCard key={p.style_number} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
