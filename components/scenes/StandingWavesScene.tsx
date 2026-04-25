"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

function metrics(config: SimulationConfig) {
  const T = clamp(config.params.tension ?? 40, 1, 100); // N
  const mu = clamp(config.params.linear_density ?? 0.005, 0.001, 0.01); // kg/m
  const L = clamp(config.params.length ?? 2, 0.5, 3); // m
  const n = Math.round(clamp(config.params.harmonic ?? 3, 1, 6));
  const waveSpeed = Math.sqrt(T / mu); // m/s
  const freq = (n * waveSpeed) / (2 * L); // Hz
  const wavelength = (2 * L) / n; // m
  const omega = 2 * Math.PI * freq; // rad/s
  return { T, mu, L, n, waveSpeed, freq, wavelength, omega };
}

const STEPS = [
  {
    title: "Wave Speed",
    equation: "v = √(T/μ)",
    notice: "Wave speed depends only on string tension and linear density — not on frequency or amplitude.",
    diagram: "Higher tension or lighter string means faster wave propagation.",
  },
  {
    title: "Harmonic Condition",
    equation: "λ = 2L/n",
    notice: "Only wavelengths that fit integer half-wavelengths in the string length can form standing waves.",
    diagram: "Count the anti-nodes in the animation — there should be exactly n of them.",
  },
  {
    title: "Resonant Frequency",
    equation: "f = nv/(2L)",
    notice: "Higher harmonics have higher frequencies and shorter wavelengths — but the wave speed stays constant.",
    diagram: "The oscillation rate visible in the animation matches the resonant frequency f.",
  },
  {
    title: "Nodes and Anti-nodes",
    equation: "Node: y = 0 always  |  Anti-node: max amplitude",
    notice: "At nodes the string is always still; at anti-nodes the string oscillates with maximum amplitude.",
    diagram: "The still points are the nodes — there are (n+1) nodes and n anti-nodes.",
  },
];

const STRING_X0 = 80;
const STRING_X1 = SCENE_W - 80;
const STRING_Y = SCENE_H / 2 + 20;
const AMP_PX = 80;

function buildWavePath(n: number, phase: number): string {
  const nPoints = 300;
  const pts: string[] = [];
  for (let i = 0; i <= nPoints; i++) {
    const t = i / nPoints;
    const x = STRING_X0 + t * (STRING_X1 - STRING_X0);
    const y = STRING_Y - AMP_PX * Math.sin(n * Math.PI * t) * Math.cos(phase);
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export default function StandingWavesScene({ config, onOutcome }: SceneProps) {
  const m = useMemo(() => metrics(config), [config]);
  const [guidedStep, setGuidedStep] = useState(1);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const omegaVis = clamp(m.omega, 1, 20);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setPhase(0);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [m.T, m.mu, m.L, m.n, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setRunning(true);

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      setPhase(omegaVis * elapsed);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { freq: m.freq, wavelength: m.wavelength, waveSpeed: m.waveSpeed } });
  }, [m, omegaVis, onOutcome]);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setPhase(0);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [onOutcome]);

  const goToStep = (s: number) => {
    setGuidedStep(clamp(s, 1, 4));
    if (s >= 2 && !running) run();
  };

  const wavePath = buildWavePath(m.n, phase);

  // Node positions
  const nodes = Array.from({ length: m.n + 1 }, (_, i) => {
    const t = i / m.n;
    return STRING_X0 + t * (STRING_X1 - STRING_X0);
  });

  // Anti-node positions
  const antinodes = Array.from({ length: m.n }, (_, i) => {
    const t = (i + 0.5) / m.n;
    return STRING_X0 + t * (STRING_X1 - STRING_X0);
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Standing waves visualization">
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />

          {/* Equilibrium line */}
          <line x1={STRING_X0} y1={STRING_Y} x2={STRING_X1} y2={STRING_Y} stroke="#172033" strokeWidth="1" strokeDasharray="6 4" opacity="0.3" />

          {/* Wave */}
          <path d={wavePath} fill="none" stroke="#216869" strokeWidth="4" strokeLinecap="round" />
          {/* Phase-shifted wave for envelope */}
          <path d={buildWavePath(m.n, phase + Math.PI)} fill="none" stroke="#216869" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />

          {/* Fixed ends */}
          <rect x={STRING_X0 - 10} y={STRING_Y - 28} width={10} height={56} fill="#172033" rx="2" />
          <rect x={STRING_X1} y={STRING_Y - 28} width={10} height={56} fill="#172033" rx="2" />

          {/* Nodes (step 4) */}
          {guidedStep >= 4 && nodes.map((nx, i) => (
            <g key={i}>
              <circle cx={nx} cy={STRING_Y} r={7} fill="#dc2626" />
              <text x={nx} y={STRING_Y + 22} textAnchor="middle" fill="#dc2626" fontSize="11" fontWeight="700">N</text>
            </g>
          ))}

          {/* Anti-nodes (step 4) */}
          {guidedStep >= 4 && antinodes.map((ax, i) => (
            <text key={i} x={ax} y={STRING_Y + 22} textAnchor="middle" fill="#216869" fontSize="11" fontWeight="700">A</text>
          ))}

          {/* Labels */}
          <text x={SCENE_W / 2} y={STRING_Y - AMP_PX - 24} textAnchor="middle" fill="#172033" fontSize="14" fontWeight="700">
            Harmonic n = {m.n}  |  f = {fmt(m.freq, 1)} Hz
          </text>
          <text x={24} y={36} fill="#172033" fontSize="15" fontWeight="700">v = {fmt(m.waveSpeed, 1)} m/s</text>
          <text x={24} y={60} fill="#172033" fontSize="15" fontWeight="700">λ = {fmt(m.wavelength, 3)} m</text>
          <text x={24} y={84} fill="#172033" fontSize="15" fontWeight="700">L = {fmt(m.L, 1)} m</text>
        </svg>
      </div>
      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Vibrate" runningLabel="Oscillating…" />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />
      <InfoPanels
        given={[["T", `${fmt(m.T, 0)} N`], ["μ", `${fmt(m.mu, 4)} kg/m`], ["L", `${fmt(m.L, 1)} m`], ["n", `${m.n}`]]}
        equations={["v = √(T/μ)", "λ = 2L/n", "f = nv/(2L)", "ω = 2πf"]}
        results={[
          ["Wave speed v", `${fmt(m.waveSpeed, 2)} m/s`, "green"],
          ["Wavelength λ", `${fmt(m.wavelength, 3)} m`],
          ["Frequency f", `${fmt(m.freq, 2)} Hz`, "green"],
          ["Angular freq ω", `${fmt(m.omega, 2)} rad/s`],
        ]}
      />
    </div>
  );
}
