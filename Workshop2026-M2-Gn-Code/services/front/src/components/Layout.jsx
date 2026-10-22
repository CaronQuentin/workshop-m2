import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const nav = [
  { to: "/", label: "Tableau de bord", icon: "▦", end: true },
  { to: "/payments/new", label: "Nouveau paiement", icon: "➕" },
  { to: "/history", label: "Historique", icon: "☰" },
  { to: "/beneficiaries", label: "Bénéficiaires", icon: "👥" },
  { to: "/assistant", label: "Assistant", icon: "🤖" },
  { to: "/profile", label: "Mon profil", icon: "⚙" },
];
const adminNav = [
  { to: "/admin/ops", label: "Supervision", icon: "📈" },
  { to: "/admin/users", label: "Utilisateurs", icon: "🛡" },
];

function Item({ to, label, icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
        isActive ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
      <span className="w-5 text-center">{icon}</span>{label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-full flex">
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-700 text-white grid place-items-center font-extrabold">S</div>
            <div>
              <div className="font-extrabold text-slate-800 leading-none">SWAP</div>
              <div className="text-[11px] text-slate-400">Paiements fictifs</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => <Item key={n.to} {...n} />)}
          {user?.role === "admin" && (
            <>
              <div className="px-3 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Admin / Ops</div>
              {adminNav.map((n) => <Item key={n.to} {...n} />)}
            </>
          )}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="px-3 py-2 text-sm">
            <div className="font-semibold text-slate-700">{user?.username}</div>
            <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
          </div>
          <button onClick={() => { logout(); navigate("/login"); }} className="btn-ghost w-full justify-start">
            ⎋ Se déconnecter
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="text-sm text-slate-400">Espace client · environnement de démonstration</div>
          <a href="/status" className="text-sm text-brand-700 hover:underline">État du service →</a>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
