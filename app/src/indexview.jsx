// IndexView.jsx — Kratoska keyword index search
import { useState } from "react";

const FLAGS = { INDEX_SEARCH_BACKEND: false };

const MOCK_SEARCH_RESULTS = [
  { keyword: "Opium", page: 142, co273File: "CO273_0142.tif", description: "References to opium trade regulations in the Straits Settlements, 1910–1920.", confidence: 0.94, relatedKeywords: ["Narcotics", "Trade", "Revenue"] },
  { keyword: "Opium", page: 207, co273File: "CO273_0207.tif", description: "Opium farm licensing disputes and colonial revenue reports.", confidence: 0.88, relatedKeywords: ["Revenue", "Licensing", "Colonial Policy"] },
  { keyword: "Opium", page: 318, co273File: "CO273_0318.tif", description: "Medical and social commentary on opium use among migrant labourers.", confidence: 0.76, relatedKeywords: ["Labour", "Health", "Migration"] },
];

export default function IndexView({ indexQuery, setIndexQuery, indexResults, setIndexResults, indexSearched, setIndexSearched, indexSelected, setIndexSelected }) {
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!indexQuery.trim()) return;
    setSearching(true);
    setIndexSelected(null);
    await new Promise((r) => setTimeout(r, 1100));
    if (FLAGS.INDEX_SEARCH_BACKEND) {
      // TODO: GET /api/index/search?q=indexQuery
    } else {
      setIndexResults(MOCK_SEARCH_RESULTS);
    }
    setSearching(false);
    setIndexSearched(true);
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.4rem" }}>Kratoska Index — Search</h2>
        <span className={`status-tag status-mock`}><span className="status-dot" />MOCK DATA</span>
        <span className={`flag-pill ${FLAGS.INDEX_SEARCH_BACKEND ? "flag-on" : "flag-off"}`}>
          {FLAGS.INDEX_SEARCH_BACKEND ? "✓" : "⚠"} SEARCH_BACKEND
        </span>
      </div>

      <div className="search-bar">
        <input
          className="search-input"
          placeholder="Search keyword (e.g. 'Opium', '1915 Mutiny', 'Revenue')"
          value={indexQuery}
          onChange={(e) => setIndexQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
          {searching ? <span className="spinner" /> : "Search Index"}
        </button>
      </div>

      <div className="two-col">
        <div>
          {indexSearched && !searching && (
            <div style={{ fontSize: "0.72rem", color: "var(--faded)", marginBottom: 12, fontFamily: "'JetBrains Mono',monospace" }}>
              {indexResults.length} result{indexResults.length !== 1 ? "s" : ""} for "{indexQuery}"
            </div>
          )}
          {searching && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div className="spinner" style={{ width: 28, height: 28, margin: "0 auto 12px" }} />
              <div style={{ fontSize: "0.78rem", color: "var(--faded)" }}>Querying Kratoska Index…</div>
            </div>
          )}
          {!searching && indexResults.map((r, i) => (
            <div key={i} className={`result-item ${indexSelected === i ? "selected" : ""}`} onClick={() => setIndexSelected(i)}>
              <div className="result-header">
                <span className="result-keyword">{r.keyword}</span>
                <span className="result-page">p. {r.page}</span>
              </div>
              <div className="result-desc">{r.description}</div>
              <div className="result-file">↗ {r.co273File}</div>
              <div className="tag-list">{r.relatedKeywords.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
              <div className="confidence-bar"><div className="confidence-fill" style={{ width: `${r.confidence * 100}%` }} /></div>
            </div>
          ))}
          {indexSearched && !searching && indexResults.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--faded)" }}>No results found.</div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="card-title">Document Preview</div>
            <div className="card-subtitle">CO 273 Source Image</div>
            {indexSelected === null ? (
              <div className="image-panel">
                <div className="image-placeholder">📋</div>
                <div className="image-label">Select a result to preview</div>
              </div>
            ) : (
              <>
                <div className="meta-row">
                  <div className="meta-item"><span className="meta-label">File:</span> {indexResults[indexSelected].co273File}</div>
                  <div className="meta-item"><span className="meta-label">Page:</span> {indexResults[indexSelected].page}</div>
                </div>
                <div className="image-panel">
                  <div className="image-placeholder" style={{ fontSize: "4rem" }}>🗂</div>
                  <div className="image-label">{indexResults[indexSelected].co273File}</div>
                  <div style={{ fontSize: "0.68rem", color: "#4a3f2a" }}>[Image loads from Cloud Storage in production]</div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "0.9rem", marginBottom: 6 }}>{indexResults[indexSelected].description}</div>
                  <div className="tag-list">{indexResults[indexSelected].relatedKeywords.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
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