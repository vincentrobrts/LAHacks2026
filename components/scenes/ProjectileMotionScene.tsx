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

function projectileMetrics(config: SimulationConfig) {
  const angle = clamp(config.params.angle ?? 45, 1, 85);
  const speed = clamp(config.params.speed ?? 18, 1, 40);
  const gravity = clamp(config.world.gravity, 1, 20);
  const mass = clamp(config.params.mass ?? 1, 0.5, 5);
  const h0 = (config.params.initial_height ?? 0) / 10;
  const theta = (angle * Math.PI) / 180;
  const vx = speed * Math.cos(theta);
  const vy = speed * Math.sin(theta);
  const disc = vy * vy + 2 * gravity * h0;
  const tof = disc >= 0 ? (vy + Math.sqrt(disc)) / gravity : 0;
  const range = vx * tof;
  const peakTime = vy / gravity;
  const peakHeight = Math.max(0, h0 + (vy * vy) / (2 * gravity));
  const finalVy = vy - gravity * tof;
  const finalSpeed = Math.sqrt(vx * vx + finalVy * finalVy);
  return { angle, speed, vx, vy, gravity, mass, h0, tof, range, peakHeight, peakTime, finalSpeed };
}

export default function ProjectileMotionScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => projectileMetrics(config), [config]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentY, setCurrentY] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  const GY = 430; const LX = 80; const TW = 600; const TH = 310;
  const visibleRange = Math.max(30, Math.ceil(metrics.range / 10) * 10);
  const maxY = Math.max(metrics.peakHeight, metrics.h0, 1);
  const toSVG = (x_m: number, y_m: number) => ({
    x: LX + clamp(x_m / visibleRange, 0, 1) * TW,
    y: GY - clamp(y_m / maxY, 0, 1.08) * TH,
  });
  const t_now = progress * metrics.tof;
  const currentHeight = Math.max(0, metrics.h0 + metrics.vy * t_now - 0.5 * metrics.gravity * t_now * t_now);
  const ballSVG = toSVG(metrics.vx * t_now, currentHeight);
  const landingPoint = toSVG(metrics.range, 0);
  const pathPts = Array.from({ length: 51 }, (_, i) => {
    const t = (i / 50) * metrics.tof;
    const s = toSVG(metrics.vx * t, Math.max(0, metrics.h0 + metrics.vy * t - 0.5 * metrics.gravity * t * t));
    return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
  }).join(" ");
  const launchPoint = toSVG(0, metrics.h0);

  useEffect(() => {
    setProgress(0); setRunning(false); setCurrentY(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.angle, metrics.speed, metrics.gravity, metrics.h0, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0); setCurrentY(0);
    const startedAt = performance.now();
    const dur = clamp(metrics.tof * 900, 800, 4500);
    setRunning(true);
    const tick = (now: number) => {
      const p = clamp((now - startedAt) / dur, 0, 1);
      const t = p * metrics.tof;
      setProgress(p);
      setCurrentY(Math.max(0, metrics.h0 + metrics.vy * t - 0.5 * metrics.gravity * t * t));
      if (p < 1) { frameRef.current = requestAnimationFrame(tick); return; }
      setRunning(false);
      onOutcome({ launched: true, success: true, metrics: { range_m: metrics.range, peak_height_m: metrics.peakHeight, time_of_flight_s: metrics.tof, final_speed_m_s: metrics.finalSpeed } });
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setProgress(0); setCurrentY(0);
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const AL = 54;
  const theta_r = (metrics.angle * Math.PI) / 180;
  const vxEnd = { x: launchPoint.x + (metrics.vx / metrics.speed) * AL, y: launchPoint.y };
  const vyEnd = { x: launchPoint.x, y: launchPoint.y - (metrics.vy / metrics.speed) * AL };
  const liveVy = metrics.vy - metrics.gravity * t_now;
  const liveSpeed = Math.hypot(metrics.vx, liveVy) || 1;
  const velocityVector = {
    x2: ballSVG.x + (metrics.vx / liveSpeed) * 58,
    y2: ballSVG.y - (liveVy / liveSpeed) * 58,
  };

  const stepCopy = [
    { title: "Launch Conditions", equation: `v₀ = ${fmt(metrics.speed)} m/s at θ = ${metrics.angle}°`, notice: "Launch angle and speed fully determine the trajectory when air resistance is zero.", diagram: "The gold arrow shows the initial velocity vector at the launch point." },
    { title: "Velocity Components", equation: `vₓ = ${fmt(metrics.vx)} m/s,  vᵧ = ${fmt(metrics.vy)} m/s`, notice: "Horizontal velocity stays constant. Vertical velocity decreases at g until peak, then increases downward.", diagram: "Blue = vₓ (constant horizontal), red = vᵧ (decreasing vertical component)." },
    { title: "Equations of Motion", equation: "x = vₓt,  y = h₀ + vᵧt - ½gt²", notice: "The two axes are completely independent. The parabolic shape comes from constant vₓ and linearly changing vᵧ.", diagram: "The dashed arc shows the full parabolic trajectory from launch to landing." },
    { title: "Flight and Landing", equation: `R = ${fmt(metrics.range)} m,  hₚₑₐₖ = ${fmt(metrics.peakHeight)} m`, notice: `Peak is at t = ${fmt(metrics.peakTime)} s when vᵧ = 0. Range is maximized at 45° for flat ground.`, diagram: `The horizontal scale shows ${fmt(visibleRange, 0)} m across the field, so short shots land closer and long shots fit.` },
  ][guidedStep - 1];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Projectile motion visualization">
          <defs>
            <marker id="pm-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <rect x="0" y={GY} width={WIDTH} height={HEIGHT - GY} fill="#d4e4dc" />
          <line x1="0" y1={GY} x2={WIDTH} y2={GY} stroke="#172033" strokeWidth="5" />
          <line x1={LX - 12} y1={launchPoint.y} x2={LX + TW + 14} y2={launchPoint.y} stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 5" opacity="0.5" />
          <rect x={launchPoint.x - 22} y={launchPoint.y - 14} width="44" height="14" rx="4" fill="#172033" />
          <rect x={launchPoint.x - 6} y={launchPoint.y - 32} width="12" height="26" rx="3" fill="#2f3d3f" transform={`rotate(-${metrics.angle} ${launchPoint.x} ${launchPoint.y})`} />
          <polyline points={pathPts} fill="none" stroke="#216869" strokeWidth="3" strokeDasharray="10 6" opacity={guidedStep >= 3 ? 0.75 : 0.42} />
          <circle cx={ballSVG.x} cy={ballSVG.y} r="14" fill="#216869" stroke="#172033" strokeWidth="3" />
          {metrics.range > 0 && (
            <>
              <line x1={landingPoint.x} y1={GY - 28} x2={landingPoint.x} y2={GY + 12} stroke="#f2c14e" strokeWidth="3" />
              <line x1={launchPoint.x} y1={GY + 18} x2={landingPoint.x} y2={GY + 18} stroke="#f2c14e" strokeWidth="3" markerEnd="url(#pm-arr)" />
              <text x={(launchPoint.x + landingPoint.x) / 2} y={GY + 42} textAnchor="middle" fill="#172033" fontSize="13" fontWeight="700">R = {fmt(metrics.range)} m</text>
            </>
          )}
          {guidedStep !== 2 && (
            <g color="#f2c14e" stroke="currentColor" markerEnd="url(#pm-arr)" strokeWidth="5" className="animate-pulse drop-shadow-[0_0_8px_rgba(242,193,78,0.9)]">
              <line x1={ballSVG.x} y1={ballSVG.y} x2={velocityVector.x2} y2={velocityVector.y2} />
            </g>
          )}
          {guidedStep === 2 && (
            <>
              <g color="#1d4ed8" stroke="currentColor" markerEnd="url(#pm-arr)" strokeWidth="5" className="animate-pulse"><line x1={launchPoint.x} y1={launchPoint.y} x2={vxEnd.x} y2={vxEnd.y} /></g>
              <text x={vxEnd.x + 6} y={launchPoint.y + 5} fill="#1d4ed8" fontSize="13" fontWeight="700">vₓ</text>
              <g color="#c2410c" stroke="currentColor" markerEnd="url(#pm-arr)" strokeWidth="5" className="animate-pulse"><line x1={launchPoint.x} y1={launchPoint.y} x2={vyEnd.x} y2={vyEnd.y} /></g>
              <text x={launchPoint.x + 8} y={vyEnd.y - 5} fill="#c2410c" fontSize="13" fontWeight="700">vᵧ</text>
            </>
          )}
          <path d={`M ${launchPoint.x + 46} ${launchPoint.y} A 46 46 0 0 0 ${launchPoint.x + 46 * Math.cos(theta_r)} ${launchPoint.y - 46 * Math.sin(theta_r)}`} fill="none" stroke="#f2c14e" strokeWidth="4" />
          <text x={launchPoint.x + 58} y={launchPoint.y - 22} fill="#172033" fontSize="13" fontWeight="700">θ={metrics.angle}°</text>
          <text x={launchPoint.x - 8} y={launchPoint.y - 42} textAnchor="end" fill="#475569" fontSize="12" fontWeight="700">h₀ = {fmt(metrics.h0, 1)} m</text>
          <g>
            <rect x={WIDTH - 188} y="18" width="164" height="30" rx="6" fill="white" opacity="0.86" />
            <text x={WIDTH - 34} y="38" textAnchor="end" fill="#64748b" fontSize="12" fontWeight="700">field width = {fmt(visibleRange, 0)} m</text>
          </g>
          <text x={WIDTH / 2} y={Math.max(76, Math.min(GY - 92, toSVG(metrics.range * 0.52, metrics.peakHeight * 0.92).y))} textAnchor="middle" fill="#216869" fontSize="13" fontWeight="800">trajectory</text>
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "In Flight…" : "Launch"}</button>
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
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">v₀ = {fmt(metrics.speed, 1)} m/s<br />θ = {metrics.angle}°<br />m = {fmt(metrics.mass, 1)} kg<br />h₀ = {fmt(metrics.h0, 1)} m<br />g = {fmt(metrics.gravity, 1)} m/s²</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">vₓ = v₀cosθ<br />vᵧ = v₀sinθ<br />y = h₀ + vᵧt − ½gt²<br />R = vₓ · t_f</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">vₓ = {fmt(metrics.vx)} m/s<br />vᵧ = {fmt(metrics.vy)} m/s<br />t_peak = {fmt(metrics.peakTime)} s</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">Current height:</span> {fmt(currentY)} m</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Range:</span> {fmt(metrics.range)} m</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Peak height:</span> {fmt(metrics.peakHeight)} m</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Time of flight:</span> {fmt(metrics.tof)} s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Final speed:</span> {fmt(metrics.finalSpeed)} m/s</div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-slate-600">Mass is shown for context; ideal projectile motion here ignores air resistance, so mass does not change the path.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
