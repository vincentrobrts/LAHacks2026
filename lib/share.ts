import type { SimulationConfig } from "@/types/simulation";

export function encodeSimulation(config: SimulationConfig, prompt: string) {
  const json = JSON.stringify({ config, prompt });
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}

export function decodeSimulation(value: string | null): { config: SimulationConfig; prompt: string } | null {
  if (!value) return null;

  try {
    return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(value)))));
  } catch {
    return null;
  }
}
