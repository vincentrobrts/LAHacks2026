import { DEFAULT_CONFIGS } from "@/lib/defaults";
import type { SimulationConfig } from "@/types/simulation";

export type InclinedPromptValues = {
  config: SimulationConfig;
  friction: number;
  travelDistance: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function matchNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  return undefined;
}

export function parseInclinedPlanePrompt(prompt: string): InclinedPromptValues | null {
  const text = prompt.toLowerCase();
  const isInclinedPlane = /\b(incline|inclined plane|ramp|slope)\b/.test(text);
  const mentionsSlidingObject = /\b(block|crate|box|object|mass)\b/.test(text);

  if (!isInclinedPlane || !mentionsSlidingObject) return null;

  const defaults = DEFAULT_CONFIGS.inclined_plane;
  const mass = matchNumber(text, [/(\d+(?:\.\d+)?)\s*kg\b/, /mass\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)/]);
  const angle = matchNumber(text, [/(\d+(?:\.\d+)?)\s*(?:degree|degrees|deg)\b/, /angle\s*(?:of|=|is)?\s*(\d+(?:\.\d+)?)/]);
  const friction = matchNumber(text, [
    /(?:μ|mu)\s*k?\s*=\s*(\d+(?:\.\d+)?)/,
    /coefficient\s+of\s+kinetic\s+friction\D{0,80}(\d+(?:\.\d+)?)/,
    /friction\s*(?:coefficient)?\s*(?:is|=)?\s*(\d+(?:\.\d+)?)/,
  ]);
  const travelDistance = matchNumber(text, [
    /(?:for|over|travel|travels|traveling|across)\s*(\d+(?:\.\d+)?)\s*(?:meter|meters|m)\b/,
    /(\d+(?:\.\d+)?)\s*(?:meter|meters|m)\b/,
  ]);
  const gravity = matchNumber(text, [/gravity\s*(?:is|=|of)?\s*(\d+(?:\.\d+)?)/, /\bg\s*=\s*(\d+(?:\.\d+)?)/]);

  const resolvedFriction = clamp(friction ?? 0.2, 0, 0.9);
  const resolvedDistance = clamp(travelDistance ?? 3, 1, 5);

  const nextConfig: SimulationConfig = {
    ...defaults,
    params: {
      angle: clamp(angle ?? defaults.params.angle, 5, 60),
      mass: clamp(mass ?? defaults.params.mass, 0.5, 10),
      friction: resolvedFriction,
      distance: resolvedDistance,
    },
    world: {
      gravity: clamp(gravity ?? 9.8, 1, 20),
      friction: resolvedFriction,
    },
  };

  return { config: nextConfig, friction: resolvedFriction, travelDistance: resolvedDistance };
}
