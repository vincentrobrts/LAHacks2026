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

function springMassMetrics(config: SimulationConfig) {
  const k = clamp(config.params.spring_constant ?? 20, 1, 100);
  const mass = clamp(config.params.mass ?? 1, 0.5, 5);
  const amplitude = clamp(config.params.amplitude ?? 0.5, 0.05, 1.5);
  const gravity = clamp(config.world.gravity, 1, 20);
  const omega = Math.sqrt(k / mass);
  const period = (2 * Math.PI) / omega;
  const maxSpeed = omega * amplitude;
  const maxForce = k * amplitude;
  return { k, mass, amplitude, gravity, omega, period, maxSpeed, maxForce };
}

export default function SpringMassScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => springMassMetrics(config), [config]);
  const [disp, setDisp] = useState(metrics.amplitude);
  const [running, setRunning] = useState(false);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const wallX = 80; const eqX = 380; const massW = 64; const massH = 64; const massY = 220;
  const SCALE = 120; // px per meter
  const massCX = eqX + disp * SCALE;
  const massLeft = massCX - massW / 2;
  const springRight = massLeft;
  const springCoils = 8;
  const springPath = (() => {
    const x1 = wallX + 14; const x2 = springRight; const cy = massY + massH / 2;
    const len = x2 - x1; if (len < 4) return `M ${x1} ${cy} L ${x2} ${cy}`;
    const step = len / (springCoils * 2 + 1); const amp = 16;
    const pts = [`M ${x1} ${cy}`];
    for (let i = 0; i < springCoils * 2 + 1; i++) {
      pts.push(`L ${(x1 + (i + 0.5) * step).toFixed(1)} ${(cy + (i % 2 === 0 ? -amp : amp)).toFixed(1)}`);
    }
    pts.push(`L ${x2} ${cy}`); return pts.join(" ");
  })();
  const forceDir = -disp; // F = -kx, negative disp means force is rightward
  const forceLen = clamp(Math.abs(disp) * SCALE * 0.7, 0, 90);
  const forceSign = forceDir > 0 ? 1 : -1;
  const forceY = massY - 26;
  const forceStartX = massCX + forceSign * (massW / 2 + 8);
  const forceEndX = forceStartX + forceSign * forceLen;
  const forceLabelX = clamp((forceStartX + forceEndX) / 2, 72, WIDTH - 72);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setDisp(metrics.amplitude); setRunning(false);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.k, metrics.mass, metrics.amplitude, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = performance.now();
    setRunning(true);
    const tick = (now: number) => {
      const t = (now - startRef.current) / 1000;
      setDisp(metrics.amplitude * Math.cos(metrics.omega * t));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { period_s: metrics.period, max_speed_m_s: metrics.maxSpeed, max_force_n: metrics.maxForce } });
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setDisp(metrics.amplitude);
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const stepCopy = [
    { title: "System Setup", equation: `k = ${fmt(metrics.k, 1)} N/m,  m = ${fmt(metrics.mass, 1)} kg,  A = ${fmt(metrics.amplitude, 2)} m`, notice: "The mass is displaced from equilibrium and released. The spring constant k determines how stiff the spring is.", diagram: "The block sits at amplitude A from the equilibrium (center dashed line). Spring is compressed or stretched." },
    { title: "Restoring Force", equation: "F = −kx  (Hooke's Law)", notice: "The force always points toward equilibrium — negative when displaced right, positive when displaced left. This is the hallmark of SHM.", diagram: "The orange force arrow points toward the center. It is largest at max displacement and zero at equilibrium." },
    { title: "SHM Equations", equation: `ω = √(k/m) = ${fmt(metrics.omega, 3)} rad/s,  T = 2π/ω = ${fmt(metrics.period, 3)} seconds`, notice: "Period depends only on k and m, not amplitude. Doubling amplitude does not change how fast it oscillates.", diagram: "The equilibrium dashed line shows x=0. The block will always take the same time for each full cycle." },
    { title: "Oscillation", equation: `x(t) = A cos(ωt),  vₘₐₓ = Aω = ${fmt(metrics.maxSpeed, 2)} m/s`, notice: "Max speed occurs at equilibrium, zero speed at max displacement. Energy converts between KE and PE.", diagram: "Watch the block oscillate. The spring compression/extension mirrors the displacement symmetrically." },
  ][guidedStep - 1];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Spring-mass oscillation visualization">
          <defs>
            <marker id="sm-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          {/* Floor */}
          <rect x="0" y={massY + massH} width={WIDTH} height={HEIGHT - massY - massH} fill="#d4e4dc" />
          <line x1="0" y1={massY + massH} x2={WIDTH} y2={massY + massH} stroke="#172033" strokeWidth="4" />
          {/* Wall */}
          <rect x="0" y={massY - 30} width={wallX} height={massH + 60} rx="4" fill="#2f3d3f" />
          {/* Equilibrium line */}
          <line x1={eqX} y1={massY - 20} x2={eqX} y2={massY + massH + 20} stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 4" />
          <text x={eqX + 6} y={massY - 24} fill="#94a3b8" fontSize="12" fontWeight="600">x=0</text>
          {/* Spring */}
          <path d={springPath} fill="none" stroke="#172033" strokeWidth="3" strokeLinecap="round" />
          <line x1={springRight - 10} y1={massY + massH / 2} x2={massLeft + 5} y2={massY + massH / 2} stroke="#172033" strokeWidth="3" strokeLinecap="round" />
          {/* Force arrow (step 2+) */}
          {guidedStep >= 2 && forceLen > 4 && (
            <g color="#f2c14e" stroke="currentColor" markerEnd="url(#sm-arr)" strokeWidth="5" className="animate-pulse drop-shadow-[0_0_8px_rgba(242,193,78,0.8)]">
              <line x1={forceStartX} y1={forceY} x2={forceEndX} y2={forceY} />
            </g>
          )}
          {guidedStep >= 2 && forceLen > 4 && <text x={forceLabelX} y={forceY - 12} textAnchor="middle" fill="#92400e" fontSize="13" fontWeight="700">F = {fmt(-metrics.k * disp, 1)} N</text>}
          {/* Mass block */}
          <rect x={massLeft} y={massY} width={massW} height={massH} rx="7" fill="#216869" stroke="#172033" strokeWidth="3" />
          <text x={massCX} y={massY + massH / 2 + 6} textAnchor="middle" fill="white" fontSize="15" fontWeight="800">m</text>
          {/* Displacement label */}
          {Math.abs(disp) > 0.01 && (
            <>
              <line x1={eqX} y1={massY + massH + 24} x2={massCX} y2={massY + massH + 24} stroke="#216869" strokeWidth="2" markerEnd="url(#sm-arr)" />
              <text x={(eqX + massCX) / 2} y={massY + massH + 42} textAnchor="middle" fill="#216869" fontSize="12" fontWeight="700">x = {fmt(disp, 2)} m</text>
            </>
          )}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "Oscillating…" : "Release"}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"><RotateCcw size={18} />Reset</button>
      </div>
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
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
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">k = {fmt(metrics.k, 1)} N/m<br />m = {fmt(metrics.mass, 1)} kg<br />A = {fmt(metrics.amplitude, 2)} m</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">F = −kx<br />ω = √(k/m)<br />T = 2π/ω<br />x(t) = A cos(ωt)<br />v<sub>max</sub> = Aω<br />F<sub>max</sub> = kA</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">ω = {fmt(metrics.omega, 3)} rad/s<br />T = {fmt(metrics.period, 3)} seconds<br />v<sub>max</sub> = {fmt(metrics.maxSpeed, 2)} m/s<br />F<sub>max</sub> = {fmt(metrics.maxForce, 2)} N</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Period:</span> {fmt(metrics.period, 3)} seconds</div>
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">v<sub>max</sub>:</span> {fmt(metrics.maxSpeed, 2)} m/s  (at x=0)</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">F<sub>max</sub>:</span> {fmt(metrics.maxForce, 2)} N</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Angular frequency ω:</span> {fmt(metrics.omega, 3)} rad/s</div>
          </div>
        </section>
      </div>
    </div>
  );
}
