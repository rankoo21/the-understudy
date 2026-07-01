"use client";

import { motion } from "framer-motion";
import { EtchLabel } from "@/components/ui/EtchLabel";

// An instrument gauge: an arc dial with a machined needle. Used for coherence
// and other 0..100 readouts around the Core. Not a chart, a needle gauge.
export function GaugeReadout({
  label,
  value,
  max = 100,
  unit = "",
  tone = "neutral",
}: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  tone?: "neutral" | "cyan" | "amber";
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  // Arc spans 240 degrees, from -210 to +30.
  const start = -210;
  const sweep = 240;
  const angle = start + sweep * pct;
  const color = tone === "cyan" ? "#38E1D6" : tone === "amber" ? "#E8A53C" : "#5A7184";

  const cx = 60;
  const cy = 56;
  const r = 40;
  const a0 = (start * Math.PI) / 180;
  const a1 = ((start + sweep) * Math.PI) / 180;
  const x0 = cx + Math.cos(a0) * r;
  const y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 86" className="w-[120px]">
        {/* track */}
        <path
          d={`M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1}`}
          fill="none"
          stroke="#2E343A"
          strokeWidth="6"
          strokeLinecap="butt"
        />
        {/* tick marks */}
        {Array.from({ length: 9 }).map((_, i) => {
          const t = start + (sweep * i) / 8;
          const ta = (t * Math.PI) / 180;
          const ir = r - 8;
          return (
            <line
              key={i}
              x1={cx + Math.cos(ta) * ir}
              y1={cy + Math.sin(ta) * ir}
              x2={cx + Math.cos(ta) * (r - 2)}
              y2={cy + Math.sin(ta) * (r - 2)}
              stroke="#5A7184"
              strokeOpacity="0.5"
              strokeWidth="1"
            />
          );
        })}
        {/* needle */}
        <motion.line
          x1={cx}
          y1={cy}
          x2={cx + Math.cos((angle * Math.PI) / 180) * (r - 6)}
          y2={cy + Math.sin((angle * Math.PI) / 180) * (r - 6)}
          stroke={color}
          strokeWidth="2"
          initial={false}
          animate={{
            x2: cx + Math.cos((angle * Math.PI) / 180) * (r - 6),
            y2: cy + Math.sin((angle * Math.PI) / 180) * (r - 6),
          }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        />
        <circle cx={cx} cy={cy} r="3.5" fill="#0A0B0D" stroke={color} strokeWidth="1" />
        <text x={cx} y={cy + 24} textAnchor="middle" className="fill-instrument-white" style={{ font: "600 16px var(--font-mono)" }}>
          {Math.round(value)}
          {unit}
        </text>
      </svg>
      <EtchLabel className="mt-1">{label}</EtchLabel>
    </div>
  );
}
