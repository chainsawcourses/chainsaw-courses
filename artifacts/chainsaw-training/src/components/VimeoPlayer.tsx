import { useEffect, useRef, useState, useCallback } from "react";
import { Maximize2, Minimize2, Play, Pause } from "lucide-react";
import { useUserSession } from "../contexts/UserContext";

interface VimeoPlayerProps {
  vimeoId: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

function buildEmbedUrl(vimeoId: string, nativeControls: boolean): string {
  const slash = vimeoId.indexOf("/");
  const id = slash === -1 ? vimeoId : vimeoId.slice(0, slash);
  const hash = slash === -1 ? "" : vimeoId.slice(slash + 1);
  const params = new URLSearchParams({
    title: "0",
    byline: "0",
    portrait: "0",
    transparent: "0",
    share: "0",
    controls: nativeControls ? "1" : "0",
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
  const isReadyRef = useRef(false);

  const [watermarkPos, setWatermarkPos] = useState({ top: "15%", left: "50%" });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const isPausedRef = useRef(true);           // ref copy avoids stale closures in handleTap
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // iOS Safari cannot start video playback via postMessage from an overlay div —
  // it requires a direct user gesture on the media element itself.
  // Every other platform (Android Chrome, all desktop browsers) handles it fine.
  // We detect iOS once at mount; the result never changes during the component lifetime.
  const isIOS = useRef(
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
  );

  // iOS → controls=1 so Vimeo's own play button is touchable; overlay is transparent
  // All others → controls=0 (Vimeo bar hidden); our overlay handles play/pause
  const src = buildEmbedUrl(vimeoId, isIOS.current);

  const sendCommand = useCallback((method: string, value?: unknown) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify(value !== undefined ? { method, value } : { method }),
      "https://player.vimeo.com"
    );
  }, []);

  // Reset state when video changes
  useEffect(() => {
    setLoadError(null);
    setIsPaused(true);
    setCurrentTime(0);
    setDuration(0);
    durationRef.current = 0;
    isReadyRef.current = false;
    const t = setTimeout(() => {
      if (!isReadyRef.current) {
        setLoadError(
          "Video failed to load. In Vimeo, open the video → Settings → Privacy → set 'Where can this be embedded?' to Anywhere."
        );
      }
    }, 14000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vimeoId]);

  // Vimeo postMessage listener
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!String(e.origin).includes("vimeo.com")) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.event === "ready") {
          isReadyRef.current = true;
          setLoadError(null);
          sendCommand("addEventListener", "pause");
          sendCommand("addEventListener", "play");
          sendCommand("addEventListener", "finish");
          sendCommand("addEventListener", "error");
          sendCommand("getDuration");
        }
        if (data.event === "error") {
          const code = data.data?.code ?? data.code;
          setLoadError(
            code === 5
              ? "This video is private or domain-restricted. In Vimeo, go to Settings → Privacy → set 'Where can this be embedded?' to Anywhere."
              : `Video unavailable (Vimeo error ${code ?? "unknown"}). Check the video exists and is not password-protected.`
          );
        }
        if (data.method === "getDuration" && typeof data.value === "number") {
          durationRef.current = data.value;
          setDuration(data.value);
        }
        if (data.method === "getPaused" && typeof data.value === "boolean") {
          sendCommand(data.value ? "play" : "pause");
        }
        if (data.method === "getCurrentTime" && typeof data.value === "number") {
          if (!isDraggingRef.current) {
            setCurrentTime(data.value);
            onTimeUpdate?.(data.value);
          }
        }
        if (data.event === "pause")  { isPausedRef.current = true;  setIsPaused(true); }
        if (data.event === "play")   { isPausedRef.current = false; setIsPaused(false); }
        if (data.event === "finish") {
          isPausedRef.current = true;
          setIsPaused(true);
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          onEnded?.();
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendCommand, onTimeUpdate, onEnded]);

  // Poll current time every 250 ms for the seek bar display
  useEffect(() => {
    const id = setInterval(() => {
      if (isReadyRef.current && !isDraggingRef.current) sendCommand("getCurrentTime");
    }, 250);
    return () => clearInterval(id);
  }, [sendCommand]);

  // Roaming watermark
  useEffect(() => {
    const move = () => {
      const zones = [
        { top: `${10 + Math.random() * 15}%`, left: `${10 + Math.random() * 80}%` },
        { top: `${70 + Math.random() * 20}%`, left: `${10 + Math.random() * 80}%` },
      ];
      setWatermarkPos(zones[Math.floor(Math.random() * zones.length)]);
    };
    move();
    const id = setInterval(move, 60000);
    return () => clearInterval(id);
  }, []);

  // Fullscreen
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    document.fullscreenElement
      ? document.exitFullscreen().catch(() => {})
      : containerRef.current.requestFullscreen().catch(() => {});
  }, []);

  // Tap overlay handler (desktop only — see isHoverDevice).
  // Asks Vimeo for the actual pause state rather than trusting our tracked
  // state — avoids any race between event arrival and tap timing.
  const handleTap = useCallback(() => {
    if (!isReadyRef.current) return;
    sendCommand("getPaused");
  }, [sendCommand]);

  // Seek helpers
  const clientXToTime = useCallback((clientX: number) => {
    if (!seekBarRef.current || durationRef.current <= 0) return null;
    const rect = seekBarRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * durationRef.current;
  }, []);

  const applySeek = useCallback((clientX: number) => {
    const t = clientXToTime(clientX);
    if (t === null) return;
    setCurrentTime(t);
    sendCommand("setCurrentTime", t);
  }, [clientXToTime, sendCommand]);

  const onSeekMouseDown  = useCallback((e: React.MouseEvent<HTMLDivElement>)  => { isDraggingRef.current = true;  applySeek(e.clientX); }, [applySeek]);
  const onSeekMouseMove  = useCallback((e: React.MouseEvent<HTMLDivElement>)  => { if (isDraggingRef.current) applySeek(e.clientX); }, [applySeek]);
  const onSeekMouseUp    = useCallback((e: React.MouseEvent<HTMLDivElement>)  => { if (!isDraggingRef.current) return; isDraggingRef.current = false; applySeek(e.clientX); }, [applySeek]);
  const onSeekTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>)  => { isDraggingRef.current = true;  applySeek(e.touches[0].clientX); }, [applySeek]);
  const onSeekTouchMove  = useCallback((e: React.TouchEvent<HTMLDivElement>)  => { e.preventDefault(); if (isDraggingRef.current) applySeek(e.touches[0].clientX); }, [applySeek]);
  const onSeekTouchEnd   = useCallback((e: React.TouchEvent<HTMLDivElement>)  => { isDraggingRef.current = false; if (e.changedTouches.length) applySeek(e.changedTouches[0].clientX); }, [applySeek]);

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div ref={containerRef}>
      {/* ── Video frame ── */}
      <div className="vimeo-portrait-container relative w-full aspect-video bg-black rounded-t-lg overflow-hidden border-x border-t border-border shadow-2xl">
        <iframe
          ref={iframeRef}
          key={vimeoId}
          src={src}
          className="vimeo-iframe"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Training Video"
          onLoad={() => setIframeLoaded(true)}
        />

        {/* Tap overlay — active on all non-iOS platforms (desktop + Android).
            On iOS the overlay is transparent so fingers reach Vimeo's native
            play button, which satisfies iOS Safari's gesture requirement.   */}
        <div
          className="absolute inset-0 z-40 cursor-pointer"
          style={{ pointerEvents: isIOS.current ? "none" : "auto" }}
          onClick={handleTap}
        />

        {/* Centre play indicator */}
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

        {/* Roaming watermark */}
        {iframeLoaded && !loadError && (
          <div
            className="pointer-events-none absolute z-[46] whitespace-nowrap transition-all duration-1000 ease-in-out select-none"
            style={{
              top: watermarkPos.top,
              left: watermarkPos.left,
              transform: "translate(-50%, -50%)",
              fontFamily: "monospace",
              fontSize: "clamp(0.6rem, 1.5vw, 0.75rem)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.65)",
              textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.7)",
            }}
          >
            {fullName} · {email}
          </div>
        )}

        {/* Error overlay */}
        {loadError && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center gap-3">
            <div className="text-destructive font-mono font-bold text-sm uppercase tracking-widest">⚠ VIDEO UNAVAILABLE</div>
            <p className="text-white/80 text-xs font-mono leading-relaxed max-w-sm">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); isReadyRef.current = false; if (iframeRef.current) iframeRef.current.src = src; }}
              className="mt-2 text-xs font-mono text-primary underline underline-offset-2"
            >Retry</button>
          </div>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div className="flex items-center gap-3 px-3 py-2 bg-black/85 backdrop-blur-sm rounded-b-lg border-x border-b border-border">
        {/* Play / Pause */}
        <button
          onClick={handleTap}
          className="shrink-0 text-white hover:text-orange-400 transition-colors"
          aria-label={isPaused ? "Play" : "Pause"}
        >
          {isPaused
            ? <Play  className="w-5 h-5 fill-white" />
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
          <div className="absolute left-0 top-0 h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md" style={{ left: `calc(${pct}% - 8px)` }} />
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
