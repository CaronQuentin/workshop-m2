import { useEffect, useState } from "react";
import { api } from "../api";
import { PageTitle, Spinner, Alert } from "../components/ui";

export default function Beneficiaries() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", iban: "" });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");

  const load = () => api.beneficiaries().then(setList).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault(); setError("");
    try {
      if (editId) await api.editBeneficiary(editId, form);
      else await api.addBeneficiary(form);
      setForm({ name: "", iban: "" }); setEditId(null); load();
    } catch (err) { setError(err.message); }
  }
  async function remove(id) {
    try { await api.delBeneficiary(id); load(); } catch (err) { setError(err.message); }
  }

  return (
    <div className="max-w-3xl">
      <PageTitle title="Bénéficiaires" subtitle="Votre carnet de bénéficiaires fictifs" />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <form onSubmit={save} className="card p-5 mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="label">Nom</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="flex-1 min-w-56">
          <label className="label">IBAN (fictif)</label>
          <input className="input font-mono" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="FR76…" />
        </div>
        <button className="btn-primary">{editId ? "Enregistrer" : "Ajouter"}</button>
        {editId && <button type="button" className="btn-ghost border border-slate-200"
          onClick={() => { setEditId(null); setForm({ name: "", iban: "" }); }}>Annuler</button>}
      </form>

      <div className="card divide-y divide-slate-100">
        {loading && <Spinner />}
        {!loading && list.length === 0 && <div className="p-6 text-slate-400 text-sm">Aucun bénéficiaire.</div>}
        {list.map((b) => (
          <div key={b.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <div className="font-medium text-slate-700">{b.name}</div>
              <div className="text-xs text-slate-400 font-mono">{b.iban || "—"}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost text-brand-700" onClick={() => { setEditId(b.id); setForm({ name: b.name, iban: b.iban }); }}>Éditer</button>
              <button className="btn-ghost text-rose-600" onClick={() => remove(b.id)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
