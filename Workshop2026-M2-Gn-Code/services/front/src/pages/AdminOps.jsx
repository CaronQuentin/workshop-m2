import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { PageTitle, StatCard } from "../components/ui";

// ---------------------------------------------------------------- pop-up compte rendu
const sec = (v) => (v === null || v === undefined ? "n/d" : `${v} s`);

function ReportModal({ report, onClose }) {
  if (!report) return null;
  const ok = report.statut === "vérifié";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
         onClick={onClose}>
      <div className="card w-full max-w-lg p-0 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className={`px-6 py-4 flex items-center justify-between ${ok ? "bg-emerald-600" : "bg-rose-600"}`}>
          <div className="text-white">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Compte rendu d'incident</div>
            <div className="text-lg font-extrabold">
              {ok ? "✅ Reprise vérifiée" : "⚠️ Escaladé — opérateur requis"}
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="text-xs font-semibold uppercase text-slate-400">Détection</div>
              <div className="text-2xl font-extrabold text-slate-800 mt-1">{sec(report.temps_detection_s)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="text-xs font-semibold uppercase text-slate-400">Reprise</div>
              <div className="text-2xl font-extrabold text-slate-800 mt-1">{sec(report.temps_reprise_s)}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="text-xs font-semibold uppercase text-slate-400">Paiements perdus</div>
              <div className={`text-2xl font-extrabold mt-1 ${report.paiements_perdus_5xx ? "text-rose-600" : "text-emerald-600"}`}>
                {report.paiements_perdus_5xx ?? "n/d"}
              </div>
            </div>
          </div>

          <dl className="text-sm divide-y divide-slate-100">
            <div className="flex justify-between py-2"><dt className="text-slate-500">Type d'incident</dt><dd className="font-semibold text-slate-700">{report.type}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-slate-500">MTTR total (attaque → clôture)</dt><dd className="font-semibold text-slate-700">{sec(report.mttr_total_s)}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-slate-500">Transaction de contrôle</dt><dd className="font-semibold text-slate-700">{sec(report.transaction_controle_s)}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-slate-500">Tentatives de remédiation</dt><dd className="font-semibold text-slate-700">{report.tentatives}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-slate-500">IP source</dt><dd className="font-mono text-slate-700">{report.source_ip || "—"}</dd></div>
          </dl>

          <div className="mt-5 text-right">
            <button onClick={onClose} className="btn-primary">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Regroupement et libellés lisibles des conteneurs par domaine.
const META = {
  front:                 { label: "Front SWAP", group: "Métier" },
  "auth-service":        { label: "Authentification (JWT)", group: "Métier" },
  "payment-api":         { label: "API de paiement", group: "Métier" },
  postgres:              { label: "Base de données", group: "Données & secrets" },
  vault:                 { label: "Vault (secrets)", group: "Données & secrets" },
  waf:                   { label: "WAF (ModSecurity)", group: "Sécurité & résilience" },
  "remediation-engine":  { label: "Moteur de remédiation", group: "Sécurité & résilience" },
  "docker-socket-proxy": { label: "Proxy Docker (restreint)", group: "Sécurité & résilience" },
  "anomaly-detector":    { label: "Détection d'anomalies (ML)", group: "IA / Data" },
  "rag-assistant":       { label: "Assistant RAG", group: "IA / Data" },
  prometheus:            { label: "Prometheus (métriques)", group: "Observabilité" },
  loki:                  { label: "Loki (journaux)", group: "Observabilité" },
  promtail:              { label: "Promtail (collecte)", group: "Observabilité" },
  grafana:               { label: "Grafana (SOC)", group: "Observabilité" },
  "traffic-generator":   { label: "Générateur de trafic", group: "Outils de test" },
};
const GROUPS = ["Métier", "Données & secrets", "Sécurité & résilience", "IA / Data", "Observabilité", "Outils de test"];

function statusOf(s) {
  if (s.state !== "running") return { k: "ko", txt: s.state === "exited" ? "Arrêté" : s.state };
  if (s.health === "unhealthy") return { k: "ko", txt: "Dégradé" };
  if (s.health === "starting") return { k: "warn", txt: "Démarrage" };
  return { k: "ok", txt: s.health === "healthy" ? "Sain" : "Actif" };
}
const DOT = { ok: "bg-emerald-500", warn: "bg-amber-500", ko: "bg-rose-500 animate-pulse" };
const TXT = { ok: "text-emerald-600", warn: "text-amber-600", ko: "text-rose-600" };

export default function AdminOps() {
  const [health, setHealth] = useState(null);
  const [events, setEvents] = useState([]);
  const [services, setServices] = useState([]);
  const [report, setReport] = useState(null);   // compte rendu affiché dans la pop-up
  const seenReport = useRef(null);               // ts du dernier compte rendu déjà vu

  useEffect(() => {
    const tick = async () => {
      try { setHealth((await api.health()).status); } catch { setHealth("unreachable"); }
      try {
        const evs = await api.remediationEvents();
        setEvents(evs);
        const cr = evs.find((e) => e.kind === "compte_rendu");
        if (cr) {
          if (seenReport.current === null) {
            seenReport.current = cr.ts;          // 1er chargement : mémorise sans ouvrir
          } else if (cr.ts !== seenReport.current) {
            seenReport.current = cr.ts;          // nouveau compte rendu -> pop-up auto
            setReport(cr);
          }
        }
      } catch {}
      try { setServices(await api.services()); } catch {}
    };
    tick(); const id = setInterval(tick, 3000); return () => clearInterval(id);
  }, []);

  const latestReport = events.find((e) => e.kind === "compte_rendu");

  const grafana = `${location.protocol}//${location.hostname}:3001/`;
  const upCount = services.filter((s) => statusOf(s).k === "ok").length;
  const koCount = services.filter((s) => statusOf(s).k === "ko").length;
  const alerts = events.filter((e) => e.kind === "alert_received").length;
  const successes = events.filter((e) => e.kind === "remediation_success").length;

  const byGroup = (g) => services.filter((s) => (META[s.name]?.group || "Autres") === g);

  return (
    <div>
      <ReportModal report={report} onClose={() => setReport(null)} />
      <PageTitle title="Supervision métier" subtitle="État de tous les services et chaîne de remédiation"
        action={
          <div className="flex items-center gap-2">
            {latestReport && (
              <button onClick={() => setReport(latestReport)} className="btn-ghost border border-slate-200">📋 Dernier rapport</button>
            )}
            <a href={grafana} target="_blank" rel="noreferrer" className="btn-primary">📈 Ouvrir Grafana</a>
          </div>
        } />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Services actifs" value={`${upCount} / ${services.length}`} hint={koCount ? `${koCount} en défaut` : "tous opérationnels"} />
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase text-slate-400">API de paiement</div>
          <div className={`text-lg font-extrabold mt-2 ${health === "ok" ? "text-emerald-600" : "text-rose-600"}`}>
            {health === "ok" ? "OPÉRATIONNELLE" : "DÉGRADÉE"}
          </div>
        </div>
        <StatCard label="Alertes reçues" value={alerts} />
        <StatCard label="Reprises vérifiées" value={successes} />
      </div>

      {/* État de tous les services, par domaine */}
      <div className="space-y-6 mb-6">
        {GROUPS.map((g) => {
          const items = byGroup(g);
          if (items.length === 0) return null;
          return (
            <div key={g}>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{g}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((s) => {
                  const st = statusOf(s);
                  return (
                    <div key={s.name} className="card p-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-700 truncate">{META[s.name]?.label || s.name}</div>
                        <div className="text-xs text-slate-400 font-mono truncate">{s.name}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${DOT[st.k]}`} />
                        <span className={`text-sm font-semibold ${TXT[st.k]}`}>{st.txt}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {services.length === 0 && <div className="card p-6 text-slate-400 text-sm">Chargement de l'état des services…</div>}
      </div>

      {/* Journal de remédiation */}
      <div className="card">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-slate-700">Journal des décisions de remédiation</div>
        <div className="max-h-96 overflow-auto font-mono text-xs divide-y divide-slate-50">
          {events.length === 0 && <div className="p-5 text-slate-400">En attente d'événements…</div>}
          {events.map((e, i) => (
            <div key={i} className="flex gap-3 px-5 py-1.5">
              <span className="text-slate-300 shrink-0">{(e.ts || "").slice(11, 19)}</span>
              <span className={`shrink-0 w-48 ${
                e.kind.includes("success") ? "text-emerald-600" :
                e.kind.includes("escalat") || e.kind.includes("error") ? "text-rose-600" :
                e.kind.includes("block") ? "text-amber-600" : "text-brand-700"}`}>{e.kind}</span>
              <span className="text-slate-500 truncate">
                {JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !["ts", "kind"].includes(k))))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
