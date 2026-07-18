<div align="center">

# The Understudy

**It learns your calls, and makes them when you are away.**

[![Network](https://img.shields.io/badge/Network-GenLayer_Bradbury-f59e0b?style=flat-square)](https://explorer-bradbury.genlayer.com/address/0x62BcFF6f68be4446C208A4c6B15DB6A6c5a4c6ee)
[![chainId](https://img.shields.io/badge/chainId-4221-6366f1?style=flat-square)](https://explorer-bradbury.genlayer.com)
[![Status](https://img.shields.io/badge/Status-live-16a34a?style=flat-square)](https://the-understudy.pages.dev)
[![Contract](https://img.shields.io/badge/Contract-Python_GenVM-111827?style=flat-square)](contracts/UnderstudyContract.py)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-000000?style=flat-square&logo=next.js)](https://nextjs.org)

</div>

## On-chain proof

- **Contract:** [`0x62BcFF6f68be4446C208A4c6B15DB6A6c5a4c6ee`](https://explorer-bradbury.genlayer.com/address/0x62BcFF6f68be4446C208A4c6B15DB6A6c5a4c6ee)
- **Live app:** [the-understudy.pages.dev](https://the-understudy.pages.dev)
- **Validation:** `genvm-lint` passes; **31 direct tests pass**.
- **Persisted state:** 2 principles, 1 situation, 1 accepted consistent ruling, and 1 queued action.

| Action | Bradbury proof |
| --- | --- |
| Accepted ruling and queued action | [`0x24c65e5e...f8eac`](https://explorer-bradbury.genlayer.com/tx/0x24c65e5e45fd621df63309442660bf43c0b2d2fce59562ec79c8159be2af8eac) |

### Reviewer remediation

Consensus now commits to `decision_canonical` and `action_canonical`, not only a consistency label. Validators independently compare the decision and action substance, require the decision to be grounded in the principle set, and require the action to follow meaningfully from that decision. Exact canonical fields are checked again before persistence. Accepted rulings queue one inspectable structured `Action`; quarantined rulings queue none.

## What it is

The Understudy is a delegated agent that learns to make your calls and acts for you within your stated principles. You teach it small cases in natural language: a situation, the call you made, and your reasoning. Each case is read against the principles it already holds, and a coherent case grows the logic core by one canonical rule.

When a real situation docks while you are away, the understudy proposes a ruling and self-assesses whether that ruling stays inside your principles. The decision only becomes a canonical action when the network agrees it is consistent. Contradictory rulings are never applied silently; they are held for you.

## Why it needs GenLayer

The Understudy is a delegated agent plus a consistency guard. Teach cases become a canonical principle set. When a situation is submitted, the understudy proposes a ruling and validators verify it is consistent with the principles. Consistent rulings become canonical actions; contradictory ones are quarantined. Deciding whether a lesson coheres with existing principles, and whether a proposed ruling stays inside them, is a subjective semantic judgment that a single trusted server could fake. GenLayer runs both steps as non-deterministic LLM calls and has multiple validators independently reproduce the interpretation before canonical state changes.

Deterministic guards bound the model so autonomy stays inside the fence:

- Only the owner may teach the agent or step in.
- Contradictory rulings never auto-apply; they are quarantined and held for the owner.
- Principles are stored as compact clamped rules, never raw model prose.
- Validation is comparative on the load-bearing decision field, never byte-equality of model output.

Consensus now fences the exact text that becomes canonical, not just a label. When teaching, validators rerun the synthesis and must agree on the relation and on the meaning of the compact rule that gets stored, compared by canonical token overlap within tolerance (never byte-equality on prose). When ruling, validators must agree on the consistency verdict and on the substance of the decision text that becomes canonical, and a decision claimed consistent must be grounded in the principle set. An accepted, consensus-verified ruling records a concrete downstream action: it queues a structured on-chain Action (effect, canonical substance, authorizing decision, status) that `get_actions` exposes, so acceptance connects to a real, inspectable effect rather than only carrying a consistent label. Quarantined rulings queue no action.

## Contract

Source: `contracts/UnderstudyContract.py`. Non-deterministic methods run an LLM leader function and a comparative validator function through `gl.vm.run_nondet_unsafe`.

| Method | Kind | Description |
| --- | --- | --- |
| `boot(now_ms)` | write, owner-only | Arms the understudy: records owner, created_at, coherence 100, empty core. |
| `teach(situation, call, why, now_ms)` | write, owner-only, nondet | Reads the case against the principle set, agrees the relation (coheres / extends / contradicts), and synthesizes one compact rule. |
| `submit_situation(text, now_ms)` | write | Docks a new situation for the understudy to rule on. Open to any caller. |
| `rule(situation_id, now_ms, tx_hash)` | write, nondet | Proposes a ruling and verifies consistency with the principles. Consistent becomes canonical; contradictory is quarantined. |
| `step_in(situation_id, decision, clarifying_rule, lock, now_ms)` | write, owner-only | Manual resolution of a quarantined situation, with an optional clarifying principle that becomes a facet. |
| `get_summary()` | view | Owner, booted flag, created_at, coherence, and counts of principles, situations, rulings, actions, tensions. |
| `get_core()` | view | The principle set: all facets, locked (load-bearing) facets, coherence, and recorded tensions. |
| `get_situations(offset, limit)` | view | Paged situations, newest first. |
| `get_decisions(offset, limit)` | view | Paged rulings, newest first. |
| `get_quarantine(offset, limit)` | view | Rulings held in quarantine, awaiting owner step-in. |
| `get_actions(offset, limit)` | view | Paged downstream action log, newest first. Each accepted, consensus-verified ruling queues exactly one structured Action (effect, canonical substance, authorizing decision, status); quarantined rulings queue none. |

## State machine

```
docked -> scanning -> verifying -> accepted
                                \-> quarantined -> resolved-by-owner
```

A situation docks, the understudy scans it against the principles, validators verify the consistency verdict, and the situation resolves to `accepted` or `quarantined`. A quarantined case is resolved by the owner stepping in. The canonical state is derived deterministically from the agreed consistency boolean, so validators never disagree on where a situation lands.

## Run locally

The console defaults to mock mode, so it runs fully offline with no wallet and no network.

```bash
npm install
npm run dev
```

Contract checks:

```bash
genvm-lint check contracts/UnderstudyContract.py --json
python -m pytest tests/direct/ -p gltest_direct -q
```

## Connecting a live contract

The UI imports only the adapter interface, so switching from mock to a live contract is configuration only, not code. Set these in `.env.local`:

```env
NEXT_PUBLIC_UNDERSTUDY_MODE=contract
NEXT_PUBLIC_UNDERSTUDY_CONTRACT=0x62BcFF6f68be4446C208A4c6B15DB6A6c5a4c6ee
NEXT_PUBLIC_UNDERSTUDY_NETWORK=bradbury
```

| Environment variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_UNDERSTUDY_MODE` | `mock` (default) or `contract`. |
| `NEXT_PUBLIC_UNDERSTUDY_CONTRACT` | Deployed contract address for contract mode. |
| `NEXT_PUBLIC_UNDERSTUDY_NETWORK` | Target network; use `bradbury` for Testnet Bradbury. |

## Stack

Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Zustand, and genlayer-js on the frontend. The contract is a Python GenVM Intelligent Contract on GenLayer Testnet Bradbury. Hosted on Cloudflare Pages.
