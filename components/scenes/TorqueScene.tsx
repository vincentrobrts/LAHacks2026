"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  ArrowMarker, clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

function metrics(config: SimulationConfig) {
  const F = clamp(config.params.force ?? 20, 1, 100);
  const L = clamp(config.params.arm_length ?? 1.5, 0.1, 3);
  const m = clamp(config.params.mass ?? 2, 0.5, 10);
  const I = (1 / 3) * m * L * L; // rod about pivot end
  const tau = F * L;
  const alpha = tau / I; // rad/s²
  return { F, L, m, I, tau, alpha };
}

const STEPS = [
  {
    title: "Lever Arm",
    equation: "τ = F × r",
    notice: "Torque equals the force multiplied by the perpendicular distance from the pivot — the lever arm.",
    diagram: "The dashed line shows the lever arm length from pivot to where the force is applied.",
  },
  {
    title: "Moment of Inertia",
    equation: "I = ¹⁄₃mL² (rod about end)",
    notice: "A rod's inertia depends on both mass and how it is distributed — mass far from pivot resists rotation more.",
    diagram: "Notice how longer rods have much larger I because of the L² dependence.",
  },
  {
    title: "Angular Acceleration",
    equation: "α = τ / I",
    notice: "More torque or less inertia means faster angular acceleration — the rotational analog of Newton's 2nd law.",
    diagram: "Watch the rod accelerate rotationally — it starts slow and sweeps faster.",
  },
  {
    title: "Rotational Kinematics",
    equation: "θ(t) = ½αt², ω(t) = αt",
    notice: "Angular position grows as t² and angular velocity grows linearly — just like linear kinematics.",
    diagram: "The rod sweeps through angle θ over time. The tip covers a larger arc than the base.",
  },
];

const PIVOT = { x: 240, y: SCENE_H / 2 };
const SCALE_PX = 140; // 1 m = 140 px

export default function TorqueScene({ config, onOutcome }: SceneProps) {
  const m = useMemo(() => metrics(config), [config]);
  const [angle, setAngle] = useState(0);
  const [running, setRunning] = useState(false);
  const [guidedStep, setGuidedStep] = useState(1);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const L_PX = clamp(m.L * SCALE_PX, 40, 360);
  const tipX = PIVOT.x + L_PX * Math.cos(angle);
  const tipY = PIVOT.y + L_PX * Math.sin(angle);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setAngle(0);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [m.F, m.L, m.m, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setAngle(0);
    setRunning(true);

    const alphaVis = clamp(m.alpha, 0.2, 3);
    const maxAngle = Math.PI * 1.25;

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const t = (now - startRef.current) / 1000;
      const theta = 0.5 * alphaVis * t * t;
      if (theta >= maxAngle) {
        setAngle(maxAngle);
        setRunning(false);
        onOutcome({ launched: true, success: true, metrics: { tau: m.tau, alpha: m.alpha, I: m.I } });
        return;
      }
      setAngle(theta);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [m, onOutcome]);

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

  // Force arrow at tip, pointing downward
  const forceArrowLen = clamp(m.F * 2.5, 20, 90);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Torque visualization">
          <defs>
            <ArrowMarker id="tq-arr" />
            <ArrowMarker id="tq-red" color="#dc2626" />
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />
          {/* Pivot */}
          <circle cx={PIVOT.x} cy={PIVOT.y} r={12} fill="#172033" />
          <text x={PIVOT.x - 5} y={PIVOT.y + 4} fill="white" fontSize="10" fontWeight="900">P</text>
          {/* Swept arc */}
          {angle > 0.05 && (
            <path
              d={`M ${PIVOT.x + 30} ${PIVOT.y} A 30 30 0 ${angle > Math.PI ? 1 : 0} 1 ${PIVOT.x + 30 * Math.cos(angle)} ${PIVOT.y + 30 * Math.sin(angle)}`}
              fill="none" stroke="#f2c14e" strokeWidth="4"
            />
          )}
          {/* Lever arm dashed line (step 1) */}
          {guidedStep >= 1 && (
            <line x1={PIVOT.x} y1={PIVOT.y} x2={tipX} y2={tipY} stroke="#172033" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
          )}
          {/* Rod */}
          <line x1={PIVOT.x} y1={PIVOT.y} x2={tipX} y2={tipY} stroke="#216869" strokeWidth="12" strokeLinecap="round" />
          <line x1={PIVOT.x} y1={PIVOT.y} x2={tipX} y2={tipY} stroke="#2e8b88" strokeWidth="6" strokeLinecap="round" />
          {/* Force arrow (step 1+) */}
          {guidedStep >= 1 && (
            <g color="#dc2626" stroke="currentColor" markerEnd="url(#tq-red)" strokeWidth="4" className="animate-pulse">
              <line x1={tipX} y1={tipY} x2={tipX} y2={tipY + forceArrowLen} />
            </g>
          )}
          {guidedStep >= 1 && (
            <text x={tipX + 8} y={tipY + forceArrowLen / 2} fill="#dc2626" fontSize="13" fontWeight="700">
              F = {fmt(m.F, 0)} N
            </text>
          )}
          {/* Torque label */}
          <text x={PIVOT.x + 40} y={PIVOT.y - 28} fill="#172033" fontSize="15" fontWeight="700">
            τ = {fmt(m.tau, 1)} N·m
          </text>
          {/* Info */}
          <text x={24} y={36} fill="#172033" fontSize="15" fontWeight="700">α = {fmt(m.alpha, 2)} rad/s²</text>
          <text x={24} y={60} fill="#172033" fontSize="15" fontWeight="700">I = {fmt(m.I, 3)} kg·m²</text>
          <text x={24} y={84} fill="#172033" fontSize="15" fontWeight="700">θ = {fmt((angle * 180) / Math.PI, 1)}°</text>
        </svg>
      </div>
      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Apply Torque" runningLabel="Rotating…" />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />
      <InfoPanels
        given={[["F", `${fmt(m.F, 0)} N`], ["L", `${fmt(m.L, 2)} m`], ["m", `${fmt(m.m, 1)} kg`]]}
        equations={["τ = F·L", "I = ¹⁄₃mL²", "α = τ/I", "θ = ½αt²"]}
        results={[
          ["Torque τ", `${fmt(m.tau, 2)} N·m`, "green"],
          ["Moment of inertia I", `${fmt(m.I, 4)} kg·m²`],
          ["Angular acceleration α", `${fmt(m.alpha, 2)} rad/s²`, "green"],
        ]}
      />
    </div>
  );
}
