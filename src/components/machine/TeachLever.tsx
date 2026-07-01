"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EtchLabel } from "@/components/ui/EtchLabel";

// The large teach lever. A physical handle that thunks down when pulled. The
// CTA is the act itself, not a button labelled "Submit".
export function TeachLever({
  onPull,
  disabled = false,
  label = "Pull the teach lever",
}: {
  onPull: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const [pulled, setPulled] = useState(false);

  function handle() {
    if (disabled) return;
    setPulled(true);
    onPull();
    window.setTimeout(() => setPulled(false), 360);
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      aria-label={label}
      className="group flex w-full items-center gap-4 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {/* lever housing */}
      <div className="relative h-24 w-16 shrink-0 brushed machined-inset">
        {/* slot */}
        <div className="absolute left-1/2 top-3 h-16 w-1 -translate-x-1/2 bg-console-black" />
        {/* handle */}
        <motion.div
          className="absolute left-1/2 h-7 w-7 -translate-x-1/2 rounded-sm brushed machined"
          animate={
            reduce
              ? { top: pulled ? 58 : 10 }
              : { top: pulled ? 58 : 10 }
          }
          transition={{ duration: 0.18, ease: [0.6, 0, 0.4, 1] }}
        >
          <div className={`absolute inset-0 m-auto h-2 w-2 rounded-full ${pulled ? "led-cyan" : ""}`} />
        </motion.div>
      </div>
      <div className="text-left">
        <EtchLabel className="block text-signal-cyan">{label}</EtchLabel>
        <span className="etch mt-1 block text-[9px] text-instrument-steel">
          The lever thunks. A coherent case grows a facet.
        </span>
      </div>
    </button>
  );
}
