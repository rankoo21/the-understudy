import type { UnderstudyAdapter } from "./types";
import { MockAdapter } from "./mockAdapter";
import { ContractAdapter } from "./contractAdapter";

// Single place that decides which adapter is live. The UI imports getAdapter()
// and never imports a concrete adapter directly.
let cached: UnderstudyAdapter | null = null;

export function getAdapter(): UnderstudyAdapter {
  if (cached) return cached;

  const mode = process.env.NEXT_PUBLIC_UNDERSTUDY_MODE ?? "mock";
  const contractAddress = process.env.NEXT_PUBLIC_UNDERSTUDY_CONTRACT ?? "";
  const network = process.env.NEXT_PUBLIC_UNDERSTUDY_NETWORK ?? "studionet";

  if (mode === "contract" && contractAddress) {
    cached = new ContractAdapter({ contractAddress, network });
  } else {
    cached = new MockAdapter();
  }
  return cached;
}

export * from "./types";
