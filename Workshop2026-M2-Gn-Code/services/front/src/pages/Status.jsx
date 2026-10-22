import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Status() {
  const [health, setHealth] = useState(null);
  const [events, setEvents] = useState([]);
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    const tick = async () => {
      const t0 = performance.now();
      try { const h = await api.health(); setHealth(h.status); setLatency(Math.round(performance.now() - t0)); }
      catch { setHealth("unreachable"); setLatency(null); }
      try { setEvents(await api.remediationEvents()); } catch {}
    };
    tick(); const id = setInterval(tick, 2000); return () => clearInterval(id);
  }, []);

  const up = health === "ok";
  const last = events.find((e) => e.kind === "remediation_success" || e.kind === "remediation_escalated");

  return (
    <div className="min-h-full bg-slate-50">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-700 text-white grid place-items-center font-extrabold">S</div>
          <span className="font-extrabold text-slate-800">SWAP · État du service</span>
        </div>
        <Link to="/" className="text-sm text-brand-700 hover:underline">← Espace client</Link>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        <div className={`card p-6 mb-6 border-l-4 ${up ? "border-l-emerald-500" : "border-l-rose-500"}`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${up ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
            <span className="text-xl font-extrabold text-slate-800">
              {up ? "Tous les systèmes sont opérationnels" : "Incident en cours — reprise automatique"}
            </span>
          </div>
          <div className="text-sm text-slate-400 mt-2">
            API de paiement · latence /health : {latency ?? "—"} ms · actualisation toutes les 2 s
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Tile label="Service de paiement" ok={up} okText="Opérationnel" koText="Dégradé" />
          <Tile label="Dernière remédiation"
            ok={!last || last.kind === "remediation_success"}
            okText={last ? "Reprise vérifiée" : "Aucune"}
            koText="Escalade opérateur" />
          <div className="card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reprise</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">
              {last?.verification?.duration_s != null ? `${last.verification.duration_s}s` : "—"}
            </div>
            <div className="text-xs text-slate-400 mt-1">transaction de contrôle</div>
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-3 border-b border-slate-100 font-bold text-slate-700">Journal des événements</div>
          <div className="max-h-96 overflow-auto divide-y divide-slate-50">
            {events.length === 0 && <div className="p-5 text-sm text-slate-400">Aucun événement récent.</div>}
            {events.map((e, i) => (
              <div key={i} className="flex gap-3 px-5 py-2 text-sm">
                <span className="text-slate-300 shrink-0 font-mono text-xs pt-0.5">{(e.ts || "").slice(11, 19)}</span>
                <span className={`shrink-0 font-semibold ${
                  e.kind.includes("success") ? "text-emerald-600" :
                  e.kind.includes("escalat") || e.kind.includes("error") ? "text-rose-600" :
                  e.kind.includes("block") ? "text-amber-600" : "text-brand-700"}`}>{label(e.kind)}</span>
                <span className="text-slate-500 truncate">{summary(e)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, ok, okText, koText }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-lg font-extrabold mt-2 ${ok ? "text-emerald-600" : "text-rose-600"}`}>{ok ? okText : koText}</div>
    </div>
  );
}
const label = (k) => ({
  alert_received: "Alerte détectée", block_added: "IP bloquée", docker_restart: "Service relancé",
  remediation_success: "Reprise vérifiée", remediation_escalated: "Escalade",
}[k] || k);
const summary = (e) => {
  if (e.source_ip) return `source ${e.source_ip} · type ${e.type || ""}`;
  if (e.ip) return `${e.ip}`;
  if (e.container) return `${e.container}`;
  if (e.verification?.reference) return `contrôle ${e.verification.reference}`;
  return "";
};
