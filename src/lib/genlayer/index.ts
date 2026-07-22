import type { ReleaseGateAdapter } from "./types";
import { ContractAdapter } from "./contractAdapter";
import { MockAdapter } from "./mockAdapter";

let cached: ReleaseGateAdapter | null = null;

export function getAdapter(): ReleaseGateAdapter {
  if (cached) return cached;

  const mode = process.env.NEXT_PUBLIC_RELEASEGATE_MODE ?? "mock";
  const contractAddress = process.env.NEXT_PUBLIC_RELEASEGATE_CONTRACT ?? "";
  const network = process.env.NEXT_PUBLIC_RELEASEGATE_NETWORK ?? "bradbury";

  cached = mode === "contract" && contractAddress
    ? new ContractAdapter({ contractAddress, network })
    : new MockAdapter();
  return cached;
}

export * from "./types";
