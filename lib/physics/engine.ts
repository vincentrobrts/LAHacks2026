import type { Body, BodyDOF, PhysicsWorld, RopeConstraint, SpringConstraint, Vec2 } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function createBody(
  id: string,
  mass: number,
  pos: Vec2,
  dof: BodyDOF,
  rampAngle?: number,
  mu?: number,
): Body {
  return {
    id,
    mass,
    pos: { ...pos },
    prevPos: { ...pos },
    dof,
    rampAngle,
    mu,
  };
}

export function getVelocity(body: Body): Vec2 {
  return {
    x: body.pos.x - body.prevPos.x,
    y: body.pos.y - body.prevPos.y,
  };
}

function vecLen(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function vecDist(a: Vec2, b: Vec2): number {
  return vecLen({ x: b.x - a.x, y: b.y - a.y });
}

function vecNorm(v: Vec2): Vec2 {
  const l = vecLen(v);
  if (l < 1e-12) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}

// ─── Spring force accumulation ────────────────────────────────────────────────

function computeSpringForces(world: PhysicsWorld): Map<string, Vec2> {
  const forces = new Map<string, Vec2>();
  for (const b of world.bodies) forces.set(b.id, { x: 0, y: 0 });

  const getBody = (id: string) => world.bodies.find((b) => b.id === id);

  for (const c of world.constraints) {
    if (c.kind !== "spring") continue;
    const sc = c as SpringConstraint;
    const bA = getBody(sc.bodyA);
    if (!bA) continue;

    let posB: Vec2;
    let bB: Body | undefined;

    if (sc.bodyB) {
      bB = getBody(sc.bodyB);
      if (!bB) continue;
      posB = bB.pos;
    } else if (sc.anchorB) {
      posB = sc.anchorB;
    } else {
      continue;
    }

    const dx = posB.x - bA.pos.x;
    const dy = posB.y - bA.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-9) continue;
    const extension = dist - sc.restLength;
    const magnitude = sc.k * extension;
    const nx = dx / dist;
    const ny = dy / dist;

    const fA = forces.get(bA.id)!;
    fA.x += magnitude * nx;
    fA.y += magnitude * ny;

    if (bB) {
      const fB = forces.get(bB.id)!;
      fB.x -= magnitude * nx;
      fB.y -= magnitude * ny;
    }
  }

  return forces;
}

// ─── DOF projection ───────────────────────────────────────────────────────────

function projectDOF(body: Body): void {
  switch (body.dof) {
    case "fixed": {
      body.pos = { ...body.prevPos };
      break;
    }
    case "vertical": {
      body.pos.x = body.prevPos.x; // lock x
      break;
    }
    case "horizontal": {
      body.pos.y = body.prevPos.y; // lock y
      break;
    }
    case "ramp": {
      if (body.rampAngle === undefined) break;
      // Project displacement onto ramp direction
      const angle = body.rampAngle;
      const dir: Vec2 = { x: Math.cos(angle), y: Math.sin(angle) };
      const dx = body.pos.x - body.prevPos.x;
      const dy = body.pos.y - body.prevPos.y;
      const proj = dx * dir.x + dy * dir.y;
      body.pos.x = body.prevPos.x + proj * dir.x;
      body.pos.y = body.prevPos.y + proj * dir.y;
      break;
    }
    case "free":
    default:
      break;
  }
}

// ─── Ramp friction as velocity damping ───────────────────────────────────────

// rampAngle stored as (π - visual_slope), so cos(rampAngle) = -cos(visual_slope).
// Use Math.abs to get the correct positive normal-force component.
function applyRampFriction(body: Body, gravity: number, dt2: number): void {
  if (body.dof !== "ramp" || body.mu === undefined || body.rampAngle === undefined) return;
  const cosTheta = Math.abs(Math.cos(body.rampAngle)); // = cos(visual_slope_angle)
  const frictionAccel = body.mu * gravity * cosTheta; // px/s²
  // Verlet velocity (pos − prevPos) is in px; friction damp must also be in px (= accel × dt²).
  const frictionDamp = frictionAccel * dt2;
  const vel = getVelocity(body);
  const speed = vecLen(vel);
  if (speed < 1e-9) return;
  const damp = Math.min(speed, frictionDamp);
  const nx = vel.x / speed;
  const ny = vel.y / speed;
  body.prevPos.x += nx * damp;
  body.prevPos.y += ny * damp;
}

// ─── Rope constraint (XPBD projection) ───────────────────────────────────────

function satisfyRopeConstraint(
  c: RopeConstraint,
  bodies: Body[],
  _iteration: number,
): void {
  const bA = bodies.find((b) => b.id === c.bodyA);
  const bB = bodies.find((b) => b.id === c.bodyB);
  if (!bA || !bB) return;

  const wA = bA.dof === "fixed" ? 0 : 1 / bA.mass;
  const wB = bB.dof === "fixed" ? 0 : 1 / bB.mass;
  const wTotal = wA + wB;
  if (wTotal < 1e-12) return;

  if (c.pulley) {
    // Rope-through-pulley: dist(A,pulley) + dist(B,pulley) = length
    const pulley = c.pulley;
    const dA = vecDist(bA.pos, pulley);
    const dB = vecDist(bB.pos, pulley);
    const C = dA + dB - c.length; // constraint violation
    if (C <= 0) return; // rope is slack

    const nA = vecNorm({ x: bA.pos.x - pulley.x, y: bA.pos.y - pulley.y });
    const nB = vecNorm({ x: bB.pos.x - pulley.x, y: bB.pos.y - pulley.y });

    // Gradient magnitudes are both 1 (unit vectors)
    const lambda = -C / wTotal;

    if (bA.dof !== "fixed") {
      bA.pos.x += wA * lambda * nA.x;
      bA.pos.y += wA * lambda * nA.y;
      projectDOF(bA);
    }
    if (bB.dof !== "fixed") {
      bB.pos.x += wB * lambda * nB.x;
      bB.pos.y += wB * lambda * nB.y;
      projectDOF(bB);
    }
  } else {
    // Simple inextensible rope
    const dx = bB.pos.x - bA.pos.x;
    const dy = bB.pos.y - bA.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const C = dist - c.length;
    if (C <= 0) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const lambda = -C / wTotal;

    if (bA.dof !== "fixed") {
      bA.pos.x -= wA * lambda * nx;
      bA.pos.y -= wA * lambda * ny;
      projectDOF(bA);
    }
    if (bB.dof !== "fixed") {
      bB.pos.x += wB * lambda * nx;
      bB.pos.y += wB * lambda * ny;
      projectDOF(bB);
    }
  }
}

// ─── Main step ────────────────────────────────────────────────────────────────

const XPBD_ITERATIONS = 10;
// gravity is in px/s²; we receive dt in ms
// px/s² * (s)² = px

export function stepWorld(world: PhysicsWorld, dtMs: number): void {
  const dt = dtMs / 1000; // seconds
  const dt2 = dt * dt;

  // (1) Compute spring forces
  const springForces = computeSpringForces(world);

  // (2) Verlet integrate
  for (const body of world.bodies) {
    if (body.dof === "fixed") continue;

    const prev = { ...body.pos };
    const vel = getVelocity(body);
    const sf = springForces.get(body.id) ?? { x: 0, y: 0 };

    // acceleration = gravity (downward) + spring force / mass
    const ax = sf.x / body.mass;
    const ay = world.gravity + sf.y / body.mass;

    body.pos.x = body.pos.x + vel.x + ax * dt2;
    body.pos.y = body.pos.y + vel.y + ay * dt2;
    body.prevPos = prev;

    // (3) Project onto DOF
    projectDOF(body);

    // (5) Ramp friction
    applyRampFriction(body, world.gravity, dt2);
  }

  // (4) Satisfy rope constraints via XPBD (multiple iterations)
  for (let iter = 0; iter < XPBD_ITERATIONS; iter++) {
    for (const c of world.constraints) {
      if (c.kind === "rope") {
        satisfyRopeConstraint(c as RopeConstraint, world.bodies, iter);
      }
    }
  }
}
