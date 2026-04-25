import { createBody } from "./engine";
import type { CompoundScene, PhysicsWorld, SceneComponent } from "./types";
import { solveCircuit } from "./presets";

const M = 60; // 1 m = 60 px
const G_PX = 9.8 * M;

// ─── Types expected from the LLM ─────────────────────────────────────────────

export type ParsedComponent = {
  id: string;
  kind: string;
  label: string;
  props: Record<string, number | string>;
};

export type ParsedConnection = { from: string; to: string; label?: string };

export type ParsedCompound = {
  components: ParsedComponent[];
  connections: ParsedConnection[];
};

export type BuiltScene = {
  scene: CompoundScene;
  world: PhysicsWorld | null;
  circuitSolution: ReturnType<typeof solveCircuit> | null;
  sceneType: "atwood" | "rampAtwood" | "springAtwood" | "doubleRamp" | "circuit" | "generic";
  atwoodParams?: { m1: number; m2: number };
};

// ─── Main entry point ─────────────────────────────────────────────────────────

export function buildFromParsed(parsed: ParsedCompound): BuiltScene {
  const kinds = new Set(parsed.components.map((c) => c.kind));
  const masses = parsed.components.filter((c) => c.kind === "mass");
  const ramps = parsed.components.filter((c) => c.kind === "ramp");
  const springs = parsed.components.filter((c) => c.kind === "spring");
  const pulleys = parsed.components.filter((c) => c.kind === "pulley");

  if (kinds.has("battery")) return buildCircuit(parsed);
  if (kinds.has("spring") && kinds.has("pulley")) return buildSpringAtwood(parsed, springs[0], pulleys[0], masses);
  if (ramps.length >= 2 && kinds.has("pulley")) return buildDoubleRamp(parsed, ramps, pulleys[0], masses);
  if (kinds.has("ramp") && kinds.has("pulley")) return buildRampAtwood(parsed, ramps[0], pulleys[0], masses);
  if (kinds.has("pulley") && masses.length >= 2) return buildStandardAtwood(parsed, pulleys[0], masses);
  return buildGeneric(parsed, masses);
}

// ─── 1. Ramp-Atwood ───────────────────────────────────────────────────────────

function buildRampAtwood(
  parsed: ParsedCompound,
  ramp: ParsedComponent,
  pulley: ParsedComponent,
  masses: ParsedComponent[],
): BuiltScene {
  const rampAngleDeg = Number(ramp.props.angle ?? 30);
  const mu = Number(ramp.props.mu ?? 0);
  const rampAngle = (rampAngleDeg * Math.PI) / 180;

  const rampMass = masses[0] ?? { id: "m1", kind: "mass", label: "mass", props: { mass: 3 } };
  const hangMass = masses[1] ?? { id: "m2", kind: "mass", label: "mass", props: { mass: 2 } };
  const m1 = Number(rampMass.props.mass ?? 3);
  const m2 = Number(hangMass.props.mass ?? 2);

  const PULLEY = { x: 300, y: 100 };
  const rampLen = 2 * M;
  const rampBodyPos = {
    x: PULLEY.x - rampLen * Math.cos(rampAngle),
    y: PULLEY.y + rampLen * Math.sin(rampAngle),
  };
  const hangBodyPos = { x: PULLEY.x, y: PULLEY.y + 1.5 * M };

  const ropeLength =
    Math.hypot(rampBodyPos.x - PULLEY.x, rampBodyPos.y - PULLEY.y) +
    Math.hypot(hangBodyPos.x - PULLEY.x, hangBodyPos.y - PULLEY.y);

  const world: PhysicsWorld = {
    bodies: [
      createBody(rampMass.id, m1, rampBodyPos, "ramp", Math.PI - rampAngle, mu),
      createBody(hangMass.id, m2, hangBodyPos, "vertical"),
    ],
    constraints: [
      { kind: "rope", bodyA: rampMass.id, bodyB: hangMass.id, pulley: PULLEY, length: ropeLength },
    ],
    gravity: G_PX,
  };

  const scene: CompoundScene = {
    id: "custom_rampAtwood",
    label: "Ramp-Atwood Machine",
    description: `${m1} kg on ${rampAngleDeg}° ramp${mu ? ` (μ=${mu})` : ""} over pulley to ${m2} kg hanging`,
    components: [
      { ...ramp, pos: PULLEY, props: { ...ramp.props, direction: "left" } } as SceneComponent,
      { ...rampMass, pos: rampBodyPos } as SceneComponent,
      { ...pulley, pos: PULLEY } as SceneComponent,
      { ...hangMass, pos: hangBodyPos } as SceneComponent,
    ],
    connections: parsed.connections,
    world,
  };

  return { scene, world, circuitSolution: null, sceneType: "rampAtwood" };
}

// ─── 2. Standard Atwood ───────────────────────────────────────────────────────

function buildStandardAtwood(
  parsed: ParsedCompound,
  pulley: ParsedComponent,
  masses: ParsedComponent[],
): BuiltScene {
  const m1Comp = masses[0] ?? { id: "m1", kind: "mass", label: "m1", props: { mass: 3 } };
  const m2Comp = masses[1] ?? { id: "m2", kind: "mass", label: "m2", props: { mass: 2 } };
  const m1 = Number(m1Comp.props.mass ?? 3);
  const m2 = Number(m2Comp.props.mass ?? 2);

  const PULLEY = { x: 380, y: 80 };
  const leftPos = { x: PULLEY.x - 60, y: PULLEY.y + 1.5 * M };
  const rightPos = { x: PULLEY.x + 60, y: PULLEY.y + 1.5 * M };

  const ropeLength =
    Math.hypot(leftPos.x - PULLEY.x, leftPos.y - PULLEY.y) +
    Math.hypot(rightPos.x - PULLEY.x, rightPos.y - PULLEY.y);

  const world: PhysicsWorld = {
    bodies: [
      createBody(m1Comp.id, m1, leftPos, "vertical"),
      createBody(m2Comp.id, m2, rightPos, "vertical"),
    ],
    constraints: [
      { kind: "rope", bodyA: m1Comp.id, bodyB: m2Comp.id, pulley: PULLEY, length: ropeLength },
    ],
    gravity: G_PX,
  };

  const scene: CompoundScene = {
    id: "custom_atwood",
    label: "Atwood Machine",
    description: `${m1} kg vs ${m2} kg over pulley`,
    components: [
      { ...m1Comp, pos: leftPos } as SceneComponent,
      { ...pulley, pos: PULLEY } as SceneComponent,
      { ...m2Comp, pos: rightPos } as SceneComponent,
    ],
    connections: parsed.connections,
    world,
  };

  return { scene, world, circuitSolution: null, sceneType: "atwood", atwoodParams: { m1, m2 } };
}

// ─── 3. Spring-Atwood ─────────────────────────────────────────────────────────

function buildSpringAtwood(
  parsed: ParsedCompound,
  spring: ParsedComponent,
  pulley: ParsedComponent,
  masses: ParsedComponent[],
): BuiltScene {
  const k_nm = Number(spring.props.k ?? 30);
  const restM = Number(spring.props.restLength ?? 0.5);
  const k_px = k_nm / M;
  const restPx = restM * M;

  const railMassComp = masses[0] ?? { id: "m1", kind: "mass", label: "rail mass", props: { mass: 1.5 } };
  const hangMassComp = masses[1] ?? { id: "m2", kind: "mass", label: "hang mass", props: { mass: 1 } };
  const mRail = Number(railMassComp.props.mass ?? 1.5);
  const mHang = Number(hangMassComp.props.mass ?? 1);

  // Pulley at right side, spring anchor at left wall, all at same Y for stability.
  // (Diagonal rope on horizontal-DOF body causes Verlet explosion — keep same Y.)
  const PULLEY = { x: 580, y: 160 };
  const SPRING_ANCHOR = { x: 20, y: PULLEY.y };

  // Start rail mass at equilibrium estimate: spring extension ≈ hang tension / k_px
  // Approximate T ≈ mHang*g and spring force at x: k_px*(x - restPx)
  // Equilibrium: x ≈ restPx + (mHang*G_PX)/(k_px*(mRail+mHang))
  const eqX = Math.min(
    PULLEY.x - 40,
    SPRING_ANCHOR.x + restPx + (mHang * G_PX) / (k_px * (mRail + mHang) * 2),
  );
  const railPos = { x: eqX, y: PULLEY.y };
  const hangPos = { x: PULLEY.x, y: PULLEY.y + 2 * M };

  const ropeLength =
    Math.hypot(railPos.x - PULLEY.x, railPos.y - PULLEY.y) +
    Math.hypot(hangPos.x - PULLEY.x, hangPos.y - PULLEY.y);

  const world: PhysicsWorld = {
    bodies: [
      createBody(railMassComp.id, mRail, railPos, "horizontal"),
      createBody(hangMassComp.id, mHang, hangPos, "vertical"),
    ],
    constraints: [
      { kind: "spring", bodyA: railMassComp.id, anchorB: SPRING_ANCHOR, k: k_px, restLength: restPx },
      { kind: "rope", bodyA: railMassComp.id, bodyB: hangMassComp.id, pulley: PULLEY, length: ropeLength },
    ],
    gravity: G_PX,
  };

  const scene: CompoundScene = {
    id: "custom_springAtwood",
    label: "Spring-Atwood Machine",
    description: `Spring (k=${k_nm} N/m) + ${mRail} kg rail mass over pulley to ${mHang} kg hanging`,
    components: [
      { ...spring, pos: { x: 80, y: 280 } } as SceneComponent,
      { ...railMassComp, pos: railPos } as SceneComponent,
      { ...pulley, pos: PULLEY } as SceneComponent,
      { ...hangMassComp, pos: hangPos } as SceneComponent,
    ],
    connections: parsed.connections,
    world,
  };

  return { scene, world, circuitSolution: null, sceneType: "springAtwood" };
}

// ─── 4. Double Ramp ───────────────────────────────────────────────────────────

function buildDoubleRamp(
  parsed: ParsedCompound,
  ramps: ParsedComponent[],
  pulley: ParsedComponent,
  masses: ParsedComponent[],
): BuiltScene {
  const angle1Deg = Number(ramps[0].props.angle ?? 40);
  const angle2Deg = Number(ramps[1].props.angle ?? 20);
  const mu1 = Number(ramps[0].props.mu ?? 0);
  const mu2 = Number(ramps[1].props.mu ?? 0);
  const angle1 = (angle1Deg * Math.PI) / 180;
  const angle2 = (angle2Deg * Math.PI) / 180;

  const m1Comp = masses[0] ?? { id: "m1", kind: "mass", label: "m1", props: { mass: 4 } };
  const m2Comp = masses[1] ?? { id: "m2", kind: "mass", label: "m2", props: { mass: 2 } };
  const m1 = Number(m1Comp.props.mass ?? 4);
  const m2 = Number(m2Comp.props.mass ?? 2);

  const PULLEY = { x: 380, y: 80 };
  const len1 = 2.5 * M;
  const len2 = 2 * M;

  const pos1 = { x: PULLEY.x - len1 * Math.cos(angle1), y: PULLEY.y + len1 * Math.sin(angle1) };
  const pos2 = { x: PULLEY.x + len2 * Math.cos(angle2), y: PULLEY.y + len2 * Math.sin(angle2) };

  const ropeLength =
    Math.hypot(pos1.x - PULLEY.x, pos1.y - PULLEY.y) +
    Math.hypot(pos2.x - PULLEY.x, pos2.y - PULLEY.y);

  const world: PhysicsWorld = {
    bodies: [
      createBody(m1Comp.id, m1, pos1, "ramp", Math.PI - angle1, mu1),
      createBody(m2Comp.id, m2, pos2, "ramp", angle2, mu2),
    ],
    constraints: [
      { kind: "rope", bodyA: m1Comp.id, bodyB: m2Comp.id, pulley: PULLEY, length: ropeLength },
    ],
    gravity: G_PX,
  };

  const scene: CompoundScene = {
    id: "custom_doubleRamp",
    label: "Double Ramp Atwood",
    description: `${m1} kg on ${angle1Deg}° ramp vs ${m2} kg on ${angle2Deg}° ramp`,
    components: [
      { ...ramps[0], pos: PULLEY, props: { ...ramps[0].props, direction: "left" } } as SceneComponent,
      { ...m1Comp, pos: pos1 } as SceneComponent,
      { ...pulley, pos: PULLEY } as SceneComponent,
      { ...m2Comp, pos: pos2 } as SceneComponent,
      { ...ramps[1], pos: PULLEY, props: { ...ramps[1].props, direction: "right" } } as SceneComponent,
    ],
    connections: parsed.connections,
    world,
  };

  return { scene, world, circuitSolution: null, sceneType: "doubleRamp" };
}

// ─── 5. Series Circuit ────────────────────────────────────────────────────────

function buildCircuit(parsed: ParsedCompound): BuiltScene {
  const xPositions = [100, 270, 440, 610];
  let xi = 0;

  const components: SceneComponent[] = parsed.components.map((c) => ({
    ...c,
    pos: { x: xPositions[Math.min(xi++, xPositions.length - 1)], y: 260 },
  })) as SceneComponent[];

  const scene: CompoundScene = {
    id: "custom_circuit",
    label: "Series Circuit",
    description: parsed.components
      .map((c) => c.label)
      .join(" → "),
    components,
    connections: parsed.connections,
    world: null,
  };

  let circuitSolution = null;
  try {
    circuitSolution = solveCircuit(scene);
  } catch {
    // no battery or bad topology
  }

  return { scene, world: null, circuitSolution, sceneType: "circuit" };
}

// ─── 6. Generic fallback ──────────────────────────────────────────────────────

function buildGeneric(parsed: ParsedCompound, masses: ParsedComponent[]): BuiltScene {
  const CX = 380;
  const spacing = 120;
  const startX = CX - ((masses.length - 1) * spacing) / 2;

  const bodies = masses.map((m, i) =>
    createBody(m.id, Number(m.props.mass ?? 1), { x: startX + i * spacing, y: 200 }, "vertical"),
  );

  const world: PhysicsWorld = {
    bodies,
    constraints: [],
    gravity: G_PX,
  };

  const scene: CompoundScene = {
    id: "custom_generic",
    label: "Custom Scene",
    description: masses.map((m) => m.label).join(", "),
    components: masses.map((m, i) => ({
      ...m,
      pos: { x: startX + i * spacing, y: 200 },
    })) as SceneComponent[],
    connections: parsed.connections,
    world,
  };

  return { scene, world, circuitSolution: null, sceneType: "generic" };
}
