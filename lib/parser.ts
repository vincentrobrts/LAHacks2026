import { DEFAULT_CONFIGS } from "@/lib/defaults";
import type { SimulationConfig, SimulationType } from "@/types/simulation";

const numberAfter = (text: string, words: string[]) => {
  for (const word of words) {
    const match = text.match(new RegExp(`${word}\\D{0,12}(\\d+(?:\\.\\d+)?)`, "i"));
    if (match) return Number(match[1]);
  }
  return undefined;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function detectType(lower: string): SimulationType {
  if (/pendulum|swing|string|hang|bob/.test(lower)) return "pendulum";
  if (/collid|crash|hit|bump|elastic|inelastic|momentum/.test(lower)) return "collision_1d";
  if (/ramp|slope|incline|slide|plane/.test(lower)) return "inclined_plane";
  if (/free.?fall|drop|fall|height|vacuum/.test(lower)) return "free_fall";
  return "projectile_motion";
}

export function parsePhysicsPrompt(prompt: string): SimulationConfig {
  const lower = prompt.toLowerCase();
  const type = detectType(lower);
  const base = structuredClone(DEFAULT_CONFIGS[type]);

  const gravity = numberAfter(lower, ["gravity", "g ="]);
  if (gravity) base.world.gravity = clamp(gravity, 1, 20);
  if (lower.includes("moon")) base.world.gravity = 1.6;
  if (lower.includes("mars")) base.world.gravity = 3.7;

  if (type === "projectile_motion") {
    const angle = numberAfter(lower, ["angle", "degrees", "launch"]);
    const speed = numberAfter(lower, ["speed", "velocity", "m/s"]);
    const mass = numberAfter(lower, ["mass", "kg"]);
    const height = numberAfter(lower, ["height", "cliff", "above"]);
    if (angle) base.params.angle = clamp(angle, 0, 85);
    if (speed) base.params.speed = clamp(speed, 5, 40);
    if (mass) base.params.mass = clamp(mass, 0.5, 5);
    if (height) base.params.initial_height = clamp(height, 0, 300);
  }

  if (type === "collision_1d") {
    const m1 = numberAfter(lower, ["mass1", "first mass", "m1"]);
    const m2 = numberAfter(lower, ["mass2", "second mass", "m2"]);
    const v1 = numberAfter(lower, ["v1", "velocity1", "first velocity"]);
    const v2 = numberAfter(lower, ["v2", "velocity2", "second velocity"]);
    if (m1) base.params.mass1 = clamp(m1, 0.5, 10);
    if (m2) base.params.mass2 = clamp(m2, 0.5, 10);
    if (v1) base.params.v1 = clamp(v1, -20, 20);
    if (v2) base.params.v2 = clamp(v2, -20, 20);
    if (lower.includes("elastic")) base.params.restitution = 1;
    if (lower.includes("inelastic")) base.params.restitution = 0;
  }

  if (type === "pendulum") {
    const length = numberAfter(lower, ["length", "long", "meter", "m"]);
    const angle = numberAfter(lower, ["angle", "degrees", "release"]);
    const mass = numberAfter(lower, ["mass", "kg", "bob"]);
    if (length) base.params.length = clamp(length * 50, 50, 250); // meters → pixels
    if (angle) base.params.initial_angle = clamp(angle, 5, 80);
    if (mass) base.params.mass = clamp(mass, 0.5, 5);
  }

  if (type === "inclined_plane") {
    const angle = numberAfter(lower, ["angle", "degrees", "slope"]);
    const friction = numberAfter(lower, ["friction", "mu", "coefficient"]);
    const mass = numberAfter(lower, ["mass", "kg", "block"]);
    if (angle) base.params.angle = clamp(angle, 5, 60);
    if (friction) base.params.friction = clamp(friction, 0, 0.9);
    if (mass) base.params.mass = clamp(mass, 0.5, 5);
    if (lower.includes("frictionless")) base.params.friction = 0;
  }

  if (type === "free_fall") {
    const height = numberAfter(lower, ["height", "meters", "m", "drop"]);
    const mass = numberAfter(lower, ["mass", "kg"]);
    if (height) base.params.height = clamp(height * 10, 50, 400); // meters → pixels
    if (mass) base.params.mass = clamp(mass, 0.5, 10);
    if (lower.includes("vacuum") || lower.includes("no air")) base.params.air_resistance = 0;
    if (lower.includes("air resistance") || lower.includes("drag")) base.params.air_resistance = 0.05;
  }

  return base;
}

export function parserJson(config: SimulationConfig) {
  return JSON.stringify(config, null, 2);
}
