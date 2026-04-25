import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { parsePhysicsPrompt } from "@/lib/parser";
import { DEFAULT_CONFIGS } from "@/lib/defaults";
import type { SimulationConfig, SimulationType } from "@/types/simulation";

const VALID_TYPES: SimulationType[] = [
  "projectile_motion",
  "collision_1d",
  "pendulum",
  "inclined_plane",
  "free_fall",
  "atwood_table",
  "spring_mass",
];

const SYSTEM_PROMPT = `You are a physics simulation configurator. Given a physics problem or scenario in natural language, identify which simulation type best fits, extract the relevant parameters, and output ONLY valid JSON — no explanation, no markdown, no code blocks.

## Simulation types and their parameter schemas

### projectile_motion
Use when: a ball, projectile, or object is launched at an angle or off a surface.
Params: { "angle": <0–85 deg>, "speed": <5–40 m/s>, "mass": <0.5–5 kg>, "initial_height": <0–300 px, default 0> }

### collision_1d
Use when: two objects collide, momentum, elastic/inelastic collision.
Params: { "mass1": <0.5–10 kg>, "v1": <-20 to 20 m/s>, "mass2": <0.5–10 kg>, "v2": <-20 to 20 m/s>, "restitution": <0–1, 1=elastic, 0=inelastic> }

### pendulum
Use when: a pendulum, swinging object, string with mass, oscillation.
Params: { "length": <50–250 px, scale 1m = 50px>, "initial_angle": <5–80 deg from vertical>, "mass": <0.5–5 kg> }

### inclined_plane
Use when: a ramp, slope, inclined surface, block sliding.
Params: { "angle": <5–60 deg>, "friction": <0–0.9>, "mass": <0.5–5 kg> }

### free_fall
Use when: dropping an object, free fall, falling from height, gravity comparison.
Params: { "height": <50–400 px, scale 1m = 10px>, "mass": <0.5–10 kg>, "air_resistance": <0–0.1, 0=vacuum> }

### spring_mass
Use when: a mass on a spring, Hooke's law, SHM, oscillation with a spring constant.
Params: { "spring_constant": <1–100 N/m>, "mass": <0.5–5 kg>, "amplitude": <0.05–1.5 m> }

### atwood_table
Use when: Atwood machine, pulley with two masses, one on table one hanging, connected by string.
Params: { "mass1": <0.5–10 kg, table mass>, "mass2": <0.5–10 kg, hanging mass>, "friction": <0–0.9>, "distance": <1–5 m> }

## World parameters (always include)
{ "gravity": <1–20, Earth=9.8, Moon=1.6, Mars=3.7>, "friction": <0–1> }

## Output format (STRICT — no deviations)
{
  "type": "<one of the seven types above>",
  "params": { <parameters for the chosen type> },
  "world": { "gravity": <number>, "friction": <number> },
  "explanationGoal": "<one sentence: what should be explained about this scenario>"
}

Rules:
- Choose the single best matching type. Default to projectile_motion if uncertain.
- All param values must be within the specified ranges.
- Output ONLY the JSON object. No other text.`;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function sanitize(raw: SimulationConfig): SimulationConfig {
  const type: SimulationType = VALID_TYPES.includes(raw.type) ? raw.type : "projectile_motion";
  const defaults = DEFAULT_CONFIGS[type];

  const params: Record<string, number> = {};
  for (const [key, defaultVal] of Object.entries(defaults.params)) {
    const raw_val = raw.params?.[key];
    params[key] = typeof raw_val === "number" && isFinite(raw_val) ? raw_val : defaultVal;
  }

  return {
    type,
    params,
    world: {
      gravity: clamp(Number(raw.world?.gravity) || 9.8, 1, 20),
      friction: clamp(Number(raw.world?.friction) || 0.1, 0, 1),
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

  if (!apiKey) {
    return NextResponse.json(parsePhysicsPrompt(prompt));
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
