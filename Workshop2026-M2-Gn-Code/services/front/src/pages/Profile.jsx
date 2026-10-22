import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { PageTitle, Alert } from "../components/ui";

export default function Profile() {
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [faceEnrolled, setFaceEnrolled] = useState(false);

  // Caméra pour l'enrôlement du visage
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.account().then(setAccount).catch(() => {}); }, []);
  useEffect(() => {
    if (user?.username) api.backofficeStatus(user.username).then((s) => setFaceEnrolled(s.face_enrolled)).catch(() => {});
  }, [user]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  async function startCam() {
    setMsg(""); setCamError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = s; setCamOn(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 50);
    } catch (e) {
      setCamError("Caméra inaccessible. Ouvrez cette page sur le PC Hôte via http://localhost:8088 " +
        "(getUserMedia exige localhost ou HTTPS). " + e.message);
    }
  }
  const capture = () => {
    const v = videoRef.current, c = document.createElement("canvas");
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function enroll() {
    setBusy(true); setMsg("Capture en cours, regardez la caméra…");
    try {
      const imgs = [];
      for (let i = 0; i < 6; i++) { imgs.push(capture()); await sleep(400); }
      const r = await api.backofficeEnroll(imgs);
      setMsg(`✓ Visage enregistré (${r.images_utilisees} images).`); setFaceEnrolled(true);
    } catch (e) { setMsg("Échec : " + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl">
      <PageTitle title="Mon profil" subtitle="Informations du compte et sécurité" />

      <div className="card p-6 mb-6">
        <div className="font-bold text-slate-700 mb-4">Identité</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field k="Identifiant" v={user?.username} />
          <Field k="Rôle" v={<span className="capitalize">{user?.role}</span>} />
          <Field k="IBAN" v={<span className="font-mono">{account?.iban || "—"}</span>} />
          <Field k="Devise" v={account?.currency || "EUR"} />
        </div>
      </div>

      {/* Enrôlement du visage (2FA) */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold text-slate-700">Reconnaissance faciale (2FA)</div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
            faceEnrolled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
            {faceEnrolled ? "Visage enregistré" : "Non enregistré"}
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-3">
          Enregistrez votre visage pour pouvoir vous connecter en 2FA (identifiant → visage → mot de passe).
        </p>
        {camError && <div className="mb-3"><Alert>{camError}</Alert></div>}
        {msg && <div className="mb-3 text-sm bg-slate-100 rounded-lg px-3 py-2">{msg}</div>}

        {!camOn ? (
          <button onClick={startCam} className="btn-primary">📷 Activer la caméra</button>
        ) : (
          <div>
            <div className="rounded-xl overflow-hidden bg-slate-900 aspect-video mb-3 max-w-sm">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <button onClick={enroll} disabled={busy} className="btn-primary">
              {busy ? "Capture…" : faceEnrolled ? "Réenregistrer mon visage" : "Enregistrer mon visage"}
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="font-bold text-slate-700 mb-4">Sécurité de la session</div>
        <div className="space-y-2 text-sm text-slate-600">
          <p>🔑 Jeton <b>JWT</b> court (15 min), émis par le service d'authentification.</p>
          <p>🔒 Mot de passe <b>haché (bcrypt)</b>, jamais en clair.</p>
          <p>🛡 Secrets gérés par <b>HashiCorp Vault</b>. 2FA : visage + mot de passe, 2 essais puis blocage 5 min.</p>
        </div>
      </div>
    </div>
  );
}

const Field = ({ k, v }) => (
  <div><div className="text-xs text-slate-400 mb-1">{k}</div><div className="font-medium text-slate-700">{v}</div></div>
);
