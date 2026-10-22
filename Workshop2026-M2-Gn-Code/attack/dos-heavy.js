// Variante LOURDE du flood (démonstration d'une grosse attaque).
// Même garde-fou de périmètre que dos.js. Montée jusqu'à 800 VUs.
//   k6 run -e TARGET=http://192.168.137.1:8080 dos-heavy.js
import http from "k6/http";
import { check, sleep } from "k6";

const TARGET = __ENV.TARGET || "http://192.168.137.1:8088";
// Garde-fou : réseau PRIVÉ uniquement (LAN / Tailscale / localhost), jamais de cible publique.
const host = (TARGET.split("//")[1] || "").split(":")[0].split("/")[0];
const isPrivate =
  host === "localhost" || host === "waf" ||
  /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host);
if (!isPrivate) {
  throw new Error(`Cible '${host}' non autorisée. Réseau privé uniquement (LAN/Tailscale/localhost).`);
}

export const options = {
  scenarios: {
    flood: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 200 },   // montée rapide
        { duration: "30s", target: 800 },   // pic : 800 VUs
        { duration: "45s", target: 800 },   // charge soutenue
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
};

export function setup() {
  const r = http.post(`${TARGET}/auth/login`,
    JSON.stringify({ username: "demo", password: "demo1234" }),
    { headers: { "Content-Type": "application/json" }, timeout: "3s" });
  return { token: r.status === 200 ? r.json("access_token") : "" };
}

export default function (data) {
  const headers = { "Content-Type": "application/json" };
  if (data.token) headers["Authorization"] = `Bearer ${data.token}`;
  const res = http.post(`${TARGET}/api/payments`,
    JSON.stringify({ amount_cents: 1299, currency: "EUR" }),
    { headers, timeout: "3s" });
  check(res, { "pas de 5xx": (r) => r.status < 500 });
  sleep(0.02);
}
