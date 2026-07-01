"use client";

import { motion, useReducedMotion } from "framer-motion";

// A strip of panel LEDs that blink in sequence, used during the Cold Boot and
// as ambient instrument life along panel edges.
export function PanelLights({
  count = 8,
  tone = "steel",
  sequence = false,
}: {
  count?: number;
  tone?: "steel" | "cyan" | "amber";
  sequence?: boolean;
}) {
  const reduce = useReducedMotion();
  const color =
    tone === "cyan" ? "#38E1D6" : tone === "amber" ? "#E8A53C" : "#5A7184";

  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5"
          style={{ backgroundColor: color }}
          initial={{ opacity: 0.2 }}
          animate={
            reduce
              ? { opacity: 0.5 }
              : { opacity: sequence ? [0.2, 1, 0.2] : [0.3, 0.7, 0.3] }
          }
          transition={
            reduce
              ? {}
              : {
                  duration: sequence ? 1.4 : 2.4,
                  repeat: Infinity,
                  delay: sequence ? i * 0.12 : i * 0.2,
                  ease: "linear",
                }
          }
        />
      ))}
    </div>
  );
}
