# Intuify Project Handoff

## Current Goal
Build a polished educational physics visualizer that turns word problems into interactive simulations. Person B owns frontend/simulation UI only.

## Fully Working
- Inclined plane demo is the primary polished scenario.
- Inclined plane has prompt examples, sliders, animation, textbook model, results, guided breakdown, history, and share links.
- Inclined plane physics uses:
  - `N = mg cos theta`
  - `F_f = mu_k N`
  - `a = g(sin theta - mu_k cos theta)`
  - `t = sqrt(2d / a)`
  - `v = sqrt(2ad)`

## Partially Working
- `atwood_table` frontend scene exists with diagram, controls, validation UI, animation, results, and guided breakdown.
- Atwood example config exists.
- Simulation page Example 3 is the Atwood prompt.
- Landing page Example 3 was changed to the Atwood prompt, but landing-page parsing/routing still needs verification.

## Remaining Bugs / Risks
- Latest Atwood fixes were interrupted before verification.
- Need to run `tsc`, lint, and build/dev if environment allows.
- Need visual QA for Atwood:
  - `m1` and `m2` must move equal visual displacement.
  - `m2` must remain fully visible at max distance.
  - pulley/table/string alignment must be checked.
- Need verify Atwood prompt does not parse `2 kg` as gravity.
- Some UI text may show mojibake symbols from earlier encoding/display issues; clean only if visible in browser.
- `npm` has not been available on PATH in this shell; direct Next build has been blocked by `node.exe Access is denied`.

## Relevant Files
- `components/MatterScene.tsx`
  - Renders inclined plane and Atwood scenes.
  - Contains simulation animation logic and guided breakdown UI.
- `components/SimulationClient.tsx`
  - Prompt input, examples, controls, history, share links, scene dispatch props.
  - Includes frontend Atwood prompt extraction/helper behavior.
- `app/page.tsx`
  - Landing page and landing prompt examples.
- `types/simulation.ts`
  - Shared frontend `SimulationConfig` type union. Includes `atwood_table`.
- `lib/defaults.ts`
  - Default/demo configs, including Atwood example config.
- Do not modify Person A files:
  - `lib/agentverse.ts`
  - `lib/parser.ts`
  - `lib/explanation.ts`
  - `app/api/parse/route.ts`

## Physics Assumptions
- Inclined plane:
  - Block starts from rest.
  - Kinetic friction is `mu_k mg cos theta`.
  - If acceleration is `<= 0`, block does not slide.
- Atwood table:
  - Massless string and frictionless/massless pulley.
  - `m1` on horizontal table, `m2` hanging.
  - Both masses share the same displacement magnitude and acceleration.
  - Friction on table is `mu m1 g`.
  - `drivingForce = m2 g - mu m1 g`.
  - If `drivingForce <= 0`, no motion.
  - If moving:
    - `a = drivingForce / (m1 + m2)`
    - `T = m1 a + mu m1 g`
    - `t = sqrt(2d / a)`
    - `v = sqrt(2ad)`

## Next Exact Task
Verify and finish the interrupted Atwood bug-fix pass:
1. Run TypeScript/lint checks.
2. Verify landing Example 3 and simulation Example 3 both use Atwood.
3. Confirm Atwood example loads with `gravity = 9.8`.
4. Confirm `m1` and `m2` move equal visual displacement and `m2` stays visible.
5. Confirm inclined-plane angle arc is correct and inclined-plane behavior is unchanged.
