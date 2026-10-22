export function PageTitle({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-extrabold text-slate-800 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

const STATUS_STYLES = {
  captured: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  blocked: "bg-rose-50 text-rose-700 border-rose-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};
export function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || "bg-slate-50 text-slate-600 border-slate-200";
  const fr = { captured: "Validé", pending: "En attente", blocked: "Bloqué", failed: "Échoué" }[status] || status;
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{fr}</span>;
}

export function Alert({ kind = "error", children }) {
  const styles = {
    error: "bg-rose-50 text-rose-700 border-rose-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    info: "bg-brand-50 text-brand-800 border-brand-200",
  }[kind];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function Spinner({ label = "Chargement…" }) {
  return <div className="text-slate-400 text-sm py-10 text-center">{label}</div>;
}
