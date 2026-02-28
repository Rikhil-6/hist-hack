import { useState, useRef, useEffect } from "react";

// ─── MOCK / FLAG LAYER ────────────────────────────────────────────────────────
const FLAGS = {
  OCR_UPLOAD_ENABLED: true,      // Obj 1: file ingestion UI
  OCR_PROCESS_ENABLED: false,    // Obj 1: backend OCR call
  INDEX_SEARCH_ENABLED: true,    // Obj 2: search UI
  INDEX_SEARCH_BACKEND: false,   // Obj 2: backend keyword search
  CHAT_ENABLED: true,            // Obj 3: chat UI
  CHAT_BACKEND: false,           // Obj 3: RAG backend
  IMAGE_PREVIEW_ENABLED: true,   // Obj 2: image viewer
  SUMMARIZE_ENABLED: false,      // Obj 3: auto-summarization
};

// ─── FAKE DATA ────────────────────────────────────────────────────────────────
const MOCK_SEARCH_RESULTS = [
  {
    keyword: "Opium",
    page: 142,
    co273File: "CO273_0142.tif",
    description: "References to opium trade regulations in the Straits Settlements, 1910–1920.",
    confidence: 0.94,
    relatedKeywords: ["Narcotics", "Trade", "Revenue"],
  },
  {
    keyword: "Opium",
    page: 207,
    co273File: "CO273_0207.tif",
    description: "Opium farm licensing disputes and colonial revenue reports.",
    confidence: 0.88,
    relatedKeywords: ["Revenue", "Licensing", "Colonial Policy"],
  },
  {
    keyword: "Opium",
    page: 318,
    co273File: "CO273_0318.tif",
    description: "Medical and social commentary on opium use among migrant laborers.",
    confidence: 0.76,
    relatedKeywords: ["Labour", "Health", "Migration"],
  },
];

const MOCK_CHAT_HISTORY = [
  {
    role: "assistant",
    content:
      "Welcome to the Semantic Historian. I have ingested the CO 273 corpus and the Kratoska Index. Ask me anything — from archival facts to thematic analysis.",
  },
];

const MOCK_CHAT_RESPONSES = [
  "Based on the CO 273 documents, the 1915 Singapore Mutiny was precipitated by a combination of religious agitation among the 5th Light Infantry and wartime anxieties about deployment to fight other Muslims. The documents reference internal intelligence failures and delayed response from colonial authorities.",
  "The corpus reveals three recurring justifications: fear of German prisoner collusion, loyalty disputes among Indian sepoys, and administrative failures in leave management. Cross-referencing with file CO273_0089 and CO273_0093 shows contradictory accounts between military and civil authorities.",
  "Thematic analysis of the keyword cluster 'Labour / Migration / Health' across 47 documents suggests a systemic colonial pattern of cost-externalisation onto migrant communities — echoed in secondary sources by Kernial Singh Sandhu and Paul Wheatley.",
];

const MOCK_OCR_RESULT = {
  filename: "scan_page_042.jpg",
  extractedText: `KRATOSKA INDEX — PAGE 42

OPIUM — See also: Chandu, Revenue Farms, Narcotics
  CO 273/142  — Opium Farm, Straits Settlements, 1910
  CO 273/207  — Opium Revenue Disputes, 1914
  CO 273/318  — Labour & Opium Use (Medical Reports), 1916

ORDINANCES — See also: Legislative Council, Law
  CO 273/055  — Ordinance No. 7 of 1909 (amended)
  CO 273/099  — Emergency Ordinances, 1915`,
  confidence: 0.96,
  model: "Gemini 1.5 Pro (Vision)",
  processingTime: "2.3s",
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #1a1410;
    --parchment: #f5f0e8;
    --parchment-dark: #ede5d0;
    --parchment-mid: #e8dfc8;
    --amber: #c8860a;
    --amber-light: #e8a020;
    --amber-dim: #8a5c06;
    --red-seal: #8b1a1a;
    --faded: #7a6e5c;
    --rule: #c4b89a;
    --sidebar-bg: #1e1810;
    --sidebar-text: #d4c9a8;
    --sidebar-active: #c8860a;
    --tag-bg: #e8dfc8;
    --code-bg: #2a2218;
    --shadow: 0 4px 24px rgba(0,0,0,0.18);
    --shadow-sm: 0 2px 8px rgba(0,0,0,0.12);
  }

  html, body, #root { height: 100%; }

  body {
    font-family: 'Libre Baskerville', Georgia, serif;
    background: var(--parchment);
    color: var(--ink);
    line-height: 1.6;
  }

  /* ── Layout ── */
  .app { display: flex; height: 100vh; overflow: hidden; }

  .sidebar {
    width: 240px;
    flex-shrink: 0;
    background: var(--sidebar-bg);
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow-y: auto;
    border-right: 3px solid var(--amber-dim);
  }

  .sidebar-header {
    padding: 28px 20px 20px;
    border-bottom: 1px solid #3a2f1e;
  }

  .sidebar-logo {
    font-family: 'Playfair Display', serif;
    font-size: 1.15rem;
    color: var(--amber-light);
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.3;
  }

  .sidebar-sub {
    font-size: 0.68rem;
    color: #6a5d42;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-top: 4px;
  }

  .sidebar-section {
    padding: 16px 0 8px;
  }

  .sidebar-section-label {
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #4a3f2a;
    padding: 0 20px 8px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    cursor: pointer;
    color: var(--sidebar-text);
    font-family: 'Libre Baskerville', serif;
    font-size: 0.82rem;
    transition: all 0.15s;
    border-left: 3px solid transparent;
  }

  .nav-item:hover { background: rgba(200,134,10,0.08); color: var(--amber-light); }
  .nav-item.active {
    background: rgba(200,134,10,0.14);
    color: var(--amber-light);
    border-left-color: var(--amber);
  }

  .nav-icon { font-size: 1rem; width: 20px; text-align: center; }

  .nav-badge {
    margin-left: auto;
    font-size: 0.6rem;
    background: var(--amber-dim);
    color: var(--parchment);
    padding: 1px 6px;
    border-radius: 10px;
    font-family: 'JetBrains Mono', monospace;
  }

  .sidebar-footer {
    margin-top: auto;
    padding: 16px 20px;
    border-top: 1px solid #3a2f1e;
    font-size: 0.62rem;
    color: #4a3f2a;
    letter-spacing: 0.06em;
  }

  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .topbar {
    background: var(--parchment-dark);
    border-bottom: 2px solid var(--rule);
    padding: 14px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .topbar-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: 0.02em;
  }

  .topbar-meta {
    font-size: 0.7rem;
    color: var(--faded);
    letter-spacing: 0.08em;
    font-family: 'JetBrains Mono', monospace;
  }

  .flag-pill {
    font-size: 0.6rem;
    padding: 2px 8px;
    border-radius: 20px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.05em;
    border: 1px solid;
  }
  .flag-on { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
  .flag-off { background: #fff3e0; color: #e65100; border-color: #ffcc80; }

  .content { flex: 1; overflow-y: auto; padding: 32px; }

  /* ── Cards ── */
  .card {
    background: #fff;
    border: 1px solid var(--rule);
    border-radius: 2px;
    padding: 24px;
    margin-bottom: 20px;
    box-shadow: var(--shadow-sm);
  }

  .card-title {
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 4px;
    color: var(--ink);
  }

  .card-subtitle {
    font-size: 0.72rem;
    color: var(--faded);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--rule);
  }

  /* ── Upload Zone ── */
  .upload-zone {
    border: 2px dashed var(--rule);
    background: var(--parchment);
    padding: 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 2px;
  }

  .upload-zone:hover, .upload-zone.drag-over {
    border-color: var(--amber);
    background: #fdf6e8;
  }

  .upload-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5; }

  .upload-text {
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    color: var(--faded);
    margin-bottom: 6px;
  }

  .upload-sub { font-size: 0.72rem; color: var(--faded); }

  /* ── Buttons ── */
  .btn {
    font-family: 'Libre Baskerville', serif;
    font-size: 0.78rem;
    padding: 9px 22px;
    border: none;
    cursor: pointer;
    letter-spacing: 0.06em;
    transition: all 0.15s;
    border-radius: 2px;
  }

  .btn-primary {
    background: var(--amber);
    color: #fff;
    border: 1px solid var(--amber-dim);
  }
  .btn-primary:hover { background: var(--amber-light); }
  .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-ghost {
    background: transparent;
    color: var(--faded);
    border: 1px solid var(--rule);
  }
  .btn-ghost:hover { border-color: var(--amber); color: var(--amber); }

  .btn-danger {
    background: transparent;
    color: var(--red-seal);
    border: 1px solid #c49a9a;
  }
  .btn-danger:hover { background: #fff0f0; }

  /* ── Search ── */
  .search-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  .search-input {
    flex: 1;
    font-family: 'Libre Baskerville', serif;
    font-size: 0.9rem;
    padding: 10px 16px;
    border: 1px solid var(--rule);
    background: var(--parchment);
    color: var(--ink);
    outline: none;
    transition: border 0.15s;
    border-radius: 2px;
  }
  .search-input:focus { border-color: var(--amber); background: #fff; }

  /* ── Result Cards ── */
  .result-item {
    border: 1px solid var(--rule);
    background: var(--parchment);
    padding: 16px 20px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
    border-radius: 2px;
  }

  .result-item:hover { border-color: var(--amber); background: #fdf6e8; }
  .result-item.selected { border-color: var(--amber); border-left: 4px solid var(--amber); }

  .result-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .result-keyword {
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    font-weight: 700;
    color: var(--ink);
  }

  .result-page {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--amber);
    background: #fdf6e8;
    border: 1px solid #e8d4a0;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .result-desc {
    font-size: 0.8rem;
    color: var(--faded);
    margin-bottom: 8px;
    font-style: italic;
  }

  .result-file {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.68rem;
    color: var(--amber-dim);
  }

  .tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }

  .tag {
    font-size: 0.62rem;
    padding: 2px 10px;
    background: var(--tag-bg);
    border: 1px solid var(--rule);
    color: var(--faded);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-radius: 20px;
  }

  .confidence-bar {
    height: 3px;
    background: var(--rule);
    border-radius: 2px;
    margin-top: 10px;
    overflow: hidden;
  }
  .confidence-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--amber-dim), var(--amber-light));
    transition: width 0.6s ease;
  }

  /* ── Image Panel ── */
  .image-panel {
    background: var(--code-bg);
    border-radius: 2px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    color: #6a5d42;
    text-align: center;
  }

  .image-placeholder {
    font-size: 3rem;
    margin-bottom: 12px;
    opacity: 0.4;
  }

  .image-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: #8a7a5a;
  }

  /* ── Chat ── */
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 0;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 0 0 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .chat-bubble {
    max-width: 80%;
    padding: 14px 18px;
    border-radius: 2px;
    font-size: 0.84rem;
    line-height: 1.7;
    position: relative;
  }

  .chat-bubble.assistant {
    background: var(--parchment-dark);
    border: 1px solid var(--rule);
    border-left: 3px solid var(--amber);
    align-self: flex-start;
  }

  .chat-bubble.user {
    background: var(--code-bg);
    color: var(--parchment);
    align-self: flex-end;
    border: 1px solid #3a2f1e;
  }

  .chat-role {
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 6px;
    opacity: 0.6;
    font-family: 'JetBrains Mono', monospace;
  }

  .chat-input-row {
    display: flex;
    gap: 10px;
    padding-top: 16px;
    border-top: 1px solid var(--rule);
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    font-family: 'Libre Baskerville', serif;
    font-size: 0.84rem;
    padding: 10px 16px;
    border: 1px solid var(--rule);
    background: var(--parchment);
    color: var(--ink);
    outline: none;
    resize: none;
    transition: border 0.15s;
    border-radius: 2px;
    min-height: 44px;
    max-height: 120px;
  }
  .chat-input:focus { border-color: var(--amber); background: #fff; }

  /* ── OCR result ── */
  .ocr-output {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.74rem;
    line-height: 1.7;
    background: var(--code-bg);
    color: #c8be9a;
    padding: 20px;
    border-radius: 2px;
    overflow-x: auto;
    white-space: pre-wrap;
    border: 1px solid #3a2f1e;
  }

  .meta-row {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .meta-item {
    font-size: 0.7rem;
    color: var(--faded);
    font-family: 'JetBrains Mono', monospace;
  }

  .meta-label { color: var(--amber); margin-right: 4px; }

  /* ── Status ── */
  .status-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.68rem;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.06em;
    padding: 3px 10px;
    border-radius: 20px;
  }
  .status-mock { background: #fff3e0; color: #bf6900; border: 1px solid #ffcc80; }
  .status-live { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  /* ── Spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 18px; height: 18px;
    border: 2px solid var(--rule);
    border-top-color: var(--amber);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  /* ── Two-col ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }

  /* ── Divider ── */
  .divider {
    border: none;
    border-top: 1px solid var(--rule);
    margin: 16px 0;
  }

  /* ── Typing indicator ── */
  @keyframes blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
  .typing span {
    display: inline-block;
    width: 5px; height: 5px;
    background: var(--amber);
    border-radius: 50%;
    margin: 0 2px;
    animation: blink 1.4s infinite;
  }
  .typing span:nth-child(2) { animation-delay: 0.2s; }
  .typing span:nth-child(3) { animation-delay: 0.4s; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--amber-dim); }

  /* ── Fade anim ── */
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp 0.3s ease forwards; }
`;

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function FlagPill({ on, label }) {
  return (
    <span className={`flag-pill ${on ? "flag-on" : "flag-off"}`}>
      {on ? "✓" : "⚠"} {label}
    </span>
  );
}

function StatusTag({ mock }) {
  return (
    <span className={`status-tag ${mock ? "status-mock" : "status-live"}`}>
      <span className="status-dot" />
      {mock ? "MOCK DATA" : "LIVE"}
    </span>
  );
}

// ─── VIEW: OCR ────────────────────────────────────────────────────────────────
function OCRView() {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [source, setSource] = useState("A");
  const fileRef = useRef();

  const handleFiles = (f) => {
    const arr = Array.from(f);
    setFiles(arr);
    setResult(null);
  };

  const handleProcess = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 2200));
    if (FLAGS.OCR_PROCESS_ENABLED) {
      // TODO: POST to /api/ocr with FormData
    } else {
      setResult(MOCK_OCR_RESULT);
    }
    setProcessing(false);
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem" }}>
          OCR Ingestion Engine
        </h2>
        <StatusTag mock={!FLAGS.OCR_PROCESS_ENABLED} />
        <FlagPill on={FLAGS.OCR_PROCESS_ENABLED} label="OCR_BACKEND" />
      </div>

      <div className="two-col">
        {/* Upload */}
        <div>
          <div className="card">
            <div className="card-title">Document Source</div>
            <div className="card-subtitle">Select image source and upload scans</div>

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {["A", "B"].map((s) => (
                <button
                  key={s}
                  className={`btn ${source === s ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setSource(s)}
                >
                  Source {s}
                </button>
              ))}
            </div>

            <div
              className={`upload-zone ${dragging ? "drag-over" : ""}`}
              onClick={() => fileRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            >
              <div className="upload-icon">📜</div>
              <div className="upload-text">Drop scans here or click to browse</div>
              <div className="upload-sub">TIFF, JPG, PNG — up to 50MB per file</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.tif,.tiff"
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />

            {files.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {files.map((f, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--rule)", fontSize: "0.78rem" }}
                  >
                    <span>📄 {f.name}</span>
                    <span style={{ color: "var(--faded)", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.66rem" }}>
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    disabled={processing}
                    onClick={handleProcess}
                  >
                    {processing ? <><span className="spinner" /> &nbsp;Processing…</> : "Run OCR"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setFiles([]); setResult(null); }}>
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Model Configuration</div>
            <div className="card-subtitle">Backend Vision-Language Model</div>
            <div className="meta-row">
              <div className="meta-item"><span className="meta-label">Model:</span> Gemini 1.5 Pro (Vision)</div>
              <div className="meta-item"><span className="meta-label">Fallback:</span> Google Cloud Vision</div>
              <div className="meta-item"><span className="meta-label">Storage:</span> Cloud Bucket / CO273</div>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--faded)", fontStyle: "italic" }}>
              The pipeline uses VLMs to outperform baseline Gale OCR, targeting archaic fonts and handwritten marginalia.
            </p>
          </div>
        </div>

        {/* Result */}
        <div>
          <div className="card" style={{ minHeight: 300 }}>
            <div className="card-title">Extracted Text</div>
            <div className="card-subtitle">Raw OCR output with confidence metrics</div>

            {!result && !processing && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--faded)" }}>
                <div style={{ fontSize: "2rem", marginBottom: 10, opacity: 0.3 }}>🔍</div>
                <div style={{ fontSize: "0.8rem" }}>Upload and process a document to see results</div>
              </div>
            )}

            {processing && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px" }} />
                <div style={{ fontSize: "0.8rem", color: "var(--faded)" }}>Sending to Gemini 1.5 Pro…</div>
              </div>
            )}

            {result && (
              <>
                <div className="meta-row">
                  <div className="meta-item"><span className="meta-label">File:</span> {result.filename}</div>
                  <div className="meta-item"><span className="meta-label">Confidence:</span> {(result.confidence * 100).toFixed(0)}%</div>
                  <div className="meta-item"><span className="meta-label">Time:</span> {result.processingTime}</div>
                </div>
                <pre className="ocr-output">{result.extractedText}</pre>
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button className="btn btn-primary">Save to Corpus</button>
                  <button className="btn btn-ghost">Export TXT</button>
                  <button className="btn btn-ghost">Link to Index</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VIEW: INDEX SEARCH ───────────────────────────────────────────────────────
function IndexView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    await new Promise((r) => setTimeout(r, 1100));
    if (FLAGS.INDEX_SEARCH_BACKEND) {
      // TODO: GET /api/index/search?q=query
    } else {
      setResults(MOCK_SEARCH_RESULTS.filter(() => true));
    }
    setSearching(false);
    setSearched(true);
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem" }}>
          Kratoska Index — Search
        </h2>
        <StatusTag mock={!FLAGS.INDEX_SEARCH_BACKEND} />
        <FlagPill on={FLAGS.INDEX_SEARCH_BACKEND} label="SEARCH_BACKEND" />
      </div>

      <div className="search-bar">
        <input
          className="search-input"
          placeholder="Search keyword (e.g. 'Opium', '1915 Mutiny', 'Revenue')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
          {searching ? <span className="spinner" /> : "Search Index"}
        </button>
      </div>

      <div className="two-col">
        {/* Results */}
        <div>
          {searched && !searching && (
            <div style={{ fontSize: "0.72rem", color: "var(--faded)", marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>
              {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
            </div>
          )}

          {searching && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div className="spinner" style={{ width: 28, height: 28, margin: "0 auto 12px" }} />
              <div style={{ fontSize: "0.78rem", color: "var(--faded)" }}>Querying Kratoska Index…</div>
            </div>
          )}

          {!searching && results.map((r, i) => (
            <div
              key={i}
              className={`result-item ${selected === i ? "selected" : ""}`}
              onClick={() => setSelected(i)}
            >
              <div className="result-header">
                <span className="result-keyword">{r.keyword}</span>
                <span className="result-page">p. {r.page}</span>
              </div>
              <div className="result-desc">{r.description}</div>
              <div className="result-file">↗ {r.co273File}</div>
              <div className="tag-list">
                {r.relatedKeywords.map((t) => (
                  <span className="tag" key={t}>{t}</span>
                ))}
              </div>
              <div className="confidence-bar">
                <div className="confidence-fill" style={{ width: `${r.confidence * 100}%` }} />
              </div>
            </div>
          ))}

          {searched && !searching && results.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--faded)" }}>
              <div style={{ fontSize: "0.9rem" }}>No results found in Kratoska Index.</div>
            </div>
          )}
        </div>

        {/* Document Preview */}
        <div>
          <div className="card">
            <div className="card-title">Document Preview</div>
            <div className="card-subtitle">CO 273 Source Image</div>

            {selected === null ? (
              <div className="image-panel">
                <div className="image-placeholder">📋</div>
                <div className="image-label">Select a result to preview the source image</div>
              </div>
            ) : (
              <>
                <div className="meta-row">
                  <div className="meta-item">
                    <span className="meta-label">File:</span> {results[selected].co273File}
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Page:</span> {results[selected].page}
                  </div>
                </div>
                <div className="image-panel">
                  {FLAGS.IMAGE_PREVIEW_ENABLED ? (
                    <>
                      <div className="image-placeholder" style={{ fontSize: "4rem" }}>🗂</div>
                      <div className="image-label" style={{ marginBottom: 8 }}>
                        {results[selected].co273File}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#4a3f2a" }}>
                        [Image loads from Cloud Storage in production]
                      </div>
                    </>
                  ) : (
                    <div className="image-label">Preview disabled</div>
                  )}
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "0.9rem", marginBottom: 6 }}>
                    {results[selected].description}
                  </div>
                  <div className="tag-list">
                    {results[selected].relatedKeywords.map((t) => (
                      <span className="tag" key={t}>{t}</span>
                    ))}
                  </div>
                </div>
                <hr className="divider" />
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-primary">Open in Viewer</button>
                  <button className="btn btn-ghost">Add Keywords</button>
                  <button className="btn btn-ghost">Export</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VIEW: SEMANTIC HISTORIAN ─────────────────────────────────────────────────
function ChatView() {
  const [messages, setMessages] = useState(MOCK_CHAT_HISTORY);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [responseIdx, setResponseIdx] = useState(0);
  const endRef = useRef();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));

    let reply;
    if (FLAGS.CHAT_BACKEND) {
      // TODO: POST /api/chat with messages history
      reply = "Backend response would appear here.";
    } else {
      reply = MOCK_CHAT_RESPONSES[responseIdx % MOCK_CHAT_RESPONSES.length];
      setResponseIdx((i) => i + 1);
    }

    setTyping(false);
    setMessages((m) => [...m, { role: "assistant", content: reply }]);
  };

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem" }}>
          The Semantic Historian
        </h2>
        <StatusTag mock={!FLAGS.CHAT_BACKEND} />
        <FlagPill on={FLAGS.CHAT_BACKEND} label="RAG_BACKEND" />
        <FlagPill on={FLAGS.SUMMARIZE_ENABLED} label="SUMMARIZE" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, flex: 1, minHeight: 0 }}>
        {/* Chat panel */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-title">Corpus Interrogation</div>
          <div className="card-subtitle">RAG over CO 273 + Kratoska Index</div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role} fade-up`}>
                <div className="chat-role">{m.role === "assistant" ? "Historian" : "Researcher"}</div>
                {m.content}
              </div>
            ))}
            {typing && (
              <div className="chat-bubble assistant">
                <div className="chat-role">Historian</div>
                <div className="typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              className="chat-input"
              placeholder="Ask about the corpus… (e.g. 'What were the causes of the 1915 mutiny?')"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={2}
            />
            <button className="btn btn-primary" onClick={send} disabled={typing || !input.trim()}>
              Send
            </button>
          </div>
        </div>

        {/* Sidebar panel */}
        <div>
          <div className="card">
            <div className="card-title">Summarization</div>
            <div className="card-subtitle">Historian-grade document summaries</div>
            <FlagPill on={FLAGS.SUMMARIZE_ENABLED} label="SUMMARIZE" />
            <p style={{ fontSize: "0.75rem", color: "var(--faded)", marginTop: 12, fontStyle: "italic" }}>
              Enable SUMMARIZE flag to auto-generate summaries on document ingestion.
            </p>
            <hr className="divider" />
            <button className="btn btn-ghost" style={{ width: "100%" }} disabled={!FLAGS.SUMMARIZE_ENABLED}>
              Summarize Active Doc
            </button>
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="card-title">Thematic Analysis</div>
            <div className="card-subtitle">Keyword connections</div>
            <div style={{ fontSize: "0.76rem", color: "var(--faded)", marginBottom: 12 }}>
              Detected themes in corpus:
            </div>
            {["Colonial Administration", "Trade & Revenue", "Labour & Migration", "Public Order", "Health & Medicine"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--rule)", fontSize: "0.76rem" }}>
                <span>{t}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.64rem", color: "var(--amber)" }}>
                  {Math.floor(Math.random() * 40 + 8)} docs
                </span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="card-title">Bonus: Theme Mode</div>
            <div className="card-subtitle">Specialise chatbot on a theme</div>
            <p style={{ fontSize: "0.74rem", color: "var(--faded)", marginBottom: 12, fontStyle: "italic" }}>
              Pick a theme to anchor RAG retrieval and secondary sources.
            </p>
            {["Public Health", "1915 Mutiny", "Opium Trade", "Labour", "Governance"].map((t) => (
              <button key={t} className="btn btn-ghost" style={{ display: "block", width: "100%", marginBottom: 6, textAlign: "left" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VIEW: SETTINGS ───────────────────────────────────────────────────────────
function SettingsView() {
  return (
    <div className="fade-up">
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem", marginBottom: 24 }}>
        System Configuration & Flags
      </h2>
      <div className="two-col">
        <div className="card">
          <div className="card-title">Feature Flags</div>
          <div className="card-subtitle">Toggle backend / frontend capabilities</div>
          {Object.entries(FLAGS).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--rule)" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.76rem" }}>{k}</span>
              <FlagPill on={v} label={v ? "ON" : "OFF"} />
            </div>
          ))}
        </div>
        <div>
          <div className="card">
            <div className="card-title">Backend Services</div>
            <div className="card-subtitle">Black-box integration points</div>
            {[
              { name: "Gemini Flash / Pro", role: "OCR + RAG + Summarization", status: "Configured" },
              { name: "Cloud Storage", role: "CO 273 TIFF files + corpus", status: "Configured" },
              { name: "Vector DB", role: "Semantic retrieval (RAG)", status: "Pending" },
              { name: "OCR Pipeline", role: "Image → text ingestion", status: "Pending" },
            ].map((s) => (
              <div key={s.name} style={{ padding: "10px 0", borderBottom: "1px solid var(--rule)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>{s.name}</span>
                  <span className={`status-tag ${s.status === "Configured" ? "status-live" : "status-mock"}`} style={{ fontSize: "0.6rem" }}>
                    <span className="status-dot" /> {s.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--faded)" }}>{s.role}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">API Endpoints (Placeholder)</div>
            <div className="card-subtitle">Wire up when backend is ready</div>
            <pre style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem", lineHeight: 1.9, color: "var(--faded)" }}>
{`POST /api/ocr
GET  /api/index/search?q=
POST /api/chat
GET  /api/document/:id
POST /api/summarize`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "ocr", icon: "🔬", label: "OCR Ingestion", badge: "Obj 1" },
  { id: "index", icon: "📇", label: "Kratoska Index", badge: "Obj 2" },
  { id: "chat", icon: "🏛", label: "Semantic Historian", badge: "Obj 3" },
  { id: "settings", icon: "⚙️", label: "Configuration", badge: null },
];

export default function App() {
  const [view, setView] = useState("ocr");

  const renderView = () => {
    switch (view) {
      case "ocr": return <OCRView />;
      case "index": return <IndexView />;
      case "chat": return <ChatView />;
      case "settings": return <SettingsView />;
      default: return null;
    }
  };

  const currentNav = NAV.find((n) => n.id === view);

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">Kratoska Archive</div>
            <div className="sidebar-sub">CO 273 · Colonial Records</div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">Objectives</div>
            {NAV.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className={`nav-item ${view === n.id ? "active" : ""}`}
                onClick={() => setView(n.id)}
              >
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
                {n.badge && <span className="nav-badge">{n.badge}</span>}
              </div>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">System</div>
            <div
              className={`nav-item ${view === "settings" ? "active" : ""}`}
              onClick={() => setView("settings")}
            >
              <span className="nav-icon">⚙️</span>
              <span>Configuration</span>
            </div>
          </div>

          <div className="sidebar-footer">
            Gemini Flash · Cloud Storage<br />
            Frontend v0.1 · Flags Active
          </div>
        </aside>

        {/* Main */}
        <div className="main">
          <div className="topbar">
            <span className="topbar-title">
              {currentNav?.icon} {currentNav?.label}
            </span>
            <span className="topbar-meta">
              {Object.values(FLAGS).filter(Boolean).length}/{Object.keys(FLAGS).length} flags ON
            </span>
          </div>
          <div className="content">{renderView()}</div>
        </div>
      </div>
    </>
  );
}