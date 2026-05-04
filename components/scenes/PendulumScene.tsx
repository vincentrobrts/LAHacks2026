"use client";

import { RotateCcw, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

type Props = {
  config: SimulationConfig;
  onOutcome: (outcome: LaunchOutcome) => void;
};

const WIDTH = 760;
const HEIGHT = 520;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fmt(value: number | null, digits = 2) {
  return value === null || Number.isNaN(value) ? "--" : value.toFixed(digits);
}

function pendulumMetrics(config: SimulationConfig) {
  const lengthInput = clamp(config.params.length ?? 150, 0.2, 250);
  const initialAngle = clamp(config.params.initial_angle ?? 45, 5, 80);
  const mass = clamp(config.params.mass ?? 1, 0.5, 5);
  const gravity = clamp(config.world.gravity, 1, 20);
  const L_m = lengthInput > 10 ? lengthInput / 50 : lengthInput;
  const theta0 = (initialAngle * Math.PI) / 180;
  const period = 2 * Math.PI * Math.sqrt(L_m / gravity);
  const omega = (2 * Math.PI) / period;
  const maxSpeed = Math.sqrt(2 * gravity * L_m * (1 - Math.cos(theta0)));
  const maxHeight = L_m * (1 - Math.cos(theta0));
  return { lengthInput, initialAngle, mass, gravity, L_m, theta0, period, omega, maxSpeed, maxHeight };
}

export default function PendulumScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => pendulumMetrics(config), [config]);
  const [angle, setAngle] = useState(metrics.theta0);
  const [running, setRunning] = useState(false);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const pivotX = WIDTH / 2; const pivotY = 72;
  const armPx = clamp(55 + metrics.L_m * 55, 66, 330);
  const bobX = pivotX + Math.sin(angle) * armPx;
  const bobY = pivotY + Math.cos(angle) * armPx;
  const arcR = Math.min(armPx * 0.55, 100);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setAngle(metrics.theta0);
    setRunning(false);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.theta0, metrics.omega, metrics.period, metrics.L_m, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = performance.now();
    setRunning(true);
    const tick = (now: number) => {
      const t = (now - startRef.current) / 1000;
      setAngle(metrics.theta0 * Math.cos(metrics.omega * t));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { period_s: metrics.period, max_speed_m_s: metrics.maxSpeed, max_height_m: metrics.maxHeight } });
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setAngle(metrics.theta0);
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const stepCopy = [
    { title: "Pendulum Setup", equation: `L = ${fmt(metrics.L_m, 2)} m,  m = ${fmt(metrics.mass, 1)} kg,  θ₀ = ${metrics.initialAngle}°`, notice: "Only the string length and initial angle (and gravity) determine the period — not the mass.", diagram: "The pendulum starts at angle θ₀ from vertical. The arm length L is shown to scale." },
    { title: "Forces on the Bob", equation: "T − mg cosθ = mv²/L  (radial),  mg sinθ = maₜ  (tangential)", notice: "Tension provides centripetal force. The tangential component of gravity drives the restoring acceleration.", diagram: "Tension arrow points up the string toward the pivot; gravity arrow points straight down." },
    { title: "SHM Approximation", equation: `ω = √(g/L) = ${fmt(metrics.omega, 3)} rad/s,  T = 2π/ω = ${fmt(metrics.period, 3)} s`, notice: "For small angles (< ~15°) the motion is simple harmonic. For larger angles the period increases slightly.", diagram: "The angle arc shows θ₀. Notice period depends only on L and g, not mass." },
    { title: "Oscillation", equation: `θ(t) = θ₀ cos(ωt),  v_max = ${fmt(metrics.maxSpeed, 2)} m/s`, notice: `Max speed occurs at the bottom. The bob gains ${fmt(metrics.maxHeight, 3)} m of kinetic energy converting from potential energy.`, diagram: "Watch the bob swing continuously. The period remains constant for a given L and g." },
  ][guidedStep - 1];

  const showForces = guidedStep === 2;
  const tensionEnd = { x: pivotX + (pivotX - bobX) * 0.55, y: pivotY + (pivotY - bobY) * 0.55 };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Pendulum visualization">
          <defs>
            <marker id="pend-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <rect x={pivotX - 44} y={pivotY - 14} width="88" height="14" rx="3" fill="#172033" />
          <line x1={pivotX} y1={pivotY} x2={pivotX} y2={pivotY + armPx + 30} stroke="#94a3b8" strokeWidth="1" strokeDasharray="6 4" />
          {/* Arc sweep to show θ */}
          <path d={`M ${pivotX} ${pivotY + arcR} A ${arcR} ${arcR} 0 0 0 ${pivotX + Math.sin(metrics.theta0) * arcR} ${pivotY + Math.cos(metrics.theta0) * arcR}`} fill="none" stroke="#f2c14e" strokeWidth="3" />
          <text x={pivotX + Math.sin(metrics.theta0 / 2) * (arcR + 14)} y={pivotY + Math.cos(metrics.theta0 / 2) * (arcR + 14) + 4} fill="#92400e" fontSize="13" fontWeight="700">{metrics.initialAngle}°</text>
          <line x1={pivotX} y1={pivotY} x2={bobX} y2={bobY} stroke="#172033" strokeWidth="4" strokeLinecap="round" />
          <circle cx={pivotX} cy={pivotY} r="8" fill="#172033" />
          {showForces && (
            <>
              <g color="#1d4ed8" stroke="currentColor" markerEnd="url(#pend-arr)" strokeWidth="5" className="animate-pulse drop-shadow-[0_0_8px_rgba(29,78,216,0.8)]">
                <line x1={bobX} y1={bobY} x2={tensionEnd.x} y2={tensionEnd.y} />
              </g>
              <text x={tensionEnd.x + 8} y={tensionEnd.y - 6} fill="#1d4ed8" fontSize="14" fontWeight="700">T</text>
              <g color="#c2410c" stroke="currentColor" markerEnd="url(#pend-arr)" strokeWidth="5" className="animate-pulse drop-shadow-[0_0_8px_rgba(194,65,12,0.8)]">
                <line x1={bobX} y1={bobY} x2={bobX} y2={bobY + 60} />
              </g>
              <text x={bobX + 8} y={bobY + 64} fill="#9a3412" fontSize="14" fontWeight="700">mg</text>
            </>
          )}
          <circle cx={bobX} cy={bobY} r={clamp(metrics.mass * 10 + 12, 16, 30)} fill="#216869" stroke="#172033" strokeWidth="3" />
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "Swinging…" : "Release"}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"><RotateCcw size={18} />Reset</button>
      </div>
      <section className={`mt-3 rounded-md bg-white/70 p-3 ring-1 ring-slate-200/50 ${running ? "" : "opacity-75"}`}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guided Breakdown</div><h3 className="mt-1 text-lg font-black text-slate-950">Step {guidedStep} / 4: {stepCopy.title}</h3></div>
          <div className="flex gap-2">
            <button onClick={() => goToStep(guidedStep - 1)} disabled={guidedStep === 1} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous Step</button>
            <button onClick={() => goToStep(guidedStep + 1)} disabled={guidedStep === 4} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Next Step</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-4 text-sm text-slate-700 md:grid-cols-[0.85fr_1.3fr_0.85fr]">
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">L = {fmt(metrics.L_m, 2)} m<br />m = {fmt(metrics.mass, 1)} kg<br />θ₀ = {metrics.initialAngle}°<br />g = {fmt(metrics.gravity, 1)} m/s²</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">ω = √(g/L)<br />T = 2π/ω<br />θ(t) = θ₀cos(ωt)<br />v_max = ω·L·sinθ₀</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">ω = {fmt(metrics.omega, 3)} rad/s<br />T = {fmt(metrics.period, 3)} s<br />v_max = {fmt(metrics.maxSpeed, 2)} m/s<br />h_max = {fmt(metrics.maxHeight, 3)} m</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Period:</span> {fmt(metrics.period, 3)} s</div>
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">Max speed:</span> {fmt(metrics.maxSpeed, 2)} m/s  (at bottom)</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Max height gain:</span> {fmt(metrics.maxHeight, 3)} m</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Angular freq ω:</span> {fmt(metrics.omega, 3)} rad/s</div>
          </div>
        </section>
      </div>
    </div>
  );
}
