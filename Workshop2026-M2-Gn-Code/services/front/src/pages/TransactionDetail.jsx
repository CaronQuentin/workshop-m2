import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, euros } from "../api";
import { PageTitle, StatusBadge, Spinner, Alert } from "../components/ui";

export default function TransactionDetail() {
  const { ref } = useParams();
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPayment(ref).then(setP).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [ref]);

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl">
      <PageTitle title="Détail de la transaction"
        action={<Link to="/history" className="btn-ghost border border-slate-200">← Retour</Link>} />
      {error && <Alert>{error}</Alert>}
      {p && (
        <div className="card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="text-xs text-slate-400">Référence</div>
              <div className="font-mono text-lg font-bold text-slate-800">{p.reference}</div>
            </div>
            <StatusBadge status={p.status} />
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mt-4 text-sm">
            <Field k="Montant" v={<span className="text-xl font-extrabold text-slate-800">{euros(p.amount_cents)}</span>} />
            <Field k="Devise" v={p.currency} />
            <Field k="Bénéficiaire" v={p.beneficiary_name || "—"} />
            <Field k="Compte émetteur" v={p.account} />
            <Field k="Motif" v={p.label || "—"} />
            <Field k="Date" v={p.created_at ? new Date(p.created_at).toLocaleString("fr-FR") : "—"} />
          </div>
          <div className="mt-6 text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
            Traçabilité : opération journalisée et horodatée côté serveur (exploitable pour investigation SOC).
          </div>
        </div>
      )}
    </div>
  );
}

const Field = ({ k, v }) => (
  <div><div className="text-xs text-slate-400 mb-1">{k}</div><div className="font-medium text-slate-700">{v}</div></div>
);
