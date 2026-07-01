"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Ruling, Situation } from "@/lib/genlayer/types";
import { EtchLabel } from "@/components/ui/EtchLabel";
import { STATE_LABEL } from "@/utils/format";

// A machined cartridge that slides into the Decision Bay. On hover an engraved
// plate reveals the situation, the proposed ruling, the principles used, and
// the verification result. Per-cartridge controls are small machined switches.

function stateTone(state: Situation["state"]): "cyan" | "amber" | "neutral" {
  if (state === "accepted") return "cyan";
  if (state === "quarantined") return "amber";
  return "neutral";
}

export function SituationCartridge({
  situation,
  ruling,
  scanning,
  onRule,
  onStepIn,
  keyArmed,
}: {
  situation: Situation;
  ruling?: Ruling;
  scanning: boolean;
  onRule: () => void;
  onStepIn: () => void;
  keyArmed: boolean;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const tone = stateTone(situation.state);
  const edge =
    tone === "cyan" ? "glow-cyan" : tone === "amber" ? "glow-amber" : "border-instrument-label/25";

  return (
    <motion.div
      layout
      initial={reduce ? false : { x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className={`relative overflow-hidden brushed machined ${edge}`}
    >
      {/* docking rail notch */}
      <div className="absolute left-0 top-0 h-full w-1.5 bg-console-black/80" />

      {scanning ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          aria-hidden="true"
        >
          <motion.div
            className="absolute left-0 h-0.5 w-full bg-signal-cyan/70"
            initial={{ top: "0%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
          />
        </motion.div>
      ) : null}

      <div className="flex items-start justify-between gap-3 px-4 py-3 pl-5">
        <div className="min-w-0 flex-1">
          <EtchLabel className="text-instrument-steel">{situation.id}</EtchLabel>
          <p className="mt-1 line-clamp-2 text-sm text-instrument-white">{situation.text}</p>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`etch text-[10px] ${
              tone === "cyan" ? "text-cyan" : tone === "amber" ? "text-amber" : "text-instrument-steel"
            }`}
          >
            {scanning ? "Scanning" : STATE_LABEL[situation.state]}
          </span>
          {/* state is also conveyed by a labelled marker, not color alone */}
          <div className="mt-1 flex justify-end gap-1">
            <span
              className={`inline-block h-1.5 w-1.5 ${
                tone === "cyan" ? "led-cyan" : tone === "amber" ? "led-amber" : "bg-instrument-label/40"
              }`}
            />
          </div>
        </div>
      </div>

      {/* control rail: small machined switches */}
      <div className="flex flex-wrap gap-2 border-t border-instrument-label/15 px-5 py-2">
        <CartridgeSwitch onClick={() => setOpen((v) => !v)} active={open}>
          Read the situation
        </CartridgeSwitch>
        {situation.state === "docked" ? (
          <CartridgeSwitch onClick={onRule} tone="cyan">
            Run the ruling
          </CartridgeSwitch>
        ) : null}
        {situation.state === "quarantined" ? (
          <CartridgeSwitch onClick={onStepIn} tone="amber" disabled={!keyArmed}>
            Step in
          </CartridgeSwitch>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-2 border-t border-instrument-label/15 bg-console-black/40 px-5 py-3 scanlines relative">
          <Plate label="The situation" value={situation.text} />
          {ruling ? (
            <>
              <Plate label="The proposed ruling" value={ruling.decision} />
              <Plate
                label="Principles it drew on"
                value={ruling.principlesUsed.length ? ruling.principlesUsed.join("  /  ") : "none recorded"}
              />
              <Plate
                label="Verification result"
                value={ruling.consistent ? "Consistent with your principles" : "Contradicts a locked principle"}
                tone={ruling.consistent ? "cyan" : "amber"}
              />
            </>
          ) : (
            <EtchLabel className="text-instrument-steel">No ruling formed yet.</EtchLabel>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}

function CartridgeSwitch({
  children,
  onClick,
  tone = "neutral",
  active = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "neutral" | "cyan" | "amber";
  active?: boolean;
  disabled?: boolean;
}) {
  const toneClass =
    tone === "cyan"
      ? "text-signal-cyan border-signal-cyan/50"
      : tone === "amber"
        ? "text-signal-amber border-signal-amber/50"
        : "text-instrument-label border-instrument-label/30";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`etch text-[9px] border px-2 py-1 transition-colors duration-100 hover:bg-instrument-white/5 disabled:opacity-40 disabled:cursor-not-allowed ${toneClass} ${
        active ? "bg-instrument-white/5" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Plate({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "cyan" | "amber";
}) {
  return (
    <div>
      <EtchLabel className="block text-instrument-steel">{label}</EtchLabel>
      <p
        className={`text-sm ${
          tone === "cyan" ? "text-cyan" : tone === "amber" ? "text-amber" : "text-instrument-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
