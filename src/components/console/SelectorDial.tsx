"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useConsoleStore, ZONE_ORDER, ZONE_GLYPH, type Zone } from "@/store/useConsoleStore";
import { EtchLabel } from "@/components/ui/EtchLabel";

// The Selector Dial: a machined rotary selector with hard detents. Turning it
// clicks between zone positions, each marked by an engraved glyph. The active
// zone is shown by the detent position and a lit indicator, not by tabs.
//
// Keyboard: ArrowLeft/ArrowRight step detents; Enter/Space confirm. The dial is
// a real radiogroup for assistive tech.

const GLYPHS: Record<Zone, JSX.Element> = {
  boot: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 4 V12" /> <circle cx="12" cy="14" r="6" />
    </svg>
  ),
  teach: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="6" y="4" width="4" height="12" /> <path d="M8 16 V20" /> <path d="M14 8 H20" /> <path d="M14 12 H20" />
    </svg>
  ),
  core: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <polygon points="12,3 20,8 17,18 7,18 4,8" /> <polygon points="12,8 15,11 13,16 11,16 9,11" />
    </svg>
  ),
  bay: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="7" width="18" height="10" /> <path d="M8 7 V17" /> <path d="M13 7 V17" />
    </svg>
  ),
  quarantine: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5" y="10" width="14" height="9" /> <path d="M8 10 V7 a4 4 0 0 1 8 0 V10" />
    </svg>
  ),
  telemetry: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 17 H7 L9 7 L12 19 L15 11 H21" />
    </svg>
  ),
};

export function SelectorDial() {
  const reduce = useReducedMotion();
  const zone = useConsoleStore((s) => s.zone);
  const setZone = useConsoleStore((s) => s.setZone);
  const bootEntered = useConsoleStore((s) => s.bootEntered);

  const activeIndex = ZONE_ORDER.indexOf(zone);
  const step = 360 / ZONE_ORDER.length;
  const rotation = -activeIndex * step;

  function move(delta: number) {
    const next = (activeIndex + delta + ZONE_ORDER.length) % ZONE_ORDER.length;
    setZone(ZONE_ORDER[next]);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <EtchLabel>Selector dial</EtchLabel>
      <div
        role="radiogroup"
        aria-label="Console zone selector"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          }
        }}
        className="relative h-36 w-36 rounded-full brushed machined"
      >
        {/* detent ring with engraved glyphs */}
        {ZONE_ORDER.map((z, i) => {
          const a = (i / ZONE_ORDER.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 56;
          const x = 72 + Math.cos(a) * radius;
          const y = 72 + Math.sin(a) * radius;
          const active = z === zone;
          const disabled = z === "boot" ? false : !bootEntered;
          return (
            <button
              key={z}
              role="radio"
              aria-checked={active}
              aria-label={ZONE_GLYPH[z]}
              disabled={disabled}
              onClick={() => setZone(z)}
              className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-100 ${
                active ? "text-signal-cyan glow-cyan" : "text-instrument-label hover:text-instrument-white"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              style={{ left: x, top: y }}
              title={ZONE_GLYPH[z]}
            >
              {GLYPHS[z]}
            </button>
          );
        })}

        {/* rotary indicator hand */}
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-12 origin-left"
          style={{ backgroundColor: "#38E1D6" }}
          animate={{ rotate: rotation }}
          transition={reduce ? { duration: 0 } : { type: "tween", duration: 0.22, ease: [0.6, 0, 0.4, 1] }}
        />
        {/* center machined knob */}
        <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full brushed machined-inset">
          <div className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full led-cyan" />
        </div>
        {/* faint idle LED ring */}
        <div className="pointer-events-none absolute inset-1 rounded-full border border-signal-cyan/10" />
      </div>
      <EtchLabel className="text-signal-cyan">{ZONE_GLYPH[zone]}</EtchLabel>
    </div>
  );
}
