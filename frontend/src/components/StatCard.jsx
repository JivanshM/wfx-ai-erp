// One summary number on the dashboard
export default function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="h-11 w-11 rounded-lg bg-orange/10 text-orange flex items-center justify-center">
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-bold text-ink leading-tight">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}
