"use client";

import { useMemo, useState } from "react";
import { useConsoleStore } from "@/store/useConsoleStore";
import { MachinedPanel } from "@/components/machine/MachinedPanel";
import { SituationCartridge } from "@/components/machine/SituationCartridge";
import { MachineButton } from "@/components/ui/MachineButton";
import { SlotTextArea } from "@/components/ui/SlotInput";
import { EtchLabel } from "@/components/ui/EtchLabel";
import { StepInDialog } from "./StepInDialog";

// Zone 4: The Decision Bay. The main operating space. A docking bay where new
// situations slide in as machined cartridges, are scanned, and verified against
// the core. Global action "Run the bay" sweeps all docked situations.
export function DecisionBay() {
  const situations = useConsoleStore((s) => s.situations);
  const decisions = useConsoleStore((s) => s.decisions);
  const scanningId = useConsoleStore((s) => s.scanningId);
  const ruleSituation = useConsoleStore((s) => s.ruleSituation);
  const runBay = useConsoleStore((s) => s.runBay);
  const submitSituation = useConsoleStore((s) => s.submitSituation);
  const busy = useConsoleStore((s) => s.busy);
  const keyArmed = useConsoleStore((s) => s.keyArmed);

  const [draft, setDraft] = useState("");
  const [stepInId, setStepInId] = useState<string | null>(null);

  const rulingBySituation = useMemo(() => {
    const map: Record<string, (typeof decisions)[number]> = {};
    for (const r of decisions) {
      // newest first; keep the first seen per situation
      if (!map[r.situationId]) map[r.situationId] = r;
    }
    return map;
  }, [decisions]);

  const dockedCount = situations.filter((s) => s.state === "docked").length;

  async function submit() {
    if (!draft.trim()) return;
    await submitSituation(draft.trim());
    setDraft("");
  }

  return (
    <div className="space-y-6">
      <MachinedPanel title="The decision bay" code="ZONE 04" led={dockedCount ? "cyan" : "off"}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <SlotTextArea
              id="dock-situation"
              label="Dock a situation"
              hint="A real situation arrives while you are away. The understudy will rule on it."
              value={draft}
              onChange={setDraft}
              placeholder="A contributor who never missed a deadline asks for a one week extension."
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <MachineButton onClick={submit} disabled={busy || !draft.trim()}>
              Dock it
            </MachineButton>
            <MachineButton onClick={runBay} disabled={busy || dockedCount === 0} tone="cyan">
              Run the bay
            </MachineButton>
          </div>
        </div>
        <EtchLabel className="mt-3 block text-instrument-steel">
          {dockedCount} docked . {situations.length} total in the bay
        </EtchLabel>
      </MachinedPanel>

      <div className="grid gap-3">
        {situations.length === 0 ? (
          <MachinedPanel title="Empty bay" code="STANDBY">
            <EtchLabel className="text-instrument-steel">
              No situations docked. Dock one above, or run the bay.
            </EtchLabel>
          </MachinedPanel>
        ) : (
          situations.map((s) => (
            <SituationCartridge
              key={s.id}
              situation={s}
              ruling={rulingBySituation[s.id]}
              scanning={scanningId === s.id}
              keyArmed={keyArmed}
              onRule={() => ruleSituation(s.id)}
              onStepIn={() => setStepInId(s.id)}
            />
          ))
        )}
      </div>

      {stepInId ? <StepInDialog situationId={stepInId} onClose={() => setStepInId(null)} /> : null}
    </div>
  );
}
