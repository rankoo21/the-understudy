"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useConsoleStore } from "@/store/useConsoleStore";
import { MachinedPanel } from "@/components/machine/MachinedPanel";
import { MachineButton } from "@/components/ui/MachineButton";
import { EtchLabel } from "@/components/ui/EtchLabel";
import { telemetryStamp } from "@/utils/format";
import type { Ruling } from "@/lib/genlayer/types";

// Zone 6: The Telemetry Log. The record of rulings as mono telemetry lines,
// cyan for accepted, amber for quarantined. Selecting a line expands it into a
// full machined record strip. Never a grid.
function lineFor(r: Ruling, origin: number, situationText: (id: string) => string): string {
  const verdict = r.state === "accepted" ? "ACCEPTED" : r.state === "quarantined" ? "QUARANTINED" : "RESOLVED";
  const gist = situationText(r.situationId).slice(0, 64);
  return `${telemetryStamp(r.createdAt, origin)}  ${r.id.toUpperCase().padEnd(10)}  ${verdict.padEnd(12)}  ${gist}`;
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function TelemetryLog() {
  const decisions = useConsoleStore((s) => s.decisions);
  const situations = useConsoleStore((s) => s.situations);
  const actions = useConsoleStore((s) => s.actions);
  const setNotice = useConsoleStore.getState().firePulse; // reuse pulse for feedback
  const [openId, setOpenId] = useState<string | null>(null);

  const origin = useMemo(() => {
    if (decisions.length === 0) return 0;
    return Math.min(...decisions.map((d) => d.createdAt));
  }, [decisions]);

  function situationText(id: string): string {
    return situations.find((s) => s.id === id)?.text ?? id;
  }

  function dumpMarkdown() {
    const lines = ["# The Understudy . Telemetry record", ""];
    for (const r of decisions) {
      lines.push(`## ${r.id} (${r.state})`);
      lines.push(`- Situation: ${situationText(r.situationId)}`);
      lines.push(`- Ruling: ${r.decision}`);
      lines.push(`- Principles used: ${r.principlesUsed.join("; ") || "none"}`);
      lines.push(`- Consistent: ${r.consistent ? "yes" : "no"}`);
      lines.push(`- Downstream action: ${r.action || "none"}`);
      lines.push(`- Mock tx: ${r.mockTxHash}`);
      lines.push("");
    }
    download("understudy-record.md", lines.join("\n"), "text/markdown");
    setNotice("cyan");
  }

  function exportJson() {
    download("understudy-telemetry.json", JSON.stringify(decisions, null, 2), "application/json");
    setNotice("cyan");
  }

  function printLine() {
    const text = decisions.map((r) => lineFor(r, origin, situationText)).join("\n");
    download("understudy-lines.txt", text, "text/plain");
    setNotice("cyan");
  }

  return (
    <div className="space-y-6">
      <MachinedPanel title="The telemetry log" code="ZONE 06" led={decisions.length ? "cyan" : "off"}>
        <div className="flex flex-wrap gap-2">
          <MachineButton onClick={dumpMarkdown} disabled={!decisions.length}>
            Dump the record
          </MachineButton>
          <MachineButton onClick={exportJson} disabled={!decisions.length}>
            Export telemetry
          </MachineButton>
          <MachineButton onClick={printLine} disabled={!decisions.length}>
            Print the line
          </MachineButton>
        </div>
      </MachinedPanel>

      <MachinedPanel
        title="Authorized actions"
        code="EFFECT QUEUE"
        led={actions.length ? "cyan" : "off"}
      >
        <EtchLabel className="mb-2 block text-instrument-steel">
          Concrete downstream effects each accepted, consensus-verified ruling authorized on-chain.
        </EtchLabel>
        {actions.length === 0 ? (
          <EtchLabel className="text-instrument-steel">
            No actions queued. An accepted ruling authorizes one concrete effect.
          </EtchLabel>
        ) : (
          <div className="machined-inset bg-console-black/60 p-2">
            <ul className="divide-y divide-instrument-label/10">
              {actions.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-2 py-1">
                  <span className="inline-block h-1.5 w-1.5 led-cyan" />
                  <span className="w-24 shrink-0 font-mono text-[11px] text-instrument-steel">
                    {a.id.toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-sm text-cyan">{a.effect}</span>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-instrument-steel">
                    {a.status} . {a.rulingId}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </MachinedPanel>

      <MachinedPanel title="Instrument log" code="MONO OUT">
        {decisions.length === 0 ? (
          <EtchLabel className="text-instrument-steel">
            No rulings recorded. Run the bay to produce telemetry.
          </EtchLabel>
        ) : (
          <div className="machined-inset bg-console-black/60 p-2">
            <ul className="divide-y divide-instrument-label/10">
              {decisions.map((r) => {
                const tone =
                  r.state === "accepted" ? "text-cyan" : r.state === "quarantined" ? "text-amber" : "text-instrument-white";
                const open = openId === r.id;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setOpenId(open ? null : r.id)}
                      className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-instrument-white/5"
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 ${
                          r.state === "accepted" ? "led-cyan" : r.state === "quarantined" ? "led-amber" : "bg-instrument-label/40"
                        }`}
                      />
                      <span className={`truncate font-mono text-[11px] ${tone}`}>
                        {lineFor(r, origin, situationText)}
                      </span>
                    </button>
                    {open ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="overflow-hidden border-l-2 border-instrument-label/30 bg-console-black/40 px-4 py-2"
                      >
                        <Record label="Situation" value={situationText(r.situationId)} />
                        <Record label="Ruling" value={r.decision} />
                        <Record label="Principles used" value={r.principlesUsed.join("  /  ") || "none"} />
                        <Record
                          label="Result"
                          value={r.consistent ? "Accepted . consistent with principles" : "Quarantined . contradiction held"}
                          tone={r.consistent ? "cyan" : "amber"}
                        />
                        <Record
                          label="Downstream action"
                          value={r.action ? `${r.action}${r.actionId ? `  (${r.actionId})` : ""}` : "none"}
                          tone={r.action ? "cyan" : "neutral"}
                        />
                        <Record label="Mock tx id" value={r.mockTxHash} />
                      </motion.div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </MachinedPanel>
    </div>
  );
}

function Record({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "cyan" | "amber";
}) {
  return (
    <div className="py-1">
      <EtchLabel className="block text-instrument-steel">{label}</EtchLabel>
      <p
        className={`break-words text-sm ${
          tone === "cyan" ? "text-cyan" : tone === "amber" ? "text-amber" : "text-instrument-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
