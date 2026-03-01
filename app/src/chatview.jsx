// ChatView.jsx — Semantic Historian RAG chat
import { useEffect, useRef } from "react";

// Set to true to use the new FastAPI RAG router
const FLAGS = { CHAT_BACKEND: true, SUMMARIZE_ENABLED: false };

export default function ChatView({ chatMessages, setChatMessages, chatTyping, setChatTyping }) {
  const inputRef = useRef();
  const endRef = useRef();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, chatTyping]);

  const send = async () => {
    const content = inputRef.current?.value.trim();
    if (!content || chatTyping) return;
    inputRef.current.value = "";

    setChatMessages((m) => [...m, { role: "user", content }]);
    setChatTyping(true);

    try {
      if (FLAGS.CHAT_BACKEND) {
        // Hit the live FastAPI RAG endpoint
        const response = await fetch("http://localhost:8000/api/rag/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: content }),
        });

        if (!response.ok) throw new Error("Backend connection failed");

        const data = await response.json();

        setChatMessages((m) => [
          ...m,
          { 
            role: "assistant", 
            content: data.reply,
            citations: data.citations // Store the page-wise evidence
          }
        ]);
      } else {
        // Mock fallback logic
        await new Promise((r) => setTimeout(r, 1000));
        setChatMessages((m) => [...m, { role: "assistant", content: "Switch RAG_BACKEND on to query the live archive." }]);
      }
    } catch (err) {
      setChatMessages((m) => [...m, { role: "assistant", content: `System Error: ${err.message}` }]);
    } finally {
      setChatTyping(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem" }}>The Semantic Historian</h2>
        <span className={`status-tag ${FLAGS.CHAT_BACKEND ? "status-live" : "status-mock"}`}>
          <span className="status-dot" />{FLAGS.CHAT_BACKEND ? "LIVE DATA" : "MOCK DATA"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div className="card-title">Corpus Interrogation</div>
          <div className="card-subtitle">RAG over CO 273 OCR Results</div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
            {chatMessages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role} fade-up`}>
                <div className="chat-role">{m.role === "assistant" ? "Historian" : "Researcher"}</div>
                
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>

                {/* Evidence Tray: Render citations if they exist */}
                {m.citations && m.citations.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid var(--rule)" }}>
                    <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--faded)", marginBottom: 4 }}>Archival Evidence:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {m.citations.map((cite, idx) => (
                        <a 
                          key={idx} 
                          href={cite.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="status-tag" 
                          style={{ fontSize: "0.6rem", textDecoration: "none", cursor: "pointer", background: "rgba(255,255,255,0.05)" }}
                        >
                          📄 {cite.doc} (Pg {cite.page})
                        </a>
                      ))}
                    </div>
                  </div>
                )}
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

        {/* Sidebar remains untouched for Thematic Analysis and Modes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <div className="card-title">Summarization</div>
            <span className={`flag-pill ${FLAGS.SUMMARIZE_ENABLED ? "flag-on" : "flag-off"}`}>{FLAGS.SUMMARIZE_ENABLED ? "✓" : "⚠"} SUMMARIZE</span>
            <hr className="divider" />
            <button className="btn btn-ghost" style={{ width: "100%" }} disabled={!FLAGS.SUMMARIZE_ENABLED}>Summarize Active Doc</button>
          </div>
        </div>
      </div>
    </div>
  );
}