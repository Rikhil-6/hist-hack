import { useState } from "react";
import { useAppState } from "./useAppState";
import OCRView      from "./OCRView";
import IndexView    from "./IndexView";
import ChatView     from "./ChatView";
import SettingsView from "./SettingsView";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1410; --parchment: #f5f0e8; --parchment-dark: #ede5d0; --parchment-mid: #e8dfc8;
    --amber: #c8860a; --amber-light: #e8a020; --amber-dim: #8a5c06;
    --red-seal: #8b1a1a; --faded: #7a6e5c; --rule: #c4b89a;
    --sidebar-bg: #1e1810; --sidebar-text: #d4c9a8; --sidebar-active: #c8860a;
    --tag-bg: #e8dfc8; --code-bg: #2a2218; --shadow-sm: 0 2px 8px rgba(0,0,0,0.12);
  }
  html, body, #root { height: 100%; }
  body { font-family: 'Libre Baskerville', Georgia, serif; background: var(--parchment); color: var(--ink); line-height: 1.6; }

  /* ── Layout ── */
  .app { display: flex; height: 100vh; overflow: hidden; }
  .sidebar { width: 240px; flex-shrink: 0; background: var(--sidebar-bg); display: flex; flex-direction: column; border-right: 3px solid var(--amber-dim); overflow-y: auto; }
  .sidebar-header { padding: 28px 20px 20px; border-bottom: 1px solid #3a2f1e; }
  .sidebar-logo { font-family: 'Playfair Display', serif; font-size: 1.15rem; color: var(--amber-light); font-weight: 700; letter-spacing: 0.04em; line-height: 1.3; }
  .sidebar-sub { font-size: 0.68rem; color: #6a5d42; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 4px; }
  .sidebar-section { padding: 16px 0 8px; }
  .sidebar-section-label { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #4a3f2a; padding: 0 20px 8px; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 20px; cursor: pointer; color: var(--sidebar-text); font-family: 'Libre Baskerville', serif; font-size: 0.82rem; transition: all 0.15s; border-left: 3px solid transparent; }
  .nav-item:hover { background: rgba(200,134,10,0.08); color: var(--amber-light); }
  .nav-item.active { background: rgba(200,134,10,0.14); color: var(--amber-light); border-left-color: var(--amber); }
  .nav-icon { font-size: 1rem; width: 20px; text-align: center; }
  .nav-badge { margin-left: auto; font-size: 0.6rem; background: var(--amber-dim); color: var(--parchment); padding: 1px 6px; border-radius: 10px; font-family: 'JetBrains Mono', monospace; }
  .nav-pulse { margin-left: auto; width: 7px; height: 7px; border-radius: 50%; background: var(--amber-light); animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .sidebar-footer { margin-top: auto; padding: 16px 20px; border-top: 1px solid #3a2f1e; font-size: 0.62rem; color: #4a3f2a; letter-spacing: 0.06em; }
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar { background: var(--parchment-dark); border-bottom: 2px solid var(--rule); padding: 14px 32px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .topbar-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 700; color: var(--ink); letter-spacing: 0.02em; }
  .topbar-meta { font-size: 0.7rem; color: var(--faded); letter-spacing: 0.08em; font-family: 'JetBrains Mono', monospace; }
  .content { flex: 1; overflow-y: auto; padding: 32px; }

  /* ── Cards ── */
  .card { background: #fff; border: 1px solid var(--rule); border-radius: 2px; padding: 24px; margin-bottom: 20px; box-shadow: var(--shadow-sm); }
  .card-title { font-family: 'Playfair Display', serif; font-size: 1rem; font-weight: 700; margin-bottom: 4px; color: var(--ink); }
  .card-subtitle { font-size: 0.72rem; color: var(--faded); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--rule); }

  /* ── Upload ── */
  .upload-zone { border: 2px dashed var(--rule); background: var(--parchment); padding: 40px; text-align: center; cursor: pointer; transition: all 0.2s; border-radius: 2px; }
  .upload-zone:hover, .upload-zone.drag-over { border-color: var(--amber); background: #fdf6e8; }
  .upload-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5; }
  .upload-text { font-family: 'Playfair Display', serif; font-size: 1rem; color: var(--faded); margin-bottom: 6px; }
  .upload-sub { font-size: 0.72rem; color: var(--faded); }

  /* ── Buttons ── */
  .btn { font-family: 'Libre Baskerville', serif; font-size: 0.78rem; padding: 9px 22px; border: none; cursor: pointer; letter-spacing: 0.06em; transition: all 0.15s; border-radius: 2px; }
  .btn-primary { background: var(--amber); color: #fff; border: 1px solid var(--amber-dim); }
  .btn-primary:hover { background: var(--amber-light); }
  .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: var(--faded); border: 1px solid var(--rule); }
  .btn-ghost:hover { border-color: var(--amber); color: var(--amber); }

  /* ── Search ── */
  .search-bar { display: flex; gap: 10px; margin-bottom: 20px; }
  .search-input { flex: 1; font-family: 'Libre Baskerville', serif; font-size: 0.9rem; padding: 10px 16px; border: 1px solid var(--rule); background: var(--parchment); color: var(--ink); outline: none; transition: border 0.15s; border-radius: 2px; }
  .search-input:focus { border-color: var(--amber); background: #fff; }

  /* ── Results ── */
  .result-item { border: 1px solid var(--rule); background: var(--parchment); padding: 16px 20px; margin-bottom: 12px; cursor: pointer; transition: all 0.15s; border-radius: 2px; }
  .result-item:hover { border-color: var(--amber); background: #fdf6e8; }
  .result-item.selected { border-color: var(--amber); border-left: 4px solid var(--amber); }
  .result-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
  .result-keyword { font-family: 'Playfair Display', serif; font-size: 1rem; font-weight: 700; color: var(--ink); }
  .result-page { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: var(--amber); background: #fdf6e8; border: 1px solid #e8d4a0; padding: 2px 8px; border-radius: 10px; }
  .result-desc { font-size: 0.8rem; color: var(--faded); margin-bottom: 8px; font-style: italic; }
  .result-file { font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; color: var(--amber-dim); }
  .tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tag { font-size: 0.62rem; padding: 2px 10px; background: var(--tag-bg); border: 1px solid var(--rule); color: var(--faded); letter-spacing: 0.06em; text-transform: uppercase; border-radius: 20px; }
  .confidence-bar { height: 3px; background: var(--rule); border-radius: 2px; margin-top: 10px; overflow: hidden; }
  .confidence-fill { height: 100%; background: linear-gradient(90deg, var(--amber-dim), var(--amber-light)); transition: width 0.6s ease; }

  /* ── Image panel ── */
  .image-panel { background: var(--code-bg); border-radius: 2px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; color: #6a5d42; text-align: center; }
  .image-placeholder { font-size: 3rem; margin-bottom: 12px; opacity: 0.4; }
  .image-label { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: #8a7a5a; }

  /* ── Chat ── */
  .chat-bubble { max-width: 80%; padding: 14px 18px; border-radius: 2px; font-size: 0.84rem; line-height: 1.7; }
  .chat-bubble.assistant { background: var(--parchment-dark); border: 1px solid var(--rule); border-left: 3px solid var(--amber); align-self: flex-start; }
  .chat-bubble.user { background: var(--code-bg); color: var(--parchment); align-self: flex-end; border: 1px solid #3a2f1e; }
  .chat-role { font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 6px; opacity: 0.6; font-family: 'JetBrains Mono', monospace; }
  .chat-input-row { display: flex; gap: 10px; padding-top: 16px; border-top: 1px solid var(--rule); flex-shrink: 0; }
  .chat-input { flex: 1; font-family: 'Libre Baskerville', serif; font-size: 0.84rem; padding: 10px 16px; border: 1px solid var(--rule); background: var(--parchment); color: var(--ink); outline: none; resize: none; transition: border 0.15s; border-radius: 2px; min-height: 44px; max-height: 120px; }
  .chat-input:focus { border-color: var(--amber); background: #fff; }

  /* ── Misc ── */
  .flag-pill { font-size: 0.6rem; padding: 2px 8px; border-radius: 20px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em; border: 1px solid; }
  .flag-on { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
  .flag-off { background: #fff3e0; color: #e65100; border-color: #ffcc80; }
  .status-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 0.68rem; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.06em; padding: 3px 10px; border-radius: 20px; }
  .status-mock { background: #fff3e0; color: #bf6900; border: 1px solid #ffcc80; }
  .status-live { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .meta-row { display: flex; gap: 24px; margin-bottom: 16px; flex-wrap: wrap; }
  .meta-item { font-size: 0.7rem; color: var(--faded); font-family: 'JetBrains Mono', monospace; }
  .meta-label { color: var(--amber); margin-right: 4px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
  .divider { border: none; border-top: 1px solid var(--rule); margin: 16px 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width: 18px; height: 18px; border: 2px solid var(--rule); border-top-color: var(--amber); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
  @keyframes blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
  .typing span { display: inline-block; width: 5px; height: 5px; background: var(--amber); border-radius: 50%; margin: 0 2px; animation: blink 1.4s infinite; }
  .typing span:nth-child(2) { animation-delay: 0.2s; }
  .typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp 0.3s ease forwards; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--amber-dim); }
  .ocr-output { font-family: 'JetBrains Mono', monospace; font-size: 0.74rem; line-height: 1.7; background: var(--code-bg); color: #c8be9a; padding: 20px; border-radius: 2px; overflow-x: auto; white-space: pre-wrap; border: 1px solid #3a2f1e; }
`;

const NAV = [
  { id: "ocr",      icon: "🔬", label: "OCR Ingestion",      badge: "Obj 1" },
  { id: "index",    icon: "📇", label: "Kratoska Index",      badge: "Obj 2" },
  { id: "chat",     icon: "🏛",  label: "Semantic Historian", badge: "Obj 3" },
  { id: "settings", icon: "⚙️", label: "Configuration",       badge: null   },
];

export default function App() {
  const [view, setView] = useState("ocr");
  const { ocr, index, chat } = useAppState();

  // Derive whether OCR is actively running (for the nav pulse indicator)
  const ocrRunning = ocr.ocrPages.length > 0 && !ocr.ocrDone && ocr.ocrProgress.done < ocr.ocrProgress.total;

  const renderView = () => {
    switch (view) {
      case "ocr":      return <OCRView      {...ocr} />;
      case "index":    return <IndexView    {...index} />;
      case "chat":     return <ChatView     {...chat} />;
      case "settings": return <SettingsView />;
      default:         return null;
    }
  };

  const currentNav = NAV.find((n) => n.id === view);

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">Kratoska Archive</div>
            <div className="sidebar-sub">CO 273 · Colonial Records</div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">Objectives</div>
            {NAV.slice(0, 3).map((n) => (
              <div key={n.id} className={`nav-item ${view === n.id ? "active" : ""}`} onClick={() => setView(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
                {/* Show pulse on OCR nav item when processing in background */}
                {n.id === "ocr" && ocrRunning && view !== "ocr"
                  ? <span className="nav-pulse" title="OCR processing…" />
                  : n.badge && <span className="nav-badge">{n.badge}</span>
                }
              </div>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">System</div>
            <div className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>
              <span className="nav-icon">⚙️</span>
              <span>Configuration</span>
            </div>
          </div>

          <div className="sidebar-footer">
            Gemini Flash · Cloud Storage<br />
            Frontend v0.2 · Split views
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <span className="topbar-title">{currentNav?.icon} {currentNav?.label}</span>
            <span className="topbar-meta">
              {ocrRunning && view !== "ocr" && (
                <span style={{ color: "var(--amber)", marginRight: 16 }}>
                  ⚡ OCR running: {ocr.ocrProgress.done}/{ocr.ocrProgress.total} pages
                </span>
              )}
              {ocr.ocrDone && <span style={{ color: "#2e7d32", marginRight: 16 }}>✓ OCR complete</span>}
              hist-hack · v0.2
            </span>
          </div>
          <div className="content">{renderView()}</div>
        </div>
      </div>
    </>
  );
}