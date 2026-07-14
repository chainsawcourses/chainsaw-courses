import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type ScenarioId = "sag" | "hog" | "sidebend";
type Phase = "ready" | "success" | "pinched";
type Zone = "tension" | "compression";

// ── Constants ─────────────────────────────────────────────────────────────────
const VW = 360;
const VH = 230;
// Log geometry (sag + hog share these)
const LX = 30, LY = 74, LW = 300, LH = 62;
const MID_Y = LY + LH / 2; // neutral axis y

// ── Scenario definitions ──────────────────────────────────────────────────────
const SCENARIOS: Record<ScenarioId, {
  title: string;
  tagline: string;
  instruction: string;
  successMsg: string;
  pinchMsg: string;
  explanation: string;
  correctZone: "top" | "bottom" | "outside"; // tension side = correct first cut
}> = {
  sag: {
    title: "Log On Two Supports",
    tagline: "Sagging between two stumps or rocks — gravity load",
    instruction: "Tap the log to place your first relief cut",
    successMsg: "Correct! The kerf opens safely.",
    pinchMsg: "Saw pinched! The top is in compression — the kerf slammed shut.",
    explanation:
      "Gravity compresses the top fibres and stretches the bottom. Always make the first undercut from the BLUE tension zone (bottom, ⅓ depth) first — the kerf opens and the saw stays free. Then complete from the top.",
    correctZone: "bottom",
  },
  hog: {
    title: "Cantilever Over Bank",
    tagline: "One end fixed, far end hanging free — hogging load",
    instruction: "Tap the log to place your first relief cut",
    successMsg: "Correct! The kerf opens safely.",
    pinchMsg: "Saw pinched! The bottom is in compression here — the kerf closed.",
    explanation:
      "In a cantilever (hogging) position the stress reverses: the top fibres stretch (tension) and the bottom compresses. Start the first overcut from the BLUE tension zone on top (⅓ depth), then finish from below.",
    correctZone: "top",
  },
  sidebend: {
    title: "Severe Side Bow",
    tagline: "Lateral sweep viewed from above — horizontal bending",
    instruction: "Tap the log — convex (outside) or concave (inside) first?",
    successMsg: "Correct! The convex kerf opens safely.",
    pinchMsg: "Saw pinched! The concave (inside) is under compression — kerf closed.",
    explanation:
      "A bowed log has tension on the convex (outside) surface and compression on the concave (inside). Always cut from the BLUE convex side first so the kerf opens toward you, then finish from the concave side.",
    correctZone: "outside",
  },
};

const ORDER: ScenarioId[] = ["sag", "hog", "sidebend"];

// ── SVG helpers ───────────────────────────────────────────────────────────────
function svgPoint(svg: SVGSVGElement, e: React.MouseEvent | React.TouchEvent) {
  const rect = svg.getBoundingClientRect();
  const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
  const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * VW,
    y: ((clientY - rect.top) / rect.height) * VH,
  };
}

// ── Scene components ──────────────────────────────────────────────────────────
interface SceneProps {
  phase: Phase;
  cutX: number | null;
  cutY: number | null;
  onHit: (zone: Zone, px: number, py: number) => void;
}

function SagScene({ phase, cutX, onHit }: SceneProps) {
  const gapSize = phase === "success" && cutX != null ? 10 : 0;
  const rightX = cutX != null ? cutX + gapSize : LX + LW;
  const leftW = cutX != null ? cutX - LX : LW;
  const rightW = LX + LW - rightX;

  return (
    <>
      <defs>
        <linearGradient id="sagGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.82" />
          <stop offset="44%" stopColor="#f3f4f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="20%" stopColor="#92400e" />
          <stop offset="80%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <filter id="sawShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Ground */}
      <rect x="0" y="182" width={VW} height={VH - 182} fill="#44403c" opacity="0.35" />
      <line x1="0" y1="182" x2={VW} y2="182" stroke="#78716c" strokeWidth="1.5" />

      {/* Gravity arrows above log */}
      {[90, 180, 270].map(ax => (
        <g key={ax} opacity="0.55">
          <line x1={ax} y1={LY - 20} x2={ax} y2={LY - 4} stroke="#ef4444" strokeWidth="1.5" />
          <polygon points={`${ax - 4},${LY - 5} ${ax + 4},${LY - 5} ${ax},${LY + 1}`} fill="#ef4444" />
        </g>
      ))}
      <text x={180} y={LY - 24} textAnchor="middle" fontSize="8" fill="#ef4444" fontFamily="monospace" opacity="0.7" fontWeight="700">GRAVITY</text>

      {/* Supports */}
      {[LX + 50, LX + LW - 50].map(sx => (
        <g key={sx}>
          <polygon points={`${sx},${LY + LH + 2} ${sx - 16},182 ${sx + 16},182`} fill="#a78bfa" opacity="0.7" />
          <rect x={sx - 12} y={LY + LH} width="24" height="5" rx="2" fill="#7c3aed" opacity="0.85" />
        </g>
      ))}

      {/* Log — left piece */}
      {phase === "success" && cutX != null ? (
        <>
          <g style={{ transform: `translateX(-${gapSize / 2}px)` }}>
            <rect x={LX} y={LY} width={leftW} height={LH} rx="7" fill="url(#woodGrad)" />
            <rect x={LX} y={LY} width={leftW} height={LH} rx="7" fill="url(#sagGrad)" />
            <line x1={LX + leftW} y1={LY - 6} x2={LX + leftW} y2={LY + LH + 6} stroke="#4ade80" strokeWidth="3" opacity="0.9" />
          </g>
          <g style={{ transform: `translateX(${gapSize / 2}px)` }}>
            <rect x={rightX - gapSize} y={LY} width={rightW} height={LH} rx="7" fill="url(#woodGrad)" />
            <rect x={rightX - gapSize} y={LY} width={rightW} height={LH} rx="7" fill="url(#sagGrad)" />
          </g>
        </>
      ) : (
        <>
          <rect x={LX} y={LY} width={LW} height={LH} rx="7" fill="url(#woodGrad)" />
          <rect x={LX} y={LY} width={LW} height={LH} rx="7" fill="url(#sagGrad)" />
        </>
      )}

      {/* Neutral axis */}
      <line x1={LX + 4} y1={MID_Y} x2={LX + LW - 4} y2={MID_Y}
        stroke="#fff" strokeWidth="1" strokeDasharray="7,5" opacity="0.55" />

      {/* Zone labels */}
      <text x={LX + LW / 2} y={LY + 15} textAnchor="middle" fontSize="8.5" fontWeight="800"
        fontFamily="monospace" fill="#ef4444" letterSpacing="0.5">▼ COMPRESSION</text>
      <text x={LX + LW / 2} y={LY + LH - 5} textAnchor="middle" fontSize="8.5" fontWeight="800"
        fontFamily="monospace" fill="#3b82f6" letterSpacing="0.5">▲ TENSION</text>

      {/* Pinch: saw bar stuck */}
      {phase === "pinched" && cutX != null && (
        <g filter="url(#sawShadow)">
          <rect x={cutX - 5} y={LY - 8} width="10" height={LH * 0.45} rx="3" fill="#475569" />
          <rect x={cutX - 3} y={LY + LH * 0.45 - 8} width="6" height="12" rx="2" fill="#fbbf24" />
          <line x1={cutX} y1={LY - 8} x2={cutX} y2={LY + LH / 2} stroke="#facc15" strokeWidth="1.5" strokeDasharray="3,2" />
        </g>
      )}

      {/* Click targets */}
      {phase === "ready" && (
        <>
          <rect x={LX} y={LY} width={LW} height={LH / 2} rx="7" fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => {
              const pt = svgPoint((e.currentTarget.ownerSVGElement as SVGSVGElement), e);
              onHit("compression", pt.x, pt.y);
            }}
            onTouchEnd={e => {
              e.preventDefault();
              const pt = svgPoint((e.currentTarget.ownerSVGElement as SVGSVGElement), e as unknown as React.TouchEvent);
              onHit("compression", pt.x, pt.y);
            }}
          />
          <rect x={LX} y={LY + LH / 2} width={LW} height={LH / 2} rx="7" fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => {
              const pt = svgPoint((e.currentTarget.ownerSVGElement as SVGSVGElement), e);
              onHit("tension", pt.x, pt.y);
            }}
            onTouchEnd={e => {
              e.preventDefault();
              const pt = svgPoint((e.currentTarget.ownerSVGElement as SVGSVGElement), e as unknown as React.TouchEvent);
              onHit("tension", pt.x, pt.y);
            }}
          />
        </>
      )}
    </>
  );
}

function HogScene({ phase, cutX, onHit }: SceneProps) {
  // Log is angled: right end droops 18px
  const droop = 18;
  const logPath = `M${LX},${LY} L${LX + LW},${LY + droop} L${LX + LW},${LY + LH + droop} L${LX},${LY + LH} Z`;

  return (
    <>
      <defs>
        <linearGradient id="hogGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.82" />
          <stop offset="44%" stopColor="#f3f4f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id="woodGradH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="50%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <clipPath id="hogClip">
          <path d={logPath} />
        </clipPath>
      </defs>

      {/* Ground (left only — bank edge) */}
      <rect x="0" y="182" width="120" height={VH - 182} fill="#44403c" opacity="0.35" />
      <line x1="0" y1="182" x2="120" y2="182" stroke="#78716c" strokeWidth="1.5" />
      {/* Bank edge */}
      <path d="M80,182 Q100,165 120,182" fill="none" stroke="#78716c" strokeWidth="2" />
      <text x="200" y="210" textAnchor="middle" fontSize="9" fill="#78716c" fontFamily="monospace" opacity="0.8">← BANK EDGE</text>
      {/* Downward gravity arrow at free end */}
      <g opacity="0.55">
        <line x1={LX + LW - 20} y1={LY + droop + LH + 8} x2={LX + LW - 20} y2={LY + droop + LH + 22} stroke="#ef4444" strokeWidth="1.5" />
        <polygon points={`${LX + LW - 24},${LY + droop + LH + 21} ${LX + LW - 16},${LY + droop + LH + 21} ${LX + LW - 20},${LY + droop + LH + 27}`} fill="#ef4444" />
      </g>

      {/* Support (left end) */}
      <polygon points={`${LX + 30},${LY + LH + 2} ${LX + 14},182 ${LX + 46},182`} fill="#a78bfa" opacity="0.7" />
      <rect x={LX + 18} y={LY + LH} width="24" height="5" rx="2" fill="#7c3aed" opacity="0.85" />

      {/* Log body */}
      <path d={logPath} fill="url(#woodGradH)" />
      <path d={logPath} fill="url(#hogGrad)" />

      {/* Neutral axis (angled) */}
      <line x1={LX + 4} y1={LY + LH / 2} x2={LX + LW - 4} y2={LY + droop + LH / 2}
        stroke="#fff" strokeWidth="1" strokeDasharray="7,5" opacity="0.55" />

      {/* Zone labels */}
      <text x={LX + LW / 2} y={LY + droop / 2 + 14} textAnchor="middle" fontSize="8.5" fontWeight="800"
        fontFamily="monospace" fill="#3b82f6" letterSpacing="0.5">▼ TENSION</text>
      <text x={LX + LW / 2} y={LY + droop / 2 + LH - 5} textAnchor="middle" fontSize="8.5" fontWeight="800"
        fontFamily="monospace" fill="#ef4444" letterSpacing="0.5">▲ COMPRESSION</text>

      {/* Pinch saw bar */}
      {phase === "pinched" && cutX != null && (
        <g>
          <rect x={cutX - 5} y={LY + droop / 2 + LH / 2 + 2} width="10" height={LH * 0.45} rx="3" fill="#475569" opacity="0.95" />
          <rect x={cutX - 3} y={LY + droop / 2 + LH * 0.95} width="6" height="12" rx="2" fill="#fbbf24" />
        </g>
      )}
      {/* Success kerf */}
      {phase === "success" && cutX != null && (
        <line x1={cutX} y1={LY - 8} x2={cutX} y2={LY + droop + LH + 8} stroke="#4ade80" strokeWidth="3" opacity="0.9" />
      )}

      {/* Click targets */}
      {phase === "ready" && (
        <>
          <rect x={LX} y={LY} width={LW} height={LH / 2 + droop / 2} fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => {
              const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e);
              onHit("tension", pt.x, pt.y);
            }}
            onTouchEnd={e => { e.preventDefault(); const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e as unknown as React.TouchEvent); onHit("tension", pt.x, pt.y); }}
          />
          <rect x={LX} y={LY + LH / 2 + droop / 2} width={LW} height={LH / 2} fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => {
              const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e);
              onHit("compression", pt.x, pt.y);
            }}
            onTouchEnd={e => { e.preventDefault(); const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e as unknown as React.TouchEvent); onHit("compression", pt.x, pt.y); }}
          />
        </>
      )}
    </>
  );
}

function SidebendScene({ phase, cutX: clickX, cutY: clickY, onHit }: SceneProps) {
  // Top-down view — log curves left-to-right, concave on left, convex on right
  // Log as a curved arc shape
  const cx = VW / 2;
  const topY = 40, botY = 190;
  const midY = (topY + botY) / 2;
  const bow = 40; // horizontal bow amount

  // Outer (right/convex/tension) edge
  const outerPath = `M${cx + 10},${topY} C${cx + 10 + bow + 20},${midY} ${cx + 10 + bow + 20},${midY} ${cx + 10},${botY}`;
  // Inner (left/concave/compression) edge
  const innerPath = `M${cx - 10},${topY} C${cx - 10 - bow + 20},${midY} ${cx - 10 - bow + 20},${midY} ${cx - 10},${botY}`;

  const logFill = `M${cx + 10},${topY} C${cx + 10 + bow + 20},${midY} ${cx + 10 + bow + 20},${midY} ${cx + 10},${botY} L${cx - 10},${botY} C${cx - 10 - bow + 20},${midY} ${cx - 10 - bow + 20},${midY} ${cx - 10},${topY} Z`;

  // Gradient: left=red (compression/concave), right=blue (tension/convex)
  const convexSideX = cx + bow / 2 + 10;
  const concaveSideX = cx - bow / 2 + 10;

  return (
    <>
      <defs>
        <linearGradient id="bowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.75" />
          <stop offset="42%" stopColor="#f3f4f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="bowWood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="50%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <clipPath id="bowClip">
          <path d={logFill} />
        </clipPath>
      </defs>

      {/* "Top down" label */}
      <text x={VW / 2} y="20" textAnchor="middle" fontSize="8.5" fill="#9ca3af" fontFamily="monospace" fontWeight="700" letterSpacing="1">
        ↓ VIEW FROM ABOVE ↓
      </text>

      {/* Log body */}
      <path d={logFill} fill="url(#bowWood)" />
      <path d={logFill} fill="url(#bowGrad)" />

      {/* Outer edge highlight (convex/tension) */}
      <path d={outerPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" opacity="0.7" />
      {/* Inner edge highlight (concave/compression) */}
      <path d={innerPath} fill="none" stroke="#ef4444" strokeWidth="2.5" opacity="0.7" />

      {/* Neutral axis (vertical centre of log) */}
      <line x1={cx} y1={topY} x2={cx} y2={botY} stroke="#fff" strokeWidth="1" strokeDasharray="7,5" opacity="0.5" />

      {/* Labels */}
      <text x={concaveSideX - 28} y={midY - 8} textAnchor="middle" fontSize="8" fontWeight="800"
        fontFamily="monospace" fill="#ef4444" letterSpacing="0.5">◀ CONCAVE</text>
      <text x={concaveSideX - 28} y={midY + 6} textAnchor="middle" fontSize="8" fontWeight="800"
        fontFamily="monospace" fill="#ef4444" letterSpacing="0.5">COMPRESSION</text>
      <text x={convexSideX + 28} y={midY - 8} textAnchor="middle" fontSize="8" fontWeight="800"
        fontFamily="monospace" fill="#3b82f6" letterSpacing="0.5">CONVEX ▶</text>
      <text x={convexSideX + 28} y={midY + 6} textAnchor="middle" fontSize="8" fontWeight="800"
        fontFamily="monospace" fill="#3b82f6" letterSpacing="0.5">TENSION</text>

      {/* Stress arrows */}
      {[midY - 40, midY, midY + 40].map(ay => (
        <g key={ay} opacity="0.5">
          <line x1={cx + 2} y1={ay} x2={cx + bow * 0.6} y2={ay} stroke="#3b82f6" strokeWidth="1.2" />
          <polygon points={`${cx + bow * 0.6},${ay - 3} ${cx + bow * 0.6},${ay + 3} ${cx + bow * 0.6 + 5},${ay}`} fill="#3b82f6" />
          <line x1={cx - 2} y1={ay} x2={cx - bow * 0.3} y2={ay} stroke="#ef4444" strokeWidth="1.2" />
          <polygon points={`${cx - bow * 0.3},${ay - 3} ${cx - bow * 0.3},${ay + 3} ${cx - bow * 0.3 - 5},${ay}`} fill="#ef4444" />
        </g>
      ))}

      {/* Click feedback */}
      {phase === "pinched" && clickX != null && (
        <g>
          <circle cx={clickX} cy={clickY ?? midY} r="10" fill="none" stroke="#facc15" strokeWidth="2" opacity="0.9" />
          <line x1={clickX - 8} y1={clickY ?? midY} x2={clickX + 8} y2={clickY ?? midY} stroke="#facc15" strokeWidth="2" />
          <line x1={clickX} y1={(clickY ?? midY) - 8} x2={clickX} y2={(clickY ?? midY) + 8} stroke="#facc15" strokeWidth="2" />
        </g>
      )}
      {phase === "success" && clickX != null && (
        <g>
          <circle cx={clickX} cy={clickY ?? midY} r="12" fill="#4ade80" opacity="0.25" />
          <circle cx={clickX} cy={clickY ?? midY} r="8" fill="none" stroke="#4ade80" strokeWidth="2.5" opacity="0.9" />
          <text x={clickX} y={(clickY ?? midY) + 4} textAnchor="middle" fontSize="10" fill="#4ade80" fontWeight="800">✓</text>
        </g>
      )}

      {/* Click targets */}
      {phase === "ready" && (
        <>
          {/* Left side = concave = compression */}
          <rect x="0" y="0" width={cx} height={VH} fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => { const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e); onHit("compression", pt.x, pt.y); }}
            onTouchEnd={e => { e.preventDefault(); const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e as unknown as React.TouchEvent); onHit("compression", pt.x, pt.y); }}
          />
          {/* Right side = convex = tension */}
          <rect x={cx} y="0" width={VW - cx} height={VH} fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => { const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e); onHit("tension", pt.x, pt.y); }}
            onTouchEnd={e => { e.preventDefault(); const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e as unknown as React.TouchEvent); onHit("tension", pt.x, pt.y); }}
          />
        </>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CrossCutSim() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("sag");
  const [phase, setPhase] = useState<Phase>("ready");
  const [cutX, setCutX] = useState<number | null>(null);
  const [cutY, setCutY] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const scenario = SCENARIOS[scenarioId];

  const handleHit = useCallback((zone: Zone, px: number, py: number) => {
    if (phase !== "ready") return;
    const correct = zone === "tension";
    setCutX(px);
    setCutY(py);
    setPhase(correct ? "success" : "pinched");
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  }, [phase]);

  const reset = () => { setPhase("ready"); setCutX(null); setCutY(null); };

  const nextScenario = () => {
    const idx = ORDER.indexOf(scenarioId);
    setScenarioId(ORDER[(idx + 1) % ORDER.length]);
    reset();
  };

  const sceneProps: SceneProps = { phase, cutX, cutY, onHit: handleHit };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/training" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-black uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <span className="font-black tracking-tighter text-xs uppercase text-muted-foreground">Cross-Cut Simulator</span>
          <span className="font-mono text-xs text-muted-foreground">
            {score.total > 0 ? `${score.correct}/${score.total}` : ""}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Title */}
        <div className="text-center">
          <h1 className="font-black tracking-tighter text-xl uppercase text-foreground leading-tight">
            Tension &amp; Compression
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5 uppercase tracking-widest">
            Interactive Load Simulator
          </p>
        </div>

        {/* Scenario selector */}
        <div className="grid grid-cols-3 gap-1.5">
          {ORDER.map(sid => (
            <button
              key={sid}
              onClick={() => { setScenarioId(sid); reset(); }}
              className={`px-2 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-colors border leading-tight ${
                scenarioId === sid
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {sid === "sag" && "Two\nSupports"}
              {sid === "hog" && "Cantilever\nOver Bank"}
              {sid === "sidebend" && "Side\nBow"}
            </button>
          ))}
        </div>

        {/* Scenario tagline */}
        <div className="text-center">
          <p className="text-xs font-mono text-muted-foreground">{scenario.tagline}</p>
        </div>

        {/* Instruction banner */}
        <div className={`rounded-md px-3 py-2 text-center text-xs font-black uppercase tracking-widest transition-colors ${
          phase === "ready"
            ? "bg-amber-500/10 text-amber-600 border border-amber-500/30"
            : phase === "success"
            ? "bg-green-500/10 text-green-600 border border-green-500/30"
            : "bg-red-500/10 text-red-600 border border-red-500/30"
        }`}>
          {phase === "ready" && scenario.instruction}
          {phase === "success" && `✓ ${scenario.successMsg}`}
          {phase === "pinched" && `⚠ ${scenario.pinchMsg}`}
        </div>

        {/* SVG canvas */}
        <div className={`rounded-xl border-2 overflow-hidden transition-colors ${
          phase === "ready" ? "border-border" :
          phase === "success" ? "border-green-500/50 bg-green-500/5" :
          "border-red-500/50 bg-red-500/5"
        }`}>
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            width="100%"
            style={{ display: "block", touchAction: "none" }}
          >
            {scenarioId === "sag" && <SagScene {...sceneProps} />}
            {scenarioId === "hog" && <HogScene {...sceneProps} />}
            {scenarioId === "sidebend" && <SidebendScene {...sceneProps} />}

            {/* Legend */}
            <g>
              <rect x="8" y={VH - 22} width="10" height="10" rx="2" fill="#ef4444" opacity="0.8" />
              <text x="22" y={VH - 13} fontSize="8" fontFamily="monospace" fill="#ef4444" fontWeight="700">Compression</text>
              <rect x="110" y={VH - 22} width="10" height="10" rx="2" fill="#3b82f6" opacity="0.8" />
              <text x="124" y={VH - 13} fontSize="8" fontFamily="monospace" fill="#3b82f6" fontWeight="700">Tension</text>
              <line x1="210" y1={VH - 17} x2="228" y2={VH - 17} stroke="#fff" strokeWidth="1" strokeDasharray="5,3" opacity="0.5" />
              <text x="232" y={VH - 13} fontSize="8" fontFamily="monospace" fill="#9ca3af" fontWeight="700">Neutral axis</text>
            </g>
          </svg>
        </div>

        {/* Explanation (after attempt) */}
        {phase !== "ready" && (
          <div className="rounded-lg border border-border bg-card/60 px-4 py-3 space-y-3">
            <p className="text-xs font-mono text-foreground leading-relaxed">{scenario.explanation}</p>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs font-black uppercase tracking-widest hover:bg-accent transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Try Again
              </button>
              <button
                onClick={nextScenario}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-colors"
              >
                Next Scenario →
              </button>
            </div>
          </div>
        )}

        {/* Score card */}
        {score.total > 0 && (
          <div className="rounded-lg border border-border bg-card/40 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Session Score</span>
            <span className={`text-sm font-black tabular-nums ${
              score.correct / score.total >= 0.8 ? "text-green-600" :
              score.correct / score.total >= 0.5 ? "text-amber-600" : "text-red-600"
            }`}>
              {score.correct}/{score.total} ({Math.round(score.correct / score.total * 100)}%)
            </span>
          </div>
        )}

        {/* Theory reminder */}
        <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">The Golden Rule</p>
          <p className="text-xs font-mono text-foreground leading-relaxed">
            Always identify the <span className="text-blue-500 font-bold">tension zone</span> (blue) and make your first relief cut there at 20–30% depth. The kerf will open. Then complete the cut from the <span className="text-red-500 font-bold">compression side</span> (red). Cutting the compression zone first traps your bar.
          </p>
        </div>
      </main>
    </div>
  );
}
