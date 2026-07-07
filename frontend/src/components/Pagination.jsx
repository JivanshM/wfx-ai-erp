// Simple previous/next pagination controls
export default function Pagination({ page, totalPages, onChange }) {
  if (!totalPages) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      <button
        className="btn-primary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-sm text-gray-600">
        Page <span className="font-semibold text-navy">{page}</span> of {totalPages}
      </span>
      <button
        className="btn-primary"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
