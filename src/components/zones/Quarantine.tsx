"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useConsoleStore } from "@/store/useConsoleStore";
import { MachinedPanel } from "@/components/machine/MachinedPanel";
import { MachineButton } from "@/components/ui/MachineButton";
import { EtchLabel } from "@/components/ui/EtchLabel";
import { relativeTime } from "@/utils/format";
import { StepInDialog } from "./StepInDialog";

// Zone 5: The Quarantine. Held contradictions the understudy refused to act on.
// A sealed drawer of amber-lit cartridges, each presented as a machine fault to
// inspect, never a moral judgment.
export function Quarantine() {
  const reduce = useReducedMotion();
  const quarantine = useConsoleStore((s) => s.quarantine);
  const situations = useConsoleStore((s) => s.situations);
  const setZone = useConsoleStore((s) => s.setZone);
  const keyArmed = useConsoleStore((s) => s.keyArmed);
  const [stepInId, setStepInId] = useState<string | null>(null);

  function situationText(id: string): string {
    return situations.find((s) => s.id === id)?.text ?? id;
  }

  return (
    <div className="space-y-6">
      <MachinedPanel title="The quarantine" code="ZONE 05" led={quarantine.length ? "amber" : "off"}>
        <EtchLabel className="text-instrument-steel">
          Held in quarantine . {quarantine.length} contradiction{quarantine.length === 1 ? "" : "s"} . never acted on
        </EtchLabel>
      </MachinedPanel>

      {quarantine.length === 0 ? (
        <MachinedPanel title="Sealed drawer" code="EMPTY">
          <EtchLabel className="text-instrument-steel">
            Nothing held. Contradictory rulings would lock here under amber.
          </EtchLabel>
        </MachinedPanel>
      ) : (
        <div className="grid gap-3">
          {quarantine.map((r) => (
            <motion.div
              key={r.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden brushed machined glow-amber"
            >
              {/* amber lock bar */}
              <div className="absolute left-0 top-0 h-full w-1.5 bg-signal-amber/70" />
              <div className="space-y-3 px-5 py-3">
                <div className="flex items-center justify-between">
                  <EtchLabel className="text-signal-amber">Locked . {r.id}</EtchLabel>
                  <EtchLabel className="text-instrument-steel">{relativeTime(r.createdAt)}</EtchLabel>
                </div>

                <div>
                  <EtchLabel className="block text-instrument-steel">The situation</EtchLabel>
                  <p className="text-sm text-instrument-white">{situationText(r.situationId)}</p>
                </div>

                <div>
                  <EtchLabel className="block text-instrument-steel">The ruling it wanted</EtchLabel>
                  <p className="text-sm text-instrument-white">{r.decision}</p>
                </div>

                <div>
                  <EtchLabel className="block text-instrument-steel">Locked principle it violated</EtchLabel>
                  <p className="text-sm text-amber">
                    {r.principlesUsed.length ? r.principlesUsed.join("  /  ") : "a load-bearing principle"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-instrument-label/15 pt-2">
                  <MachineButton tone="amber" disabled={!keyArmed} onClick={() => setZone("teach")}>
                    Teach a clarifying case
                  </MachineButton>
                  <MachineButton tone="cyan" disabled={!keyArmed} onClick={() => setStepInId(r.situationId)}>
                    Step in and decide
                  </MachineButton>
                  <MachineButton onClick={() => undefined}>Leave it held</MachineButton>
                </div>
                {!keyArmed ? (
                  <EtchLabel className="block text-signal-amber">
                    Only the keyholder may step in. Insert the key.
                  </EtchLabel>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {stepInId ? <StepInDialog situationId={stepInId} onClose={() => setStepInId(null)} /> : null}
    </div>
  );
}
