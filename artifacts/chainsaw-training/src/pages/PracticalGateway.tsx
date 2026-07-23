import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, MapPin, Star, CheckCircle2, ChevronRight, Loader2, ExternalLink, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserSession } from "../contexts/UserContext";
import { useGetProgressSummary, getGetProgressSummaryQueryKey, useGetExamStatus, getGetExamStatusQueryKey } from "@workspace/api-client-react";

interface Venue {
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
  website?: string;
  tier: "gold" | "silver";
}

interface Passport {
  postcode: string;
  phone: string;
  ppeConfirmed: boolean;
  competenceConfirmed: boolean;
  gdprConfirmed: boolean;
}

interface Enquiry {
  id: number;
  venueId: number;
  status: string;
  createdAt: string;
}

const PPE_ITEMS = [
  "CE/UKCA Approved Helmet with Visor & Ear Protection",
  "Chainsaw-Resistant Trousers (EN 11393)",
  "Chainsaw Boots (EN ISO 17249)",
  "Cut-Resistant Gloves",
  "PUWER-compliant chainsaw with all safety features present and working",
];

export default function PracticalGateway() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId, fullName, email } = useUserSession();
  useGetProgressSummary({ query: { queryKey: getGetProgressSummaryQueryKey(), enabled: !!activationCode && !!deviceId } });
  const { data: examStatus } = useGetExamStatus({ query: { queryKey: getGetExamStatusQueryKey(), enabled: !!activationCode && !!deviceId } });

  const examPassed = examStatus?.passed ?? false;

  const [passport, setPassport] = useState<Passport | null>(null);
  const [passportLoading, setPassportLoading] = useState(true);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [registeringId, setRegisteringId] = useState<number | null>(null);
  const [registeredIds, setRegisteredIds] = useState<Set<number>>(new Set());

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [competenceChecked, setCompetenceChecked] = useState(false);
  const [ppeChecked, setPpeChecked] = useState<boolean[]>(PPE_ITEMS.map(() => false));
  const [wpPostcode, setWpPostcode] = useState("");
  const [wpPhone, setWpPhone] = useState("");
  const [gdprChecked, setGdprChecked] = useState(false);
  const [savingPassport, setSavingPassport] = useState(false);

  const headers = { activationcode: activationCode ?? "", deviceid: deviceId ?? "" };

  const fetchAll = useCallback(async () => {
    if (!activationCode || !deviceId) return;
    const [pRes, vRes, eRes] = await Promise.all([
      fetch("/api/gateway/passport", { headers }),
      fetch("/api/gateway/venues", { headers }),
      fetch("/api/gateway/enquiries", { headers }),
    ]);
    if (pRes.ok) { const p = await pRes.json(); setPassport(p); }
    if (vRes.ok) { setVenues(await vRes.json()); }
    if (eRes.ok) {
      const eq: Enquiry[] = await eRes.json();
      setEnquiries(eq);
      setRegisteredIds(new Set(eq.filter(e => e.status !== "resolved" && e.status !== "expired").map(e => e.venueId)));
    }
    setPassportLoading(false);
  }, [activationCode, deviceId]);

  useEffect(() => {
    if (!activationCode || !deviceId) { setLocation("/"); return; }
    fetchAll();
  }, [activationCode, deviceId, fetchAll, setLocation]);

  if (!activationCode || !deviceId) return null;

  if (!examPassed && !passportLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <Award className="w-12 h-12 text-muted-foreground" />
        <h2 className="font-black tracking-tighter text-xl uppercase">Certificate Required</h2>
        <p className="text-muted-foreground text-sm max-w-xs">Complete the final exam and earn your certificate before accessing the Practical Progression Gateway.</p>
        <Button asChild variant="outline" size="sm"><Link href="/training"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Training</Link></Button>
      </div>
    );
  }

  // ─── Assessment Passport Wizard ────────────────────────────────────────────

  const allPpeChecked = ppeChecked.every(Boolean);

  const savePassport = async () => {
    setSavingPassport(true);
    try {
      const res = await fetch("/api/gateway/passport", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          postcode: wpPostcode.trim().toUpperCase(),
          phone: wpPhone.trim(),
          ppeConfirmed: allPpeChecked,
          competenceConfirmed: competenceChecked,
          gdprConfirmed: gdprChecked,
        }),
      });
      if (res.ok) { await fetchAll(); }
    } finally {
      setSavingPassport(false);
    }
  };

  if (!passportLoading && !passport) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
              <Link href="/training"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
            </Button>
            <span className="font-mono font-bold uppercase tracking-widest text-xs">Assessment Passport</span>
            <div className="w-20" />
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-8">
          <div className="mb-6 text-center">
            <h1 className="font-black tracking-tighter text-2xl uppercase text-primary">Assessment Passport</h1>
            <p className="text-muted-foreground text-sm mt-1">Complete once to access the Practical Progression Gateway</p>
            <div className="flex justify-center gap-2 mt-4">
              {[1,2,3].map(s => (
                <div key={s} className={`w-8 h-1.5 rounded-full transition-colors ${wizardStep >= s ? "bg-[#e27226]" : "bg-border"}`} />
              ))}
            </div>
          </div>

          {wizardStep === 1 && (
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <h2 className="font-mono font-bold uppercase tracking-widest text-sm">Step 1 — Physical Competence</h2>
                <p className="text-sm text-muted-foreground">Before booking a practical assessment, you must have real hands-on experience operating a chainsaw safely.</p>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={competenceChecked} onChange={e => setCompetenceChecked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#e27226] shrink-0" />
                  <span className="text-sm leading-relaxed">I confirm I have physical experience <strong>starting, holding, and operating a chainsaw safely</strong> prior to attending a practical assessment.</span>
                </label>
                <Button className="w-full font-mono tracking-widest" disabled={!competenceChecked} onClick={() => setWizardStep(2)}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}

          {wizardStep === 2 && (
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <h2 className="font-mono font-bold uppercase tracking-widest text-sm">Step 2 — PPE &amp; Equipment</h2>
                <p className="text-sm text-muted-foreground">Confirm you have access to all required PPE and a compliant chainsaw for assessment day.</p>
                <div className="space-y-2.5">
                  {PPE_ITEMS.map((item, i) => (
                    <label key={i} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={ppeChecked[i]} onChange={e => { const next = [...ppeChecked]; next[i] = e.target.checked; setPpeChecked(next); }} className="mt-0.5 w-4 h-4 accent-[#e27226] shrink-0" />
                      <span className="text-sm leading-relaxed">{item}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="font-mono tracking-widest" onClick={() => setWizardStep(1)}>Back</Button>
                  <Button className="flex-1 font-mono tracking-widest" disabled={!allPpeChecked} onClick={() => setWizardStep(3)}>
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {wizardStep === 3 && (
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <h2 className="font-mono font-bold uppercase tracking-widest text-sm">Step 3 — Your Details &amp; GDPR</h2>
                <p className="text-sm text-muted-foreground">Your postcode is used to find nearby assessment centres. Your contact details are shared with venues only — never between candidates.</p>
                <div className="space-y-3">
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground block mb-1">Postcode</label>
                    <input value={wpPostcode} onChange={e => setWpPostcode(e.target.value.toUpperCase())} placeholder="e.g. SW1A 1AA" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase tracking-widest" />
                  </div>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground block mb-1">Phone Number</label>
                    <input value={wpPhone} onChange={e => setWpPhone(e.target.value)} placeholder="e.g. 07700 900000" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={gdprChecked} onChange={e => setGdprChecked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#e27226] shrink-0" />
                    <span className="text-sm leading-relaxed">I consent to sharing my contact details (name, email, postcode, and phone number) with matched assessment venues for booking purposes only. I understand these details will not be shared with other candidates.</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="font-mono tracking-widest" onClick={() => setWizardStep(2)}>Back</Button>
                  <Button className="flex-1 font-mono tracking-widest" disabled={!wpPostcode || !wpPhone || !gdprChecked || savingPassport} onClick={savePassport}>
                    {savingPassport ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <>Access Gateway <ChevronRight className="w-4 h-4 ml-1" /></>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    );
  }

  // ─── Main Gateway Map ──────────────────────────────────────────────────────

  const handleRegisterInterest = async (venue: Venue) => {
    if (!activationCode || !deviceId || registeringId) return;
    setRegisteringId(venue.id);
    try {
      // Open mailto first (non-blocking)
      const subject = encodeURIComponent(`NPTC 201/202 Assessment Enquiry — ${fullName ?? "Candidate"}`);
      const body = encodeURIComponent(
        `Dear ${venue.name} Assessment Team,\n\nI am writing to enquire about availability for an NPTC Unit 201/202 (Chainsaw Maintenance & Cross Cutting) practical assessment.\n\nMy details:\n  Name: ${fullName ?? ""}\n  Email: ${email ?? ""}\n  Postcode: ${passport?.postcode ?? ""}\n  Phone: ${passport?.phone ?? ""}\n\nI have recently completed the Chainsaw Courses theoretical training programme and hold a Certificate of Completion.\n\nPlease could you advise on upcoming assessment dates and your deposit/payment process?\n\nKind regards,\n${fullName ?? ""}`,
      );
      window.open(`mailto:${venue.email}?subject=${subject}&body=${body}`, "_blank");

      // Register silently in background
      await fetch("/api/gateway/enquiries", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id }),
      });
      setRegisteredIds(prev => new Set([...prev, venue.id]));
    } finally {
      setRegisteringId(null);
    }
  };

  const [studentLatLng, setStudentLatLng] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!passport?.postcode) return;
    const pc = passport.postcode.replace(/\s+/g, "").toUpperCase();
    fetch(`https://api.postcodes.io/postcodes/${pc}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.result) setStudentLatLng([d.result.latitude, d.result.longitude]); })
      .catch(() => {});
  }, [passport?.postcode]);

  const mapCenter: [number, number] = studentLatLng ?? (venues.length > 0 ? [53.5, -1.5] : [52.5, -1.5]);
  const mapZoom = studentLatLng ? 9 : 6;

  function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/training"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-[#e27226] shrink-0" />
            <span className="font-mono font-bold uppercase tracking-wide text-xs whitespace-nowrap">Practical Progression Gateway</span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 space-y-4 pb-10">
        <div>
          <h1 className="font-black tracking-tighter text-lg uppercase text-primary">Assessment Network Map</h1>
          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">Find an NPTC-approved assessment centre near you. Click a venue to register your interest.</p>
          <p className="font-mono text-[11px] text-muted-foreground mt-1">
            <span className="text-foreground font-semibold">Booking timeline:</span> Allow approximately 4–6 weeks from your initial contact email to finalise a confirmed assessment date. Reach out to venues as early as possible — some operate on a cohort basis.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Map */}
          <div className="rounded-lg overflow-hidden border border-border" style={{ height: 420 }}>
            {passportLoading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                <MapController center={mapCenter} zoom={mapZoom} />
                {studentLatLng && (
                  <CircleMarker
                    center={studentLatLng}
                    radius={10}
                    pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 2 }}
                  >
                    <Popup>
                      <div className="font-sans text-sm"><div className="font-bold">Your Location</div><div className="text-xs text-gray-500">{passport?.postcode}</div></div>
                    </Popup>
                  </CircleMarker>
                )}
                {venues.map(venue => (
                  <CircleMarker
                    key={venue.id}
                    center={[venue.lat, venue.lng]}
                    radius={8}
                    pathOptions={{
                      color: "#c9621f",
                      fillColor: "#e27226",
                      fillOpacity: selectedVenue?.id === venue.id ? 1 : 0.7,
                      weight: selectedVenue?.id === venue.id ? 3 : 1.5,
                    }}
                    eventHandlers={{ click: () => setSelectedVenue(venue) }}
                  >
                    <Popup>
                      <div className="font-sans text-sm min-w-[200px]">
                        <div className="font-bold">{venue.name}</div>
                        <div className="text-xs text-gray-500">{venue.town}, {venue.county}</div>
                        <div className="text-xs mt-1">{venue.postcode}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            )}
          </div>

          {/* Venue panel */}
          <div className="space-y-3">
            {selectedVenue ? (
              <Card className="border-border bg-card/80">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-mono font-bold text-sm uppercase tracking-widest leading-tight">{selectedVenue.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedVenue.town}, {selectedVenue.county}</p>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>{selectedVenue.address}</div>
                    <div>{selectedVenue.postcode}</div>
                    <div className="font-mono">{selectedVenue.phone}</div>
                    <div className="truncate">{selectedVenue.email}</div>
                  </div>
                  {selectedVenue.website && (
                    <a href={selectedVenue.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#e27226] hover:underline">
                      <ExternalLink className="w-3 h-3" /> Visit website
                    </a>
                  )}
                  {registeredIds.has(selectedVenue.id) ? (
                    <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="text-xs font-mono text-green-700 dark:text-green-400">Enquiry registered — email sent</span>
                    </div>
                  ) : (
                    <Button
                      className="w-full font-mono tracking-widest text-xs"
                      onClick={() => handleRegisterInterest(selectedVenue)}
                      disabled={registeringId === selectedVenue.id}
                    >
                      {registeringId === selectedVenue.id
                        ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Preparing…</>
                        : <><MapPin className="w-3.5 h-3.5 mr-2" /> Register Interest</>}
                    </Button>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                    This opens a pre-written email to the venue. Please send it — we'll also log your interest to help coordinate group bookings.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border border-dashed bg-card/40">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="font-mono text-xs">Click a pin on the map to view venue details</p>
                  <p className="font-mono text-[10px] mt-1 opacity-70">{venues.length} {venues.length === 1 ? "venue" : "venues"} available</p>
                </CardContent>
              </Card>
            )}

          </div>
        </div>

        {/* Active enquiries */}
        {enquiries.filter(e => e.status !== "resolved" && e.status !== "expired").length > 0 && (
          <div>
            <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2">Your Active Enquiries</h2>
            <div className="space-y-2">
              {enquiries.filter(e => e.status !== "resolved" && e.status !== "expired").map(e => {
                const v = venues.find(v => v.id === e.venueId);
                return v ? (
                  <div key={e.id} className="flex items-center justify-between rounded-md border border-border bg-card/60 px-3 py-2">
                    <div>
                      <span className="font-mono text-xs font-bold">{v.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground ml-2">{v.town}, {v.county}</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">{e.status.replace(/_/g, " ")}</Badge>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
