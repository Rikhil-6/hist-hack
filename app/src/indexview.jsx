import { useState } from "react";

const FLAGS = { INDEX_SEARCH_BACKEND: true };

// Historical Archive Thesaurus
const SYNONYMS = { 
  "thailand": "siam", 
  "siam": "thailand", 
  "ceylon": "sri lanka",
  "formosa": "taiwan",
  "burma": "myanmar"
};

/**
 * Advanced Scholarly Highlighting:
 * 1. Handles quoted phrases as single blocks.
 * 2. Ignores Boolean operators (AND/OR/NOT).
 * 3. Maps modern search terms to historical archival text.
 */
const highlightText = (text, query, mode) => {
  if (!query || !text) return text;

  // Extract tokens: matches words or "quoted phrases"
  const rawTerms = (query.match(/("(?:\\.|[^"])*"|\S+)/g) || [])
    .map(t => t.replace(/"/g, '').toLowerCase())
    .filter(t => t && !['AND', 'OR', 'NOT'].includes(t.toUpperCase()));

  if (rawTerms.length === 0) return text;

  // Expand the highlight list with synonyms
  const allHighlightTerms = [...rawTerms];
  rawTerms.forEach(t => {
    if (SYNONYMS[t]) allHighlightTerms.push(SYNONYMS[t]);
  });

  // Escape special characters for Regex
  const escapedTerms = allHighlightTerms.map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  
  // Use word boundaries for exact mode, global search for thematic
  const pattern = mode === "exact" 
    ? `\\b(${escapedTerms.join('|')})\\b` 
    : `(${escapedTerms.join('|')})`;

  const parts = text.split(new RegExp(pattern, "gi"));

  return parts.map((part, i) => {
    const isMatch = allHighlightTerms.some(t => t.toLowerCase() === part.toLowerCase());
    return isMatch ? (
      <mark key={i} className="highlight-mark">{part}</mark>
    ) : (
      part
    );
  });
};

export default function IndexView({ 
  indexQuery, setIndexQuery, indexResults, setIndexResults, 
  indexSearched, setIndexSearched, indexSelected, setIndexSelected 
}) {
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState("thematic"); // Default to thematic for fluidity

  const handleSearch = async () => {
    if (!indexQuery.trim()) return;
    setSearching(true);
    setIndexSelected(null);

    try {
      const url = `/api/index/search?q=${encodeURIComponent(indexQuery)}&mode=${searchMode}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === "success") {
        setIndexResults(data.results);
      } else {
        setIndexResults([]);
      }
    } catch (err) {
      console.error("Archive connection error:", err);
      setIndexResults([]);
    }
    
    setSearching(false);
    setIndexSearched(true);
  };

  return (
    <div className="fade-up" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <style>{`
        .highlight-mark { 
          background-color: #ffd43b; 
          color: #000; 
          padding: 0 2px; 
          border-radius: 2px; 
          font-weight: bold; 
        }
        .match-strength-bar { 
          height: 6px; 
          background: #eee; 
          border-radius: 3px; 
          margin: 8px 0; 
          overflow: hidden; 
        }
        .match-strength-fill { 
          height: 100%; 
          background: #2c3e50;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        .result-item.selected {
          border-left: 4px solid #2c3e50 !important;
          background: #fdfdfd !important;
        }
        .search-input:focus {
          border-color: #2c3e50 !important;
          outline: none;
        }
      `}</style>

      <header style={{ marginBottom: 30, borderBottom: '2px solid #2c3e50', paddingBottom: '10px' }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", margin: 0, color: '#2c3e50' }}>
          Kratoska Digital Archive
        </h2>
      </header>

      {/* Research Mode Selection */}
      <div style={{ display: 'flex', gap: 25, marginBottom: 15 }}>
        <label style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: searchMode === 'exact' ? 'bold' : 'normal' }}>
          <input 
            type="radio" 
            checked={searchMode === "exact"} 
            onChange={() => setSearchMode("exact")} 
          /> Exact Word Search
        </label>
        <label style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: searchMode === 'thematic' ? 'bold' : 'normal' }}>
          <input 
            type="radio" 
            checked={searchMode === "thematic"} 
            onChange={() => setSearchMode("thematic")} 
          /> Thematic Search (ML Powered)
        </label>
      </div>

      <div className="search-bar" style={{ display: "flex", gap: 10, marginBottom: 5 }}>
        <input
          className="search-input"
          placeholder={searchMode === 'exact' ? "Consult exact entry..." : 'e.g. "Siam" AND "India"'}
          value={indexQuery}
          onChange={(e) => setIndexQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ flex: 1, padding: '14px', borderRadius: '4px', border: '1px solid #333', fontSize: '1rem' }}
        />
        <button 
          className="btn btn-primary" 
          onClick={handleSearch} 
          disabled={searching} 
          style={{ padding: '0 30px', backgroundColor: '#2c3e50', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
        >
          {searching ? "Consulting..." : "Search Index"}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 30 }}>
        Thematic search supports Boolean logic and modern place-name synonyms.
      </p>

      <div className="main-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 40 }}>
        {/* Archival Results Column */}
        <div className="results-column">
          <h4 style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px', color: '#7f8c8d', marginBottom: '15px' }}>
            Archival Matches
          </h4>
          {indexResults.length === 0 && indexSearched && (
            <p style={{ color: '#999', fontSize: '0.9rem' }}>No matching folios found in the Card Catalog.</p>
          )}
          {indexResults.map((r, i) => (
            <div 
              key={i} 
              className={`result-item ${indexSelected === i ? "selected" : ""}`} 
              onClick={() => setIndexSelected(i)}
              style={{ 
                padding: '20px', 
                borderBottom: '1px solid #eee', 
                cursor: 'pointer', 
                borderLeft: '4px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{r.collection_ref}</span>
                <span style={{ fontSize: '0.7rem', color: '#95a5a6' }}>{Math.round(r.match_strength * 100)}% Semantic Match</span>
              </div>
              
              <div className="match-strength-bar">
                <div className="match-strength-fill" style={{ width: `${r.match_strength * 100}%` }} />
              </div>

              <div style={{ fontSize: '0.85rem', color: '#34495e', marginTop: 10, lineHeight: '1.5' }}>
                {highlightText(r.extract.substring(0, 110) + "...", indexQuery, searchMode)}
              </div>
            </div>
          ))}
        </div>

        {/* Folio Preview Pane */}
        <div className="preview-column">
          <div className="card" style={{ padding: '25px', border: '1px solid #ddd', background: '#fff', borderRadius: '4px', position: 'sticky', top: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontFamily: 'serif', color: '#2c3e50' }}>
                Folio {indexSelected !== null ? indexResults[indexSelected].folio_id : '---'}
              </h3>
            </div>
            {indexSelected !== null ? (
              <div style={{ 
                height: '500px', 
                overflowY: 'auto', 
                whiteSpace: 'pre-wrap', 
                fontFamily: 'serif', 
                lineHeight: '1.8', 
                fontSize: '1.1rem', 
                color: '#2c3e50',
                paddingRight: '10px'
              }}>
                {highlightText(indexResults[indexSelected].extract, indexQuery, searchMode)}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#bdc3c7', paddingTop: '100px', fontFamily: 'serif' }}>
                Select an entry to examine the archival transcription.
              </div>
            )}
            {indexSelected !== null && (
               <button 
                 className="btn btn-secondary" 
                 style={{ width: '100%', marginTop: '20px', padding: '12px', border: '1px solid #2c3e50', background: 'transparent', color: '#2c3e50', cursor: 'pointer', fontWeight: 'bold' }}
               >
                 View Original Manuscript
               </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}