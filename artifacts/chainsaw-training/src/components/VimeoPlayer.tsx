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
  const [watermarkPos, setWatermarkPos] = useState({ top: "50%", left: "50%" });
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
          // Request available text tracks so we can enable them
          sendCommand("getTextTracks");
        }
        // Auto-enable first available subtitle/caption track
        if (data.method === "getTextTracks" && Array.isArray(data.value) && data.value.length > 0) {
          const track = data.value[0];
          sendCommand("enableTextTrack", track.language);
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

  // Watermark movement
  useEffect(() => {
    const move = () => setWatermarkPos({
      top: `${Math.floor(Math.random() * 80) + 10}%`,
      left: `${Math.floor(Math.random() * 80) + 10}%`,
    });
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

      {/* Tap-to-play/pause overlay — leaves bottom 56px for Vimeo's own controls */}
      <div
        className="absolute inset-x-0 top-0 z-40 cursor-pointer"
        style={{ bottom: 56 }}
        onClick={handleTap}
      />

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

      {/* Dynamic watermark */}
      {iframeLoaded && (
        <div
          className="pointer-events-none absolute text-white/15 font-mono text-sm uppercase tracking-wider font-bold mix-blend-overlay z-40 whitespace-nowrap transition-all duration-1000 ease-in-out"
          style={{ top: watermarkPos.top, left: watermarkPos.left, transform: "translate(-50%, -50%)" }}
        >
          {fullName} - {email}
        </div>
      )}
    </div>
  );
}
