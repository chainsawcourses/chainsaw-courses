import { useEffect, useRef, useState, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useUserSession } from "../contexts/UserContext";

interface VimeoPlayerProps {
  vimeoId: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

// vimeoId may be "1234567890" or "1234567890/abcdef1234" (id/hash)
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
  });
  if (hash) params.set("h", hash);
  return `https://player.vimeo.com/video/${id}?${params}`;
}

export function VimeoPlayer({ vimeoId, onTimeUpdate, onEnded }: VimeoPlayerProps) {
  const { fullName, email } = useUserSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const [watermarkPos, setWatermarkPos] = useState({ top: "50%", left: "50%" });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const move = () => setWatermarkPos({
      top: `${Math.floor(Math.random() * 80) + 10}%`,
      left: `${Math.floor(Math.random() * 80) + 10}%`,
    });
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

  const src = buildEmbedUrl(vimeoId);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border shadow-2xl group"
    >
      <iframe
        key={vimeoId}
        src={src}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        title="Training Video"
        onLoad={() => setIframeLoaded(true)}
      />

      {/* Fullscreen toggle button — always visible so it works above the iframe */}
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
