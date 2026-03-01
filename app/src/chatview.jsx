// ChatView.jsx — Semantic Historian RAG chat
import { useEffect, useRef } from "react";

const FLAGS = { CHAT_BACKEND: false, SUMMARIZE_ENABLED: false };

const MOCK_RESPONSES = [
  "Based on the CO 273 documents, the 1915 Singapore Mutiny was precipitated by a combination of religious agitation among the 5th Light Infantry and wartime anxieties about deployment to fight other Muslims.",
  "The corpus reveals three recurring justifications: fear of German prisoner collusion, loyalty disputes among Indian sepoys, and administrative failures in leave management.",
  "Thematic analysis of the keyword cluster 'Labour / Migration / Health' across 47 documents suggests a systemic colonial pattern of cost-externalisation onto migrant communities.",
];

let mockIdx = 0;

export default function ChatView({ chatMessages, setChatMessages, chatTyping, setChatTyping }) {
  const inputRef = useRef();
  const endRef   = useRef();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, chatTyping]);

  const send = async () => {
    const content = inputRef.current?.value.trim();
    if (!content || chatTyping) return;
    inputRef.current.value = "";

    setChatMessages((m) => [...m, { role: "user", content }]);
    setChatTyping(true);

    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 800));

    let reply;
    if (FLAGS.CHAT_BACKEND) {
      // TODO: POST /api/chat
      reply = "Backend response here.";
    } else {
      reply = MOCK_RESPONSES[mockIdx++ % MOCK_RESPONSES.length];
    }

    setChatTyping(false);
    setChatMessages((m) => [...m, { role: "assistant", content: reply }]);
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem" }}>The Semantic Historian</h2>
        <span className="status-tag status-mock"><span className="status-dot" />MOCK DATA</span>
        <span className={`flag-pill ${FLAGS.CHAT_BACKEND ? "flag-on" : "flag-off"}`}>{FLAGS.CHAT_BACKEND ? "✓" : "⚠"} RAG_BACKEND</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-title">Corpus Interrogation</div>
          <div className="card-subtitle">RAG over CO 273 + Kratoska Index</div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
            {chatMessages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role} fade-up`}>
                <div className="chat-role">{m.role === "assistant" ? "Historian" : "Researcher"}</div>
                {m.content}
              </div>
            ))}
            {chatTyping && (
              <div className="chat-bubble assistant">
                <div className="chat-role">Historian</div>
                <div className="typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="chat-input-row">
            <textarea ref={inputRef} className="chat-input" placeholder="Ask about the corpus…" onKeyDown={handleKey} rows={2} />
            <button className="btn btn-primary" onClick={send} disabled={chatTyping}>Send</button>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">Summarization</div>
            <div className="card-subtitle">Historian-grade document summaries</div>
            <span className={`flag-pill ${FLAGS.SUMMARIZE_ENABLED ? "flag-on" : "flag-off"}`}>{FLAGS.SUMMARIZE_ENABLED ? "✓" : "⚠"} SUMMARIZE</span>
            <p style={{ fontSize: "0.75rem", color: "var(--faded)", marginTop: 12, fontStyle: "italic" }}>Enable SUMMARIZE flag to auto-generate summaries on ingestion.</p>
            <hr className="divider" />
            <button className="btn btn-ghost" style={{ width: "100%" }} disabled={!FLAGS.SUMMARIZE_ENABLED}>Summarize Active Doc</button>
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="card-title">Thematic Analysis</div>
            <div className="card-subtitle">Keyword connections</div>
            {["Colonial Administration", "Trade & Revenue", "Labour & Migration", "Public Order", "Health & Medicine"].map((t) => (
              <div key={t} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--rule)", fontSize: "0.76rem" }}>
                <span>{t}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.64rem", color: "var(--amber)" }}>{Math.floor(Math.random() * 40 + 8)} docs</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="card-title">Theme Mode</div>
            <div className="card-subtitle">Specialise on a theme</div>
            {["Public Health", "1915 Mutiny", "Opium Trade", "Labour", "Governance"].map((t) => (
              <button key={t} className="btn btn-ghost" style={{ display: "block", width: "100%", marginBottom: 6, textAlign: "left" }}>{t}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}