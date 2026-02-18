# WhaleVault — Privacy Layer for Solana

Shield, send, and swap Solana assets using zero-knowledge proofs.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF)](https://solana.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

![WhaleVault Landing](docs/images/landing.png)

## Live Demo

**[whalevault.vercel.app](https://whalevault.vercel.app)**

## Demo Video

[![WhaleVault Demo](https://img.youtube.com/vi/S7Zvx2GeAYY/maxresdefault.jpg)](https://youtu.be/S7Zvx2GeAYY?si=tH4070I5h9osjW_z)

---

## What Is WhaleVault?

WhaleVault is a privacy layer for Solana. Deposit assets into a private pool and your transactions become verifiable on-chain without revealing the amounts or the parties involved. You prove you own a valid deposit without revealing which one or how much.

---

## Screenshots

![Dashboard](docs/images/dashboard.png)

| Shield | Send | Swap |
|--------|------|------|
| ![Shield](docs/images/shield.png) | ![Send](docs/images/send.png) | ![Swap](docs/images/swap.png) |

---

## Features

- **ZK shielding**: Deposit assets into a private pool using zkSNARK proofs
- **Private transfers**: Send shielded assets to any address without revealing the amount
- **Private swaps**: Swap within the privacy pool
- **Nullifier system**: Prevents double-spending inside the pool
- **Merkle tree**: Cryptographic proof of inclusion without revealing identity
- **Non-custodial**: You hold your keys at all times

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Blockchain | Solana Web3.js |
| Privacy | Zero-Knowledge Proofs (zkSNARKs) |
| State | Zustand |
| UI | shadcn/ui |
| Deployment | Vercel |

---

## Testing the App

WhaleVault runs on Solana devnet. No real SOL needed.

---

### Step 1: Get a Solana wallet

Install **[Phantom](https://phantom.app)** (browser extension or mobile). Create a new wallet and save your seed phrase.

Switch Phantom to devnet:
- Open Phantom
- Go to Settings > Developer Settings > Change Network
- Select **Devnet**

---

### Step 2: Get devnet SOL

You need devnet SOL to pay for transaction fees.

Go to **[faucet.solana.com](https://faucet.solana.com)**, paste your devnet wallet address, and request an airdrop. You will receive test SOL within seconds.

Alternatively, run this from the terminal if you have the Solana CLI:

```bash
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

---

### Step 3: Connect your wallet

Go to [whalevault.vercel.app](https://whalevault.vercel.app) and click **Connect Wallet**. Select Phantom and approve the connection.

---

### Step 4: Shield assets

Shielding moves your SOL from your public wallet into the private pool. Once shielded, the amount and your identity are hidden from on-chain observers.

1. Click **Shield** in the sidebar
2. Enter the amount of SOL to shield
3. Approve the transaction in Phantom
4. WhaleVault generates a ZK proof client-side and submits a commitment to the on-chain Merkle tree
5. You receive a private note. Save it. This note is the only way to prove ownership of your shielded funds.

---

### Step 5: Send privately

Send shielded assets to any Solana address without revealing the amount or linking it to your original wallet.

1. Click **Send**
2. Enter the recipient address and amount
3. WhaleVault generates a ZK proof that you own a valid deposit
4. A nullifier is submitted on-chain to prevent double-spending
5. The recipient receives the SOL with no visible link to your original deposit

---

### Step 6: Swap within the pool

Swap one shielded asset for another without leaving the privacy pool.

1. Click **Swap**
2. Select input and output tokens and enter the amount
3. Approve the swap
4. The swap happens inside the pool. No public transaction links the input to the output.

---

## How It Works

```
User deposits SOL/tokens
        |
        v
ZK proof generated client-side
(proves ownership without revealing amount)
        |
        v
Commitment added to on-chain Merkle tree
(verifiable but private)
        |
        v
Nullifier stored to prevent double-spend
        |
        v
User withdraws to any address with a fresh ZK proof
```

---

## Running Locally

```bash
git clone https://github.com/dmustapha/whalevault.git
cd whalevault
npm install
cp .env.example .env.local
npm run dev
```

---

## Architecture

```
src/
├── app/              # Next.js App Router pages
├── components/       # UI components
│   ├── shield/       # Shielding interface
│   ├── send/         # Private transfer
│   └── swap/         # Private swap
├── lib/
│   ├── zk/           # ZK proof generation and verification
│   ├── solana/       # Solana Web3.js integration
│   └── merkle/       # Merkle tree implementation
└── stores/           # Zustand state management
```

---

## License

MIT
