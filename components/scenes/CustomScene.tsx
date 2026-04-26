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

// ─── Re-export ────────────────────────────────────────────────────────────────

export function buildWorldFromScene(scene: CompoundScene): PhysicsWorld {
  if (!scene.world) {
    return { bodies: [], constraints: [], gravity: 588 };
  }
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

// ─── Constants ────────────────────────────────────────────────────────────────

const PULLEY_R = 26;
const MASS_W = 48;
const MASS_H = 28;
const NUM_SPOKES = 8;

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  scene: CompoundScene;
  world: PhysicsWorld;
  onOutcome: (o: LaunchOutcome) => void;
};

// ─── SVG components ───────────────────────────────────────────────────────────

// rampAngle stored as (π − visual_slope_rad), so visual_slope_deg = 180 − rampAngle*(180/π).
// For a left-direction ramp rising to the right, the block tilts left-side-down: SVG rotate(-slope_deg).
function rampSvgRotation(body: Body): number {
  if (body.dof !== "ramp" || body.rampAngle === undefined) return 0;
  const slopeDeg = 180 - (body.rampAngle * 180) / Math.PI;
  return -slopeDeg;
}

function MassBlock({ body }: { body: Body }) {
  const rot = rampSvgRotation(body);
  return (
    <g transform={`translate(${body.pos.x},${body.pos.y}) rotate(${rot})`}>
      <rect
        x={-MASS_W / 2} y={-MASS_H / 2}
        width={MASS_W} height={MASS_H}
        rx={4} fill="#216869" stroke="#174f50" strokeWidth={1.5}
      />
      <text x={0} y={4} textAnchor="middle" fontSize={10} fill="white" fontWeight="bold">
        {fmt(body.mass, 1)} kg
      </text>
    </g>
  );
}

/** Rope attachment point on a body — block edge facing toward `target`, not the center. */
function ropeAttach(body: Body, target: Vec2): Vec2 {
  if (body.dof === "vertical") {
    return { x: body.pos.x, y: body.pos.y - MASS_H / 2 };
  }
  if (body.dof === "ramp") {
    const dx = target.x - body.pos.x;
    const dy = target.y - body.pos.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: body.pos.x + (dx / len) * (MASS_W / 2), y: body.pos.y + (dy / len) * (MASS_W / 2) };
  }
  return body.pos;
}

function PulleyWheel({ pos, angle = 0 }: { pos: Vec2; angle?: number }) {
  return (
    <g>
      <circle cx={pos.x + 2} cy={pos.y + 2} r={PULLEY_R} fill="rgba(0,0,0,0.08)" />
      <circle cx={pos.x} cy={pos.y} r={PULLEY_R} fill="url(#cwheel-grad)" stroke="#d97706" strokeWidth={2.5} />
      {Array.from({ length: NUM_SPOKES }).map((_, i) => {
        const a = angle + (i * Math.PI * 2) / NUM_SPOKES;
        return (
          <line key={i}
            x1={pos.x} y1={pos.y}
            x2={pos.x + (PULLEY_R - 4) * Math.cos(a)}
            y2={pos.y + (PULLEY_R - 4) * Math.sin(a)}
            stroke="#b45309" strokeWidth={1.5} strokeLinecap="round"
          />
        );
      })}
      <circle cx={pos.x} cy={pos.y} r={PULLEY_R} fill="none" stroke="#d97706" strokeWidth={2.5} />
      <circle cx={pos.x} cy={pos.y} r={PULLEY_R - 4} fill="none" stroke="#fbbf24" strokeWidth={1} strokeDasharray="3,2" />
      <circle cx={pos.x} cy={pos.y} r={5} fill="#b45309" />
      <circle cx={pos.x} cy={pos.y} r={2.5} fill="#92400e" />
    </g>
  );
}

/** Support structure for hanging-pulley scenes (ramp-Atwood, double-ramp). */
function CeilingMount({ pulleyX, pulleyY }: { pulleyX: number; pulleyY: number }) {
  const rodBot = pulleyY - PULLEY_R;
  return (
    <g>
      <rect x={pulleyX - 70} y={0} width={140} height={14} rx={3} fill="#94a3b8" />
      <rect x={pulleyX - 5} y={14} width={10} height={Math.max(0, rodBot - 14)} rx={2} fill="#64748b" />
    </g>
  );
}

/** Support structure for horizontal-rail (spring-Atwood) scenes. */
function TableMount({ pulleyX, pulleyY, surfaceY }: { pulleyX: number; pulleyY: number; surfaceY: number }) {
  return (
    <g>
      {/* Horizontal table surface from left wall to just past pulley */}
      <line x1={0} y1={surfaceY} x2={pulleyX + PULLEY_R + 10} y2={surfaceY}
        stroke="#64748b" strokeWidth={3} strokeLinecap="round" />
      {/* Vertical table edge (right side) */}
      <line x1={pulleyX + PULLEY_R + 10} y1={surfaceY} x2={pulleyX + PULLEY_R + 10} y2={SCENE_H}
        stroke="#64748b" strokeWidth={3} strokeLinecap="round" />
      {/* Corner bracket holding the pulley at the table edge */}
      <rect x={pulleyX + PULLEY_R + 10 - 14} y={pulleyY - 8} width={16} height={16} rx={3} fill="#94a3b8" />
      {/* Left wall (vertical strip) */}
      <rect x={0} y={0} width={12} height={surfaceY} rx={0} fill="#94a3b8" />
      {/* Hatch marks on wall */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i}
          x1={12} y1={i * 20 + 10} x2={22} y2={i * 20 + 20}
          stroke="#64748b" strokeWidth={1} />
      ))}
    </g>
  );
}

function RampSurface({ angle, tipX, tipY, dir = "left", len = 220 }: {
  angle: number; tipX: number; tipY: number; dir?: "left" | "right"; len?: number;
}) {
  const rad = (angle * Math.PI) / 180;
  const sign = dir === "left" ? -1 : 1;
  const slopeEndX = tipX + sign * len * Math.cos(rad);
  const slopeEndY = tipY + len * Math.sin(rad);
  const hatchId = `hatch-${dir}`;
  return (
    <g>
      <defs>
        <pattern id={hatchId} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#94a3b8" strokeWidth="1.5" />
        </pattern>
      </defs>
      <polygon points={`${tipX},${tipY} ${slopeEndX},${slopeEndY} ${tipX},${slopeEndY}`} fill={`url(#${hatchId})`} />
      <polygon points={`${tipX},${tipY} ${slopeEndX},${slopeEndY} ${tipX},${slopeEndY}`}
        fill="rgba(96,112,160,0.12)" stroke="#4060a0" strokeWidth={2} />
      <line
        x1={Math.min(tipX, slopeEndX) - 10} y1={slopeEndY}
        x2={Math.max(tipX, slopeEndX) + 10} y2={slopeEndY}
        stroke="#64748b" strokeWidth={1.5} strokeDasharray="6,4" />
    </g>
  );
}

function SpringCoil({ from, to }: { from: Vec2; to: Vec2 }) {
  const COILS = 7;
  const AMP = 9;
  const pts: string[] = [];
  const t0 = 0.08, t1 = 0.92;
  pts.push(`${from.x},${from.y}`);
  pts.push(`${from.x + (to.x - from.x) * t0},${from.y + (to.y - from.y) * t0}`);
  for (let i = 1; i <= COILS * 2; i++) {
    const t = t0 + (t1 - t0) * (i / (COILS * 2));
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t + (i % 2 === 0 ? AMP : -AMP);
    pts.push(`${x},${y}`);
  }
  pts.push(`${from.x + (to.x - from.x) * t1},${from.y + (to.y - from.y) * t1}`);
  pts.push(`${to.x},${to.y}`);
  return <polyline points={pts.join(" ")} fill="none" stroke="#e26d5c" strokeWidth={2} strokeLinejoin="round" />;
}

function RopeSeg({ from, to }: { from: Vec2; to: Vec2 }) {
  return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#475569" strokeWidth={2.5} strokeLinecap="round" />;
}

/** Routes rope from each mass to the pulley's edge (in the direction of the mass), then wheel covers the wrap. */
function RopeOverPulley({ from, pulley, to }: { from: Vec2; pulley: Vec2; to: Vec2 }) {
  const edgePoint = (mass: Vec2): Vec2 => {
    const dx = mass.x - pulley.x;
    const dy = mass.y - pulley.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: pulley.x + (dx / len) * PULLEY_R, y: pulley.y + (dy / len) * PULLEY_R };
  };
  return (
    <>
      <RopeSeg from={from} to={edgePoint(from)} />
      <RopeSeg from={edgePoint(to)} to={to} />
    </>
  );
}

// ─── Guided steps ─────────────────────────────────────────────────────────────

const GUIDED_STEPS = [
  {
    title: "Identify Forces",
    equation: "F = ma",
    notice: "Each mass experiences gravity and tension. Ramp/rail masses have a normal force; the spring adds a restoring force.",
    diagram: "Gravity pulls down; tension acts along the rope toward the pulley.",
  },
  {
    title: "Rope Constraint",
    equation: "d(A,P) + d(B,P) = L  (constant)",
    notice: "The rope length over the pulley is fixed. When one side shortens, the other lengthens by the same amount.",
    diagram: "The amber wheel redirects tension — ropes exit at the edge toward each mass.",
  },
  {
    title: "Read the Results",
    equation: "v = Δpos / Δt",
    notice: "Velocity is computed from Verlet consecutive positions. Watch the masses trade height for speed.",
    diagram: "Position updates every animation frame.",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CustomScene({ scene, world: _initialWorld, onOutcome }: Props) {
  const worldRef = useRef<PhysicsWorld>(buildWorldFromScene(scene));
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(1);
  const [wheelAngle, setWheelAngle] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const prevBodyYRef = useRef<number | null>(null);
  const wheelAngleRef = useRef(0);

  const resetSim = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTimeRef.current = null;
    prevBodyYRef.current = null;
    wheelAngleRef.current = 0;
    worldRef.current = buildWorldFromScene(scene);
    setRunning(false);
    setWheelAngle(0);
    setTick((t) => t + 1);
  }, [scene]);

  useEffect(() => { resetSim(); }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  const startSim = useCallback(() => {
    if (running) return;
    setRunning(true);
    lastTimeRef.current = null;

    function loop(ts: number) {
      if (lastTimeRef.current === null) lastTimeRef.current = ts;
      const dtMs = clamp(ts - lastTimeRef.current, 1, 33);
      lastTimeRef.current = ts;
      stepWorld(worldRef.current, dtMs);

      // Estimate wheel rotation from first vertical body's displacement
      const vert = worldRef.current.bodies.find((b) => b.dof === "vertical");
      if (vert) {
        if (prevBodyYRef.current !== null) {
          wheelAngleRef.current += (vert.pos.y - prevBodyYRef.current) / (PULLEY_R * 1.2);
        }
        prevBodyYRef.current = vert.pos.y;
      }
      setTick((t) => t + 1);
      setWheelAngle(wheelAngleRef.current);

      const bodies = worldRef.current.bodies;
      const avgSpeed = bodies.length > 0
        ? bodies.reduce((s, b) => { const v = getVelocity(b); return s + Math.sqrt(v.x * v.x + v.y * v.y); }, 0) / bodies.length
        : 0;

      if (avgSpeed > 2000) {
        setRunning(false);
        onOutcome({ launched: true, success: false, metrics: { avgSpeed } });
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [running, onOutcome]);

  // ── Render state ──────────────────────────────────────────────────────────

  const world = worldRef.current;
  const bodyMap = new Map(world.bodies.map((b) => [b.id, b]));

  const ropeConstraints = world.constraints.filter((c) => c.kind === "rope") as RopeConstraint[];
  const springConstraints = world.constraints.filter((c) => c.kind === "spring") as SpringConstraint[];
  const pulleyPositions: Vec2[] = ropeConstraints.filter((c) => c.pulley).map((c) => c.pulley!);
  const rampComponents = scene.components.filter((c) => c.kind === "ramp");

  // Detect layout type from body DOF
  const hasHorizontalBody = world.bodies.some((b) => b.dof === "horizontal");
  const horizontalBody = world.bodies.find((b) => b.dof === "horizontal");

  // Table surface Y: bottom edge of the horizontal body
  const surfaceY = horizontalBody ? horizontalBody.pos.y + MASS_H / 2 : null;

  const firstBody = world.bodies[0];
  const secondBody = world.bodies[1];
  const vel1 = firstBody ? getVelocity(firstBody) : { x: 0, y: 0 };
  const speed1 = Math.sqrt(vel1.x * vel1.x + vel1.y * vel1.y);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="w-full" aria-label={scene.label}>
          <defs>
            <pattern id="cgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="cwheel-grad" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#fef9ee" />
              <stop offset="100%" stopColor="#fde68a" />
            </radialGradient>
          </defs>
          <rect width={SCENE_W} height={SCENE_H} fill="url(#cgrid)" />

          {/* Ramp triangles (drawn first, behind everything) */}
          {rampComponents.map((rc) => (
            <RampSurface
              key={rc.id}
              angle={Number(rc.props.angle ?? 30)}
              tipX={rc.pos.x} tipY={rc.pos.y}
              dir={(rc.props.direction as "left" | "right") ?? "left"}
            />
          ))}

          {/* Support structures — table for horizontal layouts, ceiling for hanging */}
          {hasHorizontalBody && surfaceY !== null && pulleyPositions[0] ? (
            <TableMount
              pulleyX={pulleyPositions[0].x}
              pulleyY={pulleyPositions[0].y}
              surfaceY={surfaceY}
            />
          ) : (
            pulleyPositions.map((p, i) => (
              <CeilingMount key={i} pulleyX={p.x} pulleyY={p.y} />
            ))
          )}

          {/* Springs */}
          {springConstraints.map((sc, i) => {
            const bA = bodyMap.get(sc.bodyA);
            if (!bA) return null;
            const endPos = sc.anchorB ?? (sc.bodyB ? bodyMap.get(sc.bodyB)?.pos : undefined);
            if (!endPos) return null;
            return <SpringCoil key={i} from={endPos} to={bA.pos} />;
          })}

          {/* Ropes (drawn under pulley wheels so the wheel covers the junction) */}
          {ropeConstraints.map((rc, i) => {
            const bA = bodyMap.get(rc.bodyA);
            const bB = bodyMap.get(rc.bodyB);
            if (!bA || !bB) return null;
            if (rc.pulley) {
              return <RopeOverPulley key={i} from={bA.pos} pulley={rc.pulley} to={bB.pos} />;
            }
            return <RopeSeg key={i} from={bA.pos} to={bB.pos} />;
          })}

          {/* Pulley wheels (drawn after ropes, wheel covers the rope junction) */}
          {pulleyPositions.map((p, i) => (
            <PulleyWheel key={i} pos={p} angle={wheelAngle} />
          ))}

          {/* Mass blocks (topmost layer) */}
          {world.bodies.map((b) => (
            <MassBlock key={b.id} body={b} />
          ))}

          <text x={8} y={18} fontSize={11} fill="#64748b" fontWeight="600">{scene.label}</text>
        </svg>
      </div>

      <SceneActions running={running} onRun={startSim} onReset={resetSim} runLabel="Run Simulation" runningLabel="Simulating…" />

      <GuidedBreakdown step={step} steps={GUIDED_STEPS} onStepChange={setStep} />

      <InfoPanels
        given={[
          ["scene", scene.id.replace("custom_", "")],
          ["bodies", String(world.bodies.length)],
          ["g", `${fmt(world.gravity / 60)} m/s²`],
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
          ["m₁ pos", firstBody ? `(${fmt(firstBody.pos.x, 0)}, ${fmt(firstBody.pos.y, 0)}) px` : "--"],
          ["m₁ speed", `${fmt(speed1 / 60, 2)} m/s`],
          ["m₂ pos", secondBody ? `(${fmt(secondBody.pos.x, 0)}, ${fmt(secondBody.pos.y, 0)}) px` : "--"],
        ]}
      />
    </div>
  );
}
