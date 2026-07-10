import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { MapContainer, TileLayer, Polygon, Circle, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, ShieldAlert, ScaleIcon, Info } from "lucide-react";
import { useUserSession } from "../contexts/UserContext";
import { HAZARDS, CATEGORY_LABEL, type Hazard, type HazardCategory } from "../lib/biosecurityHazards";

export default function BiosecurityMap() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId } = useUserSession();

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
    }
  }, [activationCode, deviceId, setLocation]);

  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(
    Object.fromEntries(HAZARDS.map((h) => [h.id, true]))
  );
  const [activeHazardId, setActiveHazardId] = useState<string>(HAZARDS[0].id);

  const activeHazard = useMemo(
    () => HAZARDS.find((h) => h.id === activeHazardId) as Hazard,
    [activeHazardId]
  );

  const toggleLayer = (id: string) => {
    setActiveLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const categories: HazardCategory[] = ["operator", "statutory"];

  return (
    <div className="min-h-screen bg-[#0b0f14] text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-[#0e141b] px-4 py-3 flex items-center gap-3 shrink-0">
        <Link
          href="/training"
          className="text-slate-400 hover:text-orange-400 flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2 ml-1">
          <ShieldAlert className="w-5 h-5 text-orange-500" />
          <h1 className="font-black uppercase tracking-tight text-sm sm:text-base">
            Biosecurity &amp; Hazard Map
          </h1>
        </div>
        <span className="ml-auto text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide hidden sm:inline">
          UK Chainsaw Operator Awareness Tool
        </span>
      </header>

      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-[11px] sm:text-xs text-amber-300 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Zones shown are <strong>illustrative</strong>, for operator awareness and training only — not
          precise official boundaries. Always check live Forestry Commission / APHA / Plant Health Portal
          notices before assuming pest, disease or timber-movement status at your actual site.
        </span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Sidebar */}
        <aside className="w-full lg:w-[360px] xl:w-[400px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0e141b] overflow-y-auto max-h-[45vh] lg:max-h-none">
          <div className="p-4 space-y-5">
            {categories.map((cat) => (
              <div key={cat}>
                <h2
                  className={`text-xs font-black uppercase tracking-wide mb-2 pb-1 border-b ${
                    cat === "operator"
                      ? "text-orange-400 border-orange-500/30"
                      : "text-violet-400 border-violet-500/30"
                  }`}
                >
                  {CATEGORY_LABEL[cat]}
                </h2>
                <div className="space-y-1.5">
                  {HAZARDS.filter((h) => h.category === cat).map((h) => (
                    <div
                      key={h.id}
                      className={`rounded-md border px-2.5 py-2 cursor-pointer transition-colors ${
                        activeHazardId === h.id
                          ? "border-slate-500 bg-slate-800/60"
                          : "border-slate-800 bg-slate-900/40 hover:bg-slate-800/40"
                      }`}
                      onClick={() => setActiveHazardId(h.id)}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!activeLayers[h.id]}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleLayer(h.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-current shrink-0"
                          style={{ accentColor: h.color }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: h.color }}
                        />
                        <span className="text-sm font-semibold leading-tight">{h.commonName}</span>
                      </div>
                      <p className="text-[11px] italic text-slate-500 ml-8">{h.scientificName}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Active Hazard Information card */}
          <div className="p-4 border-t border-slate-800 bg-[#0a0e13]">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
              <ScaleIcon className="w-3.5 h-3.5" /> Active Hazard Information
            </h3>
            {activeHazard ? (
              <div
                className="rounded-lg border p-3 space-y-3"
                style={{ borderColor: `${activeHazard.color}55`, backgroundColor: `${activeHazard.color}14` }}
              >
                <div>
                  <p className="font-black text-base leading-tight">{activeHazard.commonName}</p>
                  <p className="text-xs italic text-slate-400">{activeHazard.scientificName}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border"
                    style={{ color: activeHazard.color, borderColor: activeHazard.color }}
                  >
                    {activeHazard.category === "operator"
                      ? "Direct Operator Threat"
                      : "Statutory Containment"}
                  </span>
                  <span className="text-[10px] text-slate-500">{activeHazard.regionLabel}</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    Operational Impact
                  </p>
                  <p className="text-sm text-slate-200 leading-snug">{activeHazard.operationalImpact}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    Mandatory Control Measures
                  </p>
                  <ul className="text-sm text-slate-200 space-y-1 list-disc list-inside">
                    {activeHazard.controls.map((c, i) => (
                      <li key={i} className="leading-snug">{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a hazard layer to view details.</p>
            )}
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 min-h-[50vh] lg:min-h-0">
          <MapContainer
            center={[53.0, -2.0]}
            zoom={6}
            minZoom={5}
            maxZoom={12}
            style={{ width: "100%", height: "100%", background: "#0b0f14" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {HAZARDS.filter((h) => activeLayers[h.id]).map((h) =>
              h.zones.map((zone, i) => {
                const isActive = activeHazardId === h.id;
                const pathOptions = {
                  color: h.color,
                  fillColor: h.color,
                  fillOpacity: isActive ? 0.45 : 0.25,
                  weight: isActive ? 3 : 1.5,
                };
                const eventHandlers = { click: () => setActiveHazardId(h.id) };
                if (zone.type === "polygon") {
                  return (
                    <Polygon
                      key={`${h.id}-${i}`}
                      pathOptions={pathOptions}
                      eventHandlers={eventHandlers}
                      positions={zone.coords as [number, number][]}
                    >
                      <Popup>
                        <strong>{h.commonName}</strong>
                        <br />
                        <em>{h.scientificName}</em>
                      </Popup>
                    </Polygon>
                  );
                }
                return (
                  <Circle
                    key={`${h.id}-${i}`}
                    pathOptions={pathOptions}
                    eventHandlers={eventHandlers}
                    center={zone.coords as [number, number]}
                    radius={zone.radius ?? 20000}
                  >
                    <Popup>
                      <strong>{h.commonName}</strong>
                      <br />
                      <em>{h.scientificName}</em>
                    </Popup>
                  </Circle>
                );
              })
            )}
          </MapContainer>
        </main>
      </div>
    </div>
  );
}
