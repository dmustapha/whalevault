# Changelog

## v1.0.0

Initial production release.

**Core features**
- ZK shielding: deposit assets into a private pool using Groth16 zkSNARK proofs
- Private transfers: send shielded assets without revealing amounts or counterparties
- Private swaps: swap within the privacy pool
- Nullifier system: on-chain double-spend prevention without revealing note identity
- Merkle tree: incremental depth-20 tree for pool membership proofs (up to ~1M leaves)
- Non-custodial: users hold keys at all times

**Veil SDK**
- Python-first API backed by Rust cryptography via PyO3
- Groth16 zkSNARKs on BN254 curve (~7,000 constraints)
- Poseidon hash (zkSNARK-friendly, circuit-safe)
- Commitment and nullifier generation
- Published on PyPI as veil-solana

**Application**
- Next.js 14 frontend with Tailwind CSS and shadcn/ui
- Python / FastAPI backend with proof queue
- Railway backend deployment, Vercel frontend deployment
- 89 passing tests across application and SDK

**Infrastructure**
- ZK circuits (snarkjs, Groth16)
- GitHub Actions CI
- Docker support
- Architecture and security documentation
