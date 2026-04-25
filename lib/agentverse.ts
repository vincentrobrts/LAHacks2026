import { parsePhysicsPrompt } from "@/lib/parser";
import type { SimulationConfig } from "@/types/simulation";

export async function parseWithAgentverse(prompt: string): Promise<SimulationConfig> {
  // Future Agentverse/Fetch.ai integration point:
  // Send `prompt` to the deployed Physics Parser Agent and return its JSON response.
  // The Agentverse agent must preserve the SimulationConfig schema exactly so the
  // frontend can keep using the same Matter.js renderer without a backend dependency.
  return parsePhysicsPrompt(prompt);
}
