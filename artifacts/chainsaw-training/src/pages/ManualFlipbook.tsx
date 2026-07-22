import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, BookOpen, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserSession } from "../contexts/UserContext";
import * as pdfjsLib from "pdfjs-dist";

// Vite-served worker asset
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const MANUAL_URL = `${import.meta.env.BASE_URL}pdfs/manual.pdf`;
const RENDER_SCALE = 2.0;

const WM_POSITIONS: [number, number][] = [
  [0.50, 0.35], [0.28, 0.60], [0.72, 0.60], [0.50, 0.55],
  [0.35, 0.40], [0.65, 0.40], [0.50, 0.70], [0.40, 0.28],
];

type LoadState = "idle" | "loading" | "loaded" | "missing" | "error";

export default function ManualFlipbook() {
  const { activationCode, fullName, email } = useUserSession();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!activationCode) navigate("/");
  }, [activationCode, navigate]);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRendering, setIsRendering] = useState(false);
  const [visible, setVisible] = useState(true);
  const [jumpInput, setJumpInput] = useState("");

  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const wmCanvasRef = useRef<HTMLCanvasElement>(null);
  const leftTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const rightTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const wmPosRef = useRef(0);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Load PDF ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadState("loading");
    const task = pdfjsLib.getDocument({ url: MANUAL_URL, withCredentials: false });
    task.promise
      .then((doc) => {
        pdfRef.current = doc;
        setNumPages(doc.numPages);
        setLoadState("loaded");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || msg.includes("Missing PDF") || msg.includes("Unexpected server response")) {
          setLoadState("missing");
        } else {
          setLoadState("error");
        }
      });
    return () => { task.destroy?.(); };
  }, []);

  // ── Draw watermark on overlay canvas ────────────────────────────────────────
  const drawWatermark = useCallback(() => {
    const wm = wmCanvasRef.current;
    if (!wm) return;
    const rect = wm.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    wm.width = Math.round(rect.width * dpr);
    wm.height = Math.round(rect.height * dpr);
    const ctx = wm.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const [fx, fy] = WM_POSITIONS[wmPosRef.current % WM_POSITIONS.length];
    const cx = rect.width * fx;
    const cy = rect.height * fy;
    const fontSize = Math.max(11, Math.floor(rect.width * 0.022));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 9);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.font = `bold ${fontSize}px ui-monospace, monospace`;
    ctx.fillText(fullName ?? "Student", 0, 0);
    ctx.font = `${Math.max(9, fontSize - 2)}px ui-monospace, monospace`;
    ctx.fillText(email ?? "", 0, fontSize * 1.4);
    ctx.restore();
  }, [fullName, email]);

  // Reposition every 30 s
  useEffect(() => {
    const t = setInterval(() => {
      wmPosRef.current = (wmPosRef.current + 1) % WM_POSITIONS.length;
      drawWatermark();
    }, 30_000);
    return () => clearInterval(t);
  }, [drawWatermark]);

  // Redraw on resize
  useEffect(() => {
    window.addEventListener("resize", drawWatermark);
    return () => window.removeEventListener("resize", drawWatermark);
  }, [drawWatermark]);

  // ── Render a single PDF page onto a canvas element ─────────────────────────
  const renderPageToCanvas = useCallback(
    async (
      pageNum: number,
      canvasEl: HTMLCanvasElement | null,
      taskRef: React.MutableRefObject<pdfjsLib.RenderTask | null>,
    ) => {
      if (!canvasEl) return;
      const pdf = pdfRef.current;
      if (!pdf || pageNum < 1 || pageNum > pdf.numPages) {
        const ctx = canvasEl.getContext("2d");
        if (ctx) {
          canvasEl.width = 595;
          canvasEl.height = 842;
          ctx.fillStyle = "#f8f8f8";
          ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
        }
        return;
      }
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) return;
      taskRef.current?.cancel();
      const task = page.render({ canvas: canvasEl, canvasContext: ctx, viewport });
      taskRef.current = task;
      await task.promise;
    },
    [],
  );

  // ── Render the current spread ───────────────────────────────────────────────
  const renderSpread = useCallback(
    async (startPage: number) => {
      if (loadState !== "loaded") return;
      setIsRendering(true);
      leftTaskRef.current?.cancel();
      rightTaskRef.current?.cancel();
      try {
        if (isMobile) {
          await renderPageToCanvas(startPage, leftCanvasRef.current, leftTaskRef);
        } else {
          await Promise.all([
            renderPageToCanvas(startPage, leftCanvasRef.current, leftTaskRef),
            renderPageToCanvas(startPage + 1, rightCanvasRef.current, rightTaskRef),
          ]);
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "RenderingCancelledException") {
          console.warn("Render error", err);
        }
      }
      setIsRendering(false);
    },
    [loadState, isMobile, renderPageToCanvas],
  );

  // ── Triggered whenever currentPage changes ─────────────────────────────────
  useEffect(() => {
    if (loadState !== "loaded") return;
    let cancelled = false;
    setVisible(false);
    const timer = setTimeout(async () => {
      if (cancelled) return;
      await renderSpread(currentPage);
      if (!cancelled) {
        setVisible(true);
        // Draw watermark after a tick so canvas layout is settled
        setTimeout(drawWatermark, 50);
      }
    }, 180); // brief pause for fade-out to complete
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentPage, loadState, renderSpread, drawWatermark]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const step = isMobile ? 1 : 2;
  const maxPage = numPages > 0 ? numPages : 1;

  const canGoBack = currentPage > 1;
  const canGoForward = currentPage + step - 1 < maxPage;

  const goBack = () => {
    if (!canGoBack) return;
    setCurrentPage((p) => Math.max(1, p - step));
  };

  const goForward = () => {
    if (!canGoForward) return;
    setCurrentPage((p) => Math.min(maxPage - (isMobile ? 0 : 1), p + step));
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(jumpInput, 10);
    if (!isNaN(n) && n >= 1 && n <= numPages) {
      // Snap to spread start
      const snapped = isMobile ? n : (n % 2 === 0 ? n - 1 : n);
      setCurrentPage(Math.max(1, Math.min(snapped, maxPage)));
    }
    setJumpInput("");
  };

  const onContextMenu = (e: React.MouseEvent) => e.preventDefault();

  // ── Spread label ───────────────────────────────────────────────────────────
  const spreadLabel = (() => {
    if (!numPages) return "";
    if (isMobile) return `Page ${currentPage} of ${numPages}`;
    const right = Math.min(currentPage + 1, numPages);
    return `Pages ${currentPage}–${right} of ${numPages}`;
  })();

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!activationCode) return null;

  return (
    <>
      {/* Print-protection: hide everything when printing */}
      <style>{`@media print { body { display: none !important; } }`}</style>

      <div
        className="min-h-screen flex flex-col select-none"
        onContextMenu={onContextMenu}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
              <Link href="/training">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Link>
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen className="w-4 h-4 text-orange-500" />
              <span className="font-black tracking-tighter text-xs uppercase">Chainsaw Manual</span>
            </div>
            <div className="flex-1" />
            {/* page jump */}
            {loadState === "loaded" && (
              <form onSubmit={handleJump} className="flex items-center gap-1">
                <input
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  placeholder="Go to…"
                  className="w-16 text-xs text-center border border-border rounded px-1.5 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-orange-500"
                  type="number"
                  min={1}
                  max={numPages}
                />
              </form>
            )}
          </div>
        </header>

        {/* ── Main ───────────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-4">

          {/* Loading */}
          {loadState === "loading" && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground py-24">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-sm font-semibold">Loading manual…</p>
            </div>
          )}

          {/* Missing PDF */}
          {loadState === "missing" && (
            <div className="max-w-md text-center space-y-4 py-20">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-orange-500" />
                </div>
              </div>
              <h2 className="font-black tracking-tighter text-lg uppercase">Manual Not Uploaded</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                No manual PDF has been added yet. Place your PDF at:
              </p>
              <code className="block bg-muted rounded px-3 py-2 text-xs font-mono text-foreground">
                public/pdfs/manual.pdf
              </code>
              <p className="text-xs text-muted-foreground">
                Once uploaded, refresh this page.
              </p>
            </div>
          )}

          {/* Error */}
          {loadState === "error" && (
            <div className="max-w-md text-center space-y-3 py-20">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
              <p className="text-sm font-semibold">Failed to load the manual. Please try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs underline text-muted-foreground hover:text-foreground"
              >
                Reload
              </button>
            </div>
          )}

          {/* ── Book ─────────────────────────────────────────────────────────── */}
          {loadState === "loaded" && (
            <>
              <div className="flex items-center gap-3 w-full max-w-5xl">
                {/* Prev button */}
                <button
                  onClick={goBack}
                  disabled={!canGoBack || isRendering}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center border border-border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Book container */}
                <div
                  className="flex-1 relative rounded-sm shadow-2xl overflow-hidden border border-border/60 bg-white"
                  style={{
                    aspectRatio: isMobile ? "1 / 1.414" : "2 / 1.414",
                    transition: "opacity 0.18s ease",
                    opacity: visible ? 1 : 0,
                  }}
                  onContextMenu={onContextMenu}
                >
                  {/* Page canvases */}
                  <div className="absolute inset-0 flex">
                    <div className={`relative ${isMobile ? "w-full" : "w-1/2"} h-full border-r border-gray-200`}>
                      <canvas
                        ref={leftCanvasRef}
                        className="w-full h-full block"
                        style={{ imageRendering: "auto" }}
                      />
                    </div>
                    {!isMobile && (
                      <div className="relative w-1/2 h-full">
                        <canvas
                          ref={rightCanvasRef}
                          className="w-full h-full block"
                          style={{ imageRendering: "auto" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Spine shadow */}
                  {!isMobile && (
                    <div
                      className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-3 pointer-events-none"
                      style={{
                        background: "linear-gradient(to right, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.14) 45%, rgba(0,0,0,0.14) 55%, rgba(0,0,0,0.06) 100%)",
                      }}
                    />
                  )}

                  {/* Watermark overlay */}
                  <canvas
                    ref={wmCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    aria-hidden="true"
                  />

                  {/* Rendering spinner */}
                  {isRendering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    </div>
                  )}
                </div>

                {/* Next button */}
                <button
                  onClick={goForward}
                  disabled={!canGoForward || isRendering}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center border border-border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Page counter */}
              <p className="text-xs text-muted-foreground font-mono">{spreadLabel}</p>

              {/* Progress bar */}
              <div className="w-full max-w-5xl h-1 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-300"
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
