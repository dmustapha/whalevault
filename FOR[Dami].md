# FOR[Dami].md — WhaleVault

> A privacy tool that lets Solana whales move money without anyone knowing it's them.

## The Story

You're building **WhaleVault** for the Solana Privacy Hackathon 2026 ($20k-$24.5k prize pool). The problem is simple: when a whale moves millions in SOL, everyone sees it on-chain. MEV bots front-run them, attackers target them, and their trading strategies get exposed.

WhaleVault fixes this by letting users:
1. **Shield** - Deposit SOL into a privacy pool (it disappears from their wallet)
2. **Wait** - The SOL sits in a shared pool with other deposits
3. **Unshield** - Withdraw to a *completely different* address with no on-chain link

The magic? Zero-knowledge proofs. You prove you deposited without revealing *which* deposit was yours.

---

## How It Works (The 10,000ft View)

Think of WhaleVault like a casino chip system:

```
┌─────────────────────────────────────────────────────────────┐
│                     THE CASINO ANALOGY                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SHIELD (Buy Chips)                                         │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐          │
│  │ Your $   │ ───► │  Casino  │ ───► │  Chip +  │          │
│  │ (SOL)    │      │  Window  │      │  Receipt │          │
│  └──────────┘      └──────────┘      └──────────┘          │
│                                                             │
│  The receipt (commitment) proves you bought chips.          │
│  The secret (blinding factor) is your proof of ownership.   │
│                                                             │
│  UNSHIELD (Cash Out)                                        │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐          │
│  │  Prove   │ ───► │  Casino  │ ───► │  Fresh $ │          │
│  │  Receipt │      │  Window  │      │  (SOL)   │          │
│  └──────────┘      └──────────┘      └──────────┘          │
│                                                             │
│  You prove you have a valid receipt WITHOUT showing which   │
│  one. Casino gives you fresh bills to ANY address you want. │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The "proof" is a **zkSNARK** - a cryptographic magic trick that lets you prove something is true without revealing the details.

---

## The Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        YOUR BROWSER                          │
│  Next.js 14 + TypeScript + Tailwind                         │
│  - Pretty UI with animations                                │
│  - Wallet connection (Phantom, etc.)                        │
│  - Signs transactions (never touches secrets)               │
└─────────────────────────┬───────────────────────────────────┘
                          │ API calls
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      YOUR BACKEND                            │
│  FastAPI (Python)                                           │
│  - Generates commitments and proofs via Veil SDK            │
│  - Veil SDK = Python wrapper around Rust crypto code        │
│  - The "heavy lifting" happens here (~10-30 sec proofs)     │
└─────────────────────────┬───────────────────────────────────┘
                          │ Solana RPC
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    SOLANA BLOCKCHAIN                         │
│  Your Anchor Program (307KB)                                │
│  - Privacy Pool: holds the SOL + Merkle tree of deposits    │
│  - Nullifier Registry: prevents double-spending             │
│  - Verifies ZK proofs on-chain (~200k compute units)        │
│                                                             │
│  Program ID: A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy   │
└─────────────────────────────────────────────────────────────┘
```

**Why this split?**
- Frontend can't do Rust FFI (Veil SDK needs native Rust)
- Backend handles the slow proof generation (users see a loading bar)
- On-chain program is already built (Veil SDK provides it)

---

## Codebase Tour

```
privacy vault/
├── veil/                    # The Veil SDK (you cloned this)
│   ├── crates/
│   │   ├── core/           # Rust crypto: commitments, proofs, encryption
│   │   └── program/        # Solana program (Anchor)
│   ├── src/veil/           # Python SDK that wraps the Rust
│   └── README.md           # Extensive docs on how Veil works
│
├── docs/
│   ├── plans/              # PRD lives here
│   ├── architecture/       # Technical architecture doc
│   └── prompts/            # Prompt log (tracking our conversation)
│
└── (TO BE CREATED)
    ├── frontend/           # Next.js 14 app
    └── backend/            # FastAPI server
```

---

## Tech Decisions

| Tech | Why We Chose It | What We Sacrificed |
|------|-----------------|-------------------|
| **Veil SDK** | Production-ready ZK proofs for Solana, Python API | Locked into their circuit design |
| **Next.js 14** | SSR, great DX, easy Vercel deploy | Heavier than plain React |
| **FastAPI** | Async Python, easy Veil SDK integration | Extra server to manage |
| **Zustand** | Simple state management, no boilerplate | Less structured than Redux |
| **Tailwind** | Rapid UI development | Verbose class names |
| **Devnet** | Free testing, no real money risk | Not production validation |

---

## The Cryptography (Plain English)

### Commitment
When you shield SOL, you get a **commitment** = `amount * G + secret * H`

Think of it as: "I'm putting $100 in a lockbox. Here's a photo of the locked box (commitment). Only I have the key (secret)."

### Nullifier
When you unshield, you reveal a **nullifier** = `hash(secret + leaf_index)`

Think of it as: "Here's proof I own ONE of the lockboxes, but I'm not telling you which one. Oh, and stamp this nullifier so I can't use it again."

### Merkle Tree
All commitments are stored in a **Merkle tree** (depth 20 = ~1 million deposits)

Think of it as: "A giant family tree of all deposits. You can prove you're in the family without revealing which branch."

### Groth16 Proof
The ZK proof system. ~7,000 constraints, generates in ~10-30 seconds.

Think of it as: "A magic seal that proves everything checks out, verified in milliseconds on-chain."

---

## The Bug Chronicles

*This section will be filled as we encounter and solve bugs during implementation.*

### Template for future bugs:
```
**The Case of [Bug Name]**
> *Symptoms*: What you observed
> *Investigation*: What you tried
> *Root Cause*: What was actually wrong
> *The Fix*: How you solved it
> *Lesson*: What you learned
```

### Known Issues Going In:
- **blake3 compatibility**: Veil SDK needed `blake3 = 1.5.0` patch in Cargo.toml (already fixed)
- **Program deployment**: Needs ~2.14 SOL, you have 2 SOL (need to get more devnet SOL)

---

## Things I'm Learning

### Zero-Knowledge Proofs
- **Groth16** is a specific ZK proof system (others: PLONK, STARKs)
- **BN254** is the elliptic curve used (also called alt_bn128)
- **Poseidon** is a ZK-friendly hash function (unlike SHA256)
- Proof generation is slow (seconds), verification is fast (milliseconds)

### Solana-Specific
- **PDAs** (Program Derived Addresses): deterministic addresses for storing state
- **Compute Units**: Solana's gas, ~200k for ZK verification is expensive but doable
- **Anchor**: Framework that makes Solana dev less painful

### Architecture Patterns
- **Optimistic UI**: Show success immediately, confirm later
- **Job queues**: For long-running operations (proof generation)
- **Polling vs WebSockets**: Polling is simpler for short operations

---

## If I Did It Again

*To be filled after the hackathon*

- What architectural decisions would you change?
- What did you over-engineer?
- What did you under-engineer?

---

## Resources That Actually Helped

### Veil SDK
- [Veil README](./veil/README.md) - Comprehensive, start here

### ZK Proofs
- *To be added as you find good resources*

### Solana Development
- *To be added as you find good resources*

### Hackathon Strategy
- *To be added*

---

## Current Status

### Completed
- [x] Veil SDK cloned and compiled
- [x] Program builds successfully (307KB)
- [x] Program ID generated
- [x] blake3 compatibility fixed
- [x] PRD written
- [x] Technical architecture designed

### In Progress
- [ ] Get more devnet SOL (~0.14 more needed)
- [ ] Deploy program to devnet

### Next Up
- [ ] FastAPI backend scaffold
- [ ] Next.js frontend scaffold
- [ ] Shield flow implementation
- [ ] Unshield flow implementation

---

## Quick Commands

```bash
# Build Veil program
cd veil && cargo build --release --workspace

# Run Veil tests
cd veil && cargo test --workspace --release

# Check Solana balance
solana balance

# Get devnet SOL
solana airdrop 2

# Deploy program (when ready)
anchor deploy --provider.cluster devnet
```

---

*Last updated: January 25, 2026*
*Session: Initial planning and architecture*
