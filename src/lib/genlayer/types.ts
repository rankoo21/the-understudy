// Shared data models for The Understudy.
// These types are the contract between the UI, the store, and any GenLayer
// adapter (mock today, real on-chain tomorrow). Keep them stable.

// Relation of a taught case to the existing principle set.
export type Relation = "coheres" | "extends" | "contradicts";

// Situation / ruling state machine, mirrored in the contract.
export type RulingState =
  | "docked"
  | "scanning"
  | "verifying"
  | "accepted"
  | "quarantined"
  | "resolved-by-owner";

export interface Principle {
  id: string;
  rule: string;
  // Canonical normalized form of the rule that validators agreed on. The
  // stored substance is consensus-backed, not the leader's phrasing alone.
  canonical?: string;
  locked: boolean;
  relation: Relation;
  sourceCaseId: string;
  createdAt: number;
}

export interface Case {
  id: string;
  situation: string;
  call: string;
  why: string;
  relation: Relation;
  createdAt: number;
}

export interface Situation {
  id: string;
  text: string;
  state: RulingState;
  createdAt: number;
}

export interface Ruling {
  id: string;
  situationId: string;
  decision: string;
  principlesUsed: string[];
  consistent: boolean;
  state: RulingState;
  // Concrete downstream action an accepted ruling authorizes. Empty for
  // quarantined rulings (nothing is authorized until the owner steps in).
  action: string;
  // Id of the queued downstream Action record for an accepted ruling, or empty.
  actionId?: string;
  createdAt: number;
  mockTxHash: string;
}

// A concrete downstream effect queued by an accepted, consensus-verified
// ruling. Recording it makes an accepted ruling DO something canonical on-chain
// (a real, inspectable effect the owner's runtime can carry out) rather than
// only carrying a "consistent" label.
export interface ActionRecord {
  id: string;
  rulingId: string;
  situationId: string;
  // Imperative effect text, its canonical substance, and the decision text that
  // authorized it. All consensus-backed via the ruling that produced them.
  effect: string;
  canonical: string;
  authorizedBy: string;
  status: string;
  createdAt: number;
}

// The grown logic core: principles, locked principles, coherence, tensions.
export interface Core {
  owner: string;
  facets: number;
  coherence: number; // 0..100
  principles: Principle[];
  lockedPrinciples: Principle[];
  tensions: string[];
}

export interface Summary {
  owner: string;
  booted: boolean;
  createdAt: number;
  coherence: number;
  principles: number;
  situations: number;
  rulings: number;
  actions: number;
  tensions: number;
}

// Result of teaching a case.
export interface TeachResult {
  caseId: string;
  relation: Relation;
  rule: string;
  locked: boolean;
  grewFacet: boolean;
  principleId: string | null;
  tension: string;
  note: string;
}

// Result of a ruling.
export interface RuleResult {
  rulingId: string;
  situationId: string;
  decision: string;
  consistent: boolean;
  state: RulingState;
  principlesUsed: string[];
  // Concrete downstream action an accepted ruling authorizes (empty when
  // quarantined).
  action: string;
  // Id of the queued downstream Action record for an accepted ruling, or empty.
  actionId?: string;
  note: string;
}

// Result of a step-in.
export interface StepInResult {
  situationId: string;
  rulingId: string | null;
  state: RulingState;
  decision: string;
  principleId: string | null;
  note: string;
}

export interface TeachInput {
  situation: string;
  call: string;
  why: string;
}

export interface StepInInput {
  situationId: string;
  decision: string;
  clarifyingRule: string;
  lock: boolean;
}

// The adapter interface. mockAdapter and contractAdapter both implement this so
// the UI never knows or cares which one is live.
export interface UnderstudyAdapter {
  readonly mode: "mock" | "contract";
  // Address of the active keyholder identity. In contract mode this is the
  // connected browser wallet, or null when no wallet is connected; in mock
  // mode a synthetic address.
  getIdentityAddress(): string | null;
  // Optional browser-wallet support (contract mode only).
  hasInjectedWallet?(): boolean;
  connectWallet?(): Promise<string>;
  disconnectWallet?(): void;
  isUsingWallet?(): boolean;

  boot(): Promise<Summary>;
  teach(input: TeachInput): Promise<TeachResult>;
  submitSituation(text: string): Promise<Situation>;
  rule(situationId: string): Promise<RuleResult>;
  stepIn(input: StepInInput): Promise<StepInResult>;

  getSummary(): Promise<Summary>;
  getCore(): Promise<Core>;
  getSituations(): Promise<Situation[]>;
  getDecisions(): Promise<Ruling[]>;
  getQuarantine(): Promise<Ruling[]>;
  getActions(): Promise<ActionRecord[]>;
}
