import { DEFAULT_SIMULATION } from "@/lib/defaults";
import type { SimulationConfig } from "@/types/simulation";

const numberAfter = (text: string, words: string[]) => {
  for (const word of words) {
    const match = text.match(new RegExp(`${word}\\D{0,12}(\\d+(?:\\.\\d+)?)`, "i"));
    if (match) return Number(match[1]);
  }
  return undefined;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function parsePhysicsPrompt(prompt: string): SimulationConfig {
  const lower = prompt.toLowerCase();
  const config: SimulationConfig = structuredClone(DEFAULT_SIMULATION);

  const speed = numberAfter(lower, ["speed", "velocity", "fast"]);
  const angle = numberAfter(lower, ["angle", "degrees", "launch"]);
  const gravity = numberAfter(lower, ["gravity", "g"]);
  const blocks = numberAfter(lower, ["blocks", "tower", "bricks"]);

  if (speed) config.projectile.speed = clamp(speed, 8, 35);
  if (angle) config.projectile.angle = clamp(angle, 10, 75);
  if (gravity) config.world.gravity = clamp(gravity, 1, 20);
  if (blocks) config.world.towerBlocks = clamp(Math.round(blocks), 4, 14);

  if (lower.includes("moon")) config.world.gravity = 1.6;
  if (lower.includes("mars")) config.world.gravity = 3.7;
  if (lower.includes("heavy")) config.projectile.mass = 1.8;
  if (lower.includes("light")) config.projectile.mass = 0.7;
  if (lower.includes("hard") || lower.includes("knock") || lower.includes("tower")) {
    config.projectile.speed = Math.max(config.projectile.speed, 18);
  }

  return config;
}

export function parserJson(config: SimulationConfig) {
  return JSON.stringify(config, null, 2);
}
