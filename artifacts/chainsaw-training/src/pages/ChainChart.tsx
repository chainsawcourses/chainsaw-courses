import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Cog, Search, CheckCircle2, Info, Tag } from "lucide-react";
import { useUserSession } from "../contexts/UserContext";
import { CHAIN_CHART, PITCH_POWER_GUIDE, CHAIN_LETTER_CODES, type ChainChartRow } from "../data/chainChart";

type Brand = "oregon" | "stihl" | "husqvarna";

const BRAND_LABEL: Record<Brand, string> = {
  oregon: "Oregon",
  stihl: "Stihl",
  husqvarna: "Husqvarna",
};

function normalise(s: string) {
  return s.trim().toUpperCase();
}

function findMatches(brand: Brand, query: string, query2?: string): ChainChartRow[] {
  const q = normalise(query);
  const q2 = normalise(query2 ?? "");
  if (!q && !q2) return [];
  return CHAIN_CHART.filter((row) =>
    row[brand].some((code) => {
      const c = normalise(code);
      return (q && (c === q || c.includes(q))) || (q2 && (c === q2 || c.includes(q2)));
    })
  );
}

export default function ChainChart() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId } = useUserSession();

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
    }
  }, [activationCode, deviceId, setLocation]);

  const [brand, setBrand] = useState<Brand>("oregon");
  const [query, setQuery] = useState("");
  const [stihlQuery2, setStihlQuery2] = useState("");

  const matches = useMemo(
    () => findMatches(brand, query, brand === "stihl" ? stihlQuery2 : undefined),
    [brand, query, stihlQuery2]
  );

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
            <Cog className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold uppercase tracking-widest text-sm">Chain Chart</span>
          </div>
          <div className="w-14" />
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-6 pb-16">
        <div>
          <h1 className="font-black tracking-tighter text-lg uppercase text-primary mb-1">
            Chain Identification Chart
          </h1>
        </div>

        {/* Quick lookup */}
        <Card className="border-border bg-card/60">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" /> Quick Lookup
            </h2>

            <div className="flex gap-2">
              {(Object.keys(BRAND_LABEL) as Brand[]).map((b) => (
                <button
                  key={b}
                  onClick={() => { setBrand(b); setQuery(""); setStihlQuery2(""); }}
                  className={`flex-1 font-mono text-xs uppercase tracking-wide py-2 rounded border transition-colors ${
                    brand === b
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {BRAND_LABEL[b]}
                </button>
              ))}
            </div>

            {brand === "stihl" ? (
              <div className="space-y-3">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Number near depth gauge</label>
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. 3"
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Number on drive link</label>
                  <Input
                    value={stihlQuery2}
                    onChange={(e) => setStihlQuery2(e.target.value)}
                    placeholder="e.g. 63"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            ) : (
              <div>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. 91 (number stamped on the drive link)"
                  className="font-mono text-sm"
                />
              </div>
            )}

            {(query.trim() || stihlQuery2.trim()) && (
              <div className="space-y-2">
                {matches.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" /> No match found for "{query}" on {BRAND_LABEL[brand]}. Double check the number, or refer to your chain box.
                  </p>
                ) : (
                  matches.map((row, i) => (
                    <div key={i} className="border border-primary/40 bg-primary/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-primary font-mono text-xs uppercase tracking-widest">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Match found
                      </div>
                      <p className="font-black text-base">{row.pitch}</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
                        <span className="text-muted-foreground">Gauge</span>
                        <span className="font-bold">{row.gauge}</span>
                        <span className="text-muted-foreground">File Size</span>
                        <span className="font-bold">{row.fileSize}</span>
                        <span className="text-muted-foreground">Top Plate Angle</span>
                        <span className="font-bold">{row.topPlateAngle}</span>
                      </div>
                      {row.notes && (
                        <p className="font-mono text-[11px] text-muted-foreground italic">{row.notes}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Full chart table */}
        <Card className="border-border bg-card/60">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary">
              Full Chain Identification Chart
            </h2>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs font-mono border-collapse min-w-[640px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Pitch</th>
                    <th className="py-2 pr-3">Gauge</th>
                    <th className="py-2 pr-3">Oregon DL#</th>
                    <th className="py-2 pr-3">Stihl DL#</th>
                    <th className="py-2 pr-3">Husqvarna DL#</th>
                    <th className="py-2 pr-3">File Size</th>
                    <th className="py-2">Top Plate</th>
                  </tr>
                </thead>
                <tbody>
                  {CHAIN_CHART.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 align-top">
                      <td className="py-2 pr-3 font-bold whitespace-nowrap">{row.pitch}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{row.gauge}</td>
                      <td className="py-2 pr-3">{row.oregon.join(", ")}</td>
                      <td className="py-2 pr-3">{row.stihl.join(", ")}</td>
                      <td className="py-2 pr-3">{row.husqvarna.join(", ")}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{row.fileSize}</td>
                      <td className="py-2 whitespace-nowrap">{row.topPlateAngle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground italic">
              Always cross-check against your chain box or manufacturer documentation if in doubt — chain
              lettering and drive link numbers can change between product ranges.
            </p>
          </CardContent>
        </Card>

        {/* Pitch to power guide */}
        <Card className="border-border bg-card/60">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary">
              Pitch to Power Guide
            </h2>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs font-mono border-collapse min-w-[480px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Pitch</th>
                    <th className="py-2 pr-3">Power</th>
                    <th className="py-2">Typical Chainsaw Size</th>
                  </tr>
                </thead>
                <tbody>
                  {PITCH_POWER_GUIDE.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-bold whitespace-nowrap">{row.pitch}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{row.power}</td>
                      <td className="py-2">{row.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Chain lettering codes */}
        <Card className="border-border bg-card/60">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Chain Lettering Codes
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground">
              Manufacturers add letters to denote cutter design, e.g. Stihl "23 RMC" = Rapid Mini Comfort.
            </p>
            <div className="space-y-3">
              {(["Stihl", "Husqvarna", "Oregon"] as const).map((b) => (
                <div key={b}>
                  <p className="font-mono font-bold uppercase text-[11px] tracking-widest text-foreground mb-1.5">
                    {b}
                  </p>
                  <div className="space-y-1">
                    {CHAIN_LETTER_CODES.filter((c) => c.brand === b).map((c, i) => (
                      <div key={i} className="flex gap-2 text-xs font-mono">
                        <span className="font-bold text-primary shrink-0 min-w-[3.5rem]">{c.code}</span>
                        <span className="text-muted-foreground">{c.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
