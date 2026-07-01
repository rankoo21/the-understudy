"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "cyan" | "amber";

// A hard plastic machined control. Not a rounded SaaS button; a switch face with
// a beveled edge and a mechanical press.
export function MachineButton({
  children,
  tone = "neutral",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; tone?: Tone }) {
  const toneClass =
    tone === "cyan"
      ? "border-signal-cyan/60 text-signal-cyan hover:bg-signal-cyan/10"
      : tone === "amber"
        ? "border-signal-amber/60 text-signal-amber hover:bg-signal-amber/10"
        : "border-instrument-label/40 text-instrument-white hover:bg-instrument-white/5";

  return (
    <button
      {...props}
      className={`etch text-[11px] px-4 py-2 brushed machined transition-[transform,background-color] duration-100 ease-linear active:translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed ${toneClass} ${className}`}
    >
      {children}
    </button>
  );
}
