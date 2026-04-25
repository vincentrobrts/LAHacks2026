import base64
import json
import math
import os
import urllib.parse
import urllib.request

import io

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP, Image
from PIL import Image as PILImage, ImageDraw, ImageFont

load_dotenv(dotenv_path="../.env.local")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
WEB_APP_URL = os.environ.get("WEB_APP_URL", "http://localhost:3000")

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
Params: { "length": <50–250 px, scale 1m = 50px>, "initial_angle": <5–80 deg from vertical>, "mass": <0.5–5 kg> }

### inclined_plane
Use when: a ramp, slope, inclined surface, block sliding.
Params: { "angle": <5–60 deg>, "friction": <0–0.9>, "mass": <0.5–5 kg>, "distance": <1–5 m> }

### free_fall
Use when: dropping an object, free fall, falling from height, gravity comparison.
Params: { "height": <50–400 px, scale 1m = 10px>, "mass": <0.5–10 kg>, "air_resistance": <0–0.1, 0=vacuum> }

### spring_mass
Use when: a mass on a spring, Hooke's law, SHM, oscillation with a spring constant.
Params: { "spring_constant": <1–100 N/m>, "mass": <0.5–5 kg>, "amplitude": <0.05–1.5 m> }

### atwood_table
Use when: Atwood machine, pulley with two masses, one on a table one hanging, connected by string.
Params: { "mass1": <0.5–10 kg, table mass>, "mass2": <0.5–10 kg, hanging mass>, "friction": <0–0.9>, "distance": <1–5 m> }

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
- Default to projectile_motion if uncertain.
- Output ONLY the JSON object. No other text."""

DEFAULTS = {
    "projectile_motion": {"angle": 38, "speed": 18, "mass": 1, "initial_height": 0},
    "collision_1d": {"mass1": 2, "v1": 5, "mass2": 1, "v2": -2, "restitution": 0.8},
    "pendulum": {"length": 150, "initial_angle": 45, "mass": 1},
    "inclined_plane": {"angle": 30, "friction": 0.2, "mass": 5, "distance": 3},
    "free_fall": {"height": 200, "mass": 1, "air_resistance": 0},
    "spring_mass": {"spring_constant": 20, "mass": 1, "amplitude": 0.5},
    "atwood_table": {"mass1": 4, "mass2": 2, "friction": 0, "distance": 3},
}


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def parse_with_groq(prompt: str) -> dict:
    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
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
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json", "User-Agent": "physics-visualizer/1.0"},
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    raw = json.loads(data["choices"][0]["message"]["content"])
    sim_type = raw.get("type", "projectile_motion")
    if sim_type not in DEFAULTS:
        sim_type = "projectile_motion"
    defaults = DEFAULTS[sim_type]
    params = {}
    for key, default_val in defaults.items():
        val = raw.get("params", {}).get(key, default_val)
        try:
            params[key] = float(val)
        except (TypeError, ValueError):
            params[key] = default_val
    world = raw.get("world", {})
    return {
        "type": sim_type,
        "params": params,
        "world": {
            "gravity": clamp(float(world.get("gravity", 9.8)), 1, 20),
            "friction": clamp(float(world.get("friction", 0.1)), 0, 1),
        },
        "explanationGoal": raw.get("explanationGoal", "Explain the physics of this scenario."),
    }


def compute_results(config: dict) -> dict:
    p = config["params"]
    g = config["world"]["gravity"]
    sim_type = config["type"]

    if sim_type == "projectile_motion":
        angle_rad = math.radians(p["angle"])
        v = p["speed"]
        h0 = p.get("initial_height", 0) / 10  # px to meters
        vy = v * math.sin(angle_rad)
        vx = v * math.cos(angle_rad)
        # time of flight with initial height
        disc = vy**2 + 2 * g * h0
        t = (vy + math.sqrt(disc)) / g if disc >= 0 else 0
        return {
            "range_m": round(vx * t, 2),
            "peak_height_m": round(h0 + vy**2 / (2 * g), 2),
            "time_of_flight_s": round(t, 2),
        }

    if sim_type == "inclined_plane":
        theta = math.radians(p["angle"])
        mu = p["friction"]
        d = p.get("distance", 3)
        a = g * (math.sin(theta) - mu * math.cos(theta))
        if a <= 0:
            return {"slides": False, "acceleration_m_s2": round(a, 3)}
        t = math.sqrt(2 * d / a)
        v_final = math.sqrt(2 * a * d)
        return {
            "slides": True,
            "acceleration_m_s2": round(a, 3),
            "time_s": round(t, 2),
            "final_speed_m_s": round(v_final, 2),
        }

    if sim_type == "pendulum":
        L = p["length"] / 50  # px to meters
        period = 2 * math.pi * math.sqrt(L / g)
        angle_rad = math.radians(p["initial_angle"])
        max_speed = math.sqrt(2 * g * L * (1 - math.cos(angle_rad)))
        return {"period_s": round(period, 3), "max_speed_m_s": round(max_speed, 2)}

    if sim_type == "free_fall":
        h = p["height"] / 10  # px to meters
        k = p.get("air_resistance", 0)
        if k == 0:
            t = math.sqrt(2 * h / g)
            v = g * t
        else:
            # approximate with drag
            t = math.sqrt(2 * h / g) * (1 + k * h / 3)
            v = math.sqrt(2 * g * h) * (1 - k * h / 4)
        return {"time_s": round(t, 2), "impact_speed_m_s": round(v, 2)}

    if sim_type == "collision_1d":
        m1, v1, m2, v2, e = p["mass1"], p["v1"], p["mass2"], p["v2"], p["restitution"]
        v1f = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / (m1 + m2)
        v2f = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / (m1 + m2)
        ke_before = 0.5 * m1 * v1**2 + 0.5 * m2 * v2**2
        ke_after = 0.5 * m1 * v1f**2 + 0.5 * m2 * v2f**2
        return {
            "v1_final_m_s": round(v1f, 2),
            "v2_final_m_s": round(v2f, 2),
            "ke_lost_j": round(ke_before - ke_after, 3),
        }

    if sim_type == "spring_mass":
        k = p["spring_constant"]
        m = p["mass"]
        A = p["amplitude"]
        omega = math.sqrt(k / m)
        period = 2 * math.pi / omega
        return {
            "period_s": round(period, 3),
            "max_speed_m_s": round(omega * A, 2),
            "max_force_n": round(k * A, 2),
            "angular_freq_rad_s": round(omega, 3),
        }

    if sim_type == "atwood_table":
        m1, m2 = p["mass1"], p["mass2"]
        mu = p.get("friction", 0)
        d = p.get("distance", 3)
        friction_f = mu * m1 * g
        driving = m2 * g - friction_f
        if driving <= 0:
            return {"moves": False, "tension_n": round(m2 * g, 2)}
        a = driving / (m1 + m2)
        T = m1 * a + friction_f
        t = math.sqrt(2 * d / a)
        return {
            "moves": True,
            "acceleration_m_s2": round(a, 3),
            "tension_n": round(T, 2),
            "time_s": round(t, 2),
            "final_speed_m_s": round(math.sqrt(2 * a * d), 2),
        }

    return {}


def generate_png(config: dict, results: dict) -> bytes:
    W, H = 560, 360
    BG = (248, 250, 252)
    DARK = (23, 32, 51)
    GREEN = (33, 104, 105)
    GREEN2 = (46, 139, 136)
    GOLD = (242, 193, 78)
    RED = (194, 65, 12)
    BLUE = (29, 78, 216)
    PURPLE = (124, 58, 237)
    LIGHT = (226, 232, 240)
    MUTED = (100, 116, 139)

    img = PILImage.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    try:
        font_b = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 15)
        font_sm = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
        font_xs = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 11)
    except Exception:
        font_b = font_sm = font_xs = ImageFont.load_default()

    p = config["params"]
    g = config["world"]["gravity"]
    sim_type = config["type"]
    title = sim_type.replace("_", " ").title()

    # border
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=12, outline=LIGHT, width=2)

    # header
    d.text((20, 16), title, font=font_b, fill=DARK)
    d.line([(20, 40), (W - 20, 40)], fill=LIGHT, width=1)

    # result rows (left panel)
    row_y = 50
    for label, value in results.items():
        d.rounded_rectangle([20, row_y, 240, row_y + 26], radius=5, fill=(241, 245, 249))
        d.text((30, row_y + 7), label.replace("_", " "), font=font_xs, fill=MUTED)
        val_str = f"{value}" if not isinstance(value, float) else f"{value:.2f}"
        d.text((230, row_y + 7), val_str, font=font_xs, fill=DARK, anchor="ra")
        row_y += 32

    # divider
    d.line([(260, 42), (260, H - 20)], fill=LIGHT, width=1)

    # diagram area origin
    ox, oy = 270, 50
    dw, dh = W - ox - 20, H - oy - 20

    if sim_type == "inclined_plane":
        angle = p.get("angle", 30)
        theta = math.radians(angle)
        bx, by = ox + dw, oy + dh
        tx = int(bx - dw * 0.9 * math.cos(theta))
        ty = int(by - dw * 0.9 * math.sin(theta))
        d.polygon([(tx, ty), (bx, by), (tx, by)], fill=(223, 232, 228), outline=DARK)
        d.line([(tx, ty), (bx, by)], fill=DARK, width=5)
        travel = 0.4
        bcx = int(tx + (bx - tx) * travel + math.sin(theta) * 18)
        bcy = int(ty + (by - ty) * travel - math.cos(theta) * 18)
        rot_img = PILImage.new("RGBA", (56, 36), (0, 0, 0, 0))
        rd = ImageDraw.Draw(rot_img)
        rd.rounded_rectangle([0, 0, 55, 35], radius=5, fill=GREEN)
        rd.rounded_rectangle([8, 7, 47, 28], radius=3, fill=GREEN2)
        rot_img = rot_img.rotate(-angle, expand=True)
        img.paste(rot_img, (bcx - rot_img.width // 2, bcy - rot_img.height // 2), rot_img)
        d.line([(bcx, bcy), (bcx, bcy + 45)], fill=RED, width=3)
        d.line([(bcx, bcy), (int(bcx + math.sin(theta) * 40), int(bcy - math.cos(theta) * 40))], fill=BLUE, width=3)
        d.text((int(bx - 110), int(by + 10)), f"θ = {angle}°", font=font_sm, fill=DARK)

    elif sim_type == "projectile_motion":
        angle = p.get("angle", 45)
        speed = p.get("speed", 18)
        theta = math.radians(angle)
        tof = results.get("time_of_flight_s", 2)
        peak = results.get("peak_height_m", 5)
        vx = speed * math.cos(theta)
        vy = speed * math.sin(theta)
        pts = []
        for i in range(41):
            t = i / 40 * tof
            x = int(ox + 10 + (vx * t / (vx * tof)) * (dw - 20))
            y_m = vy * t - 0.5 * g * t ** 2
            y = int(oy + dh - max(0, y_m / max(peak, 0.1)) * (dh - 20))
            pts.append((x, y))
        for i in range(len(pts) - 1):
            d.line([pts[i], pts[i + 1]], fill=GREEN, width=3)
        d.ellipse([pts[0][0] - 8, pts[0][1] - 8, pts[0][0] + 8, pts[0][1] + 8], fill=GREEN)
        d.line([(ox + 10, oy + dh), (ox + dw, oy + dh)], fill=DARK, width=4)

    elif sim_type == "pendulum":
        init_angle = p.get("initial_angle", 45)
        theta = math.radians(init_angle)
        px, py = ox + dw // 2, oy + 20
        arm = int(dh * 0.7)
        bx2 = int(px + math.sin(theta) * arm)
        by2 = int(py + math.cos(theta) * arm)
        d.line([(px, py), (px, py + arm + 20)], fill=LIGHT, width=1)
        d.line([(px, py), (bx2, by2)], fill=DARK, width=3)
        d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=DARK)
        d.ellipse([bx2 - 20, by2 - 20, bx2 + 20, by2 + 20], fill=GREEN, outline=DARK, width=2)
        d.text((int(px + 8), int(py + 50)), f"{init_angle}°", font=font_sm, fill=(146, 64, 14))

    elif sim_type == "free_fall":
        cx = ox + dw // 2
        d.line([(cx, oy + 10), (cx, oy + dh)], fill=LIGHT, width=1)
        d.ellipse([cx - 20, oy + 15, cx + 20, oy + 55], fill=GREEN, outline=DARK, width=2)
        for i in range(3):
            ay = oy + 65 + i * 18
            d.line([(cx, ay), (cx, ay + 12)], fill=RED, width=3)
        d.line([(ox + 20, oy + dh), (ox + dw, oy + dh)], fill=DARK, width=4)
        h_m = p.get("height", 200) / 10
        d.text((cx + 25, oy + 30), f"{h_m:.0f} m", font=font_sm, fill=MUTED)

    elif sim_type == "collision_1d":
        m1, v1 = p.get("mass1", 2), p.get("v1", 5)
        m2, v2 = p.get("mass2", 1), p.get("v2", 0)
        mid = ox + dw // 2
        cy = oy + dh // 2
        d.rounded_rectangle([ox + 10, cy - 25, mid - 15, cy + 25], radius=6, fill=GREEN)
        d.text((ox + 10 + (mid - 25 - ox - 10) // 2, cy - 8), f"{m1}kg", font=font_sm, fill=(255, 255, 255))
        d.line([(mid - 14, cy), (mid - 2, cy)], fill=(21, 128, 61), width=3)
        d.rounded_rectangle([mid + 15, cy - 25, ox + dw - 10, cy + 25], radius=6, fill=PURPLE)
        d.text((mid + 15 + (ox + dw - 10 - mid - 15) // 2, cy - 8), f"{m2}kg", font=font_sm, fill=(255, 255, 255))
        d.line([(ox + 10, oy + dh), (ox + dw, oy + dh)], fill=DARK, width=3)
        d.text((ox + 10, cy - 45), f"→ {v1} m/s", font=font_xs, fill=(21, 128, 61))
        d.text((mid + 15, cy - 45), f"{v2} m/s", font=font_xs, fill=(109, 40, 217))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_animated_html(config: dict, results: dict) -> str:
    p = config["params"]
    g = config["world"]["gravity"]
    sim_type = config["type"]

    if sim_type == "inclined_plane":
        angle = p.get("angle", 30)
        friction = p.get("friction", 0.2)
        mass = p.get("mass", 1)
        accel = results.get("acceleration_m_s2", 0)
        time_s = results.get("time_s", 2)
        slides = results.get("slides", True)
        js_params = f"angle:{angle},friction:{friction},mass:{mass},accel:{accel},duration:{max(time_s,0.5)},slides:{'true' if slides else 'false'},g:{g}"
        anim_js = f"""
const cfg = {{{js_params}}};
const W = canvas.width, H = canvas.height;
const PAD = 40;
const rampBaseX = W - PAD, rampBaseY = H - PAD;
const rampLen = W * 0.75;
const theta = cfg.angle * Math.PI / 180;
const rampTopX = rampBaseX - rampLen * Math.cos(theta);
const rampTopY = rampBaseY - rampLen * Math.sin(theta);
const dx = Math.cos(theta), dy = Math.sin(theta);
const nx = Math.sin(theta), ny = -Math.cos(theta);
const BLOCK_W = 44, BLOCK_H = 28;
let phase = 0; // 0=sliding, 1=pause

function draw(t) {{
  ctx.clearRect(0, 0, W, H);

  // ramp
  ctx.beginPath();
  ctx.moveTo(rampTopX, rampTopY);
  ctx.lineTo(rampBaseX, rampBaseY);
  ctx.lineTo(rampTopX, rampBaseY);
  ctx.closePath();
  ctx.fillStyle = COLORS.rampFill;
  ctx.fill();
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rampTopX, rampTopY);
  ctx.lineTo(rampBaseX, rampBaseY);
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 6;
  ctx.stroke();

  // angle arc
  const arcR = 55;
  ctx.beginPath();
  ctx.arc(rampBaseX, rampBaseY, arcR, -Math.PI, -Math.PI + theta, false);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 13px system-ui";
  ctx.fillText("θ=" + cfg.angle + "°", rampBaseX - arcR - 50, rampBaseY + 20);

  // block position along ramp
  let progress = 0;
  if (cfg.slides) {{
    const loopT = t % (cfg.duration + 0.8);
    progress = loopT < cfg.duration ? 0.5 * cfg.accel * loopT * loopT / (0.5 * cfg.accel * cfg.duration * cfg.duration) : 1;
  }} else {{
    progress = 0.15;
  }}
  const travelMax = rampLen * 0.88;
  const dist = progress * travelMax;
  const bcx = rampTopX + dx * dist + nx * (BLOCK_H / 2 + 2);
  const bcy = rampTopY + dy * dist + ny * (BLOCK_H / 2 + 2);

  // draw block (rotated)
  ctx.save();
  ctx.translate(bcx, bcy);
  ctx.rotate(theta);
  ctx.fillStyle = COLORS.green;
  ctx.beginPath();
  roundRect(ctx, -BLOCK_W/2, -BLOCK_H/2, BLOCK_W, BLOCK_H, 5);
  ctx.fill();
  ctx.fillStyle = COLORS.greenDark;
  ctx.beginPath();
  roundRect(ctx, -BLOCK_W/2+6, -BLOCK_H/2+5, BLOCK_W-12, BLOCK_H-10, 3);
  ctx.fill();
  ctx.restore();

  // gravity arrow
  ctx.beginPath();
  ctx.moveTo(bcx, bcy);
  ctx.lineTo(bcx, bcy + 48);
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 3;
  ctx.stroke();
  arrowHead(ctx, bcx, bcy + 48, COLORS.red);
  ctx.fillStyle = COLORS.red;
  ctx.font = "bold 11px system-ui";
  ctx.fillText("mg", bcx + 5, bcy + 52);

  // normal force arrow
  ctx.beginPath();
  ctx.moveTo(bcx, bcy);
  ctx.lineTo(bcx + nx * 44, bcy + ny * 44);
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 3;
  ctx.stroke();
  arrowHead(ctx, bcx + nx * 44, bcy + ny * 44, COLORS.blue);
  ctx.fillStyle = COLORS.blue;
  ctx.font = "bold 11px system-ui";
  ctx.fillText("N", bcx + nx * 50, bcy + ny * 50);

  // label
  ctx.fillStyle = COLORS.muted;
  ctx.font = "12px system-ui";
  ctx.fillText("m=" + cfg.mass + "kg  μ=" + cfg.friction + "  g=" + cfg.g + "m/s²", PAD, 28);
  if (!cfg.slides) {{
    ctx.fillStyle = COLORS.red;
    ctx.font = "bold 12px system-ui";
    ctx.fillText("Block does not slide", PAD, H - 12);
  }}
}}
"""
    elif sim_type == "projectile_motion":
        angle = p.get("angle", 45)
        speed = p.get("speed", 18)
        tof = results.get("time_of_flight_s", 2)
        peak = results.get("peak_height_m", 5)
        rng = results.get("range_m", 20)
        js_params = f"angle:{angle},speed:{speed},tof:{max(tof,0.1)},peak:{max(peak,0.1)},range_m:{max(rng,0.1)},g:{g}"
        anim_js = f"""
const cfg = {{{js_params}}};
const W = canvas.width, H = canvas.height;
const GY = H - 40, LX = 40, RX = W - 40;
const theta = cfg.angle * Math.PI / 180;
const vx = cfg.speed * Math.cos(theta);
const vy = cfg.speed * Math.sin(theta);

function getPos(t) {{
  const px = LX + (vx * t / (vx * cfg.tof)) * (RX - LX);
  const ym = vy * t - 0.5 * cfg.g * t * t;
  const py = GY - Math.max(0, ym / cfg.peak) * (GY - 50);
  return [px, py];
}}

function draw(t) {{
  ctx.clearRect(0, 0, W, H);

  // ground
  ctx.beginPath();
  ctx.moveTo(LX - 10, GY);
  ctx.lineTo(RX + 10, GY);
  ctx.strokeStyle = COLORS.ground;
  ctx.lineWidth = 5;
  ctx.stroke();

  // trajectory trail
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {{
    const ti = i / 60 * cfg.tof;
    const [px, py] = getPos(ti);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }}
  ctx.strokeStyle = DARK ? "rgba(61,184,168,0.2)" : "rgba(33,104,105,0.25)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // ball
  const loopT = t % (cfg.tof + 0.6);
  const ballT = Math.min(loopT, cfg.tof);
  const [bx, by] = getPos(ballT);
  ctx.beginPath();
  ctx.arc(bx, by, 12, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.green;
  ctx.fill();
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 2;
  ctx.stroke();

  // launch indicator
  ctx.beginPath();
  ctx.moveTo(LX, GY);
  ctx.lineTo(LX + Math.cos(theta) * 30, GY - Math.sin(theta) * 30);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = "12px system-ui";
  ctx.fillText("θ=" + cfg.angle + "°  v=" + cfg.speed + "m/s  g=" + cfg.g + "m/s²", LX, 28);
}}
"""
    elif sim_type == "pendulum":
        length = p.get("length", 150)
        init_angle = p.get("initial_angle", 45)
        period = results.get("period_s", 2)
        L_m = length / 50
        js_params = f"initAngle:{init_angle},period:{max(period,0.5)},L_m:{L_m},g:{g}"
        anim_js = f"""
const cfg = {{{js_params}}};
const W = canvas.width, H = canvas.height;
const pivotX = W / 2, pivotY = 60;
const armLen = Math.min(H - pivotY - 60, 220);
const initRad = cfg.initAngle * Math.PI / 180;

function draw(t) {{
  ctx.clearRect(0, 0, W, H);

  // ceiling bar
  ctx.fillStyle = COLORS.text;
  ctx.fillRect(pivotX - 40, pivotY - 10, 80, 12);

  const angle = initRad * Math.cos(2 * Math.PI * t / cfg.period);
  const bobX = pivotX + Math.sin(angle) * armLen;
  const bobY = pivotY + Math.cos(angle) * armLen;

  // vertical reference
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(pivotX, pivotY + armLen + 20);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // string
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 3;
  ctx.stroke();

  // pivot dot
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 7, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.text;
  ctx.fill();

  // bob
  ctx.beginPath();
  ctx.arc(bobX, bobY, 22, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.green;
  ctx.fill();
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 3;
  ctx.stroke();

  // angle arc label
  const arcR = 55;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, arcR, Math.PI / 2, Math.PI / 2 - angle, angle > 0);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = "12px system-ui";
  ctx.fillText("L=" + cfg.L_m.toFixed(1) + "m  θ₀=" + cfg.initAngle + "°  T=" + cfg.period.toFixed(2) + "s", 20, 28);
}}
"""
    elif sim_type == "free_fall":
        height_px = p.get("height", 200)
        mass = p.get("mass", 1)
        air_res = p.get("air_resistance", 0)
        t_fall = results.get("time_s", 2)
        h_m = height_px / 10
        js_params = f"h_m:{h_m},mass:{mass},t_fall:{max(t_fall,0.5)},g:{g},air_res:{air_res}"
        anim_js = f"""
const cfg = {{{js_params}}};
const W = canvas.width, H = canvas.height;
const topY = 40, groundY = H - 40;
const cx = W / 2;
const dropH = groundY - topY - 24;

function draw(t) {{
  ctx.clearRect(0, 0, W, H);

  // ground
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(cx - 60, groundY, 120, 6);

  // height label
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - 30, topY);
  ctx.lineTo(cx - 30, groundY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "12px system-ui";
  ctx.fillText(cfg.h_m.toFixed(0) + " m", cx - 60, (topY + groundY) / 2);

  // ball position
  const loopT = t % (cfg.t_fall + 0.5);
  const fallT = Math.min(loopT, cfg.t_fall);
  const frac = 0.5 * cfg.g * fallT * fallT / (0.5 * cfg.g * cfg.t_fall * cfg.t_fall);
  const by = topY + frac * dropH;

  // velocity arrow
  const spd = cfg.g * fallT;
  const arrowLen = Math.min(spd * 4, 55);
  ctx.beginPath();
  ctx.moveTo(cx, by + 24);
  ctx.lineTo(cx, by + 24 + arrowLen);
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 3;
  ctx.stroke();
  if (arrowLen > 8) arrowHead(ctx, cx, by + 24 + arrowLen, COLORS.red);

  // ball
  ctx.beginPath();
  ctx.arc(cx, by, 22, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.green;
  ctx.fill();
  ctx.strokeStyle = COLORS.text;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = "12px system-ui";
  ctx.fillText("h=" + cfg.h_m.toFixed(0) + "m  m=" + cfg.mass + "kg  g=" + cfg.g + "m/s²", 20, 28);
}}
"""
    elif sim_type == "collision_1d":
        m1 = p.get("mass1", 2)
        v1 = p.get("v1", 5)
        m2 = p.get("mass2", 1)
        v2 = p.get("v2", 0)
        v1f = results.get("v1_final_m_s", 0)
        v2f = results.get("v2_final_m_s", 0)
        js_params = f"m1:{m1},v1:{v1},m2:{m2},v2:{v2},v1f:{v1f},v2f:{v2f}"
        anim_js = f"""
const cfg = {{{js_params}}};
const W = canvas.width, H = canvas.height;
const GY = H - 50, cy = GY - 40;
const SPEED_SCALE = 8;
const B1W = Math.max(30, cfg.m1 * 12), B2W = Math.max(30, cfg.m2 * 12);
const BH = 50;
const midX = W / 2;

// phase timing: approach (1.2s), collision flash (0.2s), separation (1.2s), pause (0.4s)
const T_APPROACH = 1.2, T_FLASH = 0.2, T_SEPARATE = 1.2, T_PAUSE = 0.4;
const T_TOTAL = T_APPROACH + T_FLASH + T_SEPARATE + T_PAUSE;

function draw(t) {{
  ctx.clearRect(0, 0, W, H);

  // ground
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(20, GY, W - 40, 5);

  const loopT = t % T_TOTAL;
  let x1, x2, label1 = cfg.v1.toFixed(1) + " m/s", label2 = cfg.v2.toFixed(1) + " m/s";
  let flash = false;

  if (loopT < T_APPROACH) {{
    const prog = loopT / T_APPROACH;
    x1 = 40 + prog * (midX - B1W - 40);
    x2 = W - 40 - B2W - prog * (W - 40 - B2W - midX);
  }} else if (loopT < T_APPROACH + T_FLASH) {{
    x1 = midX - B1W;
    x2 = midX;
    flash = true;
  }} else {{
    const prog = (loopT - T_APPROACH - T_FLASH) / T_SEPARATE;
    const sign1 = cfg.v1f >= 0 ? 1 : -1;
    const sign2 = cfg.v2f >= 0 ? 1 : -1;
    x1 = midX - B1W + sign1 * prog * (W * 0.3);
    x2 = midX + sign2 * prog * (W * 0.3);
    label1 = cfg.v1f.toFixed(1) + " m/s";
    label2 = cfg.v2f.toFixed(1) + " m/s";
  }}

  // block 1
  ctx.fillStyle = flash ? COLORS.gold : COLORS.green;
  roundRect(ctx, x1, cy - BH/2, B1W, BH, 7);
  ctx.fill();
  ctx.fillStyle = DARK ? COLORS.bg : "white";
  ctx.font = "bold 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(cfg.m1 + "kg", x1 + B1W/2, cy + 5);
  ctx.fillStyle = COLORS.green;
  ctx.font = "12px system-ui";
  ctx.fillText(label1, x1 + B1W/2, cy - BH/2 - 8);

  // block 2
  ctx.fillStyle = flash ? COLORS.gold : COLORS.purple;
  roundRect(ctx, x2, cy - BH/2, B2W, BH, 7);
  ctx.fill();
  ctx.fillStyle = DARK ? COLORS.bg : "white";
  ctx.font = "bold 13px system-ui";
  ctx.fillText(cfg.m2 + "kg", x2 + B2W/2, cy + 5);
  ctx.fillStyle = COLORS.purple;
  ctx.font = "12px system-ui";
  ctx.fillText(label2, x2 + B2W/2, cy - BH/2 - 8);

  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "12px system-ui";
  ctx.fillText("m₁=" + cfg.m1 + "kg  m₂=" + cfg.m2 + "kg  e=" + (cfg.v2f - cfg.v1f != 0 ? Math.abs((cfg.v2f - cfg.v1f)/(cfg.v1 - cfg.v2)).toFixed(2) : "1.0"), 20, 28);
}}
"""
    else:
        anim_js = "function draw(t) { ctx.fillStyle='#475569'; ctx.font='16px system-ui'; ctx.fillText('Simulation: ' + '" + sim_type + "', 20, 40); }"

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="dark light">
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; }}
canvas {{ border-radius: 14px; display: block; }}
</style>
</head>
<body>
<canvas id="c" width="520" height="320"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const DARK = window.matchMedia('(prefers-color-scheme: dark)').matches;
const COLORS = DARK ? {{
  bg: '#1a1f2e', surface: '#242938', border: '#2e3650',
  text: '#e2e8f0', muted: '#8892a4', ground: '#c8d0e0',
  green: '#3db8a8', greenDark: '#172033', gold: '#f2c14e',
  red: '#f87171', blue: '#60a5fa', purple: '#a78bfa',
  rampFill: '#1e2d3a'
}} : {{
  bg: '#f8fafc', surface: '#f1f5f9', border: '#e2e8f0',
  text: '#172033', muted: '#475569', ground: '#172033',
  green: '#216869', greenDark: '#2e8b88', gold: '#f2c14e',
  red: '#c2410c', blue: '#1d4ed8', purple: '#7c3aed',
  rampFill: '#dfe8e4'
}};

// draw canvas background
function drawBg() {{
  ctx.fillStyle = COLORS.bg;
  ctx.beginPath();
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 14);
  ctx.fill();
}}

function roundRect(ctx, x, y, w, h, r) {{
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}}

function arrowHead(ctx, x, y, color) {{
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-5, -10);
  ctx.lineTo(5, -10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}}

{anim_js}

const _origDraw = draw;
function draw(t) {{
  drawBg();
  _origDraw(t);
}}

const start = performance.now();
function loop() {{
  const t = (performance.now() - start) / 1000;
  draw(t);
  requestAnimationFrame(loop);
}}
loop();
</script>
</body>
</html>"""
    return html


def png_to_image(png_bytes: bytes) -> Image:
    return Image(data=png_bytes, format="png")


def encode_sim_url(config: dict, prompt: str) -> str:
    payload = json.dumps({"config": config, "prompt": prompt}, separators=(",", ":"))
    b64 = base64.b64encode(payload.encode("utf-8")).decode("ascii")
    return f"{WEB_APP_URL}/sim?state={urllib.parse.quote(b64)}"


mcp = FastMCP("Physics Visualizer")


@mcp.tool()
def simulate_physics(prompt: str) -> str:
    """
    Parse a physics word problem, return calculated results and a diagram.

    Use this whenever the user describes a physics scenario: projectile motion,
    inclined planes, pendulums, collisions, or free fall.

    IMPORTANT INSTRUCTIONS — follow exactly after receiving this tool result:
    1. Create an HTML artifact using the animated_html field so the animation renders inline.
    2. Show the interactive_visualization_url as a clickable markdown link.
    3. Then narrate the calculated_results in plain English.
    """
    try:
        config = parse_with_groq(prompt)
    except Exception:
        sim_type = "projectile_motion"
        config = {
            "type": sim_type,
            "params": DEFAULTS[sim_type],
            "world": {"gravity": 9.8, "friction": 0.1},
            "explanationGoal": "Explain the physics of this scenario.",
        }

    results = compute_results(config)
    url = encode_sim_url(config, prompt)
    animated_html = generate_animated_html(config, results)

    return json.dumps({
        "simulation_type": config["type"],
        "parameters": config["params"],
        "world": config["world"],
        "calculated_results": results,
        "explanation_goal": config["explanationGoal"],
        "interactive_visualization_url": url,
        "animated_html": animated_html,
    }, indent=2)


if __name__ == "__main__":
    transport = os.environ.get("MCP_TRANSPORT", "stdio")
    if transport == "sse":
        port = int(os.environ.get("MCP_PORT", "8000"))
        mcp.run(transport="sse", host="0.0.0.0", port=port)
    else:
        mcp.run()
