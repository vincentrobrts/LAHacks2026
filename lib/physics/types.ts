// ─── Primitive types ──────────────────────────────────────────────────────────

export type Vec2 = { x: number; y: number };

/** Degree-of-freedom constraint on a body's motion. */
export type BodyDOF =
  | "free"       // unconstrained 2-D motion
  | "ramp"       // slides along a ramp (angle stored separately)
  | "vertical"   // only moves along y
  | "horizontal" // only moves along x
  | "fixed";     // immovable anchor

// ─── Body ─────────────────────────────────────────────────────────────────────

export type Body = {
  id: string;
  mass: number;       // kg
  pos: Vec2;          // current position (px)
  prevPos: Vec2;      // position at previous step (for Verlet velocity)
  dof: BodyDOF;
  /** Ramp angle in radians (only used when dof === "ramp") */
  rampAngle?: number;
  /** Coefficient of kinetic friction (used for ramp/horizontal sliding) */
  mu?: number;
};

// ─── Constraints ──────────────────────────────────────────────────────────────

export type RopeConstraint = {
  kind: "rope";
  bodyA: string;         // id
  bodyB: string;         // id
  /** If provided the rope passes through this pulley point */
  pulley?: Vec2;
  /** Total rope length (px) */
  length: number;
};

export type SpringConstraint = {
  kind: "spring";
  bodyA: string;         // id (one end of the spring)
  /** Other end: either a body id or a fixed world anchor */
  bodyB?: string;
  anchorB?: Vec2;
  k: number;             // spring constant (N/px — keep consistent units)
  restLength: number;    // natural length (px)
};

export type Constraint = RopeConstraint | SpringConstraint;

// ─── Physics world ────────────────────────────────────────────────────────────

export type PhysicsWorld = {
  bodies: Body[];
  constraints: Constraint[];
  /** Gravitational acceleration in px/s² (positive = downward) */
  gravity: number;
};

// ─── High-level authoring types ───────────────────────────────────────────────

export type ComponentKind =
  | "mass"
  | "ramp"
  | "pulley"
  | "spring"
  | "resistor"
  | "capacitor"
  | "battery";

export type ComponentConnection = {
  from: string;   // component id
  to: string;     // component id
  /** Optional wire label (e.g. for circuit topology) */
  label?: string;
};

export type SceneComponent = {
  id: string;
  kind: ComponentKind;
  label: string;
  /** Pixel position for rendering */
  pos: Vec2;
  /** Kind-specific properties (mass kg, resistance Ω, voltage V, etc.) */
  props: Record<string, number | string>;
};

export type CompoundScene = {
  id: string;
  label: string;
  description: string;
  components: SceneComponent[];
  connections: ComponentConnection[];
  /** Fully initialised PhysicsWorld ready to simulate (null for pure-circuit scenes) */
  world: PhysicsWorld | null;
};
