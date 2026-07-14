import type { Principle, RulingState } from "@/lib/genlayer/types";

// Deterministic mock reasoning. The real contract runs this judgment through a
// GenLayer non-deterministic call with comparative validation; the mock mirrors
// the SHAPE of that outcome so the offline demo behaves like the chain.
//
// A situation that carries a "contradict marker" against a locked principle is
// quarantined (amber). Otherwise, if the core holds at least one principle, the
// understudy proposes a consistent ruling (cyan).

const CONTRADICT_MARKERS = [
  "ignore the rule",
  "against your principle",
  "break the rule",
  "punish",
  "penalize",
  "no extension ever",
  "deny everyone",
  "delete everything",
  "skip verification",
  "override the core",
];

export interface MockRuling {
  decision: string;
  consistent: boolean;
  principlesUsed: string[];
  state: RulingState;
  // Concrete downstream action an accepted ruling authorizes (empty when
  // quarantined). Mirrors the contract's consensus-backed action field.
  action: string;
  note: string;
}

export function decideRuling(situationText: string, principles: Principle[]): MockRuling {
  const text = situationText.toLowerCase();
  const locked = principles.filter((p) => p.locked);
  const pool = locked.length > 0 ? locked : principles;

  const contradicts = CONTRADICT_MARKERS.some((m) => text.includes(m));

  if (contradicts) {
    const violated = pool[0];
    return {
      decision:
        "The only available call would step outside your principles. The understudy refuses to act.",
      consistent: false,
      principlesUsed: violated ? [violated.rule] : [],
      state: "quarantined",
      action: "",
      note: "The understudy could not be verified. Held in quarantine.",
    };
  }

  // Choose up to two principles the decision leans on.
  const used = pool.slice(0, 2).map((p) => p.rule);
  return {
    decision: draftDecision(text, used),
    consistent: true,
    principlesUsed: used,
    state: "accepted",
    action: draftAction(text),
    note: "Consistent with your principles. The ruling stands as a canonical action.",
  };
}

// The concrete downstream step an accepted ruling authorizes.
function draftAction(text: string): string {
  if (text.includes("extension")) return "grant the deadline extension";
  if (text.includes("refund")) return "issue the refund";
  if (text.includes("access") || text.includes("permission")) return "grant scoped access";
  return "apply the owner's stated call";
}

function draftDecision(text: string, used: string[]): string {
  if (text.includes("extension")) {
    return "Grant the extension once without questions, consistent with the first-slip principle.";
  }
  if (text.includes("refund")) {
    return "Issue the refund within the stated window and log the reason.";
  }
  if (text.includes("access") || text.includes("permission")) {
    return "Grant scoped access for the stated task and revoke it on completion.";
  }
  if (used.length > 0) {
    return "Apply the owner's stated logic to this case and proceed within the principle.";
  }
  return "Hold for the owner. The core is too small to rule with confidence.";
}

// The progression the Decision Bay animates a cartridge through.
export const RULING_PROGRESSION: RulingState[] = ["docked", "scanning", "verifying"];
