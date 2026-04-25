"use client";

import { useEffect, useRef, useState } from "react";
import { SCENE_W, SCENE_H, fmt, SceneActions, GuidedBreakdown, InfoPanels } from "./_shared";
import type { SimulationConfig, LaunchOutcome } from "@/types/simulation";

type Props = { config: SimulationConfig; onOutcome: (o: LaunchOutcome) => void };

// Fixed visual constants — physical radius only affects physics, not visual scale
const CX = SCENE_W / 2;
const WHEEL_Y = 110;
const WHEEL_R = 44;           // visual wheel radius px
const MASS_W = 48;
const MASS_H = 28;
const MASS_REST_OFFSET = 170; // px below wheel center where masses begin (must clear wheel + max travel)
const MAX_TRAVEL_PX = 100;    // max pixels of travel before stopping

const STEPS = [
  {
    title: "Fixed Pulley Geometry",
    equation: "rope exits at wheel edge — angle stays fixed, only length changes",
    notice: "A fixed pulley redirects force without changing its magnitude. The rope leaves the wheel tangentially — the angle of each rope segment is set by geometry, not by motion.",
    diagram: "Both rope segments hang straight down from opposite sides of the wheel.",
  },
  {
    title: "Rotational Inertia",
    equation: "I = ½MR²   →   a = (m₂−m₁)g / (m₁+m₂+½M)",
    notice: "The spinning wheel resists changes in angular velocity. A heavier or larger pulley adds effective inertia = I/R² = ½M, slowing the system.",
    diagram: "Watch the spokes rotate — faster masses mean faster wheel spin.",
  },
  {
    title: "Tension Difference",
    equation: "T₁ = m₁(g+a)    T₂ = m₂(g−a)    T₂ − T₁ = Iα/R",
    notice: "Tension is different on each side because the wheel needs a net torque to accelerate. The difference (T₂−T₁)·R = I·α drives the spin.",
    diagram: "Higher tension on the descending side pulls the heavier mass down.",
  },
];

export default function PulleyScene({ config, onOutcome }: Props) {
  const { params, world } = config;
  const m1 = Number(params.mass1 ?? 3);
  const m2 = Number(params.mass2 ?? 5);
  const R_m = Number(params.radius ?? 0.1);
  const M_p = Number(params.pulley_mass ?? 0.5);
  const g = world.gravity;

  // Physics
  const I_eff = 0.5 * M_p;   // I/R² = ½M
  const a = ((m2 - m1) * g) / (m1 + m2 + I_eff);
  const T1 = m1 * (g + a);
  const T2 = m2 * (g - a);

  // Ropes exit at the wheel edges and hang straight down
  const leftX = CX - WHEEL_R;
  const rightX = CX + WHEEL_R;
  const massRestY = WHEEL_Y + MASS_REST_OFFSET;

  const tRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(1);
  const [disp, setDisp] = useState(0);    // metres descended by heavier mass
  const [wheelAngle, setWheelAngle] = useState(0);

  const reset = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    tRef.current = 0;
    setRunning(false);
    setDisp(0);
    setWheelAngle(0);
  };

  useEffect(() => { reset(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const run = () => {
    if (running) return;
    setRunning(true);
    let lastTs: number | null = null;

    const loop = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.033);
      lastTs = ts;
      tRef.current += dt;
      const t = tRef.current;
      const d = 0.5 * Math.abs(a) * t * t;  // metres

      if (d * 60 > MAX_TRAVEL_PX) {
        setRunning(false);
        onOutcome({ launched: true, success: true, metrics: { acceleration: a, T1, T2, omega: Math.abs(a) * t / R_m } });
        return;
      }

      setDisp(d);
      setWheelAngle(d / R_m);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const balanced = Math.abs(a) < 0.05;

  // Pixel displacement — 1 m = 60 px
  const dispPx = disp * 60;
  const m1_dy = a >= 0 ? -dispPx : dispPx;
  const m2_dy = a >= 0 ? dispPx : -dispPx;

  const m1_y = massRestY + m1_dy;
  const m2_y = massRestY + m2_dy;

  const NUM_SPOKES = 8;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="w-full">
          {/* Grid */}
          <defs>
            <pattern id="pgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="wheel-grad" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#fef9ee" />
              <stop offset="100%" stopColor="#fde68a" />
            </radialGradient>
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="url(#pgrid)" />

          {/* Ceiling beam */}
          <rect x={CX - 80} y={0} width={160} height={16} rx={3} fill="#94a3b8" />
          <rect x={CX - 6} y={16} width={12} height={WHEEL_Y - WHEEL_R - 16} fill="#64748b" />

          {/* Ropes hang straight down from wheel edges — wheel drawn on top covers the overlap */}
          <line x1={leftX} y1={WHEEL_Y} x2={leftX} y2={m1_y} stroke="#475569" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={rightX} y1={WHEEL_Y} x2={rightX} y2={m2_y} stroke="#475569" strokeWidth={2.5} strokeLinecap="round" />

          {/* Wheel shadow */}
          <circle cx={CX + 2} cy={WHEEL_Y + 2} r={WHEEL_R} fill="rgba(0,0,0,0.07)" />

          {/* Wheel body */}
          <circle cx={CX} cy={WHEEL_Y} r={WHEEL_R} fill="url(#wheel-grad)" stroke="#d97706" strokeWidth={3} />

          {/* Spokes (rotate with wheel) */}
          {Array.from({ length: NUM_SPOKES }).map((_, i) => {
            const a_spoke = wheelAngle + (i * Math.PI * 2) / NUM_SPOKES;
            return (
              <line
                key={i}
                x1={CX} y1={WHEEL_Y}
                x2={CX + (WHEEL_R - 6) * Math.cos(a_spoke)}
                y2={WHEEL_Y + (WHEEL_R - 6) * Math.sin(a_spoke)}
                stroke="#b45309"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}

          {/* Wheel rim */}
          <circle cx={CX} cy={WHEEL_Y} r={WHEEL_R} fill="none" stroke="#d97706" strokeWidth={3} />
          {/* Rope groove on wheel */}
          <circle cx={CX} cy={WHEEL_Y} r={WHEEL_R - 5} fill="none" stroke="#fbbf24" strokeWidth={1} strokeDasharray="4,3" />
          {/* Axle */}
          <circle cx={CX} cy={WHEEL_Y} r={7} fill="#b45309" />
          <circle cx={CX} cy={WHEEL_Y} r={3} fill="#92400e" />

          {/* Radius label */}
          {!running && (
            <>
              <line x1={CX} y1={WHEEL_Y} x2={CX + WHEEL_R * 0.65} y2={WHEEL_Y - WHEEL_R * 0.65}
                stroke="#d97706" strokeWidth={1} strokeDasharray="3,2" />
              <text x={CX + WHEEL_R * 0.7 + 2} y={WHEEL_Y - WHEEL_R * 0.7 - 2} fontSize={10} fill="#b45309" fontWeight="bold">
                R={R_m} m
              </text>
            </>
          )}

          {/* Mass 1 (left) */}
          <rect
            x={leftX - MASS_W / 2} y={m1_y}
            width={MASS_W} height={MASS_H}
            rx={4} fill="#216869" stroke="#174f50" strokeWidth={1.5}
          />
          <text x={leftX} y={m1_y + MASS_H / 2 + 4} textAnchor="middle" fontSize={11} fill="white" fontWeight="bold">
            {fmt(m1, 1)} kg
          </text>

          {/* Mass 2 (right) */}
          <rect
            x={rightX - MASS_W / 2} y={m2_y}
            width={MASS_W} height={MASS_H}
            rx={4} fill="#216869" stroke="#174f50" strokeWidth={1.5}
          />
          <text x={rightX} y={m2_y + MASS_H / 2 + 4} textAnchor="middle" fontSize={11} fill="white" fontWeight="bold">
            {fmt(m2, 1)} kg
          </text>

          {/* Tension labels */}
          {running && (
            <>
              <text x={leftX - 38} y={massRestY - 40} fontSize={10} fill="#7c3aed" textAnchor="middle" fontWeight="bold">
                T₁={fmt(T1, 1)}N
              </text>
              <text x={rightX + 38} y={massRestY - 40} fontSize={10} fill="#7c3aed" textAnchor="middle" fontWeight="bold">
                T₂={fmt(T2, 1)}N
              </text>
            </>
          )}

          {/* Velocity arrows when running */}
          {running && dispPx > 5 && (
            <>
              {/* Arrow on lighter mass (going up) */}
              {a >= 0 && (
                <polygon
                  points={`${leftX},${m1_y - 8} ${leftX - 5},${m1_y + 2} ${leftX + 5},${m1_y + 2}`}
                  fill="#10b981"
                />
              )}
              {/* Arrow on heavier mass (going down) */}
              {a >= 0 && (
                <polygon
                  points={`${rightX},${m2_y + MASS_H + 8} ${rightX - 5},${m2_y + MASS_H - 2} ${rightX + 5},${m2_y + MASS_H - 2}`}
                  fill="#ef4444"
                />
              )}
            </>
          )}

          <text x={8} y={18} fontSize={11} fill="#64748b" fontWeight="600">Fixed Pulley — Atwood Machine</text>

          {/* Balanced indicator */}
          {balanced && (
            <text x={CX} y={massRestY + MASS_H + 28} textAnchor="middle" fontSize={12} fill="#10b981" fontWeight="bold">
              ⚖ Balanced — equal masses, no net acceleration
            </text>
          )}
        </svg>
      </div>

      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Run Simulation" runningLabel="Simulating…" />

      <GuidedBreakdown step={step} steps={STEPS} onStepChange={setStep} />

      <InfoPanels
        given={[
          ["m₁", `${fmt(m1, 1)} kg`],
          ["m₂", `${fmt(m2, 1)} kg`],
          ["R", `${R_m} m`],
          ["M_pulley", `${M_p} kg`],
          ["g", `${g} m/s²`],
        ]}
        equations={[
          "a = (m₂−m₁)g / (m₁+m₂+½M)",
          "I = ½MR²  →  I/R² = ½M",
          "T₁ = m₁(g+a)",
          "T₂ = m₂(g−a)",
          "ω = v/R  (rad/s per m/s)",
        ]}
        results={[
          ["Acceleration", `${fmt(a, 3)} m/s²`],
          ["Tension T₁", `${fmt(T1, 2)} N`],
          ["Tension T₂", `${fmt(T2, 2)} N`],
          ["I/R² (eff.)", `${fmt(I_eff, 3)} kg`],
          ["ω/v", `${fmt(1 / R_m, 2)} rad/(m/s)`],
        ]}
      />
    </div>
  );
}
