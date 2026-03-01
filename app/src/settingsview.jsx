// SettingsView.jsx — Feature flags + backend config
const FLAGS = {
  OCR_UPLOAD_ENABLED: true, OCR_PROCESS_ENABLED: false,
  INDEX_SEARCH_ENABLED: true, INDEX_SEARCH_BACKEND: false,
  CHAT_ENABLED: true, CHAT_BACKEND: false,
  IMAGE_PREVIEW_ENABLED: true, SUMMARIZE_ENABLED: false,
};

function FlagPill({ on, label }) {
  return <span className={`flag-pill ${on ? "flag-on" : "flag-off"}`}>{on ? "✓" : "⚠"} {label}</span>;
}

export default function SettingsView() {
  return (
    <div className="fade-up">
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem", marginBottom: 24 }}>System Configuration & Flags</h2>
      <div className="two-col">
        <div className="card">
          <div className="card-title">Feature Flags</div>
          <div className="card-subtitle">Toggle backend / frontend capabilities</div>
          {Object.entries(FLAGS).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--rule)" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.76rem" }}>{k}</span>
              <FlagPill on={v} label={v ? "ON" : "OFF"} />
            </div>
          ))}
        </div>
        <div>
          <div className="card">
            <div className="card-title">Backend Services</div>
            <div className="card-subtitle">Integration points</div>
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
            <div className="card-title">API Endpoints</div>
            <div className="card-subtitle">Wire up when backend is ready</div>
            <pre style={{ fontFamily: "'JetBrains Mono',monospace", 
                fontSize: "0.68rem", lineHeight: 1.9, color: "var(--faded)" }}>
            {`POST /api/ocr/upload
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