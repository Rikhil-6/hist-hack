// OCRView.jsx — PDF upload, streaming OCR, side-by-side comparative viewer
import { useState, useRef, useCallback, useEffect } from "react";

const BACKEND     = "http://localhost:8000";
const MAX_COMPARE = 3;

function renderOCRText(text) {
  if (!text) return "";
  return text.split("\n").map((line, i) => (
    <span key={i} style={/^\[(MARGIN|HEADER|FOOTER|ILLEGIBLE)/.test(line) ? { color: "var(--amber-dim)", fontStyle: "italic" } : {}}>
      {line}{"\n"}
    </span>
  ));
}

function CompareViewer({ pages, allPageNums, loadedSet }) {
  const [selected, setSelected]   = useState([]);
  const [search,   setSearch]     = useState("");
  const [jumpVal,  setJumpVal]    = useState("");
  const listRef        = useRef(null);
  const selectedInitRef = useRef(false);

  useEffect(() => {
    if (!selectedInitRef.current && pages.length > 0) {
      setSelected([pages[0].page]);
      selectedInitRef.current = true;
    }
  }, [pages]);

  const toggle = useCallback((pn) => {
    if (!loadedSet.has(pn)) return;
    setSelected((prev) => {
      if (prev.includes(pn)) return prev.filter((p) => p !== pn);
      if (prev.length >= MAX_COMPARE) return [...prev.slice(1), pn];
      return [...prev, pn];
    });
  }, [loadedSet]);

  const handleJump = (e) => {
    e.preventDefault();
    const n = parseInt(jumpVal, 10);
    if (!n || n < 1 || n > allPageNums[allPageNums.length - 1]) return;
    const el = listRef.current?.querySelector(`[data-page="${n}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (loadedSet.has(n)) toggle(n);
    setJumpVal("");
  };

  const filteredNums = allPageNums.filter((pn) =>
    !search ? true : String(pn).includes(search.trim())
  );

  const pageMap = Object.fromEntries(pages.map((p) => [p.page, p]));
  const cols    = selected.map((pn) => pageMap[pn]).filter(Boolean);

  return (
    <div style={{ display: "flex", height: 600, borderTop: "1px solid var(--rule)" }}>
      <div style={{ width: 140, minWidth: 140, borderRight: "1px solid var(--rule)", display: "flex", flexDirection: "column", background: "var(--parchment-dark)" }}>
        <div style={{ padding: "10px 10px 8px", borderBottom: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            type="text"
            placeholder="Search pages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", padding: "5px 8px", border: "1px solid var(--rule)", borderRadius: 2, background: "var(--parchment)", color: "var(--ink)", outline: "none" }}
          />
          <form onSubmit={handleJump} style={{ display: "flex", gap: 4 }}>
            <input
              type="number"
              placeholder="Go to…"
              value={jumpVal}
              onChange={(e) => setJumpVal(e.target.value)}
              style={{ flex: 1, minWidth: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", padding: "5px 6px", border: "1px solid var(--rule)", borderRadius: 2, background: "var(--parchment)", color: "var(--ink)", outline: "none" }}
            />
            <button type="submit" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", padding: "4px 7px", border: "1px solid var(--amber-dim)", borderRadius: 2, background: "var(--amber)", color: "#fff", cursor: "pointer" }}>
              ↵
            </button>
          </form>
        </div>

        <div style={{ padding: "5px 10px", borderBottom: "1px solid var(--rule)", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "var(--faded)", display: "flex", justifyContent: "space-between" }}>
          <span>{loadedSet.size}/{allPageNums.length} loaded</span>
          <span>{selected.length}/{MAX_COMPARE} sel.</span>
        </div>

        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {filteredNums.length === 0 ? (
            <div style={{ padding: "20px 10px", textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", color: "var(--faded)" }}>
              No results
            </div>
          ) : (
            filteredNums.map((pn) => {
              const loaded = loadedSet.has(pn);
              const sel    = selected.includes(pn);
              const selIdx = selected.indexOf(pn);
              return (
                <div
                  key={pn}
                  data-page={pn}
                  onClick={() => toggle(pn)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", cursor: loaded ? "pointer" : "default", background: sel ? "rgba(180,120,30,0.12)" : "transparent", borderLeft: `2px solid ${sel ? "var(--amber)" : "transparent"}`, transition: "background 0.1s" }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", background: sel ? "var(--amber)" : loaded ? "var(--parchment-mid)" : "transparent", border: `1px solid ${sel ? "var(--amber)" : "var(--rule)"}`, color: sel ? "#fff" : "var(--faded)", opacity: loaded ? 1 : 0.35 }}>
                    {sel ? selIdx + 1 : ""}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem", color: sel ? "var(--amber)" : loaded ? "var(--ink)" : "var(--faded)", opacity: loaded ? 1 : 0.4 }}>
                    p. {pn}
                  </span>
                  {!loaded && (
                    <span style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: "var(--rule)", animation: "pulse 1.5s infinite" }} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {selected.length > 0 && (
          <div style={{ borderTop: "1px solid var(--rule)", padding: "8px 10px" }}>
            <button onClick={() => setSelected([])} style={{ width: "100%", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", padding: 5, border: "1px solid var(--rule)", borderRadius: 2, background: "transparent", color: "var(--faded)", cursor: "pointer" }}>
              Clear selection
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {cols.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, height: "100%", overflow: "hidden" }}>
            {cols.map((p) => (
              <div key={p.page} style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--rule)", minWidth: 0, height: "100%", overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", background: "var(--parchment-dark)", borderBottom: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem", color: "var(--amber)" }}>p. {p.page} / {p.total}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", color: "var(--faded)" }}>{p.status === "error" ? "⚠ error" : "✓"}</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                  <div style={{ background: "#111", flexShrink: 0 }}>
                    {p.image_b64
                      ? <img src={`data:image/png;base64,${p.image_b64}`} alt={`Page ${p.page}`} loading="lazy" style={{ width: "100%", display: "block", objectFit: "contain" }} />
                      : <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#3a3020", fontSize: "0.7rem" }}>No image</div>
                    }
                  </div>
                  <div style={{ padding: "16px 18px", background: "var(--parchment)", borderTop: "1px solid var(--rule)", flex: 1 }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "var(--amber-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--rule)" }}>
                      Transcription
                    </div>
                    <pre style={{ fontFamily: "'Libre Baskerville',serif", fontSize: "0.74rem", lineHeight: 1.85, color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                      {renderOCRText(p.text)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--faded)" }}>
            <span style={{ fontSize: "1.8rem", opacity: 0.3 }}>📄</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.76rem" }}>Select pages from the sidebar to compare</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", opacity: 0.6 }}>up to {MAX_COMPARE} pages side by side</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OCRView({ ocrFile, setOcrFile, ocrPages, setOcrPages, ocrProgress, setOcrProgress, ocrDone, setOcrDone, ocrJobId, setOcrJobId }) {
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // <--- NEW STATE
  const [error,    setError]    = useState(null);
  const fileRef = useRef();

  const pickFile = (f) => {
    if (!f?.name.toLowerCase().endsWith(".pdf")) { setError("Please upload a PDF."); return; }
    setOcrFile(f); setOcrPages([]); setOcrDone(false); setError(null); setOcrProgress({ done: 0, total: 0 });
  };

  const handleDrop = useCallback((e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }, []);

  const handleRun = async () => {
    if (!ocrFile) return;
    
    setIsUploading(true); // <--- START SPINNER IMMEDIATELY
    setOcrPages([]); setOcrProgress({ done: 0, total: 0 }); setOcrDone(false); setError(null); setOcrJobId(null);

    const form = new FormData();
    form.append("file", ocrFile);

    try {
      const resp = await fetch(`${BACKEND}/api/ocr/upload`, { method: "POST", body: form });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);

      const jid = resp.headers.get("X-Job-ID");
      if (jid) setOcrJobId(jid);

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          const event = JSON.parse(raw);
          if (event.status === "done") { setOcrDone(true); break; }
          setOcrPages((prev) => prev.find((p) => p.page === event.page) ? prev : [...prev, event].sort((a, b) => a.page - b.page));
          setOcrProgress({ done: event.page, total: event.total });
        }
      }
    } catch (e) {
      setError(`${e.message} — is the backend running at ${BACKEND}?`);
    } finally {
      setIsUploading(false); // <--- STOP SPINNER REGARDLESS OF SUCCESS/FAILURE
    }
  };

  const handleClear = () => {
    if (ocrJobId) fetch(`${BACKEND}/api/ocr/jobs/${ocrJobId}`, { method: "DELETE" }).catch(() => {});
    setOcrFile(null); setOcrPages([]); setOcrProgress({ done: 0, total: 0 }); setOcrDone(false); setError(null); setOcrJobId(null);
  };

  // UPDATED LOGIC: show spinner if uploading OR if we're still processing pages
  const running     = isUploading || (ocrPages.length > 0 && !ocrDone);
  const loadedSet   = new Set(ocrPages.map((p) => p.page));
  const allPageNums = ocrProgress.total > 0 ? Array.from({ length: ocrProgress.total }, (_, i) => i + 1) : [];

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem" }}>OCR Ingestion Engine</h2>
        <span className={`status-tag ${running ? "status-live" : ocrDone ? "status-live" : "status-mock"}`}>
          <span className="status-dot" />
          {running ? "PROCESSING" : ocrDone ? "COMPLETE" : "READY"}
        </span>
        {ocrJobId && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", color: "var(--faded)" }}>job: {ocrJobId}</span>}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Document Upload</div>
        <div className="card-subtitle">PDF → Gemini OCR — all pages processed, up to {MAX_COMPARE} shown side by side</div>

        <div
          className={`upload-zone ${dragging ? "drag-over" : ""} ${ocrFile ? "has-file" : ""}`}
          onClick={() => !running && fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{ borderStyle: ocrFile ? "solid" : "dashed", borderColor: dragging ? "var(--amber)" : ocrFile ? "var(--amber-dim)" : undefined, background: dragging || ocrFile ? "#fdf6e8" : undefined }}
        >
          <div className="upload-icon">{ocrFile ? "📄" : "📂"}</div>
          {ocrFile ? (
            <>
              <div className="upload-text" style={{ color: "var(--ink)" }}>{ocrFile.name}</div>
              <div className="upload-sub">{(ocrFile.size / 1024 / 1024).toFixed(2)} MB · click to change</div>
            </>
          ) : (
            <>
              <div className="upload-text">Drop a PDF or click to browse</div>
              <div className="upload-sub">All pages converted — navigate freely while processing</div>
            </>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files[0])} />

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fff0f0", border: "1px solid #c49a9a", borderRadius: 2, fontSize: "0.78rem", color: "var(--red-seal)" }}>⚠ {error}</div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={!ocrFile || running} onClick={handleRun}>
            {running ? <><span className="spinner" />&nbsp;Processing…</> : "Run OCR"}
          </button>
          {(ocrFile || ocrDone) && !running && <button className="btn btn-ghost" onClick={handleClear}>Clear</button>}
          {ocrProgress.total > 0 && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem", color: "var(--faded)", background: "var(--parchment-mid)", border: "1px solid var(--rule)", padding: "3px 10px", borderRadius: 20 }}>
              {ocrProgress.done} / {ocrProgress.total} pages
            </span>
          )}
          {ocrDone && <button className="btn btn-ghost">Export All Text</button>}
        </div>

        {ocrProgress.total > 0 && (
          <div style={{ height: 4, background: "var(--parchment-mid)", borderRadius: 2, overflow: "hidden", marginTop: 14 }}>
            <div style={{ height: "100%", width: `${(ocrProgress.done / ocrProgress.total) * 100}%`, background: "linear-gradient(90deg, var(--amber-dim), var(--amber-light))", transition: "width 0.4s ease" }} />
          </div>
        )}
      </div>

      {allPageNums.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Comparative Viewer</div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem", color: "var(--faded)" }}>
              {loadedSet.size} / {ocrProgress.total} loaded
            </span>
          </div>
          <CompareViewer pages={ocrPages} allPageNums={allPageNums} loadedSet={loadedSet} />
        </div>
      )}

      {/* CSS DEFINITIONS FOR SPINNER AND PULSE */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        
        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: #fff;
          animation: spin 0.8s linear infinite;
          vertical-align: middle;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}