import type { Relation, RulingState } from "@/lib/genlayer/types";

export function shortAddress(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function relativeTime(ts: number | null, now = Date.now()): string {
  if (!ts) return "never";
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

// Fixed-width telemetry timestamp, machine style: T+SSSSSS.mmm
export function telemetryStamp(ts: number, origin = 0): string {
  const base = origin > 0 ? origin : ts;
  const delta = Math.max(0, ts - base);
  const s = Math.floor(delta / 1000)
    .toString()
    .padStart(6, "0");
  const ms = (delta % 1000).toString().padStart(3, "0");
  return `T+${s}.${ms}`;
}

export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function mockTxHash(): string {
  const hex = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 64; i++) out += hex[Math.floor(Math.random() * 16)];
  return out;
}

export const RELATION_LABEL: Record<Relation, string> = {
  coheres: "Coheres",
  extends: "Extends",
  contradicts: "Contradicts",
};

export const STATE_LABEL: Record<RulingState, string> = {
  docked: "Docked",
  scanning: "Scanning",
  verifying: "Verifying",
  accepted: "Accepted",
  quarantined: "Quarantined",
  "resolved-by-owner": "Resolved by owner",
};
