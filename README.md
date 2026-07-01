# The Understudy

"It learns your calls, and makes them when you are away."

A precise mechanical control room for an AI agent that learns your judgment and
acts for you, strictly inside principles that GenLayer validators can check. You
teach small cases. A faceted logic core grows. Situations dock. The understudy
rules. Consensus verifies the ruling stayed true, or holds it in quarantine.

---

## 1. What is this?

The Understudy is bounded autonomous delegation. You train an agent by teaching
it small decisions in natural language: the situation you faced, the call you
made, and the reasoning behind it. Each coherent lesson grows the agent's logic
core by one canonical principle facet. Later, when a real situation arrives
while you are away, the understudy proposes a ruling and the chain verifies that
ruling is consistent with your stored principles. Consistent rulings become
canonical actions. Contradictory ones lock in quarantine and wait for you.

This is not a DAO, a vote, a court, a dashboard, or a form. It is one machine
with six panel zones.

## 2. Why GenLayer?

Two judgments here are subjective and must not be faked by a single server:

- Does a new lesson cohere with the principles already learned, or contradict
  them?
- Does a proposed ruling stay inside those principles?

GenLayer runs both as non-deterministic LLM calls and has multiple validators
independently reproduce the interpretation. The contract only changes canonical
state when validators agree on the load-bearing decision field (the relation for
teaching, the consistency boolean for ruling). Comparative validation, never
byte-equality on model prose. Deterministic guards bound the model: only the
keyholder teaches and steps in, principle fields are clamped, a contradiction is
flagged as a tension and never silently blended, and a contradictory ruling is
quarantined and never auto-applied.

## 3. The logic-core-and-bounds metaphor

The core is the identity of the agent: a machined, faceted crystal. Every
accepted principle adds a facet. Load-bearing principles glow cyan and are
"locked." The bounds are those locked principles. The understudy may act
autonomously, but only inside the bounds, and the chain is what enforces the
bound, not a trusted operator. Hard and mechanical throughout, never organic.

## 4. The operating journey

1. Cold Boot. Insert the key, then pull the teach lever to begin.
2. Teaching Console. Teach a few cases at the case slot and reasoning groove.
3. The Core. Watch the core grow facets; read coherence and tensions.
4. The Decision Bay. A situation docks; run the ruling; validators verify.
5. See an accepted ruling pulse cyan and a contradictory one lock amber.
6. The Quarantine. Step in on a held case, optionally teaching a clarifier.
7. The Telemetry Log. Read the record as machine output; export it.

## 5. Intelligent Contract concept

`contracts/UnderstudyContract.py` models the principle set, training cases,
situations, rulings, and quarantine.

Methods:

- `boot` creates the understudy: owner, created_at, empty principle set.
- `teach` (non-deterministic) reads a new case against the existing principles,
  agrees on its relation (coheres / extends / contradicts) and synthesizes one
  compact rule. Coherent or extending cases grow a facet; contradictions are
  recorded as tensions.
- `submit_situation` queues a situation for the understudy to rule on.
- `rule` (non-deterministic) proposes a ruling and verifies consistency with the
  stored principles. Consistent becomes canonical; contradictory is quarantined.
- `step_in` owner-only manual resolution of a quarantined situation, with an
  optional clarifying principle.
- `get_core`, `get_decisions`, `get_quarantine` are the read views.

Principles are stored as compact clamped rules, never raw model prose. Error
classification prefixes (`[EXPECTED]`, `[LLM_ERROR]`) let consensus agree on
failure paths. Timestamps are passed in by the caller for determinism.

## 6. Local mock mode

The console runs fully offline in mock mode with no wallet and no network. The
`MockAdapter` holds the same state the contract would and mirrors the shape of
the chain outcome: a lesson that negates a locked rule is flagged as a tension,
a situation that pushes against a locked principle is quarantined, everything
else is accepted. This is the default, so the demo always works.

## 7. Folder structure

```
src/
  app/                  page.tsx, layout.tsx, globals.css
  components/
    console/            SelectorDial, StatusStrip, KeySwitch, PanelLights, ConsoleWorld
    zones/              ColdBoot, TeachingConsole, Core, DecisionBay, Quarantine, TelemetryLog
    machine/            LogicCore, SituationCartridge, TeachLever, GaugeReadout, MachinedPanel
    ui/                 MachineButton, SlotInput, MetalPanel, EtchLabel
  lib/genlayer/         mockAdapter.ts, contractAdapter.ts, types.ts, index.ts
  store/                useConsoleStore.ts
  data/                 mockCases.ts, mockSituations.ts
  utils/                format.ts, rulingState.ts
contracts/
  UnderstudyContract.py
scripts/
  deploy.mjs, livecheck.mjs
tests/direct/
  conftest.py, test_understudy.py
```

## 8. Running locally

```
npm install
npm run dev
```

Open the dev server URL. The console boots in mock mode. To produce a static
export for hosting:

```
node ./node_modules/next/dist/bin/next build
```

The static site is written to `out/`.

Contract checks:

```
genvm-lint check contracts/UnderstudyContract.py --json
python -m pytest tests/direct/ -p gltest_direct -q
```

## 9. Connecting a real contract

1. Put a funded key in `.env.deploy` (gitignored):
   `GENLAYER_PRIVATE_KEY=...` and `GENLAYER_NETWORK=bradbury`.
2. Deploy: `node scripts/deploy.mjs`. The script records the address.
3. Verify a live read: `node scripts/livecheck.mjs`.
4. Set `.env.local`:
   ```
   NEXT_PUBLIC_UNDERSTUDY_MODE=contract
   NEXT_PUBLIC_UNDERSTUDY_CONTRACT=0x...
   NEXT_PUBLIC_UNDERSTUDY_NETWORK=bradbury
   ```
5. Rebuild. The UI imports only the adapter interface, so nothing else changes.
   In contract mode the Key Switch connects MetaMask (with the GenLayer Snap) if
   present, otherwise a browser burner key for gasless networks.

## 10. Design principles

- Hard, mechanical, instrument-dense. Brushed and anodized metal, etched panel
  lines, machined facets, thin LED edge-glows. Never organic.
- Gunmetal instrument room palette. Signal cyan only for accepted/consistent.
  Hazard amber only for quarantine/contradiction.
- No classic header, footer, dashboard, inbox, or card-grid. Zones of one
  machine selected by a rotary dial with hard detents.
- Precise easing, no soft springs, no strobe. Reduced motion replaces sweeps and
  growth with instant state changes.
- State is never conveyed by color alone: facet state, labels, and engraved
  marks carry it too.
