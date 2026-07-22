export type Verdict = "ready" | "blocked" | "needs_review";
export type Confidence = "low" | "medium" | "high";
export type CheckStatus = "passed" | "failed" | "unclear";
export type CheckName = "criteria" | "build" | "tests" | "deployment";

export interface GateCheck {
  status: CheckStatus;
  detail: string;
  snippet: string;
}

export interface ReleaseGatePayload {
  release_criteria: string;
  build_evidence: string;
  test_evidence: string;
  deployment_evidence: string;
  known_risks?: string;
}

export interface ReleaseGateResult {
  sender: string;
  request_id: string;
  created_at: number;
  verdict: Verdict;
  confidence: Confidence;
  checks: Record<CheckName, GateCheck>;
  blockers: string[];
  blocker_categories: string[];
  explanation: string;
  evidence_excerpts: string[];
  transaction_hash?: string;
}

export interface ReleaseGateSummary {
  total: number;
  ready: number;
  blocked: number;
  needs_review: number;
}

export type TransactionPhase =
  | "idle"
  | "wallet"
  | "signing"
  | "submitted"
  | "consensus"
  | "accepted"
  | "verifying"
  | "complete"
  | "failed";

export interface SubmissionUpdate {
  phase: TransactionPhase;
  message: string;
  requestId?: string;
  hash?: string;
  explorerUrl?: string;
  recovering?: boolean;
  result?: ReleaseGateResult;
}

export type ProgressHandler = (update: SubmissionUpdate) => void;

export interface PendingGateTransaction {
  app: "ReleaseGate";
  request: string;
  hash: string;
  account: string;
  timestamp: number;
  payload: ReleaseGatePayload;
}

export interface ReleaseGateAdapter {
  readonly mode: "mock" | "contract";
  readonly network: string;
  getIdentityAddress(): string | null;
  hasInjectedWallet(): boolean;
  connectWallet(onProgress?: ProgressHandler): Promise<string>;
  disconnectWallet(): void;
  submitCheck(requestId: string, payload: ReleaseGatePayload, onProgress: ProgressHandler): Promise<ReleaseGateResult>;
  recoverPending(onProgress: ProgressHandler): Promise<ReleaseGateResult | null>;
  getPendingTransaction(): PendingGateTransaction | null;
  clearPendingTransaction(): void;
  getResult(requestId: string): Promise<ReleaseGateResult | null>;
  getResults(offset?: number, limit?: number): Promise<ReleaseGateResult[]>;
  getSummary(): Promise<ReleaseGateSummary>;
  getExplorerUrl(hash: string): string | null;
}
