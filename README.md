<div align="center">

# The Understudy

**It learns your calls, and makes them when you are away.**

A mechanical control console for bounded autonomous delegation. You teach cases;
an Intelligent Contract stores your logic as a canonical principle set; GenLayer
validators verify every ruling stays inside it.

[![Live Demo](https://img.shields.io/badge/Live_Demo-the--understudy.pages.dev-06b6d4?style=for-the-badge)](https://the-understudy.pages.dev)
[![Network](https://img.shields.io/badge/Network-Testnet_Bradbury-f59e0b?style=for-the-badge)](https://explorer-bradbury.genlayer.com/address/0x8C7Fe645E3017571e79592DF1beE6a7429f6b450)
[![GenLayer](https://img.shields.io/badge/GenLayer-Intelligent_Contract-111827?style=for-the-badge)](https://genlayer.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

---

## 1. Summary

The Understudy is a delegated-agent and consistency guard implemented as a
single Intelligent Contract on GenLayer. It exists to make one class of problem
safe: letting an agent act on your behalf while you are away, without letting it
drift outside your stated judgment.

The operating loop is a datasheet, not a metaphor:

| Stage        | Actor                | Effect on canonical state                                              |
| ------------ | -------------------- | ---------------------------------------------------------------------- |
| Boot         | Owner                | Arms the machine; owner and empty principle set are recorded.          |
| Teach        | Owner                | A case (situation, call, reasoning) is read against the principle set. |
| Grow / Flag  | Validators           | A coherent case adds one clamped principle facet; a contradiction is recorded as a tension, never blended. |
| Submit       | Anyone               | A new situation docks in the decision bay.                             |
| Rule         | Understudy           | The agent proposes a ruling and self-assesses consistency.             |
| Verify       | Validators           | Consistent rulings become canonical actions; contradictory ones are quarantined and held for the owner. |
| Step in      | Owner                | Manual resolution of a quarantined case, with an optional clarifier.   |

A principle is a compact clamped rule. A ruling is a concrete call plus the
consistency verdict that decides whether it may stand. Nothing crosses from
proposal to canonical action without independent validator agreement.

- Live app: https://the-understudy.pages.dev
- Contract (Testnet Bradbury): [`0x8C7Fe645E3017571e79592DF1beE6a7429f6b450`](https://explorer-bradbury.genlayer.com/address/0x8C7Fe645E3017571e79592DF1beE6a7429f6b450)
- Verified live lifecycle on Bradbury: boot -> teach x2 -> submit_situation -> rule (accepted, consistent with principles).

## 2. Consensus model

Bounded autonomous delegation needs a public, auditable boundary that third
parties can check, not a private bot whose operator you must trust. Two
judgments in this system are subjective and cannot be settled by a single
server:

1. Does a newly taught case cohere with, extend, or contradict the principles
   already learned?
2. Does a proposed ruling stay inside those principles?

GenLayer runs both as non-deterministic LLM calls and has multiple validators
independently reproduce the interpretation. Canonical state changes only when
validators agree on the load-bearing field: the relation when teaching, the
consistency boolean when ruling. This is why GenLayer is load-bearing rather
than incidental. The boundary is enforced by consensus, not by an operator who
could quietly redraw it.

Deterministic guards bound the model so autonomy stays inside the fence:

| Guard                     | Rule enforced deterministically                                             |
| ------------------------- | --------------------------------------------------------------------------- |
| Owner-gated authority     | Only the owner (keyholder) may teach or step in.                            |
| No auto-applied conflict  | A contradictory ruling is quarantined and never applied automatically.      |
| Contradictions flagged    | A contradicting lesson is recorded as a tension, never blended into the core. |
| Compact clamped storage   | Principles are stored as short clamped rules, never raw model prose.        |
| Comparative validation    | Validators agree on the decision field, never on byte-equality of prose.    |
| Deterministic coherence   | Coherence is derived from the tension count, so every validator computes it identically. |

## 3. Contract interface

Source: `contracts/UnderstudyContract.py`. Methods marked non-deterministic run
an LLM leader function and a comparative validator function through
`gl.vm.run_nondet_unsafe`.

| Method                                                              | Kind                      | Description                                                                                          |
| ------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `boot(now_ms)`                                                      | write, owner-only         | Arms the understudy: records owner, created_at, coherence 100, empty core.                           |
| `teach(situation, call, why, now_ms)`                              | write, owner-only, nondet | Reads the case against the principle set, agrees the relation (coheres / extends / contradicts), and synthesizes one compact rule. |
| `submit_situation(text, now_ms)`                                   | write                     | Docks a new situation for the understudy to rule on. Open to any caller.                             |
| `rule(situation_id, now_ms, tx_hash)`                              | write, nondet             | Proposes a ruling and verifies consistency with the principles. Consistent becomes canonical; contradictory is quarantined. |
| `step_in(situation_id, decision, clarifying_rule, lock, now_ms)`   | write, owner-only         | Manual resolution of a quarantined situation, with an optional clarifying principle that becomes a facet. |
| `get_summary()`                                                    | view                      | Owner, booted flag, created_at, coherence, and counts of principles, situations, rulings, tensions.  |
| `get_core()`                                                       | view                      | The principle set: all facets, locked (load-bearing) facets, coherence, and recorded tensions.       |
| `get_situations(offset, limit)`                                    | view                      | Paged situations, newest first.                                                                      |
| `get_decisions(offset, limit)`                                     | view                      | Paged rulings, newest first.                                                                         |
| `get_quarantine(offset, limit)`                                    | view                      | Rulings held in quarantine, awaiting owner step-in.                                                  |

Field clamps (defense against unbounded or adversarial input): text 600, rule
240, decision 400, note 240, hash 80, page 20. Bounds: 128 principles, 512
situations. Error classification prefixes `[EXPECTED]` and `[LLM_ERROR]` let
consensus agree on failure paths. Timestamps are supplied by the caller so
every validator sees the same value.

## 4. State machine

A situation and its ruling advance through a fixed lifecycle. The frontend
mirror lives in `src/utils/rulingState.ts`.

```
docked -> scanning -> verifying -> accepted
                                \-> quarantined -> resolved-by-owner
```

| State              | Constant             | Meaning                                                              | Transition                                          |
| ------------------ | -------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| `docked`           | `STATE_DOCKED`       | Situation submitted, awaiting a ruling.                              | `rule` begins the scan.                             |
| `scanning`         | `STATE_SCANNING`     | Understudy proposes a ruling against the principles (leader phase).  | Proceeds to validator reproduction.                 |
| `verifying`        | `STATE_VERIFYING`    | Validators independently reproduce the consistency verdict.          | Agreement resolves to accepted or quarantined.      |
| `accepted`         | `STATE_ACCEPTED`     | Ruling verified consistent; it stands as a canonical action.         | Terminal.                                           |
| `quarantined`      | `STATE_QUARANTINED`  | Ruling could not be verified consistent; held, never auto-applied.   | Owner `step_in` resolves it.                        |
| `resolved-by-owner`| `STATE_RESOLVED`     | Owner stepped in and made the manual call.                           | Terminal.                                           |

The canonical state is derived deterministically from the agreed consistency
boolean, so validators never disagree on where a situation lands.

## 5. Build and run

Requirements: Node 18+ and Python 3 with the GenLayer tooling for contract
checks. The console defaults to mock mode, so it runs fully offline with no
wallet and no network.

```bash
npm install
npm run dev
```

Open the dev server URL. The `MockAdapter` holds the same state the contract
would and mirrors the chain outcome: a lesson that negates a locked rule is
flagged as a tension, a situation that pushes against a locked principle is
quarantined, everything else is accepted.

Contract checks:

```bash
genvm-lint check contracts/UnderstudyContract.py --json
python -m pytest tests/direct/ -p gltest_direct -q
```

### Tech stack

| Layer            | Technology                        | Role                                                      |
| ---------------- | --------------------------------- | --------------------------------------------------------- |
| Framework        | Next.js 14 (static export)        | App shell; exported to static assets for Cloudflare Pages.|
| Language         | TypeScript 5                      | Types across UI, store, and adapters.                     |
| Styling          | Tailwind CSS 3                    | Utility styling for the instrument-dense console.         |
| Motion           | Framer Motion 11                  | Panel transitions, gauge and facet animation.             |
| State            | Zustand 4                         | Console store, single source of UI state.                 |
| Chain client     | genlayer-js 1                     | Reads and writes against the Intelligent Contract.        |
| Contract runtime | GenLayer (Python Intelligent Contract) | Principle set, rulings, consensus-verified state.    |
| Hosting          | Cloudflare Pages                  | Serves the static export.                                 |

## 6. Deployment

The UI imports only the adapter interface (`getAdapter()` in
`src/lib/genlayer/index.ts`), so switching from mock to a live contract changes
configuration only, not application code.

1. Put a funded key in `.env.deploy` (gitignored):
   `GENLAYER_PRIVATE_KEY=...` and `GENLAYER_NETWORK=bradbury`.
2. Deploy: `node scripts/deploy.mjs`. The script records the address.
3. Verify a live read: `node scripts/livecheck.mjs`.
4. Set `.env.local` to point the frontend at the deployed contract:

   ```env
   NEXT_PUBLIC_UNDERSTUDY_MODE=contract
   NEXT_PUBLIC_UNDERSTUDY_CONTRACT=0x8C7Fe645E3017571e79592DF1beE6a7429f6b450
   NEXT_PUBLIC_UNDERSTUDY_NETWORK=bradbury
   ```

5. Rebuild. In contract mode the Key Switch connects MetaMask (with the GenLayer
   Snap) if present, otherwise a browser burner key for gasless networks.

| Environment variable               | Consumed by                     | Purpose                                              |
| ---------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_UNDERSTUDY_MODE`      | `src/lib/genlayer/index.ts`     | `mock` (default) or `contract`.                      |
| `NEXT_PUBLIC_UNDERSTUDY_CONTRACT`  | `src/lib/genlayer/index.ts`     | Deployed contract address for contract mode.         |
| `NEXT_PUBLIC_UNDERSTUDY_NETWORK`   | `src/lib/genlayer/index.ts`     | Target network; use `bradbury` for Testnet Bradbury. |
| `GENLAYER_PRIVATE_KEY`             | `scripts/deploy.mjs` (`.env.deploy`) | Funded deploy key. Never commit this value.     |
| `GENLAYER_NETWORK`                 | `scripts/deploy.mjs` (`.env.deploy`) | Deploy-time network selector.                   |

Never commit `.env.deploy` or any private key. The `.env.deploy` file is
gitignored and must stay that way.
