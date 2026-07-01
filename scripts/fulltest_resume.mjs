// Resume the full test: rule the already-docked contradiction situation
// (situation_1) that hit a transient LEADER_TIMEOUT, then print final state
// and the complete explorer-link block. Reuses the same client + retry logic.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createClient, createAccount } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.deploy");

const EXPLORER_BASE = "https://explorer-bradbury.genlayer.com";
const RETRY_MATCH = /revert|timed out|timeout|temporarily|429|nonce|leader_timeout|validators_timeout/i;
const MAX_RETRIES = 4;
const RETRY_WAIT_MS = 10_000;

// Explorer links already produced in the main run, kept for the final block.
const PRIOR_LINKS = [
  ["boot", "0x836bae0feddd77c386aec354469ec8332136cacbd3b2c8fb9e00b21286e9c300"],
  ["teach case #1 (privacy)", "0x937c4fd210089b331875a2cc43a3e343bc7dc860ca08fce324aef121c9ba9b82"],
  ["teach case #2 (privacy, consistent)", "0x91c499d75757e6cefc600444fc7fe74bccb5d1b74df13a01a962d9e840a70162"],
  ["submit_situation (coherent)", "0xb57fbf9787f5c52fbb76d45d8ca65b925db803cc62cb33d4a98f1b572cc88ec8"],
  ["rule (coherent -> accepted)", "0xda85de32a714b846833d15a1c463c43ffef0712a93e4626fda7f551cab1efb84"],
  ["submit_situation (contradiction)", "0xf86057d820be8ac764f43bd2d916ef847f844e0baa19153ab98c7238d1cac3fb"],
];

const txLinks = [];

const STATUS_NAMES = [
  "UNINITIALIZED", "PENDING", "PROPOSING", "COMMITTING", "REVEALING",
  "ACCEPTED", "UNDETERMINED", "FINALIZED", "CANCELED", "APPEAL_REVEALING",
  "APPEAL_COMMITTING", "READY_TO_FINALIZE", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT",
];
const statusToName = (s) => (typeof s === "number" ? STATUS_NAMES[s] ?? String(s) : s);

function parseEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function pickChain(name) {
  switch ((name ?? "studionet").toLowerCase()) {
    case "bradbury": case "testnet-bradbury": case "testnetbradbury": return testnetBradbury;
    case "localnet": return localnet;
    default: return studionet;
  }
}

const txUrl = (h) => `${EXPLORER_BASE}/tx/${h}`;
const contractUrl = (a) => `${EXPLORER_BASE}/address/${a}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toPlain(value) {
  if (value instanceof Map) {
    const o = {};
    for (const [k, v] of value.entries()) o[String(k)] = toPlain(v);
    return o;
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object") {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = toPlain(v);
    return o;
  }
  return value;
}

async function doWrite(client, label, callArgs) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n[WRITE] ${label} (attempt ${attempt}/${MAX_RETRIES})...`);
      const hash = await client.writeContract(callArgs);
      console.log(`  tx: ${txUrl(hash)}`);
      txLinks.push([label, hash]);
      const receipt = await client.waitForTransactionReceipt({
        hash, status: TransactionStatus.ACCEPTED, interval: 6000, retries: 150,
      });
      const statusName = statusToName(receipt?.statusName ?? receipt?.status);
      console.log(`  status: ${statusName}`);
      const ok = new Set(["ACCEPTED", "FINALIZED", "READY_TO_FINALIZE"]);
      if (statusName && !ok.has(statusName)) {
        throw new Error(`${label} reached terminal state ${statusName}`);
      }
      return { hash, receipt };
    } catch (err) {
      lastErr = err;
      const msg = err?.message ?? String(err);
      console.error(`  ! ${label} failed: ${msg}`);
      if (attempt < MAX_RETRIES && RETRY_MATCH.test(msg)) {
        console.error(`  retrying in ${RETRY_WAIT_MS / 1000}s...`);
        await sleep(RETRY_WAIT_MS);
        continue;
      }
      break;
    }
  }
  throw new Error(`STEP FAILED: "${label}" after ${MAX_RETRIES} attempts. Last: ${lastErr?.message ?? lastErr}`);
}

async function readView(client, address, functionName, args = []) {
  return toPlain(await client.readContract({ address, functionName, args }));
}

async function main() {
  const env = parseEnv(envPath);
  const pk = env.GENLAYER_PRIVATE_KEY;
  const address = env.UNDERSTUDY_CONTRACT_ADDRESS;
  const networkName = env.GENLAYER_NETWORK || "bradbury";
  const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const clientOpts = { chain: pickChain(networkName), account };
  if (env.GENLAYER_RPC_URL) clientOpts.endpoint = env.GENLAYER_RPC_URL;
  const client = createClient(clientOpts);

  console.log("=== The Understudy — resume (rule contradiction) ===");
  console.log(`Signer:   ${account.address}`);
  console.log(`Contract: ${address}`);

  // situation_1 is the docked contradiction; rule on it now.
  const targetSituation = process.argv[2] || "situation_1";
  console.log(`\nRuling docked situation: ${targetSituation}`);

  const ruling = await doWrite(client, "rule (contradiction -> expect quarantine)", {
    address,
    functionName: "rule",
    args: [targetSituation, Date.now(), ""],
  });
  console.log("  ruling receipt status ok.");

  console.log("\n--- Final reads ---");
  const core = await readView(client, address, "get_core", []);
  const decisions = await readView(client, address, "get_decisions", [0, 20]);
  const summary = await readView(client, address, "get_summary", []);

  console.log("\nget_core =");
  console.log(JSON.stringify(core, null, 2));
  console.log("\nget_decisions =");
  console.log(JSON.stringify(decisions, null, 2));
  console.log("\nget_summary =");
  console.log(JSON.stringify(summary, null, 2));

  console.log("\n=============================");
  console.log("EXPLORER LINKS");
  console.log("=============================");
  console.log(`Contract: ${contractUrl(address)}`);
  for (const [label, hash] of PRIOR_LINKS) console.log(`- ${label}: ${txUrl(hash)}`);
  for (const [label, hash] of txLinks) console.log(`- ${label}: ${txUrl(hash)}`);

  console.log("\n--- AI-consensus write outcomes ---");
  if (Array.isArray(decisions)) {
    for (const d of decisions) {
      console.log(`  ${d.id} (${d.situationId}): state=${d.state} consistent=${d.consistent}`);
    }
  }
  console.log("\nDONE.");
}

main().catch((err) => {
  console.error("\nRESUME FAILED:", err?.message ?? err);
  process.exit(1);
});
