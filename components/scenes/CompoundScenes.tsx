"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LaunchOutcome } from "@/types/simulation";
import type { SceneParams } from "@/lib/physics/builder";
import {
  clamp,
  fmt,
  SceneActions,
  GuidedBreakdown,
  InfoPanels,
  SCENE_W,
  SCENE_H,
} from "@/components/scenes/_shared";

// ─── Constants ────────────────────────────────────────────────────────────────

const PULLEY_R = 26;
// MASS_H / 2 exactly equals PULLEY_R ensuring perfectly parallel ropes.
const MASS_W = 40; 
const MASS_H = 52; 
const G = 9.8;
const M_PX = 60;

type V2 = { x: number; y: number };

// ─── Shared SVG primitives ────────────────────────────────────────────────────

function Wheel({ cx, cy, angle, gradId }: { cx: number; cy: number; angle: number; gradId: string }) {
  return (
    <g>
      <circle cx={cx + 2} cy={cy + 2} r={PULLEY_R} fill="rgba(0,0,0,0.06)" />
      <circle cx={cx} cy={cy} r={PULLEY_R} fill={`url(#${gradId})`} stroke="#f59e0b" strokeWidth={2.5} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = angle + (i * Math.PI * 2) / 8;
        return (
          <line key={i}
            x1={cx} y1={cy}
            x2={cx + (PULLEY_R - 4) * Math.cos(a)}
            y2={cy + (PULLEY_R - 4) * Math.sin(a)}
            stroke="#b45309" strokeWidth={1.5} strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={PULLEY_R} fill="none" stroke="#f59e0b" strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={PULLEY_R - 4} fill="none" stroke="#fbbf24" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
      <circle cx={cx} cy={cy} r={5} fill="#fcd34d" />
      <circle cx={cx} cy={cy} r={2.5} fill="#b45309" />
    </g>
  );
}

function Rope({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" />;
}

function Block({ cx, cy, rot, label }: { cx: number; cy: number; rot?: number; label: string }) {
  const t = rot ? `translate(${cx},${cy}) rotate(${rot})` : `translate(${cx},${cy})`;
  return (
    <g transform={t}>
      <rect 
        x={-MASS_W / 2} y={-MASS_H / 2} 
        width={MASS_W} height={MASS_H} rx={4} 
        fill="#216869" stroke="#0d9488" strokeWidth={1.5} 
      />
      <text x={0} y={4} textAnchor="middle" fontSize={10} fill="#f8fafc" fontWeight="bold">{label}</text>
    </g>
  );
}

function Ramp({ angleDeg, tipX, tipY, dir, len = 230 }: {
  angleDeg: number; tipX: number; tipY: number; dir: "left" | "right"; len?: number;
}) {
  const r = (angleDeg * Math.PI) / 180;
  const s = dir === "left" ? -1 : 1;
  const ex = tipX + s * len * Math.cos(r);
  const ey = tipY + len * Math.sin(r);
  return (
    <g>
      <polygon points={`${tipX},${tipY} ${ex},${ey} ${tipX},${ey}`}
        fill="rgba(33,104,105,0.1)" stroke="#334155" strokeWidth={2} />
      <line
        x1={Math.min(tipX, ex) - 40} y1={ey}
        x2={Math.max(tipX, ex) + 40} y2={ey}
        stroke="#334155" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

function Ceiling({ cx, py }: { cx: number; py: number }) {
  return (
    <g>
      <rect x={cx - 70} y={0} width={140} height={14} rx={3} fill="#475569" />
      <rect x={cx - 5} y={14} width={10} height={Math.max(0, py - PULLEY_R - 14)} rx={2} fill="#334155" />
    </g>
  );
}

function Spring({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const COILS = 7; const AMP = 9;
  const t0 = 0.1; const t1 = 0.9;
  const ix = (t: number) => x1 + (x2 - x1) * t;
  const iy = (t: number) => y1 + (y2 - y1) * t;
  const pts: string[] = [`${x1},${y1}`, `${ix(t0)},${iy(t0)}`];
  for (let i = 1; i <= COILS * 2; i++) {
    const t = t0 + (t1 - t0) * (i / (COILS * 2));
    pts.push(`${ix(t)},${iy(t) + (i % 2 === 0 ? AMP : -AMP)}`);
  }
  pts.push(`${ix(t1)},${iy(t1)}`, `${x2},${y2}`);
  return <polyline points={pts.join(" ")} fill="none" stroke="#dc2626" strokeWidth={2} strokeLinejoin="round" />;
}

// Emboldened Arrow Component
function Arrow({ x, y, dx, dy, color, label, marker, maxLen }: {
  x: number; y: number; dx: number; dy: number; color: string; label: string; marker: string;
  maxLen?: number;
}) {
  const MAX = maxLen ?? 65;
  const rawLen = Math.sqrt(dx * dx + dy * dy);
  if (rawLen < 4) return null;
  const scale = Math.min(1, MAX / rawLen);
  const sDx = dx * scale;
  const sDy = dy * scale;
  const ux = sDx / (rawLen * scale);
  const uy = sDy / (rawLen * scale);

  return (
    <g>
      <line x1={x} y1={y} x2={x + sDx} y2={y + sDy}
        stroke={color} strokeWidth={3} strokeLinecap="round" markerEnd={`url(#${marker})`} />
      <text x={x + sDx + ux * 12} y={y + sDy + uy * 12 + 4} textAnchor="middle" fontSize={11} fill={color} fontWeight="bold">{label}</text>
    </g>
  );
}

// Shrunk marker sizes for appropriately scaled arrowheads (Dark Mode Colors)
function SceneDefs({ gradId, prefix }: { gradId: string; prefix: string }) {
  return (
    <defs>
      <pattern id={`${prefix}grid`} width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#dce8e2" strokeWidth="1" />
      </pattern>
      <radialGradient id={gradId} cx="40%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#fef9ee" />
        <stop offset="100%" stopColor="#fde68a" />
      </radialGradient>
      
      {/* Smaller Arrowhead Markers (Dark mode palette) */}
      <marker id={`${prefix}red`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#f87171" />
      </marker>
      <marker id={`${prefix}blue`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#60a5fa" />
      </marker>
      <marker id={`${prefix}green`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#34d399" />
      </marker>
      <marker id={`${prefix}purple`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#c084fc" />
      </marker>
    </defs>
  );
}

// ─── Ramp-Atwood Scene ────────────────────────────────────────────────────────

const RA_PULLEY: V2 = { x: 430, y: 110 };
const RA_RAMP_LEN = 240;
const RA_INIT_DIST = 155;
const RA_HANG_DY = 115;
const RA_TIME = 0.4;
const AS = 4.2; // Base scale factor

const RA_MAX_S = RA_INIT_DIST - 15; 
const RA_MIN_S = RA_INIT_DIST - (RA_RAMP_LEN - 15); 

const RA_STEPS = [
  {
    title: "Free-Body Diagrams",
    equation: "T − m₁g sinθ − f = m₁a  |  m₂g − T = m₂a",
    notice: "Both bodies share the same rope tension T and the same acceleration magnitude a. The hanging mass drives the system.",
    diagram: "Green = tension, red = gravity component, blue = normal, purple = friction.",
  },
  {
    title: "Solve for Acceleration",
    equation: "a = (m₂g − m₁g sinθ − μm₁g cosθ) / (m₁ + m₂)",
    notice: "Add the two equations to eliminate T. a > 0 means m₂ falls and m₁ climbs the ramp.",
    diagram: "The amber wheel redirects the rope — it doesn't change the rope speed.",
  },
  {
    title: "Kinematics",
    equation: "s = ½at²    v = at",
    notice: "Both blocks travel the same arc length s along their respective paths.",
    diagram: "Watch displacement grow quadratically. The wheel spins as rope feeds through.",
  },
];

export function RampAtwoodScene({ params, onOutcome, label = "Ramp-Atwood Machine" }: {
  params: SceneParams; onOutcome: (o: LaunchOutcome) => void; label?: string;
}) {
  const { m1, m2, angle1 = 30, mu1 = 0 } = params;
  const θ = (angle1 * Math.PI) / 180;
  
  const fDrive = m2 * G - m1 * G * Math.sin(θ);
  const fFricMax = mu1 * m1 * G * Math.cos(θ);
  
  let a = 0;
  let fricMag = 0;
  let fricPointsDownRamp = true;

  if (Math.abs(fDrive) <= fFricMax) {
    a = 0;
    fricMag = Math.abs(fDrive);
    fricPointsDownRamp = fDrive > 0;
  } else if (fDrive > 0) {
    a = (fDrive - fFricMax) / (m1 + m2);
    fricMag = fFricMax;
    fricPointsDownRamp = true;
  } else {
    a = (fDrive + fFricMax) / (m1 + m2);
    fricMag = fFricMax;
    fricPointsDownRamp = false;
  }

  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(1);
  const tRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null; lastRef.current = null; tRef.current = 0;
    setT(0); setRunning(false);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const run = useCallback(() => {
    if (running) return;
    setRunning(true);
    lastRef.current = null;
    function loop(ts: number) {
      if (!lastRef.current) lastRef.current = ts;
      tRef.current += ((ts - lastRef.current) / 1000) * RA_TIME;
      lastRef.current = ts;
      
      const current_s = 0.5 * a * tRef.current * tRef.current * M_PX;
      
      if (current_s <= RA_MIN_S || current_s >= RA_MAX_S) {
        setRunning(false);
        onOutcome({ launched: true, success: true, metrics: { acceleration: a } });
        return;
      }
      setT(tRef.current);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [running, a, onOutcome]);

  const s_px = clamp(0.5 * a * t * t * M_PX, RA_MIN_S, RA_MAX_S);
  const rampDist = RA_INIT_DIST - s_px; 
  
  const nx = -Math.sin(θ);
  const ny = -Math.cos(θ);
  
  const bx = RA_PULLEY.x - rampDist * Math.cos(θ) + nx * (MASS_H / 2);
  const by = RA_PULLEY.y + rampDist * Math.sin(θ) + ny * (MASS_H / 2);
  
  const f1x = bx - nx * (MASS_H / 2);
  const f1y = by - ny * (MASS_H / 2);

  const hx = RA_PULLEY.x + PULLEY_R;
  const hy = RA_PULLEY.y + RA_HANG_DY + s_px;
  const wheelAngle = s_px / PULLEY_R;

  const tanX = RA_PULLEY.x - Math.sin(θ) * PULLEY_R;
  const tanY = RA_PULLEY.y - Math.cos(θ) * PULLEY_R;
  
  const rAttach: V2 = { x: bx + Math.cos(θ) * (MASS_W / 2), y: by - Math.sin(θ) * (MASS_W / 2) };
  const hAttach: V2 = { x: hx, y: hy - MASS_H / 2 };

  const cosT = Math.cos(θ); const sinT = Math.sin(θ);
  const downRamp: V2 = { x: -cosT, y: sinT };
  const upRamp: V2 = { x: cosT, y: -sinT };
  const normal: V2 = { x: -sinT, y: -cosT };
  
  const fricDir = fricPointsDownRamp ? downRamp : upRamp;
  const gSin = m1 * G * Math.sin(θ) * AS;
  const gCos = m1 * G * Math.cos(θ) * AS;
  const fric = fricMag * AS;
  const ten = m2 * (G - a) * AS; 

  const spd = Math.abs(a * t);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="w-full" aria-label={label}>
          <SceneDefs gradId="ra-wg" prefix="ra-" />
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />
          <rect width={SCENE_W} height={SCENE_H} fill="url(#ra-grid)" />

          <Ramp angleDeg={angle1} tipX={RA_PULLEY.x} tipY={RA_PULLEY.y} dir="left" len={RA_RAMP_LEN} />
          <Ceiling cx={RA_PULLEY.x} py={RA_PULLEY.y} />

          <Rope x1={rAttach.x} y1={rAttach.y} x2={tanX} y2={tanY} />
          <Rope x1={hx} y1={RA_PULLEY.y} x2={hx} y2={hAttach.y} />

          <Wheel cx={RA_PULLEY.x} cy={RA_PULLEY.y} angle={wheelAngle} gradId="ra-wg" />

          {/* Arrows ordered BEFORE blocks so they render underneath */}
          <Arrow x={bx} y={by} dx={downRamp.x * gSin} dy={downRamp.y * gSin} color="#f87171" label="m₁g sinθ" marker="ra-red" />
          <Arrow x={bx} y={by} dx={normal.x * gCos} dy={normal.y * gCos} color="#60a5fa" label="N" marker="ra-blue" />
          <Arrow x={bx} y={by} dx={upRamp.x * ten} dy={upRamp.y * ten} color="#34d399" label="T" marker="ra-green" />
          {mu1 > 0 && <Arrow x={f1x} y={f1y} dx={fricDir.x * fric} dy={fricDir.y * fric} color="#c084fc" label="f" marker="ra-purple" />}
          
          <Arrow x={hx} y={hy} dx={0} dy={m2 * G * AS} color="#f87171" label="m₂g" marker="ra-red" />
          <Arrow x={hx} y={hy} dx={0} dy={-ten} color="#34d399" label="T" marker="ra-green" />

          <Block cx={bx} cy={by} rot={-angle1} label={`${fmt(m1, 1)} kg`} />
          <Block cx={hx} cy={hy} label={`${fmt(m2, 1)} kg`} />

          <text x={12} y={24} fontSize={13} fill="#172033" fontWeight="700">{label}</text>
          <text x={12} y={42} fontSize={12} fill="#216869" fontWeight="600">
            {a === 0 ? "Equilibrium" : `a = ${fmt(Math.abs(a), 2)} m/s² — ${a > 0 ? "m₂ falls, m₁ climbs" : "m₁ slides down"}`}
          </text>
        </svg>
      </div>

      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Run Simulation" runningLabel="Simulating…" />
      <GuidedBreakdown step={step} steps={RA_STEPS} onStepChange={setStep} />
      <InfoPanels
        given={[
          ["m₁", `${fmt(m1, 1)} kg`],
          ["m₂", `${fmt(m2, 1)} kg`],
          ["θ", `${angle1}°`],
          ["μₖ", `${fmt(mu1, 2)}`],
        ]}
        equations={[
          "a = (m₂g − m₁g sinθ − μm₁g cosθ) / (m₁+m₂)",
          `a = ${fmt(a, 3)} m/s²`,
          "s = ½at²,  v = at",
        ]}
        results={[
          ["Acceleration", `${fmt(Math.abs(a), 3)} m/s²`, "green"],
          ["Direction", a > 0 ? "m₂ falls, m₁ climbs" : a < 0 ? "m₁ slides down" : "Equilibrium"],
          ["Speed", `${fmt(spd, 2)} m/s`],
        ]}
      />
    </div>
  );
}

// ─── Double Ramp Scene ────────────────────────────────────────────────────────

const DR_PULLEY: V2 = { x: 380, y: 110 };
const DR_RAMP_LEN = 230;
const DR_INIT_DIST = 150;
const DR_TIME = 0.4;

const DR_MAX_S = 65;

const DR_STEPS = [
  {
    title: "Free-Body Diagrams",
    equation: "m₁g sinθ₁ − μ₁m₁g cosθ₁ − T = m₁a  |  T − m₂g sinθ₂ − μ₂m₂g cosθ₂ = m₂a",
    notice: "Both ramp blocks share the same tension T and magnitude of acceleration a.",
    diagram: "Red = gravity component along ramp, green = tension, blue = normal, purple = friction.",
  },
  {
    title: "Solve for Acceleration",
    equation: "a = g(m₁sinθ₁ − μ₁m₁cosθ₁ − m₂sinθ₂ − μ₂m₂cosθ₂) / (m₁+m₂)",
    notice: "a > 0 means m₁ slides down the left ramp while m₂ climbs the right ramp.",
    diagram: "The pulley reverses the rope — when m₁ descends, m₂ ascends by the same distance.",
  },
  {
    title: "Kinematics",
    equation: "s = ½at²    v = at",
    notice: "Both blocks travel the same arc length. The winner is determined by the net ramp forces.",
    diagram: "Watch the wheel spin — its angle tracks rope displacement directly.",
  },
];

export function DoubleRampScene({ params, onOutcome, label = "Double Ramp Atwood" }: {
  params: SceneParams; onOutcome: (o: LaunchOutcome) => void; label?: string;
}) {
  const { m1, m2, angle1 = 40, angle2 = 20, mu1 = 0, mu2 = 0 } = params;
  const θ1 = (angle1 * Math.PI) / 180;
  const θ2 = (angle2 * Math.PI) / 180;
  
  const fDrive = m1 * G * Math.sin(θ1) - m2 * G * Math.sin(θ2);
  const fFricMax = mu1 * m1 * G * Math.cos(θ1) + mu2 * m2 * G * Math.cos(θ2);
  
  let a = 0;
  if (Math.abs(fDrive) <= fFricMax) {
    a = 0; 
  } else if (fDrive > 0) {
    a = (fDrive - fFricMax) / (m1 + m2); 
  } else {
    a = (fDrive + fFricMax) / (m1 + m2); 
  }

  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(1);
  const tRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null; lastRef.current = null; tRef.current = 0;
    setT(0); setRunning(false);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const run = useCallback(() => {
    if (running) return;
    setRunning(true);
    lastRef.current = null;
    function loop(ts: number) {
      if (!lastRef.current) lastRef.current = ts;
      tRef.current += ((ts - lastRef.current) / 1000) * DR_TIME;
      lastRef.current = ts;
      
      const current_s = 0.5 * a * tRef.current * tRef.current * M_PX;
      if (Math.abs(current_s) >= DR_MAX_S) {
        setRunning(false);
        onOutcome({ launched: true, success: true, metrics: { acceleration: a } });
        return;
      }
      setT(tRef.current);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [running, a, onOutcome]);

  const s_px = clamp(0.5 * a * t * t * M_PX, -DR_MAX_S, DR_MAX_S);
  const dist1 = DR_INIT_DIST + s_px;
  const dist2 = DR_INIT_DIST - s_px;
  
  const nx1 = -Math.sin(θ1);
  const ny1 = -Math.cos(θ1);
  const bx1 = DR_PULLEY.x - dist1 * Math.cos(θ1) + nx1 * (MASS_H / 2);
  const by1 = DR_PULLEY.y + dist1 * Math.sin(θ1) + ny1 * (MASS_H / 2);
  
  const nx2 = Math.sin(θ2);
  const ny2 = -Math.cos(θ2);
  const bx2 = DR_PULLEY.x + dist2 * Math.cos(θ2) + nx2 * (MASS_H / 2);
  const by2 = DR_PULLEY.y + dist2 * Math.sin(θ2) + ny2 * (MASS_H / 2);

  const f1x = bx1 - nx1 * (MASS_H / 2);
  const f1y = by1 - ny1 * (MASS_H / 2);
  const f2x = bx2 - nx2 * (MASS_H / 2);
  const f2y = by2 - ny2 * (MASS_H / 2);

  const wheelAngle = s_px / PULLEY_R;

  const tanX1 = DR_PULLEY.x - Math.sin(θ1) * PULLEY_R;
  const tanY1 = DR_PULLEY.y - Math.cos(θ1) * PULLEY_R;
  const att1: V2 = { x: bx1 + Math.cos(θ1) * (MASS_W / 2), y: by1 - Math.sin(θ1) * (MASS_W / 2) };
  
  const tanX2 = DR_PULLEY.x + Math.sin(θ2) * PULLEY_R;
  const tanY2 = DR_PULLEY.y - Math.cos(θ2) * PULLEY_R;
  const att2: V2 = { x: bx2 - Math.cos(θ2) * (MASS_W / 2), y: by2 - Math.sin(θ2) * (MASS_W / 2) };

  const gSin1 = m1 * G * Math.sin(θ1) * AS;
  const gSin2 = m2 * G * Math.sin(θ2) * AS;
  const ten = m1 * (G * Math.sin(θ1) - a) * AS; 
  
  const dn1: V2 = { x: -Math.cos(θ1), y: Math.sin(θ1) };
  const up1: V2 = { x: Math.cos(θ1), y: -Math.sin(θ1) };
  const dn2: V2 = { x: Math.cos(θ2), y: Math.sin(θ2) };
  const up2: V2 = { x: -Math.cos(θ2), y: -Math.sin(θ2) };

  const fric1 = mu1 * m1 * G * Math.cos(θ1) * AS;
  const fric2 = mu2 * m2 * G * Math.cos(θ2) * AS;
  const spd = Math.abs(a * t);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="w-full" aria-label={label}>
          <SceneDefs gradId="dr-wg" prefix="dr-" />
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />
          <rect width={SCENE_W} height={SCENE_H} fill="url(#dr-grid)" />

          <Ramp angleDeg={angle1} tipX={DR_PULLEY.x} tipY={DR_PULLEY.y} dir="left" len={DR_RAMP_LEN} />
          <Ramp angleDeg={angle2} tipX={DR_PULLEY.x} tipY={DR_PULLEY.y} dir="right" len={DR_RAMP_LEN} />
          <Ceiling cx={DR_PULLEY.x} py={DR_PULLEY.y} />

          <Rope x1={att1.x} y1={att1.y} x2={tanX1} y2={tanY1} />
          <Rope x1={att2.x} y1={att2.y} x2={tanX2} y2={tanY2} />

          <Wheel cx={DR_PULLEY.x} cy={DR_PULLEY.y} angle={wheelAngle} gradId="dr-wg" />

          {/* Arrows ordered BEFORE blocks so they render underneath */}
          <Arrow x={bx1} y={by1} dx={dn1.x * gSin1} dy={dn1.y * gSin1} color="#f87171" label="m₁g sinθ" marker="dr-red" />
          <Arrow x={bx1} y={by1} dx={up1.x * ten} dy={up1.y * ten} color="#34d399" label="T" marker="dr-green" />
          {mu1 > 0 && a !== 0 && (
            <Arrow x={f1x} y={f1y} dx={(a > 0 ? up1.x : dn1.x) * fric1} dy={(a > 0 ? up1.y : dn1.y) * fric1} color="#c084fc" label="f₁" marker="dr-purple" />
          )}

          <Arrow x={bx2} y={by2} dx={dn2.x * gSin2} dy={dn2.y * gSin2} color="#f87171" label="m₂g sinθ" marker="dr-red" />
          <Arrow x={bx2} y={by2} dx={up2.x * ten} dy={up2.y * ten} color="#34d399" label="T" marker="dr-green" />
          {mu2 > 0 && a !== 0 && (
            <Arrow x={f2x} y={f2y} dx={(a < 0 ? up2.x : dn2.x) * fric2} dy={(a < 0 ? up2.y : dn2.y) * fric2} color="#c084fc" label="f₂" marker="dr-purple" />
          )}

          <Block cx={bx1} cy={by1} rot={-angle1} label={`${fmt(m1, 1)} kg`} />
          <Block cx={bx2} cy={by2} rot={angle2} label={`${fmt(m2, 1)} kg`} />

          <text x={12} y={24} fontSize={13} fill="#172033" fontWeight="700">{label}</text>
          <text x={12} y={42} fontSize={12} fill="#216869" fontWeight="600">
            {a === 0 ? "Equilibrium" : `a = ${fmt(Math.abs(a), 2)} m/s² — ${a > 0 ? "m₁ slides down" : "m₂ slides down"}`}
          </text>
        </svg>
      </div>

      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Run Simulation" runningLabel="Simulating…" />
      <GuidedBreakdown step={step} steps={DR_STEPS} onStepChange={setStep} />
      <InfoPanels
        given={[
          ["m₁", `${fmt(m1, 1)} kg`],
          ["m₂", `${fmt(m2, 1)} kg`],
          ["θ₁", `${angle1}°`],
          ["θ₂", `${angle2}°`],
          ["μ₁", `${fmt(mu1, 2)}`],
          ["μ₂", `${fmt(mu2, 2)}`],
        ]}
        equations={[
          "a = g(m₁sinθ₁ − μ₁m₁cosθ₁ − m₂sinθ₂ − μ₂m₂cosθ₂) / (m₁+m₂)",
          `a = ${fmt(a, 3)} m/s²`,
          "s = ½at²,  v = at",
        ]}
        results={[
          ["Acceleration", `${fmt(Math.abs(a), 3)} m/s²`, "green"],
          ["Winner", a > 0 ? "m₁ (heavier/steeper)" : a < 0 ? "m₂ (heavier/steeper)" : "Tie"],
          ["Speed", `${fmt(spd, 2)} m/s`],
        ]}
      />
    </div>
  );
}

// ─── Spring-Atwood Scene ──────────────────────────────────────────────────────

const SA_SURFACE_Y = 200;
const SA_PULLEY: V2 = { x: 540, y: SA_SURFACE_Y };
const SA_WALL_X = 12;
const SA_EQ_X = 300; 
const SA_AMP = 38; 
const SA_TIME = 0.55;

const SA_STEPS = [
  {
    title: "Equilibrium",
    equation: "k · x_eq = m₂g    →    x_eq = x₀ + m₂g/k",
    notice: "At rest the spring force equals the hanging weight transmitted through the rope.",
    diagram: "Block center sits at x_eq. Spring is stretched beyond its rest length.",
  },
  {
    title: "Simple Harmonic Motion",
    equation: "ω = √(k / (m₁+m₂))    T = 2π/ω",
    notice: "Displacing the block from equilibrium starts SHM. Both masses oscillate with the same period.",
    diagram: "When block moves right, hang block drops by the same amount — rope is inextensible.",
  },
  {
    title: "Energy Exchange",
    equation: "E = ½(m₁+m₂)v² + ½k(x−x_eq)²  (constant)",
    notice: "Kinetic and spring potential energy exchange continuously. Gravitational PE is absorbed into the equilibrium offset.",
    diagram: "Maximum speed at equilibrium; maximum spring deformation at the turning points.",
  },
];

export function SpringAtwoodScene({ params, onOutcome, label = "Spring-Atwood Machine" }: {
  params: SceneParams; onOutcome: (o: LaunchOutcome) => void; label?: string;
}) {
  const { m1, m2, springK = 40, springRestLength = 0.5 } = params;
  const k = springK;
  const omega = Math.sqrt(k / (m1 + m2));
  const period = (2 * Math.PI) / omega;
  const xEq_m = springRestLength + (m2 * G) / k; 

  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(1);
  const tRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const cyclesRef = useRef(0);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null; lastRef.current = null; tRef.current = 0; cyclesRef.current = 0;
    setT(0); setRunning(false);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const run = useCallback(() => {
    if (running) return;
    setRunning(true);
    lastRef.current = null;
    function loop(ts: number) {
      if (!lastRef.current) lastRef.current = ts;
      tRef.current += ((ts - lastRef.current) / 1000) * SA_TIME;
      lastRef.current = ts;
      cyclesRef.current = tRef.current * omega / (2 * Math.PI);
      if (cyclesRef.current >= 4) {
        setRunning(false);
        onOutcome({ launched: true, success: true, metrics: { omega, period } });
        return;
      }
      setT(tRef.current);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [running, omega, period, onOutcome]);

  const d = SA_AMP * Math.cos(omega * t);
  const blockX = SA_EQ_X + d;
  const blockY = SA_SURFACE_Y;

  const hangX = SA_PULLEY.x + PULLEY_R;
  const hangY = SA_PULLEY.y + PULLEY_R + 15 + SA_AMP + d;
  const wheelAngle = (SA_AMP + d) / PULLEY_R;

  const springEndX = blockX - MASS_W / 2;

  const ropeH_x1 = blockX + MASS_W / 2;
  const ropeH_x2 = SA_PULLEY.x - PULLEY_R;
  const ropeV_y1 = SA_PULLEY.y; 
  const ropeV_y2 = hangY - MASS_H / 2;

  const velocity = (SA_AMP / M_PX) * omega * Math.abs(Math.sin(omega * t)); 
  const cycles = tRef.current * omega / (2 * Math.PI);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="w-full" aria-label={label}>
          <SceneDefs gradId="sa-wg" prefix="sa-" />
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />
          <rect width={SCENE_W} height={SCENE_H} fill="url(#sa-grid)" />

          <line x1={0} y1={SA_SURFACE_Y} x2={SA_PULLEY.x + PULLEY_R + 10} y2={SA_SURFACE_Y}
            stroke="#475569" strokeWidth={3} strokeLinecap="round" />
          <line x1={SA_PULLEY.x + PULLEY_R + 10} y1={SA_SURFACE_Y}
            x2={SA_PULLEY.x + PULLEY_R + 10} y2={SCENE_H}
            stroke="#475569" strokeWidth={3} strokeLinecap="round" />
          <rect x={SA_PULLEY.x + PULLEY_R - 4} y={SA_PULLEY.y - 10} width={18} height={20} rx={3} fill="#475569" />

          <rect x={0} y={0} width={12} height={SA_SURFACE_Y} fill="#94a3b8" />
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1={12} y1={i * 24 + 10} x2={22} y2={i * 24 + 22} stroke="#64748b" strokeWidth={1} />
          ))}

          <Spring x1={SA_WALL_X} y1={SA_SURFACE_Y} x2={springEndX} y2={SA_SURFACE_Y} />

          <Rope x1={ropeH_x1} y1={SA_SURFACE_Y} x2={ropeH_x2} y2={SA_SURFACE_Y} />
          <Rope x1={hangX} y1={ropeV_y1} x2={hangX} y2={ropeV_y2} />

          <Wheel cx={SA_PULLEY.x} cy={SA_PULLEY.y} angle={wheelAngle} gradId="sa-wg" />

          {/* Arrows ordered BEFORE blocks so they render underneath */}
          <Arrow x={blockX} y={blockY} dx={-(d > 0 ? 1 : -1) * Math.min(Math.abs(d) * 1.2, 50)} dy={0}
            color="#f87171" label="Fₛ" marker="sa-red" />
          <Arrow x={hangX} y={hangY} dx={0} dy={-m2 * G * AS * 0.8} color="#34d399" label="T" marker="sa-green" />
          <Arrow x={hangX} y={hangY} dx={0} dy={m2 * G * AS * 0.8} color="#f87171" label="m₂g" marker="sa-red" />

          <Block cx={blockX} cy={blockY} label={`${fmt(m1, 1)} kg`} />
          <Block cx={hangX} cy={hangY} label={`${fmt(m2, 1)} kg`} />

          <line x1={SA_EQ_X} y1={SA_SURFACE_Y - 30} x2={SA_EQ_X} y2={SA_SURFACE_Y + 30}
            stroke="#64748b" strokeWidth={1} strokeDasharray="4,3" />
          <text x={SA_EQ_X} y={SA_SURFACE_Y - 34} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight="600">x_eq</text>

          <text x={12} y={24} fontSize={13} fill="#172033" fontWeight="700">{label}</text>
          <text x={12} y={42} fontSize={12} fill="#216869" fontWeight="600">
            ω = {fmt(omega, 2)} rad/s  ·  T = {fmt(period, 2)} s
          </text>
        </svg>
      </div>

      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Start Oscillation" runningLabel="Oscillating…" />
      <GuidedBreakdown step={step} steps={SA_STEPS} onStepChange={setStep} />
      <InfoPanels
        given={[
          ["m₁", `${fmt(m1, 1)} kg`],
          ["m₂", `${fmt(m2, 1)} kg`],
          ["k", `${fmt(k, 1)} N/m`],
          ["x₀", `${fmt(springRestLength, 2)} m`],
        ]}
        equations={[
          `ω = √(k/(m₁+m₂)) = ${fmt(omega, 3)} rad/s`,
          `T = 2π/ω = ${fmt(period, 3)} s`,
          `x_eq = x₀ + m₂g/k = ${fmt(xEq_m, 3)} m`,
        ]}
        results={[
          ["Angular freq ω", `${fmt(omega, 3)} rad/s`, "green"],
          ["Period T", `${fmt(period, 3)} s`],
          ["Cycles", `${fmt(cycles, 1)}`],
          ["Velocity", `${fmt(Math.abs(velocity), 2)} m/s`],
        ]}
      />
    </div>
  );
}