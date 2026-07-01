"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useConsoleStore } from "@/store/useConsoleStore";

// The Status Strip: a thin instrument strip along the bottom edge with rolling
// mono telemetry digits and an engraved plate. Not a footer. Digits tick slowly
// at idle; the strip pulses cyan briefly on an accepted ruling and amber on a
// quarantine.

const PLATE = "GenLayer . The Understudy . Bounded by consensus . Testnet";

function randomDigits(seed: number): string {
  let out = "";
  let x = seed;
  for (let i = 0; i < 64; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out += (x % 16).toString(16).toUpperCase();
    if (i % 8 === 7) out += " ";
  }
  return out.trim();
}

export function StatusStrip() {
  const reduce = useReducedMotion();
  const pulse = useConsoleStore((s) => s.pulse);
  const [tick, setTick] = useState(0);
  const [flash, setFlash] = useState<"cyan" | "amber" | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 1400);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pulse) return;
    setFlash(pulse.tone);
    const t = window.setTimeout(() => setFlash(null), 900);
    return () => window.clearTimeout(t);
  }, [pulse]);

  const digits = useMemo(() => randomDigits(tick + 7), [tick]);
  const flashClass =
    flash === "cyan" ? "border-signal-cyan/60 glow-cyan" : flash === "amber" ? "border-signal-amber/60 glow-amber" : "border-instrument-label/20";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 bottom-0 z-30 flex h-9 items-center gap-4 border-t bg-console-black/95 px-4 backdrop-blur ${flashClass}`}
    >
      <span className="etch shrink-0 text-[9px] text-instrument-white">{PLATE}</span>
      <div className="relative h-full flex-1 overflow-hidden">
        <motion.div
          key={tick}
          className="absolute inset-y-0 flex items-center whitespace-nowrap font-mono text-[10px] tracking-[0.3em] text-instrument-steel"
          initial={reduce ? { x: 0 } : { x: 40, opacity: 0.4 }}
          animate={{ x: 0, opacity: 0.7 }}
          transition={{ duration: 0.6, ease: "linear" }}
        >
          {digits} :: {digits}
        </motion.div>
      </div>
      <span
        className={`etch shrink-0 text-[9px] ${
          flash === "cyan" ? "text-cyan" : flash === "amber" ? "text-amber" : "text-instrument-steel"
        }`}
      >
        {flash === "cyan" ? "Accepted" : flash === "amber" ? "Quarantine" : "Idle"}
      </span>
    </div>
  );
}
