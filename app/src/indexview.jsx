import { useState } from "react";

const highlightText = (text, query, mode) => {
  if (!query || !text) return text;

  // 1. Extract tokens, respecting quotes and ignoring operators
  const terms = (query.match(/("(?:\\.|[^"])*"|\S+)/g) || [])
    .map(t => t.replace(/"/g, '').trim().toLowerCase())
    .filter(t => t && !['AND', 'OR', 'NOT'].includes(t.toUpperCase()));

  if (terms.length === 0) return text;

  // 2. Escape terms for Regex safety
  const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  // 3. Construct Regex: word boundaries (\b) for exact, global for thematic
  const pattern = mode === "exact" 
    ? `\\b(${escapedTerms.join('|')})\\b` 
    : `(${escapedTerms.join('|')})`;

  const regex = new RegExp(pattern, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    // Check if the current part is one of the terms we searched for
    const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase());
    return isMatch ? <mark key={i} className="highlight-mark">{part}</mark> : part;
  });
};

export default function IndexView({ 
  indexQuery, setIndexQuery, indexResults, setIndexResults, 
  indexSearched, setIndexSearched, indexSelected, setIndexSelected 
}) {
  const [searching, setSearching] = useState(false);
  // DEFAULT SET TO EXACT
  const [searchMode, setSearchMode] = useState("exact");

  const handleSearch = async () => {
    if (!indexQuery.trim()) return;
    setSearching(true);
    setIndexSelected(null);
    try {
      const response = await fetch(`/api/index/search?q=${encodeURIComponent(indexQuery)}&mode=${searchMode}`);
      const data = await response.json();
      setIndexResults(data.status === "success" ? data.results : []);
    } catch (err) { 
      console.error("Search failed:", err); 
    } finally {
      setSearching(false);
      setIndexSearched(true);
    }
  };

  return (
    <div className="fade-up" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <style>{`
        .highlight-mark { background-color: #ffd43b; color: #000; padding: 0 2px; border-radius: 2px; font-weight: bold; }
        .match-strength-fill { height: 100%; transition: width 0.8s ease; background: #2c3e50; }
        .folio-preview-text { font-family: 'Crimson Text', serif; font-size: 1.1rem; line-height: 1.8; color: #2c3e50; white-space: pre-wrap; }
        .result-item:hover { background: #f9f9f9 !important; }
      `}</style>

      <header style={{ borderBottom: '2px solid #2c3e50', paddingBottom: '10px', marginBottom: '25px' }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", margin: 0 }}>Kratoska Digital Archive</h2>
      </header>

      {/* Mode Toggles */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 15 }}>
        <label style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: searchMode === 'exact' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: 5 }}>
          <input type="radio" checked={searchMode === "exact"} onChange={() => setSearchMode("exact")} /> Exact Match
        </label>
        <label style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: searchMode === 'thematic' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: 5 }}>
          <input type="radio" checked={searchMode === "thematic"} onChange={() => setSearchMode("thematic")} /> Thematic
        </label>
      </div>

      <div className="search-bar" style={{ display: "flex", gap: 10, marginBottom: 5 }}>
        <input 
          className="search-input" 
          value={indexQuery} 
          onChange={(e) => setIndexQuery(e.target.value)} 
          onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
          placeholder='e.g. "Straits Settlements" AND "Opium"'
          style={{ flex: 1, padding: '12px', border: '1px solid #333', borderRadius: '4px' }} 
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={searching} style={{ background: '#2c3e50', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '4px', cursor: 'pointer' }}>
          {searching ? "Consulting..." : "Consult Index"}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 30 }}>
        Supports logic: <code>AND</code>, <code>OR</code>, <code>NOT</code>. Use <code>" "</code> for exact phrases.
      </p>

      <div className="main-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 40 }}>
        <div className="results-column">
          <h4 style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: '#7f8c8d', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>Archival Matches</h4>
          {indexResults.length === 0 && indexSearched && <p style={{ color: '#999', fontSize: '0.9rem' }}>No matches found in the collection.</p>}
          {indexResults.map((r, i) => (
            <div key={i} className={`result-item ${indexSelected === i ? "selected" : ""}`} onClick={() => setIndexSelected(i)}
              style={{ padding: '20px', borderBottom: '1px solid #eee', cursor: 'pointer', background: indexSelected === i ? '#fdfdfd' : 'transparent', borderLeft: indexSelected === i ? '4px solid #2c3e50' : '4px solid transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 'bold' }}>{r.collection_ref}</span>
                <span>{Math.round(r.match_strength * 100)}% Match</span>
              </div>
              <div style={{ height: 4, background: '#eee', margin: '8px 0', overflow: 'hidden' }}>
                <div className="match-strength-fill" style={{ width: `${r.match_strength * 100}%` }} />
              </div>
              <div style={{ fontSize: '0.85rem', color: '#34495e', marginTop: 10 }}>
                {highlightText(r.extract.substring(0, 110) + "...", indexQuery, searchMode)}
              </div>
            </div>
          ))}
        </div>

        <div className="preview-column">
          <div className="card" style={{ padding: '25px', border: '1px solid #ddd', background: '#fff', position: 'sticky', top: '20px', borderRadius: '4px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontFamily: 'serif' }}>Folio {indexSelected !== null ? indexResults[indexSelected].folio_id : '---'}</h3>
            {indexSelected !== null ? (
              <div className="folio-preview-text" style={{ height: '500px', overflowY: 'auto' }}>
                {highlightText(indexResults[indexSelected].extract, indexQuery, searchMode)}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#bdc3c7', paddingTop: '100px' }}>Select an entry for consultation.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 