import { useState, useEffect, useRef } from "react";

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  navy:     "#0D1F3C",
  navyMid:  "#1B3461",
  teal:     "#0E9E72",
  tealLt:   "#D1F5E8",
  amber:    "#E8951A",
  amberLt:  "#FEF3D0",
  red:      "#C94A2B",
  redLt:    "#FCEAE5",
  slate:    "#4A5568",
  slateXlt: "#F7F9FC",
  border:   "#DDE4EF",
  white:    "#FFFFFF",
};

// ── localStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = "property-tracker-v1";

function loadProperties() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProperties(props) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(props)); } catch {}
}

// ── Claude API ───────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert Australian property analyst helping a first home buyer in Victoria.

BUYER PROFILE:
- Budget: $950k–$1.15M (ideally under $1.05M)
- Cash available: ~$240k (after stamp duty ~$182k–$190k left as deposit)
- Monthly budget: $7,500 total (mortgage + all costs)
- Savings rate: $7,500/month, currently saving toward Q1 2027
- Goal: buy in Q1 2027 but open to a great deal sooner
- Mortgage rate assumption: 6.8%

NON-NEGOTIABLES (dealbreakers if missing):
1. 3 bed 2 bath minimum
2. 30–35 min drive from Melbourne CBD (weekend)
3. 45–50 min public transport to work (weekday 8am)
4. Nearby public transport
5. Backyard or courtyard
6. Park within ~500m
7. Gym + pilates studio nearby
8. Central heating and cooling
9. Natural lighting

NICE TO HAVE:
- Walk-in robe with ensuite
- Front yard
- Outdoor entertaining / patio / deck
- Quality daycare nearby
- Cafes and eateries walkable

Analyse the listing and respond ONLY with valid JSON (no markdown, no preamble, no backticks):
{
  "address": "full street address",
  "price": "price or range as string",
  "suburb": "suburb name",
  "type": "House / Townhouse / Apartment / Unit",
  "bedrooms": number,
  "bathrooms": number,
  "parking": number,
  "landSize": "land size string or null",
  "score": number 1-10,
  "verdict": "BUY / WATCH / PASS",
  "pros": ["pro 1", "pro 2", "pro 3"],
  "cons": ["con 1", "con 2"],
  "nonNegotiables": {
    "beds_baths": true or false,
    "cbd_drive": true or false,
    "public_transport": true or false,
    "pt_nearby": true or false,
    "backyard": true or false,
    "park_nearby": true or false,
    "gym_pilates": true or false,
    "heating_cooling": true or false,
    "natural_light": true or false
  },
  "estimatedLoan": number,
  "estimatedMonthly": number,
  "growthOutlook": "Strong / Moderate / Weak",
  "summary": "2-3 sentence sharp analysis for this buyer",
  "redFlags": ["flag 1"] or []
}`;

async function analyseWithClaude(text) {
  const apiKey = localStorage.getItem("claude-api-key");
  if (!apiKey) throw new Error("NO_API_KEY");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "interleaved-thinking-2025-05-14",
      "anthropic-dangerous-direct-browser-calls": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Analyse this property listing:\n\n${text}` }],
    }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const raw = data.content?.map(b => b.text || "").join("") || "{}";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── Small UI components ──────────────────────────────────────────────────────
const Badge = ({ color, children }) => {
  const map = {
    teal:  { bg: T.tealLt,  text: T.teal },
    amber: { bg: T.amberLt, text: T.amber },
    red:   { bg: T.redLt,   text: T.red },
    navy:  { bg: "#E8EDF5", text: T.navyMid },
  };
  const s = map[color] || map.navy;
  return (
    <span style={{
      background: s.bg, color: s.text, fontSize: 11, fontWeight: 700,
      letterSpacing: "0.05em", padding: "3px 9px", borderRadius: 20,
      display: "inline-block", textTransform: "uppercase",
    }}>{children}</span>
  );
};

const ScoreDial = ({ score }) => {
  const color = score >= 7 ? T.teal : score >= 5 ? T.amber : T.red;
  return (
    <div style={{
      width: 56, height: 56, borderRadius: "50%",
      border: `3px solid ${color}`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
      <span style={{ fontSize: 9, color: T.slate, letterSpacing: "0.05em" }}>/10</span>
    </div>
  );
};

const Pill = ({ label, value, color }) => (
  <div style={{
    background: T.slateXlt, borderRadius: 8, padding: "6px 10px",
    display: "flex", flexDirection: "column", gap: 2, minWidth: 70,
  }}>
    <span style={{ fontSize: 10, color: T.slate, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 700, color: color || T.navy }}>{value || "—"}</span>
  </div>
);

const NNRow = ({ label, passed }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 0", borderBottom: `1px solid ${T.border}`,
    fontSize: 12,
  }}>
    <span style={{ fontSize: 15 }}>{passed ? "✅" : "❌"}</span>
    <span style={{ color: passed ? T.navy : T.red, flex: 1 }}>{label}</span>
  </div>
);

// ── Property card ────────────────────────────────────────────────────────────
const PropertyCard = ({ prop, onDelete, onToggleMissed }) => {
  const [expanded, setExpanded] = useState(false);
  const verdictColor = prop.verdict === "BUY" ? "teal" : prop.verdict === "WATCH" ? "amber" : "red";
  const fmt = n => n ? `$${Math.round(n).toLocaleString()}` : "—";

  const nnLabels = {
    beds_baths: "3 bed / 2 bath",
    cbd_drive: "30–35 min drive to CBD",
    public_transport: "45–50 min PT to work",
    pt_nearby: "Nearby public transport",
    backyard: "Backyard / courtyard",
    park_nearby: "Park within 500m",
    gym_pilates: "Gym + pilates nearby",
    heating_cooling: "Central heating/cooling",
    natural_light: "Natural lighting",
  };

  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`,
      borderRadius: 14, overflow: "hidden",
      boxShadow: "0 2px 12px rgba(13,31,60,0.06)",
      transition: "box-shadow 0.2s",
    }}>
      {/* Header */}
      <div style={{
        background: prop.missed
          ? "linear-gradient(135deg,#2D1810,#5C2D1A)"
          : `linear-gradient(135deg,${T.navy},${T.navyMid})`,
        padding: "14px 16px",
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <ScoreDial score={prop.score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
            <Badge color={verdictColor}>{prop.verdict}</Badge>
            {prop.missed && <Badge color="amber">Missed</Badge>}
            <Badge color="navy">{prop.type}</Badge>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.white, lineHeight: 1.3 }}>
            {prop.address}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
            {prop.price} · {prop.suburb}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onToggleMissed(prop.id)}
            title={prop.missed ? "Mark active" : "Mark as missed"}
            style={{
              background: "rgba(255,255,255,0.12)", border: "none",
              color: T.white, width: 32, height: 32, borderRadius: 8,
              cursor: "pointer", fontSize: 15,
            }}>{prop.missed ? "🔄" : "❌"}</button>
          <button onClick={() => onDelete(prop.id)} title="Delete"
            style={{
              background: "rgba(255,255,255,0.12)", border: "none",
              color: T.white, width: 32, height: 32, borderRadius: 8,
              cursor: "pointer", fontSize: 15,
            }}>🗑</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        padding: "12px 16px", display: "flex", gap: 8,
        flexWrap: "wrap", borderBottom: `1px solid ${T.border}`,
      }}>
        <Pill label="Beds" value={prop.bedrooms ? `${prop.bedrooms} 🛏` : null} />
        <Pill label="Baths" value={prop.bathrooms ? `${prop.bathrooms} 🚿` : null} />
        <Pill label="Parking" value={prop.parking ? `${prop.parking} 🚗` : null} />
        {prop.landSize && <Pill label="Land" value={prop.landSize} />}
        <Pill label="Growth" value={prop.growthOutlook}
          color={prop.growthOutlook === "Strong" ? T.teal : prop.growthOutlook === "Moderate" ? T.amber : T.red} />
        <Pill label="Est. monthly" value={fmt(prop.estimatedMonthly)} color={T.navyMid} />
      </div>

      {/* Summary */}
      <div style={{ padding: "12px 16px" }}>
        <p style={{ fontSize: 13, color: T.slate, lineHeight: 1.6, margin: 0 }}>{prop.summary}</p>
      </div>

      {/* Expand */}
      <button onClick={() => setExpanded(!expanded)} style={{
        width: "100%", background: T.slateXlt, border: "none",
        borderTop: `1px solid ${T.border}`, padding: "8px",
        cursor: "pointer", fontSize: 12, color: T.slate, fontWeight: 600,
      }}>
        {expanded ? "▲ Hide details" : "▼ Show non-negotiables, pros & cons"}
      </button>

      {expanded && (
        <div style={{ padding: "14px 16px" }}>
          {/* Non-negotiables */}
          {prop.nonNegotiables && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: T.navyMid,
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8,
              }}>Non-negotiables</div>
              {Object.entries(prop.nonNegotiables).map(([key, val]) => (
                <NNRow key={key} label={nnLabels[key] || key} passed={val} />
              ))}
            </div>
          )}

          {/* Pros & Cons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Pros</div>
              {(prop.pros || []).map((p, i) => (
                <div key={i} style={{ fontSize: 12, color: T.slate, marginBottom: 5, display: "flex", gap: 5 }}>
                  <span style={{ color: T.teal, flexShrink: 0 }}>✓</span>{p}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Cons</div>
              {(prop.cons || []).map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: T.slate, marginBottom: 5, display: "flex", gap: 5 }}>
                  <span style={{ color: T.red, flexShrink: 0 }}>✗</span>{c}
                </div>
              ))}
            </div>
          </div>

          {/* Red flags */}
          {prop.redFlags?.length > 0 && (
            <div style={{ background: T.redLt, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>⚠ Red Flags</div>
              {prop.redFlags.map((f, i) => (
                <div key={i} style={{ fontSize: 12, color: T.red, marginBottom: 3 }}>• {f}</div>
              ))}
            </div>
          )}

          {/* Notes */}
          {prop.notes && (
            <div style={{ background: T.amberLt, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.amber, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Your notes</div>
              <div style={{ fontSize: 12, color: T.slate }}>{prop.notes}</div>
            </div>
          )}

          <div style={{ fontSize: 11, color: T.border }}>
            Added {new Date(prop.addedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── API Key Setup screen ─────────────────────────────────────────────────────
const ApiKeySetup = ({ onSave }) => {
  const [key, setKey] = useState("");
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: T.slateXlt, padding: 24,
    }}>
      <div style={{
        background: T.white, borderRadius: 16, padding: 32,
        maxWidth: 480, width: "100%", border: `1px solid ${T.border}`,
        boxShadow: "0 8px 32px rgba(13,31,60,0.1)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.navy, marginBottom: 8 }}>
          Property Tracker
        </div>
        <div style={{ fontSize: 14, color: T.slate, lineHeight: 1.6, marginBottom: 24 }}>
          To analyse listings with AI, you need a free Anthropic API key.
          Your key is stored only in your browser — never sent anywhere except Anthropic.
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.navy, marginBottom: 6 }}>
            Your Anthropic API Key
          </div>
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="sk-ant-..."
            style={{
              width: "100%", padding: "12px 14px",
              border: `1px solid ${T.border}`, borderRadius: 10,
              fontSize: 14, color: T.navy, fontFamily: "'DM Mono', monospace",
              outline: "none",
            }}
          />
        </div>

        <div style={{ background: T.amberLt, borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: T.slate, lineHeight: 1.6 }}>
          <b style={{ fontWeight: 600 }}>How to get your API key:</b><br/>
          1. Go to <b>console.anthropic.com</b><br/>
          2. Sign up free → Settings → API Keys<br/>
          3. Create a new key and paste it above
        </div>

        <button
          onClick={() => { if (key.trim()) { localStorage.setItem("claude-api-key", key.trim()); onSave(); } }}
          disabled={!key.trim()}
          style={{
            width: "100%", background: key.trim() ? T.teal : T.border,
            color: T.white, border: "none", padding: "13px",
            borderRadius: 10, cursor: key.trim() ? "pointer" : "not-allowed",
            fontWeight: 700, fontSize: 15,
          }}
        >Save & Start Tracking</button>

        <div style={{ fontSize: 11, color: T.slate, textAlign: "center", marginTop: 12 }}>
          You can also use the app without a key — just add properties manually
        </div>
        <button onClick={onSave} style={{
          width: "100%", background: "transparent", border: `1px solid ${T.border}`,
          color: T.slate, padding: "10px", borderRadius: 10,
          cursor: "pointer", fontSize: 13, marginTop: 8,
        }}>Skip for now — use manual mode</button>
      </div>
    </div>
  );
};

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [properties, setProperties]   = useState([]);
  const [tab, setTab]                 = useState("tracker");
  const [filter, setFilter]           = useState("all");
  const [sortBy, setSortBy]           = useState("score");
  const [listingText, setListingText] = useState("");
  const [notes, setNotes]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [ready, setReady]             = useState(false);
  const [showKeySetup, setShowKeySetup] = useState(false);
  const hasKey = !!localStorage.getItem("claude-api-key");

  useEffect(() => {
    const stored = loadProperties();
    setProperties(stored);
    if (!localStorage.getItem("claude-api-key") && stored.length === 0) {
      setShowKeySetup(true);
    }
    setReady(true);
  }, []);

  useEffect(() => { if (ready) saveProperties(properties); }, [properties, ready]);

  const handleAnalyse = async () => {
    if (!listingText.trim()) return;
    setLoading(true); setError("");
    try {
      const result = await analyseWithClaude(listingText);
      const newProp = {
        ...result,
        id: Date.now(),
        notes: notes.trim(),
        missed: false,
        addedAt: new Date().toISOString(),
      };
      setProperties(prev => [newProp, ...prev]);
      setListingText(""); setNotes("");
      setTab("tracker");
    } catch(e) {
      if (e.message === "NO_API_KEY") {
        setError("No API key set. Go to Settings to add your Anthropic API key.");
      } else {
        setError("Analysis failed. Make sure you paste enough listing details.");
      }
    }
    setLoading(false);
  };

  const handleDelete       = id => setProperties(prev => prev.filter(p => p.id !== id));
  const handleToggleMissed = id => setProperties(prev => prev.map(p => p.id === id ? { ...p, missed: !p.missed } : p));

  const filtered = properties
    .filter(p => filter === "all" ? true : filter === "missed" ? p.missed : !p.missed)
    .sort((a, b) =>
      sortBy === "score" ? b.score - a.score :
      sortBy === "date"  ? new Date(b.addedAt) - new Date(a.addedAt) :
      (parseFloat(String(a.price).replace(/[^0-9]/g,"")) - parseFloat(String(b.price).replace(/[^0-9]/g,"")))
    );

  const missed   = properties.filter(p => p.missed);
  const active   = properties.filter(p => !p.missed);
  const avgScore = properties.length ? (properties.reduce((s,p) => s + (p.score||0), 0) / properties.length).toFixed(1) : "—";
  const buys     = properties.filter(p => p.verdict === "BUY").length;

  if (showKeySetup) return <ApiKeySetup onSave={() => setShowKeySetup(false)} />;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: T.slateXlt, minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 100%)`,
        padding: "20px 20px 0", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, background: T.teal, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>🏠</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.white }}>Property Tracker</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Victoria · First Home Buyer · Q1 2027</div>
            </div>
            {/* Stats */}
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { label: "Tracked", val: properties.length },
                { label: "Buy picks", val: buys },
                { label: "Missed", val: missed.length },
                { label: "Avg score", val: avgScore },
              ].map(({ label, val }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.white }}>{val}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {[
              { id: "tracker", label: "🏡 Properties" },
              { id: "add",     label: "＋ Analyse Listing" },
              { id: "compare", label: "📊 Compare" },
              { id: "settings",label: "⚙ Settings" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab === t.id ? T.white : "transparent",
                color: tab === t.id ? T.navy : "rgba(255,255,255,0.65)",
                border: "none", padding: "10px 16px", borderRadius: "8px 8px 0 0",
                cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>

        {/* TRACKER TAB */}
        {tab === "tracker" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", background: T.white, borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                {[["all","All"], ["active","Active"], ["missed","Missed ❌"]].map(([val, lbl]) => (
                  <button key={val} onClick={() => setFilter(val)} style={{
                    padding: "7px 14px", border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    background: filter === val ? T.navy : "transparent",
                    color: filter === val ? T.white : T.slate,
                  }}>{lbl}</button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <span style={{ fontSize: 12, color: T.slate }}>Sort:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                  border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px",
                  fontSize: 12, color: T.navy, background: T.white, cursor: "pointer",
                }}>
                  <option value="score">Score</option>
                  <option value="date">Date added</option>
                  <option value="price">Price</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 20px",
                background: T.white, borderRadius: 14, border: `2px dashed ${T.border}`,
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.navy, marginBottom: 6 }}>No properties yet</div>
                <div style={{ fontSize: 13, color: T.slate, marginBottom: 20 }}>
                  Paste a listing from realestate.com.au or Domain and Claude will analyse it for you
                </div>
                <button onClick={() => setTab("add")} style={{
                  background: T.teal, color: T.white, border: "none",
                  padding: "11px 24px", borderRadius: 8, cursor: "pointer",
                  fontWeight: 700, fontSize: 14,
                }}>Analyse your first listing →</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.map(p => (
                  <PropertyCard key={p.id} prop={p}
                    onDelete={handleDelete} onToggleMissed={handleToggleMissed} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD TAB */}
        {tab === "add" && (
          <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.navy, marginBottom: 4 }}>Analyse a listing</div>
            <div style={{ fontSize: 13, color: T.slate, marginBottom: 20, lineHeight: 1.6 }}>
              Copy the full listing text from realestate.com.au or Domain — address, price, description, features.
              Claude scores it against your 9 non-negotiables automatically.
            </div>

            {!hasKey && (
              <div style={{ background: T.amberLt, borderRadius: 10, padding: "12px 16px", marginBottom: 16, border: `1px solid ${T.amber}33` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.amber, marginBottom: 4 }}>⚠ No API key set</div>
                <div style={{ fontSize: 12, color: T.slate }}>
                  Go to <b>Settings</b> to add your Anthropic API key to enable AI analysis.
                  Or you can still add properties manually.
                </div>
              </div>
            )}

            <div style={{ background: T.amberLt, borderRadius: 10, padding: "12px 16px", marginBottom: 20, border: `1px solid ${T.amber}22` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.amber, marginBottom: 6 }}>💡 Pro tip for best results</div>
              <div style={{ fontSize: 12, color: T.slate, lineHeight: 1.7 }}>
                Copy everything from the listing: address, price guide, full description, beds/baths, land size, features list, suburb stats, nearby schools. More detail = better analysis.
              </div>
            </div>

            <textarea
              value={listingText}
              onChange={e => setListingText(e.target.value)}
              placeholder="Paste full listing here — address, price, description, features, land size..."
              style={{
                width: "100%", minHeight: 220, padding: 14,
                border: `1px solid ${T.border}`, borderRadius: 10,
                fontSize: 13, color: T.navy, lineHeight: 1.6,
                resize: "vertical", fontFamily: "inherit", outline: "none",
              }}
            />

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.navy, marginBottom: 6 }}>Your notes (optional)</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Loved the street. Felt small inside. Agent mentioned another offer..."
                style={{
                  width: "100%", minHeight: 80, padding: 14,
                  border: `1px solid ${T.border}`, borderRadius: 10,
                  fontSize: 13, color: T.navy, lineHeight: 1.6,
                  resize: "vertical", fontFamily: "inherit", outline: "none",
                }}
              />
            </div>

            {error && (
              <div style={{ background: T.redLt, color: T.red, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginTop: 12 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyse}
              disabled={loading || !listingText.trim()}
              style={{
                marginTop: 16, width: "100%",
                background: loading || !listingText.trim() ? T.border : T.teal,
                color: T.white, border: "none", padding: "13px",
                borderRadius: 10, cursor: loading || !listingText.trim() ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: 15, transition: "background 0.2s",
              }}
            >
              {loading ? "⏳ Analysing with Claude..." : "🔍 Analyse this property"}
            </button>
          </div>
        )}

        {/* COMPARE TAB */}
        {tab === "compare" && (
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.navy, marginBottom: 16 }}>
              Comparison — {properties.length} properties tracked
            </div>

            {properties.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, background: T.white, borderRadius: 14, border: `1px dashed ${T.border}` }}>
                <div style={{ fontSize: 13, color: T.slate }}>Add some properties first to compare them here</div>
              </div>
            ) : (
              <>
                {/* Leaderboard */}
                <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: 20, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.navy, marginBottom: 14 }}>📈 Score leaderboard</div>
                  {[...properties].sort((a,b) => b.score - a.score).map((p, i) => (
                    <div key={p.id} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "9px 0",
                      borderBottom: i < properties.length-1 ? `1px solid ${T.border}` : "none",
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: i === 0 ? T.amber : i === 1 ? "#9AA3B0" : T.border,
                        color: T.white, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0,
                      }}>{i+1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.address}
                        </div>
                        <div style={{ fontSize: 11, color: T.slate }}>{p.price} · {p.type}</div>
                      </div>
                      {p.missed && <Badge color="amber">Missed</Badge>}
                      <Badge color={p.verdict === "BUY" ? "teal" : p.verdict === "WATCH" ? "amber" : "red"}>{p.verdict}</Badge>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        border: `2px solid ${p.score >= 7 ? T.teal : p.score >= 5 ? T.amber : T.red}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 800,
                        color: p.score >= 7 ? T.teal : p.score >= 5 ? T.amber : T.red,
                      }}>{p.score}</div>
                    </div>
                  ))}
                </div>

                {/* Missed properties */}
                {missed.length > 0 && (
                  <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: 20, marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.navy, marginBottom: 14 }}>❌ Missed properties — learnings</div>
                    {missed.map(p => (
                      <div key={p.id} style={{ padding: "10px 14px", background: T.redLt, borderRadius: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.navy }}>{p.address}</div>
                        <div style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>{p.price} · Score {p.score}/10 · {p.type}</div>
                        {p.notes && <div style={{ fontSize: 12, color: T.slate, marginTop: 4, fontStyle: "italic" }}>"{p.notes}"</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
                  {[
                    { label: "Avg score",  val: avgScore,                                    icon: "⭐" },
                    { label: "BUY",        val: buys,                                         icon: "✅" },
                    { label: "WATCH",      val: properties.filter(p=>p.verdict==="WATCH").length, icon: "👀" },
                    { label: "PASS",       val: properties.filter(p=>p.verdict==="PASS").length,  icon: "❌" },
                    { label: "Active",     val: active.length,                               icon: "🏠" },
                    { label: "Missed",     val: missed.length,                               icon: "😔" },
                  ].map(({ label, val, icon }) => (
                    <div key={label} style={{ background: T.white, borderRadius: 10, padding: "14px 16px", border: `1px solid ${T.border}`, textAlign: "center" }}>
                      <div style={{ fontSize: 24 }}>{icon}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: T.navy }}>{val}</div>
                      <div style={{ fontSize: 11, color: T.slate, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div style={{ background: T.white, borderRadius: 14, border: `1px solid ${T.border}`, padding: 24, maxWidth: 500 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.navy, marginBottom: 20 }}>⚙ Settings</div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.navy, marginBottom: 6 }}>Anthropic API Key</div>
              <input
                type="password"
                defaultValue={localStorage.getItem("claude-api-key") || ""}
                id="api-key-input"
                placeholder="sk-ant-..."
                style={{
                  width: "100%", padding: "12px 14px",
                  border: `1px solid ${T.border}`, borderRadius: 10,
                  fontSize: 14, color: T.navy, fontFamily: "'DM Mono', monospace",
                  outline: "none", marginBottom: 8,
                }}
              />
              <button onClick={() => {
                const val = document.getElementById("api-key-input").value.trim();
                if (val) { localStorage.setItem("claude-api-key", val); alert("API key saved ✓"); }
                else { localStorage.removeItem("claude-api-key"); alert("API key removed"); }
              }} style={{
                background: T.teal, color: T.white, border: "none",
                padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13,
              }}>Save Key</button>
              <div style={{ fontSize: 12, color: T.slate, marginTop: 8, lineHeight: 1.6 }}>
                Get a free key at <b>console.anthropic.com</b> → API Keys.<br/>
                Stored only in your browser's localStorage.
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.red, marginBottom: 8 }}>Danger zone</div>
              <button onClick={() => {
                if (window.confirm("Delete all properties? This cannot be undone.")) {
                  setProperties([]); alert("All properties deleted.");
                }
              }} style={{
                background: T.redLt, color: T.red, border: `1px solid ${T.red}33`,
                padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
              }}>Clear all properties</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
