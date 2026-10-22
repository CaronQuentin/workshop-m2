"""
rag-assistant — aide à l'opérateur confronté à l'incident (LangChain + Ollama).

Indexe les procédures, le PCA/PRA, le README et le dossier, puis répond en CITANT
le document source. Modèle local <= 8 Md de paramètres servi par Ollama.

GARDE-FOUS (cf. dossier §3.3 et §7) :
  - LECTURE SEULE : aucun outil d'action, aucun accès à Vault ni au moteur de
    remédiation. L'assistant explique, il n'agit pas.
  - Repli extractif : si Ollama est injoignable, renvoie les passages pertinents
    (recherche TF-IDF) sans génération, pour rester utile.
"""
import glob
import os

import requests
from fastapi import FastAPI
from pydantic import BaseModel

CORPUS_DIR = "/app/corpus"
OLLAMA = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

# État LIVE de la plateforme (LECTURE SEULE). Permet à l'assistant de « comprendre
# ce qui se passe » (§3.3), sans aucun droit d'action sur le système.
WAF = os.getenv("WAF_URL", "http://waf:8080")
REMEDIATION = os.getenv("REMEDIATION_URL", "http://remediation-engine:9000")
PROM = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")


def _prom(query: str, default=0.0) -> float:
    try:
        res = requests.get(f"{PROM}/api/v1/query", params={"query": query}, timeout=4).json()["data"]["result"]
        return float(res[0]["value"][1]) if res else default
    except Exception:
        return default


def live_context() -> str:
    """Instantané lecture seule de l'état courant : santé, métriques, remédiation."""
    lines = []
    try:
        h = requests.get(f"{WAF}/api/health", timeout=4).json().get("status", "inconnu")
    except Exception:
        h = "injoignable"
    lines.append(f"Santé de l'API de paiement : {h}")

    rps = _prom('sum(rate(http_requests_total{path="/payments"}[1m]))')
    p95 = _prom('histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{path="/payments"}[1m])) by (le))')
    err = _prom('sum(rate(http_requests_total{status=~"5.."}[1m]))')
    p95_txt = f"{p95*1000:.0f} ms" if p95 == p95 and p95 > 0 else "—"  # NaN si pas de trafic
    lines.append(f"Métriques (1 min) — débit /payments : {rps:.1f} req/s · latence p95 : {p95_txt} · 5xx : {err:.2f}/s")

    try:
        evs = requests.get(f"{REMEDIATION}/events", timeout=4).json()[:6]
        if evs:
            lines.append("Derniers événements de remédiation (du plus récent au plus ancien) :")
            for e in evs:
                extra = {k: v for k, v in e.items() if k not in ("ts", "kind")}
                lines.append(f"  [{e.get('ts','')[11:19]}] {e.get('kind')} {extra}")
        else:
            lines.append("Aucun événement de remédiation récent : pas d'incident en cours.")
    except Exception:
        lines.append("Journal de remédiation indisponible.")
    return "\n".join(lines)

app = FastAPI(title="rag-assistant", version="1.0.0")

_state = {"mode": "init", "retriever": None, "chunks": [], "tfidf": None, "matrix": None}


def load_documents():
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    texts, metas = [], []
    for path in glob.glob(f"{CORPUS_DIR}/**/*", recursive=True):
        if os.path.isfile(path) and path.lower().endswith((".md", ".txt")):
            with open(path, encoding="utf-8", errors="ignore") as f:
                texts.append(f.read()); metas.append({"source": os.path.relpath(path, CORPUS_DIR)})
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
    chunks, sources = [], []
    for t, m in zip(texts, metas):
        for c in splitter.split_text(t):
            chunks.append(c); sources.append(m["source"])
    return chunks, sources


@app.on_event("startup")
def build_index():
    chunks, sources = load_documents()
    _state["chunks"] = list(zip(chunks, sources))
    # 1) Voie nominale : index vectoriel Ollama via LangChain.
    try:
        from langchain_ollama import OllamaEmbeddings
        from langchain_core.vectorstores import InMemoryVectorStore
        emb = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA)
        store = InMemoryVectorStore(emb)
        store.add_texts(chunks, metadatas=[{"source": s} for s in sources])
        _state["retriever"] = store.as_retriever(search_kwargs={"k": 3})
        _state["mode"] = "rag-ollama"
        return
    except Exception:
        pass
    # 2) Repli : recherche TF-IDF locale (pas de dépendance à Ollama).
    from sklearn.feature_extraction.text import TfidfVectorizer
    vec = TfidfVectorizer(stop_words=None)
    _state["matrix"] = vec.fit_transform(chunks)
    _state["tfidf"] = vec
    _state["mode"] = "extractif-tfidf"


class Ask(BaseModel):
    question: str


def tfidf_search(q: str, k: int = 4):
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    qv = _state["tfidf"].transform([q])
    sims = cosine_similarity(qv, _state["matrix"])[0]
    idx = np.argsort(sims)[::-1][:k]
    return [(_state["chunks"][i][0], _state["chunks"][i][1], float(sims[i])) for i in idx]


@app.get("/health")
def health():
    return {"status": "ok", "mode": _state["mode"], "chunks": len(_state["chunks"])}


@app.post("/ask")
def ask(body: Ask):
    q = body.question
    live = live_context()   # instantané lecture seule de la situation

    if _state["mode"] == "rag-ollama":
        from langchain_ollama import ChatOllama
        from langchain_core.prompts import ChatPromptTemplate
        docs = _state["retriever"].invoke(q)
        context = "\n\n".join(f"[{d.metadata.get('source')}]\n{d.page_content}" for d in docs)
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "Tu es un copilote d'exploitation pour les opérateurs de la plateforme de paiement. "
             "Tu disposes de deux sources : (1) l'ÉTAT LIVE de la plateforme (santé, métriques, "
             "journal de remédiation), (2) la DOCUMENTATION (procédures, architecture). "
             "Pour « que se passe-t-il ? » appuie-toi sur l'état live et décris la situation réelle. "
             "Pour une procédure, cite la source entre crochets. "
             "IMPORTANT : tu es en LECTURE SEULE. Tu n'exécutes AUCUNE action ; tu peux seulement "
             "expliquer et recommander. Si une information manque, dis-le. "
             "Réponds de façon CONCISE : 3 à 5 phrases maximum, va à l'essentiel."),
            ("human", "ÉTAT LIVE :\n{live}\n\nDOCUMENTATION :\n{context}\n\nQUESTION : {q}"),
        ])
        # num_predict borne la longueur (gros gain CPU), keep_alive garde le modèle chaud.
        llm = ChatOllama(model=MODEL, base_url=OLLAMA, temperature=0,
                         num_predict=320, keep_alive="30m")
        try:
            answer = (prompt | llm).invoke({"live": live, "context": context, "q": q}).content
            return {"mode": "rag-ollama", "answer": answer, "live": live,
                    "sources": sorted({d.metadata.get("source") for d in docs})}
        except Exception as exc:
            return {"mode": "rag-ollama-error", "error": str(exc), "live": live,
                    "sources": sorted({d.metadata.get("source") for d in docs})}

    # Repli extractif : on renvoie quand même l'état live + les passages pertinents.
    hits = tfidf_search(q)
    return {"mode": "extractif-tfidf", "live": live,
            "note": "Ollama injoignable : état live + passages pertinents, sans génération.",
            "passages": [{"source": s, "score": round(sc, 3), "extrait": c[:400]} for c, s, sc in hits]}
