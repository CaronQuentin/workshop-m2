import { useEffect, useState } from "react";
import { api } from "../api";
import { PageTitle, Spinner, Alert } from "../components/ui";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users().then(setUsers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl">
      <PageTitle title="Utilisateurs" subtitle="Comptes fictifs de la plateforme" />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left font-semibold px-4 py-3">Identifiant</th>
              <th className="text-left font-semibold px-4 py-3">Rôle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan="2"><Spinner /></td></tr>}
            {users.map((u) => (
              <tr key={u.username} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    u.role === "admin" ? "bg-brand-50 text-brand-700 border-brand-200" :
                    u.role === "control" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-slate-50 text-slate-600 border-slate-200"}`}>{u.role}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
