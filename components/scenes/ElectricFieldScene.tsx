"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  ArrowMarker, clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

const K = 8.99e9; // N·m²/C²

function metrics(config: SimulationConfig) {
  const q1_uC = clamp(config.params.charge1 ?? 5, -10, 10);
  const q2_uC = clamp(config.params.charge2 ?? -3, -10, 10);
  const d = clamp(config.params.separation ?? 1, 0.1, 2);
  const q1 = q1_uC * 1e-6;
  const q2 = q2_uC * 1e-6;
  const F = K * Math.abs(q1) * Math.abs(q2) / (d * d);
  const attractive = Math.sign(q1) !== Math.sign(q2);
  return { q1_uC, q2_uC, q1, q2, d, F, attractive };
}

const STEPS = [
  {
    title: "Charge Signs",
    equation: "+ attracts −, like charges repel",
    notice: "The sign of each charge determines whether the force is attractive or repulsive.",
    diagram: "Red circles are positive charges, blue circles are negative. Opposite signs pull toward each other.",
  },
  {
    title: "Field Lines",
    equation: "E-field exits + charges, enters − charges",
    notice: "Electric field lines show the direction a positive test charge would move.",
    diagram: "Lines leaving the positive charge curve toward the negative charge (if opposite) or away (if same sign).",
  },
  {
    title: "Coulomb Force",
    equation: "F = kq₁q₂/r²",
    notice: "Force drops with the square of distance — doubling the separation quarters the force.",
    diagram: "The force arrows on each charge point toward (attractive) or away from (repulsive) the other charge.",
  },
  {
    title: "Force Magnitude",
    equation: "k = 8.99 × 10⁹ N·m²/C²",
    notice: "Even microcoulomb charges generate large forces at small separations because k is enormous.",
    diagram: "The force arrow lengths encode the calculated F value for the current parameters.",
  },
];

const Q1_X = 240;
const Q2_X = 520;
const CY = SCENE_H / 2 + 20;
const R = 24;

function chargeColor(q: number) {
  return q >= 0 ? "#dc2626" : "#2563eb";
}

export default function ElectricFieldScene({ config, onOutcome }: SceneProps) {
  const m = useMemo(() => metrics(config), [config]);
  const [guidedStep, setGuidedStep] = useState(1);
  const [running, setRunning] = useState(false);
  const [pulseFrame, setPulseFrame] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [m.q1_uC, m.q2_uC, m.d, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setRunning(true);
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      setPulseFrame(Math.floor((now - startRef.current) / 100) % 20);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { F: m.F, q1: m.q1_uC, q2: m.q2_uC, d: m.d } });
  }, [m, onOutcome]);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setPulseFrame(0);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [onOutcome]);

  const goToStep = (s: number) => {
    setGuidedStep(clamp(s, 1, 4));
    if (s >= 2 && !running) run();
  };

  const c1 = chargeColor(m.q1_uC);
  const c2 = chargeColor(m.q2_uC);
  const forceLen = clamp(m.F / 2, 10, 100);

  // Field lines — draw 6 lines from q1 spreading out
  const numLines = 8;
  const fieldLines = Array.from({ length: numLines }, (_, i) => {
    const a = (i / numLines) * 2 * Math.PI;
    const startX = Q1_X + Math.cos(a) * (R + 2);
    const startY = CY + Math.sin(a) * (R + 2);
    let endX: number;
    let endY: number;
    if (m.attractive) {
      // curve toward q2
      const t = 0.6;
      endX = Q2_X - Math.cos(a) * (R + 2);
      endY = CY - Math.sin(a) * (R + 2);
    } else {
      // radiate outward
      endX = startX + Math.cos(a) * 120;
      endY = startY + Math.sin(a) * 120;
    }
    const cx1 = startX + Math.cos(a) * 60;
    const cy1 = startY + Math.sin(a) * 60;
    return `M ${startX} ${startY} Q ${cx1} ${cy1} ${endX} ${endY}`;
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Electric field visualization">
          <defs>
            <ArrowMarker id="ef-arr" />
            <ArrowMarker id="ef-red" color="#dc2626" />
            <ArrowMarker id="ef-blue" color="#2563eb" />
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />

          {/* Field lines (step 2+) */}
          {guidedStep >= 2 && fieldLines.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#ef-arr)" opacity="0.6" />
          ))}

          {/* Separation line */}
          <line x1={Q1_X} y1={CY} x2={Q2_X} y2={CY} stroke="#172033" strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />
          <text x={(Q1_X + Q2_X) / 2} y={CY - 14} textAnchor="middle" fill="#172033" fontSize="13" fontWeight="700">
            d = {fmt(m.d, 2)} m
          </text>

          {/* Force arrows (step 3+) */}
          {guidedStep >= 3 && m.attractive && (
            <>
              <g color="#dc2626" stroke="currentColor" markerEnd="url(#ef-red)" strokeWidth="4">
                <line x1={Q1_X + R + 4} y1={CY} x2={Q1_X + R + 4 + forceLen} y2={CY} />
              </g>
              <g color="#2563eb" stroke="currentColor" markerEnd="url(#ef-blue)" strokeWidth="4">
                <line x1={Q2_X - R - 4} y1={CY} x2={Q2_X - R - 4 - forceLen} y2={CY} />
              </g>
            </>
          )}
          {guidedStep >= 3 && !m.attractive && (
            <>
              <g color="#dc2626" stroke="currentColor" markerEnd="url(#ef-red)" strokeWidth="4">
                <line x1={Q1_X - R - 4} y1={CY} x2={Q1_X - R - 4 - forceLen} y2={CY} />
              </g>
              <g color="#2563eb" stroke="currentColor" markerEnd="url(#ef-blue)" strokeWidth="4">
                <line x1={Q2_X + R + 4} y1={CY} x2={Q2_X + R + 4 + forceLen} y2={CY} />
              </g>
            </>
          )}

          {/* Charge circles */}
          <circle cx={Q1_X} cy={CY} r={R} fill={c1} stroke="#172033" strokeWidth="3" />
          <text x={Q1_X} y={CY + 5} textAnchor="middle" fill="white" fontSize="16" fontWeight="900">
            {m.q1_uC > 0 ? "+" : "−"}
          </text>
          <text x={Q1_X} y={CY + R + 18} textAnchor="middle" fill="#172033" fontSize="13" fontWeight="700">
            {fmt(m.q1_uC, 1)} μC
          </text>

          <circle cx={Q2_X} cy={CY} r={R} fill={c2} stroke="#172033" strokeWidth="3" />
          <text x={Q2_X} y={CY + 5} textAnchor="middle" fill="white" fontSize="16" fontWeight="900">
            {m.q2_uC > 0 ? "+" : "−"}
          </text>
          <text x={Q2_X} y={CY + R + 18} textAnchor="middle" fill="#172033" fontSize="13" fontWeight="700">
            {fmt(m.q2_uC, 1)} μC
          </text>

          {/* Info */}
          <text x={24} y={36} fill="#172033" fontSize="15" fontWeight="700">
            F = {fmt(m.F, 2)} N ({m.attractive ? "attractive" : "repulsive"})
          </text>
        </svg>
      </div>
      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Show Field" runningLabel="Showing…" />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />
      <InfoPanels
        given={[["q₁", `${fmt(m.q1_uC, 1)} μC`], ["q₂", `${fmt(m.q2_uC, 1)} μC`], ["d", `${fmt(m.d, 2)} m`]]}
        equations={["F = kq₁q₂/r²", "k = 8.99×10⁹", "F > 0: repulsive", "F < 0: attractive"]}
        results={[
          ["Coulomb force", `${fmt(m.F, 4)} N`, "green"],
          ["Interaction", m.attractive ? "Attractive" : "Repulsive"],
          ["Distance", `${fmt(m.d, 2)} m`],
        ]}
      />
    </div>
  );
}
