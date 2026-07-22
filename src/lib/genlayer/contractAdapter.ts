import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus, type TransactionHash } from "genlayer-js/types";
import type {
  PendingGateTransaction,
  ProgressHandler,
  ReleaseGateAdapter,
  ReleaseGatePayload,
  ReleaseGateResult,
  ReleaseGateSummary,
} from "./types";

type AnyClient = ReturnType<typeof createClient>;
type Hex = `0x${string}`;

const READ_KEY_STORAGE = "releasegate.readIdentity.v1";
const PENDING_STORAGE = "releasegate.pending.v1";
const STATE_RETRIES = 45;

export interface ContractAdapterConfig {
  contractAddress: string;
  network?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickChain(network = "studionet") {
  const name = network.toLowerCase();
  if (name === "localnet") return localnet;
  if (name.includes("bradbury")) return testnetBradbury;
  return studionet;
}

function sdkNetwork(network = "studionet"): "studionet" | "testnetBradbury" | "localnet" {
  const name = network.toLowerCase();
  if (name === "localnet") return "localnet";
  if (name.includes("bradbury")) return "testnetBradbury";
  return "studionet";
}

function plain(value: unknown): any {
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([key, item]) => [String(key), plain(item)]));
  }
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  return value;
}

function loadReadKey(): Hex {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(READ_KEY_STORAGE);
      if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) return stored as Hex;
      const key = generatePrivateKey();
      localStorage.setItem(READ_KEY_STORAGE, key);
      return key;
    } catch {
      return generatePrivateKey();
    }
  }
  return generatePrivateKey();
}

function payloadJson(payload: ReleaseGatePayload): string {
  return JSON.stringify({
    release_criteria: payload.release_criteria.trim(),
    build_evidence: payload.build_evidence.trim(),
    test_evidence: payload.test_evidence.trim(),
    deployment_evidence: payload.deployment_evidence.trim(),
    known_risks: (payload.known_risks ?? "").trim(),
  });
}

function validatePayload(payload: ReleaseGatePayload): void {
  if (!payload.release_criteria.trim()) throw new Error("Add the release criteria before submitting.");
  if (!payload.build_evidence.trim()) throw new Error("Add build evidence before submitting.");
  if (!payload.test_evidence.trim()) throw new Error("Add test evidence before submitting.");
  if (!payload.deployment_evidence.trim()) throw new Error("Add deployment evidence before submitting.");
}

export class ContractAdapter implements ReleaseGateAdapter {
  readonly mode = "contract" as const;
  readonly network: string;
  private readonly chain: ReturnType<typeof pickChain>;
  private readClient: AnyClient | null = null;
  private walletClient: AnyClient | null = null;
  private walletAddress: string | null = null;

  constructor(private readonly config: ContractAdapterConfig) {
    this.network = config.network ?? "studionet";
    this.chain = pickChain(this.network);
  }

  private get address(): Hex {
    return this.config.contractAddress as Hex;
  }

  private reader(): AnyClient {
    if (!this.readClient) {
      this.readClient = createClient({ chain: this.chain, account: createAccount(loadReadKey()) }) as AnyClient;
    }
    return this.readClient;
  }

  private async read<T>(functionName: string, args: unknown[] = []): Promise<T> {
    // Sender-scoped views must be read with the connected wallet client so the
    // contract sees the submitting address. Falls back to the read client for
    // public aggregate views (get_results, get_summary).
    const client = this.walletClient ?? this.reader();
    return plain(await client.readContract({
      address: this.address,
      functionName,
      args: args as any,
    })) as T;
  }

  getIdentityAddress(): string | null {
    return this.walletAddress;
  }

  hasInjectedWallet(): boolean {
    return typeof window !== "undefined" && Boolean((window as any).ethereum);
  }

  async connectWallet(onProgress?: ProgressHandler): Promise<string> {
    onProgress?.({ phase: "wallet", message: "Requesting wallet access" });
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("MetaMask with the GenLayer Snap is required for contract submissions.");
    }
    const ethereum = (window as any).ethereum;
    let address: string | undefined;
    try {
      const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
      address = accounts?.[0];
    } catch (error: any) {
      if (error?.code === 4001) throw new Error("Wallet connection was rejected.");
      throw new Error("Could not connect to the browser wallet.");
    }
    if (!address) throw new Error("The wallet returned no account.");

    const client = createClient({ chain: this.chain, account: address as Hex }) as AnyClient;
    await client.connect(sdkNetwork(this.network));
    this.walletClient = client;
    this.walletAddress = address;
    return address;
  }

  disconnectWallet(): void {
    this.walletClient = null;
    this.walletAddress = null;
  }

  getPendingTransaction(): PendingGateTransaction | null {
    if (typeof window === "undefined") return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(PENDING_STORAGE) ?? "null") as PendingGateTransaction | null;
      if (!parsed || parsed.app !== "ReleaseGate" || !parsed.request || !parsed.hash || !parsed.account || !parsed.timestamp || !parsed.payload) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  clearPendingTransaction(): void {
    if (typeof window !== "undefined") localStorage.removeItem(PENDING_STORAGE);
  }

  getExplorerUrl(hash: string): string | null {
    const name = this.network.toLowerCase();
    if (name === "localnet") return null;
    const base = name.includes("bradbury")
      ? "https://explorer-bradbury.genlayer.com"
      : "https://explorer.genlayer.com";
    return `${base}/tx/${hash}`;
  }

  private persist(pending: PendingGateTransaction): void {
    if (typeof window === "undefined") throw new Error("Pending transaction recovery requires browser storage.");
    localStorage.setItem(PENDING_STORAGE, JSON.stringify(pending));
  }

  private async finish(pending: PendingGateTransaction, onProgress: ProgressHandler, recovering = false): Promise<ReleaseGateResult> {
    const explorerUrl = this.getExplorerUrl(pending.hash) ?? undefined;
    onProgress({
      phase: "consensus",
      message: recovering ? "Recovered the saved transaction. Waiting for consensus." : "Validators are evaluating the release evidence.",
      requestId: pending.request,
      hash: pending.hash,
      explorerUrl,
      recovering,
    });

    const receipt = await this.reader().waitForTransactionReceipt({
      hash: pending.hash as TransactionHash,
      status: TransactionStatus.ACCEPTED,
      interval: 6000,
      retries: 150,
    });
    if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
      this.clearPendingTransaction();
      throw new Error("The saved transaction reached consensus, but contract execution failed. Review the evidence and submit a new request.");
    }

    onProgress({
      phase: "accepted",
      message: "Consensus accepted. Confirming persisted contract state.",
      requestId: pending.request,
      hash: pending.hash,
      explorerUrl,
      recovering,
    });
    onProgress({
      phase: "verifying",
      message: "Polling the sender-scoped canonical record.",
      requestId: pending.request,
      hash: pending.hash,
      explorerUrl,
      recovering,
    });

    for (let attempt = 0; attempt < STATE_RETRIES; attempt += 1) {
      const result = await this.getResult(pending.request);
      if (result && result.request_id === pending.request) {
        this.clearPendingTransaction();
        const complete = { ...result, transaction_hash: pending.hash };
        onProgress({
          phase: "complete",
          message: "Canonical release verdict confirmed in contract state.",
          requestId: pending.request,
          hash: pending.hash,
          explorerUrl,
          recovering,
          result: complete,
        });
        return complete;
      }
      await wait(2000);
    }
    throw new Error("Consensus was accepted, but canonical state is not visible yet. Reload to resume the saved transaction hash.");
  }

  async submitCheck(requestId: string, payload: ReleaseGatePayload, onProgress: ProgressHandler): Promise<ReleaseGateResult> {
    validatePayload(payload);
    const existing = this.getPendingTransaction();
    if (existing) return this.finish(existing, onProgress, true);
    if (!this.walletClient || !this.walletAddress) await this.connectWallet(onProgress);
    if (!this.walletClient || !this.walletAddress) throw new Error("Connect a wallet before submitting.");

    onProgress({ phase: "signing", message: "Approve one submit_check transaction in your wallet.", requestId });
    const timestamp = Date.now();
    // Exactly one write. After the hash returns, recovery and retries only read
    // the receipt and the sender-scoped canonical record.
    const hash = String(await this.walletClient.writeContract({
      address: this.address,
      functionName: "submit_check",
      args: [requestId, payloadJson(payload), timestamp] as any,
      value: 0n,
    }));
    const pending: PendingGateTransaction = {
      app: "ReleaseGate",
      request: requestId,
      hash,
      account: this.walletAddress,
      timestamp,
      payload,
    };
    this.persist(pending);
    onProgress({
      phase: "submitted",
      message: "Transaction submitted. Recovery details were saved immediately.",
      requestId,
      hash,
      explorerUrl: this.getExplorerUrl(hash) ?? undefined,
    });
    return this.finish(pending, onProgress);
  }

  async recoverPending(onProgress: ProgressHandler): Promise<ReleaseGateResult | null> {
    const pending = this.getPendingTransaction();
    if (!pending) return null;
    if (!this.walletClient || !this.walletAddress) await this.connectWallet(onProgress);
    if (this.walletAddress && this.walletAddress.toLowerCase() !== pending.account.toLowerCase()) {
      throw new Error("Select the same wallet account that submitted the pending check.");
    }
    onProgress({
      phase: "submitted",
      message: "Recovered the existing transaction hash. No new write was sent.",
      requestId: pending.request,
      hash: pending.hash,
      explorerUrl: this.getExplorerUrl(pending.hash) ?? undefined,
      recovering: true,
    });
    return this.finish(pending, onProgress, true);
  }

  async getResult(requestId: string): Promise<ReleaseGateResult | null> {
    return (await this.read<ReleaseGateResult | null>("get_result", [requestId])) ?? null;
  }

  async getResults(offset = 0, limit = 20): Promise<ReleaseGateResult[]> {
    return (await this.read<ReleaseGateResult[]>("get_results", [offset, limit])) ?? [];
  }

  async getSummary(): Promise<ReleaseGateSummary> {
    return this.read<ReleaseGateSummary>("get_summary");
  }
}
