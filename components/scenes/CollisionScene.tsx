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

function collisionMetrics(config: SimulationConfig) {
  const m1 = clamp(config.params.mass1 ?? 2, 0.5, 10);
  const v1 = clamp(config.params.v1 ?? 5, -20, 20);
  const m2 = clamp(config.params.mass2 ?? 1, 0.5, 10);
  const v2 = clamp(config.params.v2 ?? -2, -20, 20);
  const e = clamp(config.params.restitution ?? 0, 0, 1);
  const v1f = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / (m1 + m2);
  const v2f = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / (m1 + m2);
  const momentum = m1 * v1 + m2 * v2;
  const keI = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const keF = 0.5 * m1 * v1f * v1f + 0.5 * m2 * v2f * v2f;
  return { m1, v1, m2, v2, e, v1f, v2f, momentum, keInitial: keI, keLost: Math.max(0, keI - keF), valid: v1 > v2 };
}

function signedFmt(value: number, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmt(value, digits)}`;
}

export default function CollisionScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => collisionMetrics(config), [config]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"pre" | "collision" | "post">("pre");
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  const GY = 390;
  const B1W = clamp(metrics.m1 * 22, 44, 110); const B2W = clamp(metrics.m2 * 22, 44, 110);
  const BH = 52; const midX = WIDTH / 2;
  const blockY = GY - BH;
  const contactX1 = midX - B1W;
  const contactX2 = midX;
  const velocityScale = 18;
  const preTime = clamp(220 / ((metrics.v1 - metrics.v2) * velocityScale), 0.45, 1.4);
  const postTime = 1.25;
  const preProgress = clamp(progress / 0.5, 0, 1);
  const postProgress = clamp((progress - 0.5) / 0.5, 0, 1);
  const preTimeLeft = preTime * (1 - preProgress);
  const postTimeElapsed = postTime * postProgress;
  const x1 = progress < 0.5
    ? contactX1 - metrics.v1 * velocityScale * preTimeLeft
    : contactX1 + metrics.v1f * velocityScale * postTimeElapsed;
  const x2 = progress < 0.5
    ? contactX2 - metrics.v2 * velocityScale * preTimeLeft
    : contactX2 + metrics.v2f * velocityScale * postTimeElapsed;

  const velLabel1 = progress >= 0.5 ? `${signedFmt(metrics.v1f)} m/s` : `${signedFmt(metrics.v1)} m/s`;
  const velLabel2 = progress >= 0.5 ? `${signedFmt(metrics.v2f)} m/s` : `${signedFmt(metrics.v2)} m/s`;

  useEffect(() => {
    setProgress(0); setPhase("pre"); setRunning(false);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.m1, metrics.v1, metrics.m2, metrics.v2, metrics.e, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (!metrics.valid) {
      onOutcome({ launched: true, success: false, metrics: {} });
      return;
    }
    setRunning(true);
    setPhase("pre");
    setProgress(0);
    const startedAt = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = clamp((now - startedAt) / duration, 0, 1);
      setProgress(p);
      setPhase(p >= 0.5 ? "post" : "pre");
      if (p < 1) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      setRunning(false);
      onOutcome({ launched: true, success: true, metrics: { v1_final_m_s: metrics.v1f, v2_final_m_s: metrics.v2f, ke_lost_j: metrics.keLost, momentum_kg_m_s: metrics.momentum } });
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setProgress(0); setPhase("pre");
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const showRestitutionEquations = metrics.e > 0;
  const stepCopy = [
    { title: "Initial State", equation: `m₁ = ${fmt(metrics.m1, 1)} kg @ ${fmt(metrics.v1, 1)} m/s,  m₂ = ${fmt(metrics.m2, 1)} kg @ ${fmt(metrics.v2, 1)} m/s`, notice: "Positive velocity means moving right. The blocks approach each other if their velocities point toward the center.", diagram: "Green block (m₁) on the left, purple block (m₂) on the right. Velocity labels show direction." },
    { title: "Conservation of Momentum", equation: "m₁v₁ + m₂v₂ = m₁v₁f + m₂v₂f", notice: `Momentum stays ${fmt(metrics.momentum, 2)} kg·m/s through the collision.`, diagram: "The blocks meet on the track, then continue according to the final velocities." },
    showRestitutionEquations
      ? { title: "Restitution", equation: `e = (v₂f − v₁f) / (v₁ − v₂) = ${fmt(metrics.e, 2)}`, notice: `e = 1 is perfectly elastic, e = 0 is perfectly inelastic. Here KE lost = ${fmt(metrics.keLost, 2)} J.`, diagram: "Higher restitution makes the blocks separate faster after impact." }
      : { title: "Perfectly Inelastic Default", equation: "v₁f = v₂f = (m₁v₁ + m₂v₂) / (m₁ + m₂)", notice: "With default restitution e = 0, the blocks stick together and share one final velocity.", diagram: "After contact, both blocks move together with no pause at impact." },
    { title: "Post-Collision Velocities", equation: `v₁f = ${signedFmt(metrics.v1f, 2)} m/s,  v₂f = ${signedFmt(metrics.v2f, 2)} m/s`, notice: "Positive values move right and negative values move left, matching the labels in the animation.", diagram: "Watch the blocks continue smoothly after contact." },
  ][guidedStep - 1];

  if (!metrics.valid) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-glow">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <h2 className="text-lg font-black">Unable to show a 1D collision for these values.</h2>
          <p className="mt-2 text-sm font-semibold">
            The left block must be moving faster than the right block so they actually collide. Try v₁ greater than v₂, or use a collision prompt with two approaching objects.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/85 p-3 shadow-glow ring-1 ring-slate-200/60">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="1D collision visualization">
          <defs>
            <marker id="col-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <rect x="0" y={GY} width={WIDTH} height={HEIGHT - GY} fill="#d4e4dc" />
          <line x1="0" y1={GY} x2={WIDTH} y2={GY} stroke="#172033" strokeWidth="5" />
          {/* Block 1 */}
          <rect x={x1} y={blockY} width={B1W} height={BH} rx="7" fill={Math.abs(progress - 0.5) < 0.04 ? "#f2c14e" : "#216869"} />
          <text x={x1 + B1W / 2} y={blockY + BH / 2 + 6} textAnchor="middle" fill="white" fontSize="16" fontWeight="800">m₁</text>
          <text x={x1 + B1W / 2} y={blockY - 10} textAnchor="middle" fill="#216869" fontSize="13" fontWeight="700">{velLabel1}</text>
          {/* Block 2 */}
          <rect x={x2} y={blockY} width={B2W} height={BH} rx="7" fill={Math.abs(progress - 0.5) < 0.04 ? "#f2c14e" : "#7c3aed"} />
          <text x={x2 + B2W / 2} y={blockY + BH / 2 + 6} textAnchor="middle" fill="white" fontSize="16" fontWeight="800">m₂</text>
          <text x={x2 + B2W / 2} y={blockY - 10} textAnchor="middle" fill="#7c3aed" fontSize="13" fontWeight="700">{velLabel2}</text>
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "Colliding…" : "Run Collision"}</button>
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
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">m₁ = {fmt(metrics.m1, 1)} kg<br />v₁ = {signedFmt(metrics.v1, 1)} m/s<br />m₂ = {fmt(metrics.m2, 1)} kg<br />v₂ = {signedFmt(metrics.v2, 1)} m/s<br />e = {fmt(metrics.e, 2)}</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">m₁v₁ + m₂v₂ = m₁v₁f + m₂v₂f<br />{showRestitutionEquations ? <>e = (v₂f − v₁f)/(v₁ − v₂)<br />e = {fmt(metrics.e, 2)}</> : <>e = 0 default<br />v₁f = v₂f</>}</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">v₁f = {signedFmt(metrics.v1f, 2)} m/s<br />v₂f = {signedFmt(metrics.v2f, 2)} m/s<br />p = {fmt(metrics.momentum, 2)} kg·m/s<br />KE lost = {fmt(metrics.keLost, 2)} J</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">v₁ final:</span> {signedFmt(metrics.v1f, 2)} m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">v₂ final:</span> {signedFmt(metrics.v2f, 2)} m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Momentum (conserved):</span> {fmt(metrics.momentum, 2)} kg·m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">KE lost:</span> {fmt(metrics.keLost, 2)} J {metrics.e >= 0.99 ? "(elastic — none)" : ""}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
