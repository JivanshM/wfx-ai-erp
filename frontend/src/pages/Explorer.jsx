import { useEffect, useState } from "react";
import { apiGet } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import Pagination from "../components/Pagination.jsx";

const SORT_OPTIONS = [
  { value: "style_number:asc", label: "Style number" },
  { value: "style_name:asc", label: "Name A-Z" },
  { value: "selling_price:asc", label: "Price: low to high" },
  { value: "selling_price:desc", label: "Price: high to low" },
  { value: "gsm:asc", label: "GSM: light to heavy" },
  { value: "gsm:desc", label: "GSM: heavy to light" },
];

export default function Explorer() {
  const [options, setOptions] = useState(null); // dropdown choices from the API
  const [filters, setFilters] = useState({ category: "", fabric: "", color: "", season: "", supplier_id: "", search: "" });
  const [sort, setSort] = useState("style_number:asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    apiGet("/api/products/filters").then(setOptions).catch(() => {});
  }, []);

  // Re-fetch whenever a filter, the sort order or the page changes
  useEffect(() => {
    const [sort_by, sort_dir] = sort.split(":");
    const params = new URLSearchParams({ page, page_size: 24, sort_by, sort_dir });
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    apiGet(`/api/products?${params}`).then(setData).catch(() => {});
  }, [filters, sort, page]);

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1); // a new filter always starts from page 1
  }

  const selects = options && [
    ["category", "All categories", options.categories],
    ["fabric", "All fabrics", options.fabrics],
    ["color", "All colors", options.colors],
    ["season", "All seasons", options.seasons],
  ];

  return (
    <div>
      <h1 className="page-title">Finished Goods Explorer</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Browse the full catalog - {data ? data.total : "..."} garments
      </p>

      {/* Filter bar */}
      {options && (
        <div className="card p-4 flex flex-wrap gap-2">
          <input
            className="input max-w-52"
            placeholder="Search name or style no."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
          {selects.map(([key, placeholder, values]) => (
            <select
              key={key}
              className="input max-w-40"
              value={filters[key]}
              onChange={(e) => setFilter(key, e.target.value)}
            >
              <option value="">{placeholder}</option>
              {values.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ))}
          <select
            className="input max-w-48"
            value={filters.supplier_id}
            onChange={(e) => setFilter("supplier_id", e.target.value)}
          >
            <option value="">All suppliers</option>
            {options.suppliers.map((s) => (
              <option key={s.supplier_id} value={s.supplier_id}>{s.company_name}</option>
            ))}
          </select>
          <select className="input max-w-44 ml-auto" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      {/* Product grid */}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 mt-4">
            {data.items.map((p) => <ProductCard key={p.style_number} product={p} />)}
          </div>
          <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
