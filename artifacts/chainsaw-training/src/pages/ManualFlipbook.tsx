import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, AlertTriangle, BookOpen, ArrowLeft, Search, CornerDownLeft, ZoomIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserSession } from "../contexts/UserContext";

const PAGES_BASE = `${import.meta.env.BASE_URL}manual-pages`;
const EXIT_MS = 180;
const ENTER_MS = 280;
const FLIP_MS = 550;

type LoadState = "idle" | "loading" | "loaded" | "missing" | "error";

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
    const audio = new Audio(`${import.meta.env.BASE_URL}page-turn.mp3`);
    audio.volume = 0.175;
    audio.play().catch(() => {});
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
  const [flipDir, setFlipDir] = useState<"none" | "forward" | "backward">("none");
  const [jumpInput, setJumpInput] = useState("");
  const [pageRendering, setPageRendering] = useState(false);

  // ── Fullscreen zoom ────────────────────────────────────────────────────────
  const [zoomedPage, setZoomedPage] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 });

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchIndex, setSearchIndex] = useState<PageEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const leftRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);
  const flipFrontRef = useRef<HTMLCanvasElement>(null);
  const flipBackRef = useRef<HTMLCanvasElement>(null);
  const wmRef = useRef<HTMLCanvasElement>(null);
  const wmPos = useRef(0);

  // ── Interaction refs ───────────────────────────────────────────────────────
  const bookBodyRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const mouseStartY = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const suppressClickRef = useRef(false);

  const isAnimating = flipDir !== "none";
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
    const fs = Math.max(16, Math.floor(rect.width * 0.052));
    ctx.save();
    ctx.translate(rect.width * fx, rect.height * fy);
    ctx.rotate(-Math.PI / 9);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.font = `bold ${fs}px ui-monospace,monospace`;
    ctx.fillText(fullName ?? "Student", 0, 0);
    ctx.font = `${Math.max(10, fs - 3)}px ui-monospace,monospace`;
    ctx.fillText(email ?? "", 0, fs * 1.45);
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

  // ── Escape to close fullscreen ─────────────────────────────────────────────
  useEffect(() => {
    if (zoomedPage === null) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") { setZoomedPage(null); setZoomScale(2); setZoomPan({ x: 0, y: 0 }); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [zoomedPage]);

  // Non-passive touchmove on overlay so pinch can preventDefault page zoom
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const fn = (e: TouchEvent) => { if (e.touches.length >= 2) e.preventDefault(); };
    el.addEventListener("touchmove", fn, { passive: false });
    return () => el.removeEventListener("touchmove", fn);
  });

  // ── Open fullscreen on tap ─────────────────────────────────────────────────
  const openZoom = useCallback((clientX: number) => {
    if (isAnimating || !bookBodyRef.current) return;
    const rect = bookBodyRef.current.getBoundingClientRect();
    const page = (isMobile || clientX < rect.left + rect.width / 2)
      ? currentPage
      : Math.min(currentPage + 1, numPages);
    if (page < 1 || page > numPages) return;
    setZoomedPage(page);
    setZoomScale(2);
    setZoomPan({ x: 0, y: 0 });
  }, [isAnimating, isMobile, currentPage, numPages]);

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

  // Re-render spread when page settles (skip while flip leaf is in motion)
  useEffect(() => {
    if (loadState !== "loaded" || flipDir !== "none") return;
    renderSpread(currentPage).then(() => {
      setTimeout(drawWatermark, 60);
      const s = isMobile ? 1 : 2;
      const next = currentPage + s;
      prefetchImages([next, next + 1].filter(n => n >= 1 && n <= numPages));
    });
  }, [currentPage, loadState, flipDir, renderSpread, drawWatermark, isMobile, numPages]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const step = isMobile ? 1 : 2;
  const maxPage = numPages > 0 ? numPages : 1;
  const canGoBack = currentPage > 1;
  const canGoForward = isMobile ? currentPage < maxPage : currentPage + 1 < maxPage;

  const doFlip = useCallback(async (dir: "forward" | "backward") => {
    if (isAnimating || !numPages) return;
    if (dir === "forward" && !canGoForward) return;
    if (dir === "backward" && !canGoBack) return;

    const nextPage = dir === "forward"
      ? Math.min(currentPage + step, maxPage)
      : Math.max(currentPage - step, 1);

    playPageSound();

    if (!isMobile) {
      // ── Pre-render all canvases before the leaf starts moving ──────────────
      if (dir === "forward") {
        // Front of leaf = old right page (copy from rightRef)
        const src = rightRef.current;
        if (src && flipFrontRef.current) {
          flipFrontRef.current.width = src.width;
          flipFrontRef.current.height = src.height;
          flipFrontRef.current.getContext("2d")?.drawImage(src, 0, 0);
        }
        // Back of leaf = new left page; revealed as leaf swings left
        await renderPage(nextPage, flipBackRef.current);
        // New right page already beneath the leaf; pre-render now
        await renderPage(nextPage + 1, rightRef.current);
      } else {
        // Front of leaf = old left page (copy from leftRef)
        const src = leftRef.current;
        if (src && flipFrontRef.current) {
          flipFrontRef.current.width = src.width;
          flipFrontRef.current.height = src.height;
          flipFrontRef.current.getContext("2d")?.drawImage(src, 0, 0);
        }
        // Back of leaf = new right page
        await renderPage(nextPage + 1, flipBackRef.current);
        // New left page beneath the leaf
        await renderPage(nextPage, leftRef.current);
      }
    }

    setFlipDir(dir);

    setTimeout(() => {
      // Before removing the leaf, seamlessly stamp the back-face content
      // onto the permanent canvas so there's no flash when the leaf disappears
      if (!isMobile) {
        const fb = flipBackRef.current;
        if (dir === "forward") {
          const lc = leftRef.current;
          if (fb && lc) { lc.width = fb.width; lc.height = fb.height; lc.getContext("2d")?.drawImage(fb, 0, 0); }
        } else {
          const rc = rightRef.current;
          if (fb && rc) { rc.width = fb.width; rc.height = fb.height; rc.getContext("2d")?.drawImage(fb, 0, 0); }
        }
      }
      setCurrentPage(nextPage);
      setFlipDir("none");
    }, FLIP_MS);
  }, [isAnimating, numPages, canGoForward, canGoBack, currentPage, step, maxPage, isMobile, renderPage]);

  // ── Touch / mouse swipe + tap-to-zoom ────────────────────────────────────
  const touchStartX = useRef<number | null>(null);
  const mouseStartX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - (touchStartY.current ?? t.clientY);
    touchStartX.current = null; touchStartY.current = null;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { openZoom(t.clientX); return; }
    if (Math.abs(dx) < 40) return;
    doFlip(dx < 0 ? "forward" : "backward");
  };
  const onMouseDown = (e: React.MouseEvent) => {
    mouseStartX.current = e.clientX;
    mouseStartY.current = e.clientY;
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (mouseStartX.current === null) return;
    const dx = e.clientX - mouseStartX.current;
    const dy = e.clientY - (mouseStartY.current ?? e.clientY);
    mouseStartX.current = null; mouseStartY.current = null;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) { openZoom(e.clientX); return; }
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

  return (
    <>
      <style>{`
        @media print { body { display: none !important; } }

        /* ── 3-D flip keyframes ─────────────────────────────────────────── */
        @keyframes flipFwd {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(-180deg); }
        }
        @keyframes flipBwd {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(180deg); }
        }

        /* Shadow on the static page while the leaf sweeps over it */
        @keyframes shadowFwd {
          0%   { opacity: 0; }
          40%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes shadowBwd {
          0%   { opacity: 0; }
          40%  { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Mobile: simple slide-fade */
        @keyframes mobileExitLeft  { to { opacity:0; transform:translateX(-28px) scale(0.97); } }
        @keyframes mobileExitRight { to { opacity:0; transform:translateX( 28px) scale(0.97); } }
        @keyframes mobileEnterRight { from { opacity:0; transform:translateX( 28px) scale(0.97); } }
        @keyframes mobileEnterLeft  { from { opacity:0; transform:translateX(-28px) scale(0.97); } }

        .page-canvas { display:block; width:100%; height:100%; object-fit:contain; }
      `}</style>

      <div className="h-screen flex flex-col select-none overflow-hidden" onContextMenu={e => e.preventDefault()}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
              <Link href="/training"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
            </Button>
            <BookOpen className="w-4 h-4 text-orange-500" />
            <span className="font-mono font-bold uppercase tracking-widest text-sm">Digital Chainsaw Manual</span>
          </div>
        </header>

        {/* ── Main ──────────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center px-2 py-2 gap-2 bg-stone-100 dark:bg-stone-900 min-h-0 overflow-hidden">

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

          {/* ── Search / go-to toolbar ──────────────────────────────────────── */}
          {loadState === "loaded" && (
            <div className="w-full max-w-5xl flex flex-col sm:flex-row gap-2" ref={searchRef}>
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
                    <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }} className="text-muted-foreground hover:text-foreground transition-colors text-xs font-mono">✕</button>
                  )}
                </div>
                {searchOpen && searchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                    {searchResults.length === 0
                      ? <p className="px-4 py-3 text-sm text-muted-foreground">No pages match "{searchQuery}"</p>
                      : <ul>{searchResults.map(hit => (
                          <li key={hit.page}>
                            <button
                              className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-start gap-3 border-b border-border/50 last:border-0"
                              onClick={() => { jumpToPage(hit.page); setSearchOpen(false); setSearchQuery(""); }}
                            >
                              <span className="shrink-0 mt-0.5 text-[10px] font-mono font-bold bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 leading-none">p.{hit.page}</span>
                              <span className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{hit.snippet}</span>
                            </button>
                          </li>
                        ))}</ul>
                    }
                  </div>
                )}
              </div>
              <form onSubmit={handleJump} className="flex items-center gap-2 border border-border rounded-md bg-card px-3 py-2 shadow-sm shrink-0">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider whitespace-nowrap">Go to</span>
                <input value={jumpInput} onChange={e => setJumpInput(e.target.value)} placeholder={`1–${numPages}`} className="w-14 text-sm text-center bg-transparent outline-none placeholder:text-muted-foreground/40" type="number" min={1} max={numPages} />
                <button type="submit" className="text-muted-foreground hover:text-orange-500 transition-colors" aria-label="Jump to page"><CornerDownLeft className="w-4 h-4" /></button>
              </form>
            </div>
          )}

          {/* ── Book viewer ─────────────────────────────────────────────────── */}
          {loadState === "loaded" && (
            <div className="flex items-center w-full max-w-5xl flex-1 min-h-0">

              {/* ── Book ───────────────────────────────────────────────────── */}
              <div
                className="flex-1 relative h-full min-h-0 flex flex-col justify-center"
                onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown} onMouseUp={onMouseUp}
                style={{ cursor: isAnimating ? "default" : "pointer" }}
              >
                {/* Page edge stacks */}
                {!isMobile && (
                  <>
                    <PageEdgeStack side="left" total={numPages} current={currentPage} />
                    <PageEdgeStack side="right" total={numPages} current={currentPage} />
                  </>
                )}

                {/* Book body */}
                <div
                  ref={bookBodyRef}
                  className="relative rounded-sm overflow-hidden w-full"
                  style={{
                    aspectRatio: isMobile ? "1/1.414" : "2/1.414",
                    maxHeight: "100%",
                    boxShadow: "0 12px 50px rgba(0,0,0,0.35), 0 3px 10px rgba(0,0,0,0.20)",
                    background: "#f5f2ee",
                    perspective: "2200px",
                    /* Mobile slide-fade on the whole book */
                    animation: isMobile && flipDir === "forward" ? `mobileExitLeft ${EXIT_MS}ms ease forwards`
                             : isMobile && flipDir === "backward" ? `mobileExitRight ${EXIT_MS}ms ease forwards`
                             : undefined,
                  }}
                >
                  {/* ── Static pages ───────────────────────────────────────── */}
                  <div className="absolute inset-0 flex">

                    {/* Left page */}
                    <div className="relative bg-[#fdfcfa] overflow-hidden"
                      style={{ width: isMobile ? "100%" : "50%", borderRight: isMobile ? "none" : "1px solid #ddd8d0" }}>
                      <canvas ref={leftRef} className="page-canvas" style={{ position:"absolute", inset:0 }} />
                    </div>

                    {/* Right page — desktop only */}
                    {!isMobile && (
                      <div className="relative bg-[#fdfcfa] overflow-hidden" style={{ width:"50%" }}>
                        <canvas ref={rightRef} className="page-canvas" style={{ position:"absolute", inset:0 }} />
                      </div>
                    )}
                  </div>

                  {/* ── Forward flip leaf ──────────────────────────────────── */}
                  {/* Positioned on the right half; swings left around the spine */}
                  {flipDir === "forward" && !isMobile && (
                    <div style={{
                      position:"absolute", top:0, bottom:0, left:"50%", width:"50%",
                      transformOrigin:"left center",
                      transformStyle:"preserve-3d",
                      animation:`flipFwd ${FLIP_MS}ms cubic-bezier(0.55,0,0.45,1) forwards`,
                      zIndex:15,
                    }}>
                      {/* Front face: old right page */}
                      <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", overflow:"hidden", background:"#fdfcfa" }}>
                        <canvas ref={flipFrontRef} className="page-canvas" style={{ position:"absolute", inset:0 }} />
                        {/* Spine-edge gradient to simulate paper catching light */}
                        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right, rgba(0,0,0,0.13) 0%, transparent 12%)", pointerEvents:"none" }} />
                      </div>
                      {/* Back face: new left page (scaleX(-1) corrects the mirror) */}
                      <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", transform:"rotateY(180deg) scaleX(-1)", overflow:"hidden", background:"#fdfcfa" }}>
                        <canvas ref={flipBackRef} className="page-canvas" style={{ position:"absolute", inset:0 }} />
                        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to left, rgba(0,0,0,0.13) 0%, transparent 12%)", pointerEvents:"none" }} />
                      </div>
                    </div>
                  )}

                  {/* ── Backward flip leaf ─────────────────────────────────── */}
                  {/* Positioned on the left half; swings right around the spine */}
                  {flipDir === "backward" && !isMobile && (
                    <div style={{
                      position:"absolute", top:0, bottom:0, left:0, width:"50%",
                      transformOrigin:"right center",
                      transformStyle:"preserve-3d",
                      animation:`flipBwd ${FLIP_MS}ms cubic-bezier(0.55,0,0.45,1) forwards`,
                      zIndex:15,
                    }}>
                      {/* Front face: old left page */}
                      <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", overflow:"hidden", background:"#fdfcfa" }}>
                        <canvas ref={flipFrontRef} className="page-canvas" style={{ position:"absolute", inset:0 }} />
                        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to left, rgba(0,0,0,0.13) 0%, transparent 12%)", pointerEvents:"none" }} />
                      </div>
                      {/* Back face: new right page */}
                      <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", transform:"rotateY(-180deg) scaleX(-1)", overflow:"hidden", background:"#fdfcfa" }}>
                        <canvas ref={flipBackRef} className="page-canvas" style={{ position:"absolute", inset:0 }} />
                        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right, rgba(0,0,0,0.13) 0%, transparent 12%)", pointerEvents:"none" }} />
                      </div>
                    </div>
                  )}

                  {/* ── Cast shadows on static pages during flip ───────────── */}
                  {flipDir === "forward" && !isMobile && (
                    <div style={{
                      position:"absolute", top:0, bottom:0, left:0, width:"50%",
                      background:"linear-gradient(to left, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 65%)",
                      animation:`shadowFwd ${FLIP_MS}ms ease-in-out forwards`,
                      zIndex:14, pointerEvents:"none",
                    }} />
                  )}
                  {flipDir === "backward" && !isMobile && (
                    <div style={{
                      position:"absolute", top:0, bottom:0, right:0, width:"50%",
                      background:"linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 65%)",
                      animation:`shadowBwd ${FLIP_MS}ms ease-in-out forwards`,
                      zIndex:14, pointerEvents:"none",
                    }} />
                  )}

                  {/* ── Spine binding ──────────────────────────────────────── */}
                  {!isMobile && (
                    <div style={{
                      position:"absolute", top:0, bottom:0,
                      left:"calc(50% - 9px)", width:18,
                      background:"linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.22) 25%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.22) 75%, rgba(0,0,0,0) 100%)",
                      zIndex:25, pointerEvents:"none",
                    }} />
                  )}

                  {/* ── Page-edge lines ────────────────────────────────────── */}
                  <div className="absolute inset-x-0 top-0 h-px bg-stone-300/60 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-px bg-stone-400/40 pointer-events-none" />

                  {/* ── Watermark ──────────────────────────────────────────── */}
                  <canvas ref={wmRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden style={{ zIndex:30 }} />

                  {/* ── Loading spinner ────────────────────────────────────── */}
                  {pageRendering && !isAnimating && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{ zIndex:35, background:"rgba(250,248,245,0.55)" }}>
                      <Loader2 className="w-7 h-7 animate-spin text-orange-500 drop-shadow" />
                    </div>
                  )}
                </div>

                <p className="text-center text-[10px] text-stone-400 mt-2 font-mono tracking-widest">
                  SWIPE TO TURN PAGES · TAP TO ZOOM
                </p>
              </div>
            </div>
          )}

          {loadState === "loaded" && (
            <>
              <p className="text-xs text-stone-500 font-mono">{spreadLabel}</p>
              <div className="w-full max-w-5xl h-1 bg-stone-300 dark:bg-stone-700 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all duration-500"
                  style={{ width:`${(currentPage / numPages) * 100}%` }} />
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Fullscreen zoom overlay ──────────────────────────────────────────── */}
      {zoomedPage !== null && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center select-none"
          style={{ background: "rgba(0,0,0,0.93)", touchAction: "none" }}
          onWheel={e => {
            e.preventDefault();
            setZoomScale(s => Math.min(5, Math.max(1, s - e.deltaY * 0.0035)));
          }}
          onTouchStart={e => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              pinchRef.current = { dist: Math.sqrt(dx*dx + dy*dy), scale: zoomScale };
            } else if (e.touches.length === 1) {
              panRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, ox: zoomPan.x, oy: zoomPan.y };
            }
          }}
          onTouchMove={e => {
            if (e.touches.length === 2 && pinchRef.current) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              setZoomScale(Math.min(5, Math.max(1, pinchRef.current.scale * dist / pinchRef.current.dist)));
            } else if (e.touches.length === 1 && zoomScale > 1 && panRef.current) {
              const dx = e.touches[0].clientX - panRef.current.sx;
              const dy = e.touches[0].clientY - panRef.current.sy;
              setZoomPan({ x: panRef.current.ox + dx, y: panRef.current.oy + dy });
            }
          }}
          onTouchEnd={e => {
            // Suppress the synthetic onClick that mobile fires after every touchend
            suppressClickRef.current = true;
            setTimeout(() => { suppressClickRef.current = false; }, 400);

            if (e.touches.length === 0) {
              const wasPinch = pinchRef.current !== null;
              const pan = panRef.current;
              const t = e.changedTouches[0];
              const moved = pan && (
                Math.abs(t.clientX - pan.sx) > 10 ||
                Math.abs(t.clientY - pan.sy) > 10
              );
              pinchRef.current = null; panRef.current = null;
              // Only act on tap (not pinch, not pan) — one tap always closes
              if (!wasPinch && !moved) {
                setZoomedPage(null);
                setZoomScale(2);
                setZoomPan({ x: 0, y: 0 });
              }
            } else {
              pinchRef.current = null;
            }
          }}
          onClick={() => {
            if (suppressClickRef.current) return;
            setZoomedPage(null);
            setZoomScale(2);
            setZoomPan({ x: 0, y: 0 });
          }}
        >
          {/* Page image with zoom + pan transform */}
          <div
            style={{
              transform: `scale(${zoomScale}) translate(${zoomPan.x / zoomScale}px, ${zoomPan.y / zoomScale}px)`,
              transformOrigin: "center center",
              transition: "none",
              position: "relative",
              width: "100vw",
              height: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={e => e.stopPropagation()}
          >
            <img
              src={pageUrl(zoomedPage)}
              alt={`Page ${zoomedPage}`}
              style={{
                display: "block",
                maxWidth: "100vw",
                maxHeight: "100vh",
                objectFit: "contain",
                boxShadow: "0 8px 60px rgba(0,0,0,0.6)",
                borderRadius: 2,
                userSelect: "none",
                WebkitUserDrag: "none" as React.CSSProperties["userSelect"],
              } as React.CSSProperties}
              draggable={false}
            />

            {/* Watermark tiles */}
            {[
              [0.50, 0.35], [0.25, 0.60], [0.75, 0.60],
              [0.50, 0.68], [0.35, 0.20], [0.65, 0.20],
            ].map(([fx, fy], i) => (
              <div key={i} style={{
                position: "absolute",
                left: `${fx * 100}%`, top: `${fy * 100}%`,
                transform: "translate(-50%, -50%) rotate(-20deg)",
                pointerEvents: "none", userSelect: "none",
                opacity: 0.17, textAlign: "center",
                fontFamily: "ui-monospace, monospace", fontWeight: "bold",
                fontSize: "clamp(12px, 2.2vw, 20px)",
                color: "#1a1a1a", lineHeight: 1.4,
                whiteSpace: "nowrap",
              }}>
                <div>{fullName}</div>
                <div style={{ fontSize: "0.82em" }}>{email}</div>
              </div>
            ))}
          </div>

          {/* ── Controls ──────────────────────────────────────────────────────── */}
          {/* Close button */}
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            onClick={() => setZoomedPage(null)}
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Page indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <span className="text-white/60 text-xs font-mono tracking-widest">
              PAGE {zoomedPage} · {Math.round(zoomScale * 100)}% · TAP TO CLOSE
            </span>
          </div>

          {/* Zoom hint icon when at 1× */}
          <div className="absolute top-4 left-4 text-white/30 pointer-events-none">
            <ZoomIn className="w-5 h-5" />
          </div>
        </div>
      )}
    </>
  );
}
