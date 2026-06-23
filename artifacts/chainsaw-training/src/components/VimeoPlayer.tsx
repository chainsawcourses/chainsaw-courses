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
    api: "1",
    playsinline: "1",
  });
  if (hash) params.set("h", hash);
  return `https://player.vimeo.com/video/${id}?${params}`;
}

export function VimeoPlayer({ vimeoId, onTimeUpdate, onEnded }: VimeoPlayerProps) {
  const { fullName, email } = useUserSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [watermarkPos, setWatermarkPos] = useState({ top: "30%", left: "50%" });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [tapFlash, setTapFlash] = useState<"play" | "pause" | null>(null);

  // Vimeo postMessage helper
  const sendCommand = useCallback((method: string, value?: unknown) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify(value !== undefined ? { method, value } : { method }),
      "https://player.vimeo.com"
    );
  }, []);

  // Listen for Vimeo events via postMessage
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
          sendCommand("getTextTracks");
        }
        if (data.method === "getTextTracks" && Array.isArray(data.value) && data.value.length > 0) {
          sendCommand("enableTextTrack", data.value[0].language);
        }
        if (data.event === "pause") setIsPaused(true);
        if (data.event === "play") setIsPaused(false);
        if (data.event === "timeupdate") onTimeUpdate?.(data.data?.seconds ?? 0);
        if (data.event === "finish") { setIsPaused(true); onEnded?.(); }
      } catch {
        // ignore
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendCommand, onTimeUpdate, onEnded]);

  // Watermark movement — avoid centre so it doesn't clash with play button
  useEffect(() => {
    const move = () => {
      const zones = [
        { top: `${10 + Math.random() * 20}%`, left: `${10 + Math.random() * 80}%` },
        { top: `${70 + Math.random() * 20}%`, left: `${10 + Math.random() * 80}%` },
      ];
      const zone = zones[Math.floor(Math.random() * zones.length)];
      setWatermarkPos(zone);
    };
    move();
    const id = setInterval(move, 60000);
    return () => clearInterval(id);
  }, []);

  // Fullscreen change tracking
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

  const src = buildEmbedUrl(vimeoId);

  return (
    <div
      ref={containerRef}
      className="vimeo-portrait-container relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border shadow-2xl"
    >
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

      {/* Tap overlay — covers everything above the Vimeo controls bar */}
      <div
        className="absolute inset-x-0 top-0 z-40 cursor-pointer"
        style={{ bottom: 56 }}
        onClick={handleTap}
      />

      {/* Big centre play button — visible when paused, fades when playing, click handled by tap overlay */}
      <div
        className="absolute inset-x-0 top-0 z-[45] flex items-center justify-center pointer-events-none"
        style={{ bottom: 56 }}
      >
        <div
          style={{
            transition: "opacity 0.35s ease, transform 0.35s ease",
            opacity: isPaused ? 1 : 0,
            transform: isPaused ? "scale(1)" : "scale(0.8)",
          }}
        >
          <div className="bg-black/55 backdrop-blur-sm rounded-full p-5 border-2 border-white/30 shadow-2xl">
            <Play className="w-14 h-14 text-white fill-white" style={{ marginLeft: 4 }} />
          </div>
        </div>
      </div>

      {/* Tap flash animation */}
      {tapFlash && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-5 animate-ping-once">
            {tapFlash === "play"
              ? <Play className="w-10 h-10 text-white fill-white" />
              : <Pause className="w-10 h-10 text-white fill-white" />}
          </div>
        </div>
      )}

      {/* Fullscreen button */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-3 right-3 z-50 bg-black/50 hover:bg-black/80 text-white rounded p-2 transition-colors duration-150 backdrop-blur-sm"
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
      </button>

      {/* Dynamic watermark — repositions every 60s, avoids centre */}
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
  );
}
