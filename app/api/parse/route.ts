import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CONFIGS } from "@/lib/defaults";
import { parsePhysicsPrompt } from "@/lib/parser";
import type { SimulationConfig, SimulationType } from "@/types/simulation";

const VALID_TYPES: SimulationType[] = [
  "projectile_motion",
  "collision_1d",
  "pendulum",
  "inclined_plane",
  "free_fall",
  "atwood_table",
  "spring_mass",
  "circular_motion",
  "torque",
  "electric_field",
  "ohm_law",
  "bernoulli",
  "standing_waves",
  "bohr_model",
];

const SYSTEM_PROMPT = `You are a physics simulation configurator. Given a physics problem or scenario in natural language, identify which supported simulation type best fits, extract the relevant parameters, and output ONLY valid JSON.

Supported types: projectile_motion, collision_1d, pendulum, inclined_plane, free_fall, atwood_table, spring_mass, circular_motion, torque, electric_field, ohm_law, bernoulli, standing_waves, bohr_model.

Output format:
{
  "type": "<supported type or unknown>",
  "params": { "<parameter>": <number> },
  "world": { "gravity": <number if known>, "friction": <number if known> },
  "explanationGoal": "<short sentence or empty string>"
}

Rules:
- Choose a supported type only when the prompt clearly supports it.
- If the prompt is vague or unsupported, output { "type": "unknown", "params": {}, "world": {}, "explanationGoal": "" }.
- Never default to projectile_motion because of uncertainty.
- Extract values from the prompt in physical units, not visual pixels.
- Pendulum length, free fall height, standing wave length, distances, and initial height are meters.
- Prompt values override defaults. Never replace values like 5 kg, 30 degrees, mu = 0.2, 12 V, or 6 ohm with demo values.
- Omit genuinely missing parameters instead of inventing unsafe values.
- Safe defaults are allowed only for confident routes: gravity=9.8 when missing, friction=0 for frictionless/no-friction, internal_resistance=0 for Ohm's law when absent, density=1000 for water, height1=height2=0 for a horizontal pipe, initial_height=0 for ground level.
- Use app keys: arm_length for torque lever arm, separation for charge distance, v1/v2 for Bernoulli velocities, n_initial/n_final for Bohr transitions.
- Output ONLY the JSON object. No markdown or prose.`;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function sanitize(raw: SimulationConfig): SimulationConfig | null {
  if (!raw || !VALID_TYPES.includes(raw.type)) return null;
  const defaults = DEFAULT_CONFIGS[raw.type];
  const aliases: Record<string, string> = {
    length: raw.type === "torque" ? "arm_length" : "length",
    distance: raw.type === "electric_field" ? "separation" : "distance",
    velocity1: "v1",
    velocity2: "v2",
  };
  const params: Record<string, number> = {};

  for (const [rawKey, rawValue] of Object.entries(raw.params ?? {})) {
    const key = aliases[rawKey] ?? rawKey;
    const value = Number(rawValue);
    if (Number.isFinite(value)) params[key] = value;
  }

  return {
    type: raw.type,
    params,
    world: {
      gravity: clamp(Number(raw.world?.gravity) || 9.8, 1, 20),
      friction: clamp(Number(raw.world?.friction) || 0, 0, 1),
    },
    explanationGoal: typeof raw.explanationGoal === "string" && raw.explanationGoal
      ? raw.explanationGoal
      : defaults.explanationGoal,
  };
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  const localConfig = parsePhysicsPrompt(prompt);

  if (localConfig) {
    return NextResponse.json(localConfig);
  }

  if (!apiKey) {
    return NextResponse.json(null);
  }

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    const json = JSON.parse(text);
    return NextResponse.json(sanitize(json));
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[parse] Groq failed, using regex fallback:", err);
    }
    return NextResponse.json(parsePhysicsPrompt(prompt));
  }
}
