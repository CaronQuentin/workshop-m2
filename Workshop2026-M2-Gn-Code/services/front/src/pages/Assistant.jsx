import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { PageTitle } from "../components/ui";

const SUGGESTIONS = [
  "Que se passe-t-il en ce moment sur la plateforme ?",
  "Y a-t-il eu un incident récemment ? Qu'a fait la remédiation ?",
  "Que faire en cas de déni de service sur l'API ?",
  "Quelle est la procédure de retour arrière ?",
];

export default function Assistant() {
  const [mode, setMode] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { api.ragHealth().then((h) => setMode(h.mode)).catch(() => setMode("indisponible")); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(q) {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const r = await api.ask(question);
      const text = r.answer ||
        (r.passages ? r.passages.map((p) => `• (${p.source}) ${p.extrait}`).join("\n\n") : "Pas de réponse.");
      setMessages((m) => [...m, { role: "bot", text, sources: r.sources, mode: r.mode, note: r.note }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: "Erreur : " + e.message, error: true }]);
    } finally { setBusy(false); }
  }

  const llm = mode === "rag-ollama";

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
      <PageTitle title="Assistant opérateur"
        subtitle="Aide à l'investigation — répond à partir de vos procédures (lecture seule, aucune action)" />

      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className={`px-2 py-0.5 rounded-full font-semibold border ${
          llm ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
          mode === "extractif-tfidf" ? "bg-amber-50 text-amber-700 border-amber-200" :
          "bg-slate-50 text-slate-500 border-slate-200"}`}>
          {llm ? "LLM local (RAG)" : mode === "extractif-tfidf" ? "Mode extractif (Ollama absent)" : "…"}
        </span>
        {llm && <span className="text-slate-400">gemma2:2b · réponses en ~5-20 s (CPU)</span>}
      </div>

      <div className="card flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-sm text-slate-400">
            <p className="mb-3">Posez une question sur un incident ou une procédure. Exemples :</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="btn-ghost border border-slate-200 text-slate-600 text-xs">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
              m.role === "user" ? "bg-brand-700 text-white"
              : m.error ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-slate-100 text-slate-700"}`}>
              {m.text}
              {m.sources?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-400">
                  Sources : {m.sources.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-brand-700 animate-spin" />
              Le modèle consulte la documentation…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
        <input className="input flex-1" placeholder="Votre question…" value={input}
          onChange={(e) => setInput(e.target.value)} disabled={busy} />
        <button className="btn-primary" disabled={busy || !input.trim()}>Envoyer</button>
      </form>
    </div>
  );
}
