"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  ArrowMarker, clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

function metrics(config: SimulationConfig) {
  const F = clamp(config.params.force ?? 20, 1, 100);
  const L = clamp(config.params.arm_length ?? 1.5, 0.1, 5);
  const mass = clamp(config.params.mass ?? 2, 0.5, 10);
  const I = (1 / 3) * mass * L * L;
  const tau = F * L;
  const alpha = tau / I;
  return { F, L, mass, I, tau, alpha };
}

const STEPS = [
  {
    title: "Lever Arm",
    equation: "τ = F × r",
    notice: "Torque equals the force multiplied by the perpendicular distance from the fixed pivot.",
    diagram: "The beam is mounted to the wall, and the dashed line marks the lever arm from pivot to load.",
  },
  {
    title: "Moment of Inertia",
    equation: "I = 1/3 mL² (beam about fixed end)",
    notice: "Rotational inertia grows with mass and with length squared, so longer beams resist rotation strongly.",
    diagram: "Changing arm length rescales the mounted beam so it stays visible while I updates physically.",
  },
  {
    title: "Angular Acceleration",
    equation: "α = τ / I",
    notice: "More torque or less inertia means larger angular acceleration.",
    diagram: "The beam rotates downward from the wall pivot under the applied load.",
  },
  {
    title: "Support Limit",
    equation: "θ stops at the support limit",
    notice: "The support prevents endless rotation, so the beam settles against a physical limit.",
    diagram: "The orange stop line is the hard limit for this visual model.",
  },
];

const WALL_X = 92;
const WALL_W = 44;
const PIVOT = { x: WALL_X + WALL_W, y: SCENE_H / 2 - 38 };
const MAX_STOP_ANGLE = (72 * Math.PI) / 180;

export default function TorqueScene({ config, onOutcome }: SceneProps) {
  const m = useMemo(() => metrics(config), [config]);
  const [angle, setAngle] = useState(0);
  const [running, setRunning] = useState(false);
  const [guidedStep, setGuidedStep] = useState(1);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const beamPx = clamp(m.L * 120, 78, 500);
  const massR = clamp(10 + Math.sqrt(m.mass) * 5, 16, 32);
  const stopAngle = Math.min(MAX_STOP_ANGLE, Math.asin(clamp((SCENE_H - 92 - PIVOT.y - massR * 2) / beamPx, 0.18, 0.95)));
  const tipX = PIVOT.x + beamPx * Math.cos(angle);
  const tipY = PIVOT.y + beamPx * Math.sin(angle);
  const stopX = PIVOT.x + (beamPx + 18) * Math.cos(stopAngle);
  const stopY = PIVOT.y + (beamPx + 18) * Math.sin(stopAngle);
  const forceArrowLen = clamp(m.F * 2.2, 24, 88);
  const massCenterY = tipY + massR + 12;
  const forceArrowX = tipX + massR + 22;
  const forceArrowY = tipY - 16;
  const forceLabelX = clamp(forceArrowX + 12, 84, SCENE_W - 76);
  const forceLabelAnchor = forceLabelX > SCENE_W - 130 ? "end" : "start";
  const attachedMassLabelY = Math.min(massCenterY + massR + 18, SCENE_H - 24);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setAngle(0);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [m.F, m.L, m.mass, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setAngle(0);
    setRunning(true);

    const alphaVis = clamp(m.alpha / 8, 0.25, 2.8);
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const t = (now - startRef.current) / 1000;
      const theta = 0.5 * alphaVis * t * t;
      if (theta >= stopAngle) {
        setAngle(stopAngle);
        setRunning(false);
        onOutcome({ launched: true, success: true, metrics: { tau: m.tau, alpha: m.alpha, I: m.I } });
        return;
      }
      setAngle(theta);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [m, stopAngle, onOutcome]);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setAngle(0);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [onOutcome]);

  const goToStep = (s: number) => {
    const next = clamp(s, 1, 4);
    setGuidedStep(next);
    if (next === 4 && !running) run();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Torque visualization">
          <defs>
            <ArrowMarker id="tq-arr" />
            <ArrowMarker id="tq-red" color="#dc2626" />
            <pattern id="wall-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="10" stroke="#64748b" strokeWidth="3" opacity="0.45" />
            </pattern>
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />

          <rect x={WALL_X - 18} y="82" width={WALL_W + 18} height="356" rx="4" fill="#2f3d3f" />
          <rect x={WALL_X - 18} y="82" width={WALL_W + 18} height="356" rx="4" fill="url(#wall-hatch)" />
          <rect x={WALL_X + WALL_W - 6} y={PIVOT.y - 44} width="12" height="88" rx="3" fill="#172033" />

          <line x1={PIVOT.x} y1={PIVOT.y} x2={stopX} y2={stopY} stroke="#f2c14e" strokeWidth="8" strokeLinecap="round" opacity="0.9" />

          {angle > 0.04 ? (
            <path
              d={`M ${PIVOT.x + 34} ${PIVOT.y} A 34 34 0 0 1 ${PIVOT.x + 34 * Math.cos(angle)} ${PIVOT.y + 34 * Math.sin(angle)}`}
              fill="none"
              stroke="#f2c14e"
              strokeWidth="4"
            />
          ) : null}

          <line x1={PIVOT.x} y1={PIVOT.y} x2={tipX} y2={tipY} stroke="#172033" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
          <line x1={PIVOT.x} y1={PIVOT.y} x2={tipX} y2={tipY} stroke="#216869" strokeWidth="16" strokeLinecap="round" />
          <line x1={PIVOT.x} y1={PIVOT.y} x2={tipX} y2={tipY} stroke="#2e8b88" strokeWidth="8" strokeLinecap="round" />

          <circle cx={PIVOT.x} cy={PIVOT.y} r="23" fill="#eef5f1" stroke="#172033" strokeWidth="4" />
          <circle cx={PIVOT.x} cy={PIVOT.y} r="17" fill="#172033" />
          <circle cx={PIVOT.x} cy={PIVOT.y} r="7" fill="#f2c14e" />
          <text x={PIVOT.x - 38} y={PIVOT.y - 24} fill="#172033" fontSize="13" fontWeight="800">fixed pivot</text>

          <circle cx={tipX} cy={massCenterY} r={massR} fill="#d7603d" stroke="#172033" strokeWidth="3" />
          <line x1={tipX} y1={tipY} x2={tipX} y2={massCenterY} stroke="#172033" strokeWidth="3" />
          <text x={tipX} y={massCenterY + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="900">m</text>
          <text x={tipX} y={attachedMassLabelY} textAnchor="middle" fill="#172033" fontSize="12" fontWeight="800">attached mass</text>

          <g color="#dc2626" stroke="currentColor" markerEnd="url(#tq-red)" strokeWidth="4" className="animate-pulse">
            <line x1={forceArrowX} y1={forceArrowY} x2={forceArrowX} y2={forceArrowY + forceArrowLen} />
          </g>
          <text x={forceLabelX} y={forceArrowY - 8} textAnchor={forceLabelAnchor} fill="#dc2626" fontSize="13" fontWeight="800">
            F = {fmt(m.F, 0)} N
          </text>

          <text x={PIVOT.x + 46} y={PIVOT.y - 28} fill="#172033" fontSize="15" fontWeight="800">
            τ = {fmt(m.tau, 1)} N·m
          </text>
          <text x={24} y={36} fill="#172033" fontSize="15" fontWeight="800">α = {fmt(m.alpha, 2)} rad/s²</text>
          <text x={24} y={60} fill="#172033" fontSize="15" fontWeight="800">I = {fmt(m.I, 3)} kg·m²</text>
          <text x={24} y={84} fill="#172033" fontSize="15" fontWeight="800">θ = {fmt((angle * 180) / Math.PI, 1)}°</text>
          <text x={SCENE_W - 28} y={36} textAnchor="end" fill="#64748b" fontSize="13" fontWeight="800">L = {fmt(m.L, 1)} m</text>
        </svg>
      </div>
      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Apply Torque" runningLabel="Rotating..." />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />
      <InfoPanels
        given={[["F", `${fmt(m.F, 0)} N`], ["L", `${fmt(m.L, 2)} m`], ["attached mass m", `${fmt(m.mass, 1)} kg`]]}
        equations={["τ = F·L", "I = 1/3 mL²", "α = τ/I", "θ = 1/2 αt²"]}
        results={[
          ["Torque τ", `${fmt(m.tau, 2)} N·m`, "green"],
          ["Moment of inertia I", `${fmt(m.I, 4)} kg·m²`],
          ["Angular acceleration α", `${fmt(m.alpha, 2)} rad/s²`, "green"],
        ]}
      />
    </div>
  );
}
