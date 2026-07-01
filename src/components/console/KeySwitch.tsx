"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useConsoleStore } from "@/store/useConsoleStore";
import { EtchLabel } from "@/components/ui/EtchLabel";

// The Key Switch: the wallet object and the only identity path. Before
// connection it sits in OFF with the etched label "Insert key." Clicking it
// connects a browser wallet (MetaMask with the GenLayer Snap). After connection
// the key turns to ARMED, a cyan indicator lights, and the shortened wallet
// address shows on hover. Not a rectangular connect button.
export function KeySwitch() {
  const reduce = useReducedMotion();
  const armed = useConsoleStore((s) => s.keyArmed);
  const label = useConsoleStore((s) => s.keyLabel);
  const insertKey = useConsoleStore((s) => s.insertKey);
  const removeKey = useConsoleStore((s) => s.removeKey);
  const [hover, setHover] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <EtchLabel>{armed ? "Armed" : "Key switch"}</EtchLabel>
      <button
        type="button"
        onClick={() => (armed ? removeKey() : insertKey())}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={armed ? `Key armed, ${label}. Click to remove.` : "Insert key to connect your wallet"}
        className="relative flex h-20 w-20 items-center justify-center rounded-full brushed machined"
      >
        {/* keyhole bezel */}
        <div className="relative h-12 w-12 rounded-full machined-inset bg-console-black">
          {/* the key barrel turns from OFF (vertical) to ARMED (turned) */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-8 w-1.5 -translate-x-1/2 -translate-y-1/2 origin-center"
            style={{ backgroundColor: armed ? "#38E1D6" : "#8A929A" }}
            animate={{ rotate: armed ? 90 : 0 }}
            transition={reduce ? { duration: 0 } : { type: "tween", duration: 0.25, ease: [0.6, 0, 0.4, 1] }}
          />
          {/* status LED */}
          <span
            className={`absolute -right-1 -top-1 inline-block h-2 w-2 rounded-full ${
              armed ? "led-cyan" : "bg-instrument-label/40"
            }`}
          />
        </div>
        {/* OFF / ARMED engraved marks */}
        <span className="etch absolute bottom-1 left-2 text-[7px] text-instrument-steel">off</span>
        <span className={`etch absolute right-2 top-1 text-[7px] ${armed ? "text-cyan" : "text-instrument-steel"}`}>
          armed
        </span>
      </button>
      <EtchLabel className={armed ? "text-signal-cyan" : "text-instrument-steel"}>
        {armed && hover ? label : armed ? "Keyholder" : "Insert key"}
      </EtchLabel>
    </div>
  );
}
