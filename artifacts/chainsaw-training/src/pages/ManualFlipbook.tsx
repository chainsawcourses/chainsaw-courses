import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserSession } from "../contexts/UserContext";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;

const MANUAL_URL = `${import.meta.env.BASE_URL}pdfs/manual.pdf`;
const RENDER_SCALE = 1.8;
const FLIP_MS = 550;

type LoadState = "idle" | "loading" | "loaded" | "missing" | "error";
type FlipDir = "none" | "forward" | "backward";

const WM_POS: [number, number][] = [
  [0.50, 0.35], [0.28, 0.60], [0.72, 0.60],
  [0.50, 0.55], [0.35, 0.40], [0.65, 0.40],
];

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
      // Short attack, fast exponential decay with some roughness
      const env = Math.exp(-t * 28) * (1 - Math.exp(-t * 80)) * 0.55;
      // Two noise layers for texture
      d[i] = ((Math.random() * 2 - 1) * 0.7 + (Math.random() * 2 - 1) * 0.3) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Bandpass ~ 2.5 kHz for paper "swish"
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600;
    bp.Q.value = 0.7;
    // Slight high-shelf crispness
    const hs = ctx.createBiquadFilter();
    hs.type = "highshelf";
    hs.frequency.value = 4800;
    hs.gain.value = 5;
    const gain = ctx.createGain();
    gain.gain.value = 1.1;
    src.connect(bp); bp.connect(hs); hs.connect(gain); gain.connect(ctx.destination);
    src.start();
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch { /* ignore */ }
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
  const [flipDir, setFlipDir] = useState<FlipDir>("none");
  const [jumpInput, setJumpInput] = useState("");

  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  // Permanent canvases
  const leftRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);
  // Flip canvases (front = old right, back = new left, newR = new right)
  const flipFrontRef = useRef<HTMLCanvasElement>(null);
  const flipBackRef = useRef<HTMLCanvasElement>(null);
  const newRightRef = useRef<HTMLCanvasElement>(null);
  const wmRef = useRef<HTMLCanvasElement>(null);
  const wmPos = useRef(0);

  const isAnimating = flipDir !== "none";
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 700);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // ── Load PDF ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadState("loading");
    const task = pdfjsLib.getDocument({ url: MANUAL_URL, withCredentials: false });
    task.promise.then(doc => {
      pdfRef.current = doc;
      setNumPages(doc.numPages);
      setLoadState("loaded");
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadState(msg.includes("404") || msg.includes("Missing") || msg.includes("server response") ? "missing" : "error");
    });
    return () => { task.destroy?.(); };
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
  useEffect(() => { window.addEventListener("resize", drawWatermark); return () => window.removeEventListener("resize", drawWatermark); }, [drawWatermark]);

  // ── Render single page to canvas ─────────────────────────────────────────
  const renderPage = useCallback(async (pageNum: number, el: HTMLCanvasElement | null) => {
    if (!el) return;
    const pdf = pdfRef.current;
    if (!pdf || pageNum < 1 || pageNum > pdf.numPages) {
      const ctx = el.getContext("2d");
      if (ctx) { el.width = 595; el.height = 842; ctx.fillStyle = "#faf8f5"; ctx.fillRect(0, 0, 595, 842); }
      return;
    }
    const page = await pdf.getPage(pageNum);
    const vp = page.getViewport({ scale: RENDER_SCALE });
    el.width = vp.width; el.height = vp.height;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    await page.render({ canvas: el, canvasContext: ctx, viewport: vp }).promise;
  }, []);

  // ── Render current spread ─────────────────────────────────────────────────
  const renderSpread = useCallback(async (p: number) => {
    if (!pdfRef.current) return;
    if (isMobile) {
      await renderPage(p, leftRef.current);
    } else {
      await Promise.allSettled([
        renderPage(p, leftRef.current),
        renderPage(p + 1, rightRef.current),
      ]);
    }
  }, [isMobile, renderPage]);

  // Initial render + re-render on page change (idle, no animation)
  useEffect(() => {
    if (loadState !== "loaded" || isAnimating) return;
    renderSpread(currentPage).then(() => setTimeout(drawWatermark, 60));
  }, [currentPage, loadState, isAnimating, renderSpread, drawWatermark]);

  // ── Navigation with flip animation ───────────────────────────────────────
  const step = isMobile ? 1 : 2;
  const maxPage = numPages > 0 ? numPages : 1;
  const canGoBack = currentPage > 1;
  const canGoForward = isMobile ? currentPage < maxPage : currentPage + 1 < maxPage;

  const doFlip = useCallback(async (dir: "forward" | "backward") => {
    if (isAnimating || !pdfRef.current) return;
    if (dir === "forward" && !canGoForward) return;
    if (dir === "backward" && !canGoBack) return;

    const nextPage = dir === "forward"
      ? Math.min(currentPage + step, maxPage)
      : Math.max(currentPage - step, 1);

    playPageSound();

    if (!isMobile) {
      // Pre-render into flip canvases before animating
      // flipFront = old right (current right), already rendered in rightRef
      // Copy rightRef into flipFrontRef
      const flipF = flipFrontRef.current;
      const src = dir === "forward" ? rightRef.current : leftRef.current;
      if (flipF && src) {
        flipF.width = src.width; flipF.height = src.height;
        flipF.getContext("2d")?.drawImage(src, 0, 0);
      }
      // Pre-render new pages
      await Promise.allSettled([
        renderPage(dir === "forward" ? nextPage : nextPage + 1, flipBackRef.current),
        renderPage(dir === "forward" ? nextPage + 1 : nextPage - 1, newRightRef.current),
      ]);
    }

    setFlipDir(dir);

    setTimeout(() => {
      setCurrentPage(nextPage);
      setFlipDir("none");
    }, FLIP_MS);
  }, [isAnimating, canGoForward, canGoBack, currentPage, step, maxPage, isMobile, renderPage]);

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

  const handleJump = (ev: React.FormEvent) => {
    ev.preventDefault();
    const n = parseInt(jumpInput, 10);
    if (!isNaN(n) && n >= 1 && n <= numPages) {
      const snapped = isMobile ? n : (n % 2 === 0 ? n - 1 : n);
      setCurrentPage(Math.max(1, Math.min(snapped, maxPage)));
    }
    setJumpInput("");
  };

  const spreadLabel = (() => {
    if (!numPages) return "";
    if (isMobile) return `Page ${currentPage} of ${numPages}`;
    return `Pages ${currentPage}–${Math.min(currentPage + 1, numPages)} of ${numPages}`;
  })();

  if (!activationCode) return null;

  // ── Flip animation CSS class ──────────────────────────────────────────────
  const flipClass = flipDir === "forward"
    ? "animate-flip-forward"
    : flipDir === "backward"
    ? "animate-flip-backward"
    : "";

  return (
    <>
      <style>{`
        @media print { body { display: none !important; } }

        @keyframes flipForward {
          0%   { transform: perspective(1800px) rotateY(0deg); }
          40%  { transform: perspective(1800px) rotateY(-50deg); box-shadow: -8px 0 18px rgba(0,0,0,0.22); }
          100% { transform: perspective(1800px) rotateY(-180deg); }
        }
        @keyframes flipBackward {
          0%   { transform: perspective(1800px) rotateY(-180deg); }
          60%  { transform: perspective(1800px) rotateY(-130deg); box-shadow: -8px 0 18px rgba(0,0,0,0.22); }
          100% { transform: perspective(1800px) rotateY(0deg); }
        }
        .animate-flip-forward {
          animation: flipForward ${FLIP_MS}ms cubic-bezier(0.4,0,0.2,1) forwards;
        }
        .animate-flip-backward {
          animation: flipBackward ${FLIP_MS}ms cubic-bezier(0.4,0,0.2,1) forwards;
        }
        .flip-front { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .flip-back  {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: rotateY(180deg);
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
            <div className="flex-1" />
            {loadState === "loaded" && (
              <form onSubmit={handleJump} className="flex items-center gap-1">
                <input
                  value={jumpInput}
                  onChange={e => setJumpInput(e.target.value)}
                  placeholder="Go to…"
                  className="w-16 text-xs text-center border border-border rounded px-1.5 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-orange-500"
                  type="number" min={1} max={numPages}
                />
              </form>
            )}
          </div>
        </header>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center px-2 py-6 gap-5 bg-stone-100 dark:bg-stone-900">

          {loadState === "loading" && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground py-24">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-sm font-semibold">Loading manual…</p>
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
              <code className="block bg-muted rounded px-3 py-2 text-xs font-mono">public/pdfs/manual.pdf</code>
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

                {/* Book body */}
                <div
                  className="relative rounded-sm overflow-hidden"
                  style={{
                    aspectRatio: isMobile ? "1/1.414" : "2/1.414",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)",
                    background: "#faf8f5",
                  }}
                >
                  {/* Pages row */}
                  <div className="absolute inset-0 flex" style={{ perspective: "2000px" }}>

                    {/* Left page */}
                    <div
                      className="book-page relative bg-white overflow-hidden"
                      style={{ width: isMobile ? "100%" : "50%", borderRight: isMobile ? "none" : "1px solid #e2ddd8" }}
                    >
                      {/* leftRef always rendered; newRightRef sits on top during backward flip */}
                      <canvas ref={leftRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                      {/* During backward flip, newRightRef (pre-rendered new-left) overlays the left panel */}
                      <canvas
                        ref={newRightRef}
                        style={{
                          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
                          opacity: (isAnimating && flipDir === "backward") ? 1 : 0,
                          pointerEvents: "none",
                        }}
                      />
                    </div>

                    {/* Right page — only on desktop */}
                    {!isMobile && (
                      <div
                        className="book-page relative bg-white overflow-hidden"
                        style={{ width: "50%", position: "relative" }}
                      >
                        {/* rightRef: the current (or soon-to-be-old) right page — base layer */}
                        <canvas ref={rightRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />

                        {/* Animated flip element — always in DOM, visibility via opacity */}
                        <div
                          className={isAnimating ? flipClass : ""}
                          style={{
                            position: "absolute", inset: 0,
                            transformOrigin: "left center",
                            transformStyle: "preserve-3d",
                            zIndex: isAnimating ? 10 : -1,
                            opacity: isAnimating ? 1 : 0,
                          }}
                        >
                          {/* Front face: old right page */}
                          <div
                            className="flip-front"
                            style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", background: "#fff", overflow: "hidden" }}
                          >
                            <canvas ref={flipFrontRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
                          </div>
                          {/* Back face: new left page */}
                          <div
                            className="flip-back"
                            style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#fff", overflow: "hidden" }}
                          >
                            <canvas ref={flipBackRef} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
                          </div>
                        </div>
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

                  {/* Top/bottom page-edge lines for 3D book feel */}
                  <div className="absolute inset-x-0 top-0 h-px bg-stone-300/60 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-px bg-stone-400/40 pointer-events-none" />

                  {/* Watermark */}
                  <canvas ref={wmRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden style={{ zIndex: 20 }} />

                  {/* Loading spinner */}
                  {isAnimating && (
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 25 }}>
                      {/* subtle page-curl shadow during flip */}
                    </div>
                  )}
                </div>

                {/* Swipe hint — shown briefly */}
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
