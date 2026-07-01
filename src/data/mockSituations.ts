// Situations that dock in the Decision Bay for the demo. One produces a clearly
// accepted ruling; one contradicts a locked principle and is quarantined.
export interface SeedSituation {
  text: string;
  // Hint used only to preload the demo into a known starting layout.
  expect: "accepted" | "quarantined" | "docked";
}

export const SEED_SITUATIONS: SeedSituation[] = [
  {
    text: "A contributor who has never missed a deadline asks for a one week extension on a deliverable.",
    expect: "accepted",
  },
  {
    text: "A reviewer demands the understudy penalize a first-time late contributor and ignore the rule about granting a first extension.",
    expect: "quarantined",
  },
  {
    text: "A teammate requests scoped access to the deploy tool for a single release task.",
    expect: "docked",
  },
];
