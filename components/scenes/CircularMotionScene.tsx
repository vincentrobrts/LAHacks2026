"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  ArrowMarker, clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

function metrics(config: SimulationConfig) {
  const r = clamp(config.params.radius ?? 2, 0.5, 4);
  const m = clamp(config.params.mass ?? 1, 0.5, 5);
  const v = clamp(config.params.speed ?? 4, 0.5, 20);
  const omega = v / r;
  const period = (2 * Math.PI) / omega;
  const ac = v * v / r;
  const fc = m * ac;
  return { r, m, v, omega, period, ac, fc };
}

const STEPS = [
  {
    title: "Circular Path",
    equation: "v = ωr",
    notice: "The ball moves at constant speed, but its direction is always changing — that means acceleration exists.",
    diagram: "Watch the ball trace the circular path. The dashed circle marks its fixed orbital radius.",
  },
  {
    title: "Centripetal Acceleration",
    equation: "a_c = v² / r",
    notice: "Centripetal acceleration always points toward the center, perpendicular to velocity.",
    diagram: "The red arrow points from the ball toward the center — that is the centripetal direction.",
  },
  {
    title: "Centripetal Force",
    equation: "F_c = mv² / r",
    notice: "A net inward force is required to maintain circular motion. Without it, the ball would fly outward.",
    diagram: "The red force arrow magnitude scales with F_c. More speed or smaller radius means larger force.",
  },
  {
    title: "Period and Angular Speed",
    equation: "T = 2πr / v = 2π / ω",
    notice: "Faster speed or smaller radius means shorter period — the ball completes orbits more quickly.",
    diagram: "Count orbits per second in the animation to see how ω determines the period.",
  },
];

const CX = SCENE_W / 2;
const CY = SCENE_H / 2 + 10;

export default function CircularMotionScene({ config, onOutcome }: SceneProps) {
  const m = useMemo(() => metrics(config), [config]);
  const [running, setRunning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const R_PX = clamp(m.r * 60, 60, 220);
  const omegaVis = clamp(m.omega, 0.3, 5);

  const bx = CX + R_PX * Math.cos(angle);
  const by = CY + R_PX * Math.sin(angle);
  // velocity tangent (perpendicular to radius, in direction of rotation)
  const vtx = -Math.sin(angle) * 50;
  const vty = Math.cos(angle) * 50;
  // centripetal arrow (toward center)
  const fcLen = clamp(m.fc / 5, 20, 100);
  const fcx = (CX - bx) / R_PX * fcLen;
  const fcy = (CY - by) / R_PX * fcLen;

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setAngle(0);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [m.r, m.v, m.m, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setRunning(true);

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      setAngle(omegaVis * elapsed);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { fc: m.fc, ac: m.ac, period: m.period, omega: m.omega } });
  }, [m, omegaVis, onOutcome]);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setAngle(0);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [onOutcome]);

  const goToStep = (s: number) => {
    setGuidedStep(clamp(s, 1, 4));
    if (s === 4 && !running) run();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Circular motion visualization">
          <defs>
            <ArrowMarker id="cm-arr" />
            <ArrowMarker id="cm-red" color="#dc2626" />
            <ArrowMarker id="cm-blue" color="#2563eb" />
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />
          {/* Orbital path */}
          <circle cx={CX} cy={CY} r={R_PX} fill="none" stroke="#172033" strokeWidth="2" strokeDasharray="8 6" opacity="0.4" />
          {/* Center cross */}
          <line x1={CX - 10} y1={CY} x2={CX + 10} y2={CY} stroke="#172033" strokeWidth="2" />
          <line x1={CX} y1={CY - 10} x2={CX} y2={CY + 10} stroke="#172033" strokeWidth="2" />
          <text x={CX + 8} y={CY - 8} fill="#172033" fontSize="13" fontWeight="700">pivot</text>
          {/* Radius label */}
          <line x1={CX} y1={CY} x2={bx} y2={by} stroke="#172033" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
          <text x={(CX + bx) / 2 + 6} y={(CY + by) / 2 - 6} fill="#172033" fontSize="13" fontWeight="700">r = {fmt(m.r, 1)} m</text>
          {/* Velocity arrow (blue) */}
          {guidedStep >= 1 && (
            <g color="#2563eb" stroke="currentColor" markerEnd="url(#cm-blue)" strokeWidth="4" className="opacity-80">
              <line x1={bx} y1={by} x2={bx + vtx} y2={by + vty} />
            </g>
          )}
          {guidedStep >= 1 && <text x={bx + vtx + 6} y={by + vty - 4} fill="#2563eb" fontSize="13" fontWeight="700">v</text>}
          {/* Centripetal force arrow (red) */}
          {guidedStep >= 2 && (
            <g color="#dc2626" stroke="currentColor" markerEnd="url(#cm-red)" strokeWidth="4" className="animate-pulse">
              <line x1={bx} y1={by} x2={bx + fcx} y2={by + fcy} />
            </g>
          )}
          {guidedStep >= 2 && (
            <text x={bx + fcx * 0.6 + 6} y={by + fcy * 0.6 - 4} fill="#dc2626" fontSize="13" fontWeight="700">
              F_c = {fmt(m.fc, 1)} N
            </text>
          )}
          {/* Ball */}
          <circle cx={bx} cy={by} r={16} fill="#216869" stroke="#172033" strokeWidth="3" />
          <text x={bx} y={by + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="800">m</text>
          {/* Info labels */}
          <text x={24} y={36} fill="#172033" fontSize="15" fontWeight="700">ω = {fmt(m.omega, 2)} rad/s</text>
          <text x={24} y={60} fill="#172033" fontSize="15" fontWeight="700">T = {fmt(m.period, 2)} s</text>
          <text x={24} y={84} fill="#172033" fontSize="15" fontWeight="700">v = {fmt(m.v, 1)} m/s</text>
        </svg>
      </div>
      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Orbit" runningLabel="Orbiting…" />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />
      <InfoPanels
        given={[["r", `${fmt(m.r, 1)} m`], ["m", `${fmt(m.m, 1)} kg`], ["v", `${fmt(m.v, 1)} m/s`]]}
        equations={["ω = v/r", "a_c = v²/r", "F_c = ma_c", "T = 2π/ω"]}
        results={[
          ["Angular speed ω", `${fmt(m.omega, 3)} rad/s`, "green"],
          ["Period T", `${fmt(m.period, 3)} s`],
          ["Centripetal acc a_c", `${fmt(m.ac, 2)} m/s²`],
          ["Centripetal force F_c", `${fmt(m.fc, 2)} N`, "green"],
        ]}
      />
    </div>
  );
}
