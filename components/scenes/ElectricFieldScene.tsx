"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationConfig } from "@/types/simulation";
import {
  ArrowMarker, clamp, fmt, GuidedBreakdown, InfoPanels, SceneActions,
  SCENE_H, SCENE_W, type SceneProps,
} from "./_shared";

const K = 8.99e9;
const PX_PER_M = 180;
const MIN_R_M = 0.08;
const R = 25;
const PAD = 42;

type ChargePoint = {
  id: number;
  label: string;
  q_uC: number;
  x: number;
  y: number;
};

const STEPS = [
  {
    title: "Identify Charges",
    equation: "q₁, q₂, q₃, q₄",
    notice: "The sign of each charge matters: positive charges are red, negative charges are blue.",
    diagram: "The highlighted charge circles are draggable. Move them to change the geometry.",
  },
  {
    title: "Measure Distance",
    equation: "r = distance between charge centers",
    notice: "Coulomb force depends on distance between each pair of charges.",
    diagram: "The dashed measurement line updates live as charges move.",
  },
  {
    title: "Coulomb's Law",
    equation: "F = k|q₁q₂|/r²",
    notice: "The displayed force values use real charge values and live distances. Arrow lengths are scaled for readability.",
    diagram: "Force arrows show the net direction on each charge from all other charges.",
  },
  {
    title: "Force Direction",
    equation: "opposites attract, likes repel",
    notice: "For multiple charges, every pair contributes a force; the net force combines those pairwise effects conceptually.",
    diagram: "Same-sign charges push away from each other, while opposite-sign charges pull toward each other.",
  },
];

function chargeColor(q: number) {
  return q >= 0 ? "#dc2626" : "#2563eb";
}

function chargeSign(q: number) {
  return q >= 0 ? "+" : "−";
}

function chargeValues(config: SimulationConfig) {
  const values = [1, 2, 3, 4]
    .map((n) => config.params[`charge${n}`])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .slice(0, 4)
    .map((value) => clamp(value, -10, 10));
  return values.length >= 2 ? values : [5, -3];
}

function defaultPositions(count: number, separation: number) {
  const centerX = SCENE_W / 2;
  const centerY = SCENE_H / 2 + 8;
  if (count === 2) {
    const half = clamp(separation, 0.35, 2.8) * PX_PER_M / 2;
    return [
      { x: clamp(centerX - half, PAD, SCENE_W - PAD), y: centerY },
      { x: clamp(centerX + half, PAD, SCENE_W - PAD), y: centerY },
    ];
  }

  const radius = count === 3 ? 132 : 150;
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      x: clamp(centerX + Math.cos(angle) * radius, PAD, SCENE_W - PAD),
      y: clamp(centerY + Math.sin(angle) * radius, PAD, SCENE_H - PAD),
    };
  });
}

function distanceMeters(a: ChargePoint, b: ChargePoint) {
  return Math.max(MIN_R_M, Math.hypot(a.x - b.x, a.y - b.y) / PX_PER_M);
}

function pairForce(a: ChargePoint, b: ChargePoint) {
  const r = distanceMeters(a, b);
  return K * Math.abs(a.q_uC * 1e-6) * Math.abs(b.q_uC * 1e-6) / (r * r);
}

function pairs(charges: ChargePoint[]) {
  const result: { a: ChargePoint; b: ChargePoint; r: number; force: number; attractive: boolean }[] = [];
  for (let i = 0; i < charges.length; i += 1) {
    for (let j = i + 1; j < charges.length; j += 1) {
      const a = charges[i];
      const b = charges[j];
      result.push({
        a,
        b,
        r: distanceMeters(a, b),
        force: pairForce(a, b),
        attractive: Math.sign(a.q_uC) !== Math.sign(b.q_uC),
      });
    }
  }
  return result;
}

function netForceVector(charge: ChargePoint, charges: ChargePoint[]) {
  return charges.reduce(
    (sum, other) => {
      if (other.id === charge.id) return sum;
      const dx = other.x - charge.x;
      const dy = other.y - charge.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const force = pairForce(charge, other);
      const toward = Math.sign(charge.q_uC) !== Math.sign(other.q_uC) ? 1 : -1;
      return {
        fx: sum.fx + toward * force * (dx / dist),
        fy: sum.fy + toward * force * (dy / dist),
      };
    },
    { fx: 0, fy: 0 }
  );
}

function fieldVectorAt(x: number, y: number, charges: ChargePoint[]) {
  return charges.reduce(
    (sum, charge) => {
      const dx = x - charge.x;
      const dy = y - charge.y;
      const d2 = Math.max(900, dx * dx + dy * dy);
      const d = Math.sqrt(d2);
      const strength = charge.q_uC / d2;
      return { x: sum.x + strength * (dx / d), y: sum.y + strength * (dy / d) };
    },
    { x: 0, y: 0 }
  );
}

export default function ElectricFieldScene({ config, onOutcome }: SceneProps) {
  const values = useMemo(() => chargeValues(config), [config]);
  const [positions, setPositions] = useState(() => defaultPositions(values.length, config.params.separation ?? 1));
  const [guidedStep, setGuidedStep] = useState(1);
  const [running, setRunning] = useState(false);
  const [pulseFrame, setPulseFrame] = useState(0);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [showFieldLines, setShowFieldLines] = useState(true);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setPositions(defaultPositions(values.length, config.params.separation ?? 1));
  }, [values.length, config.params.separation]);

  const charges = useMemo<ChargePoint[]>(
    () => values.map((q, index) => ({
      id: index + 1,
      label: `q${index + 1}`,
      q_uC: q,
      x: positions[index]?.x ?? defaultPositions(values.length, config.params.separation ?? 1)[index].x,
      y: positions[index]?.y ?? defaultPositions(values.length, config.params.separation ?? 1)[index].y,
    })),
    [values, positions, config.params.separation]
  );

  const pairData = useMemo(() => pairs(charges), [charges]);
  const closestPair = pairData.reduce((closest, pair) => (pair.r < closest.r ? pair : closest), pairData[0]);
  const primaryPair = pairData[0];
  const overlapWarning = pairData.some((pair) => pair.r <= MIN_R_M + 0.005);
  const primaryForce = primaryPair?.force ?? 0;
  const primaryInteraction = primaryPair?.attractive ? "Attractive" : "Repulsive";

  useEffect(() => {
    onOutcome({
      launched: running,
      success: true,
      metrics: {
        nearest_distance_m: closestPair?.r ?? 0,
        q1q2_force_n: primaryForce,
      },
    });
  }, [closestPair?.r, onOutcome, primaryForce, running]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    setGuidedStep((step) => Math.max(step, 3));
    setRunning(true);
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      setPulseFrame(Math.floor((now - startRef.current) / 90));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setPulseFrame(0);
    setPositions(defaultPositions(values.length, config.params.separation ?? 1));
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [config.params.separation, onOutcome, values.length]);

  const goToStep = (step: number) => {
    const next = clamp(step, 1, STEPS.length);
    setGuidedStep(next);
    if (next >= 3 && !running) run();
  };

  const pointerToScene = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: PAD, y: PAD };
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * SCENE_W, PAD, SCENE_W - PAD),
      y: clamp(((event.clientY - rect.top) / rect.height) * SCENE_H, PAD, SCENE_H - PAD),
    };
  };

  const moveCharge = (id: number, point: { x: number; y: number }) => {
    setPositions((current) => current.map((pos, index) => (index + 1 === id ? point : pos)));
  };

  const fieldVectors = useMemo(() => {
    const xs = [110, 205, 300, 395, 490, 585, 680];
    const ys = [110, 190, 270, 350, 430];
    return xs.flatMap((x) => ys.map((y) => ({ x, y, v: fieldVectorAt(x, y, charges) })));
  }, [charges]);

  const pulse = running ? 1 + 0.08 * Math.sin(pulseFrame / 2) : 1;
  const fieldOpacity = running ? 0.42 + 0.12 * Math.sin(pulseFrame / 3) : 0.48;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg
          ref={svgRef}
          className="aspect-[1.46] w-full touch-none"
          viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
          aria-label="Interactive electric field visualization"
          onPointerMove={(event) => {
            if (draggingId === null) return;
            moveCharge(draggingId, pointerToScene(event));
          }}
          onPointerUp={() => setDraggingId(null)}
          onPointerLeave={() => setDraggingId(null)}
        >
          <defs>
            <ArrowMarker id="ef-arr" />
            <ArrowMarker id="ef-red" color="#dc2626" />
            <ArrowMarker id="ef-blue" color="#2563eb" />
            <radialGradient id="ef-bg" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#f8fbf9" />
              <stop offset="100%" stopColor="#e8f2ee" />
            </radialGradient>
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="url(#ef-bg)" />

          {showFieldLines ? fieldVectors.map(({ x, y, v }) => {
            const mag = Math.hypot(v.x, v.y);
            if (mag < 0.00001) return null;
            const len = clamp(Math.sqrt(mag) * 260, 8, 24);
            const dx = (v.x / mag) * len;
            const dy = (v.y / mag) * len;
            return (
              <line
                key={`${x}-${y}`}
                x1={x - dx / 2}
                y1={y - dy / 2}
                x2={x + dx / 2}
                y2={y + dy / 2}
                stroke="#64748b"
                strokeWidth="1.6"
                markerEnd="url(#ef-arr)"
                opacity={fieldOpacity}
              />
            );
          }) : null}

          {guidedStep >= 2 && pairData.map((pair) => {
            const showInlineLabel = charges.length === 2;
            return (
              <g key={`${pair.a.id}-${pair.b.id}`} opacity={guidedStep === 2 ? 0.95 : 0.42}>
                <line x1={pair.a.x} y1={pair.a.y} x2={pair.b.x} y2={pair.b.y} stroke="#172033" strokeWidth="1.5" strokeDasharray="6 5" />
                {showInlineLabel ? (
                  <text x={(pair.a.x + pair.b.x) / 2} y={(pair.a.y + pair.b.y) / 2 - 12} textAnchor="middle" fill="#172033" fontSize="13" fontWeight="800">
                    r = {fmt(pair.r, 2)} m
                  </text>
                ) : null}
              </g>
            );
          })}

          {guidedStep >= 3 && charges.map((charge) => {
            const net = netForceVector(charge, charges);
            const mag = Math.hypot(net.fx, net.fy);
            if (mag <= 0) return null;
            const len = clamp(Math.log10(1 + mag) * 22, 20, 82) * pulse;
            const dx = (net.fx / mag) * len;
            const dy = (net.fy / mag) * len;
            const color = chargeColor(charge.q_uC);
            return (
              <g key={charge.id} color={color} stroke="currentColor" markerEnd={charge.q_uC >= 0 ? "url(#ef-red)" : "url(#ef-blue)"} opacity={guidedStep >= 3 ? 0.9 : 0.4}>
                <line x1={charge.x} y1={charge.y} x2={charge.x + dx} y2={charge.y + dy} strokeWidth="4" strokeLinecap="round" />
              </g>
            );
          })}

          {charges.map((charge) => {
            const color = chargeColor(charge.q_uC);
            const highlighted = guidedStep === 1 || draggingId === charge.id;
            return (
              <g
                key={charge.id}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggingId(charge.id);
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                <circle cx={charge.x} cy={charge.y} r={highlighted ? R + 5 : R + 2} fill={color} opacity="0.16" />
                <circle cx={charge.x} cy={charge.y} r={R} fill={color} stroke="#172033" strokeWidth="3" />
                <text x={charge.x} y={charge.y - 4} textAnchor="middle" fill="white" fontSize="16" fontWeight="900">
                  {chargeSign(charge.q_uC)}
                </text>
                <text x={charge.x} y={charge.y + 15} textAnchor="middle" fill="white" fontSize="12" fontWeight="900">
                  q{charge.id}
                </text>
                <text x={charge.x} y={charge.y + R + 19} textAnchor="middle" fill="#172033" fontSize="13" fontWeight="800">
                  {fmt(charge.q_uC, 1)} μC
                </text>
              </g>
            );
          })}

          <text x={24} y={36} fill="#172033" fontSize="15" fontWeight="800">
            q₁-q₂: F = {fmt(primaryForce, 4)} N ({primaryInteraction.toLowerCase()})
          </text>
          {overlapWarning ? (
            <text x={24} y={62} fill="#9a3412" fontSize="13" fontWeight="800">
              Charges are very close; distance is clamped for stable force calculations.
            </text>
          ) : null}
        </svg>
        <button
          onClick={() => setShowFieldLines((show) => !show)}
          className={`absolute bottom-3 right-3 rounded-md px-3 py-2 text-xs font-bold shadow-sm transition ${
            showFieldLines ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
          }`}
        >
          {showFieldLines ? "Hide field lines" : "Show field lines"}
        </button>
      </div>

      <SceneActions running={running} onRun={run} onReset={reset} runLabel="Pulse Forces" runningLabel="Pulsing…" />
      <GuidedBreakdown step={guidedStep} steps={STEPS} onStepChange={goToStep} />

      {charges.length > 2 ? (
        <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Pairwise Distances</h3>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {pairData.map((pair) => (
              <div key={`${pair.a.id}-${pair.b.id}`} className="rounded-md bg-slate-100 p-3">
                <span className="font-bold">q{pair.a.id}-q{pair.b.id}:</span> {fmt(pair.r, 2)} m
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <InfoPanels
        given={charges.map((charge) => [`q${charge.id}`, `${fmt(charge.q_uC, 1)} μC`])}
        equations={["F = k|q₁q₂|/r²", "k = 8.99×10⁹", "opposite signs attract", "same signs repel"]}
        results={[
          ["q₁-q₂ force", `${fmt(primaryForce, 4)} N`, "green"],
          ["q₁-q₂ distance", `${fmt(primaryPair?.r, 2)} m`],
          ["q₁-q₂ interaction", primaryInteraction],
          ["Nearest distance", `${fmt(closestPair?.r, 2)} m`],
        ]}
      />
    </div>
  );
}
