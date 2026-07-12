import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MapContainer, TileLayer, Circle, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, ShieldAlert, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUserSession } from "../contexts/UserContext";
import { HAZARDS, CATEGORY_LABEL, type HazardCategory } from "../lib/biosecurityHazards";

const categories: HazardCategory[] = ["operator", "statutory"];

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
  const [activeHazardId, setActiveHazardId] = useState<string>("");

  const toggleLayer = (id: string) => {
    setActiveLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!activationCode || !deviceId) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold uppercase tracking-widest text-sm">Biosecurity &amp; Hazard Map</span>
          </div>
          <div className="w-14" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 space-y-4 pb-10">
        <div>
          <h1 className="font-black tracking-tighter text-lg uppercase text-primary mb-1">
            Biosecurity &amp; Hazard Map
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            UK chainsaw operator awareness tool. Use before site work to check for relevant pest,
            disease or health hazards in your area.
          </p>
        </div>

        {/* Disclaimer banner */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/8 px-3 py-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="font-mono text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
            Zones shown are <strong>illustrative</strong>, for operator awareness and training only — not
            precise official boundaries. Always check live Forestry Commission / APHA / Plant Health Portal
            notices before assuming pest, disease or timber-movement status at your actual site.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
          {/* Sidebar */}
          <div className="space-y-3">
            {categories.map((cat) => (
              <Card key={cat} className="border-border bg-card/60">
                <CardContent className="p-3 space-y-1.5">
                  <h2 className={`font-mono font-bold uppercase tracking-widest text-xs pb-1.5 border-b ${
                    cat === "operator" ? "text-primary border-primary/30" : "text-violet-600 border-violet-400/30"
                  }`}>
                    {CATEGORY_LABEL[cat]}
                  </h2>
                  {HAZARDS.filter((h) => h.category === cat).map((h) => {
                    const isOpen = activeHazardId === h.id;
                    return (
                      <div key={h.id} className={`rounded border transition-colors ${isOpen ? "border-border bg-secondary/60" : "border-transparent hover:border-border hover:bg-secondary/30"}`}>
                        {/* Row header */}
                        <div
                          onClick={() => setActiveHazardId(activeHazardId === h.id ? "" : h.id)}
                          className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={!!activeLayers[h.id]}
                            onChange={(e) => { e.stopPropagation(); toggleLayer(h.id); }}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0"
                            style={{ accentColor: h.color }}
                          />
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs font-semibold leading-tight">{h.commonName}</p>
                            <p className="font-mono text-[10px] italic text-muted-foreground">{h.scientificName}</p>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          />
                        </div>

                        {/* Dropdown detail */}
                        {isOpen && (
                          <div
                            className="mx-2.5 mb-2.5 rounded border p-2.5 space-y-2"
                            style={{ borderColor: `${h.color}55`, backgroundColor: `${h.color}10` }}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="font-mono text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border"
                                style={{ color: h.color, borderColor: h.color }}
                              >
                                {h.category === "operator" ? "Direct Operator Threat" : "Statutory Containment"}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">{h.regionLabel}</span>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                                Operational Impact
                              </p>
                              <p className="font-mono text-[11px] text-foreground leading-snug">{h.operationalImpact}</p>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                                Mandatory Controls
                              </p>
                              <ul className="font-mono text-[11px] text-foreground space-y-1 list-disc list-inside">
                                {h.controls.map((c, i) => (
                                  <li key={i} className="leading-snug">{c}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}

          </div>

          {/* Map */}
          <Card className="border-border overflow-hidden">
            <div style={{ height: "580px", position: "relative" }}>
              <MapContainer
                center={[53.0, -2.0]}
                zoom={6}
                minZoom={5}
                maxZoom={12}
                style={{ width: "100%", height: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {HAZARDS.filter((h) => activeLayers[h.id]).map((h) =>
                  h.zones.map((zone, i) => {
                    const isActive = activeHazardId === h.id;
                    return (
                      <Circle
                        key={`${h.id}-${i}`}
                        center={zone.coords}
                        radius={zone.radius}
                        pathOptions={{
                          color: h.color,
                          fillColor: h.color,
                          fillOpacity: isActive ? 0.45 : 0.25,
                          weight: isActive ? 3 : 1.5,
                        }}
                        eventHandlers={{ click: () => setActiveHazardId(h.id) }}
                      >
                        <Popup><strong>{h.commonName}</strong><br /><em>{h.scientificName}</em></Popup>
                      </Circle>
                    );
                  })
                )}
              </MapContainer>

              {/* Floating legend overlay */}
              <div className="absolute bottom-7 left-2 z-[1000] bg-card/92 backdrop-blur-sm rounded-lg border border-border shadow-lg p-2 space-y-2 max-h-72 overflow-y-auto pointer-events-auto">
                {categories.map((cat) => (
                  <div key={cat}>
                    <p className={`font-mono text-[9px] uppercase tracking-widest px-0.5 pb-1 border-b mb-1 ${
                      cat === "operator" ? "text-primary border-primary/30" : "text-violet-600 border-violet-400/30"
                    }`}>
                      {cat === "operator" ? "Operator Hazards" : "Statutory Zones"}
                    </p>
                    {HAZARDS.filter((h) => h.category === cat).map((h) => (
                      <div key={h.id} className="flex items-center gap-1.5 py-0.5 rounded group">
                        <button
                          title={activeLayers[h.id] ? "Hide layer" : "Show layer"}
                          onClick={() => toggleLayer(h.id)}
                          className="shrink-0 p-0.5 rounded hover:bg-secondary/60 transition-colors"
                        >
                          <span
                            className="block w-3 h-3 rounded-full border-2 transition-opacity"
                            style={{
                              backgroundColor: activeLayers[h.id] ? h.color : "transparent",
                              borderColor: h.color,
                              opacity: activeLayers[h.id] ? 1 : 0.5,
                            }}
                          />
                        </button>
                        <button
                          onClick={() => setActiveHazardId(activeHazardId === h.id ? "" : h.id)}
                          className={`font-mono text-[10px] leading-tight text-left transition-colors ${
                            activeHazardId === h.id
                              ? "font-bold text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          } ${!activeLayers[h.id] ? "line-through opacity-40" : ""}`}
                        >
                          {h.commonName}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
