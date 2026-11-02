import { Fragment, useEffect, useState, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, ExternalLink, Search, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserSession } from "../contexts/UserContext";
import { ChainsawLoader } from "@/components/ui/chainsaw-loader";
import chainsawRetailerIcon from "@assets/chainsaw-retailer-header-icon.png";

interface Retailer {
  id: number;
  name: string;
  address: string;
  town: string;
  county: string;
  postcode: string;
  lat: number;
  lng: number;
  email: string;
  phone: string;
  website: string | null;
  featured: boolean;
  logoUrl: string | null;
}

function RetailerLogo({
  retailer,
  size = "default",
}: {
  retailer: Pick<Retailer, "id" | "name" | "logoUrl">;
  size?: "small" | "default" | "large";
}) {
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setUnavailable(false);
  }, [retailer.logoUrl]);

  if (!retailer.logoUrl || unavailable) return null;

  const sizeClass = {
    small: "h-10 w-10",
    default: "h-12 w-12 sm:h-14 sm:w-14",
    large: "h-14 w-14 sm:h-16 sm:w-16",
  }[size];

  return (
    <img
      data-testid={`img-retailer-logo-${retailer.id}`}
      src={retailer.logoUrl}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setUnavailable(true)}
      className={`${sizeClass} shrink-0 rounded border border-border bg-white p-1 object-contain`}
    />
  );
}

function getRetailerWebsiteUrl(website: string) {
  return website.startsWith("http") ? website : `https://${website}`;
}

function getRetailerWebsiteLabel(website: string) {
  return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function getAddressWithoutPostcode(retailer: Retailer) {
  if (!retailer.postcode) return retailer.address;
  const escapedPostcode = retailer.postcode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return retailer.address.replace(new RegExp(`(?:,?\\s*)${escapedPostcode}$`, "i"), "").trim();
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map]);
  return null;
}

function RetailerFocusController({ target }: { target: { id: number; lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.setView([target.lat, target.lng], Math.max(map.getZoom(), 11));
    map.getContainer().dataset.retailerFocusZoom = String(map.getZoom());
  }, [target, map]);
  return null;
}

function TouchMapController() {
  const map = useMap();
  const [usesCoarsePointer, setUsesCoarsePointer] = useState(false);

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const updateInteraction = () => {
      setUsesCoarsePointer(coarsePointer.matches);
      if (coarsePointer.matches) {
        map.dragging.disable();
        map.touchZoom.enable();
      } else {
        map.dragging.enable();
      }
    };

    updateInteraction();
    coarsePointer.addEventListener("change", updateInteraction);
    return () => coarsePointer.removeEventListener("change", updateInteraction);
  }, [map]);

  return usesCoarsePointer ? (
    <div className="pointer-events-none absolute bottom-7 left-1/2 z-[500] -translate-x-1/2 whitespace-nowrap rounded bg-background/90 px-2 py-1 font-mono text-[9px] text-foreground shadow">
      Use two fingers to move the map
    </div>
  ) : null;
}

// Calculate distance between two coordinates in miles
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Radius of the earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
}

export default function Retailers() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId } = useUserSession();

  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [expandedFeaturedRetailerId, setExpandedFeaturedRetailerId] = useState<number | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ id: number; lat: number; lng: number } | null>(null);

  const [searchPostcode, setSearchPostcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchAnnouncement, setSearchAnnouncement] = useState("");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const searchRequestRef = useRef<{ id: number; controller: AbortController } | null>(null);

  const headers = useMemo(() => ({ activationcode: activationCode ?? "", deviceid: deviceId ?? "" }), [activationCode, deviceId]);

  useEffect(() => {
    if (!activationCode || !deviceId) { setLocation("/"); return; }
    const fetchRetailers = async () => {
      try {
        const res = await fetch("/api/retailers", { headers, cache: "no-store" });
        if (res.ok) {
          setRetailers(await res.json());
        } else {
          setLoadError("The retailer directory is unavailable at the moment. Please try again later.");
        }
      } catch (err) {
        console.error("Failed to fetch retailers", err);
        setLoadError("The retailer directory is unavailable at the moment. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchRetailers();
  }, [activationCode, deviceId, headers, setLocation]);

  useEffect(() => () => {
    searchRequestRef.current?.controller.abort();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const pc = searchPostcode.trim();
    if (!pc) return;

    searchRequestRef.current?.controller.abort();
    const request = {
      id: (searchRequestRef.current?.id ?? 0) + 1,
      controller: new AbortController(),
    };
    searchRequestRef.current = request;

    setSearching(true);
    setSearchError("");
    setSearchAnnouncement(`Searching for retailers near ${pc}.`);
    try {
      const res = await fetch("/api/retailers/postcode", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ postcode: pc }),
        signal: request.controller.signal,
      });
      const data = await res.json();
      if (searchRequestRef.current?.id !== request.id) return;
      if (!res.ok) {
        const message = data.error || "Could not find postcode.";
        setSearchError(message);
        setSearchAnnouncement(`Postcode search failed. ${message}`);
        return;
      }
      setUserLocation([data.lat, data.lng]);
      setSearchAnnouncement(`Postcode search complete for ${pc}. Retailers are sorted by distance.`);
    } catch (err) {
      if (searchRequestRef.current?.id !== request.id || request.controller.signal.aborted) return;
      const message = "Failed to search postcode.";
      setSearchError(message);
      setSearchAnnouncement(`Postcode search failed. ${message}`);
    } finally {
      if (searchRequestRef.current?.id === request.id) {
        setSearching(false);
      }
    }
  };

  const sortedRetailers = useMemo(() => {
    return [...retailers].sort((a, b) => {
      if (userLocation) {
        const distA = getDistance(userLocation[0], userLocation[1], a.lat, a.lng);
        const distB = getDistance(userLocation[0], userLocation[1], b.lat, b.lng);
        if (distA !== distB) return distA - distB;
      }
      return a.name.localeCompare(b.name, "en-GB");
    });
  }, [retailers, userLocation]);

  const featuredRetailers = useMemo(
    () => sortedRetailers.filter((retailer) => retailer.featured),
    [sortedRetailers],
  );
  const mapRetailers = useMemo(
    () => [
      ...sortedRetailers.filter((retailer) => !retailer.featured),
      ...sortedRetailers.filter((retailer) => retailer.featured),
    ],
    [sortedRetailers],
  );

  if (!activationCode || !deviceId) return null;

  const mapCenter: [number, number] = userLocation ?? (retailers.length > 0 ? [53.0, -1.5] : [52.5, -1.5]);
  const mapZoom = userLocation ? 11 : 6;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/training"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
          <div className="flex min-w-0 items-center justify-self-center gap-1.5 sm:gap-2 text-[#e27226]">
            <span
              aria-hidden="true"
              data-testid="retailer-page-header-chainsaw-icon"
              className="block h-4 w-8 shrink-0 bg-black"
              style={{
                WebkitMaskImage: `url(${chainsawRetailerIcon})`,
                maskImage: `url(${chainsawRetailerIcon})`,
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
              }}
            />
            <span className="truncate font-mono text-[11px] font-bold uppercase tracking-wide sm:text-xs">Chainsaw Retailers</span>
          </div>
          <div className="w-0 sm:w-20" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 space-y-4 pb-10">
        <div>
          <h1 className="font-black tracking-tighter text-lg uppercase text-primary">Retailer Directory</h1>
          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">Find a local stockist for chainsaw equipment, PPE, and maintenance tools.</p>
        </div>

        {/* Disclaimer */}
        <details className="group rounded-md border border-border bg-muted/40 font-mono">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-xs font-bold uppercase tracking-widest text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e27226] [&::-webkit-details-marker]:hidden">
            <Info className="h-4 w-4 shrink-0 text-[#e27226]" />
            <span>Disclaimer</span>
            <span aria-hidden="true" className="ml-auto text-[#e27226] transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <p className="border-t border-border px-3 pb-3 pt-2 text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
            The retailers listed below are independent businesses. Chainsaw Courses does not guarantee stock availability, price, or suitability of goods. Your postcode is used transiently to calculate distance and is not retained or shared with retailers. Always confirm equipment standards (CE/UKCA) before purchase.
          </p>
        </details>

        {featuredRetailers.length > 0 && (
          <section aria-labelledby="featured-retailers-heading" className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span
                data-testid="featured-retailers-heading-dot"
                className="h-4 w-4 shrink-0 rounded-full border-[3px] border-slate-300 bg-white shadow-sm"
                aria-hidden="true"
              />
              <h2 id="featured-retailers-heading" className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                Featured Retailers
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {featuredRetailers.map((retailer) => {
                const isExpanded = expandedFeaturedRetailerId === retailer.id;
                return (
                  <div key={retailer.id} className="rounded-md border border-[#e27226]/50 bg-card transition-colors hover:border-[#e27226] hover:bg-[#e27226]/5">
                    <button
                      type="button"
                      aria-label={`View featured retailer ${retailer.name} details and location`}
                      aria-expanded={isExpanded}
                      onClick={() => {
                        setSelectedRetailer(null);
                        setExpandedFeaturedRetailerId(isExpanded ? null : retailer.id);
                        setFocusTarget({ id: retailer.id, lat: retailer.lat, lng: retailer.lng });
                      }}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e27226]"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <RetailerLogo retailer={retailer} />
                        <span className="min-w-0 flex-1">
                          <span className="featured-retailer-name flex min-w-0 items-center gap-2 font-mono text-xs font-bold uppercase text-[#e27226]">
                            <span className="featured-retailer-dot h-2.5 w-2.5 shrink-0 rounded-full border border-stone-300 bg-white shadow-sm" aria-hidden="true" />
                            <span className="truncate">{retailer.name}</span>
                          </span>
                          <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
                            {retailer.town || retailer.address || retailer.postcode}
                          </span>
                        </span>
                      </div>
                      <Badge className="shrink-0 border-[#e27226]/40 bg-[#e27226]/10 text-[#b54f13] hover:bg-[#e27226]/10">
                        Featured
                      </Badge>
                    </button>
                    {isExpanded && (
                      <div data-testid={`featured-retailer-details-${retailer.id}`} className="space-y-2 border-t border-[#e27226]/20 px-3 pb-3 pt-2 font-mono text-xs text-muted-foreground">
                         <div>{getAddressWithoutPostcode(retailer)}</div>
                         {retailer.website ? (
                           <a
                             href={getRetailerWebsiteUrl(retailer.website)}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="inline-flex max-w-full items-center gap-1 font-bold text-[#c9621f] underline underline-offset-2 hover:text-[#e27226]"
                           >
                             <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                             <span className="truncate">{getRetailerWebsiteLabel(retailer.website)}</span>
                           </a>
                         ) : (
                           <div>Website unavailable</div>
                         )}
                        <div>{retailer.phone}</div>
                        <div className="break-all">{retailer.email}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Map & Search */}
          <div className="space-y-3">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                aria-label="Postcode"
                autoComplete="postal-code"
                type="text"
                placeholder="Enter postcode to find nearest..."
                value={searchPostcode}
                onChange={e => setSearchPostcode(e.target.value.toUpperCase())}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase tracking-widest"
              />
              <Button type="submit" disabled={!searchPostcode.trim()} className="font-mono tracking-widest">
                {searching ? <ChainsawLoader className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                <span className="sr-only sm:not-sr-only sm:ml-2">Search</span>
              </Button>
            </form>
            <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {searchAnnouncement}
            </p>
            {searchError && <p className="text-xs text-red-500 font-mono">{searchError}</p>}
            {loadError && <p role="alert" className="text-xs text-red-500 font-mono">{loadError}</p>}

            <div
              className="relative rounded-lg overflow-hidden border border-border"
              style={{ height: 420 }}
              data-map-center={mapCenter.join(",")}
              data-map-zoom={mapZoom}
            >
              {loading ? (
                <div className="h-full flex items-center justify-center"><ChainsawLoader className="w-6 h-6 text-muted-foreground" /></div>
              ) : (
                <>
                  <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={false}
                    touchZoom
                  >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                  <MapController center={mapCenter} zoom={mapZoom} />
                  <RetailerFocusController target={focusTarget} />
                  <TouchMapController />
                  
                  {userLocation && (
                    <CircleMarker
                      center={userLocation}
                      radius={10}
                      className="retailer-search-location-marker"
                      pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 2 }}
                    >
                      <Popup>
                        <div className="font-sans text-sm font-bold">Search Location</div>
                      </Popup>
                    </CircleMarker>
                  )}

                  {mapRetailers.map(r => {
                    const isSelectedStandardRetailer = !r.featured && selectedRetailer?.id === r.id;
                    const selectRetailer = () => {
                      setExpandedFeaturedRetailerId(null);
                      setSelectedRetailer(r);
                    };

                    return (
                      <Fragment key={r.id}>
                        <CircleMarker
                          center={[r.lat, r.lng]}
                          radius={20}
                          className={`retailer-marker-tap-target retailer-marker-tap-target-${r.id}`}
                          pathOptions={{
                            color: "transparent",
                            fillColor: "transparent",
                            fillOpacity: 0,
                            opacity: 0,
                            weight: 0,
                          }}
                          eventHandlers={{ click: selectRetailer }}
                        />
                        <CircleMarker
                          center={[r.lat, r.lng]}
                          radius={r.featured ? 10 : 8}
                          className={`retailer-marker-${r.id}${r.featured ? " retailer-marker-featured" : ""}${isSelectedStandardRetailer ? " retailer-marker-selected" : ""}`}
                          pathOptions={{
                            color: r.featured ? "#cbd5e1" : isSelectedStandardRetailer ? "#8f3b0c" : "#c9621f",
                            fillColor: r.featured ? "#ffffff" : isSelectedStandardRetailer ? "#b54f13" : "#e27226",
                            fillOpacity: r.featured ? 1 : isSelectedStandardRetailer ? 0.95 : 0.7,
                            weight: r.featured ? 3 : isSelectedStandardRetailer ? 2.5 : 1.5,
                          }}
                          eventHandlers={{ click: selectRetailer }}
                        >
                          <Popup keepInView autoPanPadding={[16, 16]}>
                            <div className="w-[160px] font-sans text-sm sm:w-auto sm:min-w-[200px]">
                              <div className="font-bold">{r.name}</div>
                               {r.website ? (
                                 <a
                                   href={getRetailerWebsiteUrl(r.website)}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-semibold text-[#c9621f] underline underline-offset-2"
                                 >
                                   <ExternalLink className="h-3 w-3 shrink-0" />
                                   <span className="truncate">{getRetailerWebsiteLabel(r.website)}</span>
                                 </a>
                               ) : (
                                 <div className="mt-1 text-xs text-gray-500">Website unavailable</div>
                               )}
                            </div>
                          </Popup>
                        </CircleMarker>
                      </Fragment>
                    );
                  })}
                  </MapContainer>
                </>
              )}
            </div>
          </div>

          {/* Retailer panel / list */}
          <div className="space-y-3 lg:max-h-[500px] lg:overflow-y-auto">
            {selectedRetailer && (
              <Card data-testid="selected-retailer-panel" className="border-[#e27226]/50 bg-card shadow-sm sticky top-0 z-10">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <RetailerLogo retailer={selectedRetailer} size="large" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-mono font-bold text-sm uppercase tracking-widest leading-tight">{selectedRetailer.name}</h3>
                      {[selectedRetailer.town, selectedRetailer.county].filter(Boolean).length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                          {[selectedRetailer.town, selectedRetailer.county].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <Button aria-label="Close retailer details" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setSelectedRetailer(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 font-mono">
                     <div>{getAddressWithoutPostcode(selectedRetailer)}</div>
                     {selectedRetailer.website ? (
                       <a
                         href={getRetailerWebsiteUrl(selectedRetailer.website)}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="inline-flex max-w-full items-center gap-1 font-bold text-[#c9621f] underline underline-offset-2 hover:text-[#e27226]"
                       >
                         <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                         <span className="truncate">{getRetailerWebsiteLabel(selectedRetailer.website)}</span>
                       </a>
                     ) : (
                       <div>Website unavailable</div>
                     )}
                    <div>{selectedRetailer.phone}</div>
                    <div className="truncate">{selectedRetailer.email}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <h2 className="font-mono font-bold uppercase tracking-widest text-[10px] text-muted-foreground px-1">
                {userLocation ? "Nearest Retailers" : "All Retailers"}
              </h2>
              {sortedRetailers.map(r => (
                <button
                  key={r.id}
                  onClick={() => {
                    setExpandedFeaturedRetailerId(null);
                    setSelectedRetailer(r);
                    setFocusTarget({ id: r.id, lat: r.lat, lng: r.lng });
                  }}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${selectedRetailer?.id === r.id ? 'border-[#e27226] bg-[#e27226]/5' : 'border-border bg-card hover:border-[#e27226]/50'}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <RetailerLogo retailer={r} size="small" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-bold text-xs uppercase truncate">{r.name}</div>
                      <div className="flex justify-between items-center mt-1 text-[10px] text-muted-foreground font-mono">
                        <span className="truncate pr-2">{r.town || r.address || r.postcode}</span>
                        {userLocation && (
                          <span className="shrink-0 font-bold">{getDistance(userLocation[0], userLocation[1], r.lat, r.lng).toFixed(1)} miles</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {!loading && !loadError && sortedRetailers.length === 0 && (
                <p className="rounded-md border border-border bg-card p-4 text-center font-mono text-xs text-muted-foreground">
                  No verified retailers are currently available.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}