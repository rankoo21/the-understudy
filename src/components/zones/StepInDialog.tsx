"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useConsoleStore } from "@/store/useConsoleStore";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { MachineButton } from "@/components/ui/MachineButton";
import { SlotInput, SlotTextArea } from "@/components/ui/SlotInput";
import { EtchLabel } from "@/components/ui/EtchLabel";

// Owner step-in for a quarantined situation: resolve manually and optionally
// teach a clarifying principle. Keyholder only.
export function StepInDialog({
  situationId,
  onClose,
}: {
  situationId: string;
  onClose: () => void;
}) {
  const stepIn = useConsoleStore((s) => s.stepIn);
  const busy = useConsoleStore((s) => s.busy);
  const situations = useConsoleStore((s) => s.situations);
  const sit = situations.find((s) => s.id === situationId);

  const [decision, setDecision] = useState("");
  const [rule, setRule] = useState("");
  const [lock, setLock] = useState(true);

  async function confirm() {
    if (!decision.trim()) return;
    await stepIn({ situationId, decision: decision.trim(), clarifyingRule: rule.trim(), lock });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-console-black/80 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-lg"
      >
        <MetalPanel>
          <div className="flex items-center justify-between border-b border-instrument-label/20 px-4 py-2">
            <EtchLabel className="text-signal-amber">Step in . keyholder</EtchLabel>
            <button onClick={onClose} className="etch text-[10px] text-instrument-steel hover:text-instrument-white">
              Close
            </button>
          </div>
          <div className="space-y-4 p-4">
            {sit ? (
              <div className="machined-inset bg-console-black/40 px-3 py-2">
                <EtchLabel className="block text-instrument-steel">The held situation</EtchLabel>
                <p className="text-sm text-instrument-white">{sit.text}</p>
              </div>
            ) : null}
            <SlotTextArea
              id="stepin-decision"
              label="Your manual call"
              hint="Decide this case yourself. The understudy will record it as resolved by the keyholder."
              value={decision}
              onChange={setDecision}
              rows={2}
            />
            <SlotInput
              id="stepin-rule"
              label="Teach a clarifying principle (optional)"
              hint="Add a compact rule so the understudy handles this case next time."
              value={rule}
              onChange={setRule}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={lock}
                onChange={(e) => setLock(e.target.checked)}
                className="h-3 w-3 accent-[#38E1D6]"
              />
              <EtchLabel className="text-instrument-white">Lock this principle</EtchLabel>
            </label>
            <div className="flex justify-end gap-2">
              <MachineButton onClick={onClose}>Leave it held</MachineButton>
              <MachineButton onClick={confirm} tone="cyan" disabled={busy || !decision.trim()}>
                Step in and decide
              </MachineButton>
            </div>
          </div>
        </MetalPanel>
      </motion.div>
    </div>
  );
}
