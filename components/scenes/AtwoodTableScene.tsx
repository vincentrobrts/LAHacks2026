"use client";

import { RotateCcw, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

type Props = {
  config: SimulationConfig;
  onOutcome: (outcome: LaunchOutcome) => void;
  onLoadAtwoodExample?: () => void;
};

const WIDTH = 760;
const HEIGHT = 520;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fmt(value: number | null, digits = 2) {
  return value === null || Number.isNaN(value) ? "--" : value.toFixed(digits);
}

function forceArrowLength(force: number, referenceForce: number, min = 34, max = 92) {
  if (!Number.isFinite(force) || !Number.isFinite(referenceForce) || referenceForce <= 0 || force <= 0) return min;
  return clamp((force / referenceForce) * max, min, max);
}

function atwoodValidation(config: SimulationConfig) {
  const keys = ["mass1", "mass2", "friction", "distance"];
  return keys.filter((key) => typeof config.params[key] !== "number" || !Number.isFinite(config.params[key]) || (key !== "friction" && config.params[key] <= 0));
}

function atwoodMetrics(config: SimulationConfig) {
  const mass1 = clamp(config.params.mass1, 0.5, 10);
  const mass2 = clamp(config.params.mass2, 0.5, 10);
  const friction = clamp(config.params.friction, 0, 0.9);
  const distance = clamp(config.params.distance, 1, 5);
  const gravity = clamp(config.world.gravity, 1, 20);
  const frictionForce = friction * mass1 * gravity;
  const drivingForce = mass2 * gravity - frictionForce;
  const moves = drivingForce > 0;
  const acceleration = moves ? drivingForce / (mass1 + mass2) : 0;
  const tension = moves ? mass1 * acceleration + frictionForce : mass2 * gravity;

  return {
    mass1,
    mass2,
    friction,
    distance,
    gravity,
    frictionForce,
    drivingForce,
    acceleration,
    tension,
    timeToBottom: moves ? Math.sqrt((2 * distance) / acceleration) : null,
    finalSpeed: moves ? Math.sqrt(2 * acceleration * distance) : 0,
    moves,
  };
}

export default function AtwoodTableScene({ config, onOutcome, onLoadAtwoodExample }: Props) {
  const missingValues = useMemo(() => atwoodValidation(config), [config]);
  const isValid = missingValues.length === 0;
  const metrics = useMemo(() => (isValid ? atwoodMetrics(config) : null), [config, isValid]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  progressRef.current = progress;
  const metricMass1 = metrics?.mass1;
  const metricMass2 = metrics?.mass2;
  const metricFriction = metrics?.friction;
  const metricGravity = metrics?.gravity;
  const metricDistance = metrics?.distance;
  const metricAcceleration = metrics?.acceleration;
  const metricTension = metrics?.tension;
  const metricTimeToBottom = metrics?.timeToBottom;
  const metricFinalSpeed = metrics?.finalSpeed;
  const metricMoves = metrics?.moves;

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);

    if (
      metricMass1 === undefined ||
      metricMass2 === undefined ||
      metricFriction === undefined ||
      metricGravity === undefined ||
      metricDistance === undefined ||
      metricAcceleration === undefined ||
      metricTension === undefined ||
      metricFinalSpeed === undefined ||
      metricMoves === undefined
    ) {
      setProgress(0);
      setCurrentSpeed(0);
      onOutcome({ launched: false, success: false, metrics: {} });
      return;
    }

    const liveSpeed = metricMoves ? Math.sqrt(2 * metricAcceleration * metricDistance * progressRef.current) : 0;
    setCurrentSpeed(liveSpeed);
    onOutcome({
      launched: true,
      success: metricMoves,
      metrics: {
        acceleration: metricAcceleration,
        tension: metricTension,
        timeToBottom: metricTimeToBottom ?? 0,
        finalSpeed: metricFinalSpeed,
      },
    });
  }, [
    metricMass1,
    metricMass2,
    metricFriction,
    metricGravity,
    metricDistance,
    metricAcceleration,
    metricTension,
    metricTimeToBottom,
    metricFinalSpeed,
    metricMoves,
    onOutcome,
  ]);

  const run = useCallback(() => {
    if (!metrics) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0);
    setCurrentSpeed(0);

    if (!metrics.moves || metrics.timeToBottom === null) {
      onOutcome({
        launched: true,
        success: false,
        metrics: {
          acceleration: metrics.acceleration,
          tension: metrics.tension,
          timeToBottom: 0,
          finalSpeed: 0,
        },
      });
      return;
    }

    const startedAt = performance.now();
    const timeToBottom = metrics.timeToBottom;
    const visualDuration = clamp(timeToBottom * 400, 300, 1200);
    setRunning(true);

    const tick = (now: number) => {
      const elapsedRatio = clamp((now - startedAt) / visualDuration, 0, 1);
      const elapsedPhysicsTime = elapsedRatio * timeToBottom;
      const distance = 0.5 * metrics.acceleration * elapsedPhysicsTime ** 2;
      const normalized = clamp(distance / metrics.distance, 0, 1);
      const speed = metrics.acceleration * elapsedPhysicsTime;

      setProgress(normalized);
      setCurrentSpeed(speed);

      if (normalized < 1 && elapsedRatio < 1) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      setProgress(1);
      setCurrentSpeed(metrics.finalSpeed);
      setRunning(false);
      onOutcome({
        launched: true,
        success: true,
        metrics: {
          acceleration: metrics.acceleration,
          tension: metrics.tension,
          timeToBottom: metrics.timeToBottom ?? 0,
          finalSpeed: metrics.finalSpeed,
        },
      });
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0);
    setCurrentSpeed(0);
    setRunning(false);
    onOutcome({ launched: false, success: false, metrics: {} });
  };

  const goToStep = (step: number) => {
    const nextStep = clamp(step, 1, 4);
    setGuidedStep(nextStep);
    if (nextStep === 4) run();
  };

  if (!isValid || !metrics) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-glow">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <h2 className="text-lg font-black">Unable to parse the required values for this Atwood Machine problem.</h2>
          <p className="mt-2 text-sm font-semibold">Missing values: {missingValues.join(", ")}</p>
          <button onClick={onLoadAtwoodExample} className="mt-4 rounded-md bg-[#216869] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1a5556]">
            Load Atwood Machine Example
          </button>
        </div>
      </div>
    );
  }

  const tableTop = 220;
  const tableLeft = 80;
  const tableRight = 540;
  const pulleyRadius = 30;
  const blockWidth = 118;
  const blockHeight = 56;
  const hangingWidth = 62;
  const hangingHeight = 68;
  const pulley = { x: tableRight + pulleyRadius, y: tableTop - blockHeight / 2 };
  const maxVisibleTravel = HEIGHT - 32 - (pulley.y + pulleyRadius + hangingHeight);
  const visualDistance = Math.min(metrics.distance * 60, maxVisibleTravel);
  const displacementPx = progress * visualDistance;
  const blockX = tableLeft + 96 + displacementPx;
  const blockY = tableTop - blockHeight / 2;
  const hangingX = pulley.x + pulleyRadius - hangingWidth / 2;
  const hangingY = pulley.y + pulleyRadius + hangingHeight / 2 + displacementPx;
  const stringY = blockY;
  const stringRightX = pulley.x + pulleyRadius;
  const targetDistanceTop = pulley.y + pulleyRadius + hangingHeight;
  const targetDistanceBottom = targetDistanceTop + visualDistance;
  const maxAtwoodForce = Math.max(metrics.mass1 * metrics.gravity, metrics.mass2 * metrics.gravity, metrics.tension, metrics.frictionForce);
  const m1WeightLen = forceArrowLength(metrics.mass1 * metrics.gravity, maxAtwoodForce, 34, 82);
  const m2WeightLen = forceArrowLength(metrics.mass2 * metrics.gravity, maxAtwoodForce, 34, 82);
  const normalLen = m1WeightLen;
  const tensionLen = forceArrowLength(metrics.tension, maxAtwoodForce, 34, 82);
  const frictionLen = forceArrowLength(metrics.frictionForce, maxAtwoodForce, 28, 76);
  const activeArrowClass = "animate-pulse drop-shadow-[0_0_8px_rgba(242,193,78,0.95)]";
  const active = (enabled: boolean) => ({ opacity: enabled ? 1 : running ? 0.2 : 0.4, strokeWidth: enabled ? 6 : 4 });
  const forceLabelOpacity = running ? 0.28 : 1;
  const stepCopy = [
    {
      title: "Identify Connected Masses",
      equation: "m₁ and m₂ share one string, so they share acceleration magnitude.",
      notice: "The table block moves horizontally while the hanging mass moves vertically.",
      diagram: "Look for m₁ on the table, m₂ below the pulley, and the massless string connecting them.",
    },
    {
      title: "Draw Forces",
      equation: "m₁: T, N, m₁g, friction. m₂: m₂g and T.",
      notice: "Tension pulls both masses along the string, while friction only acts on m₁ if μ > 0.",
      diagram: "The highlighted force arrows show the free-body diagrams for both masses.",
    },
    {
      title: "Apply Newton's Second Law",
      equation: "m₂g - T = m₂a,  T - μm₁g = m₁a",
      notice: "The hanging weight drives the system, and table friction subtracts from that pull.",
      diagram: "The direction of motion follows the string: m₁ toward the pulley and m₂ downward.",
    },
    {
      title: "Solve Acceleration and Tension",
      equation: "a = (m₂g - μm₁g) / (m₁ + m₂)",
      notice: "Once acceleration is known, tension follows from the m₁ equation.",
      diagram: "The animation moves both masses with the same constant-acceleration timing.",
    },
  ][guidedStep - 1];
  const highlights = {
    masses: !running && guidedStep === 1,
    forces: !running && guidedStep === 2,
    motion: !running && (guidedStep === 3 || guidedStep === 4),
  };

  return (
    <div className="rounded-xl bg-white/85 p-3 shadow-glow ring-1 ring-slate-200/60">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Atwood Machine physics visualization">
          <defs>
            <marker id="atwood-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
            </marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <rect x={tableLeft} y={tableTop} width={tableRight - tableLeft} height="30" rx="4" fill="#2f3d3f" />
          <rect x={tableLeft + 28} y={tableTop + 30} width="18" height="120" fill="#2f3d3f" opacity="0.5" />
          <rect x={tableRight - 46} y={tableTop + 30} width="18" height="120" fill="#2f3d3f" opacity="0.5" />
          <path d={`M ${tableRight - 4} ${tableTop + 2} L ${pulley.x} ${pulley.y} L ${tableRight - 4} ${tableTop + 30}`} fill="none" stroke="#172033" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={pulley.x} cy={pulley.y} r="32" fill="#f7f2ea" stroke="#172033" strokeWidth="6" />
          <circle cx={pulley.x} cy={pulley.y} r="7" fill="#172033" />
          <path d={`M ${blockX + blockWidth / 2} ${stringY} L ${pulley.x - pulleyRadius} ${stringY} M ${stringRightX} ${pulley.y} L ${stringRightX} ${hangingY - hangingHeight / 2}`} fill="none" stroke="#172033" strokeWidth="4" strokeLinecap="round" />
          <line x1={stringRightX + 36} y1={targetDistanceTop} x2={stringRightX + 36} y2={targetDistanceBottom} stroke="#216869" strokeWidth="3" strokeDasharray="8 8" />
          <text x={stringRightX + 44} y={(targetDistanceTop + targetDistanceBottom) / 2} fill="#216869" fontSize="14" fontWeight="800">d</text>

          <g className={highlights.masses ? activeArrowClass : ""}>
            <rect x={blockX - blockWidth / 2} y={blockY - blockHeight / 2} width={blockWidth} height={blockHeight} rx="7" fill="#216869" />
            <text x={blockX} y={blockY + 6} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">m₁</text>
            <rect x={hangingX} y={hangingY - hangingHeight / 2} width={hangingWidth} height={hangingHeight} rx="7" fill="#d7603d" />
            <text x={hangingX + hangingWidth / 2} y={hangingY + 6} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">m₂</text>
          </g>

          <g className={highlights.forces ? activeArrowClass : ""} color="#1d4ed8" stroke="currentColor" markerEnd="url(#atwood-arrow)" style={active(highlights.forces)}>
            <line x1={blockX - 18} y1={blockY - blockHeight / 2} x2={blockX - 18} y2={blockY - blockHeight / 2 - normalLen} />
            <line x1={blockX + blockWidth / 2} y1={blockY} x2={blockX + blockWidth / 2 + tensionLen} y2={blockY} />
            <line x1={hangingX + hangingWidth / 2} y1={hangingY - hangingHeight / 2} x2={hangingX + hangingWidth / 2} y2={hangingY - hangingHeight / 2 - tensionLen} />
          </g>
          <text x={blockX - 36} y={blockY - blockHeight / 2 - normalLen - 8} fill="#1d4ed8" fontSize="15" fontWeight="800" opacity={forceLabelOpacity}>N</text>
          <text x={blockX + blockWidth / 2 + tensionLen + 8} y={blockY - 8} fill="#1d4ed8" fontSize="15" fontWeight="800" opacity={forceLabelOpacity}>Fₜ</text>
          <text x={hangingX + hangingWidth / 2 + 12} y={hangingY - hangingHeight / 2 - tensionLen + 4} fill="#1d4ed8" fontSize="15" fontWeight="800" opacity={forceLabelOpacity}>Fₜ</text>

          <g className={highlights.forces ? activeArrowClass : ""} color="#c2410c" stroke="currentColor" markerEnd="url(#atwood-arrow)" style={active(highlights.forces)}>
            <line x1={blockX - 18} y1={blockY + blockHeight / 2} x2={blockX - 18} y2={blockY + blockHeight / 2 + m1WeightLen} />
            <line x1={hangingX + hangingWidth / 2} y1={hangingY + hangingHeight / 2} x2={hangingX + hangingWidth / 2} y2={hangingY + hangingHeight / 2 + m2WeightLen} />
          </g>
          <text x={blockX - 48} y={blockY + blockHeight / 2 + m1WeightLen + 18} fill="#9a3412" fontSize="15" fontWeight="800" opacity={forceLabelOpacity}>m₁g</text>
          <text x={hangingX + hangingWidth / 2 + 12} y={hangingY + hangingHeight / 2 + m2WeightLen + 18} fill="#9a3412" fontSize="15" fontWeight="800" opacity={forceLabelOpacity}>m₂g</text>

          {metrics.friction > 0 ? (
            <>
              <g className={highlights.forces ? activeArrowClass : ""} color="#7c3aed" stroke="currentColor" markerEnd="url(#atwood-arrow)" style={active(highlights.forces)}>
                <line x1={blockX - blockWidth / 2} y1={blockY + 4} x2={blockX - blockWidth / 2 - frictionLen} y2={blockY + 4} />
              </g>
              <text x={blockX - blockWidth / 2 - frictionLen - 70} y={blockY - 4} fill="#6d28d9" fontSize="15" fontWeight="800" opacity={forceLabelOpacity}>friction</text>
            </>
          ) : null}

        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={running || !metrics.moves} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70">
          <Zap size={18} />
          {running ? "Running" : "Run Animation"}
        </button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50">
          <RotateCcw size={18} />
          Reset
        </button>
      </div>
      {!metrics.moves ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Insufficient hanging force to overcome friction. Friction is large enough to prevent the hanging mass from accelerating the system.</div>
      ) : null}
      <section className={`mt-3 rounded-md bg-white/70 p-3 ring-1 ring-slate-200/50 ${running || progress > 0 ? "" : "opacity-75"}`}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guided Breakdown</div>
            <h3 className="mt-1 text-lg font-black text-slate-950">Step {guidedStep} / 4: {stepCopy.title}</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => goToStep(guidedStep - 1)} disabled={guidedStep === 1} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous Step</button>
            <button onClick={() => goToStep(guidedStep + 1)} disabled={guidedStep === 4} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Next Step</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-4 text-sm text-slate-700 md:grid-cols-[0.85fr_1.3fr_0.85fr]">
            <div className="rounded-md bg-white p-3">
              <div className="font-bold text-slate-900">Given values</div>
              <p className="mt-1 leading-6">m<sub>1</sub> = {fmt(metrics.mass1, 1)} kg<br />m<sub>2</sub> = {fmt(metrics.mass2, 1)} kg<br />μ = {fmt(metrics.friction, 2)}<br />d = {fmt(metrics.distance, 1)} m<br />g = {fmt(metrics.gravity, 1)} m/s²</p>
              {metrics.friction === 0 ? <p className="mt-2 rounded bg-[#216869]/10 px-2 py-1 text-xs font-bold text-[#174f50]">frictionless case: μ = 0</p> : null}
            </div>
            <div className="rounded-md bg-white p-3">
              <div className="font-bold text-slate-900">Force equations</div>
              <p className="mt-1 leading-6">For m<sub>2</sub>: m<sub>2</sub>g - T = m<sub>2</sub>a<br />For m<sub>1</sub>: T - μm<sub>1</sub>g = m<sub>1</sub>a<br />a = (m<sub>2</sub>g - μm<sub>1</sub>g) / (m<sub>1</sub> + m<sub>2</sub>)<br />T = m<sub>1</sub>a + μm<sub>1</sub>g</p>
            </div>
            <div className="rounded-md bg-white p-3">
              <div className="font-bold text-slate-900">Solved results</div>
              <p className="mt-1 leading-6">μm<sub>1</sub>g = {fmt(metrics.frictionForce)} N<br />T = {fmt(metrics.tension)} N<br />a = {fmt(metrics.acceleration)} m/s²</p>
            </div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Acceleration:</span> {metrics.moves ? `${fmt(metrics.acceleration)} m/s²` : "No motion"}</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Tension:</span> {fmt(metrics.tension)} N</div>
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">Current speed:</span> {metrics.moves ? fmt(currentSpeed) : "0.00"} m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Time over {fmt(metrics.distance, 1)} m:</span> {metrics.timeToBottom === null ? "No motion" : `${fmt(metrics.timeToBottom)} s`}</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Final speed:</span> {fmt(metrics.finalSpeed)} m/s</div>
          </div>
        </section>
      </div>
    </div>
  );
}
