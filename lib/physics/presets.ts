import { createBody } from "./engine";
import type { CompoundScene, PhysicsWorld, SceneComponent } from "./types";

// ─── Unit helpers ─────────────────────────────────────────────────────────────
// 1 m = 60 px
const M = 60;
// Gravity: 9.8 m/s² → px/s²
const G_PX = 9.8 * M; // 588 px/s²

// ─── 1. rampAtwood ────────────────────────────────────────────────────────────
// 3 kg on 30° ramp (μ=0.2), rope over pulley at (300,100), 2 kg hanging.

const RAMP_PULLEY = { x: 300, y: 100 };

export const rampAtwoodWorld: PhysicsWorld = (() => {
  // Ramp body sits 2m (120 px) down-ramp from the pulley
  const rampAngle = (30 * Math.PI) / 180; // 30° in radians
  const rampLen = 2 * M;
  const rampBodyPos = {
    x: RAMP_PULLEY.x - rampLen * Math.cos(rampAngle),
    y: RAMP_PULLEY.y + rampLen * Math.sin(rampAngle),
  };
  const hangBodyPos = { x: RAMP_PULLEY.x, y: RAMP_PULLEY.y + 1.5 * M };

  const ropeLength =
    Math.sqrt(
      (rampBodyPos.x - RAMP_PULLEY.x) ** 2 + (rampBodyPos.y - RAMP_PULLEY.y) ** 2,
    ) + Math.sqrt(
      (hangBodyPos.x - RAMP_PULLEY.x) ** 2 + (hangBodyPos.y - RAMP_PULLEY.y) ** 2,
    );

  return {
    bodies: [
      createBody("rampMass", 3, rampBodyPos, "ramp", Math.PI - rampAngle, 0.2),
      createBody("hangMass", 2, hangBodyPos, "vertical"),
    ],
    constraints: [
      {
        kind: "rope",
        bodyA: "rampMass",
        bodyB: "hangMass",
        pulley: RAMP_PULLEY,
        length: ropeLength,
      },
    ],
    gravity: G_PX,
  };
})();

export const rampAtwood: CompoundScene = {
  id: "rampAtwood",
  label: "Ramp Atwood Machine",
  description: "3 kg mass on a 30° ramp (μ=0.2) connected by a rope over a pulley to a 2 kg hanging mass.",
  components: [
    { id: "ramp1", kind: "ramp", label: "30° Ramp", pos: RAMP_PULLEY, props: { angle: 30, mu: 0.2, direction: "left" } },
    { id: "m1", kind: "mass", label: "3 kg", pos: rampAtwoodWorld.bodies[0].pos, props: { mass: 3 } },
    { id: "p1", kind: "pulley", label: "Pulley", pos: RAMP_PULLEY, props: {} },
    { id: "m2", kind: "mass", label: "2 kg", pos: rampAtwoodWorld.bodies[1].pos, props: { mass: 2 } },
  ],
  connections: [
    { from: "m1", to: "p1", label: "rope" },
    { from: "p1", to: "m2", label: "rope" },
  ],
  world: rampAtwoodWorld,
};

// ─── 2. springAtwood ──────────────────────────────────────────────────────────
// Spring (k=30, rest=0.5m=30px) on left wall, 1.5 kg on horizontal rail,
// rope over pulley at (400,150), 1 kg hanging.

// Spring and pulley at same height so rope goes horizontal→vertical (numerically stable)
const SPRING_PULLEY = { x: 420, y: 160 };
const SPRING_ANCHOR = { x: 20, y: SPRING_PULLEY.y };
const SPRING_REST_PX = 0.5 * M; // 30 px
const SPRING_K_PX = 30 / M; // 0.5 N/px

export const springAtwoodWorld: PhysicsWorld = (() => {
  // Start rail mass near equilibrium
  const railMassPos = { x: SPRING_ANCHOR.x + SPRING_REST_PX + 60, y: SPRING_ANCHOR.y };
  const hangBodyPos = { x: SPRING_PULLEY.x, y: SPRING_PULLEY.y + 1.5 * M };

  const ropeLength =
    Math.sqrt(
      (railMassPos.x - SPRING_PULLEY.x) ** 2 + (railMassPos.y - SPRING_PULLEY.y) ** 2,
    ) + Math.sqrt(
      (hangBodyPos.x - SPRING_PULLEY.x) ** 2 + (hangBodyPos.y - SPRING_PULLEY.y) ** 2,
    );

  return {
    bodies: [
      createBody("railMass", 1.5, railMassPos, "horizontal"),
      createBody("hangMass", 1, hangBodyPos, "vertical"),
    ],
    constraints: [
      {
        kind: "spring",
        bodyA: "railMass",
        anchorB: SPRING_ANCHOR,
        k: SPRING_K_PX,
        restLength: SPRING_REST_PX,
      },
      {
        kind: "rope",
        bodyA: "railMass",
        bodyB: "hangMass",
        pulley: SPRING_PULLEY,
        length: ropeLength,
      },
    ],
    gravity: G_PX,
  };
})();

export const springAtwood: CompoundScene = {
  id: "springAtwood",
  label: "Spring-Atwood Machine",
  description: "Spring (k=30 N/m, rest=0.5 m) connects left wall to a 1.5 kg mass on a horizontal rail. Rope over pulley to 1 kg hanging mass.",
  components: [
    { id: "spring1", kind: "spring", label: "k=30 N/m", pos: { x: 80, y: 280 }, props: { k: 30, restLength: 0.5 } },
    { id: "m1", kind: "mass", label: "1.5 kg", pos: springAtwoodWorld.bodies[0].pos, props: { mass: 1.5 } },
    { id: "p1", kind: "pulley", label: "Pulley", pos: SPRING_PULLEY, props: {} },
    { id: "m2", kind: "mass", label: "1 kg", pos: springAtwoodWorld.bodies[1].pos, props: { mass: 1 } },
  ],
  connections: [
    { from: "spring1", to: "m1", label: "spring" },
    { from: "m1", to: "p1", label: "rope" },
    { from: "p1", to: "m2", label: "rope" },
  ],
  world: springAtwoodWorld,
};

// ─── 3. doubleRamp ────────────────────────────────────────────────────────────
// 4 kg on 40° ramp, rope over pulley, 2 kg on 20° ramp on opposite side.

const DOUBLE_PULLEY = { x: 380, y: 80 };

export const doubleRampWorld: PhysicsWorld = (() => {
  const angle1 = (40 * Math.PI) / 180;
  const angle2 = (20 * Math.PI) / 180;
  const len1 = 2.5 * M;
  const len2 = 2 * M;

  // Left ramp body: descends left from pulley
  const pos1 = {
    x: DOUBLE_PULLEY.x - len1 * Math.cos(angle1),
    y: DOUBLE_PULLEY.y + len1 * Math.sin(angle1),
  };
  // Right ramp body: descends right from pulley
  const pos2 = {
    x: DOUBLE_PULLEY.x + len2 * Math.cos(angle2),
    y: DOUBLE_PULLEY.y + len2 * Math.sin(angle2),
  };

  const ropeLength =
    Math.sqrt((pos1.x - DOUBLE_PULLEY.x) ** 2 + (pos1.y - DOUBLE_PULLEY.y) ** 2) +
    Math.sqrt((pos2.x - DOUBLE_PULLEY.x) ** 2 + (pos2.y - DOUBLE_PULLEY.y) ** 2);

  return {
    bodies: [
      createBody("leftMass", 4, pos1, "ramp", Math.PI - angle1, 0),
      createBody("rightMass", 2, pos2, "ramp", angle2, 0),
    ],
    constraints: [
      {
        kind: "rope",
        bodyA: "leftMass",
        bodyB: "rightMass",
        pulley: DOUBLE_PULLEY,
        length: ropeLength,
      },
    ],
    gravity: G_PX,
  };
})();

export const doubleRamp: CompoundScene = {
  id: "doubleRamp",
  label: "Double Ramp Atwood",
  description: "4 kg mass on a 40° ramp connected by rope over a pulley to a 2 kg mass on a 20° ramp.",
  components: [
    { id: "rampL", kind: "ramp", label: "40° Ramp (left)", pos: DOUBLE_PULLEY, props: { angle: 40, direction: "left" } },
    { id: "m1", kind: "mass", label: "4 kg", pos: doubleRampWorld.bodies[0].pos, props: { mass: 4 } },
    { id: "p1", kind: "pulley", label: "Pulley", pos: DOUBLE_PULLEY, props: {} },
    { id: "m2", kind: "mass", label: "2 kg", pos: doubleRampWorld.bodies[1].pos, props: { mass: 2 } },
    { id: "rampR", kind: "ramp", label: "20° Ramp (right)", pos: DOUBLE_PULLEY, props: { angle: 20, direction: "right" } },
  ],
  connections: [
    { from: "m1", to: "p1", label: "rope" },
    { from: "p1", to: "m2", label: "rope" },
  ],
  world: doubleRampWorld,
};

// ─── 4. seriesResistors ───────────────────────────────────────────────────────
// Battery 12V + R1=10Ω + R2=15Ω in series. No PhysicsWorld.

export const seriesResistors: CompoundScene = {
  id: "seriesResistors",
  label: "Series Resistor Circuit",
  description: "12 V battery in series with R1=10 Ω and R2=15 Ω. Demonstrates Ohm's Law voltage divider.",
  components: [
    { id: "bat1", kind: "battery", label: "12 V Battery", pos: { x: 100, y: 260 }, props: { voltage: 12 } },
    { id: "r1", kind: "resistor", label: "R1=10 Ω", pos: { x: 280, y: 260 }, props: { resistance: 10 } },
    { id: "r2", kind: "resistor", label: "R2=15 Ω", pos: { x: 460, y: 260 }, props: { resistance: 15 } },
  ],
  connections: [
    { from: "bat1", to: "r1", label: "wire" },
    { from: "r1", to: "r2", label: "wire" },
    { from: "r2", to: "bat1", label: "wire (return)" },
  ],
  world: null,
};

// ─── Circuit solver ───────────────────────────────────────────────────────────

export type CircuitSolution = {
  totalResistance: number;
  current: number;
  drops: { componentId: string; label: string; voltage: number; kind: string }[];
};

/**
 * Walks wire connections starting from the battery, computes total resistance,
 * current, and voltage drops across each resistor/capacitor.
 *
 * Assumptions: simple series circuit, one battery.
 */
export function solveCircuit(scene: CompoundScene): CircuitSolution {
  const compMap = new Map(scene.components.map((c) => [c.id, c]));

  // Find battery
  const battery = scene.components.find((c) => c.kind === "battery");
  if (!battery) throw new Error("No battery found in scene");
  const voltage = Number(battery.props.voltage ?? 0);

  // Build adjacency list from connections
  const adj = new Map<string, string[]>();
  for (const conn of scene.connections) {
    if (!adj.has(conn.from)) adj.set(conn.from, []);
    adj.get(conn.from)!.push(conn.to);
  }

  // Walk series circuit from battery
  const visited = new Set<string>();
  const order: SceneComponent[] = [];
  let current = battery.id;

  while (current && !visited.has(current)) {
    visited.add(current);
    const comp = compMap.get(current);
    if (comp && comp.kind !== "battery") order.push(comp);
    const next = adj.get(current)?.[0];
    if (!next || next === battery.id) break;
    current = next;
  }

  // Sum resistance
  const totalResistance = order.reduce((acc, c) => {
    if (c.kind === "resistor") return acc + Number(c.props.resistance ?? 0);
    if (c.kind === "capacitor") return acc; // capacitors block DC, treat as open; skip
    return acc;
  }, 0);

  const I = totalResistance > 0 ? voltage / totalResistance : 0;

  const drops = order.map((c) => {
    let vDrop = 0;
    if (c.kind === "resistor") vDrop = I * Number(c.props.resistance ?? 0);
    return { componentId: c.id, label: c.label, voltage: vDrop, kind: c.kind };
  });

  return { totalResistance, current: I, drops };
}
