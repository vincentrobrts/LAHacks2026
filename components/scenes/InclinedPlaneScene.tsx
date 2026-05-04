"use client";

import { RotateCcw, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

type Props = {
  config: SimulationConfig;
  onOutcome: (outcome: LaunchOutcome) => void;
};

const WIDTH = 760;
const HEIGHT = 520;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fmt(value: number | null, digits = 2) {
  return value === null || Number.isNaN(value) ? "--" : value.toFixed(digits);
}

function arrowPoints(x: number, y: number, dx: number, dy: number) {
  return { x1: x, y1: y, x2: x + dx, y2: y + dy };
}

function forceArrowLength(force: number, referenceForce: number, min = 34, max = 92) {
  if (!Number.isFinite(force) || !Number.isFinite(referenceForce) || referenceForce <= 0 || force <= 0) return min;
  return clamp((force / referenceForce) * max, min, max);
}

function arrowMarkerSize(length: number) {
  return clamp(length * 0.12, 4.5, 7);
}

function inclinedMetrics(config: SimulationConfig) {
  const angle = clamp(config.params.angle ?? 30, 5, 60);
  const theta = (angle * Math.PI) / 180;
  const gravity = clamp(config.world.gravity, 1, 20);
  const mass = clamp(config.params.mass ?? 1, 0.5, 10);
  const mu = clamp(config.params.friction ?? 0.2, 0, 0.9);
  const distance = clamp(config.params.distance ?? 3, 1, 5);
  const normal = mass * gravity * Math.cos(theta);
  const frictionForce = mu * normal;
  const gravityComponent = mass * gravity * Math.sin(theta);
  const acceleration = gravity * (Math.sin(theta) - mu * Math.cos(theta));
  const slides = acceleration > 0;

  return {
    angle,
    theta,
    gravity,
    mass,
    friction: mu,
    distance,
    normal,
    frictionForce,
    gravityComponent,
    acceleration,
    timeToBottom: slides ? Math.sqrt((2 * distance) / acceleration) : null,
    finalSpeed: slides ? Math.sqrt(2 * acceleration * distance) : 0,
    slides,
  };
}

export default function InclinedPlaneScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => inclinedMetrics(config), [config]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentVelocity, setCurrentVelocity] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  const rampLength = 410;
  const rawBottom = { x: 520, y: 330 };
  const rawTop = {
    x: rawBottom.x - rampLength * Math.cos(metrics.theta),
    y: rawBottom.y - rampLength * Math.sin(metrics.theta),
  };
  const downRamp = { x: Math.cos(metrics.theta), y: Math.sin(metrics.theta) };
  const normalDir = { x: Math.sin(metrics.theta), y: -Math.cos(metrics.theta) };
  // Scale travel pixels by distance so block stops earlier for shorter distances (max slider = 5 m = full ramp)
  const maxBlockTravel = Math.min((metrics.distance / 5) * rampLength, rampLength * 0.96);
  const blockTravel = maxBlockTravel * Math.min(Math.max(progress, 0), 1);
  const rawBlockCenter = {
    x: rawTop.x + downRamp.x * blockTravel + normalDir.x * 22,
    y: rawTop.y + downRamp.y * blockTravel + normalDir.y * 22,
  };
  const maxInclinedForce = Math.max(metrics.mass * metrics.gravity, metrics.normal, metrics.frictionForce, metrics.gravityComponent);
  const gravityLen = forceArrowLength(metrics.mass * metrics.gravity, maxInclinedForce);
  const normalLen = forceArrowLength(metrics.normal, maxInclinedForce);
  const frictionLen = forceArrowLength(metrics.frictionForce, maxInclinedForce);
  const componentLen = forceArrowLength(metrics.gravityComponent, maxInclinedForce);
  const gravityArrow = arrowPoints(rawBlockCenter.x, rawBlockCenter.y, 0, gravityLen);
  const normalArrow = arrowPoints(rawBlockCenter.x, rawBlockCenter.y, normalDir.x * normalLen, normalDir.y * normalLen);
  const frictionArrow = arrowPoints(rawBlockCenter.x - normalDir.x * 34, rawBlockCenter.y - normalDir.y * 34, -downRamp.x * frictionLen, -downRamp.y * frictionLen);
  const componentArrow = arrowPoints(rawBlockCenter.x, rawBlockCenter.y, downRamp.x * componentLen, downRamp.y * componentLen);
  const rampPoints = [rawTop, rawBottom, { x: rawTop.x, y: rawBottom.y }];
  const rampBounds = rampPoints.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      maxX: Math.max(box.maxX, point.x),
      minY: Math.min(box.minY, point.y),
      maxY: Math.max(box.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );
  const centerOffset = {
    x: WIDTH / 2 - (rampBounds.minX + rampBounds.maxX) / 2,
    y: HEIGHT / 2 - (rampBounds.minY + rampBounds.maxY) / 2 + 18,
  };
  const systemTransform = `translate(${centerOffset.x.toFixed(2)} ${centerOffset.y.toFixed(2)})`;
  const blockTransform = `translate(${rawBlockCenter.x} ${rawBlockCenter.y}) rotate(${metrics.angle})`;
  const activeArrowClass = "animate-pulse drop-shadow-[0_0_8px_rgba(242,193,78,0.95)]";
  const angleArcRadius = 76;
  const angleArcStart = { x: rawBottom.x - angleArcRadius, y: rawBottom.y };
  const angleArcEnd = {
    x: rawBottom.x - angleArcRadius * Math.cos(metrics.theta),
    y: rawBottom.y - angleArcRadius * Math.sin(metrics.theta),
  };
  const angleLabel = {
    x: rawBottom.x - (angleArcRadius + 34) * Math.cos(metrics.theta / 2),
    y: rawBottom.y - (angleArcRadius + 34) * Math.sin(metrics.theta / 2) + 6,
  };

  const arrowStyle = (active: boolean) => ({ opacity: active ? 1 : running ? 0.22 : 0.42, strokeWidth: active ? 5 : 3.5 });
  const labelStyle = (active: boolean) => ({ opacity: active ? 1 : running ? 0.24 : 0.56, fontSize: active ? 17 : 15 });

  const stepCopy = [
    {
      title: "Identify Forces",
      equation: "Forces on the block: mg, N, and friction.",
      notice: "Notice that every force starts at the block but points in a different physical direction.",
      diagram: "The highlighted arrows are mg downward, N perpendicular to the ramp, and friction up the ramp.",
    },
    {
      title: "Resolve Forces",
      equation: "Gravity components: mg sin θ and mg cos θ.",
      notice: "Notice that gravity is split relative to the ramp, not relative to the screen.",
      diagram: "The downslope component mg sin θ is highlighted along the ramp, while N marks the perpendicular direction tied to mg cos θ.",
    },
    {
      title: "Net Force and Acceleration",
      equation: "a = g(sin θ − μₖ cos θ)",
      notice: "Notice that mass cancels out of the acceleration equation for this ideal sliding block.",
      diagram: "The highlighted downslope direction shows where positive acceleration points after friction is subtracted.",
    },
    {
      title: "Motion and Results",
      equation: "s(t) = 0.5at², v(t) = at",
      notice: "Notice that the block starts slowly, then covers more ramp distance each moment as velocity increases.",
      diagram: "Watch the block move along the ramp while the Results card updates the current velocity.",
    },
  ][guidedStep - 1];

  useEffect(() => {
    setProgress(0);
    setRunning(false);
    setCurrentVelocity(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.angle, metrics.friction, metrics.mass, metrics.gravity, metrics.distance, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0);
    setCurrentVelocity(0);

    if (!metrics.slides || metrics.timeToBottom === null) {
      onOutcome({
        launched: true,
        success: false,
        metrics: { acceleration: metrics.acceleration, timeToBottom: 0, finalSpeed: 0 },
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
      const distanceAlongRamp = 0.5 * metrics.acceleration * elapsedPhysicsTime ** 2;
      const normalizedDistance = clamp(distanceAlongRamp / metrics.distance, 0, 1);
      const velocity = metrics.acceleration * elapsedPhysicsTime;

      setProgress(normalizedDistance);
      setCurrentVelocity(velocity);

      if (normalizedDistance < 1 && elapsedRatio < 1) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      setRunning(false);
      setProgress(1);
      setCurrentVelocity(metrics.finalSpeed);
      onOutcome({
        launched: true,
        success: true,
        metrics: {
          acceleration: metrics.acceleration,
          timeToBottom: metrics.timeToBottom ?? 0,
          finalSpeed: metrics.finalSpeed,
        },
      });
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setProgress(0);
    setCurrentVelocity(0);
    onOutcome({ launched: false, success: false, metrics: {} });
  };

  const goToStep = (step: number) => {
    const nextStep = clamp(step, 1, 4);
    setGuidedStep(nextStep);
    if (nextStep === 4) run();
  };

  const highlights = {
    gravity: !running && guidedStep === 1,
    normal: !running && (guidedStep === 1 || guidedStep === 2),
    friction: !running && guidedStep === 1,
    component: !running && (guidedStep === 2 || guidedStep === 3 || guidedStep === 4),
  };

  return (
    <div className="rounded-xl bg-white/85 p-3 shadow-glow ring-1 ring-slate-200/60">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Inclined plane physics visualization">
          <defs>
            {[
              ["incline-gravity", gravityLen],
              ["incline-normal", normalLen],
              ["incline-friction", frictionLen],
              ["incline-component", componentLen],
            ].map(([id, len]) => {
              const size = arrowMarkerSize(Number(len));
              return (
                <marker key={String(id)} id={String(id)} markerHeight={size} markerWidth={size} orient="auto" refX={size - 0.8} refY={size / 2}>
                  <path d={`M0,0 L${size},${size / 2} L0,${size} Z`} fill="currentColor" />
                </marker>
              );
            })}
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <g transform={systemTransform}>
          <path d={`M ${rawTop.x} ${rawTop.y} L ${rawBottom.x} ${rawBottom.y} L ${rawTop.x} ${rawBottom.y} Z`} fill="#dfe8e4" stroke="#172033" strokeWidth="4" />
          <path d={`M ${rawTop.x} ${rawTop.y} L ${rawBottom.x} ${rawBottom.y}`} stroke="#172033" strokeWidth="8" strokeLinecap="round" />
          <path d={`M ${angleArcStart.x} ${angleArcStart.y} A ${angleArcRadius} ${angleArcRadius} 0 0 1 ${angleArcEnd.x} ${angleArcEnd.y}`} fill="none" stroke="#f2c14e" strokeWidth="5" strokeLinecap="round" />
          <text x={angleLabel.x} y={angleLabel.y} textAnchor="middle" fill="#172033" fontSize="17" fontWeight="700">θ = {fmt(metrics.angle, 1)}°</text>

          <g transform={blockTransform}>
            <rect x="-38" y="-24" width="76" height="48" rx="6" fill="#216869" />
            <rect x="-29" y="-15" width="58" height="30" rx="4" fill="#2e8b88" />
          </g>

          <g className={highlights.gravity ? activeArrowClass : ""} color="#c2410c" stroke="currentColor" markerEnd="url(#incline-gravity)" style={arrowStyle(highlights.gravity)}>
            <line {...gravityArrow} />
          </g>
          <text x={gravityArrow.x2 + 12} y={gravityArrow.y2 - 2} fill="#9a3412" fontWeight="700" style={labelStyle(highlights.gravity)}>mg</text>

          <g className={highlights.normal ? activeArrowClass : ""} color="#1d4ed8" stroke="currentColor" markerEnd="url(#incline-normal)" style={arrowStyle(highlights.normal)}>
            <line {...normalArrow} />
          </g>
          <text x={normalArrow.x2 + 10} y={normalArrow.y2 - 8} fill="#1d4ed8" fontWeight="700" style={labelStyle(highlights.normal)}>N</text>

          <g className={highlights.friction ? activeArrowClass : ""} color="#7c3aed" stroke="currentColor" markerEnd="url(#incline-friction)" style={arrowStyle(highlights.friction)}>
            <line {...frictionArrow} />
          </g>
          <text x={frictionArrow.x2 - 72} y={frictionArrow.y2 - 12} fill="#6d28d9" fontWeight="700" style={labelStyle(highlights.friction)}>friction</text>

          <g className={highlights.component ? activeArrowClass : ""} color="#15803d" stroke="currentColor" markerEnd="url(#incline-component)" style={arrowStyle(highlights.component)}>
            <line {...componentArrow} />
          </g>
          <text x={componentArrow.x2 + 8} y={componentArrow.y2 + 18} fill="#166534" fontWeight="700" style={labelStyle(highlights.component)}>mg sin θ</text>
          </g>
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70">
          <Zap size={18} />
          {running ? "Running" : "Run Animation"}
        </button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50">
          <RotateCcw size={18} />
          Reset
        </button>
      </div>
      <section className={`mt-3 rounded-md bg-white/70 p-3 ring-1 ring-slate-200/50 ${running || progress > 0 ? "" : "opacity-75"}`}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guided Breakdown</div>
            <h3 className="mt-1 text-lg font-black text-slate-950">Step {guidedStep} / 4: {stepCopy.title}</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => goToStep(guidedStep - 1)} disabled={guidedStep === 1} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              Previous Step
            </button>
            <button onClick={() => goToStep(guidedStep + 1)} disabled={guidedStep === 4} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              Next Step
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div className="rounded-md bg-slate-100 p-4 text-sm font-bold leading-6 text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
            <div className="rounded-md bg-white p-4">
              <div className="font-bold text-slate-900">Given values</div>
              <p className="mt-1 leading-6">m = {fmt(metrics.mass, 1)} kg<br />θ = {metrics.angle} deg<br />μₖ = {fmt(metrics.friction, 2)}<br />d = {fmt(metrics.distance, 1)} m<br />g = {fmt(metrics.gravity, 1)} m/s²</p>
            </div>
            <div className="rounded-md bg-white p-4 md:row-span-2">
              <div className="font-bold text-slate-900">Equations</div>
              <div className="mt-3 space-y-2 text-base font-semibold leading-7 text-slate-900">
                <div className="rounded-md bg-slate-100 px-3 py-2">N = mg cos θ</div>
                <div className="rounded-md bg-slate-100 px-3 py-2">F<sub>f</sub> = μₖN</div>
                <div className="rounded-md bg-slate-100 px-3 py-2">mg sin θ</div>
                <div className="rounded-md bg-slate-100 px-3 py-2">a = g(sin θ − μₖ cos θ)</div>
              </div>
            </div>
            <div className="rounded-md bg-white p-4">
              <div className="font-bold text-slate-900">Model results</div>
              <p className="mt-1 leading-6">N = {fmt(metrics.normal)} N<br />F<sub>f</sub> = {fmt(metrics.frictionForce)} N<br />mg sin θ = {fmt(metrics.gravityComponent)} N</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Gravity pulls the block down the ramp through mg sin θ, while friction opposes motion through μₖmg cos θ.
          </p>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-slate-100 p-3">
              <span className="font-bold">Acceleration:</span> {metrics.slides ? fmt(metrics.acceleration) : `≤ 0 (${fmt(metrics.acceleration)})`} m/s²
            </div>
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">Current velocity:</span> {fmt(currentVelocity)} m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Time over {fmt(metrics.distance, 1)} m:</span> {metrics.timeToBottom === null ? "No slide" : `${fmt(metrics.timeToBottom)} s`}</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Final velocity:</span> {fmt(metrics.finalSpeed)} m/s</div>
            {!metrics.slides ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-900">Friction prevents the block from sliding. Increase θ or lower μₖ.</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
