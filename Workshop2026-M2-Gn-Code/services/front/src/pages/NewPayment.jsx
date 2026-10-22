import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, euros } from "../api";
import { PageTitle, Alert } from "../components/ui";

export default function NewPayment() {
  const navigate = useNavigate();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [form, setForm] = useState({ beneficiary_name: "", amount: "", label: "" });
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => { api.beneficiaries().then(setBeneficiaries).catch(() => {}); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const cents = () => Math.round(parseFloat((form.amount || "0").replace(",", ".")) * 100);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const cents = Math.round(parseFloat(form.amount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) { setError("Montant invalide"); return; }
    if (cents > MAX_CENTS) { setError(`Montant maximum : ${euros(MAX_CENTS)} par paiement`); return; }
    setBusy(true); setStep(0);
    try {
      // Chargement simulé (purement visuel) : les étapes défilent pendant
      // que le vrai appel API s'exécute ; le reçu n'apparaît qu'à la fin des deux.
      const call = api.createPayment({
        amount_cents: cents, currency: "EUR",
        beneficiary_name: form.beneficiary_name, label: form.label,
      });
      call.catch(() => {}); // l'erreur éventuelle est traitée après l'animation
      for (let i = 0; i < STEPS.length; i++) {
        setStep(i);
        await sleep(STEPS[i].ms);
      }
      setReceipt(await call);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (busy) {
    const pct = Math.round(((step + 1) / STEPS.length) * 100);
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full border-4 border-brand-100 border-t-brand-700 animate-spin" />
            <div>
              <div className="font-extrabold text-slate-800">Traitement du paiement</div>
              <div className="text-sm text-slate-500">{euros(cents())} → {form.beneficiary_name}</div>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-brand-700 transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <ul className="space-y-3 text-sm">
            {STEPS.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold ${
                  i < step ? "bg-emerald-500 text-white" :
                  i === step ? "bg-brand-700 text-white animate-pulse" : "bg-slate-100 text-slate-400"}`}>
                  {i < step ? "✓" : i + 1}
                </span>
                <span className={i <= step ? "text-slate-700 font-medium" : "text-slate-400"}>{s.label}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-6">Ne fermez pas cette page.</p>
        </div>
      </div>
    );
  }

  if (receipt) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-2xl mx-auto mb-4">✓</div>
          <h1 className="text-xl font-extrabold text-slate-800">Paiement validé</h1>
          <p className="text-slate-500 text-sm mt-1">Votre paiement a été capturé avec succès.</p>
          <div className="text-left bg-slate-50 rounded-lg p-4 mt-6 text-sm space-y-2">
            <Row k="Référence" v={receipt.reference} />
            <Row k="Bénéficiaire" v={receipt.beneficiary_name || "—"} />
            <Row k="Montant" v={euros(receipt.amount_cents)} />
            <Row k="Statut" v="Validé" />
          </div>
          <div className="flex gap-3 mt-6">
            <Link to={`/history/${receipt.reference}`} className="btn-primary flex-1">Voir le détail</Link>
            <button onClick={() => { setReceipt(null); setForm({ beneficiary_name: "", amount: "", label: "" }); }}
              className="btn-ghost flex-1 border border-slate-200">Nouveau paiement</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageTitle title="Nouveau paiement" subtitle="Émettre un virement fictif" />
      <form onSubmit={submit} className="card p-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        <div>
          <label className="label">Bénéficiaire</label>
          <input className="input" list="benef" maxLength={128} placeholder="Nom du bénéficiaire"
            value={form.beneficiary_name} onChange={set("beneficiary_name")} required />
          <datalist id="benef">
            {beneficiaries.map((b) => <option key={b.id} value={b.name} />)}
          </datalist>
        </div>
        <div>
          <label className="label">Montant (€) — max 100 000 €</label>
          <input className="input" inputMode="decimal" placeholder="0,00" value={form.amount} onChange={set("amount")} required />
        </div>
        <div>
          <label className="label">Motif (facultatif)</label>
          <input className="input" maxLength={160} placeholder="Ex : facture octobre" value={form.label} onChange={set("label")} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Traitement…" : "Payer"}</button>
      </form>
    </div>
  );
}

// Plafond par paiement, aligné sur la validation de payment-api (le=10_000_000).
const MAX_CENTS = 10_000_000;

// Étapes affichées pendant le chargement simulé (~4 s au total).
const STEPS = [
  { label: "Vérification du bénéficiaire", ms: 800 },
  { label: "Contrôle anti-fraude", ms: 1100 },
  { label: "Autorisation bancaire", ms: 1000 },
  { label: "Capture du paiement", ms: 900 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const Row = ({ k, v }) => (
  <div className="flex justify-between"><span className="text-slate-400">{k}</span><span className="font-medium text-slate-700">{v}</span></div>
);
