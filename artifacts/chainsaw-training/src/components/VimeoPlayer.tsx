import { useEffect, useRef, useState, useCallback } from "react";
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isReadyRef = useRef(false);

  const [watermarkPos, setWatermarkPos] = useState({ top: "15%", left: "50%" });
  const [iframeLoaded, setIframeLoaded] = useState(false);
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
        if (data.method === "getTextTracks" && Array.isArray(data.value) && data.value.length > 0) {
          sendCommand("enableTextTrack", data.value[0].language);
        }
        if (data.event === "finish") {
          onEnded?.();
        }
        if (data.method === "getCurrentTime" && typeof data.value === "number") {
          onTimeUpdate?.(data.value);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendCommand, onTimeUpdate, onEnded]);

  // Poll getCurrentTime every 30s for the heartbeat (matches the heartbeat interval)
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

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border shadow-2xl">
      <iframe
        ref={iframeRef}
        key={vimeoId}
        src={src}
        className="absolute inset-0 w-full h-full"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title="Training Video"
        onLoad={() => setIframeLoaded(true)}
      />

      {/* Roaming watermark — pointer-events-none so it never blocks the video */}
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
  );
}
