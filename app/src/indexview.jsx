import { useState } from "react";

// Set this to true to use the GCS backend
const FLAGS = { INDEX_SEARCH_BACKEND: true };

export default function IndexView({ 
  indexQuery, setIndexQuery, 
  indexResults, setIndexResults, 
  indexSearched, setIndexSearched, 
  indexSelected, setIndexSelected 
}) {
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!indexQuery.trim()) return;
    setSearching(true);
    setIndexSelected(null);

    if (FLAGS.INDEX_SEARCH_BACKEND) {
      try {
        const response = await fetch(`/api/index/search?q=${encodeURIComponent(indexQuery)}&mode=fuzzy`);
        const data = await response.json();
        
        if (data.status === "success") {
          setIndexResults(data.results);
        } else {
          setIndexResults([]);
        }
      } catch (err) {
        console.error("Connection error:", err);
        setIndexResults([]);
      }
    } else {
      // Mock Fallback for local testing
      await new Promise((r) => setTimeout(r, 600));
      setIndexResults([
        { keyword: "Opium", page: 142, co273File: "CO273_0142.tif", description: "Mock result...", confidence: 0.94, relatedKeywords: ["Trade"] }
      ]);
    }
    
    setSearching(false);
    setIndexSearched(true);
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem" }}>Kratoska Index — Search</h2>
        <span className={`status-tag ${FLAGS.INDEX_SEARCH_BACKEND ? 'status-live' : 'status-mock'}`}>
          <span className="status-dot" />
          {FLAGS.INDEX_SEARCH_BACKEND ? "GCS LIVE" : "MOCK"}
        </span>
      </div>

      <div className="search-bar" style={{ display: "flex", gap: 8 }}>
        <input
          className="search-input"
          placeholder="Search keywords (e.g. 'Revenue')..."
          value={indexQuery}
          onChange={(e) => setIndexQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
          {searching ? "..." : "Search"}
        </button>
      </div>

      <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        {/* Results List */}
        <div className="results-column">
          {indexResults.map((r, i) => (
            <div 
              key={i} 
              className={`result-item ${indexSelected === i ? "selected" : ""}`} 
              onClick={() => setIndexSelected(i)}
              style={{ padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer', background: indexSelected === i ? '#f0f7ff' : 'transparent' }}
            >
              <div style={{ fontWeight: 'bold' }}>{r.keyword} <span style={{ float: 'right', color: '#666' }}>p. {r.page}</span></div>
              <div style={{ fontSize: '0.85rem', color: '#444' }}>{r.description}</div>
            </div>
          ))}
        </div>

        {/* Preview Pane */}
        <div className="preview-column">
          <div className="card" style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
            <div className="card-title" style={{ fontWeight: 'bold', marginBottom: 10 }}>Document Preview</div>
            {indexSelected !== null ? (
              <div>
                <div style={{ fontSize: '0.9rem' }}><strong>File:</strong> {indexResults[indexSelected].co273File}</div>
                <div style={{ height: '200px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0' }}>
                   {/* This is where the GCS image would load */}
                   <span style={{ fontSize: '3rem' }}>📄</span>
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }}>Open Full Viewer</button>
              </div>
            ) : (
              <div style={{ color: '#999', textAlign: 'center' }}>Select a result to view</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}