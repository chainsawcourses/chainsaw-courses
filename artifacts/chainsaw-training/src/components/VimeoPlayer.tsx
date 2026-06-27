import { useEffect, useRef, useState, useCallback } from "react";
import { Maximize2, Minimize2, Play } from "lucide-react";
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
  const isReadyRef = useRef(false);

  const [watermarkPos, setWatermarkPos] = useState({ top: "15%", left: "50%" });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const src = buildEmbedUrl(vimeoId);

  const sendCommand = useCallback((method: string, value?: unknown) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify(value !== undefined ? { method, value } : { method }),
      "https://player.vimeo.com"
    );
  }, []);

  // Reset error + ready state when video changes
  useEffect(() => {
    setLoadError(null);
    setIsPaused(true);
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

  // Vimeo postMessage event listener
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
        }
        if (data.event === "error") {
          const code = data.data?.code ?? data.code;
          if (code === 5) {
            setLoadError(
              "This video is private or domain-restricted. In Vimeo, go to Settings → Privacy → set 'Where can this be embedded?' to Anywhere."
            );
          } else {
            setLoadError(
              `Video unavailable (Vimeo error ${code ?? "unknown"}). Check the video exists and is not password-protected.`
            );
          }
        }
        if (data.event === "pause") setIsPaused(true);
        if (data.event === "play") setIsPaused(false);
        if (data.event === "finish") { setIsPaused(true); onEnded?.(); }
        if (data.method === "getCurrentTime" && typeof data.value === "number") {
          onTimeUpdate?.(data.value);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendCommand, onTimeUpdate, onEnded]);

  // Poll getCurrentTime every 30s for the heartbeat
  useEffect(() => {
    const id = setInterval(() => {
      if (isReadyRef.current) sendCommand("getCurrentTime");
    }, 30000);
    return () => clearInterval(id);
  }, [sendCommand]);

  // Roaming watermark — moves every 60s
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
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Training Video"
          onLoad={() => setIframeLoaded(true)}
        />

        {/* Centre play indicator — pointer-events-none so it never blocks Vimeo's touch targets */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div style={{
            transition: "opacity 0.35s ease, transform 0.35s ease",
            opacity: isPaused ? 1 : 0,
            transform: isPaused ? "scale(1)" : "scale(0.75)",
          }}>
            <div className="bg-black/50 backdrop-blur-sm rounded-full p-5 border-2 border-white/30 shadow-2xl">
              <Play className="w-14 h-14 text-white fill-white" style={{ marginLeft: 4 }} />
            </div>
          </div>
        </div>

        {/* Roaming watermark */}
        {iframeLoaded && !loadError && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap transition-all duration-1000 ease-in-out select-none"
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
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center gap-3">
            <div className="text-destructive font-mono font-bold text-sm uppercase tracking-widest">
              ⚠ VIDEO UNAVAILABLE
            </div>
            <p className="text-white/80 text-xs font-mono leading-relaxed max-w-sm">{loadError}</p>
            <button
              onClick={() => {
                setLoadError(null);
                isReadyRef.current = false;
                if (iframeRef.current) iframeRef.current.src = src;
              }}
              className="mt-2 text-xs font-mono text-primary underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar — fullscreen button only */}
      <div className="flex items-center justify-end px-3 py-2 bg-black/85 backdrop-blur-sm rounded-b-lg border-x border-b border-border">
        <button
          onClick={toggleFullscreen}
          className="text-white/70 hover:text-white transition-colors"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
