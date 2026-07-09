import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { apiPost } from "../api.js";
import DataTable from "../components/DataTable.jsx";
import ProductDetail from "../components/ProductDetail.jsx";

const SAMPLE_QUESTIONS = [
  "Show all black hoodies under 900",
  "Which buyer generated the highest revenue?",
  "Which supplier supplied the most denim products?",
  "Show pending invoices above 1000",
];

export default function AiQuery() {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState([]); // one entry per asked question
  const [detail, setDetail] = useState(null); // style_number of the open product popup

  async function ask(q) {
    const text = (q ?? question).trim();
    if (!text) return;
    setQuestion("");
    // add a "loading" entry first, then replace it when the answer arrives
    setEntries((prev) => [...prev, { question: text, loading: true }]);
    let result;
    try {
      result = await apiPost("/api/query", { question: text });
    } catch (e) {
      result = { success: false, error: e.message };
    }
    setEntries((prev) =>
      prev.map((entry, i) =>
        i === prev.length - 1 ? { question: text, loading: false, ...result } : entry
      )
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="page-title">AI Query</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Ask questions about the ERP data in plain English - no SQL needed
      </p>

      {/* Question input */}
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); ask(); }}
      >
        <input
          className="input"
          placeholder="e.g. Which supplier has the highest average order value?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className="btn-primary flex items-center gap-2">
          <Send size={15} /> Ask
        </button>
      </form>

      {/* Sample questions to get started */}
      {entries.length === 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {SAMPLE_QUESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="text-xs bg-card border border-line rounded-full px-3 py-1.5
                         text-gray-400 hover:border-orange hover:text-orange
                         transition-colors duration-200"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* One card per question, newest at the bottom */}
      <div className="space-y-4 mt-6">
        {entries.map((entry, i) => (
          <div key={i} className="card p-5">
            <div className="font-semibold text-ink">{entry.question}</div>

            {entry.loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-3">
                <Loader2 size={15} className="animate-spin text-orange" />
                Thinking...
              </div>
            )}

            {!entry.loading && !entry.success && (
              <div className="mt-3 text-sm bg-red-500/10 text-red-300 rounded-lg p-3">
                {entry.error}
              </div>
            )}

            {!entry.loading && entry.success && (
              <div className="mt-3 space-y-3">
                {/* Confidence: the model's own rating of its SQL */}
                {entry.confidence != null && (
                  <span
                    title={entry.confidence_reason}
                    className={`inline-block text-[11px] font-bold rounded-full px-2.5 py-1
                      ${entry.confidence >= 80 ? "bg-green-500/15 text-green-400"
                        : entry.confidence >= 50 ? "bg-amber-500/15 text-amber-300"
                        : "bg-red-500/15 text-red-300"}`}
                  >
                    {entry.confidence}% confident
                    {entry.confidence_reason && ` · ${entry.confidence_reason}`}
                  </span>
                )}
                {/* AI answer */}
                {entry.answer && <p className="text-sm text-gray-300">{entry.answer}</p>}

                {/* Result table - product rows open the full detail popup */}
                <DataTable rows={entry.rows} onProductClick={setDetail} />
                <div className="text-xs text-gray-400">
                  {entry.row_count} row{entry.row_count === 1 ? "" : "s"}
                  {entry.truncated && " (showing first 200)"}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {detail && <ProductDetail styleNumber={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
