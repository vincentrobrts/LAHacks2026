import { parsePhysicsPrompt } from "@/lib/parser";
import type { SimulationConfig } from "@/types/simulation";

export async function parseWithAgentverse(prompt: string): Promise<SimulationConfig> {
  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error("parse API failed");
    return await res.json();
  } catch {
    return parsePhysicsPrompt(prompt);
  }
}
