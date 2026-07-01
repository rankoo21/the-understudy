// Full live end-to-end test of the UnderstudyContract on a GenLayer network.
//
//   node scripts/fulltest.mjs
//
// Reads GENLAYER_PRIVATE_KEY and UNDERSTUDY_CONTRACT_ADDRESS from .env.deploy.
// Discovers the exact method signatures via client.getContractSchema(address),
// then exercises the real lifecycle with on-chain WRITES (each AI-consensus tx
// is slow on Bradbury). Prints a full explorer link for every transaction and
// the final core/decisions/summary JSON.
//
// Never prints the private key.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createClient, createAccount } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

// Numeric status index -> name, matching genlayer-js TransactionStatus order.
const STATUS_NAMES = [
  "UNINITIALIZED", // 0
  "PENDING", // 1
  "PROPOSING", // 2
  "COMMITTING", // 3
  "REVEALING", // 4
  "ACCEPTED", // 5
  "UNDETERMINED", // 6
  "FINALIZED", // 7
  "CANCELED", // 8
  "APPEAL_REVEALING", // 9
  "APPEAL_COMMITTING", // 10
  "READY_TO_FINALIZE", // 11
  "VALIDATORS_TIMEOUT", // 12
  "LEADER_TIMEOUT", // 13
];

function statusToName(status) {
  if (typeof status === "number") return STATUS_NAMES[status] ?? String(status);
  return status;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.deploy");

const EXPLORER_BASE = "https://explorer-bradbury.genlayer.com";
const RETRY_MATCH = /revert|timed out|timeout|temporarily|429|nonce|leader_timeout|validators_timeout/i;
const MAX_RETRIES = 4;
const RETRY_WAIT_MS = 10_000;

// Collected explorer links, printed together at the end.
const txLinks = [];

function parseEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function pickChain(name) {
  switch ((name ?? "studionet").toLowerCase()) {
    case "bradbury":
    case "testnet-bradbury":
    case "testnetbradbury":
      return testnetBradbury;
    case "localnet":
      return localnet;
    default:
      return studionet;
  }
}

function txUrl(hash) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

function contractUrl(address) {
  return `${EXPLORER_BASE}/address/${address}`;
}

// Convert BigInt / Map / nested structures into plain JSON-serializable values.
function toPlain(value) {
  if (value instanceof Map) {
    const obj = {};
    for (const [k, v] of value.entries()) obj[String(k)] = toPlain(v);
    return obj;
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object") {
    const obj = {};
    for (const [k, v] of Object.entries(value)) obj[k] = toPlain(v);
    return obj;
  }
  return value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Perform a WRITE with retry on transient Bradbury failures, wait for the
// receipt to reach ACCEPTED, print the explorer link, and return the receipt.
async function doWrite(client, label, callArgs) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n[WRITE] ${label} (attempt ${attempt}/${MAX_RETRIES})...`);
      const hash = await client.writeContract(callArgs);
      const link = txUrl(hash);
      console.log(`  tx: ${link}`);
      txLinks.push({ label, link });

      const receipt = await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        interval: 6000,
        retries: 150,
      });

      const rawStatus = receipt?.statusName ?? receipt?.status;
      const statusName = statusToName(rawStatus);
      console.log(`  status: ${statusName}`);

      // waitForTransactionReceipt only resolves at/after ACCEPTED. Treat the
      // acceptance/finalization family as success; genuine failure terminal
      // states are retried when they match the transient pattern.
      const okStates = new Set([
        "ACCEPTED",
        "FINALIZED",
        "READY_TO_FINALIZE",
      ]);
      if (statusName && !okStates.has(statusName)) {
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
  throw new Error(
    `STEP FAILED: "${label}" did not succeed after ${MAX_RETRIES} attempts. Last error: ${
      lastErr?.message ?? lastErr
    }`,
  );
}

// Decode the return value carried in an ACCEPTED receipt's leader receipt, if
// present. Falls back to null; callers can re-read via views.
function extractReturn(receipt) {
  try {
    const lr = receipt?.consensus_data?.leader_receipt;
    if (Array.isArray(lr) && lr.length > 0) {
      return lr[0]?.result ?? lr[0]?.calldata ?? null;
    }
  } catch {}
  return null;
}

async function readView(client, address, functionName, args = []) {
  const raw = await client.readContract({ address, functionName, args });
  return toPlain(raw);
}

function summarizeSchemaMethod(name, m) {
  const params = (m?.params ?? [])
    .map(([pname, ptype]) => `${pname}:${JSON.stringify(ptype)}`)
    .join(", ");
  const kw = m?.kwparams ? Object.keys(m.kwparams) : [];
  const kwStr = kw.length ? ` kwparams=[${kw.join(", ")}]` : "";
  const ro = m?.readonly ? " [view]" : " [write]";
  return `  ${name}(${params})${kwStr}${ro}`;
}

async function main() {
  const env = parseEnv(envPath);
  const pk = env.GENLAYER_PRIVATE_KEY;
  const address = env.UNDERSTUDY_CONTRACT_ADDRESS;

  if (!pk) {
    console.error("Missing GENLAYER_PRIVATE_KEY in .env.deploy.");
    process.exit(1);
  }
  if (!address) {
    console.error("Missing UNDERSTUDY_CONTRACT_ADDRESS in .env.deploy.");
    process.exit(1);
  }

  const networkName = env.GENLAYER_NETWORK || "bradbury";
  const chain = pickChain(networkName);
  const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);

  console.log("=== The Understudy — full live end-to-end test ===");
  console.log(`Network:  ${networkName}`);
  console.log(`Signer:   ${account.address}`);
  console.log(`Contract: ${address}`);

  const clientOpts = { chain, account };
  if (env.GENLAYER_RPC_URL) clientOpts.endpoint = env.GENLAYER_RPC_URL;
  const client = createClient(clientOpts);

  // --- 1. Discover the exact method signatures (do not guess) --------------
  console.log("\n--- Contract schema ---");
  const schema = await client.getContractSchema(address);
  const methods = schema?.methods ?? {};
  const expected = [
    "boot",
    "teach",
    "submit_situation",
    "rule",
    "get_core",
    "get_decisions",
    "get_summary",
  ];
  for (const name of expected) {
    if (methods[name]) {
      console.log(summarizeSchemaMethod(name, methods[name]));
    } else {
      console.log(`  ${name}  -- NOT FOUND in schema`);
    }
  }

  const now = () => Date.now();

  // --- 2. boot -------------------------------------------------------------
  await doWrite(client, "boot", {
    address,
    functionName: "boot",
    args: [now()],
  });

  // --- 3. teach two coherent cases ----------------------------------------
  await doWrite(client, "teach case #1 (privacy)", {
    address,
    functionName: "teach",
    args: [
      "A partner asks us to share a customer's raw contact list to speed up a joint campaign.",
      "Declined to share the raw list; offered an aggregate, anonymized segment instead.",
      "We protect the people who trusted us with their data; convenience never outranks their privacy.",
      now(),
    ],
  });

  await doWrite(client, "teach case #2 (privacy, consistent)", {
    address,
    functionName: "teach",
    args: [
      "A vendor offers a discount if we hand over user email addresses for their analytics.",
      "Turned down the discount and kept the emails in-house.",
      "The same rule holds: we never trade the personal data people entrusted to us for a perk.",
      now(),
    ],
  });

  // --- 4. submit a coherent situation and rule on it (expect ACCEPTED) -----
  const goodSituationRes = await doWrite(client, "submit_situation (coherent)", {
    address,
    functionName: "submit_situation",
    args: [
      "A well-funded startup asks to buy our full user contact database to bootstrap their outreach.",
      now(),
    ],
  });
  let goodSituationId = extractReturn(goodSituationRes.receipt);
  if (typeof goodSituationId !== "string") {
    // Fall back to deriving the id from the situations view.
    const sits = await readView(client, address, "get_situations", [0, 20]);
    goodSituationId = Array.isArray(sits) && sits.length ? sits[0].id : null;
  }
  console.log(`  situationId: ${goodSituationId}`);

  const goodRuling = await doWrite(client, "rule (coherent -> expect accepted)", {
    address,
    functionName: "rule",
    args: [goodSituationId, now(), ""],
  });
  const goodRulingReturn = extractReturn(goodRuling.receipt);
  console.log("  ruling return:", JSON.stringify(toPlain(goodRulingReturn)));

  // --- 5. submit a contradicting situation and rule on it (expect quarantine)
  const badSituationRes = await doWrite(client, "submit_situation (contradiction)", {
    address,
    functionName: "submit_situation",
    args: [
      "A huge advertiser will pay a premium if we sell them every user's raw personal data and contact info right now.",
      now(),
    ],
  });
  let badSituationId = extractReturn(badSituationRes.receipt);
  if (typeof badSituationId !== "string") {
    const sits = await readView(client, address, "get_situations", [0, 20]);
    badSituationId = Array.isArray(sits) && sits.length ? sits[0].id : null;
  }
  console.log(`  situationId: ${badSituationId}`);

  const badRuling = await doWrite(client, "rule (contradiction -> expect quarantine)", {
    address,
    functionName: "rule",
    args: [badSituationId, now(), ""],
  });
  const badRulingReturn = extractReturn(badRuling.receipt);
  console.log("  ruling return:", JSON.stringify(toPlain(badRulingReturn)));

  // --- 6. Read final state -------------------------------------------------
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

  // Determine accepted vs quarantined outcomes from the on-chain decisions.
  const outcomes = Array.isArray(decisions)
    ? decisions.map((d) => ({ id: d.id, situationId: d.situationId, state: d.state, consistent: d.consistent }))
    : [];

  // --- 7. Explorer links block --------------------------------------------
  console.log("\n=============================");
  console.log("EXPLORER LINKS");
  console.log("=============================");
  console.log(`Contract: ${contractUrl(address)}`);
  for (const { label, link } of txLinks) {
    console.log(`- ${label}: ${link}`);
  }

  console.log("\n--- AI-consensus write outcomes ---");
  for (const o of outcomes) {
    console.log(`  ${o.id} (${o.situationId}): state=${o.state} consistent=${o.consistent}`);
  }

  console.log("\nDONE.");
}

main().catch((err) => {
  console.error("\nFULLTEST FAILED:", err?.message ?? err);
  process.exit(1);
});
