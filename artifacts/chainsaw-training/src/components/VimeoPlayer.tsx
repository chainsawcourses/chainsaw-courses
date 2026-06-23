import { useEffect, useRef, useState, useCallback } from "react";
import { Maximize2, Minimize2, Play, Pause } from "lucide-react";
import { useUserSession } from "../contexts/UserContext";

interface VimeoPlayerProps {
  vimeoId: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

function buildEmbedUrl(vimeoId: string): string {
  const slash = vimeoId.indexOf("/");
  const id = slash === -1 ? vimeoId : vimeoId.slice(0, slash);
  const hash = slash === -1 ? "" : vimeoId.slice(slash + 1);
  const params = new URLSearchParams({
    title: "0",
    byline: "0",
    portrait: "0",
    transparent: "0",
    share: "0",
    controls: "0",
    api: "1",
    playsinline: "1",
  });
  if (hash) params.set("h", hash);
  return `https://player.vimeo.com/video/${id}?${params}`;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VimeoPlayer({ vimeoId, onTimeUpdate, onEnded }: VimeoPlayerProps) {
  const { fullName, email } = useUserSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const durationRef = useRef(0);

  const [watermarkPos, setWatermarkPos] = useState({ top: "30%", left: "50%" });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [tapFlash, setTapFlash] = useState<"play" | "pause" | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const sendCommand = useCallback((method: string, value?: unknown) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify(value !== undefined ? { method, value } : { method }),
      "https://player.vimeo.com"
    );
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!String(e.origin).includes("vimeo.com")) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.event === "ready") {
          sendCommand("addEventListener", "pause");
          sendCommand("addEventListener", "play");
          sendCommand("addEventListener", "timeupdate");
          sendCommand("addEventListener", "finish");
          sendCommand("getDuration");
          sendCommand("getTextTracks");
        }
        if (data.method === "getDuration" && typeof data.value === "number") {
          durationRef.current = data.value;
          setDuration(data.value);
        }
        if (data.method === "getTextTracks" && Array.isArray(data.value) && data.value.length > 0) {
          sendCommand("enableTextTrack", data.value[0].language);
        }
        if (data.event === "pause") setIsPaused(true);
        if (data.event === "play") setIsPaused(false);
        if (data.event === "timeupdate") {
          const t = data.data?.seconds ?? 0;
          if (!isDraggingRef.current) setCurrentTime(t);
          onTimeUpdate?.(t);
        }
        if (data.event === "finish") { setIsPaused(true); onEnded?.(); }
      } catch { /* ignore */ }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendCommand, onTimeUpdate, onEnded]);

  useEffect(() => {
    const move = () => {
      const zones = [
        { top: `${10 + Math.random() * 20}%`, left: `${10 + Math.random() * 80}%` },
        { top: `${70 + Math.random() * 20}%`, left: `${10 + Math.random() * 80}%` },
      ];
      setWatermarkPos(zones[Math.floor(Math.random() * zones.length)]);
    };
    move();
    const id = setInterval(move, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleTap = useCallback(() => {
    if (isPaused) {
      sendCommand("play");
      setTapFlash("play");
    } else {
      sendCommand("pause");
      setTapFlash("pause");
    }
    setTimeout(() => setTapFlash(null), 600);
  }, [isPaused, sendCommand]);

  // Compute seek position from a clientX value
  const clientXToTime = useCallback((clientX: number) => {
    if (!seekBarRef.current || durationRef.current <= 0) return null;
    const rect = seekBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pct * durationRef.current;
  }, []);

  const applySeek = useCallback((clientX: number) => {
    const t = clientXToTime(clientX);
    if (t === null) return;
    setCurrentTime(t);
    sendCommand("setCurrentTime", t);
  }, [clientXToTime, sendCommand]);

  // Mouse seek handlers
  const onSeekMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    applySeek(e.clientX);
  }, [applySeek]);

  const onSeekMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    applySeek(e.clientX);
  }, [applySeek]);

  const onSeekMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    applySeek(e.clientX);
  }, [applySeek]);

  // Touch seek handlers
  const onSeekTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    applySeek(e.touches[0].clientX);
  }, [applySeek]);

  const onSeekTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDraggingRef.current) return;
    applySeek(e.touches[0].clientX);
  }, [applySeek]);

  const onSeekTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    if (e.changedTouches.length > 0) applySeek(e.changedTouches[0].clientX);
  }, [applySeek]);

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const src = buildEmbedUrl(vimeoId);

  return (
    <div ref={containerRef}>
      {/* Video */}
      <div className="vimeo-portrait-container relative w-full aspect-video bg-black rounded-t-lg overflow-hidden border-x border-t border-border shadow-2xl">
        <iframe
          ref={iframeRef}
          key={vimeoId}
          src={src}
          className="vimeo-iframe"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          title="Training Video"
          onLoad={() => setIframeLoaded(true)}
        />

        {/* Tap overlay — full frame */}
        <div className="absolute inset-0 z-40 cursor-pointer" onClick={handleTap} />

        {/* Centre play button */}
        <div className="absolute inset-0 z-[45] flex items-center justify-center pointer-events-none">
          <div style={{
            transition: "opacity 0.3s ease, transform 0.3s ease",
            opacity: isPaused ? 1 : 0,
            transform: isPaused ? "scale(1)" : "scale(0.8)",
          }}>
            <div className="bg-black/55 backdrop-blur-sm rounded-full p-5 border-2 border-white/30 shadow-2xl">
              <Play className="w-14 h-14 text-white fill-white" style={{ marginLeft: 4 }} />
            </div>
          </div>
        </div>

        {/* Tap flash */}
        {tapFlash && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-black/40 rounded-full p-5 animate-ping-once">
              {tapFlash === "play"
                ? <Play className="w-10 h-10 text-white fill-white" />
                : <Pause className="w-10 h-10 text-white fill-white" />}
            </div>
          </div>
        )}

        {/* Watermark */}
        {iframeLoaded && (
          <div
            className="pointer-events-none absolute z-40 whitespace-nowrap transition-all duration-1000 ease-in-out"
            style={{
              top: watermarkPos.top,
              left: watermarkPos.left,
              transform: "translate(-50%, -50%)",
              fontFamily: "monospace",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
              textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.7)",
            }}
          >
            {fullName} · {email}
          </div>
        )}
      </div>

      {/* Controls bar — plain HTML, always fully visible */}
      <div className="flex items-center gap-3 px-3 py-2 bg-black/85 backdrop-blur-sm rounded-b-lg border-x border-b border-border">
        {/* Play / Pause */}
        <button
          onClick={handleTap}
          className="shrink-0 text-white hover:text-orange-400 transition-colors"
          aria-label={isPaused ? "Play" : "Pause"}
        >
          {isPaused
            ? <Play className="w-5 h-5 fill-white" />
            : <Pause className="w-5 h-5 fill-white" />}
        </button>

        {/* Seek bar */}
        <div
          ref={seekBarRef}
          className="relative flex-1 h-3 bg-white/20 rounded-full cursor-pointer select-none"
          onMouseDown={onSeekMouseDown}
          onMouseMove={onSeekMouseMove}
          onMouseUp={onSeekMouseUp}
          onMouseLeave={(e) => { if (isDraggingRef.current) onSeekMouseUp(e); }}
          onTouchStart={onSeekTouchStart}
          onTouchMove={onSeekTouchMove}
          onTouchEnd={onSeekTouchEnd}
        >
          {/* Filled */}
          <div
            className="absolute left-0 top-0 h-full bg-orange-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md"
            style={{ left: `calc(${pct}% - 8px)` }}
          />
        </div>

        {/* Time */}
        <span className="shrink-0 text-white/70 text-xs font-mono tabular-nums">
          {formatTime(currentTime)}&thinsp;/&thinsp;{formatTime(duration)}
        </span>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="shrink-0 text-white/70 hover:text-white transition-colors"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
