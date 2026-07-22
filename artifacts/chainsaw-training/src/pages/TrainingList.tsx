import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { downloadPdf } from "../lib/downloadPdf";
import WelcomeModal from "../components/WelcomeModal";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, BookMarked, BookOpen, CheckCircle, ChevronDown, ChevronRight, ClipboardCheck, Cog, ExternalLink, FileDown, FileText, Leaf, Library, Lock, LogOut, MapPin, MessageSquarePlus, Newspaper, PlayCircle, ScrollText, Shield, Trash2, Users, LockKeyhole } from "lucide-react";


import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { useListModules, getListModulesQueryKey, useGetProgressSummary, getGetProgressSummaryQueryKey, useCompleteVideo, useGetWaiver, getGetWaiverQueryKey, useGetExamStatus, getGetExamStatusQueryKey } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { useRemoteConfig } from "../hooks/useRemoteConfig";
import { useHowToUse } from "../hooks/useHowToUse";
import { COURSE_CONTENT_VERSION } from "../data/version";

function LogEndIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.75" />
      <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.6" />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" />
      <circle cx="12" cy="12" r="0.7" fill="currentColor" />
      <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="0.4" strokeOpacity="0.2" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="0.4" strokeOpacity="0.2" />
    </svg>
  );
}

export default function TrainingList() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId, fullName, clearSession, userId } = useUserSession();
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [equipmentScrolled, setEquipmentScrolled] = useState(false);
  const [equipmentAcknowledged, setEquipmentAcknowledged] = useState(() =>
    localStorage.getItem("equipment-acknowledged") === "true"
  );
  const equipmentScrollRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLElement | null>(null);
  const [hazardsOpen, setHazardsOpen] = useState(false);
  const [hazardsViewed, setHazardsViewed] = useState(() =>
    localStorage.getItem("hazards-viewed") === "true"
  );
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [howToUseOpen, setHowToUseOpen] = useState(false);
  const [preparingOpen, setPreparingOpen] = useState(false);
  const [nptcOpen, setNptcOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [helpHowItWorksOpen, setHelpHowItWorksOpen] = useState(false);
  const [helpDeviceLockOpen, setHelpDeviceLockOpen] = useState(false);
  const [helpWatermarkOpen, setHelpWatermarkOpen] = useState(false);
  const [helpLostCodeOpen, setHelpLostCodeOpen] = useState(false);
  const [helpAdminOpen, setHelpAdminOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [certPressed, setCertPressed] = useState(false);

  const { disclaimerText } = useRemoteConfig();
  const { text: howToUseText, isLoading: howToUseLoading } = useHowToUse();

  const handleViewCertificate = async () => {
    if (!activationCode || !deviceId) return;
    setCertPressed(true);
    setTimeout(() => setCertPressed(false), 220);
    const res = await fetch("/api/certificate", {
      headers: { activationcode: activationCode, deviceid: deviceId },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleDeleteAccount = async () => {
    if (!activationCode || !deviceId) return;
    setDeletingAccount(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        activationcode: activationCode,
        deviceid: deviceId,
      };
      if (userId) headers["userid"] = String(userId);
      const res = await fetch("/api/auth/delete-account", { method: "DELETE", headers });
      if (!res.ok) throw new Error("Delete failed");
      clearSession();
      localStorage.removeItem("deviceId");
      window.location.href = import.meta.env.BASE_URL;
    } catch {
      setDeletingAccount(false);
      setDeleteConfirmOpen(false);
      alert("Something went wrong. Please try again or contact support.");
    }
  };

  const queryClient = useQueryClient();
  const completeVideo = useCompleteVideo();

  const { data: modules, isLoading: isLoadingModules } = useListModules({
    query: {
      queryKey: getListModulesQueryKey(),
      enabled: !!activationCode && !!deviceId,
      staleTime: 0,
      refetchOnMount: "always",
    }
  });

  const { data: summary, isLoading: isLoadingSummary } = useGetProgressSummary({
    query: {
      queryKey: getGetProgressSummaryQueryKey(),
      enabled: !!activationCode && !!deviceId,
      staleTime: 0,
      refetchOnMount: "always",
    }
  });

  const { data: waiverStatus } = useGetWaiver({
    query: { queryKey: getGetWaiverQueryKey(), enabled: !!activationCode && !!deviceId }
  });

  const { data: examStatus } = useGetExamStatus({
    query: {
      queryKey: getGetExamStatusQueryKey(),
      enabled: !!activationCode && !!deviceId,
      staleTime: 0,
      refetchOnMount: "always",
    }
  });

  const courseUnlocked = examStatus?.unlocked ?? false;
  const examPassed = examStatus?.passed ?? false;

  const equipmentListModule = useMemo(
    () => (modules ?? []).find((m) => m.category === "COURSE REQUIREMENTS" && m.contentType === "pdf"),
    [modules]
  );

  const equipmentFooterRef = useRef<HTMLDivElement>(null);

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
          setEquipmentOpen(false);
          queryClient.invalidateQueries({ queryKey: getListModulesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
        },
      }
    );
  }, [equipmentListModule, deviceId, activationCode, completeVideo, queryClient]);

  const anyOpen = equipmentOpen || hazardsOpen || disclaimerOpen || howToUseOpen || preparingOpen || nptcOpen || docsOpen || brandMenuOpen || helpHowItWorksOpen || helpDeviceLockOpen || helpWatermarkOpen || helpLostCodeOpen || helpAdminOpen;

  const closeAllDropdowns = useCallback(() => {
    setEquipmentOpen(false);
    setHazardsOpen(false);
    setDisclaimerOpen(false);
    setHowToUseOpen(false);
    setPreparingOpen(false);
    setNptcOpen(false);
    setBrandMenuOpen(false);
    setHelpHowItWorksOpen(false);
    setHelpDeviceLockOpen(false);
    setHelpWatermarkOpen(false);
    setHelpLostCodeOpen(false);
    setHelpAdminOpen(false);
  }, []);

  useEffect(() => {
    if (!anyOpen) return;
    let handler: (() => void) | null = null;
    // 400ms delay — Android fires a synthetic click shortly after a touch,
    // so we wait long enough for it to pass before attaching the listener.
    const timer = setTimeout(() => {
      handler = () => {
        closeAllDropdowns();
        // Scroll back to top of the page
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          activeTriggerRef.current = null;
        }, 50);
      };
      document.addEventListener("click", handler);
    }, 400);
    return () => {
      clearTimeout(timer);
      if (handler) document.removeEventListener("click", handler);
    };
  }, [anyOpen, closeAllDropdowns]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!activationCode || !deviceId) setLocation("/");
  }, [activationCode, deviceId, setLocation]);

  // After returning from a passed quiz, scroll to the newly-unlocked next module.
  // We intentionally do NOT clear the sessionStorage key until we see fresh data
  // (i.e. the next module is no longer locked), so stale TanStack Query cache hits
  // don't consume the key before the refetch delivers the unlocked state.
  useEffect(() => {
    const completedId = sessionStorage.getItem("scrollAfterModule");
    if (!completedId || !modules) return;
    const completedIdx = modules.findIndex((m) => m.id === parseInt(completedId));
    if (completedIdx === -1) {
      sessionStorage.removeItem("scrollAfterModule");
      return;
    }
    // The module immediately after the one just completed is what got unlocked.
    const nextModule = modules[completedIdx + 1];
    if (!nextModule) {
      // End of course — nothing to scroll to.
      sessionStorage.removeItem("scrollAfterModule");
      return;
    }
    // If the next module is still locked, we're looking at stale cached data.
    // Leave the key in place and wait for the refetch to deliver fresh state.
    if (nextModule.isLocked) return;
    // Fresh data confirmed — clear key and scroll.
    sessionStorage.removeItem("scrollAfterModule");
    setTimeout(() => {
      const el = document.getElementById(`module-${nextModule.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, [modules]);

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

  // HEADER V12 - logo above title, stacked brand button
  return (
    <div className="min-h-screen pb-20">
      <WelcomeModal />
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          {/* Left — brand dropdown: logo above title */}
          <div className="relative flex items-center">
            <button
              ref={(el) => { if (el) activeTriggerRef.current = el; }}
              onClick={(e) => { e.stopPropagation(); setBrandMenuOpen((o) => !o); }}
              className="flex items-center gap-1 group"
            >
              <div className="flex flex-col leading-none">
                <span className="font-black tracking-tighter text-[13px] uppercase text-muted-foreground group-hover:text-foreground transition-colors">Chainsaw</span>
                <span className="font-black tracking-tighter text-[13px] uppercase text-muted-foreground group-hover:text-foreground transition-colors">Courses</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-orange-500 transition-all ${brandMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {brandMenuOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-50 w-[75vw] max-w-[280px] bg-popover border border-border rounded-md shadow-md overflow-hidden font-mono text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Logo + user identity */}
                <div className="flex items-center gap-3 px-3 py-3 border-b border-border bg-card/60">
                  <img
                    src={`${import.meta.env.BASE_URL}logo.png?v=20`}
                    alt="Chainsaw Courses"
                    className="h-10 w-auto object-contain shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-black tracking-tighter text-xs uppercase text-primary leading-tight">Chainsaw Courses</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="font-mono text-[11px] text-foreground font-semibold truncate">{fullName}</p>
                      <a
                        href={waiverStatus?.pdfUrl ?? `/api/waiver/pdf?code=${encodeURIComponent(activationCode ?? "")}&device=${encodeURIComponent(deviceId ?? "")}&uid=${userId ?? ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary shrink-0"
                        title="Your Signed Waiver"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Help — single "How It Works" accordion containing all sub-sections */}
                <div className="border-b border-border">
                  <button
                    onClick={(e) => { e.stopPropagation(); setHelpHowItWorksOpen((o) => !o); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 uppercase tracking-widest font-black text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <span>How It Works</span>
                    <ChevronDown className={`w-4 h-4 transition-all shrink-0 ${helpHowItWorksOpen ? "rotate-180" : ""}`} />
                  </button>
                  {helpHowItWorksOpen && (
                    <div className="px-3 pb-3 space-y-4">
                      {/* Intro */}
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Each module is a short training video. Watch it in full, then take the quiz. Score 80% or higher to unlock the next module. Complete all modules to earn your certificate.
                      </p>

                      {/* Device Lock */}
                      <div className="border-t border-border -mx-3 pl-6 pr-3 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setHelpDeviceLockOpen((o) => !o); }}
                          className="w-full flex items-center justify-between py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-left hover:text-primary transition-colors"
                        >
                          <span>Device Lock</span>
                          <ChevronDown className={`w-3 h-3 shrink-0 transition-all ${helpDeviceLockOpen ? "rotate-180" : ""}`} />
                        </button>
                        {helpDeviceLockOpen && (
                          <p className="pb-2 text-xs text-muted-foreground leading-relaxed">
                            Your activation code is bonded to this device for security. It cannot be transferred to another phone, tablet, or computer. Need a reset?{" "}
                            <a href="mailto:info@chainsawcourses.com?subject=Device%20Lock%20Reset" className="text-primary font-bold hover:underline">Contact admin</a>.
                          </p>
                        )}
                      </div>

                      {/* Watermark */}
                      <div className="border-t border-border -mx-3 pl-6 pr-3 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setHelpWatermarkOpen((o) => !o); }}
                          className="w-full flex items-center justify-between py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-left hover:text-primary transition-colors"
                        >
                          <span>Why Is My Email On Screen?</span>
                          <ChevronDown className={`w-3 h-3 shrink-0 transition-all ${helpWatermarkOpen ? "rotate-180" : ""}`} />
                        </button>
                        {helpWatermarkOpen && (
                          <p className="pb-2 text-xs text-muted-foreground leading-relaxed">
                            Your email is shown alongside a dynamic watermark on every video to identify you as the licensed user. This is a copyright protection measure. Sharing, recording, or distributing course content is strictly prohibited and may result in account termination.
                          </p>
                        )}
                      </div>

                      {/* Lost Code */}
                      <div className="border-t border-border -mx-3 pl-6 pr-3 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setHelpLostCodeOpen((o) => !o); }}
                          className="w-full flex items-center justify-between py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-left hover:text-primary transition-colors"
                        >
                          <span>Lost Your Code?</span>
                          <ChevronDown className={`w-3 h-3 shrink-0 transition-all ${helpLostCodeOpen ? "rotate-180" : ""}`} />
                        </button>
                        {helpLostCodeOpen && (
                          <p className="pb-2 text-xs text-muted-foreground leading-relaxed">
                            Check your original purchase email from chainsawcourses.com. Still can&#39;t find it?{" "}
                            <a href="mailto:info@chainsawcourses.com?subject=Lost%20My%20Code" className="text-primary font-bold hover:underline">Contact admin</a>{" "}and we&#39;ll locate it for you.
                          </p>
                        )}
                      </div>

                      {/* Admin Support */}
                      <div className="border-t border-border -mx-3 pl-6 pr-3 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setHelpAdminOpen((o) => !o); }}
                          className="w-full flex items-center justify-between py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-left hover:text-primary transition-colors"
                        >
                          <span>Admin Support</span>
                          <ChevronDown className={`w-3 h-3 shrink-0 transition-all ${helpAdminOpen ? "rotate-180" : ""}`} />
                        </button>
                        {helpAdminOpen && (
                          <p className="pb-2 text-xs text-muted-foreground leading-relaxed">
                            Any issues? Contact admin support{" "}
                            <a href="mailto:info@chainsawcourses.com?subject=Help%20Me!" className="text-primary font-bold hover:underline">here</a>.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation links */}
                <div className="border-b border-border">
                  {/* Community link kept for future use — hidden for now */}
                  <Link
                    href="/manual"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <BookOpen className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Digital Manual</span>
                  </Link>
                  <Link
                    href="/inspection"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <ClipboardCheck className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Inspection Checklist</span>
                  </Link>
                  <Link
                    href="/risk-assessment"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <MapPin className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Dynamic Risk Assessment</span>
                  </Link>
                  <Link
                    href="/biosecurity-map"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <Leaf className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Biosecurity &amp; Hazard Map</span>
                  </Link>
                  <Link
                    href="/chain-chart"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <Cog className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Chain Identification</span>
                  </Link>
                  <Link
                    href="/news"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <Newspaper className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Industry News</span>
                  </Link>
                  <Link
                    href="/species-guide"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <LogEndIcon className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Timber Characteristics</span>
                  </Link>
                  <Link
                    href="/glossary"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <ScrollText className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Glossary of Terms</span>
                  </Link>
                  <Link
                    href="/resources"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <Library className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Further Reading</span>
                  </Link>
                  <Link
                    href="/privacy"
                    className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setBrandMenuOpen(false)}
                  >
                    <Shield className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>Privacy Policy</span>
                  </Link>

                  {/* Feedback — only active after exam passed */}
                  {examPassed ? (
                    <Link
                      href="/feedback"
                      className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => setBrandMenuOpen(false)}
                    >
                      <MessageSquarePlus className="w-4 h-4 shrink-0 text-orange-500" />
                      <span>Feedback</span>
                    </Link>
                  ) : (
                    <div className="w-full flex items-center gap-3 px-3 py-2.5 uppercase tracking-widest font-black text-sm cursor-not-allowed opacity-40 select-none">
                      <MessageSquarePlus className="w-4 h-4 shrink-0" />
                      <span>Feedback</span>
                      <Lock className="w-3 h-3 ml-auto shrink-0" />
                    </div>
                  )}
                </div>

                {/* Log Out + Delete Account */}
                {!deleteConfirmOpen ? (
                  <div className="flex border-t border-border">
                    <button
                      onClick={() => { clearSession(); window.location.href = import.meta.env.BASE_URL; }}
                      className="flex-1 flex items-center gap-2 px-3 py-2 uppercase tracking-widest font-bold text-left hover:bg-accent hover:text-destructive transition-colors"
                    >
                      <LogOut className="w-3 h-3" /> Log Out
                    </button>
                    <div className="w-px bg-border shrink-0" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmOpen(true); }}
                      className="flex-1 flex items-center gap-2 px-3 py-2 uppercase tracking-widest font-bold text-left text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Delete Account
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-border p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-destructive">Delete your account?</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">All personal data, progress, quiz records, and your waiver will be permanently erased. Your activation code cannot be reused and you will have to purchase another course. This cannot be undone.</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmOpen(false); }}
                        className="flex-1 text-[10px] uppercase font-bold px-2 py-1.5 border border-border rounded hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deletingAccount}
                        className="flex-1 text-[10px] uppercase font-bold px-2 py-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors disabled:opacity-50"
                      >
                        {deletingAccount ? "Deleting…" : "Yes, Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — nav icons */}
          <div className="flex-1 flex items-center justify-evenly">
            {/* Community link kept for future use — icon hidden for now */}
            <Link href="/inspection" className="text-muted-foreground hover:text-primary" title="Inspection Checklist">
              <ClipboardCheck className="w-5 h-5" />
            </Link>
            <Link href="/risk-assessment" className="text-muted-foreground hover:text-primary" title="Dynamic Risk Assessment">
              <MapPin className="w-5 h-5" />
            </Link>
            <Link href="/biosecurity-map" className="text-muted-foreground hover:text-primary" title="Biosecurity & Hazard Map">
              <Leaf className="w-5 h-5" />
            </Link>
            <Link href="/chain-chart" className="text-muted-foreground hover:text-primary" title="Chain ID Chart">
              <Cog className="w-5 h-5" />
            </Link>
            <Link href="/news" className="text-muted-foreground hover:text-primary" title="Industry News">
              <Newspaper className="w-5 h-5" />
            </Link>
            <Link href="/species-guide" className="text-muted-foreground hover:text-primary" title="Timber Characteristics">
              <LogEndIcon className="w-5 h-5" />
            </Link>
            <Link href="/manual" className="text-muted-foreground hover:text-primary" title="Training Manual">
              <BookOpen className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-3 pb-0 space-y-6">

        {/* Page title + progress strip */}
        <div className="pb-2 border-b border-border text-center">
          <img
            src={`${import.meta.env.BASE_URL}logo.png?v=20`}
            alt="Chainsaw Courses"
            className="h-10 w-auto object-contain mx-auto mb-1"
          />
          <p className="font-black tracking-tighter text-xs uppercase text-foreground mb-0.5">Chainsaw Courses</p>
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

            {/* Final Exam + View Certificate — inside progress card */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <div className="flex items-center gap-2">
                {examPassed ? (
                  <Link
                    href="/exam"
                    className="font-mono font-semibold uppercase tracking-widest text-xs text-green-600/70 hover:text-green-600 transition-colors flex items-center gap-1.5"
                  >
                    <Award className="w-3 h-3 shrink-0" />
                    Final Exam
                  </Link>
                ) : courseUnlocked ? (
                  <Link
                    href="/exam"
                    className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Final Exam
                  </Link>
                ) : (
                  <span className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground/40 cursor-not-allowed">
                    Final Exam
                  </span>
                )}
              </div>
              <button
                onClick={examPassed ? handleViewCertificate : undefined}
                className={`font-mono text-[10px] uppercase tracking-widest transition-all select-none ${
                  examPassed
                    ? "text-green-600 hover:text-green-500 underline underline-offset-2 cursor-pointer active:scale-95 active:translate-y-px"
                    : "invisible pointer-events-none"
                }`}
              >
                View Certificate
              </button>
            </div>
          </CardContent>
        </Card>



        {/* Course Requirements — modules from DB category */}
        {courseReqModules.length > 0 && (
          <div className="space-y-2">
            {/* Disclaimer & Copyright — collapsible, text from Firebase Remote Config */}
            {disclaimerText && (
              <div>
                <button
                  ref={(el) => { if (el) activeTriggerRef.current = el; }}
                  onClick={(e) => { e.stopPropagation(); setDisclaimerOpen((o) => !o); }}
                  className="w-full flex items-center gap-2 py-2 text-left group ml-4"
                >
                  <div className="w-3 h-px bg-border shrink-0" />
                  <h3 className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    Disclaimer & Copyright
                  </h3>
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-all text-muted-foreground group-hover:text-primary ${disclaimerOpen ? "rotate-180 text-primary" : ""}`} />
                </button>
                {disclaimerOpen && (
                  <Card className="border-border bg-card/60 mt-1">
                    <CardContent className="p-4">
                      <p className="font-mono text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {disclaimerText}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}


            {/* How to Use This E-Learning Course — collapsible from Firebase Storage */}
            {!howToUseLoading && howToUseText && (
              <div>
                <button
                  ref={(el) => { if (el) activeTriggerRef.current = el; }}
                  onClick={(e) => { e.stopPropagation(); setHowToUseOpen((o) => !o); }}
                  className="w-full flex items-center gap-2 py-2 text-left group ml-4"
                >
                  <div className="w-3 h-px bg-border shrink-0" />
                  <h3 className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    How to Use This E-Learning Course
                  </h3>
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-all text-muted-foreground group-hover:text-primary ${howToUseOpen ? "rotate-180 text-primary" : ""}`} />
                </button>
                {howToUseOpen && (
                  <Card className="border-border bg-card/60 mt-1">
                    <CardContent className="p-4">
                      <p className="font-mono text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {(() => {
                          const injected = "Final Exam — 40 Multiple-Choice Questions:\n\nThe final exam is made up of 40 multiple-choice questions drawn from across all training modules. Questions cover chainsaw safety, maintenance, legislation, cross-cutting techniques, and risk assessment. You must score 80% or higher — 32 correct answers out of 40 — to pass and trigger the automatic issue of your Certificate of Theoretical Competency. There is no limit on attempts, and only your passing result is recorded.\n\n";
                          const marker = "Practical Mock Assessment Practice:";
                          const idx = howToUseText!.indexOf(marker);
                          if (idx === -1) return howToUseText;
                          return howToUseText!.slice(0, idx) + injected + howToUseText!.slice(idx);
                        })()}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Tools & Equipment Needed — collapsible sub-heading under Course Overview */}
            <div>
              <button
                ref={(el) => { if (el) activeTriggerRef.current = el; }}
                onClick={(e) => { e.stopPropagation(); setEquipmentOpen((o) => !o); }}
                className="w-full flex items-center gap-2 py-2 text-left group ml-4"
              >
                <div className="w-3 h-px bg-border shrink-0" />
                <h3 className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Tools & Equipment Needed
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-all text-muted-foreground group-hover:text-primary ${equipmentOpen ? "rotate-180 text-primary" : ""}`} />
              </button>

              {equipmentOpen && (
                <Card className="border-border bg-card/60 mt-1">
                  {/* Scrollable content — scroll to bottom to unlock acknowledge button */}
                  <div
                    ref={equipmentScrollRef}
                    onScroll={handleEquipmentScroll}
                    className="max-h-[70vh] overflow-y-auto"
                  >
                    <CardContent className="p-6 space-y-6 font-mono text-sm text-foreground">
                      <div>
                        <h3 className="font-bold uppercase tracking-widest text-sm text-primary mb-2">Personal Protective Equipment (PPE)</h3>
                        <p className="text-sm text-muted-foreground mb-2">All PPE must conform to CE/EN/UK standards.</p>
                        <ul className="space-y-1 text-sm text-muted-foreground list-none">
                          {["Chainsaw safety leg protection","Chainsaw safety footwear","Safety helmet","Eye and ear protection","Gloves appropriate for the task","Non-snag outer clothing","A personal first aid kit","Site first aid kit"].map(item => (
                            <li key={item} className="flex items-start gap-2"><span className="text-primary mt-0.5">—</span>{item}</li>
                          ))}
                        </ul>
                        <p className="text-sm text-muted-foreground mt-2 italic">More information is outlined in the PPE video.</p>
                      </div>

                      <div>
                        <h3 className="font-bold uppercase tracking-widest text-sm text-primary mb-2">Site and Workshop Requirements</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground list-none">
                          {[
                            "Sufficient workspace to safely accommodate yourself.",
                            "A work bench equipped with a facility to securely hold the chainsaw, such as a vice. If on site use a stump vice or similar.",
                            "Hand cleaning facilities.",
                            "An outside area dedicated to fueling and starting the chainsaw.",
                            "Sufficient timber of suitable length and weight to exert tension and compression (between 200mm and 380mm in diameter).",
                            "The candidate must start and cut under the direct supervision of a competent person who holds a current first aid at work certificate.",
                          ].map(item => (
                            <li key={item} className="flex items-start gap-2"><span className="text-primary mt-0.5">—</span>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="font-bold uppercase tracking-widest text-sm text-primary mb-2">Maintenance Equipment</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground list-none">
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
                        <h3 className="font-bold uppercase tracking-widest text-sm text-primary mb-2">Equipment and Machinery</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground list-none">
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

                </Card>
              )}
            </div>

            {/* Preparing for Your Assessment — collapsible */}
            <div>
              <button
                ref={(el) => { if (el) activeTriggerRef.current = el; }}
                onClick={(e) => { e.stopPropagation(); setPreparingOpen((o) => !o); }}
                className="w-full flex items-center gap-2 py-2 text-left group ml-4"
              >
                <div className="w-3 h-px bg-border shrink-0" />
                <h3 className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Preparing for Your Assessment
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-all text-muted-foreground group-hover:text-primary ${preparingOpen ? "rotate-180 text-primary" : ""}`} />
              </button>
              {preparingOpen && (
                <Card className="border-border bg-card/60 mt-1">
                  <CardContent className="p-4 space-y-3">
                    <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                      <span className="text-foreground font-semibold">Know the syllabus.</span> The NPTC/Lantra assessment tests your knowledge across chainsaw safety, legislation, personal protective equipment, chainsaw components and maintenance, hazard identification, cross-cutting techniques, and safe working practices. Every training module on this platform maps directly to a syllabus area — complete them all before attempting the real assessment.
                    </p>
                    <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                      <span className="text-foreground font-semibold">Use the practical mock assessment.</span> Once you have completed all seven training modules, a Practical Mock Assessment button will appear on your dashboard. Use it repeatedly — it simulates the exact question style and timing of the real exam, and the AI examiner will explain the reasoning behind correct answers to deepen your understanding.
                    </p>
                    <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                      <span className="text-foreground font-semibold">Revisit weak areas.</span> If you score below 80% on a module quiz or practical mock assessment, go back and rewatch the relevant video before retrying. Pay particular attention to your body and head position when cutting and the safe use of the saw — these are the primary issues for failure.
                    </p>
                    <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                      <span className="text-foreground font-semibold">On the day.</span> The formal NPTC/Lantra assessment is conducted by an approved centre and includes both a written knowledge test and a practical skills assessment. Bring valid photo ID, your own PPE (unless the centre confirms provision), and arrive rested. The knowledge test typically takes 45–60 minutes; read each question carefully before answering.
                    </p>
                    <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                      <span className="text-foreground font-semibold">Your certificate.</span> Upon passing the online final exam here (80% or above), your Certificate of Theoretical Competency is issued automatically to your registered email. Present this alongside your practical assessment results to your employer or awarding body as evidence of your theoretical training hours.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* NPTC Resources — collapsible, all 3 links */}
            <div>
              <button
                ref={(el) => { if (el) activeTriggerRef.current = el; }}
                onClick={(e) => { e.stopPropagation(); setNptcOpen((o) => !o); }}
                className="w-full flex items-center gap-2 py-2 text-left group ml-4"
              >
                <div className="w-3 h-px bg-border shrink-0" />
                <h3 className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  NPTC Resources
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-all text-muted-foreground group-hover:text-primary ${nptcOpen ? "rotate-180 text-primary" : ""}`} />
              </button>
              {nptcOpen && (
                <Card className="border-border bg-card/60 mt-1">
                  <CardContent className="p-4 space-y-5 font-mono text-sm text-muted-foreground">
                    <p className="font-bold uppercase tracking-widest text-xs text-primary">External Links:</p>
                    <a
                      href="https://www.nptc.org.uk/qualificationschemedetail.aspx?id=4800580073006D005700590052005900470066003800250033004400&back=home"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 uppercase tracking-widest font-bold hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" /> NPTC Course Overview
                    </a>
                    <a
                      href="https://www.nptc.org.uk/assets/documents/0e9ded0b44804bb081bd85685c90fba2.PDF"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 uppercase tracking-widest font-bold hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" /> Qualification Handbook
                    </a>
                    <a
                      href="https://www.nptc.org.uk/assets/documents/0aefd40527ec4e9b9410db2a9301ad5e.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 uppercase tracking-widest font-bold hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" /> Assessment Schedule
                    </a>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Documents Library — collapsible */}
            <div>
              <button
                ref={(el) => { if (el) activeTriggerRef.current = el; }}
                onClick={(e) => { e.stopPropagation(); setDocsOpen((o) => !o); }}
                className="w-full flex items-center gap-2 py-2 text-left group ml-4"
              >
                <div className="w-3 h-px bg-border shrink-0" />
                <h3 className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Documents Library
                </h3>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-all text-muted-foreground group-hover:text-primary ${docsOpen ? "rotate-180 text-primary" : ""}`} />
              </button>
              {docsOpen && (
                <Card className="border-border bg-card/60 mt-1">
                  <CardContent className="p-4 space-y-1 font-mono text-xs">
                    {[
                      { label: "Terms & Conditions", file: "Terms_and_Conditions_Liability_Waiver.pdf" },
                      { label: "Refund & Cancellation Policy", file: "Refund_and_Cancellation_Policy.pdf" },
                      { label: "Data Protection Policy", file: "Data_Protection_Policy.pdf" },
                      { label: "Complaints Procedure", file: "Complaints_Procedure.pdf" },
                      { label: "Reasonable Adjustments Policy", file: "Reasonable_Adjustments_Policy.pdf" },
                      { label: "Appeals Policy", file: "Appeals_Policy.pdf" },
                      { label: "Health & Safety Policy", file: "Health_and_Safety_Policy.pdf" },
                      { label: "Quality Management Policy", file: "Quality_Management_Policy.pdf" },
                      { label: "Assessment Policy", file: "Assessment_Policy.pdf" },
                      { label: "Internal Verification Policy", file: "Internal_Verification_Policy.pdf" },
                      { label: "Malpractice & Maladministration Policy", file: "Malpractice_and_Maladministration_Policy.pdf" },
                      { label: "Equality, Diversity & Inclusion Policy", file: "Equality_Diversity_Inclusion_Policy.pdf" },
                      { label: "Safeguarding Policy", file: "Safeguarding_Policy.pdf" },
                      { label: "Environmental & Sustainability Policy", file: "Environmental_and_Sustainability_Policy.pdf" },
                    ].map(({ label, file }) => {
                      const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/pdfs/${file}`;
                      return (
                        <button
                          key={file}
                          onClick={() => downloadPdf(url, file)}
                          className="w-full flex items-center gap-2 py-1.5 px-1 text-muted-foreground hover:text-primary transition-colors rounded text-left"
                        >
                          <FileDown className="w-3.5 h-3.5 shrink-0" />
                          <span className="uppercase tracking-widest font-semibold">{label}</span>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Practical Mock Assessment — sub-heading link, grayed out until all modules complete */}
            <div className="ml-4 py-2 flex items-center gap-2 group">
              <div className="w-3 h-px bg-border shrink-0" />
              {courseUnlocked ? (
                <Link
                  href="/mock-test"
                  className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Practical Mock Assessment
                </Link>
              ) : (
                <span className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground/40 cursor-not-allowed">
                  Practical Mock Assessment
                </span>
              )}
            </div>

            {courseReqModules.map((module) => {
              const isPdf = module.contentType === "pdf";
              return (
                <Card
                  key={module.id}
                  className={`border-border transition-all duration-150 group ${
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
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-bold text-xs uppercase tracking-wide truncate transition-colors ${module.isCompleted && !module.isLocked ? "group-hover:text-primary" : ""}`}>{module.title}</span>
                        {isPdf && (
                          <Badge variant="outline" className="font-mono text-[9px] rounded-none py-0 px-1 text-muted-foreground border-muted-foreground/40 shrink-0">PDF</Badge>
                        )}
                      </div>
                      {module.isCompleted && (
                        <Badge variant="outline" className="font-mono text-[9px] text-primary border-primary rounded-none py-0 mt-0.5 w-fit">Completed</Badge>
                      )}
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
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-1 h-6 bg-primary" />
                <h2 className="font-mono font-black uppercase tracking-widest text-base text-foreground">
                  {category === "ASSESSMENT MODULES" ? "Standards & Regulations" : category}
                </h2>
              </div>

              {subGroups.map(({ subCategory, modules: mods }) => (
                <div key={subCategory ?? "__root__"} className="mb-6">
                  {subCategory && subCategory !== "Standards & Regulations" && (
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
                        <div key={module.id} id={`module-${module.id}`}>
                          <Card
                            className={`border-border transition-all duration-150 group ${
                              effectiveLocked
                                ? "opacity-40 bg-card/30"
                                : "cursor-pointer hover:border-primary/40 bg-card/50 hover:bg-card/70"
                            }`}
                            onClick={!effectiveLocked ? () => setLocation(`/training/${module.id}`) : undefined}
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
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-mono font-bold text-xs uppercase tracking-wide truncate transition-colors ${module.isCompleted && !effectiveLocked ? "group-hover:text-primary" : ""}`}>{module.title}</span>
                                  {isPdf && (
                                    <Badge variant="outline" className="font-mono text-[9px] rounded-none py-0 px-1 text-muted-foreground border-muted-foreground/40 shrink-0">PDF</Badge>
                                  )}
                                </div>
                                {module.isCompleted && (
                                  <Badge variant="outline" className="font-mono text-[9px] text-primary border-primary rounded-none py-0 mt-0.5 w-fit">Completed</Badge>
                                )}
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{module.description}</p>
                              </div>

                              {!effectiveLocked && (
                                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
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

                          {/* Legislation Guide PDF link — appears under Law & Legislation as optional reference */}
                          {module.title.toLowerCase().includes("law & legislation") && (
                            <a
                              href="/api/documents/legislation"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 ml-9 mt-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors group"
                            >
                              <FileText className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                              <span>Important Acts and Legislation Guide</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                            </a>
                          )}

                          {/* Hazards table — injected after "5 Steps To Risk Assessment" */}
                          {isRiskAssessment && (
                            <div className="mt-2">
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
      </main>

      <div className="fixed bottom-2 left-0 right-0 text-center text-[10px] font-mono text-muted-foreground/50 tracking-widest pointer-events-none">
        COURSE CONTENT v{COURSE_CONTENT_VERSION}
      </div>
    </div>
  );
}
