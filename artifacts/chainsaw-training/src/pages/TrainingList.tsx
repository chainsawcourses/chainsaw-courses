import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock, PlayCircle, CheckCircle, ShieldAlert, Award, LogOut, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useListModules, getListModulesQueryKey, useGetProgressSummary, getGetProgressSummaryQueryKey } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";

export default function TrainingList() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId, fullName, clearSession } = useUserSession();
  const [equipmentOpen, setEquipmentOpen] = useState(false);

  const { data: modules, isLoading: isLoadingModules } = useListModules({
    query: { queryKey: getListModulesQueryKey(), enabled: !!activationCode && !!deviceId }
  });

  const { data: summary, isLoading: isLoadingSummary } = useGetProgressSummary({
    query: { queryKey: getGetProgressSummaryQueryKey(), enabled: !!activationCode && !!deviceId }
  });

  useEffect(() => {
    if (!activationCode || !deviceId) setLocation("/");
  }, [activationCode, deviceId, setLocation]);

  // Group remaining modules by category → sub-category, preserving DB order
  // Equipment List module is excluded from the main list (shown in the collapsible above)
  const grouped = useMemo(() => {
    if (!modules) return [];
    const filtered = modules.filter((m) => !m.title.toLowerCase().includes("equipment"));
    const categoryOrder: string[] = [];
    const categoryMap = new Map<string, Map<string | null, typeof modules>>();
    filtered.forEach((mod) => {
      if (!categoryMap.has(mod.category)) {
        categoryMap.set(mod.category, new Map());
        categoryOrder.push(mod.category);
      }
      const catMap = categoryMap.get(mod.category)!;
      const key = mod.subCategory ?? null;
      if (!catMap.has(key)) catMap.set(key, []);
      catMap.get(key)!.push(mod);
    });
    return categoryOrder.map((cat) => ({
      category: cat,
      subGroups: Array.from(categoryMap.get(cat)!.entries()).map(([sub, mods]) => ({
        subCategory: sub,
        modules: mods,
      })),
    }));
  }, [modules]);

  if (isLoadingModules || isLoadingSummary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-primary font-mono tracking-widest uppercase">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          Loading Modules...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-primary" />
            <h1 className="font-mono font-black tracking-tighter text-lg uppercase">Chainsaw Manual</h1>
          </div>
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-3">
            <span className="hidden sm:inline-block">OPERATOR: {fullName}</span>
            <Button variant="outline" size="sm" className="font-mono text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground" asChild>
              <Link href="/mock-test">MOCK EXAM</Link>
            </Button>
            <Button variant="ghost" size="sm" className="font-mono text-xs text-muted-foreground hover:text-destructive"
              onClick={() => { clearSession(); window.location.href = import.meta.env.BASE_URL; }}>
              <LogOut className="w-3 h-3 mr-1" /> LOG OUT
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-8 space-y-8">

        {/* Progress Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/60 border-border md:col-span-2">
            <CardContent className="p-6 flex flex-col justify-center h-full">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <div className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-1">Overall Progress</div>
                  <div className="text-4xl font-black font-mono">{summary?.percentComplete || 0}%</div>
                </div>
                {summary?.certificateEarned && (
                  <Badge variant="default" className="bg-primary hover:bg-primary text-primary-foreground font-mono">
                    <Award className="w-3 h-3 mr-1" /> CERTIFIED
                  </Badge>
                )}
              </div>
              <Progress value={summary?.percentComplete || 0} className="h-3 bg-secondary" />
            </CardContent>
          </Card>
          <Card className="bg-card/60 border-border">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Modules</span>
                <span className="font-mono font-bold">{summary?.completedModules || 0} / {summary?.totalModules || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Quizzes Passed</span>
                <span className="font-mono font-bold">{summary?.quizzesPassed || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-muted-foreground uppercase">Status</span>
                <span className={`font-mono font-bold text-xs ${summary?.certificateEarned ? 'text-primary' : 'text-muted-foreground'}`}>
                  {summary?.certificateEarned ? 'COMPLETE' : 'IN PROGRESS'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Equipment List — collapsible, always accessible */}
        <div>
          <button
            onClick={() => setEquipmentOpen((o) => !o)}
            className="w-full flex items-center gap-3 py-3 text-left group"
          >
            <div className="w-1 h-6 bg-primary shrink-0" />
            <h2 className="font-mono font-black uppercase tracking-widest text-base text-foreground flex-1">
              Tools & Equipment Needed
            </h2>
            {equipmentOpen
              ? <ChevronDown className="w-4 h-4 text-primary shrink-0" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
            }
          </button>

          {equipmentOpen && (
            <Card className="border-border bg-card/60 mt-1">
              <CardContent className="p-6 space-y-6 font-mono text-sm text-foreground">

                <div>
                  <h3 className="font-bold uppercase tracking-widest text-xs text-primary mb-2">Personal Protective Equipment (PPE)</h3>
                  <p className="text-xs text-muted-foreground mb-2">All PPE must conform to CE/EN/UK standards.</p>
                  <ul className="space-y-1 text-xs text-muted-foreground list-none">
                    {["Chainsaw safety leg protection","Chainsaw safety footwear","Safety helmet","Eye and ear protection","Gloves appropriate for the task","Non-snag outer clothing","A personal first aid kit","Site first aid kit"].map(item => (
                      <li key={item} className="flex items-start gap-2"><span className="text-primary mt-0.5">—</span>{item}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2 italic">More information is outlined in the PPE video.</p>
                </div>

                <div>
                  <h3 className="font-bold uppercase tracking-widest text-xs text-primary mb-2">Site and Workshop Requirements</h3>
                  <ul className="space-y-1 text-xs text-muted-foreground list-none">
                    {[
                      "Sufficient workspace to safely accommodate yourself.",
                      "A work bench equipped with a facility to securely hold the chainsaw, such as a vice. If on site use a stump vice or similar.",
                      "Hand cleaning facilities.",
                      "An outside area dedicated to fueling and starting the chainsaw.",
                      "Sufficient timber of suitable length and weight to exert tension and compression (between 200mm and 380mm in diameter).",
                    ].map(item => (
                      <li key={item} className="flex items-start gap-2"><span className="text-primary mt-0.5">—</span>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold uppercase tracking-widest text-xs text-primary mb-2">Maintenance Equipment</h3>
                  <ul className="space-y-1 text-xs text-muted-foreground list-none">
                    {[
                      "Eye protection","Gloves",
                      "Cleaning equipment — soft and hard bristled brushes or pressurised air-line.",
                      "Combination Spanner (combi-spanner)","Star spanner or allen keys",
                      "Guide bar groove scraper","Hook or wire","Pliers","Grease","Mild detergent",
                      "De-greaser and rag for cleaning surfaces and spills.",
                    ].map(item => (
                      <li key={item} className="flex items-start gap-2"><span className="text-primary mt-0.5">—</span>{item}</li>
                    ))}
                    <li className="flex items-start gap-2 mt-2">
                      <span className="text-primary mt-0.5">—</span>
                      <span>
                        <span className="font-semibold text-foreground">Sharpening Kit</span> to include: correct round file for chain, file guide, flat file, depth gauge setting tool, calipers.
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold uppercase tracking-widest text-xs text-primary mb-2">Equipment and Machinery</h3>
                  <ul className="space-y-1 text-xs text-muted-foreground list-none">
                    {[
                      "Fuel or battery driven chainsaw (with a recommended maximum guide bar length of 15 inches).",
                      "Correctly mixed fuel or appropriate batteries.",
                      "Chain oil.",
                      "Access to the relevant chainsaw operator's manual.",
                      "Optional lifting aids to help in the training and assessment.",
                      "Waste disposal facilities.",
                    ].map(item => (
                      <li key={item} className="flex items-start gap-2"><span className="text-primary mt-0.5">—</span>{item}</li>
                    ))}
                  </ul>
                </div>

              </CardContent>
            </Card>
          )}
        </div>

        {/* Grouped Module List */}
        <div className="space-y-10">
          {grouped.map(({ category, subGroups }) => (
            <div key={category}>
              {/* Category heading */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-6 bg-primary" />
                <h2 className="font-mono font-black uppercase tracking-widest text-base text-foreground">{category}</h2>
              </div>

              {subGroups.map(({ subCategory, modules: mods }) => (
                <div key={subCategory ?? "__root__"} className="mb-6">
                  {subCategory && (
                    <div className="flex items-center gap-2 mb-3 ml-4">
                      <div className="w-3 h-px bg-border" />
                      <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">{subCategory}</h3>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  <div className="space-y-2">
                    {mods.map((module) => {
                      const isPdf = module.contentType === "pdf";
                      return (
                        <Card
                          key={module.id}
                          className={`border-border transition-all duration-150 ${
                            module.isLocked
                              ? "opacity-40 bg-card/30"
                              : "hover:border-primary/40 bg-card/50 hover:bg-card/70"
                          }`}
                        >
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="shrink-0 w-10 h-10 rounded flex items-center justify-center bg-secondary/60">
                              {module.isLocked ? (
                                <Lock className="w-4 h-4 text-muted-foreground" />
                              ) : module.isCompleted ? (
                                <CheckCircle className="w-4 h-4 text-primary" />
                              ) : isPdf ? (
                                <FileText className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <PlayCircle className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold text-sm uppercase tracking-wide truncate">{module.title}</span>
                                {isPdf && (
                                  <Badge variant="outline" className="font-mono text-[9px] rounded-none py-0 px-1 text-muted-foreground border-muted-foreground/40 shrink-0">PDF</Badge>
                                )}
                                {module.isHighRisk && !module.isLocked && (
                                  <Badge variant="destructive" className="font-mono text-[9px] rounded-none py-0 shrink-0">
                                    <ShieldAlert className="w-2.5 h-2.5 mr-0.5" /> HIGH RISK
                                  </Badge>
                                )}
                                {module.isCompleted && (
                                  <Badge variant="outline" className="font-mono text-[9px] text-primary border-primary rounded-none py-0 shrink-0">DONE</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{module.description}</p>
                            </div>

                            {!module.isLocked && (
                              <div className="shrink-0">
                                <Button size="sm" className="h-8 font-mono text-xs" asChild>
                                  <Link href={`/training/${module.id}`}>
                                    {isPdf ? (
                                      <><FileText className="w-3 h-3 mr-1.5" /> {module.isCompleted ? "VIEW" : "OPEN"}</>
                                    ) : (
                                      <><PlayCircle className="w-3 h-3 mr-1.5" /> {module.isCompleted ? "REWATCH" : "START"}</>
                                    )}
                                  </Link>
                                </Button>
                              </div>
                            )}
                            {module.isLocked && (
                              <Button size="sm" variant="ghost" className="h-8 font-mono text-xs text-muted-foreground pointer-events-none shrink-0">LOCKED</Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
