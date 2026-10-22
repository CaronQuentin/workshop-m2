import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Alert } from "../components/ui";

// Création de compte avec enrôlement du visage (identifiant + mot de passe + photo).
export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  async function startCam() {
    setCamError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = s; setCamOn(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 50);
    } catch (e) { setCamError("Caméra inaccessible (ouvrez via http://localhost:8088). " + e.message); }
  }
  const capture = () => {
    const v = videoRef.current, c = document.createElement("canvas");
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function submit() {
    if (username.trim().length < 3 || password.length < 4) { setMsg("Identifiant ≥ 3 caractères, mot de passe ≥ 4."); return; }
    if (!camOn) { setMsg("Activez la caméra pour enregistrer votre visage."); return; }
    setBusy(true); setMsg("Capture du visage, regardez la caméra…");
    try {
      const imgs = [];
      for (let i = 0; i < 6; i++) { imgs.push(capture()); await sleep(400); }
      await api.register(username.trim(), password, imgs);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setDone(true); setMsg("");
      setTimeout(() => navigate("/login"), 1500);
    } catch (e) { setMsg("Échec : " + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-brand-800 text-white p-12">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white text-brand-800 grid place-items-center font-extrabold">S</div>
          <span className="text-xl font-extrabold">SWAP</span>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold leading-tight">Créez votre compte<br />en quelques secondes.</h2>
          <p className="mt-4 text-brand-100 max-w-md">Votre visage devient votre second facteur d'authentification.</p>
        </div>
        <div className="text-brand-200 text-xs">Environnement fictif · aucune donnée bancaire réelle</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="card p-8 w-full max-w-sm">
          <h1 className="text-xl font-extrabold text-slate-800">Créer un compte</h1>
          <p className="text-sm text-slate-500 mt-1 mb-5">Identifiant, mot de passe et enregistrement du visage.</p>

          {done ? (
            <Alert kind="success">Compte créé ! Redirection vers la connexion…</Alert>
          ) : (
            <div className="space-y-3">
              {msg && <Alert>{msg}</Alert>}
              {camError && <Alert>{camError}</Alert>}
              <div>
                <label className="label">Identifiant</label>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex. alice" />
              </div>
              <div>
                <label className="label">Mot de passe</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              {!camOn ? (
                <button onClick={startCam} className="btn-primary w-full">📷 Activer la caméra</button>
              ) : (
                <div className="rounded-xl overflow-hidden bg-slate-900 aspect-video">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              )}

              <button onClick={submit} disabled={busy} className="btn-primary w-full">
                {busy ? "Création…" : "Créer mon compte avec mon visage"}
              </button>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-sm">
            <span className="text-slate-400">Déjà un compte ? </span>
            <Link to="/login" className="text-brand-700 font-semibold hover:underline">Se connecter</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
