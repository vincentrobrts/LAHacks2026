import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import type { ParsedCompound } from "@/lib/physics/builder";

const SYSTEM_PROMPT = `You are a physics system parser. Given a natural-language description of a physics system or circuit, output ONLY valid JSON — no explanation, no markdown, no code blocks.

Your output must match this schema exactly:
{
  "components": [
    { "id": "<short_id>", "kind": "<kind>", "label": "<human label>", "props": { ... } }
  ],
  "connections": [
    { "from": "<id>", "to": "<id>", "label": "<wire|rope|spring>" }
  ]
}

## Component kinds and their props

### mass
A physical body with mass.
props: { "mass": <kg> }

### ramp
An inclined surface that a mass can slide on.
props: { "angle": <degrees, 5–80>, "mu": <friction coefficient, 0–0.8, default 0> }

### pulley
A frictionless pulley that redirects a rope.
props: {}

### spring
A spring connecting two things.
props: { "k": <spring constant N/m>, "restLength": <natural length in meters, default 0.5> }

### battery
An EMF source.
props: { "voltage": <volts> }

### resistor
props: { "resistance": <ohms> }

### capacitor
props: { "capacitance": <farads> }

## Topology guidelines

For a ramp-Atwood machine (mass on ramp + rope over pulley + hanging mass):
- components: ramp, mass (ramp side), pulley, mass (hanging side)
- connections: ramp_mass → pulley (rope), pulley → hang_mass (rope)

For a standard Atwood machine (two hanging masses over pulley):
- components: mass, pulley, mass
- connections: m1 → pulley (rope), pulley → m2 (rope)

For a spring-Atwood machine (spring + rail mass + rope over pulley + hanging mass):
- components: spring, mass (rail), pulley, mass (hanging)
- connections: spring → rail_mass (spring), rail_mass → pulley (rope), pulley → hang_mass (rope)

For a double-ramp Atwood (mass on ramp A + rope over pulley + mass on ramp B):
- components: ramp (left), mass (left), pulley, mass (right), ramp (right)
- connections: m1 → pulley (rope), pulley → m2 (rope)

For a series circuit:
- components: battery, resistor(s), capacitor(s) in order
- connections: each component → next (wire), last → battery (wire return)

## Rules
- Use simple short IDs: m1, m2, ramp1, p1, spring1, bat1, r1, r2, c1, etc.
- Extract numeric values from the text; use reasonable defaults if not specified.
- If the description matches none of the above, output your best match using the available kinds.
- Output ONLY the JSON object. Nothing else.`;

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  const groq = new Groq({ apiKey });

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    // Strip markdown fences if present
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: ParsedCompound;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "Failed to parse LLM response", raw }, { status: 422 });
    }

    if (!Array.isArray(parsed.components) || !Array.isArray(parsed.connections)) {
      return NextResponse.json({ error: "Invalid schema", raw }, { status: 422 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
