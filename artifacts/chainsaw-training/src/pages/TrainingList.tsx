import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock, PlayCircle, CheckCircle, ShieldAlert, Award, LogOut, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useListModules, getListModulesQueryKey, useGetProgressSummary, getGetProgressSummaryQueryKey, useCompleteVideo } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";

export default function TrainingList() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId, fullName, clearSession } = useUserSession();
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [equipmentScrolled, setEquipmentScrolled] = useState(false);
  const [equipmentAcknowledged, setEquipmentAcknowledged] = useState(() =>
    localStorage.getItem("equipment-acknowledged") === "true"
  );
  const equipmentScrollRef = useRef<HTMLDivElement>(null);
  const [hazardsOpen, setHazardsOpen] = useState(false);
  const [hazardsViewed, setHazardsViewed] = useState(() =>
    localStorage.getItem("hazards-viewed") === "true"
  );

  const queryClient = useQueryClient();
  const completeVideo = useCompleteVideo();

  const { data: modules, isLoading: isLoadingModules } = useListModules({
    query: { queryKey: getListModulesQueryKey(), enabled: !!activationCode && !!deviceId }
  });

  const { data: summary, isLoading: isLoadingSummary } = useGetProgressSummary({
    query: { queryKey: getGetProgressSummaryQueryKey(), enabled: !!activationCode && !!deviceId }
  });

  const equipmentListModule = useMemo(
    () => (modules ?? []).find((m) => m.category === "COURSE REQUIREMENTS" && m.contentType === "pdf"),
    [modules]
  );

  const handleEquipmentScroll = useCallback(() => {
    const el = equipmentScrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setEquipmentScrolled(true);
    }
  }, []);

  const handleEquipmentAcknowledge = useCallback(() => {
    if (!equipmentListModule || !deviceId || !activationCode) return;
    completeVideo.mutate(
      { data: { moduleId: equipmentListModule.id, deviceId, activationCode } },
      {
        onSuccess: () => {
          localStorage.setItem("equipment-acknowledged", "true");
          setEquipmentAcknowledged(true);
          queryClient.invalidateQueries({ queryKey: getListModulesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
        },
      }
    );
  }, [equipmentListModule, deviceId, activationCode, completeVideo, queryClient]);

  useEffect(() => {
    if (!activationCode || !deviceId) setLocation("/");
  }, [activationCode, deviceId, setLocation]);

  // Index of "5 Steps To Risk Assessment" in the full ordered module list
  const riskAssessmentIndex = useMemo(() => {
    if (!modules) return -1;
    return modules.findIndex((m) => m.title.toLowerCase().includes("risk assessment"));
  }, [modules]);

  // Open hazards and mark as viewed (persisted)
  const handleToggleHazards = () => {
    setHazardsOpen((o) => {
      const next = !o;
      if (next && !hazardsViewed) {
        setHazardsViewed(true);
        localStorage.setItem("hazards-viewed", "true");
      }
      return next;
    });
  };

  // Course Requirements modules — rendered separately below the equipment collapsible
  const courseReqModules = useMemo(
    () => (modules ?? []).filter((m) => m.category === "COURSE REQUIREMENTS" && m.contentType !== "pdf"),
    [modules]
  );

  // Group remaining modules by category → sub-category, preserving DB order
  // Equipment List, Course Requirements and Hazards modules are excluded (shown separately)
  const grouped = useMemo(() => {
    if (!modules) return [];
    const filtered = modules.filter((m) =>
      !m.title.toLowerCase().includes("equipment") &&
      !m.title.toLowerCase().includes("hazard") &&
      m.category !== "COURSE REQUIREMENTS"
    );
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
        <div className="max-w-5xl mx-auto px-4 h-16 grid grid-cols-3 items-center">
          {/* Left — logo + brand */}
          <div className="flex items-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Chainsaw Courses"
              className="h-7 w-auto object-contain"
            />
            <span className="font-black tracking-tighter text-xs uppercase text-muted-foreground">Chainsaw Courses</span>
          </div>

          {/* Centre — NPTC Resources */}
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="font-mono font-black text-primary hover:bg-transparent hover:text-primary flex flex-col items-center leading-none py-1 h-auto px-0" style={{fontSize: "0.6rem", letterSpacing: "0.08em"}}>
                  <span>NPTC</span>
                  <span className="flex items-center gap-0.5">RESOURCES <ChevronDown className="w-2.5 h-2.5" /></span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="font-mono text-xs min-w-[210px]">
                <DropdownMenuItem asChild>
                  <a
                    href="https://www.nptc.org.uk/qualificationschemedetail.aspx?id=4800580073006D005700590052005900470066003800250033004400&back=home"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="uppercase tracking-widest font-bold cursor-pointer text-left w-full"
                  >
                    NPTC Course Overview
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href="https://www.nptc.org.uk/assets/documents/0e9ded0b44804bb081bd85685c90fba2.PDF"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="uppercase tracking-widest font-bold cursor-pointer text-left w-full"
                  >
                    Qualification Handbook
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href="https://www.nptc.org.uk/assets/documents/0aefd40527ec4e9b9410db2a9301ad5e.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="uppercase tracking-widest font-bold cursor-pointer text-left w-full"
                  >
                    Assessment Schedule
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right — operator + logout */}
          <div className="flex items-center justify-end gap-3 font-mono text-xs text-muted-foreground uppercase tracking-wider">
            <span className="hidden sm:inline-block">OPERATOR: {fullName}</span>
            <Button variant="ghost" size="sm" className="font-mono text-muted-foreground hover:text-destructive px-1.5" style={{fontSize: "0.6rem"}}
              onClick={() => { clearSession(); window.location.href = import.meta.env.BASE_URL; }}>
              <LogOut className="w-2.5 h-2.5 mr-0.5" /> LOG OUT
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-8 space-y-8">

        {/* Page title + progress strip */}
        <div className="pb-2 border-b border-border text-center">
          <h1 className="font-black tracking-tighter text-xl uppercase leading-tight text-primary">
            Maintenance &amp; Cross Cutting
          </h1>
        </div>

        {/* Modules / Quizzes / Status + Progress */}
        <Card className="bg-card/60 border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Modules</span>
                  <span className="font-mono font-bold text-xs">{summary?.completedModules || 0} / {summary?.totalModules || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Quizzes Passed</span>
                  <span className="font-mono font-bold text-xs">{summary?.quizzesPassed || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Status</span>
                  <span className={`font-mono font-bold text-xs ${summary?.certificateEarned ? 'text-primary' : 'text-muted-foreground'}`}>
                    {summary?.certificateEarned ? 'COMPLETE' : 'IN PROGRESS'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center pl-4 border-l border-border min-w-[64px]">
                <span className="font-mono font-black text-2xl text-primary leading-none">{summary?.percentComplete || 0}%</span>
                {summary?.certificateEarned && (
                  <Badge variant="default" className="bg-primary hover:bg-primary text-primary-foreground font-mono text-[9px] py-0 mt-1">
                    <Award className="w-2.5 h-2.5 mr-0.5" /> CERTIFIED
                  </Badge>
                )}
              </div>
            </div>
            <Progress value={summary?.percentComplete || 0} className="h-1.5 bg-secondary" />
          </CardContent>
        </Card>

        {/* Tools & Equipment Needed — collapsible, at top */}
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
              {/* Scrollable content — scroll to bottom to unlock acknowledge button */}
              <div
                ref={equipmentScrollRef}
                onScroll={handleEquipmentScroll}
                className="max-h-72 overflow-y-auto"
              >
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
              </div>

              {/* Acknowledge footer */}
              <div className="border-t border-border px-6 py-3 flex items-center justify-between gap-4 bg-card/80">
                {equipmentAcknowledged ? (
                  <span className="font-mono text-xs text-primary flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Read &amp; understood
                  </span>
                ) : (
                  <>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {equipmentScrolled ? "You can now confirm you have read this list." : "Scroll to the bottom to continue."}
                    </span>
                    <Button
                      size="sm"
                      className="h-7 font-mono text-xs shrink-0"
                      disabled={!equipmentScrolled || completeVideo.isPending}
                      onClick={handleEquipmentAcknowledge}
                    >
                      {completeVideo.isPending ? "Saving…" : "Read & Understood"}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Course Requirements — modules from DB category */}
        {courseReqModules.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 py-1">
              <div className="w-1 h-6 bg-primary shrink-0" />
              <h2 className="font-mono font-black uppercase tracking-widest text-base text-foreground">Course Requirements</h2>
            </div>
            {courseReqModules.map((module) => {
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
                  <CardContent className="p-2.5 flex items-center gap-3">
                    <div className="shrink-0 w-7 h-7 rounded flex items-center justify-center bg-secondary/60">
                      {module.isLocked ? (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      ) : module.isCompleted ? (
                        <CheckCircle className="w-3 h-3 text-primary" />
                      ) : isPdf ? (
                        <FileText className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <PlayCircle className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-xs uppercase tracking-wide truncate">{module.title}</span>
                        {isPdf && (
                          <Badge variant="outline" className="font-mono text-[9px] rounded-none py-0 px-1 text-muted-foreground border-muted-foreground/40 shrink-0">PDF</Badge>
                        )}
                        {module.isCompleted && (
                          <Badge variant="outline" className="font-mono text-[9px] text-primary border-primary rounded-none py-0 shrink-0">DONE</Badge>
                        )}
                      </div>
                    </div>
                    {!module.isLocked && (
                      <div className="shrink-0">
                        <Button size="sm" className="h-6 font-mono text-[10px] px-2" asChild>
                          <Link href={`/training/${module.id}`}>
                            {isPdf ? (
                              <><FileText className="w-2.5 h-2.5 mr-1" />{module.isCompleted ? "VIEW" : "OPEN"}</>
                            ) : (
                              <><PlayCircle className="w-2.5 h-2.5 mr-1" />{module.isCompleted ? "REWATCH" : "START"}</>
                            )}
                          </Link>
                        </Button>
                      </div>
                    )}
                    {module.isLocked && (
                      <Button size="sm" variant="ghost" className="h-6 font-mono text-[10px] text-muted-foreground pointer-events-none shrink-0">LOCKED</Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Grouped Module List */}
        <div className="space-y-10">
          {grouped.map(({ category, subGroups }) => (
            <div key={category}>
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

                  <div className="space-y-1.5">
                    {mods.map((module) => {
                      const isPdf = module.contentType === "pdf";
                      const isRiskAssessment = module.title.toLowerCase().includes("risk assessment");
                      const moduleIndex = modules!.findIndex((m) => m.id === module.id);
                      const needsHazards = riskAssessmentIndex !== -1 && moduleIndex > riskAssessmentIndex && !hazardsViewed;
                      const effectiveLocked = module.isLocked || needsHazards;
                      return (
                        <div key={module.id}>
                          <Card
                            className={`border-border transition-all duration-150 ${
                              effectiveLocked
                                ? "opacity-40 bg-card/30"
                                : "hover:border-primary/40 bg-card/50 hover:bg-card/70"
                            }`}
                          >
                            <CardContent className="p-2.5 flex items-center gap-3">
                              <div className="shrink-0 w-7 h-7 rounded flex items-center justify-center bg-secondary/60">
                                {effectiveLocked ? (
                                  <Lock className="w-3 h-3 text-muted-foreground" />
                                ) : module.isCompleted ? (
                                  <CheckCircle className="w-3 h-3 text-primary" />
                                ) : isPdf ? (
                                  <FileText className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <PlayCircle className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs uppercase tracking-wide truncate">{module.title}</span>
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
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{module.description}</p>
                              </div>

                              {!effectiveLocked && (
                                <div className="shrink-0">
                                  <Button size="sm" className="h-6 font-mono text-[10px] px-2" asChild>
                                    <Link href={`/training/${module.id}`}>
                                      {isPdf ? (
                                        <><FileText className="w-2.5 h-2.5 mr-1" /> {module.isCompleted ? "VIEW" : "OPEN"}</>
                                      ) : (
                                        <><PlayCircle className="w-2.5 h-2.5 mr-1" /> {module.isCompleted ? "REWATCH" : "START"}</>
                                      )}
                                    </Link>
                                  </Button>
                                </div>
                              )}
                              {effectiveLocked && (
                                <Button size="sm" variant="ghost" className="h-6 font-mono text-[10px] text-muted-foreground pointer-events-none shrink-0">LOCKED</Button>
                              )}
                            </CardContent>
                          </Card>

                          {/* Hazards table — injected after "5 Steps To Risk Assessment" */}
                          {isRiskAssessment && (
                            <div className="mt-2">
                              <button
                                onClick={handleToggleHazards}
                                className="w-full flex items-center gap-3 py-3 text-left group"
                              >
                                <div className="w-1 h-6 bg-primary shrink-0" />
                                <span className="font-mono font-black uppercase tracking-widest text-base text-foreground flex-1">
                                  Common Hazards &amp; Control Measures
                                </span>
                                {hazardsOpen
                                  ? <ChevronDown className="w-4 h-4 text-primary shrink-0" />
                                  : <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                                }
                              </button>

                              {hazardsOpen && (
                                <Card className="border-border bg-card/60 overflow-hidden">
                                  <CardContent className="p-0">
                                    <p className="px-4 pt-4 pb-2 text-[11px] text-muted-foreground font-mono leading-relaxed">
                                      There are many different hazards involved with chainsaw use and the best thing you can do is{" "}
                                      <strong className="text-foreground">assume everything wants to hurt you</strong>. Prepare yourself, the machine and the site to minimise injuries.
                                    </p>

                                    <table className="w-full font-mono border-collapse table-fixed">
                                      <colgroup>
                                        <col style={{ width: 28 }} />
                                        <col style={{ width: "29%" }} />
                                        <col style={{ width: "26%" }} />
                                        <col />
                                      </colgroup>
                                      <thead>
                                        <tr className="bg-foreground text-background">
                                          <th className="py-2 px-0" />
                                          <th className="py-2 px-2 text-left font-bold uppercase tracking-wide text-[10px] border-r border-background/20">Hazards</th>
                                          <th className="py-2 px-2 text-left font-bold uppercase tracking-wide text-[10px] border-r border-background/20">Risks</th>
                                          <th className="py-2 px-2 text-left font-bold uppercase tracking-wide text-[10px]">Control Measures</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {[
                                          {
                                            category: "ON SITE",
                                            rows: [
                                              { hazard: "Uneven ground, mud, brambles, logs, branches and stumps.", risk: "Tripping, slipping and falling.", control: "Wear appropriate footwear, clear work area and keep the site tidy." },
                                              { hazard: "Public footpath, dog walkers, any other 3rd parties.", risk: "Debris hitting pedestrians.", control: "Appropriate signs and banksperson if necessary." },
                                              { hazard: "Overhead hanging branches and dead limbs.", risk: "Injury from falling limbs.", control: "Avoid working directly beneath hazards and wear protective helmet." },
                                            ],
                                          },
                                          {
                                            category: "TASK",
                                            rows: [
                                              { hazard: "Chainsaw use.", risk: "Cuts and kickback.", control: "Use the correct body position, appropriate cutting techniques and suitable PPE." },
                                              { hazard: "Timber movement.", risk: "Being hit or struck by the timber.", control: "Secure timber wherever possible, avoid working on steep slopes and prepare escape routes." },
                                              { hazard: "Heavy logs and branches.", risk: "Musculo-skeletal injuries.", control: "Use machinery or lifting aids where possible. Use good lifting methods." },
                                            ],
                                          },
                                          {
                                            category: "CHAINSAW",
                                            rows: [
                                              { hazard: "Fuel and lubricants.", risk: "Fire, chemical poisoning.", control: "Use spill mats and fill up away from flammable sources and watercourses." },
                                              { hazard: "Kickback and cuts.", risk: "Laceration injuries.", control: "Wear suitable PPE, adopt the correct body position and use appropriate cutting techniques." },
                                              { hazard: "Vibration, noise, dust, fumes, exhaust, flying debris.", risk: "Immediate and long term injuries.", control: "Use a maintained chainsaw and wear suitable PPE." },
                                            ],
                                          },
                                        ].map(({ category, rows }, gi) =>
                                          rows.map((row, ri) => (
                                            <tr
                                              key={`${gi}-${ri}`}
                                              className={`border-t border-border ${gi % 2 === 0 ? "bg-card/40" : "bg-secondary/20"}`}
                                            >
                                              {ri === 0 && (
                                                <td
                                                  rowSpan={rows.length}
                                                  className="border-r border-border text-center align-middle p-0"
                                                  style={{ borderTop: gi > 0 ? "2px solid hsl(var(--primary))" : undefined }}
                                                >
                                                  <div
                                                    className="text-primary font-black uppercase"
                                                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: "0.5rem", letterSpacing: "0.12em", padding: "6px 3px", whiteSpace: "nowrap" }}
                                                  >
                                                    {category}
                                                  </div>
                                                </td>
                                              )}
                                              <td className="py-2 px-2 align-top text-[10px] text-muted-foreground border-r border-border leading-snug">{row.hazard}</td>
                                              <td className="py-2 px-2 align-top text-[10px] text-muted-foreground border-r border-border leading-snug">{row.risk}</td>
                                              <td className="py-2 px-2 align-top text-[10px] text-muted-foreground leading-snug">{row.control}</td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-card/90 backdrop-blur border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-center">
          <Button asChild className="font-mono text-sm uppercase tracking-widest px-8">
            <Link href="/mock-test">MOCK ASSESSMENT</Link>
          </Button>
        </div>
      </div>
      </main>
    </div>
  );
}
