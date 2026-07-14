import type {
  ActionRecord,
  Core,
  Principle,
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
import { decideRuling } from "@/utils/rulingState";
import { makeId, mockTxHash } from "@/utils/format";
import { SEED_CASES } from "@/data/mockCases";
import { SEED_SITUATIONS } from "@/data/mockSituations";

const MOCK_OWNER = "0xUnderstudy_keyholder_mock_00000";
const TENSION_PENALTY = 12;

// In-memory store mirrors what the contract would hold authoritatively.
class MockStore {
  booted = false;
  createdAt = 0;
  principles = new Map<string, Principle>();
  principleIds: string[] = [];
  situations = new Map<string, Situation>();
  situationIds: string[] = [];
  rulings = new Map<string, Ruling>();
  rulingIds: string[] = [];
  actions = new Map<string, ActionRecord>();
  actionIds: string[] = [];
  tensions: string[] = [];
  caseCount = 0;
  seeded = false;
}

// Canonicalization mirror of the contract's _canon_text, so the mock's action
// records carry the same canonical substance the chain would compute.
const CANON_STOPWORDS = new Set(
  "the a an to of and or for in on at by with is are be it its this that these those as from your you their them they if then else do does will would should must can may we i he she his her our but so".split(
    " ",
  ),
);

function canonText(text: string): string {
  if (!text) return "";
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !CANON_STOPWORDS.has(w));
  return Array.from(new Set(words)).sort().join(" ");
}

const store = new MockStore();

function coherence(): number {
  return Math.max(0, 100 - TENSION_PENALTY * store.tensions.length);
}

// Naive relation inference for offline teaching: a lesson that negates an
// existing locked rule is a contradiction; otherwise it extends the core.
function inferRelation(call: string, why: string): "coheres" | "extends" | "contradicts" {
  const text = `${call} ${why}`.toLowerCase();
  const negators = ["never", "always refuse", "no exceptions", "ignore", "deny everyone", "opposite"];
  const hits = negators.some((n) => text.includes(n));
  if (hits && store.principles.size > 0) return "contradicts";
  return store.principles.size === 0 ? "coheres" : "extends";
}

function compactRule(why: string, call: string): string {
  const base = (why || call).trim();
  const cut = base.length > 200 ? base.slice(0, 200) : base;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

function seedDefaults() {
  if (store.seeded) return;
  store.seeded = true;
  store.booted = true;
  store.createdAt = Date.now() - 1000 * 60 * 60 * 6;

  SEED_CASES.forEach((c, i) => {
    const id = `principle_${i}`;
    const p: Principle = {
      id,
      rule: c.rule,
      locked: c.locked,
      relation: c.relation,
      sourceCaseId: `case_${i}`,
      createdAt: store.createdAt + i * 1000 * 60 * 20,
    };
    store.principles.set(id, p);
    store.principleIds.push(id);
    store.caseCount += 1;
  });

  // Preload situations into a known demo layout.
  SEED_SITUATIONS.forEach((s, i) => {
    const id = `situation_${i}`;
    const sit: Situation = {
      id,
      text: s.text,
      state: "docked",
      createdAt: store.createdAt + 1000 * 60 * 60 + i * 1000 * 60 * 5,
    };
    store.situations.set(id, sit);
    store.situationIds.push(id);
  });
}

function delay<T>(value: T, ms = 360): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function listPrinciples(): Principle[] {
  return store.principleIds
    .map((id) => store.principles.get(id))
    .filter((p): p is Principle => Boolean(p));
}

export class MockAdapter implements UnderstudyAdapter {
  readonly mode = "mock" as const;

  constructor() {
    seedDefaults();
  }

  getIdentityAddress(): string | null {
    return MOCK_OWNER;
  }

  async boot(): Promise<Summary> {
    if (!store.booted) {
      store.booted = true;
      store.createdAt = Date.now();
    }
    return delay(await this.getSummary(), 200);
  }

  async teach(input: TeachInput): Promise<TeachResult> {
    const situation = input.situation.trim();
    const call = input.call.trim();
    const why = input.why.trim();
    if (!situation) throw new Error("Teach a case before pulling the lever.");
    if (!call || !why) throw new Error("A case needs a call and a reason.");

    const relation = inferRelation(call, why);
    const caseId = `case_${store.caseCount}`;
    store.caseCount += 1;

    if (relation === "contradicts") {
      const note = `This case contradicts a locked principle: ${compactRule(why, call)}`;
      store.tensions.push(note);
      return delay({
        caseId,
        relation,
        rule: compactRule(why, call),
        locked: false,
        grewFacet: false,
        principleId: null,
        tension: note,
        note: "This lesson contradicts the core. It was flagged as a tension, not blended.",
      });
    }

    const rule = compactRule(why, call);
    const id = `principle_${store.principleIds.length}`;
    const locked = why.length > 24; // load-bearing reasoning locks the facet
    const principle: Principle = {
      id,
      rule,
      locked,
      relation,
      sourceCaseId: caseId,
      createdAt: Date.now(),
    };
    store.principles.set(id, principle);
    store.principleIds.push(id);

    return delay({
      caseId,
      relation,
      rule,
      locked,
      grewFacet: true,
      principleId: id,
      tension: "",
      note: "The core grew a facet.",
    });
  }

  async submitSituation(text: string): Promise<Situation> {
    const clean = text.trim();
    if (!clean) throw new Error("A situation needs a description before it can dock.");
    const id = `situation_${store.situationIds.length}`;
    const sit: Situation = { id, text: clean, state: "docked", createdAt: Date.now() };
    store.situations.set(id, sit);
    store.situationIds.push(id);
    return delay(sit, 220);
  }

  async rule(situationId: string): Promise<RuleResult> {
    const sit = store.situations.get(situationId);
    if (!sit) throw new Error("That situation never docked in the bay.");
    if (["accepted", "quarantined", "resolved-by-owner"].includes(sit.state)) {
      throw new Error("This situation has already been ruled on.");
    }
    if (store.principleIds.length === 0) {
      throw new Error("The core is too small to rule on this yet.");
    }

    const decision = decideRuling(sit.text, listPrinciples());
    const id = `ruling_${store.rulingIds.length}`;
    const ruling: Ruling = {
      id,
      situationId,
      decision: decision.decision,
      principlesUsed: decision.principlesUsed,
      consistent: decision.consistent,
      state: decision.state,
      action: decision.action,
      createdAt: Date.now(),
      mockTxHash: mockTxHash(),
    };
    // Connect an accepted ruling to a concrete downstream action record, exactly
    // as the contract queues a canonical Action for a consensus-verified ruling.
    let actionId = "";
    if (decision.consistent && decision.action) {
      actionId = `action_${store.actionIds.length}`;
      const action: ActionRecord = {
        id: actionId,
        rulingId: id,
        situationId,
        effect: decision.action,
        canonical: canonText(decision.action),
        authorizedBy: decision.decision,
        status: "queued",
        createdAt: Date.now(),
      };
      store.actions.set(actionId, action);
      store.actionIds.push(actionId);
    }
    ruling.actionId = actionId;

    store.rulings.set(id, ruling);
    store.rulingIds.push(id);
    sit.state = decision.state;

    return delay({
      rulingId: id,
      situationId,
      decision: decision.decision,
      consistent: decision.consistent,
      state: decision.state,
      principlesUsed: decision.principlesUsed,
      action: decision.action,
      actionId,
      note: decision.note,
    });
  }

  async stepIn(input: StepInInput): Promise<StepInResult> {
    const sit = store.situations.get(input.situationId);
    if (!sit) throw new Error("That situation never docked in the bay.");
    if (sit.state !== "quarantined") {
      throw new Error("Only a quarantined situation can be stepped in on.");
    }
    const decision = input.decision.trim();
    if (!decision) throw new Error("Step-in needs your manual call.");

    // Resolve the held ruling.
    let resolvedRulingId: string | null = null;
    for (let i = store.rulingIds.length - 1; i >= 0; i--) {
      const r = store.rulings.get(store.rulingIds[i]);
      if (r && r.situationId === input.situationId && r.state === "quarantined") {
        r.state = "resolved-by-owner";
        r.decision = decision;
        resolvedRulingId = r.id;
        break;
      }
    }
    sit.state = "resolved-by-owner";

    let principleId: string | null = null;
    const rule = input.clarifyingRule.trim();
    if (rule) {
      const id = `principle_${store.principleIds.length}`;
      const principle: Principle = {
        id,
        rule,
        locked: input.lock,
        relation: "extends",
        sourceCaseId: `case_${store.caseCount}`,
        createdAt: Date.now(),
      };
      store.caseCount += 1;
      store.principles.set(id, principle);
      store.principleIds.push(id);
      principleId = id;
    }

    return delay({
      situationId: input.situationId,
      rulingId: resolvedRulingId,
      state: "resolved-by-owner",
      decision,
      principleId,
      note: "You stepped in. The situation is resolved by the keyholder.",
    });
  }

  async getSummary(): Promise<Summary> {
    return delay(
      {
        owner: MOCK_OWNER,
        booted: store.booted,
        createdAt: store.createdAt,
        coherence: coherence(),
        principles: store.principleIds.length,
        situations: store.situationIds.length,
        rulings: store.rulingIds.length,
        actions: store.actionIds.length,
        tensions: store.tensions.length,
      },
      60,
    );
  }

  async getCore(): Promise<Core> {
    const principles = listPrinciples();
    return delay(
      {
        owner: MOCK_OWNER,
        facets: principles.length,
        coherence: coherence(),
        principles,
        lockedPrinciples: principles.filter((p) => p.locked),
        tensions: [...store.tensions],
      },
      60,
    );
  }

  async getSituations(): Promise<Situation[]> {
    const list = store.situationIds
      .map((id) => store.situations.get(id))
      .filter((s): s is Situation => Boolean(s))
      .sort((a, b) => b.createdAt - a.createdAt);
    return delay(list, 60);
  }

  async getDecisions(): Promise<Ruling[]> {
    const list = store.rulingIds
      .map((id) => store.rulings.get(id))
      .filter((r): r is Ruling => Boolean(r))
      .sort((a, b) => b.createdAt - a.createdAt);
    return delay(list, 60);
  }

  async getQuarantine(): Promise<Ruling[]> {
    const list = store.rulingIds
      .map((id) => store.rulings.get(id))
      .filter((r): r is Ruling => Boolean(r) && r!.state === "quarantined")
      .sort((a, b) => b.createdAt - a.createdAt);
    return delay(list, 60);
  }

  async getActions(): Promise<ActionRecord[]> {
    const list = store.actionIds
      .map((id) => store.actions.get(id))
      .filter((a): a is ActionRecord => Boolean(a))
      .sort((a, b) => b.createdAt - a.createdAt);
    return delay(list, 60);
  }
}
