import { useRef, useState } from "react";
import { Sparkles, Upload, X } from "lucide-react";
import { apiGet, apiUpload } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";

// Visual similarity search, two ways:
//  1. describe the garment in words  -> semantic search
//  2. upload a photo -> a vision model describes it -> same semantic search
export default function ImageSearch() {
  const [mode, setMode] = useState("photo"); // "photo" | "text"
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // local image preview URL
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef(null);

  function chooseFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f)); // show the image before uploading
    setResult(null);
    setError(null);
  }

  async function search(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "photo") {
        if (!file) return;
        const form = new FormData();
        form.append("image", file);
        setResult(await apiUpload("/api/search/by-image?limit=18", form));
      } else {
        if (!description.trim()) return;
        setResult(await apiGet(`/api/search?q=${encodeURIComponent(description)}&limit=18`));
      }
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Image Search</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Upload a garment photo or describe the look - we find visually similar products
      </p>

      <form onSubmit={search} className="card p-6 max-w-2xl">
        {/* Mode switch */}
        <div className="flex gap-2 mb-4">
          {[["photo", "Upload a photo"], ["text", "Describe it"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-200
                ${mode === value ? "bg-orange text-white shadow-lg shadow-orange/20" : "bg-workspace text-gray-400 hover:bg-track"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "photo" ? (
          <>
            {/* Hidden real file input; the styled box below triggers it */}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => chooseFile(e.target.files[0])}
            />
            {preview ? (
              <div className="relative w-40">
                <img src={preview} alt="preview" className="w-40 h-48 object-cover rounded-lg border border-line" />
                <button
                  type="button"
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute -top-2 -right-2 bg-navy text-white rounded-full p-1 hover:bg-orange transition-colors duration-200"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current.click()}
                className="w-full border-2 border-dashed border-[#34363b] rounded-lg p-8
                           text-gray-500 hover:border-orange hover:text-orange
                           transition-colors duration-200 flex flex-col items-center gap-2"
              >
                <Upload size={22} />
                <span className="text-sm font-medium">Click to choose a garment photo</span>
                <span className="text-xs text-gray-400">JPG, PNG or WebP - max 4 MB</span>
              </button>
            )}
          </>
        ) : (
          <textarea
            className="input min-h-20 resize-none"
            placeholder='e.g. "an oversized black hoodie with a bold print" or "light summer dress, pastel colors"'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}

        <button
          type="submit"
          className="btn-primary mt-4"
          disabled={loading || (mode === "photo" ? !file : !description.trim())}
        >
          {loading ? "Searching..." : "Find similar garments"}
        </button>
      </form>

      {error && <div className="mt-4 text-sm bg-red-500/10 text-red-300 rounded-lg p-3 max-w-2xl">{error}</div>}

      {result && (
        <>
          {/* what the AI understood from the photo */}
          {result.description && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mt-6">
              <Sparkles size={15} className="text-orange" />
              AI saw: <span className="font-semibold text-ink">"{result.description}"</span>
            </div>
          )}
          <div className="text-sm text-gray-500 mt-2 mb-3">{result.found} visually similar garments</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {result.hits.map((p) => <ProductCard key={p.style_number} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
