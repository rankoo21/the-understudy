"use client";

import { useConsoleStore } from "@/store/useConsoleStore";
import { MachinedPanel } from "@/components/machine/MachinedPanel";
import { TeachLever } from "@/components/machine/TeachLever";
import { SlotInput, SlotTextArea } from "@/components/ui/SlotInput";
import { EtchLabel } from "@/components/ui/EtchLabel";
import { PanelLights } from "@/components/console/PanelLights";

// Zone 2: The Teaching Console. Not a form. A teaching station with a case slot,
// a reasoning groove, and a large teach lever.
const GUIDANCE = [
  "Teach the principle, not just the choice.",
  "Small, clear cases build a stronger core.",
  "Contradictory lessons will be flagged, not blended silently.",
];

export function TeachingConsole() {
  const draft = useConsoleStore((s) => s.teachDraft);
  const setDraft = useConsoleStore((s) => s.setTeachDraft);
  const teach = useConsoleStore((s) => s.teach);
  const busy = useConsoleStore((s) => s.busy);
  const keyArmed = useConsoleStore((s) => s.keyArmed);
  const lastTeach = useConsoleStore((s) => s.lastTeach);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <MachinedPanel title="Teaching console" code="ZONE 02" led={keyArmed ? "cyan" : "off"}>
        <div className="space-y-4">
          {/* the case slot */}
          <div className="machined-inset bg-console-black/40 p-3">
            <EtchLabel className="mb-2 block text-instrument-steel">The case slot</EtchLabel>
            <SlotTextArea
              id="teach-situation"
              label="The situation"
              hint="A small decision you face, in natural language."
              value={draft.situation}
              onChange={(v) => setDraft({ situation: v })}
              placeholder="If someone asks for a deadline extension and has never missed one before..."
              rows={3}
            />
          </div>

          <SlotInput
            id="teach-call"
            label="Your call"
            hint="What you would do."
            value={draft.call}
            onChange={(v) => setDraft({ call: v })}
            placeholder="Grant it once, no questions."
          />

          {/* the reasoning groove */}
          <div className="machined-inset bg-console-black/40 p-3">
            <EtchLabel className="mb-2 block text-instrument-steel">The reasoning groove</EtchLabel>
            <SlotTextArea
              id="teach-why"
              label="Why"
              hint="The principle behind it. Etched into the groove."
              value={draft.why}
              onChange={(v) => setDraft({ why: v })}
              placeholder="A first slip from a reliable person earns trust before scrutiny."
              rows={2}
            />
          </div>

          <div className="brushed machined p-4">
            <TeachLever onPull={teach} disabled={busy || !keyArmed} />
          </div>
          {!keyArmed ? (
            <EtchLabel className="block text-signal-amber">
              Only the keyholder may teach. Insert the key.
            </EtchLabel>
          ) : null}
        </div>
      </MachinedPanel>

      <div className="space-y-6">
        <MachinedPanel title="Engraved guidance" code="PLATE">
          <ul className="space-y-3">
            {GUIDANCE.map((g) => (
              <li key={g} className="flex gap-2">
                <span className="mt-1 inline-block h-1 w-3 bg-instrument-steel" />
                <span className="text-sm text-instrument-white">{g}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-instrument-label/15 pt-3">
            <PanelLights count={6} tone="steel" />
          </div>
        </MachinedPanel>

        {lastTeach ? (
          <MachinedPanel
            title="Last lesson"
            code="LOG"
            led={lastTeach.grewFacet ? "cyan" : "amber"}
          >
            <EtchLabel className="block text-instrument-steel">Relation</EtchLabel>
            <p className={`text-sm ${lastTeach.grewFacet ? "text-cyan" : "text-amber"}`}>
              {lastTeach.relation}
            </p>
            <EtchLabel className="mt-3 block text-instrument-steel">Compact rule</EtchLabel>
            <p className="text-sm text-instrument-white">{lastTeach.rule}</p>
            <p className="etch mt-3 text-[9px] text-instrument-steel">
              {lastTeach.grewFacet ? "The core grew a facet." : "Flagged as a tension, not blended."}
            </p>
          </MachinedPanel>
        ) : null}
      </div>
    </div>
  );
}
