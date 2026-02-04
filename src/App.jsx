import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import OpeningHours from "opening_hours";
import { createClient } from "@supabase/supabase-js";

const INCIDENT_TYPES = [
  { key: "dark_street", label: "Dark street", color: "#3a7d44", weight: 1.0, icon: "moon" },
  { key: "bad_vibes", label: "Bad vibes", color: "#945600", weight: 1.3, icon: "alert" },
  { key: "followed", label: "Someone followed me", color: "#592e83", weight: 1.8, icon: "run" },
  { key: "catcalling", label: "Catcalling", color: "#eba6a9", weight: 1.1, icon: "chat" },
  { key: "poor_lighting", label: "Poor lighting", color: "#3a7d44", weight: 1.0, icon: "bulb" },
  { key: "quiet_area", label: "Too quiet", color: "#6b5a7a", weight: 1.2, icon: "quiet" },
  { key: "building_site", label: "Building site", color: "#945600", weight: 1.15, icon: "cone" },
  { key: "nightclubs", label: "Nightclubs nearby", color: "#592e83", weight: 1.4, icon: "music" },
];

const SAFETY_POIS = {
  busy: {
    key: "busy",
    label: "Busy areas",
    color: "#3a7d44",
    icon: "crowd",
    points: [
      { id: "sa1", label: "Botanic Avenue", coord: [54.583, -5.9327] },
      { id: "sa2", label: "Lisburn Road", coord: [54.5838, -5.9453] },
      { id: "sa3", label: "Stranmillis", coord: [54.5758, -5.9384] },
      { id: "sa4", label: "Holylands", coord: [54.5806, -5.9182] },
    ],
  },
  openBusinesses: {
    key: "openBusinesses",
    label: "Open businesses",
    color: "#3a7d44",
    icon: "store",
    points: [
      { id: "ob1", label: "24hr Pharmacy", coord: [54.5885, -5.9319] },
      { id: "ob2", label: "Late cafe", coord: [54.5851, -5.9349] },
      { id: "ob3", label: "Convenience store", coord: [54.592, -5.9226] },
      { id: "ob4", label: "Taxi rank", coord: [54.5979, -5.9293] },
    ],
  },
};

const REPORT_WINDOW_HOURS = 72;
const DECAY_PER_HOUR = 0.035;
const BASE_SCALE = 0.8;
const MAX_SCALE = 2.2;

const FOCUS_AREAS = [
  { id: "stranmillis", label: "Stranmillis", coord: [54.5758, -5.9384] },
  { id: "botanic", label: "Botanic", coord: [54.583, -5.9327] },
  { id: "holylands", label: "Holylands", coord: [54.5806, -5.9182] },
  { id: "lisburn", label: "Lisburn Road", coord: [54.5838, -5.9453] },
];

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OPEN_BUSINESS_CATEGORIES = [
  "cafe",
  "restaurant",
  "fast_food",
  "pharmacy",
  "convenience",
  "supermarket",
  "bakery",
  "bar",
  "pub",
  "taxi",
];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const LOCAL_STORAGE_KEY = "safe-walking-reports";

const PIN_POOLS = [
  { id: "stranmillis", label: "Stranmillis", coord: [54.5758, -5.9384] },
  { id: "botanic", label: "Botanic Avenue", coord: [54.583, -5.9327] },
  { id: "holylands", label: "Holylands", coord: [54.5806, -5.9182] },
  { id: "lisburn", label: "Lisburn Road", coord: [54.5838, -5.9453] },
  { id: "queens", label: "Queen's University", coord: [54.5845, -5.9346] },
  { id: "cityhall", label: "City Hall", coord: [54.5973, -5.9301] },
];

const initialReports = [
  { id: "r1", type: "dark_street", coord: [54.5827, -5.9362], timestamp: Date.now() - 1000 * 60 * 42 },
  { id: "r2", type: "bad_vibes", coord: [54.5963, -5.9282], timestamp: Date.now() - 1000 * 60 * 95 },
  { id: "r3", type: "followed", coord: [54.5851, -5.9248], timestamp: Date.now() - 1000 * 60 * 12 },
  { id: "r4", type: "quiet_area", coord: [54.5902, -5.9408], timestamp: Date.now() - 1000 * 60 * 150 },
  { id: "r5", type: "catcalling", coord: [54.5709, -5.9236], timestamp: Date.now() - 1000 * 60 * 28 },
];

function hoursSince(timestamp) {
  return (Date.now() - timestamp) / 1000 / 60 / 60;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const ICON_SVGS = {
  moon: `<path d="M11.5 2.2a6.8 6.8 0 1 0 2.3 11A6 6 0 1 1 11.5 2.2Z" />`,
  alert: `<path d="M8 2.2 14.6 13H1.4L8 2.2Z" /><path d="M8 6.1v3.6" /><circle cx="8" cy="12" r="0.8" />`,
  run: `<circle cx="10.5" cy="3.5" r="1.5"/><path d="M7 8.5 9 6.5l2 1.2 2.4 2.3M6 13l2.2-3.2 2.4 1.3 2.4 2.9"/>`,
  chat: `<path d="M2.2 3.5h11.6v7H7l-3.2 2.5V3.5Z" />`,
  bulb: `<path d="M8 2a4 4 0 0 1 2.4 7.2c-.6.4-.9.9-1 1.5H6.6c-.1-.6-.4-1.1-1-1.5A4 4 0 0 1 8 2Z"/><path d="M6.2 12.2h3.6M6.6 14h2.8" />`,
  quiet: `<path d="M6.2 5.2c1.2-1.2 2.7-1.2 4 0M5 9.4l6-6M8 9.8c1.5 0 2.7 1.2 2.7 2.7"/>`,
  cone: `<path d="M7 2h2l2 8H5l2-8Z"/><path d="M4.2 12h7.6M3 14h10" />`,
  music: `<path d="M10.5 2.6v7.2a2 2 0 1 1-1-1.7V4.2l4-1v5.6a2 2 0 1 1-1-1.7" />`,
  crowd: `<circle cx="5" cy="5" r="2"/><circle cx="11" cy="5" r="2"/><path d="M2 13c.6-2 2.2-3 4-3s3.4 1 4 3M8 13c.5-1.6 1.8-2.5 3.2-2.5S14 11.4 14.5 13" />`,
  store: `<path d="M2.4 6.2h11.2l-1-3.2H3.4l-1 3.2Z"/><path d="M3.4 6.2v7.2h9.2V6.2"/><path d="M6.2 13.4V9.8h3.6v3.6" />`,
};

function pinHtml(color, scale, iconKey) {
  const icon = ICON_SVGS[iconKey] ?? ICON_SVGS.alert;
  return `
    <div class="pin" style="--pin-color: ${color}; --pin-scale: ${scale};">
      <span></span>
      <div class="pin-badge">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          ${icon}
        </svg>
      </div>
    </div>
  `;
}

function buildOverpassQuery(bounds) {
  const { south, west, north, east } = bounds;
  const amenityFilter = OPEN_BUSINESS_CATEGORIES.join("|");
  return `
    [out:json][timeout:25];
    (
      node["amenity"~"^(${amenityFilter})$"]["opening_hours"](${south},${west},${north},${east});
      node["shop"]["opening_hours"](${south},${west},${north},${east});
    );
    out center tags;
  `;
}

function isOpenNow(openingHours, coord) {
  if (!openingHours) return false;
  if (openingHours.trim() === "24/7") return true;
  try {
    const oh = new OpeningHours(openingHours, {
      lat: coord[0],
      lon: coord[1],
      address: { country_code: "gb" },
    });
    return oh.getState();
  } catch {
    return false;
  }
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

function useLeafletMap(
  reports,
  selectedType,
  safetyPreference,
  filters,
  view,
  openBusinesses,
  focusArea,
  onBoundsChange
) {
  const mapRef = useRef(null);
  const layerRef = useRef({ markers: [], overlays: [] });

  useEffect(() => {
    if (mapRef.current && mapRef.current._container?.isConnected) {
      return;
    }

    if (mapRef.current && !mapRef.current._container?.isConnected) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map("liveMap", { zoomControl: false }).setView([54.5973, -5.9301], 13.2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("moveend", () => {
      const bounds = map.getBounds();
      onBoundsChange?.({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    });
    const bounds = map.getBounds();
    onBoundsChange?.({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
  }, [view]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    if (focusArea) {
      map.setView(focusArea.coord, 14.2, { animate: true });
    }
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
        html: pinHtml(type?.color ?? "#592e83", scale, type?.icon),
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

    if (filters.busyAreas) {
      SAFETY_POIS.busy.points.forEach((poi) => {
        const icon = L.divIcon({
          className: "incident-pin",
          html: pinHtml(SAFETY_POIS.busy.color, 0.9, SAFETY_POIS.busy.icon),
          iconSize: [40, 40],
          iconAnchor: [20, 36],
        });
        const marker = L.marker(poi.coord, { icon, title: poi.label }).addTo(map);
        marker.bindPopup(`<strong>Busy area</strong><br/>${poi.label}`);
        layerRef.current.markers.push(marker);
      });
    }

    if (filters.openBusinesses) {
      (openBusinesses.length ? openBusinesses : SAFETY_POIS.openBusinesses.points).forEach((poi) => {
        const icon = L.divIcon({
          className: "incident-pin",
          html: pinHtml(SAFETY_POIS.openBusinesses.color, 0.85, SAFETY_POIS.openBusinesses.icon),
          iconSize: [40, 40],
          iconAnchor: [20, 36],
        });
        const marker = L.marker(poi.coord, { icon, title: poi.label }).addTo(map);
        marker.bindPopup(`<strong>Open business</strong><br/>${poi.label}`);
        layerRef.current.markers.push(marker);
      });
    }

  }, [reports, selectedType, safetyPreference, filters, view, openBusinesses, focusArea]);
}

export default function App() {
  const [view, setView] = useState("home");
  const [reports, setReports] = useState(initialReports);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState(PIN_POOLS[0]);
  const [selectedCategory, setSelectedCategory] = useState(INCIDENT_TYPES[0]);
  const [safetyPreference, setSafetyPreference] = useState(4);
  const [filters, setFilters] = useState({ busyAreas: true, openBusinesses: false });
  const [startPoint, setStartPoint] = useState("Queen's University");
  const [endPoint, setEndPoint] = useState("Stranmillis Road");
  const [openBusinesses, setOpenBusinesses] = useState([]);
  const [openBusinessStatus, setOpenBusinessStatus] = useState("idle");
  const [mapBounds, setMapBounds] = useState(null);
  const [focusArea, setFocusArea] = useState(null);
  const lastOverpassRef = useRef({ key: "", time: 0 });
  const supabaseEnabled = Boolean(supabase);

  const activeReports = useMemo(() => {
    return reports.filter((report) => hoursSince(report.timestamp) <= REPORT_WINDOW_HOURS);
  }, [reports]);

  useLeafletMap(
    activeReports,
    selectedType,
    safetyPreference,
    filters,
    view,
    openBusinesses,
    focusArea,
    setMapBounds
  );

  useEffect(() => {
    if (supabaseEnabled) {
      supabase
        .from("reports")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(200)
        .then(({ data }) => {
          if (data?.length) {
            setReports(
              data.map((row) => ({
                id: row.id,
                type: row.type,
                coord: row.coord,
                timestamp: row.timestamp,
              }))
            );
          }
        });

      const channel = supabase
        .channel("reports-feed")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "reports" },
          (payload) => {
            const row = payload.new;
            setReports((prev) => [
              { id: row.id, type: row.type, coord: row.coord, timestamp: row.timestamp },
              ...prev,
            ]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          setReports(parsed);
        }
      } catch {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
    return undefined;
  }, [supabaseEnabled]);

  useEffect(() => {
    if (supabaseEnabled) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports.slice(0, 200)));
  }, [reports, supabaseEnabled]);

  useEffect(() => {
    if (!filters.openBusinesses || !mapBounds) return;
    const now = Date.now();
    const boundsKey = `${mapBounds.south.toFixed(3)}:${mapBounds.west.toFixed(3)}:${mapBounds.north.toFixed(3)}:${mapBounds.east.toFixed(3)}`;
    if (lastOverpassRef.current.key === boundsKey && now - lastOverpassRef.current.time < 15000) {
      return;
    }
    lastOverpassRef.current = { key: boundsKey, time: now };
    setOpenBusinessStatus("loading");

    const query = buildOverpassQuery(mapBounds);
    fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `data=${encodeURIComponent(query)}`,
    })
      .then((response) => response.json())
      .then((data) => {
        const results = (data.elements ?? [])
          .filter((element) => element.type === "node" && element.tags)
          .map((element) => {
            const coord = [element.lat, element.lon];
            return {
              id: `ob-${element.id}`,
              label: element.tags.name ?? "Open business",
              coord,
              openingHours: element.tags.opening_hours,
            };
          })
          .filter((item) => isOpenNow(item.openingHours, item.coord))
          .slice(0, 60);

        setOpenBusinesses(results);
        setOpenBusinessStatus("ready");
      })
      .catch(() => {
        setOpenBusinessStatus("error");
        setOpenBusinesses([]);
      });
  }, [filters.openBusinesses, mapBounds]);

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
    if (supabaseEnabled) {
      supabase.from("reports").insert({
        id: newReport.id,
        type: newReport.type,
        coord: newReport.coord,
        timestamp: newReport.timestamp,
      });
    } else {
      setReports((prev) => [newReport, ...prev]);
    }
  }

  function addBatchReports() {
    const now = Date.now();
    const batch = Array.from({ length: 4 }).map((_, index) => ({
      id: `r-${now}-${index}`,
      type: selectedCategory.key,
      coord: selectedLocation.coord,
      timestamp: now - index * 1000 * 60 * 4,
    }));
    if (supabaseEnabled) {
      supabase.from("reports").insert(batch);
    } else {
      setReports((prev) => [...batch, ...prev]);
    }
  }

  if (view === "map") {
    return (
      <div className="page page-map">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">S</span>
            <div>
              <p className="brand-name">SafeWalk Belfast</p>
              <p className="brand-tag">Live map view</p>
            </div>
          </div>
          <nav className="top-actions">
            <button className="ghost" onClick={() => setView("home")}>Back to overview</button>
            <button className="primary" onClick={addReport}>Add report</button>
          </nav>
        </header>
        <section className="map-full">
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
              {INCIDENT_TYPES.slice(0, 3).map((type) => (
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
          <div className="map-focus">
            <span className="focus-label">Focus areas:</span>
            {FOCUS_AREAS.map((area) => (
              <button
                key={area.id}
                className="chip"
                onClick={() => setFocusArea(area)}
              >
                {area.label}
              </button>
            ))}
            <button className="chip" onClick={() => setFocusArea(null)}>Reset</button>
          </div>
          <div className="map-canvas map-canvas-full">
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
            <div className="filter-toggles">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={filters.busyAreas}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, busyAreas: event.target.checked }))
                  }
                />
                Busy areas
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={filters.openBusinesses}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, openBusinesses: event.target.checked }))
                  }
                />
                Open businesses
              </label>
              {filters.openBusinesses && (
                <span className={`status ${openBusinessStatus}`}>
                  Open businesses: {openBusinessStatus}
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    );
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
          <button
            className="ghost"
            onClick={() =>
              document.getElementById("report-panel")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Report a concern
          </button>
          <button
            className="primary"
            onClick={() =>
              document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Plan my walk
          </button>
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
            <button className="primary" onClick={() => setView("map")}>
              Start safer routing
            </button>
            <button className="ghost" onClick={() => setView("map")}>
              View live safety map
            </button>
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
          <div className="map-focus">
            <span className="focus-label">Focus areas:</span>
            {FOCUS_AREAS.map((area) => (
              <button
                key={area.id}
                className="chip"
                onClick={() => setFocusArea(area)}
              >
                {area.label}
              </button>
            ))}
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

      <section className="planner" id="planner">
        <div className="planner-card">
          <h2>Plan a safer walk</h2>
          <p className="planner-note">Prototype mode — routes are simulated for the demo.</p>
          <form onSubmit={(event) => event.preventDefault()}>
            <label>
              Start point
              <input
                type="text"
                value={startPoint}
                onChange={(event) => setStartPoint(event.target.value)}
              />
            </label>
            <label>
              Destination
              <input
                type="text"
                value={endPoint}
                onChange={(event) => setEndPoint(event.target.value)}
              />
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
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setStartPoint(endPoint);
                  setEndPoint(startPoint);
                }}
              >
                Swap
              </button>
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

      <section className="community" id="report-panel">
        <div>
          <h2>Community reporting, like Waze for safety</h2>
          <p>
            Reports are short, anonymous, and fade after 72 hours unless reconfirmed. Multiple
            reports in one area increase the size and pulse of the warning pin. Busy areas and open
            businesses can be toggled to highlight safer pockets.
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
            <div className="filter-toggles">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={filters.busyAreas}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, busyAreas: event.target.checked }))
                  }
                />
                Busy areas
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={filters.openBusinesses}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, openBusinesses: event.target.checked }))
                  }
                />
                Open businesses
              </label>
            </div>
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
