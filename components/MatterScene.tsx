"use client";

import { RotateCcw, Target, Zap } from "lucide-react";
import Matter from "matter-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LaunchOutcome, SimulationConfig } from "@/types/simulation";

type Props = {
  config: SimulationConfig;
  friction?: number;
  travelDistance?: number;
  onOutcome: (outcome: LaunchOutcome) => void;
};

const WIDTH = 760;
const HEIGHT = 520;
const GROUND_Y = 462;
const LAUNCHER = { x: 92, y: GROUND_Y - 32 };
const TOWER_X = 600;
const DEFAULT_FRICTION = 0.2;
const DEFAULT_DISTANCE = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function inclinedMetrics(config: SimulationConfig, friction = DEFAULT_FRICTION, travelDistance = DEFAULT_DISTANCE) {
  const angle = clamp(config.projectile.angle, 5, 60);
  const theta = (angle * Math.PI) / 180;
  const gravity = clamp(config.world.gravity, 1, 20);
  const mass = clamp(config.projectile.mass, 0.5, 10);
  const mu = clamp(friction, 0, 0.9);
  const distance = clamp(travelDistance, 1, 5);
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
    slides
  };
}

function fmt(value: number | null, digits = 2) {
  return value === null || Number.isNaN(value) ? "--" : value.toFixed(digits);
}

function arrowPoints(x: number, y: number, dx: number, dy: number) {
  return { x1: x, y1: y, x2: x + dx, y2: y + dy };
}

function InclinedPlaneScene({ config, friction = DEFAULT_FRICTION, travelDistance = DEFAULT_DISTANCE, onOutcome }: Props) {
  const metrics = useMemo(() => inclinedMetrics(config, friction, travelDistance), [config, friction, travelDistance]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentVelocity, setCurrentVelocity] = useState(0);
  const [guidedStep, setGuidedStep] = useState(1);
  const frameRef = useRef<number | null>(null);

  const rampLength = 410;
  const bottom = { x: 615, y: 418 };
  const top = {
    x: bottom.x - rampLength * Math.cos(metrics.theta),
    y: bottom.y - rampLength * Math.sin(metrics.theta)
  };
  const downRamp = { x: Math.cos(metrics.theta), y: Math.sin(metrics.theta) };
  const normal = { x: Math.sin(metrics.theta), y: -Math.cos(metrics.theta) };
  const blockTravel = rampLength * clamp(progress, 0, 0.96);
  const blockCenter = {
    x: top.x + downRamp.x * blockTravel + normal.x * 22,
    y: top.y + downRamp.y * blockTravel + normal.y * 22
  };
  const blockTransform = `translate(${blockCenter.x} ${blockCenter.y}) rotate(${metrics.angle})`;
  const gravityArrow = arrowPoints(blockCenter.x - 6, blockCenter.y - 4, 0, 62);
  const normalArrow = arrowPoints(blockCenter.x + normal.x * 4, blockCenter.y + normal.y * 4, normal.x * 66, normal.y * 66);
  const frictionArrow = arrowPoints(blockCenter.x - normal.x * 34, blockCenter.y - normal.y * 34, -downRamp.x * 70, -downRamp.y * 70);
  const componentArrow = arrowPoints(blockCenter.x + normal.x * 42, blockCenter.y + normal.y * 42, downRamp.x * 66, downRamp.y * 66);
  const activeArrowClass = "animate-pulse drop-shadow-[0_0_8px_rgba(242,193,78,0.95)]";

  const arrowStyle = (active: boolean) => ({
    opacity: active ? 1 : 0.42,
    strokeWidth: active ? 6 : 4
  });

  const labelStyle = (active: boolean) => ({
    opacity: active ? 1 : 0.56,
    fontSize: active ? 17 : 15
  });

  const stepCopy = [
    {
      title: "Identify Forces",
      equation: "Forces on the block: mg, N, and friction.",
      notice: "Notice that every force starts at the block but points in a different physical direction.",
      diagram: "The highlighted arrows are mg downward, N perpendicular to the ramp, and friction up the ramp."
    },
    {
      title: "Resolve Forces",
      equation: "Gravity components: mg sin θ and mg cos θ.",
      notice: "Notice that gravity is split relative to the ramp, not relative to the screen.",
      diagram: "The downslope component mg sin θ is highlighted along the ramp, while N marks the perpendicular direction tied to mg cos θ."
    },
    {
      title: "Net Force and Acceleration",
      equation: "a = g(sin θ − μₖ cos θ)",
      notice: "Notice that mass cancels out of the acceleration equation for this ideal sliding block.",
      diagram: "The highlighted downslope direction shows where positive acceleration points after friction is subtracted."
    },
    {
      title: "Motion and Results",
      equation: "s(t) = 0.5at², v(t) = at",
      notice: "Notice that the block starts slowly, then covers more ramp distance each moment as velocity increases.",
      diagram: "Watch the block move along the ramp while the Results card updates the current velocity."
    }
  ][guidedStep - 1];

  useEffect(() => {
    setProgress(0);
    setRunning(false);
    setCurrentVelocity(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    onOutcome({ launched: false, blocksMoved: 0, success: false, peakHeight: 0, flightDistance: 0 });
  }, [metrics.angle, metrics.friction, metrics.mass, metrics.gravity, metrics.distance, onOutcome]);

  const run = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0);
    setCurrentVelocity(0);

    if (!metrics.slides || metrics.timeToBottom === null) {
      onOutcome({
        launched: true,
        success: true,
        blocksMoved: 0,
        peakHeight: 0,
        flightDistance: metrics.distance,
        metrics: {
          acceleration: metrics.acceleration,
          timeToBottom: null,
          finalSpeed: 0
        }
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
        blocksMoved: 0,
        peakHeight: 0,
        flightDistance: metrics.distance,
        metrics: {
          acceleration: metrics.acceleration,
          timeToBottom: metrics.timeToBottom,
          finalSpeed: metrics.finalSpeed
        }
      });
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [metrics, onOutcome]);

  const reset = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setRunning(false);
    setProgress(0);
    setCurrentVelocity(0);
    onOutcome({ launched: false, blocksMoved: 0, success: false, peakHeight: 0, flightDistance: 0 });
  };

  const goToStep = (step: number) => {
    const nextStep = clamp(step, 1, 4);
    setGuidedStep(nextStep);
    if (nextStep === 4) {
      run();
    }
  };

  const highlights = {
    gravity: guidedStep === 1,
    normal: guidedStep === 1 || guidedStep === 2,
    friction: guidedStep === 1,
    component: guidedStep === 2 || guidedStep === 3 || guidedStep === 4
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
            <button
              onClick={() => goToStep(guidedStep - 1)}
              disabled={guidedStep === 1}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous Step
            </button>
            <button
              onClick={() => goToStep(guidedStep + 1)}
              disabled={guidedStep === 4}
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
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
              <p className="mt-1 leading-6">m = {fmt(metrics.mass, 1)} kg<br />θ = {metrics.angle} deg<br />μₖ = {fmt(metrics.friction, 2)}<br />d = {fmt(metrics.distance, 1)} m<br />g = {fmt(metrics.gravity, 1)} m/s^2</p>
            </div>
            <div>
              <div className="font-bold text-slate-900">Equations</div>
              <p className="mt-1 leading-6">
                N = mg cos θ<br />
                F<sub>f</sub> = μₖN<br />
                mg sin θ<br />
                a = g(sin θ − μₖ cos θ)
              </p>
            </div>
            <div>
              <div className="font-bold text-slate-900">Model results</div>
              <p className="mt-1 leading-6">
                N = {fmt(metrics.normal)} N<br />
                F<sub>f</sub> = {fmt(metrics.frictionForce)} N<br />
                mg sin θ = {fmt(metrics.gravityComponent)} N
              </p>
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
              <span className="font-bold">Acceleration:</span> {metrics.slides ? fmt(metrics.acceleration) : `≤ 0 (${fmt(metrics.acceleration)})`} m/s^2
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

function velocityFromConfig(config: SimulationConfig) {
  const radians = (config.projectile.angle * Math.PI) / 180;
  return {
    x: Math.cos(radians) * config.projectile.speed,
    y: -Math.sin(radians) * config.projectile.speed
  };
}

function trajectoryPoints(config: SimulationConfig) {
  const velocity = velocityFromConfig(config);
  const gravity = config.world.gravity * 0.028;
  return Array.from({ length: 44 }, (_, index) => {
    const t = index * 4.8;
    return {
      x: LAUNCHER.x + velocity.x * t,
      y: LAUNCHER.y + velocity.y * t + 0.5 * gravity * t * t
    };
  }).filter((point) => point.x < WIDTH - 20 && point.y < GROUND_Y);
}

function ProjectileTowerScene({ config, onOutcome }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const blocksRef = useRef<Matter.Body[]>([]);
  const projectileRef = useRef<Matter.Body | null>(null);
  const [runId, setRunId] = useState(0);

  const points = useMemo(() => trajectoryPoints(config), [config]);

  const buildWorld = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    Matter.Composite.clear(engine.world, false);
    engine.gravity.y = config.world.gravity / 9.8;

    const ground = Matter.Bodies.rectangle(WIDTH / 2, GROUND_Y + 30, WIDTH + 80, 60, {
      isStatic: true,
      render: { fillStyle: "#2f3d3f" }
    });
    const backstop = Matter.Bodies.rectangle(WIDTH - 8, HEIGHT / 2, 16, HEIGHT, {
      isStatic: true,
      render: { fillStyle: "transparent" }
    });

    const blocks: Matter.Body[] = [];
    const blockWidth = 46;
    const blockHeight = 24;
    const rows = Math.min(config.world.towerBlocks, 14);

    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 === 0 ? 0 : blockWidth / 2;
      const count = row < 4 ? 3 : 2;
      for (let col = 0; col < count; col += 1) {
        const x = TOWER_X + (col - (count - 1) / 2) * blockWidth + offset * 0.35;
        const y = GROUND_Y - blockHeight / 2 - row * (blockHeight + 1);
        blocks.push(
          Matter.Bodies.rectangle(x, y, blockWidth, blockHeight, {
            density: 0.003,
            friction: 0.75,
            restitution: 0.08,
            chamfer: { radius: 3 },
            render: { fillStyle: row % 2 === 0 ? "#d7603d" : "#f0a23d" }
          })
        );
      }
    }

    blocksRef.current = blocks;
    projectileRef.current = null;
    Matter.Composite.add(engine.world, [ground, backstop, ...blocks]);
  }, [config]);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = Matter.Engine.create({ enableSleeping: false });
    const render = Matter.Render.create({
      element: containerRef.current,
      engine,
      options: {
        width: WIDTH,
        height: HEIGHT,
        background: "#eef5f1",
        wireframes: false,
        pixelRatio: window.devicePixelRatio
      }
    });
    const runner = Matter.Runner.create();

    engineRef.current = engine;
    renderRef.current = render;
    runnerRef.current = runner;

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, []);

  useEffect(() => {
    buildWorld();
    onOutcome({ launched: false, blocksMoved: 0, success: false, peakHeight: 0, flightDistance: 0 });
  }, [buildWorld, onOutcome, runId]);

  const launch = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (projectileRef.current) {
      Matter.Composite.remove(engine.world, projectileRef.current);
    }

    const projectile = Matter.Bodies.circle(LAUNCHER.x, LAUNCHER.y, 15, {
      density: 0.012 * config.projectile.mass,
      frictionAir: 0.004,
      restitution: 0.18,
      render: { fillStyle: "#216869" }
    });
    projectileRef.current = projectile;
    Matter.Composite.add(engine.world, projectile);
    Matter.Body.setVelocity(projectile, velocityFromConfig(config));

    window.setTimeout(() => {
      const moved = blocksRef.current.filter((block) => {
        const dx = Math.abs(block.position.x - TOWER_X);
        const dy = Math.abs(block.angle);
        return dx > 18 || dy > 0.18 || block.position.y > GROUND_Y - 10;
      }).length;
      onOutcome({
        launched: true,
        blocksMoved: moved,
        success: moved >= Math.max(4, Math.round(config.world.towerBlocks * 0.7)),
        peakHeight: Math.max(0, Math.round(GROUND_Y - Math.min(...points.map((point) => point.y)))),
        flightDistance: Math.round((config.projectile.speed ** 2 * Math.sin((2 * config.projectile.angle * Math.PI) / 180)) / config.world.gravity)
      });
    }, 2600);
  }, [config, onOutcome, points]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-glow">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-[#eef5f1]">
        <div ref={containerRef} className="canvas-shell aspect-[1.46] w-full" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
          <polyline
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke="#216869"
            strokeDasharray="8 8"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <line x1="58" y1={GROUND_Y - 8} x2="128" y2={GROUND_Y - 45} stroke="#172033" strokeWidth="7" strokeLinecap="round" />
          <circle cx={LAUNCHER.x} cy={LAUNCHER.y} r="18" fill="none" stroke="#172033" strokeWidth="4" />
          <text x="500" y="70" fill="#172033" fontSize="18" fontWeight="700">Block tower</text>
          <text x="55" y="365" fill="#172033" fontSize="18" fontWeight="700">Launcher</text>
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={launch} className="inline-flex items-center gap-2 rounded-md bg-[#216869] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1a5556]">
          <Zap size={18} />
          Launch
        </button>
        <button onClick={() => setRunId((id) => id + 1)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-50">
          <RotateCcw size={18} />
          Reset
        </button>
        <div className="inline-flex items-center gap-2 rounded-md bg-[#f2c14e]/20 px-3 py-2 text-sm font-semibold text-slate-800">
          <Target size={17} />
          Preview updates live
        </div>
      </div>
    </div>
  );
}

export default function MatterScene(props: Props) {
  if (props.config.type === "inclined_plane") {
    return <InclinedPlaneScene {...props} />;
  }

  return <ProjectileTowerScene {...props} />;
}
