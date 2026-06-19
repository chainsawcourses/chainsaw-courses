import React, { useEffect, useRef, useState } from "react";
import Player from "@vimeo/player";
import { useUserSession } from "../contexts/UserContext";

interface VimeoPlayerProps {
  vimeoId: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

export function VimeoPlayer({ vimeoId, onTimeUpdate, onEnded }: VimeoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const { fullName, email } = useUserSession();
  
  const [watermarkPos, setWatermarkPos] = useState({ top: "50%", left: "50%" });

  useEffect(() => {
    if (!containerRef.current) return;

    playerRef.current = new Player(containerRef.current, {
      id: parseInt(vimeoId),
      byline: false,
      portrait: false,
      title: false,
      dnt: true,
      responsive: true,
    });

    const player = playerRef.current;

    player.on("timeupdate", (data) => {
      onTimeUpdate?.(data.seconds);
    });

    player.on("ended", () => {
      onEnded?.();
    });

    return () => {
      player.destroy();
    };
  }, [vimeoId, onTimeUpdate, onEnded]);

  // Watermark logic
  useEffect(() => {
    const moveWatermark = () => {
      const top = Math.floor(Math.random() * 80) + 10;
      const left = Math.floor(Math.random() * 80) + 10;
      setWatermarkPos({ top: `${top}%`, left: `${left}%` });
    };

    moveWatermark();
    const interval = setInterval(moveWatermark, 60000); // Move every 60s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Watermark */}
      <div 
        className="pointer-events-none absolute text-white/15 font-mono text-sm uppercase tracking-wider font-bold mix-blend-overlay z-50 whitespace-nowrap transition-all duration-1000 ease-in-out"
        style={{ top: watermarkPos.top, left: watermarkPos.left, transform: "translate(-50%, -50%)" }}
      >
        {fullName} - {email}
      </div>
    </div>
  );
}
