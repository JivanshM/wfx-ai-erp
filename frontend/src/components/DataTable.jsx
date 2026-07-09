// Generic table: takes any list of row objects and renders the keys as columns.
// Used by the AI Query screen to show query results.
// When a row is a product (has a style_number) and onProductClick is given,
// the row becomes clickable and opens that product's detail - just like a
// product card on the Goods Explorer.
export default function DataTable({ rows, onProductClick }) {
  if (!rows || rows.length === 0) {
    return <div className="text-sm text-gray-500 py-3">No rows returned.</div>;
  }
  const columns = Object.keys(rows[0]);
  const clickable = Boolean(onProductClick) && columns.includes("style_number");

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
          {rows.map((row, i) => {
            const canClick = clickable && row.style_number;
            return (
              <tr
                key={i}
                onClick={canClick ? () => onProductClick(String(row.style_number)) : undefined}
                title={canClick ? "View product details" : undefined}
                className={`border-t border-line hover:bg-[#1e1f23] transition-colors duration-200
                  ${canClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={`px-3 py-2 whitespace-nowrap ${
                      col === "style_number" && canClick ? "text-orange font-medium" : "text-gray-300"
                    }`}
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
