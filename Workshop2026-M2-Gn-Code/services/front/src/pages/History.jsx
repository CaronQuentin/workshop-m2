import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, euros } from "../api";
import { PageTitle, StatusBadge, Spinner } from "../components/ui";

const PAGE = 15;

export default function History() {
  const [data, setData] = useState({ total: 0, items: [] });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: PAGE, offset: page * PAGE });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    api.listPayments(params.toString()).then(setData).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [page, status]);
  useEffect(() => { const t = setTimeout(() => { setPage(0); load(); }, 350); return () => clearTimeout(t); }, [q]);

  const exportCsv = () => {
    const rows = [["reference", "beneficiaire", "montant_eur", "statut", "date"],
      ...data.items.map((p) => [p.reference, p.beneficiary_name, (p.amount_cents / 100).toFixed(2), p.status, p.created_at])];
    const csv = rows.map((r) => r.map((c) => `"${c ?? ""}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "transactions.csv"; a.click();
  };

  const pages = Math.ceil(data.total / PAGE) || 1;

  return (
    <div>
      <PageTitle title="Historique des transactions" subtitle={`${data.total} opération(s)`}
        action={<button onClick={exportCsv} className="btn-ghost border border-slate-200">⬇ Exporter CSV</button>} />

      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <input className="input flex-1 min-w-48" placeholder="Rechercher (référence, bénéficiaire, motif)…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-44" value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}>
          <option value="">Tous les statuts</option>
          <option value="captured">Validé</option>
          <option value="pending">En attente</option>
          <option value="blocked">Bloqué</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left font-semibold px-4 py-3">Référence</th>
              <th className="text-left font-semibold px-4 py-3">Bénéficiaire</th>
              <th className="text-left font-semibold px-4 py-3">Date</th>
              <th className="text-right font-semibold px-4 py-3">Montant</th>
              <th className="text-right font-semibold px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan="5"><Spinner /></td></tr>}
            {!loading && data.items.length === 0 && <tr><td colSpan="5" className="text-center text-slate-400 py-10">Aucune transaction.</td></tr>}
            {!loading && data.items.map((p) => (
              <tr key={p.reference} className="hover:bg-slate-50">
                <td className="px-4 py-3"><Link to={`/history/${p.reference}`} className="font-mono text-brand-700 hover:underline">{p.reference}</Link></td>
                <td className="px-4 py-3 text-slate-700">{p.beneficiary_name || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{p.created_at ? new Date(p.created_at).toLocaleString("fr-FR") : "—"}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{euros(p.amount_cents)}</td>
                <td className="px-4 py-3 text-right"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-slate-400">Page {page + 1} / {pages}</span>
        <div className="flex gap-2">
          <button className="btn-ghost border border-slate-200" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</button>
          <button className="btn-ghost border border-slate-200" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Suivant</button>
        </div>
      </div>
    </div>
  );
}
