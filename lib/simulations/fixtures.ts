import type { ParsedCompound } from "@/lib/physics/builder";
import type { SimulationConfig } from "@/types/simulation";

export const simulationFixtures = {
  inclinedPlane: {
    type: "inclined_plane",
    params: { angle: 30, friction: 0.2, mass: 5, distance: 3 },
    world: { gravity: 9.8, friction: 0.2 },
    explanationGoal: "Explain a block sliding down an inclined plane.",
  },
  atwoodTable: {
    type: "atwood_table",
    params: { mass1: 4, mass2: 2, friction: 0, distance: 3 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain a table mass connected to a hanging mass.",
  },
  pendulum: {
    type: "pendulum",
    params: { length: 3, initial_angle: 30, mass: 1 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain pendulum period and speed.",
  },
  electricField: {
    type: "electric_field",
    params: { charge1: 3, charge2: -2, separation: 2 },
    world: { gravity: 9.8, friction: 0 },
    explanationGoal: "Explain Coulomb force between two charges.",
  },
} satisfies Record<string, SimulationConfig>;

export const validCompoundGraphFixture: ParsedCompound = {
  components: [
    { id: "bat1", kind: "battery", label: "9 V Battery", props: { voltage: 9 } },
    { id: "r1", kind: "resistor", label: "10 ohm resistor", props: { resistance: 10 } },
    { id: "r2", kind: "resistor", label: "20 ohm resistor", props: { resistance: 20 } },
  ],
  connections: [
    { from: "bat1", to: "r1", label: "wire" },
    { from: "r1", to: "r2", label: "wire" },
    { from: "r2", to: "bat1", label: "wire return" },
  ],
};

export const invalidCompoundGraphFixture = {
  components: [
    { id: "m1", kind: "mass", label: "mass", props: { mass: 1 } },
  ],
  connections: [
    { from: "m1", to: "missing", label: "rope" },
  ],
};
