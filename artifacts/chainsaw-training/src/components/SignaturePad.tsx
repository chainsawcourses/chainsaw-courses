import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import SignaturePad from "signature_pad";

interface SignaturePadProps {
  onEnd?: () => void;
}

export interface SignaturePadRef {
  isEmpty: () => boolean;
  clear: () => void;
  toDataURL: (type?: string) => string;
}

export const SignatureCanvas = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ onEnd }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);

    useEffect(() => {
      if (canvasRef.current) {
        padRef.current = new SignaturePad(canvasRef.current, {
          penColor: "black",
          backgroundColor: "transparent",
        });

        if (onEnd) {
          padRef.current.addEventListener("endStroke", onEnd);
        }

        const resizeCanvas = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d")?.scale(ratio, ratio);
            padRef.current?.clear();
          }
        };

        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();

        return () => {
          window.removeEventListener("resize", resizeCanvas);
          if (onEnd) padRef.current?.removeEventListener("endStroke", onEnd);
          padRef.current?.off();
        };
      }
      return undefined;
    }, [onEnd]);

    useImperativeHandle(ref, () => ({
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      clear: () => padRef.current?.clear(),
      toDataURL: (type?: string) => padRef.current?.toDataURL(type) ?? "",
    }));

    return (
      <div className="w-full h-48 sm:h-64 border border-input rounded-md bg-secondary overflow-hidden relative touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          style={{ touchAction: "none" }}
        />
        <div className="absolute bottom-2 right-2 opacity-30 text-xs font-mono pointer-events-none">
          SIGN HERE
        </div>
      </div>
    );
  }
);
SignatureCanvas.displayName = "SignatureCanvas";
