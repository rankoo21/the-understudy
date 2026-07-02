<div align="center">

# The Understudy

**It learns your calls, and makes them when you are away.**

[![Network](https://img.shields.io/badge/Network-GenLayer_Bradbury-f59e0b?style=flat-square)](https://explorer-bradbury.genlayer.com/address/0x8C7Fe645E3017571e79592DF1beE6a7429f6b450)
[![chainId](https://img.shields.io/badge/chainId-4221-6366f1?style=flat-square)](https://explorer-bradbury.genlayer.com)
[![Status](https://img.shields.io/badge/Status-live-16a34a?style=flat-square)](https://the-understudy.pages.dev)
[![Contract](https://img.shields.io/badge/Contract-Python_GenVM-111827?style=flat-square)](contracts/UnderstudyContract.py)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-000000?style=flat-square&logo=next.js)](https://nextjs.org)

</div>

## On-chain proof

Every stage of the understudy lifecycle below is a real transaction on GenLayer Testnet Bradbury. Follow the explorer links to verify.

**Contract:** [`0x8C7Fe645E3017571e79592DF1beE6a7429f6b450`](https://explorer-bradbury.genlayer.com/address/0x8C7Fe645E3017571e79592DF1beE6a7429f6b450)

### Verified lifecycle on Bradbury

| Step | Method | Transaction |
| --- | --- | --- |
| Arm the machine | `boot` | [`0x836bae0f...86e9c300`](https://explorer-bradbury.genlayer.com/tx/0x836bae0feddd77c386aec354469ec8332136cacbd3b2c8fb9e00b21286e9c300) |
| Teach case 1 | `teach` | [`0x937c4fd2...c9ba9b82`](https://explorer-bradbury.genlayer.com/tx/0x937c4fd210089b331875a2cc43a3e343bc7dc860ca08fce324aef121c9ba9b82) |
| Teach case 2 | `teach` | [`0x91c499d7...e840a70162`](https://explorer-bradbury.genlayer.com/tx/0x91c499d75757e6cefc600444fc7fe74bccb5d1b74df13a01a962d9e840a70162) |
| Dock a situation | `submit_situation` | [`0xb57fbf97...cc88ec8`](https://explorer-bradbury.genlayer.com/tx/0xb57fbf9787f5c52fbb76d45d8ca65b925db803cc62cb33d4a98f1b572cc88ec8) |
| Rule (accepted, consistent with principles) | `rule` | [`0xda85de32...ab1efb84`](https://explorer-bradbury.genlayer.com/tx/0xda85de32a714b846833d15a1c463c43ffef0712a93e4626fda7f551cab1efb84) |

**Live app:** https://the-understudy.pages.dev

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

## Contract

Source: `contracts/UnderstudyContract.py`. Non-deterministic methods run an LLM leader function and a comparative validator function through `gl.vm.run_nondet_unsafe`.

| Method | Kind | Description |
| --- | --- | --- |
| `boot(now_ms)` | write, owner-only | Arms the understudy: records owner, created_at, coherence 100, empty core. |
| `teach(situation, call, why, now_ms)` | write, owner-only, nondet | Reads the case against the principle set, agrees the relation (coheres / extends / contradicts), and synthesizes one compact rule. |
| `submit_situation(text, now_ms)` | write | Docks a new situation for the understudy to rule on. Open to any caller. |
| `rule(situation_id, now_ms, tx_hash)` | write, nondet | Proposes a ruling and verifies consistency with the principles. Consistent becomes canonical; contradictory is quarantined. |
| `step_in(situation_id, decision, clarifying_rule, lock, now_ms)` | write, owner-only | Manual resolution of a quarantined situation, with an optional clarifying principle that becomes a facet. |
| `get_summary()` | view | Owner, booted flag, created_at, coherence, and counts of principles, situations, rulings, tensions. |
| `get_core()` | view | The principle set: all facets, locked (load-bearing) facets, coherence, and recorded tensions. |
| `get_situations(offset, limit)` | view | Paged situations, newest first. |
| `get_decisions(offset, limit)` | view | Paged rulings, newest first. |
| `get_quarantine(offset, limit)` | view | Rulings held in quarantine, awaiting owner step-in. |

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
NEXT_PUBLIC_UNDERSTUDY_CONTRACT=0x8C7Fe645E3017571e79592DF1beE6a7429f6b450
NEXT_PUBLIC_UNDERSTUDY_NETWORK=bradbury
```

| Environment variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_UNDERSTUDY_MODE` | `mock` (default) or `contract`. |
| `NEXT_PUBLIC_UNDERSTUDY_CONTRACT` | Deployed contract address for contract mode. |
| `NEXT_PUBLIC_UNDERSTUDY_NETWORK` | Target network; use `bradbury` for Testnet Bradbury. |

## Stack

Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Zustand, and genlayer-js on the frontend. The contract is a Python GenVM Intelligent Contract on GenLayer Testnet Bradbury. Hosted on Cloudflare Pages.
