"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

function metrics(config: SimulationConfig) {
  const V = clamp(config.params.voltage ?? 12, 1, 24);
  const R = clamp(config.params.resistance ?? 40, 1, 100);
  const r = clamp(config.params.internal_resistance ?? 2, 0, 10);
  const I = V / (R + r);
  const Vt = V - I * r;
  const P_ext = I * I * R;
  const P_int = I * I * r;
  return { V, R, r, I, Vt, P_ext, P_int };
}

const STEPS = [
  {
    title: "Voltage Source",
    equation: "EMF = V",
    notice: "The battery provides electromotive force (EMF). Internal resistance reduces the terminal voltage available to the circuit.",
    diagram: "The battery symbol is on the left. The longer line is the positive terminal.",
  },
  {
    title: "Ohm's Law",
    equation: "I = V / (R + r)",
    notice: "Current is determined by total resistance — external R plus internal r. More resistance, less current.",
    diagram: "Current flows clockwise from positive terminal through the resistor and back.",
  },
  {
    title: "Terminal Voltage",
    equation: "V_t = V − Ir",
    notice: "Internal resistance causes a voltage drop inside the battery, so the terminal voltage is less than the EMF.",
    diagram: "The difference between EMF and terminal voltage is the internal voltage drop I·r.",
  },
  {
    title: "Power Dissipation",
    equation: "P = I²R",
    notice: "Power dissipated in each resistor depends on current squared times resistance — higher current wastes much more energy.",
    diagram: "The external resistor dissipates P_ext, and the internal resistance wastes P_int as heat inside the battery.",
  },
];

// Circuit layout coordinates
const RECT = { x: 140, y: 150, w: 480, h: 220 };
const BAT_X = RECT.x;
const BAT_MID_Y = RECT.y + RECT.h / 2;
const RES_X = RECT.x + RECT.w;
const RES_MID_Y = BAT_MID_Y;

function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={5} fill="#f2c14e" />;
}

export default function OhmLawScene({ config, onOutcome }: SceneProps) {
  const m = useMemo(() => metrics(config), [config]);
  const [guidedStep, setGuidedStep] = useState(1);
  const [running, setRunning] = useState(false);
  const [dotPos, setDotPos] = useState(0); // 0..1 around the circuit
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // Circuit perimeter (approximate) for dot animation
  const perim = 2 * (RECT.w + RECT.h);
  const dotSpeed = clamp(m.I * 600, 80, 800); // px per second

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setDotPos(0);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [m.V, m.R, m.r, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setRunning(true);

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      setDotPos((dotSpeed * elapsed) % perim);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { I: m.I, Vt: m.Vt, P_ext: m.P_ext } });
  }, [m, dotSpeed, perim, onOutcome]);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setDotPos(0);
    startRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [onOutcome]);

  const goToStep = (s: number) => {
    setGuidedStep(clamp(s, 1, 4));
    if (s >= 2 && !running) run();
  };

  // Map dotPos (px around rect) to (x,y)
  function dotCoords(pos: number): { x: number; y: number } {
    const p = pos % perim;
    const top = RECT.w;
    const right = RECT.h;
    const bot = RECT.w;
    const left = RECT.h;
    if (p < top) return { x: RECT.x + p, y: RECT.y };
    if (p < top + right) return { x: RECT.x + RECT.w, y: RECT.y + (p - top) };
    if (p < top + right + bot) return { x: RECT.x + RECT.w - (p - top - right), y: RECT.y + RECT.h };
    return { x: RECT.x, y: RECT.y + RECT.h - (p - top - right - bot) };
  }

  // Multiple dots staggered
  const dots = Array.from({ length: 5 }, (_, i) => dotCoords((dotPos + i * perim / 5) % perim));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Ohm's law circuit visualization">
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />

          {/* Circuit wire */}
          <rect
            x={RECT.x} y={RECT.y} width={RECT.w} height={RECT.h}
            fill="none" stroke="#172033" strokeWidth="4" rx="8"
          />

          {/* Battery symbol (left side) */}
          <line x1={BAT_X} y1={BAT_MID_Y - 28} x2={BAT_X} y2={BAT_MID_Y + 28} stroke="#eef5f1" strokeWidth="8" />
          <line x1={BAT_X - 16} y1={BAT_MID_Y - 18} x2={BAT_X + 16} y2={BAT_MID_Y - 18} stroke="#dc2626" strokeWidth="5" />
          <line x1={BAT_X - 10} y1={BAT_MID_Y + 6} x2={BAT_X + 10} y2={BAT_MID_Y + 6} stroke="#172033" strokeWidth="5" />
          <line x1={BAT_X - 16} y1={BAT_MID_Y - 6} x2={BAT_X + 16} y2={BAT_MID_Y - 6} stroke="#172033" strokeWidth="5" />
          <text x={BAT_X - 56} y={BAT_MID_Y + 5} fill="#172033" fontSize="14" fontWeight="700">EMF</text>
          <text x={BAT_X - 56} y={BAT_MID_Y + 22} fill="#172033" fontSize="13">{fmt(m.V, 0)} V</text>

          {/* Internal resistance label */}
          {guidedStep >= 2 && (
            <text x={BAT_X - 5} y={RECT.y - 12} fill="#6b7280" fontSize="12" fontWeight="600">r={fmt(m.r, 1)}Ω</text>
          )}

          {/* External resistor (right side, zigzag) */}
          {(() => {
            const rx = RES_X;
            const ry = RES_MID_Y;
            const h2 = 36;
            const pts = [
              `${rx},${ry - h2}`,
              `${rx - 14},${ry - h2 + 12}`,
              `${rx + 14},${ry - h2 + 24}`,
              `${rx - 14},${ry - h2 + 36}`,
              `${rx + 14},${ry - h2 + 48}`,
              `${rx},${ry + h2}`,
            ].join(" ");
            return (
              <>
                <polyline points={pts} fill="none" stroke="#eef5f1" strokeWidth="8" strokeLinecap="round" />
                <polyline points={pts} fill="none" stroke="#216869" strokeWidth="4" strokeLinecap="round" />
              </>
            );
          })()}
          <text x={RES_X + 20} y={RES_MID_Y + 5} fill="#172033" fontSize="14" fontWeight="700">R={fmt(m.R, 0)} Ω</text>

          {/* Current dots */}
          {running && dots.map((d, i) => <Dot key={i} x={d.x} y={d.y} />)}

          {/* Labels */}
          <text x={SCENE_W / 2} y={RECT.y - 18} textAnchor="middle" fill="#172033" fontSize="14" fontWeight="700">
            I = {fmt(m.I, 3)} A
          </text>
          <text x={24} y={36} fill="#172033" fontSize="15" fontWeight="700">V_t = {fmt(m.Vt, 2)} V</text>
          <text x={24} y={60} fill="#172033" fontSize="15" fontWeight="700">P = {fmt(m.P_ext, 2)} W</text>
        </svg>
      </div>
      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Close Circuit" runningLabel="Current Flowing…" />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />
      <InfoPanels
        given={[["V (EMF)", `${fmt(m.V, 0)} V`], ["R", `${fmt(m.R, 0)} Ω`], ["r", `${fmt(m.r, 1)} Ω`]]}
        equations={["I = V/(R+r)", "V_t = V−Ir", "P = I²R", "P_int = I²r"]}
        results={[
          ["Current I", `${fmt(m.I, 4)} A`, "green"],
          ["Terminal voltage V_t", `${fmt(m.Vt, 2)} V`],
          ["External power P", `${fmt(m.P_ext, 3)} W`, "green"],
          ["Internal power loss", `${fmt(m.P_int, 3)} W`],
        ]}
      />
    </div>
  );
}
