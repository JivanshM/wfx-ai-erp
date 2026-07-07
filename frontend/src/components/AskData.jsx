import { useState } from "react";
import { Lightbulb, Loader2, Send, X } from "lucide-react";
import { apiPost } from "../api.js";
import DataTable from "./DataTable.jsx";

// The bulb button on the dashboard + its popup. The popup component is
// unmounted on close, so the question and output vanish automatically -
// every open starts fresh.
export default function AskData() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-auto flex items-center gap-2 text-xs font-semibold text-orange
                   bg-orange/10 hover:bg-orange/20 rounded-lg px-3 py-2
                   transition-colors duration-200"
      >
        <Lightbulb size={14} /> Ask the data anything
      </button>
      {open && <AskDataPopup onClose={() => setOpen(false)} />}
    </>
  );
}

function AskDataPopup({ onClose }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function ask(e) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      setResult(await apiPost("/api/query", { question }));
    } catch (err) {
      // network / server-down errors never reach the backend's own handling
      setResult({
        success: false,
        error: `Could not reach the server (${err.message}). Give it a moment and try again.`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-navy/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Lightbulb size={17} className="text-orange" />
              <h2 className="section-title">Ask the data</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              One question in, one insight out — the data keeps no secrets here.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-orange transition-colors duration-200"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={ask} className="flex gap-2 mt-4">
          <input
            autoFocus
            className="input"
            placeholder='e.g. "Which color sells the most?" — go on, ask away'
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary flex items-center gap-2"
            disabled={loading || !question.trim()}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Ask
          </button>
        </form>

        {loading && (
          <div className="text-sm text-gray-500 mt-4">
            Digging through 4,700 rows for you...
          </div>
        )}

        {/* Bad question, unsafe SQL, rate limit, server down - all land here */}
        {result && !result.success && (
          <div className="mt-4 text-sm bg-red-500/10 text-red-300 rounded-lg p-3">
            <span className="font-semibold">Hmm, that one stumped us:</span> {result.error}
            {result.sql && (
              <pre className="mt-2 text-xs bg-navy text-orange/90 rounded-lg p-3 overflow-x-auto">{result.sql}</pre>
            )}
          </div>
        )}

        {result && result.success && (
          <div className="mt-4 space-y-3">
            {result.confidence != null && (
              <span
                title={result.confidence_reason}
                className={`inline-block text-[11px] font-bold rounded-full px-2.5 py-1
                  ${result.confidence >= 80 ? "bg-green-500/15 text-green-400"
                    : result.confidence >= 50 ? "bg-amber-500/15 text-amber-300"
                    : "bg-red-500/15 text-red-300"}`}
              >
                {result.confidence}% confident
              </span>
            )}
            {result.answer && <p className="text-sm text-gray-300">{result.answer}</p>}
            <DataTable rows={result.rows} />
            <details>
              <summary className="text-xs font-semibold text-gray-500 cursor-pointer hover:text-orange transition-colors duration-200">
                View generated SQL
              </summary>
              <pre className="mt-2 text-xs bg-navy text-green-300 rounded-lg p-3 overflow-x-auto">{result.sql}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
