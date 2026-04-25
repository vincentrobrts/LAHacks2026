"use client";

import { RotateCcw, Target, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

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

export default function MatterScene(props: Props) {
  if (props.config.type === "inclined_plane") {
    return <InclinedPlaneScene {...props} />;
  }
  if (props.config.type === "atwood_table") {
    return <AtwoodTableScene {...props} />;
  }
  return <PlaceholderScene {...props} />;
}
