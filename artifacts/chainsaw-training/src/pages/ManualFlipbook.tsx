import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, BookOpen, ArrowLeft, Search, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserSession } from "../contexts/UserContext";

const PAGES_BASE = `${import.meta.env.BASE_URL}manual-pages`;
const EXIT_MS = 180;
const ENTER_MS = 280;

type LoadState = "idle" | "loading" | "loaded" | "missing" | "error";
type BookAnim = "idle" | "exit-fwd" | "exit-bwd" | "enter-fwd" | "enter-bwd";

interface PageEntry { page: number; text: string; }

const WM_POS: [number, number][] = [
  [0.50, 0.35], [0.28, 0.60], [0.72, 0.60],
  [0.50, 0.55], [0.35, 0.40], [0.65, 0.40],
];

function pageUrl(n: number) {
  return `${PAGES_BASE}/page-${String(n).padStart(3, "0")}.jpg`;
}

// ── Synthesised paper-rasping sound ──────────────────────────────────────────
function playPageSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const dur = 0.22;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 28) * (1 - Math.exp(-t * 80)) * 0.55;
      d[i] = ((Math.random() * 2 - 1) * 0.7 + (Math.random() * 2 - 1) * 0.3) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 0.7;
    const hs = ctx.createBiquadFilter();
    hs.type = "highshelf"; hs.frequency.value = 4800; hs.gain.value = 5;
    const gain = ctx.createGain(); gain.gain.value = 1.1;
    src.connect(bp); bp.connect(hs); hs.connect(gain); gain.connect(ctx.destination);
    src.start();
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch { /* ignore */ }
}

// ── Load a page image onto a canvas element ───────────────────────────────────
function loadImageToCanvas(pageNum: number, total: number, el: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve) => {
    if (pageNum < 1 || pageNum > total) {
      el.width = 595; el.height = 842;
      const ctx = el.getContext("2d");
      if (ctx) { ctx.fillStyle = "#faf8f5"; ctx.fillRect(0, 0, 595, 842); }
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => {
      el.width = img.naturalWidth;
      el.height = img.naturalHeight;
      const ctx = el.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0);
      resolve();
    };
    img.onerror = () => {
      el.width = 595; el.height = 842;
      const ctx = el.getContext("2d");
      if (ctx) { ctx.fillStyle = "#faf8f5"; ctx.fillRect(0, 0, 595, 842); }
      resolve();
    };
    img.src = pageUrl(pageNum);
  });
}

function prefetchImages(pageNums: number[]) {
  for (const n of pageNums) {
    const img = new Image();
    img.src = pageUrl(n);
  }
}

// ── Page-edge stack decorations ───────────────────────────────────────────────
function PageEdgeStack({ side, total, current }: { side: "left" | "right"; total: number; current: number }) {
  const count = side === "left"
    ? Math.round((current / Math.max(total, 1)) * 6)
    : Math.round(((total - current) / Math.max(total, 1)) * 6);
  const strips = Math.max(1, Math.min(count, 6));
  return (
    <div
      className="absolute top-1 bottom-1 pointer-events-none"
      style={{ [side === "left" ? "right" : "left"]: "100%", width: strips * 3 + 3 }}
    >
      {Array.from({ length: strips }, (_, i) => (
        <div
          key={i}
          className="absolute inset-y-0"
          style={{
            width: 2.5,
            [side === "left" ? "right" : "left"]: i * 3,
            background: `hsl(40,20%,${94 - i * 2}%)`,
            boxShadow: side === "right"
              ? "1px 0 2px rgba(0,0,0,0.10)"
              : "-1px 0 2px rgba(0,0,0,0.10)",
            borderRadius: side === "right" ? "0 1px 1px 0" : "1px 0 0 1px",
          }}
        />
      ))}
    </div>
  );
}

export default function ManualFlipbook() {
  const { activationCode, fullName, email } = useUserSession();
  const [, navigate] = useLocation();
  useEffect(() => { if (!activationCode) navigate("/"); }, [activationCode, navigate]);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [bookAnim, setBookAnim] = useState<BookAnim>("idle");
  const [jumpInput, setJumpInput] = useState("");
  const [pageRendering, setPageRendering] = useState(false);

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchIndex, setSearchIndex] = useState<PageEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const leftRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);
  const wmRef = useRef<HTMLCanvasElement>(null);
  const wmPos = useRef(0);

  const isAnimating = bookAnim !== "idle";
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 700);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // ── Load manifest then search index ──────────────────────────────────────
  useEffect(() => {
    setLoadState("loading");
    fetch(`${PAGES_BASE}/manifest.json`)
      .then(r => {
        if (!r.ok) throw new Error("missing");
        return r.json() as Promise<{ pages: number }>;
      })
      .then(data => {
        setNumPages(data.pages);
        setLoadState("loaded");
        // Fetch search index in the background (non-blocking)
        fetch(`${PAGES_BASE}/search-index.json`)
          .then(r => r.ok ? r.json() as Promise<PageEntry[]> : Promise.resolve([]))
          .then(idx => setSearchIndex(idx))
          .catch(() => {});
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setLoadState(msg === "missing" ? "missing" : "error");
      });
  }, []);

  // ── Search results ────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || searchIndex.length === 0) return [];
    const words = q.split(/\s+/).filter(Boolean);
    type Hit = { page: number; snippet: string; score: number };
    const hits: Hit[] = [];
    for (const entry of searchIndex) {
      const text = entry.text.toLowerCase();
      const matchCount = words.filter(w => text.includes(w)).length;
      if (matchCount === 0) continue;
      // Build snippet: find first word hit, extract ±50 chars around it
      const firstWordIdx = Math.max(0, ...words.map(w => entry.text.toLowerCase().indexOf(w)).filter(i => i >= 0));
      const start = Math.max(0, firstWordIdx - 45);
      const end = Math.min(entry.text.length, firstWordIdx + 90);
      let snippet = entry.text.slice(start, end).replace(/\s+/g, " ").trim();
      if (start > 0) snippet = "…" + snippet;
      if (end < entry.text.length) snippet += "…";
      hits.push({ page: entry.page, snippet, score: matchCount });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, 8);
  }, [searchQuery, searchIndex]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Watermark ─────────────────────────────────────────────────────────────
  const drawWatermark = useCallback(() => {
    const wm = wmRef.current;
    if (!wm) return;
    const rect = wm.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    wm.width = Math.round(rect.width * dpr);
    wm.height = Math.round(rect.height * dpr);
    const ctx = wm.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const [fx, fy] = WM_POS[wmPos.current % WM_POS.length];
    const fs = Math.max(10, Math.floor(rect.width * 0.021));
    ctx.save();
    ctx.translate(rect.width * fx, rect.height * fy);
    ctx.rotate(-Math.PI / 9);
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.font = `bold ${fs}px ui-monospace,monospace`;
    ctx.fillText(fullName ?? "Student", 0, 0);
    ctx.font = `${Math.max(8, fs - 2)}px ui-monospace,monospace`;
    ctx.fillText(email ?? "", 0, fs * 1.4);
    ctx.restore();
  }, [fullName, email]);

  useEffect(() => {
    const t = setInterval(() => { wmPos.current = (wmPos.current + 1) % WM_POS.length; drawWatermark(); }, 30_000);
    return () => clearInterval(t);
  }, [drawWatermark]);
  useEffect(() => {
    window.addEventListener("resize", drawWatermark);
    return () => window.removeEventListener("resize", drawWatermark);
  }, [drawWatermark]);

  // ── Render single page to canvas ─────────────────────────────────────────
  const renderPage = useCallback((pageNum: number, el: HTMLCanvasElement | null) => {
    if (!el) return Promise.resolve();
    return loadImageToCanvas(pageNum, numPages, el);
  }, [numPages]);

  // ── Render current spread ─────────────────────────────────────────────────
  const renderSpread = useCallback(async (p: number) => {
    if (!numPages) return;
    setPageRendering(true);
    try {
      if (isMobile) {
        await renderPage(p, leftRef.current);
      } else {
        await Promise.all([
          renderPage(p, leftRef.current),
          renderPage(p + 1, rightRef.current),
        ]);
      }
    } finally {
      setPageRendering(false);
    }
  }, [isMobile, numPages, renderPage]);

  // Re-render when page changes (only during enter phase, not exit)
  useEffect(() => {
    if (loadState !== "loaded" || bookAnim === "exit-fwd" || bookAnim === "exit-bwd") return;
    renderSpread(currentPage).then(() => {
      setTimeout(drawWatermark, 60);
      const step = isMobile ? 1 : 2;
      const next = currentPage + step;
      prefetchImages([next, next + 1].filter(n => n >= 1 && n <= numPages));
    });
  }, [currentPage, loadState, bookAnim, renderSpread, drawWatermark, isMobile, numPages]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const step = isMobile ? 1 : 2;
  const maxPage = numPages > 0 ? numPages : 1;
  const canGoBack = currentPage > 1;
  const canGoForward = isMobile ? currentPage < maxPage : currentPage + 1 < maxPage;

  const doFlip = useCallback((dir: "forward" | "backward") => {
    if (isAnimating || !numPages) return;
    if (dir === "forward" && !canGoForward) return;
    if (dir === "backward" && !canGoBack) return;

    const nextPage = dir === "forward"
      ? Math.min(currentPage + step, maxPage)
      : Math.max(currentPage - step, 1);

    playPageSound();

    // Phase 1: slide out
    setBookAnim(dir === "forward" ? "exit-fwd" : "exit-bwd");

    setTimeout(() => {
      // Phase 2: update page (triggers re-render) + slide in
      setCurrentPage(nextPage);
      setBookAnim(dir === "forward" ? "enter-fwd" : "enter-bwd");

      // Phase 3: idle
      setTimeout(() => setBookAnim("idle"), ENTER_MS);
    }, EXIT_MS);
  }, [isAnimating, numPages, canGoForward, canGoBack, currentPage, step, maxPage]);

  // ── Touch / mouse swipe ───────────────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);
  const mouseStartX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    doFlip(dx < 0 ? "forward" : "backward");
  };
  const onMouseDown = (e: React.MouseEvent) => { mouseStartX.current = e.clientX; };
  const onMouseUp = (e: React.MouseEvent) => {
    if (mouseStartX.current === null) return;
    const dx = e.clientX - mouseStartX.current;
    mouseStartX.current = null;
    if (Math.abs(dx) < 50) return;
    doFlip(dx < 0 ? "forward" : "backward");
  };

  const jumpToPage = useCallback((n: number) => {
    if (isNaN(n) || n < 1 || n > numPages) return;
    const snapped = isMobile ? n : (n % 2 === 0 ? n - 1 : n);
    setCurrentPage(Math.max(1, Math.min(snapped, maxPage)));
  }, [numPages, isMobile, maxPage]);

  const handleJump = (ev: React.FormEvent) => {
    ev.preventDefault();
    jumpToPage(parseInt(jumpInput, 10));
    setJumpInput("");
  };

  const spreadLabel = (() => {
    if (!numPages) return "";
    if (isMobile) return `Page ${currentPage} of ${numPages}`;
    return `Pages ${currentPage}–${Math.min(currentPage + 1, numPages)} of ${numPages}`;
  })();

  if (!activationCode) return null;

  // Derive inline animation style for the book
  const bookStyle: React.CSSProperties = (() => {
    switch (bookAnim) {
      case "exit-fwd":
        return { animation: `pageExitLeft ${EXIT_MS}ms cubic-bezier(0.4,0,1,1) forwards` };
      case "exit-bwd":
        return { animation: `pageExitRight ${EXIT_MS}ms cubic-bezier(0.4,0,1,1) forwards` };
      case "enter-fwd":
        return { animation: `pageEnterRight ${ENTER_MS}ms cubic-bezier(0,0,0.2,1) forwards` };
      case "enter-bwd":
        return { animation: `pageEnterLeft ${ENTER_MS}ms cubic-bezier(0,0,0.2,1) forwards` };
      default:
        return {};
    }
  })();

  return (
    <>
      <style>{`
        @media print { body { display: none !important; } }

        @keyframes pageExitLeft {
          from { opacity: 1; transform: translateX(0)    scale(1); }
          to   { opacity: 0; transform: translateX(-32px) scale(0.97); }
        }
        @keyframes pageExitRight {
          from { opacity: 1; transform: translateX(0)   scale(1); }
          to   { opacity: 0; transform: translateX(32px) scale(0.97); }
        }
        @keyframes pageEnterRight {
          from { opacity: 0; transform: translateX(28px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
        @keyframes pageEnterLeft {
          from { opacity: 0; transform: translateX(-28px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)     scale(1); }
        }

        .book-page canvas { display: block; width: 100%; height: 100%; object-fit: contain; }
      `}</style>

      <div className="min-h-screen flex flex-col select-none" onContextMenu={e => e.preventDefault()}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
              <Link href="/training"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
            </Button>
            <BookOpen className="w-4 h-4 text-orange-500" />
            <span className="font-mono font-bold uppercase tracking-widest text-sm">Digital Chainsaw Manual</span>
          </div>
        </header>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center px-2 py-6 gap-5 bg-stone-100 dark:bg-stone-900">

          {loadState === "loading" && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground py-24">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-sm font-semibold">Opening manual…</p>
            </div>
          )}

          {loadState === "missing" && (
            <div className="max-w-md text-center space-y-4 py-20">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-orange-500" />
                </div>
              </div>
              <h2 className="font-black tracking-tighter text-lg uppercase">Manual Not Found</h2>
              <p className="text-sm text-muted-foreground">Page images have not been generated yet.</p>
              <code className="block bg-muted rounded px-3 py-2 text-xs font-mono">public/manual-pages/</code>
            </div>
          )}

          {loadState === "error" && (
            <div className="max-w-md text-center space-y-3 py-20">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
              <p className="text-sm font-semibold">Failed to load the manual.</p>
              <button onClick={() => window.location.reload()} className="text-xs underline text-muted-foreground">Reload</button>
            </div>
          )}

          {loadState === "loaded" && (
            <div className="w-full max-w-5xl flex flex-col sm:flex-row gap-2" ref={searchRef}>

              {/* ── Search ─────────────────────────────────────────────── */}
              <div className="relative flex-1">
                <div className="flex items-center gap-2 border border-border rounded-md bg-card px-3 py-2 shadow-sm">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder={searchIndex.length ? "Search manual content…" : "Loading search index…"}
                    disabled={searchIndex.length === 0}
                    className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                      className="text-muted-foreground hover:text-foreground transition-colors text-xs font-mono"
                    >✕</button>
                  )}
                </div>

                {/* Results dropdown */}
                {searchOpen && searchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                    {searchResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No pages match "{searchQuery}"</p>
                    ) : (
                      <ul>
                        {searchResults.map(hit => (
                          <li key={hit.page}>
                            <button
                              className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-start gap-3 border-b border-border/50 last:border-0"
                              onClick={() => { jumpToPage(hit.page); setSearchOpen(false); setSearchQuery(""); }}
                            >
                              <span className="shrink-0 mt-0.5 text-[10px] font-mono font-bold bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 leading-none">
                                p.{hit.page}
                              </span>
                              <span className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{hit.snippet}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* ── Go to page ─────────────────────────────────────────── */}
              <form onSubmit={handleJump} className="flex items-center gap-2 border border-border rounded-md bg-card px-3 py-2 shadow-sm shrink-0">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider whitespace-nowrap">Go to</span>
                <input
                  value={jumpInput}
                  onChange={e => setJumpInput(e.target.value)}
                  placeholder={`1–${numPages}`}
                  className="w-14 text-sm text-center bg-transparent outline-none placeholder:text-muted-foreground/40"
                  type="number" min={1} max={numPages}
                />
                <button
                  type="submit"
                  className="text-muted-foreground hover:text-orange-500 transition-colors"
                  aria-label="Jump to page"
                >
                  <CornerDownLeft className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {loadState === "loaded" && (
            <div className="flex items-center gap-4 w-full max-w-5xl">

              {/* Prev */}
              <button
                onClick={() => doFlip("backward")}
                disabled={!canGoBack || isAnimating}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* ── Book ─────────────────────────────────────────────────── */}
              <div
                className="flex-1 relative"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                style={{ cursor: isAnimating ? "default" : "grab" }}
              >
                {/* Page edge stacks */}
                {!isMobile && (
                  <>
                    <PageEdgeStack side="left" total={numPages} current={currentPage} />
                    <PageEdgeStack side="right" total={numPages} current={currentPage} />
                  </>
                )}

                {/* Book body — animated wrapper */}
                <div
                  className="relative rounded-sm overflow-hidden"
                  style={{
                    aspectRatio: isMobile ? "1/1.414" : "2/1.414",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)",
                    background: "#faf8f5",
                    ...bookStyle,
                  }}
                >
                  {/* Pages row */}
                  <div className="absolute inset-0 flex">

                    {/* Left page */}
                    <div
                      className="book-page relative bg-white overflow-hidden"
                      style={{ width: isMobile ? "100%" : "50%", borderRight: isMobile ? "none" : "1px solid #e2ddd8" }}
                    >
                      <canvas ref={leftRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>

                    {/* Right page — desktop only */}
                    {!isMobile && (
                      <div
                        className="book-page relative bg-white overflow-hidden"
                        style={{ width: "50%" }}
                      >
                        <canvas ref={rightRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                      </div>
                    )}
                  </div>

                  {/* Spine shadow */}
                  {!isMobile && (
                    <div
                      className="absolute inset-y-0 pointer-events-none"
                      style={{
                        left: "calc(50% - 6px)",
                        width: 12,
                        background: "linear-gradient(to right, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.18) 45%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.07) 100%)",
                        zIndex: 5,
                      }}
                    />
                  )}

                  {/* Top/bottom page-edge lines */}
                  <div className="absolute inset-x-0 top-0 h-px bg-stone-300/60 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-px bg-stone-400/40 pointer-events-none" />

                  {/* Watermark */}
                  <canvas ref={wmRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden style={{ zIndex: 20 }} />

                  {/* Per-page loading spinner */}
                  {pageRendering && bookAnim === "idle" && (
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{ zIndex: 25, background: "rgba(250,248,245,0.55)" }}
                    >
                      <Loader2 className="w-7 h-7 animate-spin text-orange-500 drop-shadow" />
                    </div>
                  )}
                </div>

                <p className="text-center text-[10px] text-stone-400 mt-2 font-mono tracking-widest">
                  SWIPE OR USE ARROWS TO TURN PAGES
                </p>
              </div>

              {/* Next */}
              <button
                onClick={() => doFlip("forward")}
                disabled={!canGoForward || isAnimating}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow"
                aria-label="Next page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {loadState === "loaded" && (
            <>
              <p className="text-xs text-stone-500 font-mono">{spreadLabel}</p>
              <div className="w-full max-w-5xl h-1 bg-stone-300 dark:bg-stone-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${(currentPage / numPages) * 100}%` }}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
