export const OCR_EXTRA_STYLES = `
  /* ── OCR Page Viewer ── */
  .page-grid {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .page-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border-bottom: 2px solid var(--rule);
    animation: fadeUp 0.3s ease forwards;
    opacity: 0;
  }

  .page-row:last-child { border-bottom: none; }

  .page-image-col {
    background: #111;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--rule);
    position: relative;
  }

  .page-image-col img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .page-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0,0,0,0.7);
    color: var(--amber-light);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    padding: 3px 8px;
    border-radius: 2px;
    letter-spacing: 0.08em;
  }

  .page-text-col {
    padding: 24px 28px;
    overflow-y: auto;
    max-height: 500px;
    background: var(--parchment);
  }

  .page-text-col pre {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    line-height: 1.85;
    color: var(--ink);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .page-text-col .ocr-annotation {
    color: var(--amber-dim);
    font-style: italic;
  }

  .page-loading {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 200px;
    border-bottom: 1px solid var(--rule);
    opacity: 0.5;
  }

  .page-loading-img {
    background: #1a1810;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-loading-text {
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--faded);
    font-size: 0.78rem;
  }

  .progress-bar {
    height: 4px;
    background: var(--parchment-mid);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 20px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--amber-dim), var(--amber-light));
    transition: width 0.4s ease;
  }

  .upload-drop-target {
    border: 2px dashed var(--rule);
    background: var(--parchment);
    padding: 60px 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .upload-drop-target:hover,
  .upload-drop-target.drag-over {
    border-color: var(--amber);
    background: #fdf6e8;
  }

  .upload-drop-target.has-file {
    border-style: solid;
    border-color: var(--amber-dim);
    background: #fdf6e8;
  }

  .ocr-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .page-count-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.68rem;
    color: var(--muted, var(--faded));
    background: var(--parchment-mid);
    border: 1px solid var(--rule);
    padding: 3px 10px;
    border-radius: 20px;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from "react";

const BACKEND = "http://localhost:8000";

// Annotate special tokens for display
function renderOCRText(text) {
  return text.split("\n").map((line, i) => {
    const isAnnotation = /^\[(MARGIN|HEADER|FOOTER|ILLEGIBLE)/.test(line);
    return (
      <span key={i} className={isAnnotation ? "ocr-annotation" : ""}>
        {line}{"\n"}
      </span>
    );
  });
}

function PageRow({ page, total, imageB64, text }) {
  return (
    <div className="page-row" style={{ animationDelay: `${Math.min(page * 0.05, 0.5)}s` }}>
      {/* Image side */}
      <div className="page-image-col" style={{ minHeight: 400 }}>
        <span className="page-badge">p. {page} / {total}</span>
        {imageB64 ? (
          <img
            src={`data:image/png;base64,${imageB64}`}
            alt={`Page ${page}`}
            loading="lazy"
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#3a3020", fontSize: "0.7rem" }}>
            No image
          </div>
        )}
      </div>

      {/* Text side */}
      <div className="page-text-col">
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.6rem",
          color: "var(--amber-dim)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: "1px solid var(--rule)"
        }}>
          Transcription — Page {page}
        </div>
        <pre style={{
          fontFamily: "'Libre Baskerville', serif",
          fontSize: "0.76rem",
          lineHeight: 1.9,
          color: "var(--ink)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {renderOCRText(text)}
        </pre>
      </div>
    </div>
  );
}

function LoadingRow({ page, total }) {
  return (
    <div className="page-loading">
      <div className="page-loading-img">
        <div className="spinner" style={{ width: 24, height: 24 }} />
      </div>
      <div className="page-loading-text">
        <div className="spinner" />
        <span>Processing page {page} of {total}…</span>
      </div>
    </div>
  );
}

export default function OCRView() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [pages, setPages] = useState([]);       // { page, total, imageB64, text }
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const viewerRef = useRef();

  const handleFile = (f) => {
    if (!f || !f.name.endsWith(".pdf")) { setError("Please upload a PDF file."); return; }
    setFile(f);
    setPages([]);
    setDone(false);
    setError(null);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  }, []);

  const handleRun = async () => {
    if (!file) return;
    setRunning(true);
    setPages([]);
    setDone(false);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch(`${BACKEND}/api/ocr/upload`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          const event = JSON.parse(json);

          if (event.status === "done") {
            setDone(true);
            setRunning(false);
            break;
          }

          if (event.status === "ok" || event.status === "error") {
            setPages((prev) => {
              const exists = prev.find((p) => p.page === event.page);
              if (exists) return prev;
              return [...prev, event].sort((a, b) => a.page - b.page);
            });
            setProgress({ done: event.page, total: event.total });
          }
        }
      }
    } catch (e) {
      setError(`Failed: ${e.message}. Is the backend running at ${BACKEND}?`);
      setRunning(false);
    }
  };

  const completedPages = new Set(pages.map((p) => p.page));
  const pendingPages = progress.total > 0
    ? Array.from({ length: progress.total }, (_, i) => i + 1).filter(p => !completedPages.has(p))
    : [];

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem" }}>
          OCR Ingestion Engine
        </h2>
        <span className={`status-tag ${running ? "status-live" : done ? "status-live" : "status-mock"}`}>
          <span className="status-dot" />
          {running ? "PROCESSING" : done ? "COMPLETE" : "READY"}
        </span>
      </div>

      {/* Upload + controls */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Document Upload</div>
        <div className="card-subtitle">PDF → page images → Gemini OCR</div>

        <div
          className={`upload-drop-target ${dragging ? "drag-over" : ""} ${file ? "has-file" : ""}`}
          onClick={() => !running && fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div style={{ fontSize: "2.5rem", opacity: file ? 1 : 0.35 }}>
            {file ? "📄" : "📂"}
          </div>
          {file ? (
            <>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "1rem", color: "var(--ink)" }}>
                {file.name}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem", color: "var(--faded)" }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB — click to change
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "1rem", color: "var(--faded)" }}>
                Drop a PDF or click to browse
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--faded)" }}>
                Large documents (200+ pages) are processed in parallel
              </div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fff0f0", border: "1px solid #c49a9a", borderRadius: 2, fontSize: "0.78rem", color: "var(--red-seal)" }}>
            {error}
          </div>
        )}

        <div className="ocr-toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
          <button
            className="btn btn-primary"
            disabled={!file || running}
            onClick={handleRun}
          >
            {running ? <><span className="spinner" />&nbsp; Processing…</> : "Run OCR"}
          </button>
          {file && !running && (
            <button className="btn btn-ghost" onClick={() => { setFile(null); setPages([]); setDone(false); }}>
              Clear
            </button>
          )}
          {progress.total > 0 && (
            <span className="page-count-badge">
              {progress.done} / {progress.total} pages
            </span>
          )}
          {done && (
            <button className="btn btn-ghost">Export All Text</button>
          )}
        </div>

        {/* Progress bar */}
        {progress.total > 0 && (
          <div className="progress-bar" style={{ marginTop: 14, marginBottom: 0 }}>
            <div
              className="progress-fill"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Page viewer */}
      {(pages.length > 0 || running) && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }} ref={viewerRef}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Transcription Viewer</div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem", color: "var(--faded)" }}>
              image ↔ text
            </span>
          </div>

          <div className="page-grid">
            {/* Completed pages */}
            {pages.map((p) => (
              <PageRow
                key={p.page}
                page={p.page}
                total={p.total}
                imageB64={p.image_b64}
                text={p.text}
              />
            ))}

            {/* In-progress pages */}
            {running && pendingPages.slice(0, 3).map((pn) => (
              <LoadingRow key={pn} page={pn} total={progress.total} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}