import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, euros } from "../api";
import { PageTitle, StatCard, StatusBadge, Spinner } from "../components/ui";

export default function Dashboard() {
  const [account, setAccount] = useState(null);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.account(), api.stats(), api.listPayments("limit=5")])
      .then(([a, s, p]) => { setAccount(a); setStats(s); setRecent(p.items); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  const chartData = (stats?.series || []).map((d) => ({
    jour: new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short" }),
    volume: Math.round(d.volume_cents / 100),
  }));

  return (
    <div>
      <PageTitle title="Tableau de bord" subtitle="Vue d'ensemble de votre compte SWAP"
        action={<Link to="/payments/new" className="btn-primary">➕ Nouveau paiement</Link>} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Solde disponible" value={euros(account?.balance_cents)} hint={account?.iban} />
        <StatCard label="Volume aujourd'hui" value={euros(stats?.today_volume_cents)} hint={`${stats?.today_count} opération(s)`} />
        <StatCard label="Transactions totales" value={stats?.total_count} />
        <StatCard label="Taux de réussite" value={`${Math.round((stats?.success_rate || 0) * 100)} %`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="font-bold text-slate-700 mb-4">Volume des 7 derniers jours (€)</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2551ea" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2551ea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="jour" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v) => `${v} €`} />
                <Area type="monotone" dataKey="volume" stroke="#2551ea" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-slate-700">Dernières opérations</div>
            <Link to="/history" className="text-sm text-brand-700 hover:underline">Tout voir</Link>
          </div>
          <div className="space-y-3">
            {recent.length === 0 && <div className="text-sm text-slate-400">Aucune opération.</div>}
            {recent.map((p) => (
              <Link to={`/history/${p.reference}`} key={p.reference}
                className="flex items-center justify-between hover:bg-slate-50 rounded-lg px-2 py-1 -mx-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{p.beneficiary_name || "Bénéficiaire"}</div>
                  <div className="text-xs text-slate-400">{p.reference}</div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-sm font-semibold text-slate-800">{euros(p.amount_cents)}</div>
                  <StatusBadge status={p.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
