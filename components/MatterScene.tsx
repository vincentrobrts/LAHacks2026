"use client";

import { RotateCcw, Target, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";
import CircularMotionScene from "@/components/scenes/CircularMotionScene";
import TorqueScene from "@/components/scenes/TorqueScene";
import ElectricFieldScene from "@/components/scenes/ElectricFieldScene";
import OhmLawScene from "@/components/scenes/OhmLawScene";
import BernoulliScene from "@/components/scenes/BernoulliScene";
import StandingWavesScene from "@/components/scenes/StandingWavesScene";
import BohrModelScene from "@/components/scenes/BohrModelScene";

type Props = {
  config: SimulationConfig;
  onOutcome: (outcome: LaunchOutcome) => void;
  onLoadAtwoodExample?: () => void;
};

const WIDTH = 760;
const HEIGHT = 520;
const GROUND_Y = 462;
const LAUNCHER = { x: 92, y: GROUND_Y - 32 };
const TOWER_X = 600;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function fmt(value: number | null, digits = 2) {
  return value === null || Number.isNaN(value) ? "--" : value.toFixed(digits);
}

function arrowPoints(x: number, y: number, dx: number, dy: number) {
  return { x1: x, y1: y, x2: x + dx, y2: y + dy };
}

function atwoodValidation(config: SimulationConfig) {
  const keys = ["mass1", "mass2", "friction", "distance"];
  return keys.filter((key) => typeof config.params[key] !== "number" || !Number.isFinite(config.params[key]) || (key !== "friction" && config.params[key] <= 0));
}

function atwoodMetrics(config: SimulationConfig) {
  const mass1 = config.params.mass1;
  const mass2 = config.params.mass2;
  const friction = config.params.friction;
  const distance = config.params.distance;
  const gravity = config.world.gravity;
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

function InclinedPlaneScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => inclinedMetrics(config), [config]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentVelocity, setCurrentVelocity] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  const rampLength = 410;
  const bottom = { x: 615, y: 418 };
  const top = {
    x: bottom.x - rampLength * Math.cos(metrics.theta),
    y: bottom.y - rampLength * Math.sin(metrics.theta),
  };
  const downRamp = { x: Math.cos(metrics.theta), y: Math.sin(metrics.theta) };
  const normalDir = { x: Math.sin(metrics.theta), y: -Math.cos(metrics.theta) };
  const blockTravel = rampLength * clamp(progress, 0, 0.96);
  const blockCenter = {
    x: top.x + downRamp.x * blockTravel + normalDir.x * 22,
    y: top.y + downRamp.y * blockTravel + normalDir.y * 22,
  };
  const blockTransform = `translate(${blockCenter.x} ${blockCenter.y}) rotate(${metrics.angle})`;
  const gravityArrow = arrowPoints(blockCenter.x - 6, blockCenter.y - 4, 0, 62);
  const normalArrow = arrowPoints(blockCenter.x + normalDir.x * 4, blockCenter.y + normalDir.y * 4, normalDir.x * 66, normalDir.y * 66);
  const frictionArrow = arrowPoints(blockCenter.x - normalDir.x * 34, blockCenter.y - normalDir.y * 34, -downRamp.x * 70, -downRamp.y * 70);
  const componentArrow = arrowPoints(blockCenter.x + normalDir.x * 42, blockCenter.y + normalDir.y * 42, downRamp.x * 66, downRamp.y * 66);
  const activeArrowClass = "animate-pulse drop-shadow-[0_0_8px_rgba(242,193,78,0.95)]";

  const arrowStyle = (active: boolean) => ({ opacity: active ? 1 : 0.42, strokeWidth: active ? 6 : 4 });
  const labelStyle = (active: boolean) => ({ opacity: active ? 1 : 0.56, fontSize: active ? 17 : 15 });

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
    const visualDuration = clamp(timeToBottom * 900, 900, 3600);
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
    gravity: guidedStep === 1,
    normal: guidedStep === 1 || guidedStep === 2,
    friction: guidedStep === 1,
    component: guidedStep === 2 || guidedStep === 3 || guidedStep === 4,
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Inclined plane physics visualization">
          <defs>
            <marker id="arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
            </marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <path d={`M ${top.x} ${top.y} L ${bottom.x} ${bottom.y} L ${top.x} ${bottom.y} Z`} fill="#dfe8e4" stroke="#172033" strokeWidth="4" />
          <path d={`M ${top.x} ${top.y} L ${bottom.x} ${bottom.y}`} stroke="#172033" strokeWidth="8" strokeLinecap="round" />
          <path d={`M ${bottom.x - 92} ${bottom.y} A 92 92 0 0 0 ${bottom.x - 92 * Math.cos(metrics.theta)} ${bottom.y - 92 * Math.sin(metrics.theta)}`} fill="none" stroke="#f2c14e" strokeWidth="5" />
          <text x={bottom.x - 132} y={bottom.y + 34} fill="#172033" fontSize="18" fontWeight="700">θ = {metrics.angle} deg</text>

          <g transform={blockTransform}>
            <rect x="-38" y="-24" width="76" height="48" rx="6" fill="#216869" />
            <rect x="-29" y="-15" width="58" height="30" rx="4" fill="#2e8b88" />
          </g>

          <g className={highlights.gravity ? activeArrowClass : ""} color="#c2410c" stroke="currentColor" markerEnd="url(#arrow)" style={arrowStyle(highlights.gravity)}>
            <line {...gravityArrow} />
          </g>
          <text x={gravityArrow.x2 + 12} y={gravityArrow.y2 - 2} fill="#9a3412" fontWeight="700" style={labelStyle(highlights.gravity)}>mg</text>

          <g className={highlights.normal ? activeArrowClass : ""} color="#1d4ed8" stroke="currentColor" markerEnd="url(#arrow)" style={arrowStyle(highlights.normal)}>
            <line {...normalArrow} />
          </g>
          <text x={normalArrow.x2 + 10} y={normalArrow.y2 - 8} fill="#1d4ed8" fontWeight="700" style={labelStyle(highlights.normal)}>N</text>

          <g className={highlights.friction ? activeArrowClass : ""} color="#7c3aed" stroke="currentColor" markerEnd="url(#arrow)" style={arrowStyle(highlights.friction)}>
            <line {...frictionArrow} />
          </g>
          <text x={frictionArrow.x2 - 72} y={frictionArrow.y2 - 12} fill="#6d28d9" fontWeight="700" style={labelStyle(highlights.friction)}>friction</text>

          <g className={highlights.component ? activeArrowClass : ""} color="#15803d" stroke="currentColor" markerEnd="url(#arrow)" style={arrowStyle(highlights.component)}>
            <line {...componentArrow} />
          </g>
          <text x={componentArrow.x2 + 8} y={componentArrow.y2 + 18} fill="#166534" fontWeight="700" style={labelStyle(highlights.component)}>mg sin θ</text>
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70">
          <Zap size={18} />
          {running ? "Running" : "Run Animation"}
        </button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50">
          <RotateCcw size={18} />
          Reset
        </button>
        <div className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e]/20 px-3 py-2 text-sm font-semibold text-slate-800">
          <Target size={17} />
          Textbook Equations
        </div>
      </div>
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
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
        <div className="mt-4 grid gap-3 md:grid-cols-[0.75fr_1fr_1fr]">
          <div className="rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <div>
              <div className="font-bold text-slate-900">Given values</div>
              <p className="mt-1 leading-6">m = {fmt(metrics.mass, 1)} kg<br />θ = {metrics.angle} deg<br />μₖ = {fmt(metrics.friction, 2)}<br />d = {fmt(metrics.distance, 1)} m<br />g = {fmt(metrics.gravity, 1)} m/s²</p>
            </div>
            <div>
              <div className="font-bold text-slate-900">Equations</div>
              <p className="mt-1 leading-6">N = mg cos θ<br />F<sub>f</sub> = μₖN<br />mg sin θ<br />a = g(sin θ − μₖ cos θ)</p>
            </div>
            <div>
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

function PlaceholderScene({ config, onOutcome }: Props) {
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [config, onOutcome, runId]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <canvas
          width={WIDTH}
          height={HEIGHT}
          className="aspect-[1.46] w-full"
          ref={(canvas) => {
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, WIDTH, HEIGHT);
            ctx.fillStyle = "#eef5f1";
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
            ctx.fillStyle = "#2f3d3f";
            ctx.fillRect(0, HEIGHT - 40, WIDTH, 40);
            ctx.fillStyle = "#172033";
            ctx.font = "bold 22px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`Scene: ${config.type.replace(/_/g, " ")}`, WIDTH / 2, HEIGHT / 2 - 20);
            ctx.font = "16px sans-serif";
            ctx.fillStyle = "#216869";
            ctx.fillText("Person B: wire up the Matter.js scene here", WIDTH / 2, HEIGHT / 2 + 16);
          }}
        />
      </div>
      <div className="mt-4 flex gap-3">
        <button onClick={() => { onOutcome({ launched: true, success: true, metrics: {} }); }} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556]">
          <Zap size={18} /> Launch
        </button>
        <button onClick={() => setRunId((id) => id + 1)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50">
          <RotateCcw size={18} /> Reset
        </button>
      </div>
    </div>
  );
}

function AtwoodTableScene({ config, onOutcome, onLoadAtwoodExample }: Props) {
  const missingValues = useMemo(() => atwoodValidation(config), [config]);
  const isValid = missingValues.length === 0;
  const metrics = useMemo(() => (isValid ? atwoodMetrics(config) : null), [config, isValid]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    setProgress(0);
    setCurrentSpeed(0);
    setRunning(false);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [config, onOutcome]);

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
    const visualDuration = clamp(timeToBottom * 900, 900, 3600);
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
          <h2 className="text-lg font-black">Unable to parse the required values for this Atwood problem.</h2>
          <p className="mt-2 text-sm font-semibold">Missing values: {missingValues.join(", ")}</p>
          <button onClick={onLoadAtwoodExample} className="mt-4 rounded-md bg-[#216869] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1a5556]">
            Load Atwood Example
          </button>
        </div>
      </div>
    );
  }

  const tableTop = 240;
  const tableLeft = 80;
  const tableRight = 540;
  const pulleyRadius = 30;
  const blockWidth = 118;
  const blockHeight = 56;
  const hangingWidth = 62;
  const hangingHeight = 68;
  const pulley = { x: tableRight + pulleyRadius, y: tableTop - blockHeight / 2 };
  const maxVisibleTravel = HEIGHT - 32 - (pulley.y + pulleyRadius + hangingHeight);
  const visualDistance = Math.min(metrics.distance * 36, maxVisibleTravel);
  const displacementPx = progress * visualDistance;
  const blockX = tableLeft + 96 + displacementPx;
  const blockY = tableTop - blockHeight / 2;
  const hangingX = pulley.x + pulleyRadius - hangingWidth / 2;
  const hangingY = pulley.y + pulleyRadius + hangingHeight / 2 + displacementPx;
  const stringY = blockY;
  const stringRightX = pulley.x + pulleyRadius;
  const targetDistanceTop = pulley.y + pulleyRadius + hangingHeight;
  const targetDistanceBottom = targetDistanceTop + visualDistance;
  const activeArrowClass = "animate-pulse drop-shadow-[0_0_8px_rgba(242,193,78,0.95)]";
  const active = (enabled: boolean) => ({ opacity: enabled ? 1 : 0.4, strokeWidth: enabled ? 6 : 4 });
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
    masses: guidedStep === 1,
    forces: guidedStep === 2,
    motion: guidedStep === 3 || guidedStep === 4,
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Atwood table physics visualization">
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
            <line x1={blockX - 18} y1={blockY - blockHeight / 2} x2={blockX - 18} y2={blockY - blockHeight / 2 - 64} />
            <line x1={blockX + blockWidth / 2} y1={blockY} x2={blockX + blockWidth / 2 + 68} y2={blockY} />
            <line x1={hangingX + hangingWidth / 2} y1={hangingY - hangingHeight / 2} x2={hangingX + hangingWidth / 2} y2={hangingY - hangingHeight / 2 - 58} />
          </g>
          <text x={blockX - 36} y={blockY - blockHeight / 2 - 70} fill="#1d4ed8" fontSize="15" fontWeight="800">N</text>
          <text x={blockX + blockWidth / 2 + 76} y={blockY - 8} fill="#1d4ed8" fontSize="15" fontWeight="800">T</text>
          <text x={hangingX + hangingWidth / 2 + 12} y={hangingY - hangingHeight / 2 - 54} fill="#1d4ed8" fontSize="15" fontWeight="800">T</text>

          <g className={highlights.forces ? activeArrowClass : ""} color="#c2410c" stroke="currentColor" markerEnd="url(#atwood-arrow)" style={active(highlights.forces)}>
            <line x1={blockX - 18} y1={blockY + blockHeight / 2} x2={blockX - 18} y2={blockY + blockHeight / 2 + 64} />
            <line x1={hangingX + hangingWidth / 2} y1={hangingY + hangingHeight / 2} x2={hangingX + hangingWidth / 2} y2={hangingY + hangingHeight / 2 + 68} />
          </g>
          <text x={blockX - 48} y={blockY + blockHeight / 2 + 78} fill="#9a3412" fontSize="15" fontWeight="800">m₁g</text>
          <text x={hangingX + hangingWidth / 2 + 12} y={hangingY + hangingHeight / 2 + 78} fill="#9a3412" fontSize="15" fontWeight="800">m₂g</text>

          {metrics.friction > 0 ? (
            <>
              <g className={highlights.forces ? activeArrowClass : ""} color="#7c3aed" stroke="currentColor" markerEnd="url(#atwood-arrow)" style={active(highlights.forces)}>
                <line x1={blockX - blockWidth / 2} y1={blockY + 4} x2={blockX - blockWidth / 2 - 66} y2={blockY + 4} />
              </g>
              <text x={blockX - blockWidth / 2 - 126} y={blockY - 4} fill="#6d28d9" fontSize="15" fontWeight="800">friction</text>
            </>
          ) : null}

          <g className={highlights.motion ? activeArrowClass : ""} color="#0f766e" stroke="currentColor" markerEnd="url(#atwood-arrow)" style={active(highlights.motion)}>
            <line x1={blockX - 18} y1={tableTop + 54} x2={blockX + 82} y2={tableTop + 54} />
            <line x1={hangingX + hangingWidth + 22} y1={hangingY - 16} x2={hangingX + hangingWidth + 22} y2={hangingY + 84} />
          </g>
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={run} disabled={running || !metrics.moves} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70">
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
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
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
        <div className="mt-4 grid gap-3 md:grid-cols-[0.75fr_1fr_1fr]">
          <div className="rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
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

// ── Projectile Motion ─────────────────────────────────────────────────────────

function projectileMetrics(config: SimulationConfig) {
  const angle = clamp(config.params.angle ?? 45, 1, 85);
  const speed = clamp(config.params.speed ?? 18, 1, 40);
  const gravity = clamp(config.world.gravity, 1, 20);
  const mass = clamp(config.params.mass ?? 1, 0.5, 5);
  const h0 = (config.params.initial_height ?? 0) / 10;
  const theta = (angle * Math.PI) / 180;
  const vx = speed * Math.cos(theta);
  const vy = speed * Math.sin(theta);
  const disc = vy * vy + 2 * gravity * h0;
  const tof = disc >= 0 ? (vy + Math.sqrt(disc)) / gravity : 0;
  const range = vx * tof;
  const peakTime = vy / gravity;
  const peakHeight = Math.max(0, h0 + (vy * vy) / (2 * gravity));
  return { angle, speed, vx, vy, gravity, mass, h0, tof, range, peakHeight, peakTime };
}

function ProjectileMotionScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => projectileMetrics(config), [config]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentY, setCurrentY] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  const GY = 430; const LX = 80; const TW = 600; const TH = 310;
  const toSVG = (x_m: number, y_m: number) => ({
    x: LX + (metrics.range > 0 ? (x_m / metrics.range) * TW : 0),
    y: GY - (metrics.peakHeight > 0 ? clamp((y_m / metrics.peakHeight) * TH, 0, TH + 60) : 0),
  });
  const t_now = progress * metrics.tof;
  const ballSVG = toSVG(metrics.vx * t_now, Math.max(0, metrics.vy * t_now - 0.5 * metrics.gravity * t_now * t_now));
  const pathPts = Array.from({ length: 51 }, (_, i) => {
    const t = (i / 50) * metrics.tof;
    const s = toSVG(metrics.vx * t, Math.max(0, metrics.vy * t - 0.5 * metrics.gravity * t * t));
    return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
  }).join(" ");

  useEffect(() => {
    setProgress(0); setRunning(false); setCurrentY(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.angle, metrics.speed, metrics.gravity, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0); setCurrentY(0);
    const startedAt = performance.now();
    const dur = clamp(metrics.tof * 900, 800, 4500);
    setRunning(true);
    const tick = (now: number) => {
      const p = clamp((now - startedAt) / dur, 0, 1);
      const t = p * metrics.tof;
      setProgress(p);
      setCurrentY(Math.max(0, metrics.vy * t - 0.5 * metrics.gravity * t * t));
      if (p < 1) { frameRef.current = requestAnimationFrame(tick); return; }
      setRunning(false);
      onOutcome({ launched: true, success: true, metrics: { range_m: metrics.range, peak_height_m: metrics.peakHeight, time_of_flight_s: metrics.tof } });
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setProgress(0); setCurrentY(0);
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const AL = 54;
  const theta_r = (metrics.angle * Math.PI) / 180;
  const vxEnd = { x: LX + (metrics.vx / metrics.speed) * AL, y: GY };
  const vyEnd = { x: LX, y: GY - (metrics.vy / metrics.speed) * AL };

  const stepCopy = [
    { title: "Launch Conditions", equation: `v₀ = ${fmt(metrics.speed)} m/s at θ = ${metrics.angle}°`, notice: "Launch angle and speed fully determine the trajectory when air resistance is zero.", diagram: "The gold arrow shows the initial velocity vector at the launch point." },
    { title: "Velocity Components", equation: `vₓ = ${fmt(metrics.vx)} m/s,  vy = ${fmt(metrics.vy)} m/s`, notice: "Horizontal velocity stays constant. Vertical velocity decreases at g until peak, then increases downward.", diagram: "Blue = vₓ (constant horizontal), red = vy (decreasing vertical component)." },
    { title: "Equations of Motion", equation: "x = vₓt,  y = vyt − ½gt²", notice: "The two axes are completely independent. The parabolic shape comes from constant vₓ and linearly changing vy.", diagram: "The dashed arc shows the full parabolic trajectory from launch to landing." },
    { title: "Flight and Landing", equation: `R = ${fmt(metrics.range)} m,  h_peak = ${fmt(metrics.peakHeight)} m`, notice: `Peak is at t = ${fmt(metrics.peakTime)} s when vy = 0. Range is maximized at 45° for flat ground.`, diagram: "Watch the ball arc. Speed is scaled for visibility — actual physics time is " + fmt(metrics.tof) + " s." },
  ][guidedStep - 1];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Projectile motion visualization">
          <defs>
            <marker id="pm-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <rect x="0" y={GY} width={WIDTH} height={HEIGHT - GY} fill="#d4e4dc" />
          <line x1="0" y1={GY} x2={WIDTH} y2={GY} stroke="#172033" strokeWidth="5" />
          <rect x={LX - 22} y={GY - 14} width="44" height="14" rx="4" fill="#172033" />
          <rect x={LX - 6} y={GY - 32} width="12" height="26" rx="3" fill="#2f3d3f" transform={`rotate(-${metrics.angle} ${LX} ${GY})`} />
          {guidedStep >= 3 && <polyline points={pathPts} fill="none" stroke="#216869" strokeWidth="3" strokeDasharray="10 6" opacity="0.5" />}
          {guidedStep >= 3 && <circle cx={ballSVG.x} cy={ballSVG.y} r="14" fill="#216869" stroke="#172033" strokeWidth="3" />}
          {guidedStep >= 3 && metrics.range > 0 && (
            <>
              <line x1={LX + TW} y1={GY - 28} x2={LX + TW} y2={GY + 12} stroke="#f2c14e" strokeWidth="3" />
              <text x={LX + TW - 66} y={GY + 30} fill="#172033" fontSize="13" fontWeight="700">R = {fmt(metrics.range)} m</text>
            </>
          )}
          {guidedStep === 1 && (
            <g color="#f2c14e" stroke="currentColor" markerEnd="url(#pm-arr)" strokeWidth="5" className="animate-pulse drop-shadow-[0_0_8px_rgba(242,193,78,0.9)]">
              <line x1={LX} y1={GY} x2={LX + Math.cos(theta_r) * AL} y2={GY - Math.sin(theta_r) * AL} />
            </g>
          )}
          {guidedStep === 2 && (
            <>
              <g color="#1d4ed8" stroke="currentColor" markerEnd="url(#pm-arr)" strokeWidth="5" className="animate-pulse"><line x1={LX} y1={GY} x2={vxEnd.x} y2={vxEnd.y} /></g>
              <text x={vxEnd.x + 6} y={GY + 5} fill="#1d4ed8" fontSize="13" fontWeight="700">vₓ</text>
              <g color="#c2410c" stroke="currentColor" markerEnd="url(#pm-arr)" strokeWidth="5" className="animate-pulse"><line x1={LX} y1={GY} x2={vyEnd.x} y2={vyEnd.y} /></g>
              <text x={LX + 8} y={vyEnd.y - 5} fill="#c2410c" fontSize="13" fontWeight="700">vy</text>
            </>
          )}
          <path d={`M ${LX + 46} ${GY} A 46 46 0 0 0 ${LX + 46 * Math.cos(theta_r)} ${GY - 46 * Math.sin(theta_r)}`} fill="none" stroke="#f2c14e" strokeWidth="4" />
          <text x={LX + 52} y={GY - 8} fill="#172033" fontSize="13" fontWeight="700">θ={metrics.angle}°</text>
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "In Flight…" : "Launch"}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"><RotateCcw size={18} />Reset</button>
        <div className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e]/20 px-3 py-2 text-sm font-semibold text-slate-800"><Target size={17} />Textbook Equations</div>
      </div>
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guided Breakdown</div><h3 className="mt-1 text-lg font-black text-slate-950">Step {guidedStep} / 4: {stepCopy.title}</h3></div>
          <div className="flex gap-2">
            <button onClick={() => goToStep(guidedStep - 1)} disabled={guidedStep === 1} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous Step</button>
            <button onClick={() => goToStep(guidedStep + 1)} disabled={guidedStep === 4} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Next Step</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[0.75fr_1fr_1fr]">
          <div className="rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">v₀ = {fmt(metrics.speed, 1)} m/s<br />θ = {metrics.angle}°<br />g = {fmt(metrics.gravity, 1)} m/s²</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">vₓ = v₀cosθ<br />vy = v₀sinθ<br />y = vyt − ½gt²<br />R = vₓ · t_f</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">vₓ = {fmt(metrics.vx)} m/s<br />vy = {fmt(metrics.vy)} m/s<br />t_peak = {fmt(metrics.peakTime)} s</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">Current height:</span> {fmt(currentY)} m</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Range:</span> {fmt(metrics.range)} m</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Peak height:</span> {fmt(metrics.peakHeight)} m</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Time of flight:</span> {fmt(metrics.tof)} s</div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Pendulum ──────────────────────────────────────────────────────────────────

function pendulumMetrics(config: SimulationConfig) {
  const lengthPx = clamp(config.params.length ?? 150, 50, 250);
  const initialAngle = clamp(config.params.initial_angle ?? 45, 5, 80);
  const mass = clamp(config.params.mass ?? 1, 0.5, 5);
  const gravity = clamp(config.world.gravity, 1, 20);
  const L_m = lengthPx / 50;
  const theta0 = (initialAngle * Math.PI) / 180;
  const period = 2 * Math.PI * Math.sqrt(L_m / gravity);
  const omega = (2 * Math.PI) / period;
  const maxSpeed = Math.sqrt(2 * gravity * L_m * (1 - Math.cos(theta0)));
  const maxHeight = L_m * (1 - Math.cos(theta0));
  return { lengthPx, initialAngle, mass, gravity, L_m, theta0, period, omega, maxSpeed, maxHeight };
}

function PendulumScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => pendulumMetrics(config), [config]);
  const [angle, setAngle] = useState(metrics.theta0);
  const [running, setRunning] = useState(false);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const pivotX = WIDTH / 2; const pivotY = 72;
  const armPx = clamp(metrics.L_m * 120, 100, 320);
  const bobX = pivotX + Math.sin(angle) * armPx;
  const bobY = pivotY + Math.cos(angle) * armPx;
  const arcR = Math.min(armPx * 0.55, 100);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setAngle(metrics.theta0);
    setRunning(false);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.theta0, metrics.omega, metrics.period, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = performance.now();
    setRunning(true);
    const tick = (now: number) => {
      const t = (now - startRef.current) / 1000;
      setAngle(metrics.theta0 * Math.cos(metrics.omega * t));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { period_s: metrics.period, max_speed_m_s: metrics.maxSpeed, max_height_m: metrics.maxHeight } });
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setAngle(metrics.theta0);
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const stepCopy = [
    { title: "Pendulum Setup", equation: `L = ${fmt(metrics.L_m, 2)} m,  m = ${fmt(metrics.mass, 1)} kg,  θ₀ = ${metrics.initialAngle}°`, notice: "Only the string length and initial angle (and gravity) determine the period — not the mass.", diagram: "The pendulum starts at angle θ₀ from vertical. The arm length L is shown to scale." },
    { title: "Forces on the Bob", equation: "T − mg cosθ = mv²/L  (radial),  mg sinθ = ma_t  (tangential)", notice: "Tension provides centripetal force. The tangential component of gravity drives the restoring acceleration.", diagram: "Tension arrow points up the string toward the pivot; gravity arrow points straight down." },
    { title: "SHM Approximation", equation: `ω = √(g/L) = ${fmt(metrics.omega, 3)} rad/s,  T = 2π/ω = ${fmt(metrics.period, 3)} s`, notice: "For small angles (< ~15°) the motion is simple harmonic. For larger angles the period increases slightly.", diagram: "The angle arc shows θ₀. Notice period depends only on L and g, not mass." },
    { title: "Oscillation", equation: `θ(t) = θ₀ cos(ωt),  v_max = ${fmt(metrics.maxSpeed, 2)} m/s`, notice: `Max speed occurs at the bottom. The bob gains ${fmt(metrics.maxHeight, 3)} m of kinetic energy converting from potential energy.`, diagram: "Watch the bob swing continuously. The period remains constant for a given L and g." },
  ][guidedStep - 1];

  const showForces = guidedStep === 2;
  const tensionEnd = { x: pivotX + (pivotX - bobX) * 0.55, y: pivotY + (pivotY - bobY) * 0.55 };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Pendulum visualization">
          <defs>
            <marker id="pend-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <rect x={pivotX - 44} y={pivotY - 14} width="88" height="14" rx="3" fill="#172033" />
          <line x1={pivotX} y1={pivotY} x2={pivotX} y2={pivotY + armPx + 30} stroke="#94a3b8" strokeWidth="1" strokeDasharray="6 4" />
          {/* Arc sweep to show θ */}
          <path d={`M ${pivotX} ${pivotY + arcR} A ${arcR} ${arcR} 0 0 ${metrics.theta0 >= 0 ? 1 : 0} ${pivotX + Math.sin(metrics.theta0) * arcR} ${pivotY + Math.cos(metrics.theta0) * arcR}`} fill="none" stroke="#f2c14e" strokeWidth="3" />
          <text x={pivotX + Math.sin(metrics.theta0 / 2) * (arcR + 14)} y={pivotY + Math.cos(metrics.theta0 / 2) * (arcR + 14) + 4} fill="#92400e" fontSize="13" fontWeight="700">{metrics.initialAngle}°</text>
          <line x1={pivotX} y1={pivotY} x2={bobX} y2={bobY} stroke="#172033" strokeWidth="4" strokeLinecap="round" />
          <circle cx={pivotX} cy={pivotY} r="8" fill="#172033" />
          {showForces && (
            <>
              <g color="#1d4ed8" stroke="currentColor" markerEnd="url(#pend-arr)" strokeWidth="5" className="animate-pulse drop-shadow-[0_0_8px_rgba(29,78,216,0.8)]">
                <line x1={bobX} y1={bobY} x2={tensionEnd.x} y2={tensionEnd.y} />
              </g>
              <text x={tensionEnd.x + 8} y={tensionEnd.y - 6} fill="#1d4ed8" fontSize="14" fontWeight="700">T</text>
              <g color="#c2410c" stroke="currentColor" markerEnd="url(#pend-arr)" strokeWidth="5" className="animate-pulse drop-shadow-[0_0_8px_rgba(194,65,12,0.8)]">
                <line x1={bobX} y1={bobY} x2={bobX} y2={bobY + 60} />
              </g>
              <text x={bobX + 8} y={bobY + 64} fill="#9a3412" fontSize="14" fontWeight="700">mg</text>
            </>
          )}
          <circle cx={bobX} cy={bobY} r={clamp(metrics.mass * 10 + 12, 16, 30)} fill="#216869" stroke="#172033" strokeWidth="3" />
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "Swinging…" : "Release"}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"><RotateCcw size={18} />Reset</button>
        <div className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e]/20 px-3 py-2 text-sm font-semibold text-slate-800"><Target size={17} />Textbook Equations</div>
      </div>
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guided Breakdown</div><h3 className="mt-1 text-lg font-black text-slate-950">Step {guidedStep} / 4: {stepCopy.title}</h3></div>
          <div className="flex gap-2">
            <button onClick={() => goToStep(guidedStep - 1)} disabled={guidedStep === 1} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous Step</button>
            <button onClick={() => goToStep(guidedStep + 1)} disabled={guidedStep === 4} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Next Step</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[0.75fr_1fr_1fr]">
          <div className="rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">L = {fmt(metrics.L_m, 2)} m<br />m = {fmt(metrics.mass, 1)} kg<br />θ₀ = {metrics.initialAngle}°<br />g = {fmt(metrics.gravity, 1)} m/s²</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">ω = √(g/L)<br />T = 2π/ω<br />θ(t) = θ₀cos(ωt)<br />v_max = ω·L·sinθ₀</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">ω = {fmt(metrics.omega, 3)} rad/s<br />T = {fmt(metrics.period, 3)} s<br />v_max = {fmt(metrics.maxSpeed, 2)} m/s<br />h_max = {fmt(metrics.maxHeight, 3)} m</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Period:</span> {fmt(metrics.period, 3)} s</div>
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">Max speed:</span> {fmt(metrics.maxSpeed, 2)} m/s  (at bottom)</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Max height gain:</span> {fmt(metrics.maxHeight, 3)} m</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Angular freq ω:</span> {fmt(metrics.omega, 3)} rad/s</div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── 1D Collision ──────────────────────────────────────────────────────────────

function collisionMetrics(config: SimulationConfig) {
  const m1 = clamp(config.params.mass1 ?? 2, 0.5, 10);
  const v1 = clamp(config.params.v1 ?? 5, -20, 20);
  const m2 = clamp(config.params.mass2 ?? 1, 0.5, 10);
  const v2 = clamp(config.params.v2 ?? -2, -20, 20);
  const e = clamp(config.params.restitution ?? 0.8, 0, 1);
  const v1f = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / (m1 + m2);
  const v2f = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / (m1 + m2);
  const momentum = m1 * v1 + m2 * v2;
  const keI = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const keF = 0.5 * m1 * v1f * v1f + 0.5 * m2 * v2f * v2f;
  return { m1, v1, m2, v2, e, v1f, v2f, momentum, keInitial: keI, keLost: Math.max(0, keI - keF) };
}

function CollisionScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => collisionMetrics(config), [config]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"pre" | "collision" | "post">("pre");
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  const GY = 380; const cy = GY - 40;
  const B1W = clamp(metrics.m1 * 22, 44, 110); const B2W = clamp(metrics.m2 * 22, 44, 110);
  const BH = 52; const midX = WIDTH / 2;

  const x1 = (() => {
    if (phase === "pre") return 60 + progress * (midX - B1W - 62);
    if (phase === "collision") return midX - B1W;
    const dir = metrics.v1f >= 0 ? 1 : -1;
    return midX - B1W + dir * progress * (WIDTH * 0.28);
  })();
  const x2 = (() => {
    if (phase === "pre") return WIDTH - 60 - B2W - progress * (WIDTH - 60 - B2W - midX);
    if (phase === "collision") return midX;
    const dir = metrics.v2f >= 0 ? 1 : -1;
    return midX + dir * progress * (WIDTH * 0.28);
  })();

  const velLabel1 = phase === "post" ? `${fmt(metrics.v1f)} m/s` : `${fmt(metrics.v1)} m/s`;
  const velLabel2 = phase === "post" ? `${fmt(metrics.v2f)} m/s` : `${fmt(metrics.v2)} m/s`;

  useEffect(() => {
    setProgress(0); setPhase("pre"); setRunning(false);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.m1, metrics.v1, metrics.m2, metrics.v2, metrics.e, onOutcome]);

  const runPhase = useCallback((ph: "pre" | "collision" | "post", dur: number, onDone?: () => void) => {
    setPhase(ph); setProgress(0);
    const startedAt = performance.now();
    const tick = (now: number) => {
      const p = clamp((now - startedAt) / dur, 0, 1);
      setProgress(p);
      if (p < 1) { frameRef.current = requestAnimationFrame(tick); return; }
      onDone?.();
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(true);
    runPhase("pre", 1200, () =>
      runPhase("collision", 300, () =>
        runPhase("post", 1200, () => {
          setRunning(false);
          onOutcome({ launched: true, success: true, metrics: { v1_final_m_s: metrics.v1f, v2_final_m_s: metrics.v2f, ke_lost_j: metrics.keLost, momentum_kg_m_s: metrics.momentum } });
        })
      )
    );
  }, [runPhase, metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setProgress(0); setPhase("pre");
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const stepCopy = [
    { title: "Initial State", equation: `m₁ = ${fmt(metrics.m1, 1)} kg @ ${fmt(metrics.v1, 1)} m/s,  m₂ = ${fmt(metrics.m2, 1)} kg @ ${fmt(metrics.v2, 1)} m/s`, notice: "Positive velocity means moving right. The blocks approach each other if their velocities point toward the center.", diagram: "Green block (m₁) on the left, purple block (m₂) on the right. Velocity labels show direction." },
    { title: "Conservation of Momentum", equation: `p = m₁v₁ + m₂v₂ = ${fmt(metrics.momentum, 2)} kg·m/s  (conserved)`, notice: "Total momentum is the same before and after in any collision. Only energy may be lost.", diagram: "The system's total momentum is constant — it's the same number before and after the flash." },
    { title: "Coefficient of Restitution", equation: `e = (v₂' − v₁') / (v₁ − v₂) = ${fmt(metrics.e, 2)}`, notice: `e = 1 is perfectly elastic (no energy loss), e = 0 is perfectly inelastic (they stick). Here KE lost = ${fmt(metrics.keLost, 2)} J.`, diagram: "e controls how 'bouncy' the collision is. Watch how the separation speed compares to the approach speed." },
    { title: "Post-Collision Velocities", equation: `v₁' = ${fmt(metrics.v1f, 2)} m/s,  v₂' = ${fmt(metrics.v2f, 2)} m/s`, notice: "Both momentum and restitution equations together give two equations for two unknowns (v₁' and v₂').", diagram: "Watch the blocks collide. After the flash, they move with the new velocities shown above." },
  ][guidedStep - 1];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="1D collision visualization">
          <defs>
            <marker id="col-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <rect x="0" y={GY} width={WIDTH} height={HEIGHT - GY} fill="#d4e4dc" />
          <line x1="0" y1={GY} x2={WIDTH} y2={GY} stroke="#172033" strokeWidth="5" />
          {/* Block 1 */}
          <rect x={x1} y={cy - BH / 2} width={B1W} height={BH} rx="7" fill={phase === "collision" ? "#f2c14e" : "#216869"} />
          <text x={x1 + B1W / 2} y={cy + 6} textAnchor="middle" fill="white" fontSize="16" fontWeight="800">m₁</text>
          <text x={x1 + B1W / 2} y={cy - BH / 2 - 10} textAnchor="middle" fill="#216869" fontSize="13" fontWeight="700">{velLabel1}</text>
          {/* Block 2 */}
          <rect x={x2} y={cy - BH / 2} width={B2W} height={BH} rx="7" fill={phase === "collision" ? "#f2c14e" : "#7c3aed"} />
          <text x={x2 + B2W / 2} y={cy + 6} textAnchor="middle" fill="white" fontSize="16" fontWeight="800">m₂</text>
          <text x={x2 + B2W / 2} y={cy - BH / 2 - 10} textAnchor="middle" fill="#7c3aed" fontSize="13" fontWeight="700">{velLabel2}</text>
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "Colliding…" : "Run Collision"}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"><RotateCcw size={18} />Reset</button>
        <div className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e]/20 px-3 py-2 text-sm font-semibold text-slate-800"><Target size={17} />Textbook Equations</div>
      </div>
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guided Breakdown</div><h3 className="mt-1 text-lg font-black text-slate-950">Step {guidedStep} / 4: {stepCopy.title}</h3></div>
          <div className="flex gap-2">
            <button onClick={() => goToStep(guidedStep - 1)} disabled={guidedStep === 1} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous Step</button>
            <button onClick={() => goToStep(guidedStep + 1)} disabled={guidedStep === 4} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Next Step</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[0.75fr_1fr_1fr]">
          <div className="rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">m₁ = {fmt(metrics.m1, 1)} kg<br />v₁ = {fmt(metrics.v1, 1)} m/s<br />m₂ = {fmt(metrics.m2, 1)} kg<br />v₂ = {fmt(metrics.v2, 1)} m/s<br />e = {fmt(metrics.e, 2)}</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">p_i = p_f<br />e = (v₂&apos;−v₁&apos;)/(v₁−v₂)<br />v₁&apos; = (m₁−em₂)v₁+(1+e)m₂v₂ / (m₁+m₂)</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">v₁&apos; = {fmt(metrics.v1f, 2)} m/s<br />v₂&apos; = {fmt(metrics.v2f, 2)} m/s<br />p = {fmt(metrics.momentum, 2)} kg·m/s<br />KE lost = {fmt(metrics.keLost, 2)} J</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">v₁ final:</span> {fmt(metrics.v1f, 2)} m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">v₂ final:</span> {fmt(metrics.v2f, 2)} m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Momentum (conserved):</span> {fmt(metrics.momentum, 2)} kg·m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">KE lost:</span> {fmt(metrics.keLost, 2)} J {metrics.e >= 0.99 ? "(elastic — none)" : ""}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Free Fall ─────────────────────────────────────────────────────────────────

function freeFallMetrics(config: SimulationConfig) {
  const heightPx = clamp(config.params.height ?? 200, 50, 400);
  const mass = clamp(config.params.mass ?? 1, 0.5, 10);
  const k = clamp(config.params.air_resistance ?? 0, 0, 0.1);
  const gravity = clamp(config.world.gravity, 1, 20);
  const h = heightPx / 10;
  const tof = k === 0 ? Math.sqrt((2 * h) / gravity) : Math.sqrt((2 * h) / gravity) * (1 + (k * h) / 3);
  const vImpact = k === 0 ? gravity * tof : Math.sqrt(2 * gravity * h) * (1 - (k * h) / 4);
  return { heightPx, h, mass, k, gravity, tof, vImpact };
}

function FreeFallScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => freeFallMetrics(config), [config]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  const topY = 60; const groundY = 440; const cx = WIDTH / 2;
  const ballR = clamp(metrics.mass * 6 + 12, 14, 30);
  const dropH = groundY - topY - ballR;
  const ballY = topY + ballR + progress * dropH;
  const speedNow = metrics.gravity * (progress * metrics.tof);
  const arrowLen = clamp(speedNow * 6, 0, 70);

  useEffect(() => {
    setProgress(0); setRunning(false); setCurrentSpeed(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.h, metrics.gravity, metrics.k, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0); setCurrentSpeed(0);
    const startedAt = performance.now();
    const dur = clamp(metrics.tof * 900, 700, 4000);
    setRunning(true);
    const tick = (now: number) => {
      const p = clamp((now - startedAt) / dur, 0, 1);
      const t = p * metrics.tof;
      setProgress(p);
      setCurrentSpeed(metrics.gravity * t);
      if (p < 1) { frameRef.current = requestAnimationFrame(tick); return; }
      setRunning(false);
      onOutcome({ launched: true, success: true, metrics: { time_s: metrics.tof, impact_speed_m_s: metrics.vImpact } });
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setProgress(0); setCurrentSpeed(0);
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const stepCopy = [
    { title: "Setup", equation: `h = ${fmt(metrics.h, 1)} m,  m = ${fmt(metrics.mass, 1)} kg,  g = ${fmt(metrics.gravity, 1)} m/s²`, notice: "In free fall (no air resistance), all objects fall at the same rate regardless of mass. Galileo's insight.", diagram: "The ball starts at height h. The dashed line shows the drop distance to the ground." },
    { title: "Forces", equation: metrics.k === 0 ? "Only gravity: F = mg (net force, no drag)" : `F_net = mg − kv  (drag coefficient k = ${fmt(metrics.k, 3)})`, notice: metrics.k === 0 ? "Without air resistance, acceleration is constant at g throughout the fall." : "Air resistance grows with speed, gradually reducing the net downward force.", diagram: "The red arrow shows the net downward force. It grows if there is air resistance as speed increases." },
    { title: "Kinematics", equation: "v² = 2gh  →  v_impact = √(2gh)", notice: `Using energy: mgh = ½mv² cancels mass, giving v = ${fmt(metrics.vImpact, 2)} m/s regardless of m (vacuum).`, diagram: "The height label shows h in meters. The impact speed comes purely from the drop height and gravity." },
    { title: "Free Fall", equation: `t = √(2h/g) = ${fmt(metrics.tof, 2)} s,  v_impact = ${fmt(metrics.vImpact, 2)} m/s`, notice: "The velocity arrow grows linearly with time in vacuum. With drag it grows slower as air resistance builds up.", diagram: "Watch the red arrow lengthen as the ball accelerates downward." },
  ][guidedStep - 1];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Free fall visualization">
          <defs>
            <marker id="ff-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          <rect x="0" y={groundY} width={WIDTH} height={HEIGHT - groundY} fill="#d4e4dc" />
          <line x1="0" y1={groundY} x2={WIDTH} y2={groundY} stroke="#172033" strokeWidth="5" />
          {/* Height label */}
          <line x1={cx + 80} y1={topY + ballR} x2={cx + 80} y2={groundY} stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 4" />
          <line x1={cx + 68} y1={topY + ballR} x2={cx + 92} y2={topY + ballR} stroke="#94a3b8" strokeWidth="2" />
          <line x1={cx + 68} y1={groundY} x2={cx + 92} y2={groundY} stroke="#94a3b8" strokeWidth="2" />
          <text x={cx + 96} y={(topY + groundY) / 2 + 5} fill="#475569" fontSize="14" fontWeight="700">h = {fmt(metrics.h, 1)} m</text>
          {/* Velocity arrow */}
          {arrowLen > 4 && (
            <g color="#c2410c" stroke="currentColor" markerEnd="url(#ff-arr)" strokeWidth="4">
              <line x1={cx} y1={ballY + ballR + 4} x2={cx} y2={ballY + ballR + 4 + arrowLen} />
            </g>
          )}
          {/* Ball */}
          <circle cx={cx} cy={ballY} r={ballR} fill="#216869" stroke="#172033" strokeWidth="3" />
          {progress >= 0.99 && <text x={cx} y={groundY + 28} textAnchor="middle" fill="#c2410c" fontSize="14" fontWeight="800">Impact: {fmt(metrics.vImpact, 2)} m/s</text>}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "Falling…" : "Drop"}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"><RotateCcw size={18} />Reset</button>
        <div className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e]/20 px-3 py-2 text-sm font-semibold text-slate-800"><Target size={17} />Textbook Equations</div>
      </div>
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guided Breakdown</div><h3 className="mt-1 text-lg font-black text-slate-950">Step {guidedStep} / 4: {stepCopy.title}</h3></div>
          <div className="flex gap-2">
            <button onClick={() => goToStep(guidedStep - 1)} disabled={guidedStep === 1} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous Step</button>
            <button onClick={() => goToStep(guidedStep + 1)} disabled={guidedStep === 4} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Next Step</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[0.75fr_1fr_1fr]">
          <div className="rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">h = {fmt(metrics.h, 1)} m<br />m = {fmt(metrics.mass, 1)} kg<br />g = {fmt(metrics.gravity, 1)} m/s²<br />k = {fmt(metrics.k, 3)}</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">v² = 2gh<br />t = √(2h/g)<br />v = gt  (vacuum)<br />F = mg − kv (drag)</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">t = {fmt(metrics.tof, 2)} s<br />v_impact = {fmt(metrics.vImpact, 2)} m/s</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">Current speed:</span> {fmt(currentSpeed)} m/s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Time to ground:</span> {fmt(metrics.tof, 2)} s</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Impact speed:</span> {fmt(metrics.vImpact, 2)} m/s</div>
            {metrics.k > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Air resistance active — impact speed is reduced by drag.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Spring-Mass ───────────────────────────────────────────────────────────────

function springMassMetrics(config: SimulationConfig) {
  const k = clamp(config.params.spring_constant ?? 20, 1, 100);
  const mass = clamp(config.params.mass ?? 1, 0.5, 5);
  const amplitude = clamp(config.params.amplitude ?? 0.5, 0.05, 1.5);
  const gravity = clamp(config.world.gravity, 1, 20);
  const omega = Math.sqrt(k / mass);
  const period = (2 * Math.PI) / omega;
  const maxSpeed = omega * amplitude;
  const maxForce = k * amplitude;
  return { k, mass, amplitude, gravity, omega, period, maxSpeed, maxForce };
}

function SpringMassScene({ config, onOutcome }: Props) {
  const metrics = useMemo(() => springMassMetrics(config), [config]);
  const [disp, setDisp] = useState(metrics.amplitude);
  const [running, setRunning] = useState(false);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const wallX = 80; const eqX = 380; const massW = 64; const massH = 64; const massY = 220;
  const SCALE = 120; // px per meter
  const massCX = eqX + disp * SCALE;
  const massLeft = massCX - massW / 2;
  const springRight = massLeft;
  const springCoils = 8;
  const springPath = (() => {
    const x1 = wallX + 14; const x2 = springRight; const cy = massY + massH / 2;
    const len = x2 - x1; if (len < 4) return `M ${x1} ${cy} L ${x2} ${cy}`;
    const step = len / (springCoils * 2 + 1); const amp = 16;
    const pts = [`M ${x1} ${cy}`];
    for (let i = 0; i < springCoils * 2 + 1; i++) {
      pts.push(`L ${(x1 + (i + 0.5) * step).toFixed(1)} ${(cy + (i % 2 === 0 ? -amp : amp)).toFixed(1)}`);
    }
    pts.push(`L ${x2} ${cy}`); return pts.join(" ");
  })();
  const forceDir = -disp; // F = -kx, negative disp means force is rightward
  const forceLen = clamp(Math.abs(disp) * SCALE * 0.7, 0, 90);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setDisp(metrics.amplitude); setRunning(false);
    onOutcome({ launched: false, success: false, metrics: {} });
  }, [metrics.k, metrics.mass, metrics.amplitude, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startRef.current = performance.now();
    setRunning(true);
    const tick = (now: number) => {
      const t = (now - startRef.current) / 1000;
      setDisp(metrics.amplitude * Math.cos(metrics.omega * t));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    onOutcome({ launched: true, success: true, metrics: { period_s: metrics.period, max_speed_m_s: metrics.maxSpeed, max_force_n: metrics.maxForce } });
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false); setDisp(metrics.amplitude);
    onOutcome({ launched: false, success: false, metrics: {} });
  };
  const goToStep = (s: number) => { const n = clamp(s, 1, 4); setGuidedStep(n); if (n === 4) run(); };

  const stepCopy = [
    { title: "System Setup", equation: `k = ${fmt(metrics.k, 1)} N/m,  m = ${fmt(metrics.mass, 1)} kg,  A = ${fmt(metrics.amplitude, 2)} m`, notice: "The mass is displaced from equilibrium and released. The spring constant k determines how stiff the spring is.", diagram: "The block sits at amplitude A from the equilibrium (center dashed line). Spring is compressed or stretched." },
    { title: "Restoring Force", equation: "F = −kx  (Hooke's Law)", notice: "The force always points toward equilibrium — negative when displaced right, positive when displaced left. This is the hallmark of SHM.", diagram: "The orange force arrow points toward the center. It is largest at max displacement and zero at equilibrium." },
    { title: "SHM Equations", equation: `ω = √(k/m) = ${fmt(metrics.omega, 3)} rad/s,  T = 2π/ω = ${fmt(metrics.period, 3)} s`, notice: "Period depends only on k and m, not amplitude. Doubling amplitude does not change how fast it oscillates.", diagram: "The equilibrium dashed line shows x=0. The block will always take the same time for each full cycle." },
    { title: "Oscillation", equation: `x(t) = A cos(ωt),  v_max = Aω = ${fmt(metrics.maxSpeed, 2)} m/s`, notice: "Max speed occurs at equilibrium (x=0), zero speed at max displacement. Energy converts between KE and PE.", diagram: "Watch the block oscillate. The spring compression/extension mirrors the displacement symmetrically." },
  ][guidedStep - 1];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <svg className="aspect-[1.46] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Spring-mass oscillation visualization">
          <defs>
            <marker id="sm-arr" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="#eef5f1" />
          {/* Floor */}
          <rect x="0" y={massY + massH} width={WIDTH} height={HEIGHT - massY - massH} fill="#d4e4dc" />
          <line x1="0" y1={massY + massH} x2={WIDTH} y2={massY + massH} stroke="#172033" strokeWidth="4" />
          {/* Wall */}
          <rect x="0" y={massY - 30} width={wallX} height={massH + 60} rx="4" fill="#2f3d3f" />
          {/* Equilibrium line */}
          <line x1={eqX} y1={massY - 20} x2={eqX} y2={massY + massH + 20} stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 4" />
          <text x={eqX + 6} y={massY - 24} fill="#94a3b8" fontSize="12" fontWeight="600">x=0</text>
          {/* Spring */}
          <path d={springPath} fill="none" stroke="#172033" strokeWidth="3" strokeLinecap="round" />
          {/* Force arrow (step 2+) */}
          {guidedStep >= 2 && forceLen > 4 && (
            <g color="#f2c14e" stroke="currentColor" markerEnd="url(#sm-arr)" strokeWidth="5" className="animate-pulse drop-shadow-[0_0_8px_rgba(242,193,78,0.8)]">
              <line x1={massCX} y1={massY + massH / 2} x2={massCX + (forceDir > 0 ? forceLen : -forceLen)} y2={massY + massH / 2} />
            </g>
          )}
          {guidedStep >= 2 && forceLen > 4 && <text x={massCX + (forceDir > 0 ? forceLen + 8 : -forceLen - 32)} y={massY + massH / 2 - 8} fill="#92400e" fontSize="13" fontWeight="700">F = {fmt(-metrics.k * disp, 1)} N</text>}
          {/* Mass block */}
          <rect x={massLeft} y={massY} width={massW} height={massH} rx="7" fill="#216869" stroke="#172033" strokeWidth="3" />
          <text x={massCX} y={massY + massH / 2 + 6} textAnchor="middle" fill="white" fontSize="15" fontWeight="800">m</text>
          {/* Displacement label */}
          {Math.abs(disp) > 0.01 && (
            <>
              <line x1={eqX} y1={massY + massH + 24} x2={massCX} y2={massY + massH + 24} stroke="#216869" strokeWidth="2" markerEnd="url(#sm-arr)" />
              <text x={(eqX + massCX) / 2} y={massY + massH + 42} textAnchor="middle" fill="#216869" fontSize="12" fontWeight="700">x = {fmt(disp, 2)} m</text>
            </>
          )}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556] disabled:cursor-not-allowed disabled:opacity-70"><Zap size={18} />{running ? "Oscillating…" : "Release"}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50"><RotateCcw size={18} />Reset</button>
        <div className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e]/20 px-3 py-2 text-sm font-semibold text-slate-800"><Target size={17} />Textbook Equations</div>
      </div>
      <section className="mt-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Guided Breakdown</div><h3 className="mt-1 text-lg font-black text-slate-950">Step {guidedStep} / 4: {stepCopy.title}</h3></div>
          <div className="flex gap-2">
            <button onClick={() => goToStep(guidedStep - 1)} disabled={guidedStep === 1} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous Step</button>
            <button onClick={() => goToStep(guidedStep + 1)} disabled={guidedStep === 4} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Next Step</button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[0.75fr_1fr_1fr]">
          <div className="rounded-md bg-slate-100 p-3 text-sm font-bold text-slate-900">{stepCopy.equation}</div>
          <p className="rounded-md bg-[#216869]/10 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Notice:</span> {stepCopy.notice}</p>
          <p className="rounded-md bg-[#f2c14e]/20 p-3 text-sm leading-6 text-slate-700"><span className="font-bold text-slate-950">Diagram cue:</span> {stepCopy.diagram}</p>
        </div>
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Textbook Model</h3>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <div><div className="font-bold text-slate-900">Given</div><p className="mt-1 leading-6">k = {fmt(metrics.k, 1)} N/m<br />m = {fmt(metrics.mass, 1)} kg<br />A = {fmt(metrics.amplitude, 2)} m</p></div>
            <div><div className="font-bold text-slate-900">Equations</div><p className="mt-1 leading-6">F = −kx<br />ω = √(k/m)<br />T = 2π/ω<br />x(t) = A cos(ωt)</p></div>
            <div><div className="font-bold text-slate-900">Results</div><p className="mt-1 leading-6">ω = {fmt(metrics.omega, 3)} rad/s<br />T = {fmt(metrics.period, 3)} s<br />v_max = {fmt(metrics.maxSpeed, 2)} m/s<br />F_max = {fmt(metrics.maxForce, 2)} N</p></div>
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Results</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Period:</span> {fmt(metrics.period, 3)} s</div>
            <div className="rounded-md bg-[#216869]/10 p-3 text-[#174f50]"><span className="font-bold">Max speed:</span> {fmt(metrics.maxSpeed, 2)} m/s  (at x=0)</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Max spring force:</span> {fmt(metrics.maxForce, 2)} N</div>
            <div className="rounded-md bg-slate-100 p-3"><span className="font-bold">Angular frequency ω:</span> {fmt(metrics.omega, 3)} rad/s</div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function MatterScene(props: Props) {
  if (props.config.type === "inclined_plane") return <InclinedPlaneScene {...props} />;
  if (props.config.type === "atwood_table") return <AtwoodTableScene {...props} />;
  if (props.config.type === "projectile_motion") return <ProjectileMotionScene {...props} />;
  if (props.config.type === "pendulum") return <PendulumScene {...props} />;
  if (props.config.type === "collision_1d") return <CollisionScene {...props} />;
  if (props.config.type === "free_fall") return <FreeFallScene {...props} />;
  if (props.config.type === "spring_mass") return <SpringMassScene {...props} />;
  if (props.config.type === "circular_motion") return <CircularMotionScene {...props} />;
  if (props.config.type === "torque") return <TorqueScene {...props} />;
  if (props.config.type === "electric_field") return <ElectricFieldScene {...props} />;
  if (props.config.type === "ohm_law") return <OhmLawScene {...props} />;
  if (props.config.type === "bernoulli") return <BernoulliScene {...props} />;
  if (props.config.type === "standing_waves") return <StandingWavesScene {...props} />;
  if (props.config.type === "bohr_model") return <BohrModelScene {...props} />;
  return <PlaceholderScene {...props} />;
}
