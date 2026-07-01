"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useConsoleStore } from "@/store/useConsoleStore";
import { SelectorDial } from "./SelectorDial";
import { KeySwitch } from "./KeySwitch";
import { StatusStrip } from "./StatusStrip";
import { PanelLights } from "./PanelLights";
import { EtchLabel } from "@/components/ui/EtchLabel";

import { ColdBoot } from "@/components/zones/ColdBoot";
import { TeachingConsole } from "@/components/zones/TeachingConsole";
import { Core } from "@/components/zones/Core";
import { DecisionBay } from "@/components/zones/DecisionBay";
import { Quarantine } from "@/components/zones/Quarantine";
import { TelemetryLog } from "@/components/zones/TelemetryLog";

// The single control console. Not pages: panel zones of one machine. The
// Selector Dial and Key Switch are mounted in the corner instrument cluster;
// the active zone fills the work surface; the Status Strip runs along the
// bottom edge.
const ONBOARD: Record<string, string> = {
  boot: "Pull the lever to teach a case.",
  teach: "Each accepted case grows a facet.",
  core: "Locked principles bound every ruling.",
  bay: "Situations dock here for a ruling.",
  quarantine: "Contradictions are held, never acted on.",
  telemetry: "The record reads like machine output.",
};

export function ConsoleWorld() {
  const zone = useConsoleStore((s) => s.zone);
  const refresh = useConsoleStore((s) => s.refresh);
  const error = useConsoleStore((s) => s.error);
  const notice = useConsoleStore((s) => s.notice);
  const clearMessages = useConsoleStore((s) => s.clearMessages);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!error && !notice) return;
    const t = window.setTimeout(clearMessages, 4200);
    return () => window.clearTimeout(t);
  }, [error, notice, clearMessages]);

  return (
    <div className="relative min-h-screen pb-12">
      {/* top instrument cluster: dial + identity plate + key switch */}
      <header className="relative z-20 flex items-start justify-between gap-4 border-b border-instrument-label/15 bg-console-black/70 px-4 py-4 backdrop-blur sm:px-6">
        <SelectorDial />

        <div className="hidden flex-1 flex-col items-center justify-center gap-2 self-center text-center md:flex">
          <EtchLabel className="text-instrument-white">The Understudy</EtchLabel>
          <p className="max-w-md text-xs text-instrument-steel">
            It learns your calls, and makes them when you are away.
          </p>
          <PanelLights count={10} tone="steel" />
          <EtchLabel className="text-signal-cyan">{ONBOARD[zone]}</EtchLabel>
        </div>

        <KeySwitch />
      </header>

      {/* work surface: the active zone */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.section
            key={zone}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            {zone === "boot" ? <ColdBoot /> : null}
            {zone === "teach" ? <TeachingConsole /> : null}
            {zone === "core" ? <Core /> : null}
            {zone === "bay" ? <DecisionBay /> : null}
            {zone === "quarantine" ? <Quarantine /> : null}
            {zone === "telemetry" ? <TelemetryLog /> : null}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* transient messages, machine style */}
      <div className="pointer-events-none fixed inset-x-0 bottom-12 z-40 flex justify-center px-4">
        <AnimatePresence>
          {error ? (
            <motion.div
              key="err"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="brushed machined glow-amber px-4 py-2"
            >
              <span className="etch text-[10px] text-amber">{error}</span>
            </motion.div>
          ) : notice ? (
            <motion.div
              key="note"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="brushed machined glow-cyan px-4 py-2"
            >
              <span className="etch text-[10px] text-cyan">{notice}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <StatusStrip />
    </div>
  );
}
