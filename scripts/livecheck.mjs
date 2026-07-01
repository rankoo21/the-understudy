// Verify a live read against the deployed UnderstudyContract.
//
//   node scripts/livecheck.mjs
//
// Reads UNDERSTUDY_CONTRACT_ADDRESS (or the address passed as argv[2]) from
// .env.deploy and calls get_summary on the configured network.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.deploy");

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

function toPlain(value) {
  if (value instanceof Map) {
    const obj = {};
    for (const [k, v] of value.entries()) obj[String(k)] = toPlain(v);
    return obj;
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "bigint") return Number(value);
  return value;
}

async function main() {
  const env = parseEnv(envPath);
  const address = process.argv[2] || env.UNDERSTUDY_CONTRACT_ADDRESS;
  if (!address) {
    console.error("No contract address. Deploy first or pass one as an argument.");
    process.exit(1);
  }
  const networkName = env.GENLAYER_NETWORK || "studionet";
  const chain = pickChain(networkName);
  const account = createAccount(generatePrivateKey());
  const client = createClient({ chain, account });

  console.log(`Network:  ${networkName}`);
  console.log(`Contract: ${address}`);
  console.log("Reading get_summary...");

  const summary = toPlain(
    await client.readContract({ address, functionName: "get_summary", args: [] }),
  );
  console.log("Live read OK:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("Live read failed:", err?.message ?? err);
  process.exit(1);
});
