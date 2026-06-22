import { useEffect, useRef, useState } from "react";
import Player from "@vimeo/player";
import { useUserSession } from "../contexts/UserContext";

interface VimeoPlayerProps {
  vimeoId: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

export function VimeoPlayer({ vimeoId, onTimeUpdate, onEnded }: VimeoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<Player | null>(null);
  const { fullName, email } = useUserSession();
  const [watermarkPos, setWatermarkPos] = useState({ top: "50%", left: "50%" });
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!iframeRef.current) return;

    const player = new Player(iframeRef.current);
    playerRef.current = player;

    player.ready().then(() => {
      setLoaded(true);
      setLoadError(false);
    }).catch(() => {
      setLoadError(true);
    });

    if (onTimeUpdate) {
      player.on("timeupdate", (data) => onTimeUpdate(data.seconds));
    }
    if (onEnded) {
      player.on("ended", () => onEnded());
    }

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [vimeoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const move = () => {
      setWatermarkPos({
        top: `${Math.floor(Math.random() * 80) + 10}%`,
        left: `${Math.floor(Math.random() * 80) + 10}%`,
      });
    };
    move();
    const id = setInterval(move, 60000);
    return () => clearInterval(id);
  }, []);

  const src = `https://player.vimeo.com/video/${vimeoId}?badge=0&autopause=0&player_id=0&app_id=58479`;

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border shadow-2xl">
      <iframe
        ref={iframeRef}
        src={src}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
        allowFullScreen
        title="Training Video"
      />

      {/* Shown only if player.ready() rejects — e.g. blocked in nested iframe */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 gap-4 p-6 text-center">
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
            Video unavailable in preview — open the app in a new browser tab to watch.
          </p>
        </div>
      )}

      {/* Watermark — only shown once iframe has confirmed ready */}
      {loaded && (
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
