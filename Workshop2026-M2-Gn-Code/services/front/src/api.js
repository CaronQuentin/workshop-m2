// Client API. Tout passe par le WAF via des chemins relatifs (/api, /auth).
const TOKEN_KEY = "swap_token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

// FastAPI renvoie soit un texte, soit (erreur 422) une liste d'erreurs de validation.
const FIELD_FR = { amount_cents: "Montant", label: "Motif", beneficiary_name: "Bénéficiaire",
  currency: "Devise", name: "Nom", iban: "IBAN" };
function formatDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const field = FIELD_FR[d.loc?.[d.loc.length - 1]] || d.loc?.[d.loc.length - 1] || "Champ";
      if (d.type === "less_than_equal" && d.loc?.includes("amount_cents"))
        return `${field} : maximum ${(d.ctx.le / 100).toLocaleString("fr-FR")} €`;
      if (d.type === "string_too_long") return `${field} : ${d.ctx?.max_length} caractères maximum`;
      return `${field} : valeur invalide`;
    }).join(" · ");
  }
  return JSON.stringify(detail);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { setToken(""); }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = formatDetail(j.detail) || detail; } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // auth
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: { username, password }, auth: false }),
  register: (username, password, images) =>
    request("/auth/register", { method: "POST", body: { username, password, images }, auth: false }),
  me: () => request("/auth/me"),
  users: () => request("/auth/users"),
  // compte & stats
  account: () => request("/api/account"),
  stats: () => request("/api/stats"),
  // paiements
  createPayment: (p) => request("/api/payments", { method: "POST", body: p }),
  listPayments: (qs = "") => request(`/api/payments${qs ? "?" + qs : ""}`),
  getPayment: (ref) => request(`/api/payments/${encodeURIComponent(ref)}`),
  // bénéficiaires
  beneficiaries: () => request("/api/beneficiaries"),
  addBeneficiary: (b) => request("/api/beneficiaries", { method: "POST", body: b }),
  editBeneficiary: (id, b) => request(`/api/beneficiaries/${id}`, { method: "PUT", body: b }),
  delBeneficiary: (id) => request(`/api/beneficiaries/${id}`, { method: "DELETE" }),
  // supervision (lecture seule, exposée par le WAF)
  health: () => request("/api/health", { auth: false }),
  remediationEvents: () => request("/remediation/events", { auth: false }),
  services: () => request("/remediation/services", { auth: false }),
  ragHealth: () => request("/rag/health", { auth: false }),
  ask: (question) => request("/rag/ask", { method: "POST", body: { question }, auth: false }),
  // 2FA par utilisateur (identifiant -> visage -> mot de passe)
  backofficeStatus: (username) =>
    request(`/auth/backoffice/status?username=${encodeURIComponent(username || "")}`, { auth: false }),
  backofficeEnroll: (images) => request("/auth/backoffice/enroll", { method: "POST", body: { images } }),
  backofficeFace: (username, image) =>
    request("/auth/backoffice/face", { method: "POST", body: { username, image }, auth: false }),
  backofficeLogin: (face_token, username, password) =>
    request("/auth/backoffice/login", { method: "POST", body: { face_token, username, password }, auth: false }),
};

export const euros = (cents) =>
  ((cents || 0) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
