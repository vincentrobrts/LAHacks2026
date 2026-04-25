"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LaunchOutcome } from "@/types/simulation";
import type { Body, CompoundScene, PhysicsWorld, RopeConstraint, SpringConstraint, Vec2 } from "@/lib/physics/types";
import { stepWorld, getVelocity, createBody } from "@/lib/physics/engine";
import {
  clamp,
  fmt,
  SceneActions,
  GuidedBreakdown,
  InfoPanels,
  SCENE_W,
  SCENE_H,
} from "@/components/scenes/_shared";

// ─── Re-export for callers ────────────────────────────────────────────────────

/**
 * Build a fresh PhysicsWorld from a CompoundScene.
 * For scenes that already carry a world (presets), returns a deep clone.
 * For circuit-only scenes (world === null) returns a no-op world.
 */
export function buildWorldFromScene(scene: CompoundScene): PhysicsWorld {
  if (!scene.world) {
    return { bodies: [], constraints: [], gravity: 588 };
  }
  // Deep clone so each render starts fresh
  return {
    gravity: scene.world.gravity,
    bodies: scene.world.bodies.map((b) => ({
      ...b,
      pos: { ...b.pos },
      prevPos: { ...b.prevPos },
    })),
    constraints: scene.world.constraints.map((c) => ({ ...c })),
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  scene: CompoundScene;
  world: PhysicsWorld;
  onOutcome: (o: LaunchOutcome) => void;
};

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function MassRect({ body }: { body: Body }) {
  const W = 30;
  const H = 22;
  return (
    <g>
      <rect
        x={body.pos.x - W / 2}
        y={body.pos.y - H / 2}
        width={W}
        height={H}
        rx={3}
        fill="#216869"
        stroke="#174f50"
        strokeWidth={1.5}
      />
      <text
        x={body.pos.x}
        y={body.pos.y + 4}
        textAnchor="middle"
        fontSize={9}
        fill="white"
        fontWeight="bold"
      >
        {fmt(body.mass, 1)} kg
      </text>
    </g>
  );
}

function PulleyCircle({ pos }: { pos: Vec2 }) {
  return (
    <g>
      <circle cx={pos.x} cy={pos.y} r={10} fill="#f2c14e" stroke="#b8922e" strokeWidth={1.5} />
      <circle cx={pos.x} cy={pos.y} r={3} fill="#b8922e" />
    </g>
  );
}

function RopeLine({ from, pulley, to }: { from: Vec2; pulley?: Vec2; to: Vec2 }) {
  if (pulley) {
    return (
      <>
        <line
          x1={from.x} y1={from.y}
          x2={pulley.x} y2={pulley.y}
          stroke="#4a4a4a" strokeWidth={2} strokeLinecap="round"
        />
        <line
          x1={pulley.x} y1={pulley.y}
          x2={to.x} y2={to.y}
          stroke="#4a4a4a" strokeWidth={2} strokeLinecap="round"
        />
      </>
    );
  }
  return (
    <line
      x1={from.x} y1={from.y}
      x2={to.x} y2={to.y}
      stroke="#4a4a4a" strokeWidth={2} strokeLinecap="round"
    />
  );
}

function SpringZigzag({ from, to }: { from: Vec2; to: Vec2 }) {
  const COILS = 6;
  const AMP = 8;
  const points: string[] = [];
  for (let i = 0; i <= COILS * 2; i++) {
    const t = i / (COILS * 2);
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t + (i % 2 === 0 ? AMP : -AMP);
    points.push(`${x},${y}`);
  }
  return (
    <polyline
      points={points.join(" ")}
      fill="none"
      stroke="#e26d5c"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

function RampTriangle({
  angle,
  tipX,
  tipY,
  dir = "left",
  len = 200,
}: {
  angle: number;
  tipX: number;
  tipY: number;
  dir?: "left" | "right";
  len?: number;
}) {
  const rad = (angle * Math.PI) / 180;
  const sign = dir === "left" ? -1 : 1;
  // Slope end: left ramps go left-down, right ramps go right-down from tipX,tipY
  const slopeEndX = tipX + sign * len * Math.cos(rad);
  const slopeEndY = tipY + len * Math.sin(rad);
  // Right-angle corner is directly below the tip
  const points = `${tipX},${tipY} ${slopeEndX},${slopeEndY} ${tipX},${slopeEndY}`;
  return (
    <polygon
      points={points}
      fill="rgba(100,120,160,0.25)"
      stroke="#4060a0"
      strokeWidth={1.5}
    />
  );
}

// ─── Guided steps ─────────────────────────────────────────────────────────────

const GUIDED_STEPS_GENERIC = [
  {
    title: "Identify Forces",
    equation: "F = ma",
    notice: "Each mass experiences gravity and tension from the rope.",
    diagram: "Arrows show weight (down) and tension (along rope).",
  },
  {
    title: "Apply Constraints",
    equation: "d(A,P) + d(B,P) = L",
    notice: "The pulley keeps total rope length constant. When one side descends, the other ascends.",
    diagram: "The rope is drawn as two segments meeting at the yellow pulley.",
  },
  {
    title: "Read Results",
    equation: "v = Δpos / Δt",
    notice: "Velocity is estimated from consecutive Verlet positions.",
    diagram: "Watch mass positions update each animation frame.",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CustomScene({ scene, world: initialWorld, onOutcome }: Props) {
  // Mutable simulation world (ref so RAF closure always sees latest)
  const worldRef = useRef<PhysicsWorld>(buildWorldFromScene(scene));
  // Trigger SVG re-renders
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const resetSim = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTimeRef.current = null;
    worldRef.current = buildWorldFromScene(scene);
    setRunning(false);
    setTick((t) => t + 1);
  }, [scene]);

  // Reset when scene changes
  useEffect(() => {
    resetSim();
  }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSim = useCallback(() => {
    if (running) return;
    setRunning(true);
    lastTimeRef.current = null;

    function loop(ts: number) {
      if (lastTimeRef.current === null) lastTimeRef.current = ts;
      const dtMs = clamp(ts - lastTimeRef.current, 1, 33); // cap at ~30fps step
      lastTimeRef.current = ts;

      stepWorld(worldRef.current, dtMs);
      setTick((t) => t + 1);

      // Detect "settled" — measure average speed
      const bodies = worldRef.current.bodies;
      const avgSpeed =
        bodies.length > 0
          ? bodies.reduce((s, b) => {
              const v = getVelocity(b);
              return s + Math.sqrt(v.x * v.x + v.y * v.y);
            }, 0) / bodies.length
          : 0;

      if (avgSpeed > 2000) {
        // Runaway — stop
        setRunning(false);
        onOutcome({ launched: true, success: false, metrics: { avgSpeed } });
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [running, onOutcome]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Read current world state for render ──
  const world = worldRef.current;
  const bodyMap = new Map(world.bodies.map((b) => [b.id, b]));

  // Collect pulley positions from rope constraints
  const pulleys: Vec2[] = [];
  for (const c of world.constraints) {
    if (c.kind === "rope" && (c as RopeConstraint).pulley) {
      pulleys.push((c as RopeConstraint).pulley!);
    }
  }

  // Derive metrics for InfoPanels
  const firstBody = world.bodies[0];
  const secondBody = world.bodies[1];
  const vel1 = firstBody ? getVelocity(firstBody) : { x: 0, y: 0 };
  const speed1 = Math.sqrt(vel1.x * vel1.x + vel1.y * vel1.y);

  // ── Ramp components for decoration ──
  const rampComponents = scene.components.filter((c) => c.kind === "ramp");

  return (
    <div className="space-y-4">
      {/* SVG Canvas */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <svg
          width={SCENE_W}
          height={SCENE_H}
          viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
          className="w-full"
          aria-label={scene.label}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="url(#grid)" />

          {/* Ramps */}
          {rampComponents.map((rc) => (
            <RampTriangle
              key={rc.id}
              angle={Number(rc.props.angle ?? 30)}
              tipX={rc.pos.x}
              tipY={rc.pos.y}
              dir={(rc.props.direction as "left" | "right") ?? "left"}
            />
          ))}

          {/* Springs */}
          {world.constraints
            .filter((c) => c.kind === "spring")
            .map((c, i) => {
              const sc = c as SpringConstraint;
              const bA = bodyMap.get(sc.bodyA);
              if (!bA) return null;
              const endPos = sc.anchorB ?? (sc.bodyB ? bodyMap.get(sc.bodyB)?.pos : undefined);
              if (!endPos) return null;
              return <SpringZigzag key={i} from={endPos} to={bA.pos} />;
            })}

          {/* Ropes */}
          {world.constraints
            .filter((c) => c.kind === "rope")
            .map((c, i) => {
              const rc = c as RopeConstraint;
              const bA = bodyMap.get(rc.bodyA);
              const bB = bodyMap.get(rc.bodyB);
              if (!bA || !bB) return null;
              return (
                <RopeLine
                  key={i}
                  from={bA.pos}
                  pulley={rc.pulley}
                  to={bB.pos}
                />
              );
            })}

          {/* Pulleys */}
          {pulleys.map((p, i) => (
            <PulleyCircle key={i} pos={p} />
          ))}

          {/* Bodies */}
          {world.bodies.map((b) => (
            <MassRect key={b.id} body={b} />
          ))}

          {/* Scene label */}
          <text x={8} y={18} fontSize={11} fill="#64748b" fontWeight="600">
            {scene.label}
          </text>
        </svg>
      </div>

      {/* Controls */}
      <SceneActions
        running={running}
        onRun={startSim}
        onReset={resetSim}
        runLabel="Run Simulation"
        runningLabel="Simulating…"
      />

      {/* Guided steps */}
      <GuidedBreakdown
        step={step}
        steps={GUIDED_STEPS_GENERIC}
        onStepChange={setStep}
      />

      {/* Info panels */}
      <InfoPanels
        given={[
          ["scene", scene.id],
          ["bodies", String(world.bodies.length)],
          ["gravity", `${fmt(world.gravity / 60)} m/s²`],
          ...(firstBody ? [["m₁", `${fmt(firstBody.mass, 1)} kg`] as [string, string]] : []),
          ...(secondBody ? [["m₂", `${fmt(secondBody.mass, 1)} kg`] as [string, string]] : []),
        ]}
        equations={[
          "Verlet: x′ = 2x − x_prev + a·dt²",
          "Rope: d(A,P) + d(B,P) = L",
          "Spring: F = k(x − x₀)",
          "Friction: f = μ N",
        ]}
        results={[
          ["Status", running ? "Running" : "Stopped"],
          [
            "Body 1 pos",
            firstBody ? `(${fmt(firstBody.pos.x, 0)}, ${fmt(firstBody.pos.y, 0)}) px` : "--",
          ],
          ["Body 1 speed", `${fmt(speed1, 1)} px/s`, speed1 > 5 ? "green" : undefined],
          [
            "Body 2 pos",
            secondBody ? `(${fmt(secondBody.pos.x, 0)}, ${fmt(secondBody.pos.y, 0)}) px` : "--",
          ],
        ]}
      />
    </div>
  );
}
