const { useEffect, useMemo, useRef, useState } = React;

const INCIDENT_TYPES = [
  {
    key: "dark_street",
    label: "Dark street",
    color: "#2e8b57",
    weight: 1.0,
  },
  {
    key: "bad_vibes",
    label: "Bad vibes",
    color: "#c98b2b",
    weight: 1.3,
  },
  {
    key: "followed",
    label: "Someone followed me",
    color: "#c7413a",
    weight: 1.8,
  },
  {
    key: "catcalling",
    label: "Catcalling",
    color: "#d96b43",
    weight: 1.1,
  },
  {
    key: "poor_lighting",
    label: "Poor lighting",
    color: "#0f7b7b",
    weight: 1.0,
  },
  {
    key: "quiet_area",
    label: "Too quiet",
    color: "#4b6a88",
    weight: 1.2,
  },
];

const REPORT_WINDOW_HOURS = 72;
const DECAY_PER_HOUR = 0.035;
const BASE_SCALE = 0.8;
const MAX_SCALE = 2.2;

const PIN_POOLS = [
  {
    id: "botanic",
    label: "Botanic Gardens",
    coord: [54.5722, -5.9334],
  },
  {
    id: "queens",
    label: "Queen's University",
    coord: [54.5845, -5.9346],
  },
  {
    id: "cityhall",
    label: "City Hall",
    coord: [54.5973, -5.9301],
  },
  {
    id: "cathedral",
    label: "Cathedral Quarter",
    coord: [54.6023, -5.9281],
  },
  {
    id: "ormeau",
    label: "Ormeau Road",
    coord: [54.5836, -5.9166],
  },
  {
    id: "malone",
    label: "Malone Road",
    coord: [54.5759, -5.9502],
  },
];

const initialReports = [
  {
    id: "r1",
    type: "dark_street",
    coord: [54.5827, -5.9362],
    timestamp: Date.now() - 1000 * 60 * 42,
  },
  {
    id: "r2",
    type: "bad_vibes",
    coord: [54.5963, -5.9282],
    timestamp: Date.now() - 1000 * 60 * 95,
  },
  {
    id: "r3",
    type: "followed",
    coord: [54.5851, -5.9248],
    timestamp: Date.now() - 1000 * 60 * 12,
  },
  {
    id: "r4",
    type: "quiet_area",
    coord: [54.5902, -5.9408],
    timestamp: Date.now() - 1000 * 60 * 150,
  },
  {
    id: "r5",
    type: "catcalling",
    coord: [54.5709, -5.9236],
    timestamp: Date.now() - 1000 * 60 * 28,
  },
];

const streets = [
  { id: "s1", coords: [[54.5882, -5.9432], [54.5906, -5.9351], [54.5927, -5.929]] , level: "safe" },
  { id: "s2", coords: [[54.5976, -5.9461], [54.5972, -5.936], [54.5968, -5.9275]] , level: "okay" },
  { id: "s3", coords: [[54.602, -5.934], [54.6003, -5.926], [54.597, -5.921]] , level: "risk" },
  { id: "s4", coords: [[54.5782, -5.944], [54.5806, -5.936], [54.5819, -5.928]] , level: "safe" },
];

function hoursSince(timestamp) {
  return (Date.now() - timestamp) / 1000 / 60 / 60;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeReportStrength(report, multiplier) {
  const type = INCIDENT_TYPES.find((item) => item.key === report.type);
  const hours = hoursSince(report.timestamp);
  const decay = Math.exp(-DECAY_PER_HOUR * hours);
  return (type?.weight ?? 1) * decay * multiplier;
}

function groupReports(reports) {
  const groups = new Map();
  reports.forEach((report) => {
    const key = `${report.coord[0].toFixed(4)}:${report.coord[1].toFixed(4)}`;
    const existing = groups.get(key) ?? {
      coord: report.coord,
      reports: [],
      dominantType: report.type,
    };
    existing.reports.push(report);
    groups.set(key, existing);
  });

  return Array.from(groups.values()).map((group) => {
    const counts = group.reports.reduce((acc, report) => {
      acc[report.type] = (acc[report.type] ?? 0) + 1;
      return acc;
    }, {});
    const dominantType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return { ...group, dominantType };
  });
}

function useLeafletMap(reports, selectedType, safetyPreference) {
  const mapRef = useRef(null);
  const layerRef = useRef({ markers: [], overlays: [] });

  useEffect(() => {
    if (mapRef.current) {
      return;
    }

    const map = L.map("liveMap", { zoomControl: false }).setView([54.5973, -5.9301], 13.2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    layerRef.current.markers.forEach((marker) => marker.remove());
    layerRef.current.overlays.forEach((overlay) => overlay.remove());
    layerRef.current.markers = [];
    layerRef.current.overlays = [];

    const multiplier = selectedType === "all" ? 1 : 1.15;
    const grouped = groupReports(reports);

    grouped.forEach((group) => {
      const reportStrength = group.reports.reduce(
        (acc, report) => acc + computeReportStrength(report, multiplier),
        0
      );
      const intensity = clamp(reportStrength, 0, 3);
      const typeKey = selectedType === "all" ? group.dominantType : selectedType;
      const type = INCIDENT_TYPES.find((item) => item.key === typeKey);
      const scale = clamp(BASE_SCALE + intensity, BASE_SCALE, MAX_SCALE);

      const icon = L.divIcon({
        className: "incident-pin",
        html: `
          <div class="pin" style="--pin-color: ${type?.color ?? "#c7413a"}; --pin-scale: ${scale};">
            <span></span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 40],
      });

      const title = `${group.reports.length} report${group.reports.length === 1 ? "" : "s"}`;
      const marker = L.marker(group.coord, { icon, title }).addTo(map);
      marker.bindPopup(`
        <strong>${type?.label ?? "Community report"}</strong><br/>
        ${title} · ${(reportStrength * 10).toFixed(0)} safety impact
      `);
      layerRef.current.markers.push(marker);

      const pulse = L.circle(group.coord, {
        radius: 120 * scale,
        color: type?.color ?? "#c7413a",
        fillColor: type?.color ?? "#c7413a",
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(map);
      layerRef.current.overlays.push(pulse);
    });

    streets.forEach((street) => {
      const color =
        street.level === "safe" ? "#2e8b57" : street.level === "okay" ? "#c98b2b" : "#c7413a";
      const weight = safetyPreference >= 4 ? 6 : safetyPreference === 3 ? 5 : 4;
      const polyline = L.polyline(street.coords, {
        color,
        weight,
        opacity: 0.7,
        dashArray: street.level === "risk" ? "10 8" : null,
      }).addTo(map);
      layerRef.current.overlays.push(polyline);
    });
  }, [reports, selectedType, safetyPreference]);
}

function App() {
  const [reports, setReports] = useState(initialReports);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState(PIN_POOLS[0]);
  const [selectedCategory, setSelectedCategory] = useState(INCIDENT_TYPES[0]);
  const [safetyPreference, setSafetyPreference] = useState(4);

  const activeReports = useMemo(() => {
    return reports.filter((report) => hoursSince(report.timestamp) <= REPORT_WINDOW_HOURS);
  }, [reports]);

  useLeafletMap(activeReports, selectedType, safetyPreference);

  useEffect(() => {
    const timer = setInterval(() => {
      setReports((prev) => prev.filter((report) => hoursSince(report.timestamp) <= REPORT_WINDOW_HOURS));
    }, 1000 * 60 * 2);
    return () => clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const total = activeReports.length;
    const latest = activeReports.slice(0, 3);
    return { total, latest };
  }, [activeReports]);

  function addReport() {
    const newReport = {
      id: `r-${Date.now()}`,
      type: selectedCategory.key,
      coord: selectedLocation.coord,
      timestamp: Date.now(),
    };
    setReports((prev) => [newReport, ...prev]);
  }

  function addBatchReports() {
    const now = Date.now();
    const batch = Array.from({ length: 4 }).map((_, index) => ({
      id: `r-${now}-${index}`,
      type: selectedCategory.key,
      coord: selectedLocation.coord,
      timestamp: now - index * 1000 * 60 * 4,
    }));
    setReports((prev) => [...batch, ...prev]);
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <div>
            <p className="brand-name">SafeWalk Belfast</p>
            <p className="brand-tag">Community-powered safer routes</p>
          </div>
        </div>
        <nav className="top-actions">
          <button className="ghost">Report a concern</button>
          <button className="primary">Plan my walk</button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Belfast focused · Women-first design</p>
          <h1>Make the walk home feel like a choice — not a risk.</h1>
          <p className="lede">
            SafeWalk Belfast scores routes by lighting, activity, and recent community reports so
            you can choose streets that feel safer even when it is not that late.
          </p>
          <div className="hero-actions">
            <button className="primary">Start safer routing</button>
            <button className="ghost">View live safety map</button>
          </div>
          <div className="impact">
            <div>
              <p className="impact-label">Northern Ireland</p>
              <p className="impact-value">98% of women</p>
              <p className="impact-note">have experienced at least one form of violence or abuse.</p>
            </div>
            <div>
              <p className="impact-label">Last 12 months</p>
              <p className="impact-value">7 in 10 women</p>
              <p className="impact-note">experienced violence or abuse in NI surveys.</p>
            </div>
            <div>
              <p className="impact-label">Across Europe</p>
              <p className="impact-value">Millions</p>
              <p className="impact-note">affected by sexual harassment and abuse.</p>
            </div>
          </div>
        </div>

        <div className="hero-map">
          <div className="map-header">
            <div>
              <p className="map-title">Live Community Safety Map</p>
              <p className="map-sub">Pins fade after 72 hours unless reconfirmed</p>
            </div>
            <div className="map-toggle">
              <button
                className={`chip ${selectedType === "all" ? "active" : ""}`}
                onClick={() => setSelectedType("all")}
              >
                All
              </button>
              {INCIDENT_TYPES.slice(0, 2).map((type) => (
                <button
                  key={type.key}
                  className={`chip ${selectedType === type.key ? "active" : ""}`}
                  onClick={() => setSelectedType(type.key)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="map-canvas">
            <div id="liveMap" aria-label="Live map of Belfast"></div>
          </div>

          <div className="map-footer">
            <div className="live-metrics">
              <div>
                <p className="metric-value">{summary.total}</p>
                <p className="metric-label">Reports (72h)</p>
              </div>
              <div>
                <p className="metric-value">{Math.min(96, 68 + summary.total)}</p>
                <p className="metric-label">Lighting score</p>
              </div>
              <div>
                <p className="metric-value">{Math.max(40, 88 - summary.total * 2)}</p>
                <p className="metric-label">Street activity</p>
              </div>
            </div>
            <button className="ghost" onClick={addReport}>Add report</button>
          </div>
        </div>
      </section>

      <section className="planner">
        <div className="planner-card">
          <h2>Plan a safer walk</h2>
          <p className="planner-note">Prototype mode — routes are simulated for the demo.</p>
          <form onSubmit={(event) => event.preventDefault()}>
            <label>
              Start point
              <input type="text" defaultValue="Queen's University" />
            </label>
            <label>
              Destination
              <input type="text" defaultValue="Stranmillis Road" />
            </label>
            <label>
              Safety preference
              <input
                type="range"
                min="1"
                max="5"
                value={safetyPreference}
                onChange={(event) => setSafetyPreference(Number(event.target.value))}
              />
              <div className="range-labels">
                <span>Fastest</span>
                <span>Balanced</span>
                <span>Safest</span>
              </div>
            </label>
            <div className="form-actions">
              <button className="primary" type="submit">Score routes</button>
              <button className="ghost" type="button">Swap</button>
            </div>
          </form>
        </div>

        <div className="planner-results">
          <div className={`route-option ${safetyPreference >= 4 ? "active" : ""}`}>
            <div>
              <p className="route-name">Safer route</p>
              <p className="route-meta">28 min · 2.1 km · 4 recent reports</p>
            </div>
            <span className="badge safe">Safety 84</span>
          </div>
          <div className={`route-option ${safetyPreference === 3 ? "active" : ""}`}>
            <div>
              <p className="route-name">Balanced route</p>
              <p className="route-meta">23 min · 1.7 km · 7 recent reports</p>
            </div>
            <span className="badge okay">Safety 63</span>
          </div>
          <div className={`route-option ${safetyPreference <= 2 ? "active" : ""}`}>
            <div>
              <p className="route-name">Fastest route</p>
              <p className="route-meta">18 min · 1.3 km · 11 recent reports</p>
            </div>
            <span className="badge risk">Safety 41</span>
          </div>
        </div>
      </section>

      <section className="community">
        <div>
          <h2>Community reporting, like Waze for safety</h2>
          <p>
            Reports are short, anonymous, and fade after 72 hours unless reconfirmed. Multiple
            reports in one area increase the size and pulse of the warning pin.
          </p>
        </div>
        <div className="report-feed">
          <div className="report-control">
            <label>
              Choose a location
              <select
                value={selectedLocation.id}
                onChange={(event) => {
                  const choice = PIN_POOLS.find((item) => item.id === event.target.value);
                  setSelectedLocation(choice ?? PIN_POOLS[0]);
                }}
              >
                {PIN_POOLS.map((pin) => (
                  <option key={pin.id} value={pin.id}>
                    {pin.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Report type
              <select
                value={selectedCategory.key}
                onChange={(event) => {
                  const choice = INCIDENT_TYPES.find((item) => item.key === event.target.value);
                  setSelectedCategory(choice ?? INCIDENT_TYPES[0]);
                }}
              >
                {INCIDENT_TYPES.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="report-buttons">
              <button className="primary" onClick={addReport}>Drop a pin</button>
              <button className="ghost" onClick={addBatchReports}>Spike reports</button>
            </div>
          </div>
          <div className="report-list">
            {summary.latest.map((report) => {
              const type = INCIDENT_TYPES.find((item) => item.key === report.type);
              const timeAgo = Math.round(hoursSince(report.timestamp) * 60);
              return (
                <div key={report.id} className="report">
                  <p className="report-title">{type?.label ?? "Community report"}</p>
                  <p className="report-meta">{timeAgo} mins ago · {type?.label ?? "Report"}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="cta">
        <div>
          <h2>Designed with students in mind</h2>
          <p>
            Built for Belfast and adaptable to other cities. This prototype shows how public
            lighting data, crowdsourced reports, and time-of-day signals can support safer choices.
          </p>
        </div>
        <button className="primary">Join the pilot</button>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
