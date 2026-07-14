import { useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type ScenarioId = "sag" | "hog" | "sidebend";
type Phase = "ready" | "success" | "pinched";
type Zone = "tension" | "compression";

// ── Audio ─────────────────────────────────────────────────────────────────────
function playChainsawCut() {
  try {
    const ctx = new AudioContext();
    const sr = ctx.sampleRate;
    // White noise burst → bandpass to mimic chain cutting through wood
    const buf = ctx.createBuffer(1, sr * 0.45, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.setValueAtTime(600, ctx.currentTime);
    bpf.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.2);
    bpf.Q.value = 1.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.04);
    env.gain.setValueAtTime(0.55, ctx.currentTime + 0.25);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    src.connect(bpf); bpf.connect(env); env.connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + 0.45);
    // Rising tone over the noise for the "cut through" feel
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.3);
    og.gain.setValueAtTime(0.2, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch { /* AudioContext not available in some environments */ }
}

function playPinchError() {
  try {
    const ctx = new AudioContext();
    // Low dull thud + descending buzz
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
    // Click transient
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const cg = ctx.createGain(); cg.gain.value = 0.5;
    src.connect(cg); cg.connect(ctx.destination);
    src.start();
  } catch { /* AudioContext not available */ }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const VW = 360;
const VH = 230;
const LX = 30, LY = 74, LW = 300, LH = 62;
const MID_Y = LY + LH / 2;

// ── Touch/mouse helper ────────────────────────────────────────────────────────
function svgPoint(svg: SVGSVGElement, e: React.MouseEvent | React.TouchEvent) {
  const rect = svg.getBoundingClientRect();
  let clientX: number, clientY: number;
  // touchend: touches list is empty — must use changedTouches
  if ("changedTouches" in e && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else if ("touches" in e && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = (e as React.MouseEvent).clientX;
    clientY = (e as React.MouseEvent).clientY;
  }
  return {
    x: ((clientX - rect.left) / rect.width) * VW,
    y: ((clientY - rect.top) / rect.height) * VH,
  };
}

// ── Scenario definitions ──────────────────────────────────────────────────────
// CORRECT first cut = COMPRESSION side (20-30% depth relief cut).
// Cutting the TENSION side first causes the timber to split or react violently.
// Cutting too DEEP on compression pinches the bar — hence 20-30% only.
const SCENARIOS: Record<ScenarioId, {
  title: string;
  tagline: string;
  instruction: string;
  successMsg: string;
  pinchMsg: string;
  explanation: string;
}> = {
  sag: {
    title: "Log On Two Supports",
    tagline: "Sagging between two stumps or rocks — gravity load",
    instruction: "Tap where you make your FIRST relief cut (20–30% depth)",
    successMsg: "Correct! Compression relief cut — now complete from the tension side.",
    pinchMsg: "Danger! Cutting the tension side first — the timber can split or react violently.",
    explanation:
      "A sagging log compresses the top fibres and stretches the bottom (tension). Make your first cut on the RED compression zone on top — roughly 20–30% of the log's diameter. This relieves the stress safely. Then complete the cut from the blue tension side below. Cutting the tension side first risks violent splitting.",
  },
  hog: {
    title: "Cantilever Over Bank",
    tagline: "One end fixed, far end hanging free — hogging load",
    instruction: "Tap where you make your FIRST relief cut (20–30% depth)",
    successMsg: "Correct! Compression relief cut — now complete from the tension side.",
    pinchMsg: "Danger! Cutting the tension side first — timber could react violently.",
    explanation:
      "A cantilever reverses the stress: the bottom fibres are compressed and the top fibres are in tension. Make your first cut on the RED compression zone below (20–30% depth). This relieves the load safely. Then complete from the blue tension zone on top. Never start from the tension side or the log may split unpredictably.",
  },
  sidebend: {
    title: "Severe Side Bow",
    tagline: "Lateral sweep viewed from above — horizontal bending",
    instruction: "Tap which side to cut first — concave (inside) or convex (outside)?",
    successMsg: "Correct! Cut the concave compression side first, then complete from convex.",
    pinchMsg: "Danger! Cutting the convex tension side first — the timber can split sideways.",
    explanation:
      "A bowed log compresses the concave (inside) surface and stretches the convex (outside). Make your first cut on the RED concave (inside) face — 20–30% depth. This relieves the lateral compression safely. Then complete from the blue convex (outside) face. If you start on the convex tension side the log can react violently sideways.",
  },
};

const ORDER: ScenarioId[] = ["sag", "hog", "sidebend"];

// ── Zone label helper ─────────────────────────────────────────────────────────
// White stroke behind coloured text so labels are readable on any background
function ZoneLabel({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize="8.5" fontWeight="800"
      fontFamily="monospace" letterSpacing="0.5"
      stroke="rgba(0,0,0,0.55)" strokeWidth="3" paintOrder="stroke" fill={color}>
      {text}
    </text>
  );
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
  const leftW = cutX != null ? cutX - LX : LW;
  const rightX = cutX != null ? cutX + gapSize : LX + LW;
  const rightW = LX + LW - rightX;

  return (
    <>
      <defs>
        <linearGradient id="sagGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.78" />
          <stop offset="44%" stopColor="#f3f4f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="40%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>

      {/* Ground */}
      <rect x="0" y="182" width={VW} height={VH - 182} fill="#44403c" opacity="0.35" />
      <line x1="0" y1="182" x2={VW} y2="182" stroke="#78716c" strokeWidth="1.5" />

      {/* Gravity arrows */}
      {[90, 180, 270].map(ax => (
        <g key={ax} opacity="0.6">
          <line x1={ax} y1={LY - 20} x2={ax} y2={LY - 4} stroke="#ef4444" strokeWidth="1.5" />
          <polygon points={`${ax - 4},${LY - 6} ${ax + 4},${LY - 6} ${ax},${LY}`} fill="#ef4444" />
        </g>
      ))}
      <text x={180} y={LY - 24} textAnchor="middle" fontSize="8" fill="#ef4444"
        fontFamily="monospace" opacity="0.75" fontWeight="700">GRAVITY</text>

      {/* Supports */}
      {[LX + 50, LX + LW - 50].map(sx => (
        <g key={sx}>
          <polygon points={`${sx},${LY + LH + 2} ${sx - 16},182 ${sx + 16},182`} fill="#a78bfa" opacity="0.7" />
          <rect x={sx - 12} y={LY + LH} width="24" height="5" rx="2" fill="#7c3aed" opacity="0.85" />
        </g>
      ))}

      {/* Log */}
      {phase === "success" && cutX != null ? (
        <>
          <g style={{ transform: `translateX(-${gapSize / 2}px)` }}>
            <rect x={LX} y={LY} width={leftW} height={LH} rx="7" fill="url(#woodGrad)" />
            <rect x={LX} y={LY} width={leftW} height={LH} rx="7" fill="url(#sagGrad)" />
          </g>
          <g style={{ transform: `translateX(${gapSize / 2}px)` }}>
            <rect x={rightX - gapSize} y={LY} width={rightW} height={LH} rx="7" fill="url(#woodGrad)" />
            <rect x={rightX - gapSize} y={LY} width={rightW} height={LH} rx="7" fill="url(#sagGrad)" />
          </g>
          <line x1={cutX} y1={LY - 14} x2={cutX} y2={LY + LH + 14} stroke="#4ade80" strokeWidth="3" opacity="0.9" />
        </>
      ) : (
        <>
          <rect x={LX} y={LY} width={LW} height={LH} rx="7" fill="url(#woodGrad)" />
          <rect x={LX} y={LY} width={LW} height={LH} rx="7" fill="url(#sagGrad)" />
        </>
      )}

      {/* Pinch saw bar */}
      {phase === "pinched" && cutX != null && (
        <g>
          <rect x={cutX - 5} y={LY + LH / 2 + 2} width="10" height={LH * 0.45} rx="3" fill="#475569" opacity="0.95" />
          <rect x={cutX - 3} y={LY + LH * 0.95} width="6" height="10" rx="2" fill="#fbbf24" />
          <text x={cutX} y={LY + LH / 2 - 6} textAnchor="middle" fontSize="13" fill="#ef4444">✕</text>
        </g>
      )}

      {/* Neutral axis */}
      <line x1={LX + 4} y1={MID_Y} x2={LX + LW - 4} y2={MID_Y}
        stroke="#fff" strokeWidth="1" strokeDasharray="7,5" opacity="0.5" />

      {/* Zone labels — outside the log for readability */}
      <ZoneLabel x={LX + LW / 2} y={LY - 7} text="▼ COMPRESSION (cut first)" color="#ef4444" />
      <ZoneLabel x={LX + LW / 2} y={LY + LH + 12} text="▲ TENSION (cut second)" color="#3b82f6" />

      {/* Click targets */}
      {phase === "ready" && (
        <>
          {/* Top half = compression = CORRECT */}
          <rect x={LX} y={LY} width={LW} height={LH / 2} rx="7" fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => { const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e); onHit("compression", pt.x, pt.y); }}
            onTouchEnd={e => { e.preventDefault(); const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e as unknown as React.TouchEvent); onHit("compression", pt.x, pt.y); }}
          />
          {/* Bottom half = tension = WRONG */}
          <rect x={LX} y={LY + LH / 2} width={LW} height={LH / 2} rx="7" fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => { const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e); onHit("tension", pt.x, pt.y); }}
            onTouchEnd={e => { e.preventDefault(); const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e as unknown as React.TouchEvent); onHit("tension", pt.x, pt.y); }}
          />
        </>
      )}
    </>
  );
}

function HogScene({ phase, cutX, onHit }: SceneProps) {
  const droop = 18;
  const logPath = `M${LX},${LY} L${LX + LW},${LY + droop} L${LX + LW},${LY + LH + droop} L${LX},${LY + LH} Z`;

  return (
    <>
      <defs>
        <linearGradient id="hogGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.78" />
          <stop offset="44%" stopColor="#f3f4f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id="woodGradH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="50%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>

      {/* Ground (left bank only) */}
      <rect x="0" y="182" width="120" height={VH - 182} fill="#44403c" opacity="0.35" />
      <line x1="0" y1="182" x2="120" y2="182" stroke="#78716c" strokeWidth="1.5" />
      <path d="M80,182 Q100,165 120,182" fill="none" stroke="#78716c" strokeWidth="2" />
      <text x="220" y="210" textAnchor="middle" fontSize="9" fill="#78716c"
        fontFamily="monospace" opacity="0.8">← BANK EDGE → FREE AIR</text>

      {/* Gravity arrow at free end */}
      <g opacity="0.6">
        <line x1={LX + LW - 20} y1={LY + droop + LH + 8} x2={LX + LW - 20} y2={LY + droop + LH + 22} stroke="#ef4444" strokeWidth="1.5" />
        <polygon points={`${LX + LW - 24},${LY + droop + LH + 20} ${LX + LW - 16},${LY + droop + LH + 20} ${LX + LW - 20},${LY + droop + LH + 26}`} fill="#ef4444" />
      </g>

      {/* Support */}
      <polygon points={`${LX + 30},${LY + LH + 2} ${LX + 14},182 ${LX + 46},182`} fill="#a78bfa" opacity="0.7" />
      <rect x={LX + 18} y={LY + LH} width="24" height="5" rx="2" fill="#7c3aed" opacity="0.85" />

      {/* Log */}
      <path d={logPath} fill="url(#woodGradH)" />
      <path d={logPath} fill="url(#hogGrad)" />

      {/* Neutral axis */}
      <line x1={LX + 4} y1={LY + LH / 2} x2={LX + LW - 4} y2={LY + droop + LH / 2}
        stroke="#fff" strokeWidth="1" strokeDasharray="7,5" opacity="0.5" />

      {/* Zone labels */}
      <ZoneLabel x={LX + LW / 2} y={LY - 7} text="▼ TENSION (cut second)" color="#3b82f6" />
      <ZoneLabel x={LX + LW / 2} y={LY + droop + LH + 14} text="▲ COMPRESSION (cut first)" color="#ef4444" />

      {/* Pinch / success */}
      {phase === "pinched" && cutX != null && (
        <g>
          <rect x={cutX - 5} y={LY + droop / 2 - 2} width="10" height={LH * 0.42} rx="3" fill="#475569" opacity="0.95" />
          <rect x={cutX - 3} y={LY + droop / 2 + LH * 0.4} width="6" height="10" rx="2" fill="#fbbf24" />
          <text x={cutX} y={LY + droop / 2 + LH / 2 + 14} textAnchor="middle" fontSize="13" fill="#ef4444">✕</text>
        </g>
      )}
      {phase === "success" && cutX != null && (
        <line x1={cutX} y1={LY - 10} x2={cutX} y2={LY + droop + LH + 10} stroke="#4ade80" strokeWidth="3" opacity="0.9" />
      )}

      {/* Click targets */}
      {phase === "ready" && (
        <>
          {/* Top half = tension = WRONG */}
          <rect x={LX} y={LY} width={LW} height={LH / 2 + droop / 2} fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => { const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e); onHit("tension", pt.x, pt.y); }}
            onTouchEnd={e => { e.preventDefault(); const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e as unknown as React.TouchEvent); onHit("tension", pt.x, pt.y); }}
          />
          {/* Bottom half = compression = CORRECT */}
          <rect x={LX} y={LY + LH / 2 + droop / 2} width={LW} height={LH / 2} fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => { const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e); onHit("compression", pt.x, pt.y); }}
            onTouchEnd={e => { e.preventDefault(); const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e as unknown as React.TouchEvent); onHit("compression", pt.x, pt.y); }}
          />
        </>
      )}
    </>
  );
}

function SidebendScene({ phase, cutX: clickX, cutY: clickY, onHit }: SceneProps) {
  const cx = VW / 2;
  const topY = 40, botY = 195;
  const midY = (topY + botY) / 2;
  const bow = 42;

  // Log as a closed banana shape — concave left (compression), convex right (tension)
  const logFill = `M${cx + 12},${topY} C${cx + 12 + bow + 18},${midY} ${cx + 12 + bow + 18},${midY} ${cx + 12},${botY} L${cx - 12},${botY} C${cx - 12 - bow + 20},${midY} ${cx - 12 - bow + 20},${midY} ${cx - 12},${topY} Z`;
  const outerPath = `M${cx + 12},${topY} C${cx + 12 + bow + 18},${midY} ${cx + 12 + bow + 18},${midY} ${cx + 12},${botY}`;
  const innerPath = `M${cx - 12},${topY} C${cx - 12 - bow + 20},${midY} ${cx - 12 - bow + 20},${midY} ${cx - 12},${botY}`;
  const convexX = cx + bow / 2 + 12;
  const concaveX = cx - bow / 2 + 8;

  return (
    <>
      <defs>
        <linearGradient id="bowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.75" />
          <stop offset="42%" stopColor="#f3f4f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="bowWood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="50%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>

      <text x={VW / 2} y="20" textAnchor="middle" fontSize="8.5" fill="#9ca3af"
        fontFamily="monospace" fontWeight="700" letterSpacing="1">↓ VIEW FROM ABOVE ↓</text>

      <path d={logFill} fill="url(#bowWood)" />
      <path d={logFill} fill="url(#bowGrad)" />

      {/* Edge highlights */}
      <path d={outerPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" opacity="0.65" />
      <path d={innerPath} fill="none" stroke="#ef4444" strokeWidth="2.5" opacity="0.65" />

      {/* Neutral axis */}
      <line x1={cx} y1={topY} x2={cx} y2={botY} stroke="#fff" strokeWidth="1" strokeDasharray="7,5" opacity="0.45" />

      {/* Lateral stress arrows */}
      {[midY - 45, midY, midY + 45].map(ay => (
        <g key={ay} opacity="0.5">
          <line x1={cx + 2} y1={ay} x2={cx + bow * 0.55} y2={ay} stroke="#3b82f6" strokeWidth="1.2" />
          <polygon points={`${cx + bow * 0.55},${ay - 3} ${cx + bow * 0.55},${ay + 3} ${cx + bow * 0.55 + 5},${ay}`} fill="#3b82f6" />
          <line x1={cx - 2} y1={ay} x2={cx - bow * 0.28} y2={ay} stroke="#ef4444" strokeWidth="1.2" />
          <polygon points={`${cx - bow * 0.28},${ay - 3} ${cx - bow * 0.28},${ay + 3} ${cx - bow * 0.28 - 5},${ay}`} fill="#ef4444" />
        </g>
      ))}

      {/* Zone labels (outside log) */}
      <ZoneLabel x={concaveX - 32} y={midY - 8} text="◀ CONCAVE" color="#ef4444" />
      <ZoneLabel x={concaveX - 32} y={midY + 6} text="COMPRESSION" color="#ef4444" />
      <ZoneLabel x={concaveX - 32} y={midY + 18} text="(cut first)" color="#ef4444" />
      <ZoneLabel x={convexX + 34} y={midY - 8} text="CONVEX ▶" color="#3b82f6" />
      <ZoneLabel x={convexX + 34} y={midY + 6} text="TENSION" color="#3b82f6" />
      <ZoneLabel x={convexX + 34} y={midY + 18} text="(cut second)" color="#3b82f6" />

      {/* Click feedback */}
      {phase === "success" && clickX != null && (
        <g>
          <circle cx={clickX} cy={clickY ?? midY} r="14" fill="#4ade80" opacity="0.2" />
          <circle cx={clickX} cy={clickY ?? midY} r="9" fill="none" stroke="#4ade80" strokeWidth="2.5" opacity="0.9" />
          <text x={clickX} y={(clickY ?? midY) + 4} textAnchor="middle" fontSize="10" fill="#4ade80" fontWeight="800">✓</text>
        </g>
      )}
      {phase === "pinched" && clickX != null && (
        <g>
          <circle cx={clickX} cy={clickY ?? midY} r="12" fill="#ef4444" opacity="0.18" />
          <text x={clickX} y={(clickY ?? midY) + 5} textAnchor="middle" fontSize="16" fill="#ef4444">✕</text>
        </g>
      )}

      {/* Click targets */}
      {phase === "ready" && (
        <>
          {/* Left = concave = compression = CORRECT */}
          <rect x="0" y="0" width={cx} height={VH} fill="transparent" style={{ cursor: "pointer" }}
            onClick={e => { const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e); onHit("compression", pt.x, pt.y); }}
            onTouchEnd={e => { e.preventDefault(); const pt = svgPoint(e.currentTarget.ownerSVGElement as SVGSVGElement, e as unknown as React.TouchEvent); onHit("compression", pt.x, pt.y); }}
          />
          {/* Right = convex = tension = WRONG */}
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
    const correct = zone === "compression";
    setCutX(px); setCutY(py);
    setPhase(correct ? "success" : "pinched");
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    if (correct) playChainsawCut(); else playPinchError();
  }, [phase]);

  const reset = () => { setPhase("ready"); setCutX(null); setCutY(null); };
  const nextScenario = () => { setScenarioId(ORDER[(ORDER.indexOf(scenarioId) + 1) % ORDER.length]); reset(); };

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
            <button key={sid} onClick={() => { setScenarioId(sid); reset(); }}
              className={`px-2 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-colors border leading-tight ${
                scenarioId === sid
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}>
              {sid === "sag" && "Two\nSupports"}
              {sid === "hog" && "Cantilever\nOver Bank"}
              {sid === "sidebend" && "Side\nBow"}
            </button>
          ))}
        </div>

        {/* Tagline */}
        <p className="text-center text-xs font-mono text-muted-foreground">{scenario.tagline}</p>

        {/* Instruction / result banner */}
        <div className={`rounded-md px-3 py-2 text-center text-xs font-black uppercase tracking-widest transition-colors ${
          phase === "ready" ? "bg-amber-500/10 text-amber-600 border border-amber-500/30" :
          phase === "success" ? "bg-green-500/10 text-green-600 border border-green-500/30" :
          "bg-red-500/10 text-red-600 border border-red-500/30"
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
          <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{ display: "block", touchAction: "none" }}>
            {scenarioId === "sag" && <SagScene {...sceneProps} />}
            {scenarioId === "hog" && <HogScene {...sceneProps} />}
            {scenarioId === "sidebend" && <SidebendScene {...sceneProps} />}

            {/* Legend */}
            <g>
              <rect x="8" y={VH - 22} width="10" height="10" rx="2" fill="#ef4444" opacity="0.8" />
              <text x="22" y={VH - 13} fontSize="8" fontFamily="monospace" fill="#ef4444" fontWeight="700"
                stroke="rgba(0,0,0,0.4)" strokeWidth="2" paintOrder="stroke">Compression</text>
              <rect x="112" y={VH - 22} width="10" height="10" rx="2" fill="#3b82f6" opacity="0.8" />
              <text x="126" y={VH - 13} fontSize="8" fontFamily="monospace" fill="#3b82f6" fontWeight="700"
                stroke="rgba(0,0,0,0.4)" strokeWidth="2" paintOrder="stroke">Tension</text>
              <line x1="212" y1={VH - 17} x2="228" y2={VH - 17} stroke="#fff" strokeWidth="1" strokeDasharray="5,3" opacity="0.5" />
              <text x="232" y={VH - 13} fontSize="8" fontFamily="monospace" fill="#9ca3af" fontWeight="700">Neutral axis</text>
            </g>
          </svg>
        </div>

        {/* Explanation after attempt */}
        {phase !== "ready" && (
          <div className="rounded-lg border border-border bg-card/60 px-4 py-3 space-y-3">
            <p className="text-xs font-mono text-foreground leading-relaxed">{scenario.explanation}</p>
            <div className="flex gap-2">
              <button onClick={reset}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-md text-xs font-black uppercase tracking-widest hover:bg-accent transition-colors">
                <RotateCcw className="w-3 h-3" /> Try Again
              </button>
              <button onClick={nextScenario}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-colors">
                Next Scenario →
              </button>
            </div>
          </div>
        )}

        {/* Score */}
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

        {/* Golden rule */}
        <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">The Method — Always</p>
          <p className="text-xs font-mono text-foreground leading-relaxed">
            1. Identify the <span className="text-red-500 font-bold">compression zone</span> (red).{" "}
            2. Make your FIRST cut there — <span className="font-bold">20–30% of the log's diameter only</span>.{" "}
            3. Complete the cut from the <span className="text-blue-500 font-bold">tension side</span> (blue).{" "}
            Cutting the tension side first risks violent splitting. Cutting too deep on the compression side pinches your bar.
          </p>
        </div>
      </main>
    </div>
  );
}
