import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ChainsawLoaderProps extends HTMLAttributes<HTMLDivElement> {
  "aria-label"?: string;
}

export function ChainsawLoader({ className, "aria-label": ariaLabel = "Loading", ...props }: ChainsawLoaderProps) {
  // A standard chainsaw chain alternates cutter links and tie straps.
  // Eleven links travel on fourteen evenly spaced positions, leaving a
  // three-link gap so the loader reads clearly as a spinning indicator.
  const links = Array.from({ length: 11 });

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn("chainsaw-loader-root relative inline-flex items-center justify-center", className)}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="w-full h-full chainsaw-loader"
      >
        <g>
          {/* Circular Guide Bar Body */}
          <circle cx="12" cy="12" r="5.5" fill="currentColor" opacity="0.15" stroke="none" />
          <circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.8" />

          {/* Explicit Chain Links */}
          {links.map((_, i) => {
            const isCutter = i % 2 === 0;
            return (
              <g
                key={i}
                className="chainsaw-chain-path"
                style={{ animationDelay: `calc(var(--chainsaw-duration, 4s) * -${i} / 14)` }}
              >
                {/* Drive Link (Bottom) */}
                <path d="M -0.5 0 L 0 2.2 L 0.5 0 Z" fill="currentColor" stroke="none" />
                
                {/* Side Plate with Rivet Holes (Middle) */}
                <path
                  fillRule="evenodd"
                  d="M -0.8 -0.6 H 0.8 A 0.6 0.6 0 0 1 1.4 0 A 0.6 0.6 0 0 1 0.8 0.6 H -0.8 A 0.6 0.6 0 0 1 -1.4 0 A 0.6 0.6 0 0 1 -0.8 -0.6 Z M -0.8 -0.25 A 0.25 0.25 0 1 0 -0.8 0.25 A 0.25 0.25 0 1 0 -0.8 -0.25 Z M 0.8 -0.25 A 0.25 0.25 0 1 0 0.8 0.25 A 0.25 0.25 0 1 0 0.8 -0.25 Z"
                  fill="currentColor"
                  stroke="none"
                />
                
                {/* Cutter Tooth (Top) - Alternating */}
                {isCutter && (
                  <path
                    d="M 1.2 0 L 1.2 -1.1 A 0.2 0.2 0 0 0 1 -1.3 L 0.5 -1.3 L 0.1 0 L -0.2 0 L -0.2 -1.8 A 0.1 0.1 0 0 0 -0.3 -1.9 L -1.3 -1.3 L -1.5 0 Z"
                    fill="currentColor"
                    stroke="none"
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
