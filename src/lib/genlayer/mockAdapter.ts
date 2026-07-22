import type {
  CheckName,
  CheckStatus,
  GateCheck,
  PendingGateTransaction,
  ProgressHandler,
  ReleaseGateAdapter,
  ReleaseGatePayload,
  ReleaseGateResult,
  ReleaseGateSummary,
  Verdict,
} from "./types";

const PENDING_STORAGE = "releasegate.pending.v1";
const RECORD_STORAGE = "releasegate.mock.records.v1";
const MOCK_WALLET = "0x4B7ac1F0d2E9c5A8b3D61f0728Ee4C93a5170fD2";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashFor(value: string): string {
  let seed = 2166136261;
  for (const char of value) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const part = (seed >>> 0).toString(16).padStart(8, "0");
  return `0x${part.repeat(8)}`;
}

function loadRecords(): ReleaseGateResult[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECORD_STORAGE) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records: ReleaseGateResult[]): void {
  if (typeof window !== "undefined") localStorage.setItem(RECORD_STORAGE, JSON.stringify(records));
}

function snippetOf(source: string): string {
  return source.trim().split("\n")[0]?.slice(0, 160) ?? "";
}

function classify(payload: ReleaseGatePayload, requestId: string, timestamp: number): ReleaseGateResult {
  const build = payload.build_evidence.toLowerCase();
  const tests = payload.test_evidence.toLowerCase();
  const deployment = payload.deployment_evidence.toLowerCase();
  const risks = (payload.known_risks ?? "").toLowerCase();

  const statusFor = (text: string): CheckStatus => {
    if (/fail|error|broken|red|blocked|missing/.test(text)) return "failed";
    if (/unknown|unclear|pending|tbd|partial|not run|incomplete/.test(text)) return "unclear";
    return "passed";
  };

  const checks: Record<CheckName, GateCheck> = {
    criteria: { status: statusFor(payload.release_criteria.toLowerCase()), detail: "Release criteria coverage.", snippet: snippetOf(payload.release_criteria) },
    build: { status: statusFor(build), detail: "Build evidence review.", snippet: snippetOf(payload.build_evidence) },
    tests: { status: statusFor(tests), detail: "Test evidence review.", snippet: snippetOf(payload.test_evidence) },
    deployment: { status: statusFor(deployment), detail: "Deployment readiness review.", snippet: snippetOf(payload.deployment_evidence) },
  };

  const names: CheckName[] = ["criteria", "build", "tests", "deployment"];
  const anyFailed = names.some((name) => checks[name].status === "failed");
  const anyUnclear = names.some((name) => checks[name].status === "unclear");
  const hasRisk = Boolean(risks.trim());

  let verdict: Verdict = "ready";
  const blockers: string[] = [];
  const blocker_categories: string[] = [];
  if (anyFailed) {
    verdict = "blocked";
    blockers.push("One or more release checks failed in the submitted evidence.");
    blocker_categories.push("test_failure");
  } else if (anyUnclear) {
    verdict = "needs_review";
    blockers.push("Some evidence was incomplete or unclear.");
    blocker_categories.push("insufficient_evidence");
  } else if (hasRisk) {
    verdict = "needs_review";
    blockers.push("A known risk was declared and needs sign-off.");
    blocker_categories.push("known_risk");
  }

  const confidence = anyFailed || (!anyUnclear && !hasRisk) ? "high" : "medium";
  const evidence_excerpts = names.map((name) => checks[name].snippet).filter(Boolean);

  return {
    sender: MOCK_WALLET,
    request_id: requestId,
    created_at: timestamp,
    verdict,
    confidence,
    checks,
    blockers,
    blocker_categories,
    explanation: verdict === "ready"
      ? "All release checks pass in the submitted evidence with no declared blocking risks."
      : verdict === "blocked"
        ? "At least one release check failed, so the release is blocked."
        : "The release needs review before it can proceed.",
    evidence_excerpts,
  };
}

export class MockAdapter implements ReleaseGateAdapter {
  readonly mode = "mock" as const;
  readonly network = "Local simulator";
  private connected = false;

  getIdentityAddress(): string | null {
    return this.connected ? MOCK_WALLET : null;
  }

  hasInjectedWallet(): boolean {
    return true;
  }

  async connectWallet(onProgress?: ProgressHandler): Promise<string> {
    onProgress?.({ phase: "wallet", message: "Opening the local simulator wallet." });
    await wait(180);
    this.connected = true;
    return MOCK_WALLET;
  }

  disconnectWallet(): void {
    this.connected = false;
  }

  getPendingTransaction(): PendingGateTransaction | null {
    if (typeof window === "undefined") return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(PENDING_STORAGE) ?? "null") as PendingGateTransaction | null;
      return parsed?.app === "ReleaseGate" && parsed.request && parsed.hash && parsed.account && parsed.timestamp && parsed.payload ? parsed : null;
    } catch {
      return null;
    }
  }

  clearPendingTransaction(): void {
    if (typeof window !== "undefined") localStorage.removeItem(PENDING_STORAGE);
  }

  getExplorerUrl(): string | null {
    return null;
  }

  private async finish(pending: PendingGateTransaction, onProgress: ProgressHandler, recovering = false): Promise<ReleaseGateResult> {
    onProgress({ phase: "consensus", message: recovering ? "Recovered the saved simulator hash." : "Simulating validator consensus.", requestId: pending.request, hash: pending.hash, recovering });
    await wait(650);
    onProgress({ phase: "accepted", message: "Consensus accepted. Confirming persisted state.", requestId: pending.request, hash: pending.hash, recovering });
    const existing = await this.getResult(pending.request);
    const result = existing ?? classify(pending.payload, pending.request, pending.timestamp);
    if (!existing) saveRecords([result, ...loadRecords()]);
    await wait(260);
    const complete = { ...result, transaction_hash: pending.hash };
    this.clearPendingTransaction();
    onProgress({ phase: "complete", message: "Canonical release verdict confirmed in simulator state.", requestId: pending.request, hash: pending.hash, recovering, result: complete });
    return complete;
  }

  async submitCheck(requestId: string, payload: ReleaseGatePayload, onProgress: ProgressHandler): Promise<ReleaseGateResult> {
    const existing = this.getPendingTransaction();
    if (existing) return this.finish(existing, onProgress, true);
    if (!this.connected) await this.connectWallet(onProgress);
    onProgress({ phase: "signing", message: "Authorizing one simulator transaction.", requestId });
    await wait(180);
    const timestamp = Date.now();
    const hash = hashFor(`${requestId}:${timestamp}`);
    const pending: PendingGateTransaction = { app: "ReleaseGate", request: requestId, hash, account: MOCK_WALLET, timestamp, payload };
    if (typeof window !== "undefined") localStorage.setItem(PENDING_STORAGE, JSON.stringify(pending));
    onProgress({ phase: "submitted", message: "Transaction submitted. Recovery details were saved immediately.", requestId, hash });
    return this.finish(pending, onProgress);
  }

  async recoverPending(onProgress: ProgressHandler): Promise<ReleaseGateResult | null> {
    const pending = this.getPendingTransaction();
    if (!pending) return null;
    this.connected = true;
    onProgress({ phase: "submitted", message: "Recovered the existing simulator hash. No new write was sent.", requestId: pending.request, hash: pending.hash, recovering: true });
    return this.finish(pending, onProgress, true);
  }

  async getResult(requestId: string): Promise<ReleaseGateResult | null> {
    await wait(80);
    return loadRecords().find((record) => record.request_id === requestId && record.sender.toLowerCase() === MOCK_WALLET.toLowerCase()) ?? null;
  }

  async getResults(offset = 0, limit = 20): Promise<ReleaseGateResult[]> {
    await wait(80);
    return loadRecords().slice(offset, offset + limit);
  }

  async getSummary(): Promise<ReleaseGateSummary> {
    const records = loadRecords();
    return {
      total: records.length,
      ready: records.filter((record) => record.verdict === "ready").length,
      blocked: records.filter((record) => record.verdict === "blocked").length,
      needs_review: records.filter((record) => record.verdict === "needs_review").length,
    };
  }
}
