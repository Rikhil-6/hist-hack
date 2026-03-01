// useAppState.js
// Single source of truth for all persistent state across views.
// Import this in App.jsx — pass slices down to each view as props.

import { useState } from "react";

export function useAppState() {

  // ── OCR ────────────────────────────────────────────────────────────────────
  const [ocrFile,     setOcrFile]     = useState(null);
  const [ocrPages,    setOcrPages]    = useState([]);
  const [ocrProgress, setOcrProgress] = useState({ done: 0, total: 0 });
  const [ocrDone,     setOcrDone]     = useState(false);
  const [ocrJobId,    setOcrJobId]    = useState(null);

  // ── Index / Keyword search ─────────────────────────────────────────────────
  const [indexQuery,   setIndexQuery]   = useState("");
  const [indexResults, setIndexResults] = useState([]);
  const [indexSearched, setIndexSearched] = useState(false);
  const [indexSelected, setIndexSelected] = useState(null);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "Welcome to the Semantic Historian. I have ingested the CO 273 corpus and the Kratoska Index. Ask me anything — from archival facts to thematic analysis." }
  ]);
  const [chatTyping, setChatTyping] = useState(false);

  return {
    ocr:   { ocrFile, setOcrFile, ocrPages, setOcrPages, ocrProgress, setOcrProgress, ocrDone, setOcrDone, ocrJobId, setOcrJobId },
    index: { indexQuery, setIndexQuery, indexResults, setIndexResults, indexSearched, setIndexSearched, indexSelected, setIndexSelected },
    chat:  { chatMessages, setChatMessages, chatTyping, setChatTyping },
  };
}