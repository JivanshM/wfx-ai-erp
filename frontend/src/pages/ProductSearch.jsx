import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiGet } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import Pagination from "../components/Pagination.jsx";

const PAGE_SIZE = 24;

export default function ProductSearch() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // load category options once for the filter dropdown
  useEffect(() => {
    apiGet("/api/products/filters")
      .then((f) => setCategories(f.categories))
      .catch(() => {});
  }, []);

  // Debounce: wait 400ms after the user stops typing, then search. Without
  // this we would hit the API on every single keystroke. Re-runs on page
  // change too, so the pager fetches the next slice of results.
  useEffect(() => {
    if (!query.trim()) { setResult(null); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, limit: PAGE_SIZE, page });
      if (category) params.set("category", category);
      apiGet(`/api/search?${params}`)
        .then(setResult)
        .catch(() => setResult({ found: 0, hits: [] }))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query, category, page]);

  const totalPages = result ? Math.ceil(result.found / PAGE_SIZE) : 0;

  return (
    <div>
      <h1 className="page-title">Product Search</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Search by meaning, not just keywords - try "warm winter jacket" or "blue floral dress"
      </p>

      {/* Full-width search bar so it lines up with the results grid below.
          The select is wrapped in a fixed-width box because .input already
          carries w-full, which would otherwise swallow the whole row. */}
      <div className="card p-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Describe what you're looking for..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-full sm:w-44 shrink-0">
          <select
            className="input"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500 mt-6">Searching...</div>}

      {/* Helpful prompt before anyone has typed */}
      {!loading && !result && (
        <div className="text-sm text-gray-500 mt-10 text-center">
          Start typing to search the catalog by meaning - "cropped denim", "something for summer", even with a typo.
        </div>
      )}

      {!loading && result && (
        <>
          <div className="text-sm text-gray-500 mt-6 mb-3">{result.found} garments found</div>
          {result.hits.length === 0 ? (
            <div className="text-sm text-gray-500">No matches - try different words or clear the category filter.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
              {result.hits.map((p) => <ProductCard key={p.style_number} product={p} />)}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
