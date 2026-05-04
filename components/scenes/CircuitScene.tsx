"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clamp, InfoPanels, SceneActions, SCENE_H, SCENE_W } from "@/components/scenes/_shared";
import type { CircuitSolution } from "@/lib/physics/presets";
import type { CompoundScene } from "@/lib/physics/types";

const CD_RECT = { x: 110, y: 150, w: 540, h: 220 };
const CD_BAT_X = CD_RECT.x;
const CD_BAT_MID_Y = CD_RECT.y + CD_RECT.h / 2;
const CD_PERIM = 2 * (CD_RECT.w + CD_RECT.h);

export default function CircuitScene({ scene, solution }: { scene: CompoundScene; solution: CircuitSolution }) {
  const battery = scene.components.find((c) => c.kind === "battery");
  const resistors = scene.components.filter((c) => c.kind === "resistor" || c.kind === "capacitor");
  const [running, setRunning] = useState(false);
  const [dotPos, setDotPos] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const dotSpeed = clamp(solution.current * 700, 60, 600);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setRunning(true);
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      setDotPos((dotSpeed * (now - startRef.current) / 1000) % CD_PERIM);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [dotSpeed]);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setDotPos(0);
    startRef.current = null;
  }, []);

  useEffect(() => () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); }, []);

  function dotCoords(pos: number): { x: number; y: number } {
    const p = pos % CD_PERIM;
    const top = CD_RECT.w, right = CD_RECT.h, bot = CD_RECT.w;
    if (p < top) return { x: CD_RECT.x + p, y: CD_RECT.y };
    if (p < top + right) return { x: CD_RECT.x + CD_RECT.w, y: CD_RECT.y + (p - top) };
    if (p < top + right + bot) return { x: CD_RECT.x + CD_RECT.w - (p - top - right), y: CD_RECT.y + CD_RECT.h };
    return { x: CD_RECT.x, y: CD_RECT.y + CD_RECT.h - (p - top - right - bot) };
  }

  const dots = Array.from({ length: 5 }, (_, i) => dotCoords((dotPos + i * CD_PERIM / 5) % CD_PERIM));

  // Resistors spaced evenly along top wire
  const spacing = CD_RECT.w / (resistors.length + 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-label="Series circuit">
          <rect width={SCENE_W} height={SCENE_H} fill="#eef5f1" />

          {/* Circuit loop */}
          <rect x={CD_RECT.x} y={CD_RECT.y} width={CD_RECT.w} height={CD_RECT.h}
            fill="none" stroke="#172033" strokeWidth={4} rx={8} />

          {/* Battery on left side */}
          <line x1={CD_BAT_X} y1={CD_BAT_MID_Y - 30} x2={CD_BAT_X} y2={CD_BAT_MID_Y + 30}
            stroke="#eef5f1" strokeWidth={9} />
          <line x1={CD_BAT_X - 18} y1={CD_BAT_MID_Y - 18} x2={CD_BAT_X + 18} y2={CD_BAT_MID_Y - 18}
            stroke="#dc2626" strokeWidth={5} />
          <line x1={CD_BAT_X - 11} y1={CD_BAT_MID_Y - 6} x2={CD_BAT_X + 11} y2={CD_BAT_MID_Y - 6}
            stroke="#172033" strokeWidth={5} />
          <line x1={CD_BAT_X - 18} y1={CD_BAT_MID_Y + 6} x2={CD_BAT_X + 18} y2={CD_BAT_MID_Y + 6}
            stroke="#172033" strokeWidth={5} />
          <text x={CD_BAT_X - 52} y={CD_BAT_MID_Y + 5} fill="#172033" fontSize={14} fontWeight={700}>EMF</text>
          <text x={CD_BAT_X - 52} y={CD_BAT_MID_Y + 22} fill="#172033" fontSize={13}>{battery?.props.voltage} V</text>
          <text x={CD_BAT_X + 22} y={CD_BAT_MID_Y - 12} fill="#dc2626" fontSize={14} fontWeight={800}>+</text>
          <text x={CD_BAT_X + 22} y={CD_BAT_MID_Y + 12} fill="#334155" fontSize={14}>−</text>

          {/* Current label */}
          <text x={SCENE_W / 2} y={CD_RECT.y - 18} textAnchor="middle" fill="#172033" fontSize={14} fontWeight={700}>
            I = {solution.current.toFixed(3)} A
          </text>

          {/* Resistors / capacitors as zigzag symbols on top wire */}
          {resistors.map((r, i) => {
            const cx = CD_RECT.x + spacing * (i + 1);
            const cy = CD_RECT.y;
            const vDrop = solution.drops.find((d) => d.componentId === r.id)?.voltage ?? 0;
            const resVal = Number(r.props.resistance ?? 0);
            const label = resVal > 0 ? `${resVal} Ω` : r.label;

            if (r.kind === "capacitor") {
              const capVal = Number(r.props.capacitance ?? 0);
              const capLabel = capVal > 0 ? `${capVal} F` : r.label;
              return (
                <g key={r.id}>
                  <line x1={cx - 30} y1={cy} x2={cx + 30} y2={cy} stroke="#eef5f1" strokeWidth={9} />
                  <line x1={cx - 10} y1={cy - 14} x2={cx - 10} y2={cy + 14} stroke="#10b981" strokeWidth={4} />
                  <line x1={cx + 10} y1={cy - 14} x2={cx + 10} y2={cy + 14} stroke="#10b981" strokeWidth={4} />
                  <line x1={cx - 30} y1={cy} x2={cx - 10} y2={cy} stroke="#172033" strokeWidth={4} />
                  <line x1={cx + 10} y1={cy} x2={cx + 30} y2={cy} stroke="#172033" strokeWidth={4} />
                  <text x={cx} y={cy - 22} textAnchor="middle" fill="#172033" fontSize={12} fontWeight={700}>{capLabel}</text>
                  <text x={cx} y={cy + 28} textAnchor="middle" fill="#64748b" fontSize={11}>{vDrop.toFixed(2)} V</text>
                </g>
              );
            }

            const hw = 30; const zh = 10;
            const pts = [
              `${cx - hw},${cy}`,
              `${cx - hw * 0.6},${cy - zh}`,
              `${cx - hw * 0.2},${cy + zh}`,
              `${cx + hw * 0.2},${cy - zh}`,
              `${cx + hw * 0.6},${cy + zh}`,
              `${cx + hw},${cy}`,
            ].join(" ");
            return (
              <g key={r.id}>
                <line x1={cx - hw} y1={cy} x2={cx + hw} y2={cy} stroke="#eef5f1" strokeWidth={9} />
                <polyline points={pts} fill="none" stroke="#216869" strokeWidth={3.5}
                  strokeLinecap="round" strokeLinejoin="round" />
                <text x={cx} y={cy - 22} textAnchor="middle" fill="#172033" fontSize={12} fontWeight={700}>{label}</text>
                <text x={cx} y={cy + 28} textAnchor="middle" fill="#64748b" fontSize={11}>{vDrop.toFixed(2)} V</text>
              </g>
            );
          })}

          {/* Animated current dots */}
          {running && dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={5} fill="#f2c14e" />
          ))}
        </svg>
      </div>
      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Close Circuit" runningLabel="Current Flowing…" />
      <InfoPanels
        given={[["EMF", `${battery?.props.voltage} V`], ["R_total", `${solution.totalResistance} Ω`]]}
        equations={["I = V / R_total", "V_drop = I × R"]}
        results={[
          ["Current I", `${solution.current.toFixed(4)} A`, "green"],
          ...solution.drops.map((d) => [d.label, `${d.voltage.toFixed(3)} V`] as [string, string]),
        ]}
      />
    </div>
  );
}
