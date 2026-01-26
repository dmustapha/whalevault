# WhaleVault PRD
## Privacy-First Treasury Migration Tool for Solana

**Version:** 1.0
**Date:** January 25, 2026
**Target:** Solana Privacy Hackathon 2026 ($20,000-$24,500 prize)

---

## 1. Executive Summary

### The Problem
Large Solana wallet holders ("whales") face a critical privacy problem: moving significant funds creates visible on-chain footprints that enable:
- **Front-running** by MEV bots watching mempool
- **Social engineering** attacks based on known holdings
- **Market manipulation** by adversaries tracking whale movements
- **DAO treasury exposure** revealing strategic positions

Current solutions either don't exist on Solana or require complex multi-step processes that whales avoid.

### The Solution
**WhaleVault** is a privacy-first treasury migration tool that enables large holders to shield, transfer, and unshield SOL using zero-knowledge proofs. Built on the Veil SDK, it provides:
- One-click privacy deposits (shield)
- Confidential transfers within the privacy pool
- Anonymous withdrawals to new addresses (unshield)
- Real-time ZK proof generation with visual feedback

### Success Metric
A working demo where a user can:
1. Connect wallet
2. Shield 1 SOL into privacy pool
3. Wait for proof generation (with animated feedback)
4. Unshield to a different address
5. Verify the link is broken on-chain

---

## 2. Solution Overview

### 2.1 Core User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      WhaleVault Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CONNECT          2. SHIELD           3. UNSHIELD        │
│  ┌─────────┐        ┌─────────┐         ┌─────────┐        │
│  │ Phantom │───────▶│ Deposit │────────▶│Withdraw │        │
│  │ Wallet  │        │   SOL   │         │  SOL    │        │
│  └─────────┘        └────┬────┘         └────┬────┘        │
│                          │                    │             │
│                          ▼                    ▼             │
│                    ┌──────────┐         ┌──────────┐       │
│                    │ Generate │         │ Generate │       │
│                    │   Proof  │         │   Proof  │       │
│                    └────┬─────┘         └────┬─────┘       │
│                         │                    │              │
│                         ▼                    ▼              │
│                    ┌──────────┐         ┌──────────┐       │
│                    │Commitment│         │ Nullify  │       │
│                    │ On-Chain │         │ On-Chain │       │
│                    └──────────┘         └──────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Core Features (MVP)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Shield SOL** | Deposit native SOL, receive commitment | P0 |
| **Unshield SOL** | Withdraw with ZK proof to any address | P0 |
| **Wallet Connect** | Phantom, Solflare, Backpack support | P0 |
| **Proof Status** | Real-time generation progress | P0 |
| **Transaction History** | View past shield/unshield ops | P1 |
| **Privacy Calculator** | Estimate anonymity set size | P1 |

### 2.3 What We're NOT Building (MVP)

- ❌ SPL token support (SOL only for MVP)
- ❌ Private transfers between users
- ❌ Relayer network (user pays own gas)
- ❌ Mobile native app
- ❌ Multi-sig support

---

## 3. Technical Architecture

### 3.1 System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│                    (Next.js 14 + TypeScript)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Wallet     │  │   Shield     │  │  Unshield    │         │
│  │   Connect    │  │    Flow      │  │    Flow      │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│         └────────────────┼──────────────────┘                  │
│                          │                                      │
│                          ▼                                      │
│              ┌───────────────────────┐                         │
│              │   @solana/web3.js     │                         │
│              │   @solana/wallet-adapter                        │
│              └───────────┬───────────┘                         │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                        BACKEND                                  │
│                    (FastAPI + Python)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   /shield    │  │  /unshield   │  │   /status    │         │
│  │   endpoint   │  │   endpoint   │  │   endpoint   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│         └────────────────┼──────────────────┘                  │
│                          │                                      │
│                          ▼                                      │
│              ┌───────────────────────┐                         │
│              │      Veil SDK         │                         │
│              │  (Python + Rust FFI)  │                         │
│              └───────────┬───────────┘                         │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                     SOLANA DEVNET                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Privacy    │  │   Merkle     │  │  Nullifier   │         │
│  │    Pool      │  │    Tree      │  │   Registry   │         │
│  │    PDA       │  │    State     │  │    PDAs      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  Program ID: A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy     │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14 + TypeScript | SSR, great DX, Vercel deployment |
| **Styling** | Tailwind CSS + Framer Motion | Rapid UI, smooth animations |
| **Wallet** | @solana/wallet-adapter | Standard Solana wallet integration |
| **Backend** | FastAPI (Python 3.11+) | Async, great for Veil SDK integration |
| **ZK Layer** | Veil SDK | Python bindings to Rust crypto core |
| **On-Chain** | Anchor 0.29 | Solana program framework |
| **Crypto** | Groth16 + BN254 | ~7,000 constraints, ~200k CU |

### 3.3 Data Flow

#### Shield (Deposit) Flow:
```
User → Frontend → Backend.generate_commitment() → Veil SDK
                                                      │
User ← Frontend ← { commitment, proof } ←────────────┘
         │
         ▼
    Sign Transaction
         │
         ▼
    Solana: shield_sol(commitment, amount)
         │
         ▼
    Pool receives SOL, commitment added to Merkle tree
```

#### Unshield (Withdraw) Flow:
```
User → Frontend → Backend.generate_withdraw_proof(nullifier, recipient)
                                                      │
                         Veil SDK generates Groth16 proof
                                                      │
User ← Frontend ← { proof, nullifier } ←─────────────┘
         │
         ▼
    Sign Transaction
         │
         ▼
    Solana: unshield_sol(nullifier, amount, proof)
         │
         ▼
    On-chain verification, nullifier PDA created, SOL sent to recipient
```

### 3.4 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/shield/prepare` | POST | Generate commitment for deposit |
| `POST /api/unshield/proof` | POST | Generate ZK proof for withdrawal |
| `GET /api/pool/status` | GET | Get pool statistics |
| `GET /api/proof/status/{id}` | GET | Check proof generation progress |
| `GET /api/health` | GET | Backend health check |

---

## 4. User Interface & UX

### 4.1 Screen Flow (5 Screens)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   1. CONNECT     2. DASHBOARD    3. SHIELD    4. UNSHIELD  │
│   ┌───────┐      ┌───────────┐   ┌────────┐   ┌──────────┐ │
│   │       │      │Pool Stats │   │ Amount │   │ Position │ │
│   │ Hero  │─────▶│Positions  │──▶│Confirm │──▶│  Amount  │ │
│   │Wallet │      │ Activity  │   │ZK Anim │   │ Confirm  │ │
│   │       │      │           │   │Success │   │ ZK Anim  │ │
│   └───────┘      └───────────┘   └────────┘   └──────────┘ │
│                        │                                    │
│                        ▼                                    │
│                  5. HISTORY                                 │
│                  ┌───────────┐                              │
│                  │ Past Txs  │                              │
│                  │  Export   │                              │
│                  └───────────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Screen Details

#### Screen 1: Connect (Landing)
- Hero section with value proposition
- Animated gradient background
- "Connect Wallet" CTA button
- Supported wallets: Phantom, Solflare, Backpack

#### Screen 2: Dashboard
- **Pool Stats Card:** Total value locked, # of deposits, anonymity set size
- **Your Positions:** List of shielded amounts with timestamps
- **Live Activity Feed:** Recent pool deposits (anonymized, amounts only)
- **Quick Actions:** Shield / Unshield buttons

#### Screen 3: Shield Flow
- Amount input with SOL balance display
- Privacy tooltip (inline calculator)
- Transaction preview (fees, estimated time)
- Confirm button → ZK proof animation → Confetti success

#### Screen 4: Unshield Flow
- Select position to unshield
- Amount input (partial or full)
- Recipient address input
- Confirm → ZK animation → Confetti success

#### Screen 5: History
- Chronological list of all transactions
- Filter by type (shield/unshield)
- Export to CSV

### 4.3 UI Polish Features

| Feature | Implementation |
|---------|----------------|
| **Dark Mode** | Default, with subtle gradients |
| **Animated Background** | Slow-moving gradient mesh |
| **ZK Proof Animation** | Particle system showing "proof generating" |
| **Success Confetti** | Canvas-confetti on successful transactions |
| **Toast Notifications** | Sonner for all status updates |
| **Skeleton Loading** | Shimmer placeholders during data fetch |
| **Mobile Responsive** | Full mobile support, bottom sheet modals |
| **Sound Effects** | Subtle chimes on success/error (optional) |

### 4.4 Component Architecture

```
src/
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── MobileNav.tsx
│   ├── wallet/
│   │   ├── ConnectButton.tsx
│   │   └── WalletModal.tsx
│   ├── dashboard/
│   │   ├── PoolStats.tsx
│   │   ├── PositionsList.tsx
│   │   └── ActivityFeed.tsx
│   ├── shield/
│   │   ├── AmountInput.tsx
│   │   ├── PrivacyTooltip.tsx
│   │   └── ShieldConfirm.tsx
│   ├── unshield/
│   │   ├── PositionSelector.tsx
│   │   ├── RecipientInput.tsx
│   │   └── UnshieldConfirm.tsx
│   ├── shared/
│   │   ├── ProofAnimation.tsx
│   │   ├── SuccessConfetti.tsx
│   │   └── TransactionStatus.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       └── Modal.tsx
├── hooks/
│   ├── useShield.ts
│   ├── useUnshield.ts
│   ├── usePool.ts
│   └── useProofStatus.ts
├── lib/
│   ├── api.ts
│   ├── solana.ts
│   └── utils.ts
└── app/
    ├── page.tsx (landing)
    ├── dashboard/page.tsx
    ├── shield/page.tsx
    ├── unshield/page.tsx
    └── history/page.tsx
```

---

## 5. Security Requirements

### 5.1 Smart Contract Security

| Layer | Protection |
|-------|------------|
| **Double-spend** | Nullifier PDAs - attempting to reuse creates duplicate account error |
| **Overflow** | `overflow-checks = true` in release profile |
| **Authority** | Pool PDA seeds, vault authority validation |
| **Reentrancy** | Anchor's account validation + Solana's execution model |

### 5.2 Cryptographic Security

| Component | Implementation |
|-----------|----------------|
| **ZK Proofs** | Groth16 with BN254 curve, ~128-bit security |
| **Commitments** | Pedersen hash (hiding + binding) |
| **Merkle Tree** | Poseidon hash, depth 20 |
| **Randomness** | OS-level CSPRNG via `rand` crate |

### 5.3 Frontend Security

- **No secret storage** - all sensitive ops in backend/on-chain
- **Wallet adapter** - standard Solana wallet security
- **HTTPS only** - TLS for all API calls
- **Input validation** - amount bounds, address format

### 5.4 Backend Security

- **No private keys** - backend never touches user keys
- **Rate limiting** - prevent proof generation spam
- **Input sanitization** - all user inputs validated
- **Stateless** - no session storage

---

## 6. Success Metrics

### 6.1 Hackathon Demo Metrics (Primary)

| Metric | Target |
|--------|--------|
| Shield SOL | Works in < 30s |
| Unshield SOL | Works in < 45s |
| UI Responsiveness | No jank, smooth animations |
| Error Handling | Graceful failures with clear messages |
| Live Demo | Complete flow without crashes |

### 6.2 Technical Metrics

| Metric | Target |
|--------|--------|
| Proof Generation | < 10 seconds |
| On-chain Verification | < 200k compute units |
| Program Size | < 500KB (currently 307KB ✓) |
| API Latency | < 100ms (excluding proof gen) |

### 6.3 Judging Criteria Alignment

| Criterion | How We Excel |
|-----------|--------------|
| **Innovation** | First whale-focused privacy tool on Solana |
| **Technical** | Real ZK proofs, not mock - verified on-chain |
| **Usability** | Polished UI, clear feedback, one-click flows |
| **Completeness** | Full shield/unshield cycle working |

---

## 7. Development Timeline

### Week 1: Foundation (Jan 12-18)

| Day | Task | Status |
|-----|------|--------|
| 1-2 | Veil SDK verification, program compilation | ✅ Done |
| 3 | Deploy to devnet | ⏳ Need SOL |
| 4-5 | FastAPI backend scaffold + endpoints | ⬜ |
| 6-7 | Next.js frontend scaffold + wallet connect | ⬜ |

### Week 2: Core Features (Jan 19-25)

| Day | Task |
|-----|------|
| 1-2 | Shield flow (frontend → backend → on-chain) |
| 3-4 | Unshield flow complete |
| 5 | Dashboard + positions view |
| 6-7 | Polish: animations, error handling, loading states |

### Week 3: Polish & Demo (Jan 26-30)

| Day | Task |
|-----|------|
| 1-2 | End-to-end testing, bug fixes |
| 3 | Demo video recording |
| 4 | Documentation + README |
| 5 | Submission |

---

## 8. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Proof gen too slow | Medium | High | Pre-generate test proofs, optimize circuit |
| Devnet congestion | Low | Medium | Retry logic, clear user messaging |
| Wallet adapter issues | Low | Low | Test with Phantom, Solflare, Backpack |
| Demo day nerves | Medium | High | Record backup video, practice 5x |

---

## 9. Deliverables Checklist

### Required for Submission
- [ ] Deployed program on devnet
- [ ] Working frontend (Vercel)
- [ ] Working backend (Railway/Render)
- [ ] Demo video (< 3 min)
- [ ] GitHub repo with README
- [ ] Architecture diagram

### Nice to Have
- [ ] Multiple token support (USDC)
- [ ] Transaction history export
- [ ] Mobile PWA

---

## 10. Technical Verification Status

### Completed ✅
- Veil SDK cloned and compiled
- Program builds successfully (307KB)
- Program ID generated: `A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy`
- blake3 compatibility issue resolved (patched to v1.5.0)
- Solana CLI configured for devnet

### Pending ⏳
- Deploy program to devnet (need ~2.14 SOL, have 2 SOL)
- Test shield/unshield on devnet
- Backend integration with Veil SDK
- Frontend development

---

## Appendix A: Key Code References

### Cargo.toml Patch (blake3 Compatibility)
```toml
[profile.release]
overflow-checks = true

[patch.crates-io]
blake3 = { git = "https://github.com/BLAKE3-team/BLAKE3", tag = "1.5.0" }
```

### Program Entry Point
```rust
// crates/program/src/lib.rs
declare_id!("A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy");

#[program]
pub mod veil_program {
    pub fn shield_sol(ctx: Context<ShieldSol>, commitment: [u8; 32], amount: u64) -> Result<()>
    pub fn unshield_sol(ctx: Context<UnshieldSol>, nullifier: [u8; 32], amount: u64, proof: Vec<u8>) -> Result<()>
}
```

---

*Document generated: January 25, 2026*
*Author: Claude Code + Human collaboration*
