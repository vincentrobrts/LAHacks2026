import { Suspense } from "react";
import SimulationClient from "@/components/SimulationClient";

export default function SimulationPage() {
  return (
    <Suspense fallback={<main className="p-8 text-slate-800">Loading simulation...</main>}>
      <SimulationClient />
    </Suspense>
  );
}
