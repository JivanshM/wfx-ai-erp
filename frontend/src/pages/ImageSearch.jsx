import { useState } from "react";
import { Sparkles } from "lucide-react";
import { apiGet } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";

// Visual similarity search: describe a garment and the vector index
// returns the closest-looking products. (Photo upload is a planned upgrade -
// the same vector approach supports it with an image embedding model.)
export default function ImageSearch() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function search(e) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    try {
      setResult(await apiGet(`/api/search?q=${encodeURIComponent(description)}&limit=18`));
    } catch {
      setResult({ found: 0, hits: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Image Search</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Find visually similar garments by describing the look you want
      </p>

      <form onSubmit={search} className="card p-6 max-w-2xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-navy mb-3">
          <Sparkles size={16} className="text-orange" />
          Describe the garment
        </div>
        <textarea
          className="input min-h-20 resize-none"
          placeholder='e.g. "an oversized black hoodie with a bold print" or "light summer dress, pastel colors"'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit" className="btn-primary mt-3" disabled={loading}>
          {loading ? "Searching..." : "Find similar garments"}
        </button>
      </form>

      {result && (
        <>
          <div className="text-sm text-gray-500 mt-6 mb-3">
            {result.found} visually similar garments
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {result.hits.map((p) => <ProductCard key={p.style_number} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
