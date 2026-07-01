"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useConsoleStore } from "@/store/useConsoleStore";
import { LogicCore } from "@/components/machine/LogicCore";
import { TeachLever } from "@/components/machine/TeachLever";
import { PanelLights } from "@/components/console/PanelLights";
import { EtchLabel } from "@/components/ui/EtchLabel";

// Zone 1: The Cold Boot. A dark console powering on. A nearly featureless logic
// core sits dim in the center. Panel LEDs blink in sequence. The only affordance
// is to pull the main teach lever for the first time, which lights the first
// facet and moves to the Teaching Console.

const BOOT_LINES = [
  "Teach it cases. It grows a logic core.",
  "It stands in for you, within your principles.",
  "Bounded autonomous delegation. Verified by consensus.",
];

export function ColdBoot() {
  const reduce = useReducedMotion();
  const core = useConsoleStore((s) => s.core);
  const enterFromBoot = useConsoleStore((s) => s.enterFromBoot);
  const boot = useConsoleStore((s) => s.boot);
  const keyArmed = useConsoleStore((s) => s.keyArmed);
  const [line, setLine] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setLine((v) => (v + 1) % BOOT_LINES.length), 3200);
    return () => window.clearInterval(t);
  }, []);

  async function firstPull() {
    await boot();
    enterFromBoot();
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-6 text-center">
      <PanelLights count={12} sequence tone="steel" />

      <div className="relative opacity-90">
        {/* dim, nearly featureless core at boot */}
        <div className={reduce ? "" : "animate-pulse"}>
          <LogicCore principles={core?.principles ?? []} coherence={core?.coherence ?? 30} />
        </div>
      </div>

      <div className="max-w-2xl space-y-3">
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-balance text-2xl font-medium tracking-tight text-instrument-white sm:text-3xl"
        >
          It learns your calls, and makes them when you are away.
        </motion.h1>
        <div className="h-5">
          <motion.p key={line} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="etch text-[10px] text-signal-cyan">
            {BOOT_LINES[line]}
          </motion.p>
        </div>
      </div>

      <div className="w-full max-w-sm">
        {!keyArmed ? (
          <EtchLabel className="mb-3 block text-instrument-steel">
            Connect your wallet at the Key Switch to arm the keyholder, then pull the lever.
          </EtchLabel>
        ) : null}
        <div className="brushed machined p-4">
          <TeachLever onPull={firstPull} label="Pull the lever to begin" />
        </div>
      </div>
    </div>
  );
}
