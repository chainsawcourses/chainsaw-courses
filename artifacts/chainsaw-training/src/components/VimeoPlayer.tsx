import { useEffect, useRef, useState } from "react";
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
  const params = new URLSearchParams({ title: "0", byline: "0", portrait: "0", transparent: "0" });
  if (hash) params.set("h", hash);
  return `https://player.vimeo.com/video/${id}?${params}`;
}

export function VimeoPlayer({ vimeoId, onTimeUpdate, onEnded }: VimeoPlayerProps) {
  const { fullName, email } = useUserSession();
  const [watermarkPos, setWatermarkPos] = useState({ top: "50%", left: "50%" });
  const iframeLoadedRef = useRef(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const move = () => setWatermarkPos({
      top: `${Math.floor(Math.random() * 80) + 10}%`,
      left: `${Math.floor(Math.random() * 80) + 10}%`,
    });
    move();
    const id = setInterval(move, 60000);
    return () => clearInterval(id);
  }, []);

  const src = buildEmbedUrl(vimeoId);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border shadow-2xl">
      <iframe
        key={vimeoId}
        src={src}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        title="Training Video"
        onLoad={() => { iframeLoadedRef.current = true; forceRender(n => n + 1); }}
      />
      {iframeLoadedRef.current && (
        <div
          className="pointer-events-none absolute text-white/15 font-mono text-sm uppercase tracking-wider font-bold mix-blend-overlay z-50 whitespace-nowrap transition-all duration-1000 ease-in-out"
          style={{ top: watermarkPos.top, left: watermarkPos.left, transform: "translate(-50%, -50%)" }}
        >
          {fullName} - {email}
        </div>
      )}
    </div>
  );
}
