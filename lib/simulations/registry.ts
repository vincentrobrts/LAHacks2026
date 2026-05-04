import { DEFAULT_CONFIGS } from "@/lib/defaults";
import type { SimulationConfig, SimulationType } from "@/types/simulation";

export type ControlRange = {
  min: number;
  max: number;
  step: number;
};

export type SimulationParamMetadata = {
  key: string;
  label: string;
  unit?: string;
  range?: ControlRange;
  required?: boolean;
};

export type SimulationMetadata = {
  type: SimulationType;
  displayName: string;
  rendererKey: SimulationType;
  description: string;
  defaultConfig: SimulationConfig;
  requiredParams: string[];
  optionalParams: string[];
  paramOrder: string[];
  params: Record<string, SimulationParamMetadata>;
  usesGravityControl: boolean;
};

export const SIMULATION_TYPES = Object.keys(DEFAULT_CONFIGS) as SimulationType[];

const BASE_RANGES: Record<string, ControlRange> = {
  angle: { min: 5, max: 60, step: 0.1 },
  initial_angle: { min: 1, max: 85, step: 0.1 },
  speed: { min: 1, max: 40, step: 0.1 },
  mass: { min: 0.5, max: 10, step: 0.1 },
  mass1: { min: 0.5, max: 10, step: 0.1 },
  mass2: { min: 0.5, max: 10, step: 0.1 },
  friction: { min: 0, max: 0.9, step: 0.01 },
  distance: { min: 1, max: 5, step: 0.1 },
  initial_height: { min: 0, max: 400, step: 1 },
  height: { min: 1, max: 5000, step: 1 },
  length: { min: 0.2, max: 250, step: 0.1 },
  v1: { min: -20, max: 20, step: 0.1 },
  v2: { min: -20, max: 20, step: 0.1 },
  restitution: { min: 0, max: 1, step: 0.01 },
  air_resistance: { min: 0, max: 1, step: 0.01 },
  spring_constant: { min: 1, max: 100, step: 1 },
  amplitude: { min: 0.05, max: 1.5, step: 0.05 },
  radius: { min: 0.2, max: 5, step: 0.1 },
  force: { min: 1, max: 100, step: 1 },
  arm_length: { min: 0.1, max: 5, step: 0.1 },
  charge1: { min: -10, max: 10, step: 0.1 },
  charge2: { min: -10, max: 10, step: 0.1 },
  charge3: { min: -10, max: 10, step: 0.1 },
  charge4: { min: -10, max: 10, step: 0.1 },
  separation: { min: 0.1, max: 5, step: 0.1 },
  voltage: { min: 0, max: 24, step: 0.5 },
  resistance: { min: 1, max: 100, step: 1 },
  internal_resistance: { min: 0, max: 10, step: 0.1 },
  area_ratio: { min: 0.2, max: 8, step: 0.1 },
  density: { min: 1, max: 1500, step: 1 },
  tension: { min: 1, max: 100, step: 1 },
  linear_density: { min: 0.001, max: 0.01, step: 0.001 },
  harmonic: { min: 1, max: 6, step: 1 },
  atomic_number: { min: 1, max: 10, step: 1 },
  n_initial: { min: 2, max: 8, step: 1 },
  n_final: { min: 1, max: 7, step: 1 },
};

const RANGE_OVERRIDES: Partial<Record<SimulationType, Record<string, ControlRange>>> = {
  free_fall: {
    mass: { min: 0.1, max: 25, step: 0.1 },
  },
  spring_mass: {
    mass: { min: 0.5, max: 5, step: 0.1 },
  },
  standing_waves: {
    length: { min: 0.5, max: 3, step: 0.1 },
  },
};

const PARAM_LABELS: Record<string, string> = {
  angle: "angle",
  initial_angle: "initial angle",
  speed: "speed",
  mass: "mass",
  mass1: "m1",
  mass2: "m2",
  friction: "friction",
  distance: "distance",
  initial_height: "initial height",
  height: "height",
  length: "length",
  v1: "v1",
  v2: "v2",
  restitution: "restitution",
  air_resistance: "air resistance",
  spring_constant: "spring constant",
  amplitude: "amplitude",
  radius: "radius",
  force: "force",
  arm_length: "lever arm",
  charge1: "q1",
  charge2: "q2",
  charge3: "q3",
  charge4: "q4",
  separation: "separation",
  voltage: "voltage",
  resistance: "resistance",
  internal_resistance: "internal resistance",
  area_ratio: "area ratio",
  density: "density",
  tension: "tension",
  linear_density: "linear density",
  harmonic: "harmonic",
  atomic_number: "atomic number",
  n_initial: "n initial",
  n_final: "n final",
};

const PARAM_UNITS: Record<string, string> = {
  angle: "deg",
  initial_angle: "deg",
  speed: "m/s",
  mass: "kg",
  mass1: "kg",
  mass2: "kg",
  friction: "",
  distance: "m",
  initial_height: "m",
  height: "m",
  length: "m",
  v1: "m/s",
  v2: "m/s",
  restitution: "",
  air_resistance: "",
  spring_constant: "N/m",
  amplitude: "m",
  radius: "m",
  force: "N",
  arm_length: "m",
  charge1: "uC",
  charge2: "uC",
  charge3: "uC",
  charge4: "uC",
  separation: "m",
  voltage: "V",
  resistance: "ohm",
  internal_resistance: "ohm",
  area_ratio: "",
  density: "kg/m^3",
  tension: "N",
  linear_density: "kg/m",
  harmonic: "",
  atomic_number: "",
  n_initial: "",
  n_final: "",
};

const DEFINITIONS: Record<SimulationType, Omit<SimulationMetadata, "defaultConfig" | "params" | "rendererKey">> = {
  projectile_motion: {
    type: "projectile_motion",
    displayName: "Projectile Motion",
    description: "A launched object under gravity.",
    requiredParams: ["angle", "speed"],
    optionalParams: ["mass", "initial_height"],
    paramOrder: ["angle", "speed", "mass", "initial_height"],
    usesGravityControl: true,
  },
  collision_1d: {
    type: "collision_1d",
    displayName: "1D Collision",
    description: "Two objects collide along one axis.",
    requiredParams: ["mass1", "v1", "mass2", "v2"],
    optionalParams: ["restitution"],
    paramOrder: ["mass1", "v1", "mass2", "v2", "restitution"],
    usesGravityControl: false,
  },
  pendulum: {
    type: "pendulum",
    displayName: "Pendulum",
    description: "A mass swinging from a fixed-length string.",
    requiredParams: ["length", "initial_angle"],
    optionalParams: ["mass"],
    paramOrder: ["length", "initial_angle", "mass"],
    usesGravityControl: true,
  },
  inclined_plane: {
    type: "inclined_plane",
    displayName: "Inclined Plane",
    description: "A block sliding along a ramp.",
    requiredParams: ["angle"],
    optionalParams: ["friction", "mass", "distance"],
    paramOrder: ["angle", "friction", "mass", "distance"],
    usesGravityControl: true,
  },
  free_fall: {
    type: "free_fall",
    displayName: "Free Fall",
    description: "An object falling vertically under gravity.",
    requiredParams: ["height"],
    optionalParams: ["mass", "air_resistance"],
    paramOrder: ["height", "mass", "air_resistance"],
    usesGravityControl: true,
  },
  atwood_table: {
    type: "atwood_table",
    displayName: "Atwood Machine",
    description: "A table mass connected over a pulley to a hanging mass.",
    requiredParams: ["mass1", "mass2"],
    optionalParams: ["friction", "distance"],
    paramOrder: ["mass1", "mass2", "friction", "distance"],
    usesGravityControl: true,
  },
  spring_mass: {
    type: "spring_mass",
    displayName: "Spring-Mass",
    description: "A mass oscillating on a spring.",
    requiredParams: ["spring_constant", "mass"],
    optionalParams: ["amplitude"],
    paramOrder: ["spring_constant", "mass", "amplitude"],
    usesGravityControl: false,
  },
  circular_motion: {
    type: "circular_motion",
    displayName: "Circular Motion",
    description: "Uniform circular motion with centripetal force.",
    requiredParams: ["radius", "speed"],
    optionalParams: ["mass"],
    paramOrder: ["radius", "mass", "speed"],
    usesGravityControl: true,
  },
  torque: {
    type: "torque",
    displayName: "Torque",
    description: "A force applied at a lever arm from a pivot.",
    requiredParams: ["force", "arm_length"],
    optionalParams: ["mass"],
    paramOrder: ["force", "arm_length", "mass"],
    usesGravityControl: false,
  },
  electric_field: {
    type: "electric_field",
    displayName: "Electric Field",
    description: "Point charges and Coulomb force.",
    requiredParams: ["charge1", "charge2"],
    optionalParams: ["charge3", "charge4", "separation"],
    paramOrder: ["charge1", "charge2", "charge3", "charge4"],
    usesGravityControl: false,
  },
  ohm_law: {
    type: "ohm_law",
    displayName: "Ohm's Law",
    description: "Voltage, resistance, current, and power.",
    requiredParams: ["voltage", "resistance"],
    optionalParams: ["internal_resistance"],
    paramOrder: ["voltage", "resistance", "internal_resistance"],
    usesGravityControl: false,
  },
  bernoulli: {
    type: "bernoulli",
    displayName: "Bernoulli Flow",
    description: "Fluid speed and pressure in a pipe.",
    requiredParams: ["v1"],
    optionalParams: ["area_ratio", "density"],
    paramOrder: ["v1", "area_ratio", "density"],
    usesGravityControl: true,
  },
  standing_waves: {
    type: "standing_waves",
    displayName: "Standing Waves",
    description: "String harmonics, nodes, and frequency.",
    requiredParams: ["length", "harmonic"],
    optionalParams: ["tension", "linear_density"],
    paramOrder: ["tension", "linear_density", "length", "harmonic"],
    usesGravityControl: false,
  },
  bohr_model: {
    type: "bohr_model",
    displayName: "Bohr Model",
    description: "Electron energy-level transitions.",
    requiredParams: ["atomic_number"],
    optionalParams: ["n_initial", "n_final"],
    paramOrder: ["atomic_number", "n_initial", "n_final"],
    usesGravityControl: false,
  },
  pulley: {
    type: "pulley",
    displayName: "Fixed Pulley",
    description: "Two hanging masses over a pulley with rotational inertia.",
    requiredParams: ["mass1", "mass2"],
    optionalParams: ["radius", "pulley_mass"],
    paramOrder: ["mass1", "mass2", "radius", "pulley_mass"],
    usesGravityControl: false,
  },
};

function paramMetadata(type: SimulationType, key: string): SimulationParamMetadata {
  return {
    key,
    label: PARAM_LABELS[key] ?? key.replace(/_/g, " "),
    unit: PARAM_UNITS[key],
    range: RANGE_OVERRIDES[type]?.[key] ?? BASE_RANGES[key],
    required: DEFINITIONS[type].requiredParams.includes(key),
  };
}

export const SIMULATION_REGISTRY: Record<SimulationType, SimulationMetadata> = Object.fromEntries(
  SIMULATION_TYPES.map((type) => {
    const definition = DEFINITIONS[type];
    const paramKeys = Array.from(new Set([
      ...definition.paramOrder,
      ...definition.requiredParams,
      ...definition.optionalParams,
      ...Object.keys(DEFAULT_CONFIGS[type].params),
    ]));
    return [
      type,
      {
        ...definition,
        rendererKey: type,
        defaultConfig: DEFAULT_CONFIGS[type],
        params: Object.fromEntries(paramKeys.map((key) => [key, paramMetadata(type, key)])),
      },
    ];
  }),
) as Record<SimulationType, SimulationMetadata>;

export const GRAVITY_SIMULATION_TYPES = new Set(
  SIMULATION_TYPES.filter((type) => SIMULATION_REGISTRY[type].usesGravityControl),
);

export function getSimulationMetadata(type: SimulationType): SimulationMetadata {
  return SIMULATION_REGISTRY[type];
}

export function getDefaultConfig(type: SimulationType): SimulationConfig {
  return SIMULATION_REGISTRY[type].defaultConfig;
}

export function getParamOrder(type: SimulationType): string[] {
  return SIMULATION_REGISTRY[type].paramOrder;
}

export function getControlRange(type: SimulationType, key: string): ControlRange {
  return SIMULATION_REGISTRY[type].params[key]?.range ?? BASE_RANGES[key] ?? { min: 0, max: 20, step: 0.1 };
}

export function isSimulationType(value: unknown): value is SimulationType {
  return typeof value === "string" && value in SIMULATION_REGISTRY;
}
