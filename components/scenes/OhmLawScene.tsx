"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

function metrics(config: SimulationConfig) {
  const emf = clamp(config.params.voltage ?? 12, 1, 24);
  const resistance = clamp(config.params.resistance ?? 40, 1, 100);
  const internalResistance = clamp(config.params.internal_resistance ?? 0, 0, 10);
  const current = emf / (resistance + internalResistance);
  const terminalVoltage = current * resistance;
  const externalPower = current * current * resistance;
  const internalPower = current * current * internalResistance;
  return { emf, resistance, internalResistance, current, terminalVoltage, externalPower, internalPower };
}

const EPSILON = "\u03b5";
const OMEGA = "\u03a9";
const V_T = "V\u209c";
const P_EXT = "P\u2091\u2093\u209c";
const P_INT = "P\u1d62\u2099\u209c";

const STEPS = [
  {
    title: "Battery / EMF",
    equation: `${EPSILON} = source voltage`,
    notice: "The battery provides electromotive force, the source voltage that drives charge around the circuit.",
    diagram: "The battery on the left is highlighted as the energy source.",
  },
  {
    title: "Total Resistance",
    equation: `R_total = R + r`,
    notice: "External resistance R and internal resistance r both limit current.",
    diagram: "The load resistor and the small internal-loss element are highlighted together.",
  },
  {
    title: "Current",
    equation: `I = ${EPSILON} / (R + r)`,
    notice: "Higher source voltage drives more current; higher total resistance reduces current.",
    diagram: "The moving dots show conventional current around the wire path.",
  },
  {
    title: "Terminal Voltage and Power",
    equation: `${V_T} = IR,  ${P_EXT} = I\u00b2R`,
    notice: "Terminal voltage is what reaches the external load. Internal resistance turns some power into heat inside the source.",
    diagram: "The external resistor is highlighted as the useful load, while internal loss is shown near the battery when r is nonzero.",
  },
];

const RECT = { x: 140, y: 150, w: 480, h: 220 };
const BAT_X = RECT.x;
const BAT_MID_Y = RECT.y + RECT.h / 2;
const RES_X = RECT.x + RECT.w;
const RES_MID_Y = BAT_MID_Y;
const PERIMETER = 2 * (RECT.w + RECT.h);

function zigzagPoints(x: number, y: number, height = 72, width = 14) {
  const top = y - height / 2;
  return [
    `${x},${top}`,
    `${x - width},${top + 12}`,
    `${x + width},${top + 24}`,
    `${x - width},${top + 36}`,
    `${x + width},${top + 48}`,
    `${x},${top + height}`,
  ].join(" ");
}

function dotCoords(pos: number): { x: number; y: number; nearResistor: boolean } {
  const p = ((pos % PERIMETER) + PERIMETER) % PERIMETER;
  if (p < RECT.w) return { x: RECT.x + p, y: RECT.y, nearResistor: p > RECT.w - 70 };
  if (p < RECT.w + RECT.h) {
    const y = RECT.y + (p - RECT.w);
    return { x: RECT.x + RECT.w, y, nearResistor: Math.abs(y - RES_MID_Y) < 62 };
  }
  if (p < RECT.w * 2 + RECT.h) return { x: RECT.x + RECT.w - (p - RECT.w - RECT.h), y: RECT.y + RECT.h, nearResistor: p < RECT.w + RECT.h + 70 };
  return { x: RECT.x, y: RECT.y + RECT.h - (p - RECT.w * 2 - RECT.h), nearResistor: false };
}

function ChargeDot({ x, y, nearResistor, index }: { x: number; y: number; nearResistor: boolean; index: number }) {
  const offset = nearResistor ? ((index % 3) - 1) * 5 : 0;
  return (
    <circle
      cx={x + (nearResistor ? offset : 0)}
      cy={y + (nearResistor ? -offset : 0)}
      r={nearResistor ? 4.3 : 5}
      fill={nearResistor ? "#f59e0b" : "#f2c14e"}
      stroke="#92400e"
      strokeWidth="1"
      opacity={nearResistor ? 0.95 : 0.85}
    />
  );
}

export default function OhmLawScene({ config, onOutcome }: SceneProps) {
  const m = useMemo(() => metrics(config), [config]);
  const [guidedStep, setGuidedStep] = useState(1);
  const [running, setRunning] = useState(false);
  const [dotPos, setDotPos] = useState(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const speedRef = useRef(0);

  const dotCount = Math.round(clamp(5 + m.current * 18, 6, 12));
  const dotSpeed = clamp(m.current * 900, 55, 900);
  speedRef.current = dotSpeed;
  const current = m.current;
  const terminalVoltage = m.terminalVoltage;
  const externalPower = m.externalPower;
  const internalPower = m.internalPower;

  useEffect(() => {
    onOutcome({
      launched: running,
      success: true,
      metrics: {
        current_a: current,
        terminal_voltage_v: terminalVoltage,
        external_power_w: externalPower,
        internal_power_w: internalPower,
      },
    });
  }, [current, terminalVoltage, externalPower, internalPower, running, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(true);
    lastFrameRef.current = null;

    const tick = (now: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = now;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      setDotPos((pos) => (pos + speedRef.current * dt) % PERIMETER);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setDotPos(0);
    lastFrameRef.current = null;
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [onOutcome]);

  const goToStep = (s: number) => {
    const next = clamp(s, 1, 4);
    setGuidedStep(next);
    if (next === 3 && !running) run();
  };

  const dots = Array.from({ length: dotCount }, (_, index) => dotCoords(dotPos + (index * PERIMETER) / dotCount));
  const resistorCrowd = Array.from({ length: Math.round(clamp(m.resistance / 18, 2, 6)) }, (_, index) => ({
    x: RES_X + (index % 2 === 0 ? -10 : 10),
    y: RES_MID_Y - 44 + index * 17,
  }));

  const highlightBattery = guidedStep === 1;
  const highlightResistance = guidedStep === 2;
  const highlightCurrent = guidedStep === 3;
  const highlightLoad = guidedStep === 4;
  const activeClass = "drop-shadow-[0_0_10px_rgba(242,193,78,0.95)]";
  const activeStroke = (active: boolean, base = "#172033") => active ? "#f2c14e" : base;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Ohm's law circuit visualization">
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />

          <rect x={RECT.x} y={RECT.y} width={RECT.w} height={RECT.h} fill="none" stroke={activeStroke(highlightCurrent)} strokeWidth={highlightCurrent ? 6 : 4} rx="8" />

          <g className={highlightBattery ? activeClass : ""}>
            <rect x={BAT_X - 42} y={BAT_MID_Y - 58} width="84" height="116" rx="10" fill={highlightBattery ? "#fff7d6" : "#eef5f1"} stroke={activeStroke(highlightBattery)} strokeWidth={highlightBattery ? 3 : 1.5} />
            <line x1={BAT_X} y1={BAT_MID_Y - 34} x2={BAT_X} y2={BAT_MID_Y + 34} stroke="#eef5f1" strokeWidth="10" />
            <line x1={BAT_X - 18} y1={BAT_MID_Y - 20} x2={BAT_X + 18} y2={BAT_MID_Y - 20} stroke="#dc2626" strokeWidth="5" />
            <line x1={BAT_X - 11} y1={BAT_MID_Y + 9} x2={BAT_X + 11} y2={BAT_MID_Y + 9} stroke="#172033" strokeWidth="5" />
            <line x1={BAT_X - 16} y1={BAT_MID_Y - 5} x2={BAT_X + 16} y2={BAT_MID_Y - 5} stroke="#172033" strokeWidth="5" />
            <text x={BAT_X - 72} y={BAT_MID_Y - 12} fill="#172033" fontSize="14" fontWeight="800">{EPSILON}</text>
            <text x={BAT_X - 72} y={BAT_MID_Y + 8} fill="#172033" fontSize="13">{fmt(m.emf, 1)} V</text>
          </g>

          {m.internalResistance > 0 ? (
            <g className={highlightResistance || highlightLoad ? activeClass : ""}>
              <polyline points={zigzagPoints(BAT_X + 54, BAT_MID_Y, 48, 8)} fill="none" stroke="#eef5f1" strokeWidth="8" strokeLinecap="round" />
              <polyline points={zigzagPoints(BAT_X + 54, BAT_MID_Y, 48, 8)} fill="none" stroke={activeStroke(highlightResistance || highlightLoad, "#7c3aed")} strokeWidth={highlightResistance || highlightLoad ? 5 : 3.5} strokeLinecap="round" />
              <text x={BAT_X + 72} y={BAT_MID_Y + 5} fill="#6d28d9" fontSize="13" fontWeight="800">r = {fmt(m.internalResistance, 1)} {OMEGA}</text>
              {highlightLoad ? <text x={BAT_X + 72} y={BAT_MID_Y + 24} fill="#92400e" fontSize="12" fontWeight="700">internal loss</text> : null}
            </g>
          ) : null}

          <g className={highlightResistance || highlightLoad ? activeClass : ""}>
            <polyline points={zigzagPoints(RES_X, RES_MID_Y)} fill="none" stroke="#eef5f1" strokeWidth="10" strokeLinecap="round" />
            <polyline points={zigzagPoints(RES_X, RES_MID_Y)} fill="none" stroke={activeStroke(highlightResistance || highlightLoad, "#216869")} strokeWidth={highlightResistance || highlightLoad ? 6 : 4} strokeLinecap="round" />
            <text x={RES_X + 24} y={RES_MID_Y - 6} fill="#172033" fontSize="14" fontWeight="800">R = {fmt(m.resistance, 0)} {OMEGA}</text>
            <text x={RES_X + 24} y={RES_MID_Y + 14} fill="#475569" fontSize="12" fontWeight="700">external load</text>
          </g>

          {running ? dots.map((dot, index) => <ChargeDot key={index} {...dot} index={index} />) : null}
          {running ? resistorCrowd.map((dot, index) => (
            <circle key={`crowd-${index}`} cx={dot.x} cy={dot.y} r="3.5" fill="#f59e0b" opacity="0.55" />
          )) : null}

          <text x={SCENE_W / 2} y={RECT.y - 20} textAnchor="middle" fill="#172033" fontSize="15" fontWeight="800">
            I = {fmt(m.current, 3)} A
          </text>
          <text x={24} y={34} fill="#172033" fontSize="15" fontWeight="800">{V_T} = {fmt(m.terminalVoltage, 2)} V</text>
          <text x={24} y={58} fill="#172033" fontSize="15" fontWeight="800">{P_EXT} = {fmt(m.externalPower, 2)} W</text>
          {m.internalResistance > 0 ? <text x={24} y={82} fill="#7c3aed" fontSize="15" fontWeight="800">{P_INT} = {fmt(m.internalPower, 2)} W</text> : null}
        </svg>
      </div>

      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Start Current" runningLabel="Current Flowing..." />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />
      <InfoPanels
        given={[[EPSILON, `${fmt(m.emf, 1)} V`], ["R", `${fmt(m.resistance, 0)} ${OMEGA}`], ["r", `${fmt(m.internalResistance, 1)} ${OMEGA}`]]}
        equations={[`I = ${EPSILON}/(R+r)`, `${V_T} = IR = ${EPSILON} - Ir`, `${P_EXT} = I\u00b2R`, `${P_INT} = I\u00b2r`]}
        results={[
          ["Current I", `${fmt(m.current, 4)} A`, "green"],
          [`Terminal voltage ${V_T}`, `${fmt(m.terminalVoltage, 2)} V`, "green"],
          [`External power ${P_EXT}`, `${fmt(m.externalPower, 3)} W`],
          ...(m.internalResistance > 0 ? [[`Internal loss ${P_INT}`, `${fmt(m.internalPower, 3)} W`]] as [string, string][] : []),
        ]}
      />
    </div>
  );
}
