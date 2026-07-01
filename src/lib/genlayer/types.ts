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
  createdAt: number;
  mockTxHash: string;
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
}
