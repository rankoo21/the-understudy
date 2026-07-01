"use client";

import { useConsoleStore } from "@/store/useConsoleStore";
import { LogicCore } from "@/components/machine/LogicCore";
import { GaugeReadout } from "@/components/machine/GaugeReadout";
import { MachinedPanel } from "@/components/machine/MachinedPanel";
import { EtchLabel } from "@/components/ui/EtchLabel";

// Zone 3: The Core. The grown logic engine. Readouts are engraved instrument
// marks around the core, not cards: facets, coherence, locked principles,
// tensions. Machined and deliberate, never organic.
export function Core() {
  const core = useConsoleStore((s) => s.core);
  const principles = core?.principles ?? [];
  const locked = core?.lockedPrinciples ?? [];
  const tensions = core?.tensions ?? [];
  const coherence = core?.coherence ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-6">
        <MachinedPanel title="The core" code="ZONE 03" led="cyan">
          <LogicCore principles={principles} coherence={coherence} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="machined-inset bg-console-black/40 px-3 py-2 text-center">
              <p className="font-mono text-xl text-instrument-white">{principles.length}</p>
              <EtchLabel className="text-instrument-steel">Facets</EtchLabel>
            </div>
            <div className="machined-inset bg-console-black/40 px-3 py-2 text-center">
              <p className="font-mono text-xl text-cyan">{locked.length}</p>
              <EtchLabel className="text-instrument-steel">Locked</EtchLabel>
            </div>
          </div>
        </MachinedPanel>

        <MachinedPanel title="Instrument marks" code="GAUGE">
          <div className="flex items-center justify-around">
            <GaugeReadout label="Coherence" value={coherence} tone={coherence >= 60 ? "cyan" : "amber"} />
            <GaugeReadout label="Tensions" value={tensions.length} max={8} tone={tensions.length ? "amber" : "neutral"} />
          </div>
        </MachinedPanel>
      </div>

      <div className="space-y-6">
        <MachinedPanel title="Locked principles" code="LOAD-BEARING" led="cyan">
          {locked.length === 0 ? (
            <EtchLabel className="text-instrument-steel">No locked principles yet.</EtchLabel>
          ) : (
            <ul className="space-y-2">
              {locked.map((p) => (
                <li key={p.id} className="flex items-start gap-2 machined-inset bg-console-black/30 px-3 py-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 led-cyan" />
                  <span className="text-sm text-instrument-white">{p.rule}</span>
                </li>
              ))}
            </ul>
          )}
        </MachinedPanel>

        <MachinedPanel title="All principles" code="CORE FACETS">
          {principles.length === 0 ? (
            <EtchLabel className="text-instrument-steel">The core is empty. Teach a case.</EtchLabel>
          ) : (
            <ul className="space-y-2">
              {principles.map((p, i) => (
                <li key={p.id} className="flex items-start gap-3 border-b border-instrument-label/10 pb-2">
                  <span className="etch w-6 shrink-0 text-instrument-steel">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-sm text-instrument-white">{p.rule}</span>
                  <EtchLabel className={p.locked ? "text-cyan" : "text-instrument-steel"}>
                    {p.locked ? "locked" : p.relation}
                  </EtchLabel>
                </li>
              ))}
            </ul>
          )}
        </MachinedPanel>

        {tensions.length > 0 ? (
          <MachinedPanel title="Tensions" code="NEAR-CONFLICT" led="amber">
            <ul className="space-y-2">
              {tensions.map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 led-amber" />
                  <span className="text-sm text-amber">{t}</span>
                </li>
              ))}
            </ul>
          </MachinedPanel>
        ) : null}
      </div>
    </div>
  );
}
