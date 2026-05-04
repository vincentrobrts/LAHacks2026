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

function distanceLabel(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(digits)} km` : `${value.toFixed(digits)} m`;
}

function freeFallMetrics(config: SimulationConfig) {
  const h = clamp(config.params.height ?? 200, 1, 5000);
  const mass = clamp(config.params.mass ?? 1, 0.1, 25);
  const k = clamp(config.params.air_resistance ?? 0, 0, 1);
  const gravity = clamp(config.world.gravity, 1, 20);
  const vacuumTof = Math.sqrt((2 * h) / gravity);
  const vacuumImpact = Math.sqrt(2 * gravity * h);
  const dragFactor = clamp((k * h) / 1000, 0, 0.85);
  const tof = vacuumTof * (1 + dragFactor);
  const vImpact = vacuumImpact * (1 - 0.55 * dragFactor);
  const compressed = h > 400;
  return { h, mass, k, gravity, tof, vImpact, compressed };
}

export default function FreeFallScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => freeFallMetrics(config), [config]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  const topY = 60; const groundY = 440; const cx = WIDTH / 2;
  const ballR = clamp(12 + Math.sqrt(metrics.mass) * 7, 15, 48);
  const ballY = (r: number) => topY + r + progress * (groundY - topY - 2 * r);
  const speedNow = metrics.k === 0 ? metrics.gravity * (progress * metrics.tof) : metrics.vImpact * ((1 - Math.exp(-3 * progress)) / (1 - Math.exp(-3)));
  const arrowLen = clamp(speedNow * 6, 0, 70);

  useEffect(() => {
    setProgress(0); setRunning(false); setCurrentSpeed(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.h, metrics.gravity, metrics.k, metrics.mass, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0); setCurrentSpeed(0);
    const startedAt = performance.now();
    const dur = clamp(metrics.tof * 400, 250, 1200);
    setRunning(true);
    const tick = (now: number) => {
      const p = clamp((now - startedAt) / dur, 0, 1);
      const t = p * metrics.tof;
      const distanceProgress = metrics.k === 0 ? p * p : p ** 1.75;
      setProgress(distanceProgress);
      const speed = metrics.k === 0 ? metrics.gravity * t : metrics.vImpact * ((1 - Math.exp(-3 * p)) / (1 - Math.exp(-3)));
      setCurrentSpeed(speed);
      if (p < 1) { frameRef.current = requestAnimationFrame(tick); return; }
      setRunning(false);
      onOutcome({ launched: true, success: true, metrics: { time_s: metrics.tof, impact_speed_m_s: metrics.vImpact } });
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setProgress(0); setCurrentSpeed(0);
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const stepCopy = [
    { title: "Setup", equation: `h = ${distanceLabel(metrics.h)},  m = ${fmt(metrics.mass, 1)} kg,  g = ${fmt(metrics.gravity, 1)} m/s²`, notice: "In free fall (no air resistance), all objects fall at the same rate regardless of mass. Galileo's insight.", diagram: "The ball starts at height h. The dashed line shows the drop distance to the ground." },
    { title: "Forces", equation: metrics.k === 0 ? "Only gravity: F = mg (net force, no drag)" : `F_net = mg − kv  (drag coefficient k = ${fmt(metrics.k, 3)})`, notice: metrics.k === 0 ? "Without air resistance, acceleration is constant at g throughout the fall." : "Air resistance grows with speed, gradually reducing the net downward force.", diagram: "The red arrow shows the net downward force. It grows if there is air resistance as speed increases." },
    { title: "Kinematics", equation: "v² = 2gh  →  impact speed = √(2gh)", notice: `Using energy: mgh = ½mv² cancels mass, giving v = ${fmt(metrics.vImpact, 2)} m/s regardless of m (vacuum).`, diagram: "The height label shows h in meters. The impact speed comes purely from the drop height and gravity." },
    { title: "Free Fall", equation: `t = √(2h/g) = ${fmt(metrics.tof, 2)} s,  impact speed = ${fmt(metrics.vImpact, 2)} m/s`, notice: "The velocity arrow grows linearly with time in vacuum. With drag it grows slower as air resistance builds up.", diagram: "Watch the red arrow lengthen as the ball accelerates downward." },
  ][guidedStep - 1];

  return (
    <div className="rounded-xl bg-white/85 p-3 shadow-glow ring-1 ring-slate-200/60">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Free fall visualization">
          <defs>
            <marker id="ff-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <rect x="0" y={groundY} width={WIDTH} height={HEIGHT - groundY} fill="#d4e4dc" />
          <line x1="0" y1={groundY} x2={WIDTH} y2={groundY} stroke="#172033" strokeWidth="5" />
          {/* Height label */}
          <line x1={cx + 160} y1={topY + 2 * ballR} x2={cx + 160} y2={groundY} stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 4" />
          <line x1={cx + 148} y1={topY + 2 * ballR} x2={cx + 172} y2={topY + 2 * ballR} stroke="#94a3b8" strokeWidth="2" />
          <line x1={cx + 148} y1={groundY} x2={cx + 172} y2={groundY} stroke="#94a3b8" strokeWidth="2" />
          <text x={cx + 176} y={(topY + groundY) / 2 + 5} fill="#475569" fontSize="14" fontWeight="700">h = {distanceLabel(metrics.h)}</text>
          {metrics.compressed ? (
            <g>
              <rect x="24" y="20" width="360" height="32" rx="6" fill="white" opacity="0.88" />
              <text x="36" y="41" fill="#475569" fontSize="13" fontWeight="800">Visual scale compressed: {distanceLabel(metrics.h)} shown in canvas</text>
            </g>
          ) : null}
          {/* Velocity arrow */}
          {arrowLen > 4 && (
            <g color="#c2410c" stroke="currentColor" markerEnd="url(#ff-arr)" strokeWidth="4">
                <line x1={cx} y1={ballY(ballR) + ballR + 4} x2={cx} y2={ballY(ballR) + ballR + 4 + arrowLen} />
              </g>
            )}
          <circle cx={cx} cy={ballY(ballR)} r={ballR} fill="#216869" stroke="#172033" strokeWidth="3" />
          <text x={cx} y={ballY(ballR) + ballR + 18} textAnchor="middle" fill="#172033" fontSize="12" fontWeight="800">{fmt(metrics.mass, 1)} kg</text>
          {progress >= 0.99 && <text x={cx} y={groundY + 28} textAnchor="middle" fill="#c2410c" fontSize="14" fontWeight="800">Impact: {fmt(metrics.vImpact, 2)} m/s</text>}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "Falling…" : "Drop"}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"><RotateCcw size={18} />Reset</button>
      </div>
      <section className={`mt-3 rounded-md bg-white/70 p-3 ring-1 ring-slate-200/50 ${running || progress > 0 ? "" : "opacity-75"}`}>
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
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">h = {distanceLabel(metrics.h)}<br />m = {fmt(metrics.mass, 1)} kg<br />g = {fmt(metrics.gravity, 1)} m/s²<br />k = {fmt(metrics.k, 3)}</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">v² = 2gh<br />t = √(2h/g)<br />v = gt  (vacuum)<br />F = mg − kv (drag)</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">t = {fmt(metrics.tof, 2)} s<br />impact speed = {fmt(metrics.vImpact, 2)} m/s</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">Current speed:</span> {fmt(currentSpeed)} m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Time to ground:</span> {fmt(metrics.tof, 2)} s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Impact speed:</span> {fmt(metrics.vImpact, 2)} m/s</div>
            {metrics.k > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Air resistance active — impact speed is reduced by drag.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
