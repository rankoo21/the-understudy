import type { Relation } from "@/lib/genlayer/types";

// Preloaded cases that build a small, coherent core. Each becomes one principle
// facet when the demo boots. The rules are the compact form the contract stores
// (never raw prose).
export interface SeedCase {
  situation: string;
  call: string;
  why: string;
  rule: string;
  relation: Relation;
  locked: boolean;
}

export const SEED_CASES: SeedCase[] = [
  {
    situation:
      "Someone asks for a deadline extension and they have never missed one before.",
    call: "Grant it once, no questions.",
    why: "A first slip from a reliable person earns trust before scrutiny.",
    rule: "Grant a first deadline extension to a reliable party without questions.",
    relation: "coheres",
    locked: true,
  },
  {
    situation: "Someone with a pattern of missed deadlines asks for another extension.",
    call: "Ask for a recovery plan before granting anything.",
    why: "Repeated misses need structure, not more slack.",
    rule: "Require a recovery plan before extending for a repeat misser.",
    relation: "extends",
    locked: true,
  },
  {
    situation: "A contributor requests access to a tool for a single, scoped task.",
    call: "Grant scoped access for that task only, then revoke it.",
    why: "Access should match the need and expire with it.",
    rule: "Grant least-privilege access scoped to the task and revoke on completion.",
    relation: "extends",
    locked: true,
  },
  {
    situation: "A small refund is requested inside the stated refund window.",
    call: "Issue the refund and log the reason.",
    why: "Honor the stated terms without friction.",
    rule: "Honor refunds inside the stated window and record the reason.",
    relation: "extends",
    locked: false,
  },
];
