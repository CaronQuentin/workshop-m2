import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Alert } from "../components/ui";

// Connexion 2FA par utilisateur : identifiant -> visage -> mot de passe.
// La caméra est capturée dans le navigateur (getUserMedia exige HTTPS ou localhost).
export default function BackOffice() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camError, setCamError] = useState("");
  const [step, setStep] = useState("username");   // username|face|password|success|blocked
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [faceToken, setFaceToken] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) {
        setCamError("Caméra inaccessible. Ouvrez cette page sur le PC Hôte via " +
          "http://localhost:8088/backoffice (getUserMedia exige localhost ou HTTPS). " + e.message);
      }
    })();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  function capture() {
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  }

  async function startFace(e) {
    e?.preventDefault();
    if (!username.trim()) return;
    setMsg(""); setStep("face");
  }

  async function doFace() {
    setBusy(true); setMsg("Analyse du visage…");
    try {
      const r = await api.backofficeFace(username.trim(), capture());
      if (r.ok) { setFaceToken(r.face_token); setStep("password"); setMsg("Visage reconnu. Entrez votre mot de passe."); }
      else if (r.blocked_seconds) { setStep("blocked"); setMsg(`Trop d'échecs. Compte bloqué ${Math.ceil(r.blocked_seconds/60)} min.`); }
      else if (r.not_enrolled) { setMsg(r.reason); }
      else setMsg(`${r.reason || "Visage non reconnu."} Tentatives restantes : ${r.attempts_left ?? 0}.`);
    } catch (e) { setMsg("Erreur : " + e.message); }
    finally { setBusy(false); }
  }

  async function doLogin(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await api.backofficeLogin(faceToken, username.trim(), password);
      try { localStorage.setItem("swap_token", r.access_token); } catch {}
      setStep("success");
      setTimeout(() => { window.location.href = "/"; }, 900);
    } catch (e2) {
      setMsg("Échec : " + e2.message);
      if (e2.message.toLowerCase().includes("expir")) setStep("face");
      if (e2.message.toLowerCase().includes("bloqué")) setStep("blocked");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-700 text-white grid place-items-center font-extrabold">S</div>
          <span className="font-extrabold text-slate-800">SWAP · Connexion sécurisée</span>
        </div>
        <Link to="/login" className="text-sm text-brand-700 hover:underline">Connexion standard →</Link>
      </header>

      <div className="max-w-xl mx-auto p-6">
        <div className="card p-6">
          <h1 className="text-xl font-extrabold text-slate-800">Authentification à deux facteurs</h1>
          <p className="text-sm text-slate-500 mt-1 mb-4">Identifiant, puis reconnaissance faciale, puis mot de passe.</p>

          {camError && <div className="mb-4"><Alert>{camError}</Alert></div>}

          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video mb-4">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {step === "success" && (
              <div className="absolute inset-0 bg-emerald-600/90 grid place-items-center text-white text-xl font-bold">
                ✓ Connecté
              </div>)}
          </div>

          {/* Fil d'étapes */}
          <div className="flex items-center gap-2 text-xs mb-4">
            {["Identifiant", "Visage", "Mot de passe"].map((s, i) => {
              const active = (step === "username" && i === 0) || (step === "face" && i === 1) || (step === "password" && i === 2);
              const done = (i === 0 && step !== "username") || (i === 1 && (step === "password" || step === "success"));
              return <span key={s} className={`px-2 py-0.5 rounded-full border ${
                done ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                active ? "bg-brand-50 text-brand-700 border-brand-200" :
                "bg-slate-50 text-slate-400 border-slate-200"}`}>{i + 1}. {s}</span>;
            })}
          </div>

          {msg && <div className="mb-4 text-sm text-slate-600 bg-slate-100 rounded-lg px-3 py-2">{msg}</div>}

          {step === "username" && (
            <form onSubmit={startFace} className="space-y-3">
              <div>
                <label className="label">Identifiant</label>
                <input className="input" value={username} autoFocus onChange={(e) => setUsername(e.target.value)} placeholder="ex. admin" />
              </div>
              <button className="btn-primary w-full" disabled={!username.trim()}>Continuer</button>
            </form>
          )}

          {step === "face" && (
            <div className="space-y-2">
              <button onClick={doFace} disabled={busy || !!camError} className="btn-primary w-full">
                {busy ? "Analyse…" : "Vérifier mon visage"}
              </button>
              <button onClick={() => { setStep("username"); setMsg(""); }} className="btn-ghost w-full">← Changer d'identifiant</button>
            </div>
          )}

          {step === "password" && (
            <form onSubmit={doLogin} className="space-y-3">
              <div>
                <label className="label">Mot de passe de {username}</label>
                <input type="password" className="input" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn-primary w-full" disabled={busy}>Se connecter</button>
            </form>
          )}

          {step === "blocked" && <Alert>Compte temporairement bloqué suite à trop d'échecs. Réessayez dans quelques minutes.</Alert>}
        </div>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Pas encore de visage enregistré ? Connectez-vous en <Link to="/login" className="underline">standard</Link>, puis
          enregistrez-le depuis <b>Mon profil</b>. La LED reflète l'état : vert (ok), rouge (échec/blocage).
        </p>
      </div>
    </div>
  );
}
