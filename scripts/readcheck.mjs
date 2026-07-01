// Confirms reads work with no wallet: an account-less read-only client calling
// get_summary against the deployed studionet contract from .env.local.
import { readFileSync } from "node:fs";
import { createClient } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";

function readEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}

function pickChain(network) {
  switch ((network ?? "studionet").toLowerCase()) {
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

const env = readEnv(new URL("../.env.local", import.meta.url));
const address = env.NEXT_PUBLIC_UNDERSTUDY_CONTRACT;
const network = env.NEXT_PUBLIC_UNDERSTUDY_NETWORK ?? "studionet";

if (!address) {
  console.error("No NEXT_PUBLIC_UNDERSTUDY_CONTRACT in .env.local");
  process.exit(1);
}

// No account attached: this is the read-only path a wallet-less visitor uses.
const client = createClient({ chain: pickChain(network) });

const raw = await client.readContract({ address, functionName: "get_summary", args: [] });

function toPlain(v) {
  if (v instanceof Map) {
    const o = {};
    for (const [k, val] of v.entries()) o[String(k)] = toPlain(val);
    return o;
  }
  if (Array.isArray(v)) return v.map(toPlain);
  if (typeof v === "bigint") return Number(v);
  return v;
}

console.log("READ OK (no wallet). get_summary =", JSON.stringify(toPlain(raw)));
