"use client";

import { TextareaHTMLAttributes, InputHTMLAttributes } from "react";
import { EtchLabel } from "./EtchLabel";

// A case-slot input: an inset machined groove with an engraved label above it.
export function SlotInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  id,
  ...props
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <label htmlFor={id} className="block">
      <EtchLabel className="mb-1 block">{label}</EtchLabel>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full machined-inset bg-console-black/70 px-3 py-2 text-sm text-instrument-white placeholder:text-instrument-label/50 focus:outline-none"
        {...props}
      />
      {hint ? <span className="etch mt-1 block text-[9px] text-instrument-steel">{hint}</span> : null}
    </label>
  );
}

export function SlotTextArea({
  label,
  hint,
  value,
  onChange,
  placeholder,
  id,
  rows = 3,
  ...props
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
  rows?: number;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value" | "id" | "rows">) {
  return (
    <label htmlFor={id} className="block">
      <EtchLabel className="mb-1 block">{label}</EtchLabel>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none machined-inset bg-console-black/70 px-3 py-2 text-sm leading-relaxed text-instrument-white placeholder:text-instrument-label/50 focus:outline-none"
        {...props}
      />
      {hint ? <span className="etch mt-1 block text-[9px] text-instrument-steel">{hint}</span> : null}
    </label>
  );
}
