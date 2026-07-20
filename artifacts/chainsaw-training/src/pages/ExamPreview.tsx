import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, ArrowLeft } from "lucide-react";

const CROWD_APPLAUSE_URL = `${import.meta.env.BASE_URL}crowd-applause.mp3`;

const COLORS = ["#f97316","#facc15","#4ade80","#60a5fa","#e879f9","#fb7185","#34d399","#f59e0b"];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; rotation: number; rotationSpeed: number;
  width: number; height: number; opacity: number;
}

function createParticle(w: number): Particle {
  return {
    x: Math.random() * w,
    y: -10 - Math.random() * 200,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    width: 8 + Math.random() * 10,
    height: 4 + Math.random() * 6,
    opacity: 1,
  };
}

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    for (let i = 0; i < 220; i++) particles.push(createParticle(canvas.width));

    let raf = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.99; p.rotation += p.rotationSpeed;
        if (p.y > canvas.height * 0.7) p.opacity -= 0.025;
        if (p.opacity <= 0) { particles.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      }
      if (particles.length > 0) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}

export default function ExamPreview() {
  const [played, setPlayed] = useState(false);

  const playAndShow = () => {
    if (played) return;
    setPlayed(true);
    try {
      const audio = new Audio(CROWD_APPLAUSE_URL);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch {}
  };

  // Auto-trigger on mount
  useEffect(() => { playAndShow(); }, []);

  return (
    <>
      <ConfettiCanvas />
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 left-4 z-50">
          <Button variant="outline" size="sm" asChild className="font-mono text-xs">
            <Link href="/admin/dashboard"><ArrowLeft className="w-4 h-4 mr-2" /> ADMIN</Link>
          </Button>
        </div>

        <Card className="w-full max-w-2xl border-border bg-card/80 backdrop-blur-sm relative z-10">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <Award className="w-20 h-20 text-primary mb-6" />

            <h1 className="text-3xl font-black font-mono uppercase tracking-wide mb-2">
              Certification Exam Passed
            </h1>

            <p className="text-muted-foreground font-mono mb-2">
              You scored 42 out of 45 (93%)
            </p>

            <p className="text-sm text-primary font-mono mb-8">
              Congratulations — you have met the 80% pass mark for the final summative exam.
            </p>

            <div className="flex gap-4 w-full">
              <Button asChild className="w-full h-14 font-mono font-bold tracking-widest">
                <Link href="/training">BACK TO TRAINING</Link>
              </Button>
            </div>

            <p className="mt-6 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
              Admin preview — this is what students see when they pass the final exam
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
