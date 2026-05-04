const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(root, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = require("node:fs").readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  SIMULATION_REGISTRY,
  SIMULATION_TYPES,
} = require("../lib/simulations/registry.ts");
const {
  validateSimulationConfig,
  validateSharedSimulation,
  validateParsedCompound,
} = require("../lib/simulations/schema.ts");
const {
  simulationFixtures,
  validCompoundGraphFixture,
  invalidCompoundGraphFixture,
} = require("../lib/simulations/fixtures.ts");
const { encodeSimulation, decodeSimulation } = require("../lib/share.ts");

function assertRange(range, type, key) {
  assert.equal(typeof range.min, "number", `${type}.${key} range min must be numeric`);
  assert.equal(typeof range.max, "number", `${type}.${key} range max must be numeric`);
  assert.equal(typeof range.step, "number", `${type}.${key} range step must be numeric`);
  assert.ok(range.min < range.max, `${type}.${key} range min must be less than max`);
  assert.ok(range.step > 0, `${type}.${key} range step must be positive`);
}

for (const type of SIMULATION_TYPES) {
  const metadata = SIMULATION_REGISTRY[type];
  assert.ok(metadata, `${type} must have registry metadata`);
  assert.equal(metadata.type, type, `${type} metadata type must match key`);
  assert.equal(metadata.rendererKey, type, `${type} renderer key must default to type`);
  assert.ok(metadata.displayName.trim(), `${type} must have display name`);
  assert.ok(metadata.description.trim(), `${type} must have description`);
  assert.ok(metadata.defaultConfig, `${type} must have default config`);
  assert.equal(metadata.defaultConfig.type, type, `${type} default config type must match`);
  assert.ok(validateSimulationConfig(metadata.defaultConfig), `${type} default config must validate`);
  assert.ok(Array.isArray(metadata.requiredParams), `${type} required params must be an array`);
  assert.ok(Array.isArray(metadata.optionalParams), `${type} optional params must be an array`);
  assert.ok(Array.isArray(metadata.paramOrder), `${type} param order must be an array`);

  for (const key of Object.keys(metadata.defaultConfig.params)) {
    const param = metadata.params[key];
    assert.ok(param, `${type}.${key} must have parameter metadata`);
    assert.equal(param.key, key, `${type}.${key} parameter key must match`);
    assert.ok(param.label.trim(), `${type}.${key} must have a label`);
    if (param.unit !== undefined) assert.equal(typeof param.unit, "string", `${type}.${key} unit must be a string`);
    if (param.range) assertRange(param.range, type, key);
  }
}

assert.equal(validateSimulationConfig({ type: "not_real", params: {}, world: {} }), null, "invalid simulation type must fail");
assert.equal(validateSharedSimulation({ config: { type: "nope" }, prompt: "bad" }), null, "invalid shared config must fail");

for (const [name, fixture] of Object.entries(simulationFixtures)) {
  assert.ok(validateSimulationConfig(fixture), `${name} fixture must validate`);
}

const encoded = encodeSimulation(
  simulationFixtures.inclinedPlane,
  "A 5 kg block slides down a 30 degree incline with friction 0.2.",
);
const decoded = decodeSimulation(encoded);
assert.ok(decoded, "encoded share state must decode");
assert.equal(decoded.config.type, "inclined_plane", "decoded share state must preserve type");
assert.ok(validateSharedSimulation(decoded), "decoded share state must validate");

assert.ok(validateParsedCompound(validCompoundGraphFixture), "valid compound fixture must validate");
assert.equal(validateParsedCompound(invalidCompoundGraphFixture), null, "invalid compound fixture must be rejected");

console.log(`Simulation checks passed for ${SIMULATION_TYPES.length} registry entries.`);
