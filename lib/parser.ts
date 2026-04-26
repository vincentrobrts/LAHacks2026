import type { SimulationConfig, SimulationType } from "@/types/simulation";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function normalizePromptText(prompt: string) {
  return prompt
    .replace(/âˆ’|−/g, "-")
    .replace(/Â°|°/g, " degrees")
    .replace(/Î¼|µ|μ/g, "mu")
    .replace(/â‚–|ₖ/g, "k")
    .replace(/Î©|Ω/g, " ohms")
    .replace(/\bmu\s*k?\s*=\s*([+-]?\d+(?:\.\d+)?)/gi, "friction $1")
    .replace(/([+-]?\d+(?:\.\d+)?)\s*(?:mu|micro)\s*c\b/gi, "$1 microC")
    .replace(/([+-]?\d+(?:\.\d+)?)\s*kg\b/gi, "$1 kg")
    .replace(/([+-]?\d+(?:\.\d+)?)\s*m\s*\/\s*s\b/gi, "$1 m/s")
    .replace(/([+-]?\d+(?:\.\d+)?)\s*n\s*\/\s*m\b/gi, "$1 N/m")
    .replace(/([+-]?\d+(?:\.\d+)?)\s*ohms?\b/gi, "$1 ohms")
    .replace(/([+-]?\d+(?:\.\d+)?)\s*v\b/gi, "$1 V")
    .replace(/([+-]?\d+(?:\.\d+)?)\s*n\b/gi, "$1 N")
    .replace(/([+-]?\d+(?:\.\d+)?)\s*m\b/gi, "$1 m")
    .replace(/\s+/g, " ")
    .trim();
}

function matchNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function allNumbers(text: string, pattern: RegExp) {
  return Array.from(text.matchAll(pattern)).map((match) => Number(match[1])).filter(Number.isFinite);
}

function detectType(prompt: string): SimulationType | null {
  const lower = prompt.toLowerCase();
  if (!lower.trim() || /^(physics|help|make something|blah blah)$/i.test(lower.trim())) return null;
  if (/\b(bohr|hydrogen|electron|shell|energy level|atom)\b/.test(lower)) return "bohr_model";
  if (/\b(standing wave|harmonic|tension|linear density|wavelength)\b/.test(lower)) return "standing_waves";
  if (/\b(bernoulli|fluid|pipe|pressure|flow|velocity increases)\b/.test(lower)) return "bernoulli";
  if (/\b(ohm|ohms|circuit|voltage|resistance|resistor|battery|current|volts?)\b/.test(lower)) return "ohm_law";
  if (/\b(coulomb|charge|charges|electric field|electric force|microc|uc)\b/.test(lower)) return "electric_field";
  if (/\b(torque|lever arm|pivot|rotat)\b/.test(lower)) return "torque";
  if (/\b(circular motion|centripetal|circle|orbit|radius|spinning|spin)\b/.test(lower)) return "circular_motion";
  if (/\b(pendulum|string swinging|swing)\b/.test(lower)) return "pendulum";
  if (/\b(spring|hooke|oscillat|spring constant)\b/.test(lower)) return "spring_mass";
  if (/\b(atwood|pulley|hanging mass|table mass|connected over a pulley)\b/.test(lower)) return "atwood_table";
  if (/\b(incline|inclined plane|ramp|slope|slides? down)\b/.test(lower)) return "inclined_plane";
  if (/\b(free fall|dropped|falls?|height)\b/.test(lower) && !/\b(angle|launch|projectile)\b/.test(lower)) return "free_fall";
  if (/\b(collid\w*|collision|crash\w*|elastic|inelastic)\b/.test(lower) || /\b(?:cart|object)\b.*\bhits?\b/.test(lower)) return "collision_1d";
  if (/\b(projectile|launch(?:ed)?|thrown?|initial velocity)\b/.test(lower)) return "projectile_motion";
  return null;
}

function worldFor(prompt: string) {
  const gravity = matchNumber(prompt, [/\bgravity\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/, /\bg\s*=\s*(\d+(?:\.\d+)?)/]);
  return {
    gravity: prompt.includes("moon") ? 1.6 : prompt.includes("mars") ? 3.7 : finite(gravity) ? clamp(gravity, 1, 20) : 9.8,
    friction: 0,
  };
}

function ordinalHarmonic(prompt: string) {
  const ordinals: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 };
  for (const [word, value] of Object.entries(ordinals)) {
    if (new RegExp(`\\b${word}\\s+harmonic\\b`).test(prompt)) return value;
  }
  const match = prompt.match(/\b([1-4])(?:st|nd|rd|th)\s+harmonic\b/);
  return match ? Number(match[1]) : undefined;
}

const explanationGoal = (type: SimulationType) => `Explain the physics of this ${type.replace(/_/g, " ")} scenario.`;

export function parsePhysicsPrompt(prompt: string): SimulationConfig | null {
  const lower = normalizePromptText(prompt).toLowerCase();
  const type = detectType(lower);
  if (!type) return null;

  const params: Record<string, number> = {};
  const set = (key: string, value: unknown, min = -Infinity, max = Infinity) => {
    if (finite(value)) params[key] = clamp(value, min, max);
  };
  const kgValues = allNumbers(lower, /\b([+-]?\d+(?:\.\d+)?)\s*kg\b/g);
  const meterValues = allNumbers(lower, /\b([+-]?\d+(?:\.\d+)?)\s*(?:m|meter|meters)\b/g);
  const speeds = allNumbers(lower, /\b([+-]?\d+(?:\.\d+)?)\s*(?:m\/s|meters?\s+per\s+second)\b/g);

  switch (type) {
    case "inclined_plane":
      set("mass", kgValues[0], 0.1, 100);
      set("angle", matchNumber(lower, [/\b([+-]?\d+(?:\.\d+)?)\s*(?:degree|degrees|deg)\b/, /\bangle\s*(?:=|is|of)?\s*([+-]?\d+(?:\.\d+)?)/]), 0, 90);
      set("friction", /\bfrictionless\b/.test(lower) ? 0 : matchNumber(lower, [/\b(?:mu|friction|coefficient of friction)\s*(?:=|is|of)?\s*([+-]?\d+(?:\.\d+)?)/]), 0, 1);
      set("distance", matchNumber(lower, [/\b(?:for|over|goes|slides)\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\b/, /\bdistance\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]), 0, 1000);
      break;
    case "atwood_table":
      set("mass1", matchNumber(lower, [/\b(\d+(?:\.\d+)?)\s*kg\s+(?:block|cart|object|mass)/, /\btable mass\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]) ?? kgValues[0], 0.1, 100);
      set("mass2", matchNumber(lower, [/\bhanging\s+(\d+(?:\.\d+)?)\s*kg/, /\b(\d+(?:\.\d+)?)\s*kg\s+hanging/, /\bhanging mass\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]) ?? kgValues[1], 0.1, 100);
      set("friction", /\bfrictionless\b/.test(lower) ? 0 : matchNumber(lower, [/\b(?:mu|friction|coefficient of friction)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]), 0, 1);
      set("distance", matchNumber(lower, [/\bfalls?\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\b/, /\bfor\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\b/]), 0, 1000);
      break;
    case "projectile_motion":
      set("speed", speeds[0] ?? matchNumber(lower, [/\b(?:speed|velocity|initial velocity)\s*(?:=|is|of|at)?\s*(\d+(?:\.\d+)?)/]), 0, 10000);
      set("angle", matchNumber(lower, [/\b(\d+(?:\.\d+)?)\s*(?:degree|degrees|deg)\b/, /\bangle\s*(?:=|is|of|at)?\s*(\d+(?:\.\d+)?)/]), 0, 90);
      set("mass", kgValues[0], 0.1, 1000);
      if (/\bground level\b/.test(lower)) set("initial_height", 0);
      else set("initial_height", matchNumber(lower, [/\bfrom\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\s+(?:high|above)/, /\bheight\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]), 0, 10000);
      if (!finite(params.initial_height)) set("initial_height", 0);
      break;
    case "collision_1d":
      set("mass1", kgValues[0], 0.1, 1000);
      set("mass2", kgValues[1], 0.1, 1000);
      set("v1", speeds[0], -10000, 10000);
      set("v2", /\bat rest\b/.test(lower) || (kgValues.length >= 2 && speeds.length === 1) ? 0 : speeds[1], -10000, 10000);
      if (/\bperfectly\s+inelastic\b/.test(lower) || /\binelastic\w*\b/.test(lower)) set("restitution", 0);
      else if (/\belastic\w*\b/.test(lower)) set("restitution", 1);
      break;
    case "pendulum":
      set("length", matchNumber(lower, [/\blength\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]) ?? meterValues[0], 0.01, 1000);
      set("initial_angle", matchNumber(lower, [/\bfrom\s+(\d+(?:\.\d+)?)\s*(?:degree|degrees|deg)\b/, /\b(\d+(?:\.\d+)?)\s*(?:degree|degrees|deg)\b/]), 0, 90);
      set("mass", kgValues[0], 0.1, 1000);
      break;
    case "free_fall":
      set("height", matchNumber(lower, [/\bfrom\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\b/, /\bheight\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]) ?? meterValues[0], 0, 100000);
      set("mass", kgValues[0], 0.1, 1000);
      if (/\b(no air|vacuum)\b/.test(lower)) set("air_resistance", 0);
      else set("air_resistance", matchNumber(lower, [/\bair resistance\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]), 0, 1);
      break;
    case "spring_mass":
      set("spring_constant", matchNumber(lower, [/\b(\d+(?:\.\d+)?)\s*n\/m\b/, /\bspring constant\s*(?:=|is|of|has)?\s*(\d+(?:\.\d+)?)/, /\bk\s*=\s*(\d+(?:\.\d+)?)/]), 0, 100000);
      set("mass", kgValues[0], 0.1, 1000);
      set("amplitude", matchNumber(lower, [/\b(?:displacement|amplitude)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]), 0, 1000);
      break;
    case "circular_motion":
      set("mass", kgValues[0], 0.1, 1000);
      set("radius", matchNumber(lower, [/\bradius\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/, /\bcircle of radius\s+(\d+(?:\.\d+)?)/]) ?? meterValues[0], 0, 1000);
      set("speed", speeds[0] ?? matchNumber(lower, [/\b(?:speed|velocity)\s*(?:=|is|of|at)?\s*(\d+(?:\.\d+)?)/]), 0, 10000);
      break;
    case "torque":
      set("force", matchNumber(lower, [/\bforce\s+of\s+(\d+(?:\.\d+)?)\s*n\b/, /\b(\d+(?:\.\d+)?)\s*n\b/]), 0, 100000);
      set("arm_length", matchNumber(lower, [/\b(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\s+from\s+(?:a\s+)?pivot/, /\blever arm\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]) ?? meterValues[0], 0, 1000);
      set("mass", kgValues[0], 0.1, 1000);
      break;
    case "electric_field": {
      const charges = allNumbers(lower, /([+-]?\d+(?:\.\d+)?)\s*(?:uc|microc|micro c)\b/g);
      if (charges.length < 2) {
        const afterCharges = lower.match(/\bcharges?\s+([+-]?\d+(?:\.\d+)?)\s+(?:and\s+)?([+-]?\d+(?:\.\d+)?)/);
        if (afterCharges) charges.push(Number(afterCharges[1]), Number(afterCharges[2]));
      }
      charges.slice(0, 4).forEach((charge, index) => set(`charge${index + 1}`, charge, -100000, 100000));
      set("separation", matchNumber(lower, [/\b(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\s+apart\b/, /\bdistance\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]) ?? (charges.length ? meterValues[0] : undefined), 0, 100000);
      break;
    }
    case "ohm_law": {
      set("voltage", matchNumber(lower, [/\b(\d+(?:\.\d+)?)\s*(?:v|volt|volts)\b/, /\b(?:voltage|battery|emf)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]), 0, 100000);
      set("internal_resistance", matchNumber(lower, [/\binternal\s+resistance\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]) ?? 0, 0, 100000);
      // Strip "internal resistance X ohms" so the first bare "X ohms" match finds the external resistor
      const externalLower = lower.replace(/\binternal\s+resistance\s*(?:=|is|of)?\s*\d+(?:\.\d+)?\s*(?:ohm|ohms)?\b/gi, "");
      set("resistance", matchNumber(externalLower, [
        /\b(\d+(?:\.\d+)?)\s*(?:ohm|ohms)\s+resistor\b/,
        /\bresistor\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:ohm|ohms)?\b/,
        /\b(\d+(?:\.\d+)?)\s*(?:ohm|ohms)\b/,
        /\bexternal\s+resistan(?:ce|t)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/,
      ]), 0, 100000);
      break;
    }
    case "bernoulli":
      set("v1", matchNumber(lower, [/\bvelocity\s*(?:increases|changes)?\s*from\s*(\d+(?:\.\d+)?)/]) ?? speeds[0], 0, 10000);
      set("v2", matchNumber(lower, [/\bto\s*(\d+(?:\.\d+)?)\s*(?:m\/s|meters?\s+per\s+second)\b/]) ?? speeds[1], 0, 10000);
      if (/\bhorizontal\b/.test(lower)) {
        set("height1", 0);
        set("height2", 0);
      }
      set("density", /\bwater\b/.test(lower) ? 1000 : matchNumber(lower, [/\bdensity\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]), 0, 100000);
      break;
    case "standing_waves":
      set("length", matchNumber(lower, [/\blength\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]) ?? meterValues[0], 0, 1000);
      set("harmonic", matchNumber(lower, [/\b(?:harmonic|n)\s*(?:=|is|of|at)?\s*(\d+)/]) ?? ordinalHarmonic(lower), 1, 100);
      set("tension", matchNumber(lower, [/\btension\s*(?:=|is|of|with)?\s*(\d+(?:\.\d+)?)/, /\b(\d+(?:\.\d+)?)\s*n\b/]), 0, 100000);
      set("linear_density", matchNumber(lower, [/\blinear density\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/]), 0, 1000);
      break;
    case "bohr_model":
      set("n_initial", matchNumber(lower, [/\bfrom\s+n\s*=\s*(\d+)/, /\bn_initial\s*=\s*(\d+)/]), 1, 100);
      set("n_final", matchNumber(lower, [/\bto\s+n\s*=\s*(\d+)/, /\bn_final\s*=\s*(\d+)/]), 1, 100);
      if (/\bhydrogen\b/.test(lower)) set("atomic_number", 1);
      else set("atomic_number", matchNumber(lower, [/\batomic number\s*(?:=|is|of)?\s*(\d+)/]), 1, 100);
      break;
  }

  return { type, params, world: worldFor(lower), explanationGoal: explanationGoal(type) };
}

export function parserJson(config: SimulationConfig) {
  return JSON.stringify(config, null, 2);
}
