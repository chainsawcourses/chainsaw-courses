import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, MapPinned, History, Loader2, LocateFixed, CheckCircle2, AlertTriangle, Plus, Trash2, FileDown, ClipboardCopy,
} from "lucide-react";
import { useUserSession } from "../contexts/UserContext";
import { useSubmitRiskAssessment, useListMyRiskAssessments, getListMyRiskAssessmentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toOsGridReference } from "../lib/osGridRef";
import { printRiskAssessment, copyRiskAssessmentText, type RiskAssessmentExportData } from "../lib/exportPrint";

const BASE = import.meta.env.BASE_URL as string;
function logoUrl() { return `${window.location.origin}${BASE}logo.png`; }

function playBing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1047, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1397, ctx.currentTime + 0.06);
    osc.frequency.exponentialRampToValueAtTime(1319, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => ctx.close();
  } catch {
    // audio not available — silent fail
  }
}

interface HazardRow {
  id: string;
  label: string;
  likelihood: number;
  severity: number;
  controlMeasures: string;
  isCustom?: boolean;
}

const DEFAULT_HAZARDS: HazardRow[] = [
  {
    id: "kickback",
    label: "Chainsaw kickback / loss of control",
    likelihood: 2,
    severity: 5,
    controlMeasures: "Use correct body position at all times; keep left arm straight; never use the tip of the bar; engage chain brake immediately after each cut. Wear full chainsaw PPE including cut-resistant trousers, gloves and helmet with visor.",
  },
  {
    id: "entanglement",
    label: "Contact with moving chain (cutting, tripping into saw)",
    likelihood: 2,
    severity: 5,
    controlMeasures: "Keep clear of the cutting line; engage chain brake when moving or repositioning; lay saw down with bar pointing away from personnel. Maintain a secure two-handed grip at all times. Wear chainsaw-rated leg protection.",
  },
  {
    id: "heavy-log",
    label: "Manual handling of heavy/awkward logs (crush or strain injury)",
    likelihood: 3,
    severity: 3,
    controlMeasures: "Use a timber cant hook, log tongs or mechanical assistance where available. Break work into smaller lifts; bend the knees and keep the load close to the body. Brief co-workers before moving large sections.",
  },
  {
    id: "trip-fall",
    label: "Trips and falls over brash, logs, uneven or wet ground",
    likelihood: 3,
    severity: 3,
    controlMeasures: "Plan and clear the working area and escape routes before starting. Wear chainsaw boots with ankle support. Move brash clear of the cutting area progressively. Do not rush; maintain three points of contact on uneven ground.",
  },
  {
    id: "trapped-bar",
    label: "Bar trapped in timber under compression/tension releasing suddenly",
    likelihood: 3,
    severity: 4,
    controlMeasures: "Assess the direction of stress in the timber before cutting; always cut from the side that will open. Use a felling wedge to relieve compression on the bar if it becomes trapped. Never lever the saw free with the engine running.",
  },
  {
    id: "rolling-timber",
    label: "Cut sections rolling or falling once severed",
    likelihood: 3,
    severity: 3,
    controlMeasures: "Identify the likely roll direction before cutting and position outside that zone. Use stanchions, pegs or natural features to chock rounds. Plan the escape route uphill and to the side; step clear before the cut section moves.",
  },
  {
    id: "noise-vibration",
    label: "Noise and hand-arm vibration (HAVS) exposure",
    likelihood: 4,
    severity: 2,
    controlMeasures: "Wear EN352 hearing protection rated to the saw's noise level. Keep exposure within daily vibration action value limits (2.5 m/s²); record exposure time. Use anti-vibration gloves; keep the saw serviced and cutting sharp to reduce vibration.",
  },
  {
    id: "fuel-fire",
    label: "Fuel handling, spillage or fire risk during refuelling",
    likelihood: 1,
    severity: 4,
    controlMeasures: "Refuel at least 3 metres from any cutting area with the engine fully cold. Use a drip-free fuel can; wipe any spillage before starting. Keep a fire extinguisher accessible. Never refuel near standing water or dry vegetation in high fire-risk conditions.",
  },
  {
    id: "weather-visibility",
    label: "Adverse weather, poor light or visibility on site",
    likelihood: 2,
    severity: 2,
    controlMeasures: "Do not work in winds above Beaufort Scale 5 (small trees begin to sway). Ensure adequate natural or artificial lighting before starting. Stop work if visibility drops below the minimum exclusion zone distance. Wear hi-vis clothing where appropriate.",
  },
  {
    id: "bystanders",
    label: "Bystanders, public or other workers entering the exclusion zone",
    likelihood: 2,
    severity: 4,
    controlMeasures: "Establish a minimum exclusion zone of at least two tree lengths (or 50 m minimum). Use barrier tape, cones or a banksperson on public paths. Brief all workers on the exclusion zone boundaries before work begins. Engage chain brake and cease cutting if anyone enters the zone.",
  },
  {
    id: "lone-working",
    label: "Lone working with no means of summoning help",
    likelihood: 2,
    severity: 5,
    controlMeasures: "Never operate a chainsaw alone — a second competent person trained in emergency first aid must be present, within sight and sound, with access to a trauma kit and a means of calling emergency services. Confirm phone signal before starting work.",
  },
];

function riskRatingOf(likelihood: number, severity: number) {
  return likelihood * severity;
}

function riskBand(rating: number): { label: string; className: string } {
  if (rating >= 15) return { label: "High", className: "text-destructive border-destructive bg-destructive/10" };
  if (rating >= 8) return { label: "Medium", className: "text-amber-600 border-amber-500 bg-amber-500/10" };
  return { label: "Low", className: "text-primary border-primary bg-primary/10" };
}

export default function RiskAssessment() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId, fullName } = useUserSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
    }
  }, [activationCode, deviceId, setLocation]);

  const [siteDescription, setSiteDescription] = useState("");
  const [taskDescription, setTaskDescription] = useState("Cross-cutting felled/heavy timber into logs");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [address, setAddress] = useState("");
  const [gridReference, setGridReference] = useState("");

  const [hazards, setHazards] = useState<HazardRow[]>(DEFAULT_HAZARDS);
  const [submitted, setSubmitted] = useState(false);
  const [exportRecord, setExportRecord] = useState<RiskAssessmentExportData | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleLocate = () => {
    if (!("geolocation" in navigator)) {
      setLocationError("Location services are not available on this device.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCoords({ lat, lon });
        setGridReference(toOsGridReference(lat, lon) ?? "");

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            { headers: { Accept: "application/json" } }
          );
          if (res.ok) {
            const data = await res.json();
            setAddress(data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
          } else {
            setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
          }
        } catch {
          setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Enable it in your browser/device settings to auto-fill the site location."
            : "Could not determine your location. You can enter site details manually below."
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const updateHazard = (id: string, patch: Partial<HazardRow>) => {
    setHazards((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    setSubmitted(false);
  };

  const removeHazard = (id: string) => {
    setHazards((prev) => prev.filter((h) => h.id !== id));
  };

  const addCustomHazard = () => {
    setHazards((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, label: "", likelihood: 1, severity: 1, controlMeasures: "", isCustom: true },
    ]);
  };

  const highestRisk = useMemo(
    () => Math.max(0, ...hazards.map((h) => riskRatingOf(h.likelihood, h.severity))),
    [hazards]
  );

  const submitRiskAssessment = useSubmitRiskAssessment({
    mutation: {
      onSuccess: (data) => {
        setSubmitted(true);
        setExportRecord(data);
        playBing();
        queryClient.invalidateQueries({ queryKey: getListMyRiskAssessmentsQueryKey() });
      },
    },
  });

  const history = useListMyRiskAssessments({
    query: {
      queryKey: getListMyRiskAssessmentsQueryKey(),
      enabled: showHistory && !!deviceId && !!activationCode,
    },
  });

  const handleSubmit = () => {
    if (!deviceId || !activationCode || !taskDescription.trim()) return;
    submitRiskAssessment.mutate({
      data: {
        deviceId,
        activationCode,
        siteDescription: siteDescription.trim() || undefined,
        taskDescription: taskDescription.trim(),
        latitude: coords ? coords.lat.toFixed(6) : undefined,
        longitude: coords ? coords.lon.toFixed(6) : undefined,
        address: address.trim() || undefined,
        gridReference: gridReference.trim() || undefined,
        hazards: hazards
          .filter((h) => h.label.trim())
          .map((h) => ({
            id: h.id,
            label: h.label.trim(),
            likelihood: h.likelihood,
            severity: h.severity,
            riskRating: riskRatingOf(h.likelihood, h.severity),
            controlMeasures: h.controlMeasures.trim() || undefined,
            isCustom: h.isCustom,
          })),
      },
    });
  };

  if (!activationCode || !deviceId) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <MapPinned className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold uppercase tracking-widest text-sm">Risk Assessment</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            className="font-mono uppercase tracking-widest text-xs text-muted-foreground hover:text-primary"
          >
            <History className="w-3.5 h-3.5 mr-1" />
            History
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-6 pb-28">
        <div>
          <h1 className="font-black tracking-tighter text-lg uppercase text-primary mb-1">
            Dynamic Site Risk Assessment
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            Use this before real-world chainsaw work to record your site location and run through common hazards.
            This is a personal working record — it does not unlock or affect your course progress, and it does not
            replace a full written method statement or your employer's formal RAMS process.
          </p>
        </div>

        {showHistory ? (
          <Card className="border-border bg-card/60">
            <CardContent className="p-4 space-y-3">
              <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary">Your Risk Assessment History</h2>
              {history.isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-mono text-xs">Loading...</span>
                </div>
              )}
              {history.data && history.data.length === 0 && (
                <p className="font-mono text-xs text-muted-foreground">No risk assessments recorded yet.</p>
              )}
              {history.data?.map((record) => {
                const maxRisk = Math.max(0, ...record.hazards.map((h) => h.riskRating));
                const band = riskBand(maxRisk);
                return (
                  <div key={record.id} className="border border-border rounded p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {new Date(record.createdAt).toLocaleString()}
                      </span>
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${band.className}`}>
                        {band.label} risk
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-foreground">{record.taskDescription}</p>
                    {record.address && (
                      <p className="font-mono text-[10px] text-muted-foreground">{record.address}</p>
                    )}
                    {record.gridReference && (
                      <p className="font-mono text-[10px] text-muted-foreground">Grid ref: {record.gridReference}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-mono text-[10px] uppercase tracking-wide h-7 px-2"
                        onClick={() => printRiskAssessment({ ...record, studentName: record.studentName || fullName || "" }, logoUrl())}
                      >
                        <FileDown className="w-3 h-3 mr-1" /> PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-mono text-[10px] uppercase tracking-wide h-7 px-2"
                        onClick={() => {
                          navigator.clipboard.writeText(copyRiskAssessmentText({ ...record, studentName: record.studentName || fullName || "" }));
                        }}
                      >
                        <ClipboardCopy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border bg-card/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground">
                    Site Location
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleLocate}
                    disabled={locating}
                    className="font-mono text-[10px] uppercase tracking-widest"
                  >
                    {locating ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : (
                      <LocateFixed className="w-3.5 h-3.5 mr-1" />
                    )}
                    Use My Location
                  </Button>
                </div>
                {locationError && (
                  <p className="font-mono text-[10px] text-destructive">{locationError}</p>
                )}
                {coords && (
                  <div className="text-[10px] font-mono text-muted-foreground space-y-0.5 border border-border rounded p-2 bg-background/60">
                    <p className="text-foreground">{address}</p>
                    <p>Lat/Lon: {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}</p>
                    {gridReference && <p>OS Grid Reference: {gridReference}</p>}
                  </div>
                )}
                <Input
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  placeholder="Site name / description (e.g. Oakfield Wood, Compartment 4)"
                  className="font-mono text-sm bg-background border-border"
                />
              </CardContent>
            </Card>

            <Card className="border-border bg-card/60">
              <CardContent className="p-4">
                <label className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground block mb-2">
                  Task Being Carried Out
                </label>
                <Input
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="e.g. Cross-cutting heavy logs on sloping ground"
                  className="font-mono text-sm bg-background border-border"
                />
              </CardContent>
            </Card>

            <Card className="border-border bg-card/60">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary">
                    Common Hazards
                  </h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={addCustomHazard}
                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add hazard
                  </Button>
                </div>

                {hazards.map((h) => {
                  const rating = riskRatingOf(h.likelihood, h.severity);
                  const band = riskBand(rating);
                  return (
                    <div key={h.id} className="border-b border-border/60 last:border-b-0 pb-4 last:pb-0 space-y-2">
                      {h.isCustom ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={h.label}
                            onChange={(e) => updateHazard(h.id, { label: e.target.value })}
                            placeholder="Describe the hazard"
                            className="font-mono text-xs bg-background border-border"
                          />
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeHazard(h.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <p className="font-mono text-xs text-foreground">{h.label}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          Likelihood
                          <select
                            value={h.likelihood}
                            onChange={(e) => updateHazard(h.id, { likelihood: Number(e.target.value) })}
                            className="font-mono text-[10px] bg-background border border-border rounded px-1 py-0.5"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </label>
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          Severity
                          <select
                            value={h.severity}
                            onChange={(e) => updateHazard(h.id, { severity: Number(e.target.value) })}
                            className="font-mono text-[10px] bg-background border border-border rounded px-1 py-0.5"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </label>
                        <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${band.className}`}>
                          {band.label} ({rating})
                        </span>
                      </div>

                      <Textarea
                        value={h.controlMeasures}
                        onChange={(e) => updateHazard(h.id, { controlMeasures: e.target.value })}
                        placeholder="Control measures (e.g. exclusion zone, correct cutting technique, PPE, second person on site)..."
                        className="font-mono text-xs resize-y min-h-[88px] bg-background border-border"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {submitted && (
              <Card className={highestRisk >= 15 ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5"}>
                <CardContent className="p-4 flex items-start gap-3">
                  {highestRisk >= 15 ? (
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  )}
                  <p className="font-mono text-xs text-foreground">
                    {highestRisk >= 15
                      ? "Risk assessment recorded with one or more high-risk items. Review control measures before starting work and consider stopping if risks cannot be adequately controlled."
                      : "Risk assessment recorded. Review it on site before starting work and stop immediately if conditions change."}
                  </p>
                </CardContent>
              </Card>
            )}

            {exportRecord && (
              <Card className="border-primary/40 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <p className="font-mono font-bold uppercase tracking-widest text-xs text-primary">
                    Export this risk assessment?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-mono text-xs uppercase tracking-wide"
                      onClick={() => printRiskAssessment({ ...exportRecord, studentName: exportRecord.studentName || fullName || "" }, logoUrl())}
                    >
                      <FileDown className="w-3.5 h-3.5 mr-1.5" /> Print / Save as PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-mono text-xs uppercase tracking-wide"
                      onClick={() => {
                        navigator.clipboard.writeText(copyRiskAssessmentText({ ...exportRecord, studentName: exportRecord.studentName || fullName || "" }));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5 mr-1.5" />
                      {copied ? "Copied!" : "Copy as Text"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {!showHistory && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-card/90 backdrop-blur border-t border-border">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">
                {hazards.length} hazard{hazards.length === 1 ? "" : "s"} listed
              </span>
              {submitted && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-primary uppercase tracking-widest animate-in fade-in duration-300">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Assessment saved
                </span>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitRiskAssessment.isPending || !taskDescription.trim()}
              className="font-mono text-sm uppercase tracking-widest px-6 shrink-0"
            >
              {submitRiskAssessment.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <MapPinned className="w-4 h-4 mr-2" />
              )}
              Save Risk Assessment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
