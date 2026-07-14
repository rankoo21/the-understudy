"use client";

import { create } from "zustand";
import { getAdapter } from "@/lib/genlayer";
import type {
  ActionRecord,
  Core,
  Ruling,
  RuleResult,
  Situation,
  StepInInput,
  TeachInput,
} from "@/lib/genlayer/types";
import { shortAddress } from "@/utils/format";

// Zones of one machine, not navigation tabs. The Selector Dial clicks between
// these detents in order.
export type Zone = "boot" | "teach" | "core" | "bay" | "quarantine" | "telemetry";

export const ZONE_ORDER: Zone[] = ["boot", "teach", "core", "bay", "quarantine", "telemetry"];

export const ZONE_GLYPH: Record<Zone, string> = {
  boot: "Boot",
  teach: "Teach",
  core: "Core",
  bay: "Bay",
  quarantine: "Quarantine",
  telemetry: "Telemetry",
};

// A brief signal pulse the Status Strip and zones read to flash cyan/amber.
export type Pulse = { tone: "cyan" | "amber"; at: number } | null;

interface TeachDraft {
  situation: string;
  call: string;
  why: string;
}

const EMPTY_TEACH: TeachDraft = { situation: "", call: "", why: "" };

interface ConsoleState {
  // navigation
  zone: Zone;
  setZone: (z: Zone) => void;
  bootEntered: boolean;
  enterFromBoot: () => void;

  // key switch (wallet)
  keyArmed: boolean;
  keyAddress: string | null;
  keyLabel: string;
  insertKey: () => Promise<void>;
  removeKey: () => void;

  // data
  core: Core | null;
  situations: Situation[];
  decisions: Ruling[];
  quarantine: Ruling[];
  actions: ActionRecord[];

  busy: boolean;
  error: string | null;
  notice: string | null;
  pulse: Pulse;

  // teaching station
  teachDraft: TeachDraft;
  setTeachDraft: (patch: Partial<TeachDraft>) => void;
  resetTeachDraft: () => void;
  lastTeach: { rule: string; relation: string; grewFacet: boolean } | null;

  // animation hooks
  scanningId: string | null;

  // lifecycle
  refresh: () => Promise<void>;
  boot: () => Promise<void>;
  teach: () => Promise<void>;
  submitSituation: (text: string) => Promise<void>;
  ruleSituation: (situationId: string) => Promise<RuleResult | null>;
  runBay: () => Promise<void>;
  stepIn: (input: StepInInput) => Promise<void>;
  clearMessages: () => void;
  firePulse: (tone: "cyan" | "amber") => void;
}

const adapter = getAdapter();

export const useConsoleStore = create<ConsoleState>((set, get) => ({
  zone: "boot",
  setZone: (z) => set({ zone: z }),
  bootEntered: false,
  enterFromBoot: () => set({ bootEntered: true, zone: "teach" }),

  keyArmed: false,
  keyAddress: null,
  keyLabel: "Insert key",
  insertKey: async () => {
    // The only identity path is a real browser wallet through The Key Switch.
    // There is no burner key and no synthetic address.
    if (!adapter.connectWallet) {
      // Offline mock build: arm with the mock identity so the demo runs.
      const mock = adapter.getIdentityAddress();
      if (mock) {
        set({ keyArmed: true, keyAddress: mock, keyLabel: shortAddress(mock) });
      } else {
        set({ error: "This build has no wallet path. Reads only." });
      }
      return;
    }
    if (!adapter.hasInjectedWallet?.()) {
      set({
        error: "No browser wallet found. Install MetaMask with the GenLayer Snap, then insert your key.",
      });
      return;
    }
    set({ busy: true, error: null });
    try {
      const addr = await adapter.connectWallet();
      set({ keyArmed: true, keyAddress: addr, keyLabel: shortAddress(addr) });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },
  removeKey: () => {
    adapter.disconnectWallet?.();
    set({ keyArmed: false, keyAddress: null, keyLabel: "Insert key" });
  },

  core: null,
  situations: [],
  decisions: [],
  quarantine: [],
  actions: [],

  busy: false,
  error: null,
  notice: null,
  pulse: null,

  teachDraft: { ...EMPTY_TEACH },
  setTeachDraft: (patch) => set({ teachDraft: { ...get().teachDraft, ...patch } }),
  resetTeachDraft: () => set({ teachDraft: { ...EMPTY_TEACH } }),
  lastTeach: null,

  scanningId: null,

  refresh: async () => {
    const [core, situations, decisions, quarantine, actions] = await Promise.all([
      adapter.getCore(),
      adapter.getSituations(),
      adapter.getDecisions(),
      adapter.getQuarantine(),
      adapter.getActions(),
    ]);
    set({ core, situations, decisions, quarantine, actions });
  },

  boot: async () => {
    set({ busy: true, error: null });
    try {
      await adapter.boot();
      await get().refresh();
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  teach: async () => {
    const { teachDraft, keyArmed } = get();
    if (!keyArmed) {
      set({ error: "Insert your key (connect a wallet) to do this." });
      return;
    }
    if (!teachDraft.situation.trim()) {
      set({ error: "Teach a case before pulling the lever." });
      return;
    }
    if (!teachDraft.call.trim() || !teachDraft.why.trim()) {
      set({ error: "A case needs a call and a reason." });
      return;
    }
    set({ busy: true, error: null });
    try {
      const result = await adapter.teach(teachDraft satisfies TeachInput);
      await get().refresh();
      set({
        lastTeach: { rule: result.rule, relation: result.relation, grewFacet: result.grewFacet },
        notice: result.note,
        teachDraft: { ...EMPTY_TEACH },
      });
      if (result.grewFacet) {
        get().firePulse("cyan");
        // Click toward the Core so the keyholder watches the facet land.
        set({ zone: "core" });
      } else {
        get().firePulse("amber");
      }
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  submitSituation: async (text) => {
    set({ busy: true, error: null });
    try {
      await adapter.submitSituation(text);
      await get().refresh();
      set({ notice: "A situation docked in the bay." });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  ruleSituation: async (situationId) => {
    set({ busy: true, error: null, scanningId: situationId });
    try {
      // Let the scan-line sweep show before the result lands.
      await new Promise((r) => setTimeout(r, 900));
      const result = await adapter.rule(situationId);
      await get().refresh();
      set({ notice: result.note });
      get().firePulse(result.consistent ? "cyan" : "amber");
      return result;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
    } finally {
      set({ busy: false, scanningId: null });
    }
  },

  runBay: async () => {
    const docked = get().situations.filter((s) => s.state === "docked");
    if (docked.length === 0) {
      set({ notice: "No situations are docked. Submit one first." });
      return;
    }
    set({ busy: true, error: null });
    let sawQuarantine = false;
    let sawAccepted = false;
    try {
      for (const s of docked) {
        set({ scanningId: s.id });
        await new Promise((r) => setTimeout(r, 700));
        try {
          const result = await adapter.rule(s.id);
          if (result.consistent) sawAccepted = true;
          else sawQuarantine = true;
        } catch {
          // a single failure should not halt the sweep
        }
      }
      await get().refresh();
      set({
        scanningId: null,
        notice: sawQuarantine
          ? "The bay ran. One ruling was held in quarantine."
          : "The bay ran. Rulings stand as canonical actions.",
      });
      if (sawAccepted) get().firePulse("cyan");
      if (sawQuarantine) get().firePulse("amber");
    } finally {
      set({ busy: false, scanningId: null });
    }
  },

  stepIn: async (input) => {
    if (!get().keyArmed) {
      set({ error: "Insert your key (connect a wallet) to do this." });
      return;
    }
    set({ busy: true, error: null });
    try {
      const result = await adapter.stepIn(input);
      await get().refresh();
      set({ notice: result.note });
      get().firePulse("cyan");
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  clearMessages: () => set({ error: null, notice: null }),
  firePulse: (tone) => set({ pulse: { tone, at: Date.now() } }),
}));
