import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type {
  ActionRecord,
  Core,
  Ruling,
  RuleResult,
  Situation,
  StepInInput,
  StepInResult,
  Summary,
  TeachInput,
  TeachResult,
  UnderstudyAdapter,
} from "./types";

// Real GenLayer adapter. Implements the exact same UnderstudyAdapter interface
// as the mock, so swapping it in does not touch a single line of UI code.
//
// To go live:
//   1. Deploy contracts/UnderstudyContract.py (see scripts/deploy.mjs).
//   2. Set NEXT_PUBLIC_UNDERSTUDY_MODE=contract and NEXT_PUBLIC_UNDERSTUDY_CONTRACT=0x...
//   3. Optionally set NEXT_PUBLIC_UNDERSTUDY_NETWORK (studionet | bradbury | localnet).
//
// Identity model: reads run through a read-only client that ALWAYS carries an
// account. genlayer-js refuses to call readContract with no account attached
// ("No account set. Configure the client with an account or pass an account to
// this function."), so we attach a throwaway ephemeral account (a freshly
// generated burner key, reused across reads in this session). This burner is
// never funded, never used to sign a write, and only satisfies the client's
// account requirement for gasless reads. Writing still requires the visitor to
// connect their own browser wallet (MetaMask with the GenLayer Snap) via The
// Key Switch. The deploy key in .env.deploy is server-side only and never
// bundled here.

type AnyClient = ReturnType<typeof createClient>;

const ACCEPTED = TransactionStatus.ACCEPTED;

// The mechanical voice used when a write is attempted with no wallet armed.
const NO_KEY_MESSAGE = "Insert your key (connect a wallet) to do this.";

export interface ContractAdapterConfig {
  contractAddress: string;
  network?: string;
}

function pickChain(network?: string) {
  switch ((network ?? "studionet").toLowerCase()) {
    case "bradbury":
    case "testnet-bradbury":
    case "testnetbradbury":
      return testnetBradbury;
    case "localnet":
      return localnet;
    case "studionet":
    default:
      return studionet;
  }
}

function networkName(network?: string): "studionet" | "testnetBradbury" | "localnet" {
  switch ((network ?? "studionet").toLowerCase()) {
    case "bradbury":
    case "testnet-bradbury":
    case "testnetbradbury":
      return "testnetBradbury";
    case "localnet":
      return "localnet";
    default:
      return "studionet";
  }
}

// Recursively turn Maps (genlayer calldata) into plain objects so the UI can
// read fields with dot access regardless of how the value was decoded.
function toPlain(value: unknown): any {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) obj[String(k)] = toPlain(v);
    return obj;
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "bigint") return Number(value);
  return value;
}

export class ContractAdapter implements UnderstudyAdapter {
  readonly mode = "contract" as const;
  private readonly config: ContractAdapterConfig;
  private readonly chain: ReturnType<typeof pickChain>;
  // Account-attached ephemeral client used only for reads. It needs no wallet.
  private readClient: AnyClient | null = null;
  // Wallet-backed client used for writes. Null until a wallet is connected.
  private walletClient: AnyClient | null = null;
  private walletAddress: string | null = null;
  private usingWallet = false;

  constructor(config: ContractAdapterConfig) {
    this.config = config;
    this.chain = pickChain(config.network);
  }

  // -- identity (the keyholder) ---------------------------------------

  // Read-only client. Always carries an ephemeral account so genlayer-js never
  // throws "No account set" on a read. The account is a throwaway burner: never
  // funded, never used to sign a write, generated fresh per session.
  private getReadClient(): AnyClient {
    if (this.readClient) return this.readClient;
    const readAccount = createAccount(generatePrivateKey());
    this.readClient = createClient({ chain: this.chain, account: readAccount }) as AnyClient;
    return this.readClient;
  }

  // Wallet-backed client required for any write. Throws in the app's mechanical
  // voice if no wallet has been connected yet.
  private requireWalletClient(): AnyClient {
    if (this.usingWallet && this.walletClient) return this.walletClient;
    throw new Error(NO_KEY_MESSAGE);
  }

  hasInjectedWallet(): boolean {
    return typeof window !== "undefined" && Boolean((window as any).ethereum);
  }

  async connectWallet(): Promise<string> {
    if (typeof window === "undefined") throw new Error("Wallet connect is only available in the browser.");
    const eth = (window as any).ethereum;
    if (!eth) throw new Error("No browser wallet found. Install MetaMask with the GenLayer Snap to connect.");
    let addr: string | undefined;
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      addr = accounts?.[0];
    } catch (e: any) {
      if (e?.code === 4001) throw new Error("Wallet connection was rejected.");
      throw new Error("Could not reach the browser wallet.");
    }
    const client = createClient({ chain: this.chain }) as AnyClient;
    try {
      await client.connect(networkName(this.config.network));
      if (!addr) { const addresses = await client.getAddresses().catch(() => [] as string[]); addr = addresses?.[0]; }
    } catch (e) {
      if (!addr) throw new Error("Wallet connected but no account was returned.");
    }
    if (!addr) throw new Error("Wallet connected but no account was returned.");
    this.walletClient = client;
    this.walletAddress = addr;
    this.usingWallet = true;
    return addr;
  }

  disconnectWallet(): void {
    this.walletClient = null;
    this.walletAddress = null;
    this.usingWallet = false;
  }

  isUsingWallet(): boolean {
    return this.usingWallet;
  }

  get ownerAddress(): string | null {
    return this.usingWallet ? this.walletAddress : null;
  }

  getIdentityAddress(): string | null {
    return this.ownerAddress;
  }

  private get address(): `0x${string}` {
    return this.config.contractAddress as `0x${string}`;
  }

  // -- low level -------------------------------------------------------

  private async read<T>(functionName: string, args: unknown[] = []): Promise<T> {
    const client = this.getReadClient();
    const raw = await client.readContract({
      address: this.address,
      functionName,
      args: args as any,
    });
    return toPlain(raw) as T;
  }

  private async writeAndReceipt(functionName: string, args: unknown[]): Promise<any> {
    const client = this.requireWalletClient();
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const hash = await client.writeContract({
          address: this.address,
          functionName,
          args: args as any,
          value: 0n,
        });
        return await client.waitForTransactionReceipt({
          hash,
          status: ACCEPTED,
          interval: 6000,
          retries: 150,
        });
      } catch (error) {
        lastError = error;
        const message = String((error as Error)?.message ?? error);
        if (!/revert|timed out|temporarily|429/i.test(message)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
    }
    throw lastError;
  }

  private extractReturn<T>(receipt: any): T | undefined {
    if (!receipt) return undefined;
    const candidates = [
      receipt?.consensus_data?.leader_receipt?.[0]?.result,
      receipt?.consensus_data?.leader_receipt?.result,
      receipt?.result,
      receipt?.returnValue,
      receipt?.data,
    ];
    for (const c of candidates) {
      if (c !== undefined && c !== null) return toPlain(c) as T;
    }
    return undefined;
  }

  // -- writes ----------------------------------------------------------

  async boot(): Promise<Summary> {
    await this.writeAndReceipt("boot", [Date.now()]);
    return this.getSummary();
  }

  async teach(input: TeachInput): Promise<TeachResult> {
    const receipt = await this.writeAndReceipt("teach", [
      input.situation,
      input.call,
      input.why,
      Date.now(),
    ]);
    const out = toPlain(this.extractReturn<any>(receipt)) ?? {};
    return {
      caseId: out.caseId ?? "",
      relation: (out.relation ?? "extends") as TeachResult["relation"],
      rule: out.rule ?? "",
      locked: Boolean(out.locked),
      grewFacet: Boolean(out.grewFacet),
      principleId: out.principleId ?? null,
      tension: out.tension ?? "",
      note: out.note ?? "",
    };
  }

  async submitSituation(text: string): Promise<Situation> {
    const receipt = await this.writeAndReceipt("submit_situation", [text, Date.now()]);
    const id = this.extractReturn<string>(receipt);
    const situations = await this.getSituations();
    const found = situations.find((s) => s.id === id) ?? situations[0];
    if (!found) throw new Error("The situation docked but could not be read back.");
    return found;
  }

  async rule(situationId: string): Promise<RuleResult> {
    const receipt = await this.writeAndReceipt("rule", [situationId, Date.now(), ""]);
    const out = toPlain(this.extractReturn<any>(receipt)) ?? {};
    return {
      rulingId: out.rulingId ?? "",
      situationId: out.situationId ?? situationId,
      decision: out.decision ?? "",
      consistent: Boolean(out.consistent),
      state: (out.state ?? "quarantined") as RuleResult["state"],
      principlesUsed: Array.isArray(out.principlesUsed) ? out.principlesUsed : [],
      action: out.action ?? "",
      actionId: out.actionId ?? "",
      note: out.note ?? "",
    };
  }

  async stepIn(input: StepInInput): Promise<StepInResult> {
    const receipt = await this.writeAndReceipt("step_in", [
      input.situationId,
      input.decision,
      input.clarifyingRule,
      input.lock,
      Date.now(),
    ]);
    const out = toPlain(this.extractReturn<any>(receipt)) ?? {};
    return {
      situationId: out.situationId ?? input.situationId,
      rulingId: out.rulingId ?? null,
      state: (out.state ?? "resolved-by-owner") as StepInResult["state"],
      decision: out.decision ?? input.decision,
      principleId: out.principleId ?? null,
      note: out.note ?? "",
    };
  }

  // -- reads -----------------------------------------------------------

  async getSummary(): Promise<Summary> {
    const s = await this.read<any>("get_summary");
    return {
      owner: s?.owner ?? "",
      booted: Boolean(s?.booted),
      createdAt: Number(s?.createdAt ?? 0),
      coherence: Number(s?.coherence ?? 0),
      principles: Number(s?.principles ?? 0),
      situations: Number(s?.situations ?? 0),
      rulings: Number(s?.rulings ?? 0),
      actions: Number(s?.actions ?? 0),
      tensions: Number(s?.tensions ?? 0),
    };
  }

  async getCore(): Promise<Core> {
    const c = await this.read<any>("get_core");
    return {
      owner: c?.owner ?? "",
      facets: Number(c?.facets ?? 0),
      coherence: Number(c?.coherence ?? 0),
      principles: Array.isArray(c?.principles) ? c.principles : [],
      lockedPrinciples: Array.isArray(c?.lockedPrinciples) ? c.lockedPrinciples : [],
      tensions: Array.isArray(c?.tensions) ? c.tensions : [],
    };
  }

  async getSituations(): Promise<Situation[]> {
    const all: Situation[] = [];
    const limit = 20;
    let offset = 0;
    for (;;) {
      const page = await this.read<Situation[]>("get_situations", [offset, limit]);
      if (!page || page.length === 0) break;
      all.push(...page);
      if (page.length < limit) break;
      offset += limit;
    }
    return all;
  }

  async getDecisions(): Promise<Ruling[]> {
    const all: Ruling[] = [];
    const limit = 20;
    let offset = 0;
    for (;;) {
      const page = await this.read<Ruling[]>("get_decisions", [offset, limit]);
      if (!page || page.length === 0) break;
      all.push(...page);
      if (page.length < limit) break;
      offset += limit;
    }
    return all;
  }

  async getQuarantine(): Promise<Ruling[]> {
    const all: Ruling[] = [];
    const limit = 20;
    let offset = 0;
    for (;;) {
      const page = await this.read<Ruling[]>("get_quarantine", [offset, limit]);
      if (!page || page.length === 0) break;
      all.push(...page);
      if (page.length < limit) break;
      offset += limit;
    }
    return all;
  }

  async getActions(): Promise<ActionRecord[]> {
    const all: ActionRecord[] = [];
    const limit = 20;
    let offset = 0;
    for (;;) {
      const page = await this.read<ActionRecord[]>("get_actions", [offset, limit]);
      if (!page || page.length === 0) break;
      all.push(...page);
      if (page.length < limit) break;
      offset += limit;
    }
    return all;
  }
}
