import json
import os
import urllib.request
from datetime import datetime
from uuid import uuid4

from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    TextContent,
    chat_protocol_spec,
)

GROQ_API_KEY = os.environ["GROQ_API_KEY"]
AGENT_SEED = os.environ.get("AGENT_SEED", "physics-parser-agent-lahacks-2026")

SYSTEM_PROMPT = """You are a physics simulation configurator. Given a physics problem or scenario in natural language, identify which simulation type best fits, extract the relevant parameters, and output ONLY valid JSON — no explanation, no markdown, no code blocks.

## Simulation types and their parameter schemas

### projectile_motion
Use when: a ball, projectile, or object is launched at an angle or off a surface.
Params: { "angle": <0–85 deg>, "speed": <5–40 m/s>, "mass": <0.5–5 kg>, "initial_height": <0–300 px, default 0> }

### collision_1d
Use when: two objects collide, momentum, elastic/inelastic collision.
Params: { "mass1": <0.5–10 kg>, "v1": <-20 to 20 m/s>, "mass2": <0.5–10 kg>, "v2": <-20 to 20 m/s>, "restitution": <0–1, 1=elastic, 0=inelastic> }

### pendulum
Use when: a pendulum, swinging object, string with mass, oscillation.
Params: { "length": <meters>, "initial_angle": <5–80 deg from vertical>, "mass": <0.5–5 kg> }

### inclined_plane
Use when: a ramp, slope, inclined surface, block sliding.
Params: { "angle": <5–60 deg>, "friction": <0–0.9>, "mass": <0.5–5 kg> }

### free_fall
Use when: dropping an object, free fall, falling from height, gravity comparison.
Params: { "height": <meters>, "mass": <0.5–10 kg>, "air_resistance": <0–0.1, 0=vacuum> }

## World parameters (always include)
{ "gravity": <1–20, Earth=9.8, Moon=1.6, Mars=3.7>, "friction": <0–1> }

## Output format (STRICT)
{
  "type": "<one of the five types above>",
  "params": { <parameters for the chosen type> },
  "world": { "gravity": <number>, "friction": <number> },
  "explanationGoal": "<one sentence: what should be explained about this scenario>"
}

Rules:
- If uncertain or the prompt is vague, return {"type":"unknown","params":{},"world":{},"explanationGoal":""}.
- Never default to projectile_motion because of uncertainty.
- Extract physical values from the prompt; do not output visual pixel values.
- Prompt values must override defaults, and missing values should be omitted unless they are safe defaults.
- Normalize symbols before extracting: ° means degrees, Ω means ohms, μ/µ means mu, μC/µC means microC, and compact units like 2kg, 20m/s, 12V, 6Ω, 50N/m, and 10N contain usable values.
- Associate unit values with the right parameter instead of using demo defaults.
- Output ONLY the JSON object. No other text."""

DEFAULTS = {
    "projectile_motion": {"angle": 38, "speed": 18, "mass": 1, "initial_height": 0},
    "collision_1d": {"mass1": 2, "v1": 5, "mass2": 1, "v2": -2, "restitution": 0.8},
    "pendulum": {"length": 3, "initial_angle": 45, "mass": 1},
    "inclined_plane": {"angle": 30, "friction": 0.3, "mass": 1},
    "free_fall": {"height": 20, "mass": 1, "air_resistance": 0},
}

VALID_TYPES = list(DEFAULTS.keys())


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def sanitize(raw: dict) -> dict:
    sim_type = raw.get("type", "unknown")
    if sim_type not in VALID_TYPES:
        return {"type": "unknown", "params": {}, "world": {"gravity": 9.8, "friction": 0}, "explanationGoal": ""}

    defaults = DEFAULTS[sim_type]
    params = {}
    for key, val in raw.get("params", {}).items():
        try:
            params[key] = float(val)
        except (TypeError, ValueError):
            pass

    world = raw.get("world", {})
    return {
        "type": sim_type,
        "params": params,
        "world": {
            "gravity": clamp(float(world.get("gravity", 9.8)), 1, 20),
            "friction": clamp(float(world.get("friction", 0)), 0, 1),
        },
        "explanationGoal": raw.get("explanationGoal", "Explain the physics of this scenario."),
    }


def parse_with_groq(prompt: str) -> dict:
    payload = json.dumps({
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 400,
        "response_format": {"type": "json_object"},
    }).encode()
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "physics-visualizer/1.0",
        },
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    raw = json.loads(data["choices"][0]["message"]["content"])
    return sanitize(raw)


agent = Agent(
    name="physics-parser",
    seed=AGENT_SEED,
)

chat_proto = Protocol(spec=chat_protocol_spec)


@chat_proto.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
    prompt = ""
    for item in msg.content:
        if isinstance(item, TextContent):
            prompt = item.text
            break

    ctx.logger.info(f"Received prompt: {prompt!r}")

    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.utcnow(),
            acknowledged_msg_id=msg.msg_id,
        ),
    )

    try:
        config = parse_with_groq(prompt)
        response_text = json.dumps(config)
    except Exception as e:
        ctx.logger.error(f"Groq failed: {e}")
        response_text = json.dumps({
            "type": "unknown",
            "params": {},
            "world": {"gravity": 9.8, "friction": 0},
            "explanationGoal": "",
        })

    await ctx.send(
        sender,
        ChatMessage(
            timestamp=datetime.utcnow(),
            msg_id=uuid4(),
            content=[
                TextContent(type="text", text=response_text),
                EndSessionContent(type="end-session"),
            ],
        ),
    )


@chat_proto.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    ctx.logger.info(f"Acknowledged: {msg.acknowledged_msg_id}")


agent.include(chat_proto, publish_manifest=True)


@agent.on_event("startup")
async def startup(ctx: Context):
    ctx.logger.info(f"Physics Parser Agent running")
    ctx.logger.info(f"Agent address: {agent.address}")


if __name__ == "__main__":
    agent.run()
