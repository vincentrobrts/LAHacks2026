import type { SimulationConfig, SimulationType } from "@/types/simulation";

export const DEFAULT_PROMPT = "A 5 kg block slides down a 30 degree incline with μk = 0.2 for 3 meters.";

export const DEFAULT_CONFIGS: Record<SimulationType, SimulationConfig> = {
  projectile_motion: {
    type: "projectile_motion",
    params: { angle: 38, speed: 18, mass: 1, initial_height: 0 },
    world: { gravity: 9.8, friction: 0.1 },
    explanationGoal: "Explain how launch angle and speed affect the range and peak height of the projectile.",
  },
  collision_1d: {
    type: "collision_1d",
    params: { mass1: 2, v1: 5, mass2: 1, v2: -2, restitution: 0 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how momentum is conserved in a one-dimensional collision.",
  },
  pendulum: {
    type: "pendulum",
    params: { length: 150, initial_angle: 45, mass: 1 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how pendulum length and initial angle affect the period and maximum speed.",
  },
  inclined_plane: {
    type: "inclined_plane",
    params: { angle: 30, friction: 0.2, mass: 5, distance: 3 },
    world: { gravity: 9.8, friction: 0.2 },
    explanationGoal: "Explain how the ramp angle and friction coefficient affect how fast the block slides.",
  },
  free_fall: {
    type: "free_fall",
    params: { height: 200, mass: 1, air_resistance: 0 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how gravity and air resistance affect the time and speed of the falling object.",
  },
  atwood_table: {
    type: "atwood_table",
    params: { mass1: 4, mass2: 2, friction: 0, distance: 3 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Show how tension and gravity determine the acceleration of a two-mass pulley system.",
  },
  spring_mass: {
    type: "spring_mass",
    params: { spring_constant: 20, mass: 1, amplitude: 0.5 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how spring stiffness and mass determine the period and speed of simple harmonic motion.",
  },
  circular_motion: {
    type: "circular_motion",
    params: { radius: 2, mass: 1, speed: 4 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how centripetal force keeps an object moving in a circle and how it depends on speed and radius.",
  },
  torque: {
    type: "torque",
    params: { force: 20, arm_length: 1.5, mass: 2 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how torque and moment of inertia determine the angular acceleration of a rotating rod.",
  },
  electric_field: {
    type: "electric_field",
    params: { charge1: 5, charge2: -3, separation: 1.0 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Show how opposite and like charges create field lines and exert Coulomb forces on each other.",
  },
  ohm_law: {
    type: "ohm_law",
    params: { voltage: 12, resistance: 40, internal_resistance: 2 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how voltage, resistance, and internal resistance determine current and power in a circuit.",
  },
  bernoulli: {
    type: "bernoulli",
    params: { v1: 2, area_ratio: 3, density: 1000 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Show how fluid speeds up and pressure drops in a narrower pipe section via Bernoulli's principle.",
  },
  standing_waves: {
    type: "standing_waves",
    params: { tension: 40, linear_density: 0.005, length: 2, harmonic: 3 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain how wave speed, string length, and harmonic number determine the standing wave frequency.",
  },
  bohr_model: {
    type: "bohr_model",
    params: { atomic_number: 1, n_initial: 3, n_final: 1 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Show how electron transitions between energy levels determine the wavelength of emitted or absorbed photons.",
  },
};

export const DEFAULT_SIMULATION = DEFAULT_CONFIGS.inclined_plane;

export const DEMO_SHOT: SimulationConfig = {
  type: "inclined_plane",
  params: { angle: 30, friction: 0.2, mass: 5, distance: 3 },
  world: { gravity: 9.8, friction: 0.2 },
  explanationGoal: "Explain acceleration, friction, time, and final velocity for a block sliding down an inclined plane.",
};
