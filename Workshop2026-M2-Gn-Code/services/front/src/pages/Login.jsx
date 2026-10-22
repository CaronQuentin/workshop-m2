import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, setToken } from "../api";
import { Alert } from "../components/ui";

// Connexion adaptative : identifiant -> (visage si le compte en a un) -> mot de passe.
export default function Login() {
  const [step, setStep] = useState("username");   // username|face|password|success
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [faceToken, setFaceToken] = useState("");
  const [twofa, setTwofa] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCam = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  useEffect(() => stopCam, []);

  async function startCam() {
    setCamError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = s;
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 50);
    } catch (e) { setCamError("Caméra inaccessible (ouvrez via http://localhost:8088). " + e.message); }
  }
  function capture() {
    const v = videoRef.current, c = document.createElement("canvas");
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  }

  async function submitUsername(e) {
    e.preventDefault(); if (!username.trim()) return;
    setBusy(true); setMsg("");
    try {
      const st = await api.backofficeStatus(username.trim());
      if (!st.exists) { setMsg("Cet identifiant n'existe pas."); return; }
      if (st.blocked_seconds > 0) { setMsg(`Compte bloqué, réessayez dans ${Math.ceil(st.blocked_seconds / 60)} min.`); return; }
      if (st.face_enrolled) { setTwofa(true); setStep("face"); startCam(); }
      else { setTwofa(false); setStep("password"); }
    } catch (e) { setMsg("Erreur de vérification : " + e.message); }
    finally { setBusy(false); }
  }

  async function doFace() {
    setBusy(true); setMsg("Analyse du visage…");
    try {
      const r = await api.backofficeFace(username.trim(), capture());
      if (r.ok) { setFaceToken(r.face_token); stopCam(); setStep("password"); setMsg("Visage reconnu. Entrez votre mot de passe."); }
      else if (r.blocked_seconds) { setMsg(`Trop d'échecs. Bloqué ${Math.ceil(r.blocked_seconds / 60)} min.`); }
      else setMsg(`${r.reason || "Visage non reconnu."} Tentatives restantes : ${r.attempts_left ?? 0}.`);
    } catch (e) { setMsg("Erreur : " + e.message); }
    finally { setBusy(false); }
  }

  async function doPassword(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = twofa
        ? await api.backofficeLogin(faceToken, username.trim(), password)
        : await api.login(username.trim(), password);
      setToken(r.access_token); setStep("success");
      setTimeout(() => { window.location.href = "/"; }, 600);
    } catch (e2) {
      setMsg("Échec : " + e2.message);
      if (twofa && e2.message.toLowerCase().includes("expir")) { setStep("face"); startCam(); }
    } finally { setBusy(false); }
  }

  function reset() { stopCam(); setStep("username"); setPassword(""); setFaceToken(""); setMsg(""); }

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-brand-800 text-white p-12">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white text-brand-800 grid place-items-center font-extrabold">S</div>
          <span className="text-xl font-extrabold">SWAP</span>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold leading-tight">La plateforme de paiement<br />qui se répare toute seule.</h2>
          <p className="mt-4 text-brand-100 max-w-md">Connexion renforcée : identifiant, reconnaissance faciale,
            puis mot de passe.</p>
        </div>
        <div className="text-brand-200 text-xs">Environnement fictif · aucune donnée bancaire réelle</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="card p-8 w-full max-w-sm">
          <h1 className="text-xl font-extrabold text-slate-800">Connexion</h1>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            {step === "username" && "Entrez votre identifiant."}
            {step === "face" && "Regardez la caméra pour vous identifier."}
            {step === "password" && (twofa ? "Visage reconnu. Entrez votre mot de passe." : "Entrez votre mot de passe.")}
            {step === "success" && "Connexion réussie…"}
          </p>

          {msg && <div className="mb-4"><Alert kind={step === "success" ? "success" : "error"}>{msg}</Alert></div>}
          {camError && <div className="mb-4"><Alert>{camError}</Alert></div>}

          {step === "username" && (
            <form onSubmit={submitUsername} className="space-y-3">
              <div>
                <label className="label">Identifiant</label>
                <input className="input" value={username} autoFocus onChange={(e) => setUsername(e.target.value)} placeholder="ex. admin" />
              </div>
              <button className="btn-primary w-full" disabled={busy || !username.trim()}>Continuer</button>
            </form>
          )}

          {step === "face" && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden bg-slate-900 aspect-video">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <button onClick={doFace} disabled={busy || !!camError} className="btn-primary w-full">
                {busy ? "Analyse…" : "Vérifier mon visage"}
              </button>
              <button onClick={reset} className="btn-ghost w-full">← Changer d'identifiant</button>
            </div>
          )}

          {step === "password" && (
            <form onSubmit={doPassword} className="space-y-3">
              <div>
                <label className="label">Mot de passe{twofa ? ` de ${username}` : ""}</label>
                <input type="password" className="input" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn-primary w-full" disabled={busy}>Se connecter</button>
              <button type="button" onClick={reset} className="btn-ghost w-full">← Recommencer</button>
            </form>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-sm">
            <span className="text-slate-400">Pas de compte ? </span>
            <Link to="/register" className="text-brand-700 font-semibold hover:underline">Créer un compte</Link>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">Comptes de démo : admin / admin · demo / demo1234</p>
        </div>
      </div>
    </div>
  );
}
