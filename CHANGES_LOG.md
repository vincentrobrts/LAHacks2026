# Changes Log — LAHacks 2026 / Intuify

Chronological log of significant changes. Each entry notes what changed, why, and how to roll back if needed.

---

## Session 3 — 2026-04-25 (overnight autonomous batch)

### New: 7 additional physics simulation types

**Files added:**
- `components/scenes/_shared.tsx` — shared React utilities (`SceneProps`, `SCENE_W/H`, `clamp`, `fmt`, `ArrowMarker`, `GuidedBreakdown`, `SceneActions`, `InfoPanels`)
- `components/scenes/CircularMotionScene.tsx` — uniform circular motion, centripetal force
- `components/scenes/TorqueScene.tsx` — torque, moment of inertia, angular acceleration
- `components/scenes/ElectricFieldScene.tsx` — Coulomb force, field lines, charge visualization
- `components/scenes/OhmLawScene.tsx` — Ohm's law circuit, animated current dots
- `components/scenes/BernoulliScene.tsx` — Bernoulli fluid flow, pipe cross-section animation
- `components/scenes/StandingWavesScene.tsx` — standing waves, harmonics, nodes/antinodes
- `components/scenes/BohrModelScene.tsx` — Bohr model, electron orbits, photon emission/absorption

**Files modified:**

| File | Change |
|------|--------|
| `types/simulation.ts` | Added 7 new `SimulationType` union members |
| `lib/defaults.ts` | Added 7 new `DEFAULT_CONFIGS` entries |
| `app/api/parse/route.ts` | Added 7 types to `VALID_TYPES`, expanded `SYSTEM_PROMPT` with new param schemas |
| `components/MatterScene.tsx` | Imported 7 new scene components; added dispatcher branches |
| `components/SimulationClient.tsx` | Added 7 new entries to `SCENARIO_LABELS` |
| `agent/mcp_server.py` | Expanded `SYSTEM_PROMPT`, `DEFAULTS`, `compute_results()` branches, `generate_animated_html()` canvas animations for all 14 types |

**Physics implemented:**

| Type | Key equations |
|------|--------------|
| `circular_motion` | F_c = mv²/r, ω = v/r, T = 2π/ω |
| `torque` | τ = F·L, I = ¹⁄₃mL² (rod), α = τ/I |
| `electric_field` | F = kq₁q₂/r², k = 8.99×10⁹ |
| `ohm_law` | I = V/(R+r), V_t = V−Ir, P = I²R |
| `bernoulli` | A₁v₁ = A₂v₂, ΔP = ½ρ(v₂²−v₁²) |
| `standing_waves` | v = √(T/μ), f = nv/(2L), λ = 2L/n |
| `bohr_model` | Eₙ = −13.6Z²/n² eV, λ = 1240/\|ΔE\| nm |

**Rollback instructions:**
1. Revert `types/simulation.ts`, `lib/defaults.ts`, `app/api/parse/route.ts`, `components/SimulationClient.tsx` to remove the 7 new type entries (they are all additive — removing the new union members and config keys restores prior behavior)
2. Remove the 8 import lines and 7 dispatcher branches from `components/MatterScene.tsx`
3. Delete `components/scenes/` entirely (the new files) or just the 8 new files
4. Revert `agent/mcp_server.py` SYSTEM_PROMPT, DEFAULTS, and the new elif branches in `compute_results` and `generate_animated_html`

---

## Session 2 — (prior session summary)

### Canvas animated HTML for MCP server
- Replaced static SVG generation with `generate_animated_html()` returning a full HTML page with `<canvas>` + `requestAnimationFrame` loop
- Dark mode support via `window.matchMedia('(prefers-color-scheme: dark)')` and a `COLORS` palette
- Covers: projectile_motion, inclined_plane, pendulum, free_fall, collision_1d

### SSE transport for claude.ai web integration
- Added `if transport == "sse": mcp.run(transport="sse", ...)` branch in `mcp_server.py`
- Can be activated via `MCP_TRANSPORT=sse MCP_PORT=8000 python agent/mcp_server.py`

### Pendulum arc direction fix
- Bug: arc swept in the wrong rotational direction
- Fix: `ctx.arc(pivotX, pivotY, arcR, Math.PI/2, Math.PI/2 - angle, angle > 0)`

### atwood_table added to API VALID_TYPES
- Was silently falling back to `projectile_motion`; fixed by adding to the array in `route.ts`

### spring_mass added throughout
- Added to `types/simulation.ts`, `lib/defaults.ts`, `route.ts`, MCP server DEFAULTS
- Web scene: `SpringMassScene` component with horizontal spring animation

---

## Session 1 — initial project setup

- Next.js 14 App Router scaffold
- Groq API integration (llama-3.3-70b-versatile) for physics prompt parsing
- FastMCP Python server for Claude Desktop integration
- 5 initial simulation types: projectile_motion, collision_1d, pendulum, inclined_plane, free_fall
- `MatterScene.tsx` with SVG animations for all 5 types
- `buildExplanation()` for AI-generated step-by-step physics explanations
