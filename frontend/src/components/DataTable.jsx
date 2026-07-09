// Generic table: takes any list of row objects and renders the keys as columns.
// The AI Query screen uses it for non-product results (counts, aggregates,
// buyer/supplier lists); product results are shown as cards instead.
export default function DataTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="text-sm text-gray-500 py-3">No rows returned.</div>;
  }
  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-auto max-h-80 rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-workspace sticky top-0">
          <tr>
            {columns.map((col) => (
              <th key={col} className="text-left font-semibold text-ink px-3 py-2 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-t border-line hover:bg-[#1e1f23] transition-colors duration-200"
            >
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 whitespace-nowrap text-gray-300">
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
