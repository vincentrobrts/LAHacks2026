"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  ArrowMarker, clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

function metrics(config: SimulationConfig) {
  const v1 = clamp(config.params.v1 ?? 2, 0.5, 10);
  const ar = clamp(config.params.area_ratio ?? 3, 1, 4); // A1/A2
  const rho = clamp(config.params.density ?? 1000, 500, 1500);
  const v2 = v1 * ar; // continuity: A1v1 = A2v2
  const dP = 0.5 * rho * (v2 * v2 - v1 * v1);
  return { v1, v2, ar, rho, dP };
}

const STEPS = [
  {
    title: "Continuity Equation",
    equation: "A₁v₁ = A₂v₂",
    notice: "Fluid cannot pile up — the same volume per second must pass every cross-section.",
    diagram: "Notice the wider pipe (left) has slow particles; the narrow section (center) has faster particles.",
  },
  {
    title: "Speed Increase",
    equation: "v₂ = v₁ × (A₁/A₂)",
    notice: "Squeezing fluid into a smaller cross-section forces it to speed up proportionally.",
    diagram: "Particle spacing in the narrow section is smaller — they travel more distance per second.",
  },
  {
    title: "Bernoulli's Principle",
    equation: "P + ½ρv² = constant",
    notice: "Higher speed means lower pressure — kinetic energy trades off with pressure energy.",
    diagram: "The pressure indicators drop in the narrow section where v₂ is large.",
  },
  {
    title: "Pressure Difference",
    equation: "ΔP = ½ρ(v₂² − v₁²)",
    notice: "The pressure difference drives downstream instruments like a Venturi meter.",
    diagram: "ΔP is calculated and shown. Larger area ratio or higher density increases the pressure difference.",
  },
];

const PIPE_Y_TOP = 155;
const PIPE_Y_BOT = 365;
const H_WIDE = 110;
const H_NARROW = 36;
const SEC1_X = 80;
const SEC2_X = 310;
const SEC3_X = 450;
const SEC4_X = 680;
const CY = (PIPE_Y_TOP + PIPE_Y_BOT) / 2;

export default function BernoulliScene({ config, onOutcome }: SceneProps) {
  const m = useMemo(() => metrics(config), [config]);
  const [guidedStep, setGuidedStep] = useState(1);
  const [running, setRunning] = useState(false);
  const [particles, setParticles] = useState<{ x: number; phase: number }[]>([]);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setParticles([]);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [m.v1, m.ar, m.rho, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setRunning(true);

    const initParticles = Array.from({ length: 12 }, (_, i) => ({ x: SEC1_X + i * 50, phase: i / 12 }));
    setParticles(initParticles);

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;

      setParticles(prev =>
        prev.map(p => {
          let nx = p.x + (p.x >= SEC2_X && p.x <= SEC3_X ? m.v2 * 40 : m.v1 * 40) / 60;
          if (nx > SEC4_X + 20) nx = SEC1_X;
          return { ...p, x: nx };
        })
      );

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { v1: m.v1, v2: m.v2, dP: m.dP } });
  }, [m, onOutcome]);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setParticles([]);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [onOutcome]);

  const goToStep = (s: number) => {
    setGuidedStep(clamp(s, 1, 4));
    if (s >= 2 && !running) run();
  };

  // Pipe outline
  const topEdge = [
    `M ${SEC1_X} ${CY - H_WIDE / 2}`,
    `L ${SEC2_X} ${CY - H_WIDE / 2}`,
    `L ${SEC2_X + 30} ${CY - H_NARROW / 2}`,
    `L ${SEC3_X - 30} ${CY - H_NARROW / 2}`,
    `L ${SEC3_X} ${CY - H_WIDE / 2}`,
    `L ${SEC4_X} ${CY - H_WIDE / 2}`,
  ].join(" ");
  const botEdge = [
    `M ${SEC1_X} ${CY + H_WIDE / 2}`,
    `L ${SEC2_X} ${CY + H_WIDE / 2}`,
    `L ${SEC2_X + 30} ${CY + H_NARROW / 2}`,
    `L ${SEC3_X - 30} ${CY + H_NARROW / 2}`,
    `L ${SEC3_X} ${CY + H_WIDE / 2}`,
    `L ${SEC4_X} ${CY + H_WIDE / 2}`,
  ].join(" ");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Bernoulli fluid flow visualization">
          <defs>
            <ArrowMarker id="bn-arr" />
            <clipPath id="bn-clip">
              <path d={`${topEdge} L ${SEC4_X} ${CY + H_WIDE / 2} ${botEdge.replace("M", "L")} Z`} />
            </clipPath>
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />

          {/* Pipe fill */}
          <path
            d={`${topEdge} L ${SEC4_X} ${CY + H_WIDE / 2} ${botEdge.replace("M", "L")} Z`}
            fill="#bfdbfe" stroke="#172033" strokeWidth="4"
          />

          {/* Particles */}
          {particles.map((p, i) => {
            const inNarrow = p.x >= SEC2_X + 30 && p.x <= SEC3_X - 30;
            return (
              <circle
                key={i}
                cx={p.x}
                cy={CY + (inNarrow ? 0 : (i % 2 === 0 ? -20 : 20))}
                r={inNarrow ? 5 : 7}
                fill="#2563eb"
                opacity="0.7"
                clipPath="url(#bn-clip)"
              />
            );
          })}

          {/* Pressure gauges (step 3+) */}
          {guidedStep >= 3 && (
            <>
              <rect x={140} y={CY - H_WIDE / 2 - 60} width={60} height={40} rx="4" fill="#f2c14e" stroke="#172033" strokeWidth="2" />
              <text x={170} y={CY - H_WIDE / 2 - 35} textAnchor="middle" fill="#172033" fontSize="11" fontWeight="700">P₁ high</text>
              <line x1={170} y1={CY - H_WIDE / 2 - 20} x2={170} y2={CY - H_WIDE / 2} stroke="#172033" strokeWidth="2" />

              <rect x={(SEC2_X + SEC3_X) / 2 - 30} y={CY - H_NARROW / 2 - 60} width={60} height={40} rx="4" fill="#fca5a5" stroke="#172033" strokeWidth="2" />
              <text x={(SEC2_X + SEC3_X) / 2} y={CY - H_NARROW / 2 - 35} textAnchor="middle" fill="#172033" fontSize="11" fontWeight="700">P₂ low</text>
              <line x1={(SEC2_X + SEC3_X) / 2} y1={CY - H_NARROW / 2 - 20} x2={(SEC2_X + SEC3_X) / 2} y2={CY - H_NARROW / 2} stroke="#172033" strokeWidth="2" />
            </>
          )}

          {/* Labels */}
          <text x={140} y={CY + H_WIDE / 2 + 26} textAnchor="middle" fill="#172033" fontSize="13" fontWeight="700">
            v₁ = {fmt(m.v1, 1)} m/s
          </text>
          <text x={(SEC2_X + SEC3_X) / 2} y={CY + H_NARROW / 2 + 26} textAnchor="middle" fill="#172033" fontSize="13" fontWeight="700">
            v₂ = {fmt(m.v2, 1)} m/s
          </text>

          <text x={24} y={36} fill="#172033" fontSize="15" fontWeight="700">ΔP = {fmt(m.dP, 0)} Pa</text>
          <text x={24} y={60} fill="#172033" fontSize="15" fontWeight="700">A₁/A₂ = {fmt(m.ar, 1)}</text>
        </svg>
      </div>
      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Flow" runningLabel="Flowing…" />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />
      <InfoPanels
        given={[["v₁", `${fmt(m.v1, 1)} m/s`], ["A₁/A₂", `${fmt(m.ar, 1)}`], ["ρ", `${fmt(m.rho, 0)} kg/m³`]]}
        equations={["A₁v₁ = A₂v₂", "v₂ = v₁·(A₁/A₂)", "P + ½ρv² = const", "ΔP = ½ρ(v₂²−v₁²)"]}
        results={[
          ["Wide section v₁", `${fmt(m.v1, 2)} m/s`],
          ["Narrow section v₂", `${fmt(m.v2, 2)} m/s`, "green"],
          ["Pressure drop ΔP", `${fmt(m.dP, 0)} Pa`, "green"],
        ]}
      />
    </div>
  );
}
