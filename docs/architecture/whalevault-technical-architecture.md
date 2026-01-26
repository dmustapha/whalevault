
c1 # WhaleVault Technical Architecture

**Version:** 1.0
**Date:** January 25, 2026
**Status:** Design Complete - Ready for Implementation

---

## 1. Executive Summary

WhaleVault is a privacy-first treasury migration tool for Solana that enables large holders to shield, transfer, and unshield SOL using zero-knowledge proofs. This document provides the complete technical specification for building a working hackathon demo in approximately one week.

The architecture follows a three-tier pattern:
1. **Frontend (Next.js 14)** - User interface and wallet interaction
2. **Backend (FastAPI)** - Proof generation and state management via Veil SDK
3. **On-chain (Anchor)** - Privacy pool with ZK verification

Key design decision: The backend handles all cryptographic operations (commitment generation, proof generation) because the Veil SDK uses Rust FFI which cannot run in browser. The frontend is responsible only for wallet signing and UI state.

---

## 2. Context & Requirements

### 2.1 Stated Requirements
- Shield SOL into privacy pool with commitment generation
- Unshield SOL with ZK proof verification
- Wallet connection (Phantom, Solflare, Backpack)
- Real-time proof generation progress feedback
- Working demo for hackathon judges

### 2.2 Inferred Requirements
- Optimistic UI updates during proof generation (10-30 seconds)
- Graceful handling of RPC failures and timeouts
- Mobile-responsive design
- Clear error messages for on-chain failures
- Transaction history persistence (localStorage for MVP)

### 2.3 Assumptions
1. **A1**: User has sufficient SOL for gas fees (~0.01 SOL per operation)
2. **A2**: Devnet RPC is available and responsive (<2s latency)
3. **A3**: Proof generation completes within 30 seconds
4. **A4**: User keeps browser tab open during proof generation
5. **A5**: One pool instance per deployment (no multi-pool support)
6. **A6**: User trusts the backend with commitment secrets (acceptable for hackathon MVP)

### 2.4 Constraints
- Program size: 307KB (within 500KB limit)
- Compute units: ~200k per verification
- Merkle tree depth: 20 (supports 2^20 = ~1M commitments)
- MVP uses signature-based proofs (96 bytes: 64 sig + 32 pubkey)
- No relayer - user pays own gas

---

## 3. API Contract Design

### 3.1 Base URL
```
Production: https://api.whalevault.app/v1
Development: http://localhost:8000/v1
```

### 3.2 Common Response Envelope

```typescript
// Success Response
{
  "success": true,
  "data": T,
  "timestamp": "2026-01-25T10:30:00Z"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "PROOF_GENERATION_FAILED",
    "message": "Failed to generate ZK proof",
    "details": { ... }  // Optional debug info
  },
  "timestamp": "2026-01-25T10:30:00Z"
}
```

### 3.3 Endpoints

#### POST /api/shield/prepare
Generates commitment for shielding SOL.

**Request:**
```typescript
{
  "amount": number,        // Amount in lamports (1 SOL = 1_000_000_000)
  "depositor": string      // Base58 pubkey of depositor wallet
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "commitment": string,       // Hex-encoded 32-byte commitment
    "secret": string,           // Hex-encoded 64-char secret (STORE SECURELY!)
    "amount": number,           // Echo back amount
    "leafIndex": number | null, // Null until confirmed on-chain
    "instruction": {
      "programId": string,
      "keys": AccountMeta[],
      "data": string            // Base64-encoded instruction data
    }
  }
}
```

**Errors:**
| Code | Message | Cause |
|------|---------|-------|
| `INVALID_AMOUNT` | Amount must be positive | amount <= 0 |
| `AMOUNT_TOO_SMALL` | Minimum shield is 0.001 SOL | amount < 1_000_000 |
| `INVALID_DEPOSITOR` | Invalid Solana address | Bad base58 |

---

#### POST /api/unshield/proof
Generates ZK proof for unshielding SOL. This is a long-running operation.

**Request:**
```typescript
{
  "commitment": string,    // Hex-encoded commitment from shield
  "secret": string,        // Hex-encoded secret from shield
  "amount": number,        // Amount in lamports to unshield
  "recipient": string      // Base58 pubkey of recipient wallet
}
```

**Response (Immediate - returns job ID):**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,           // UUID for polling
    "status": "pending",
    "estimatedTime": 15        // Seconds
  }
}
```

**Errors:**
| Code | Message | Cause |
|------|---------|-------|
| `INVALID_COMMITMENT` | Commitment must be 64 hex chars | Bad format |
| `INVALID_SECRET` | Secret must be 64 hex chars | Bad format |
| `COMMITMENT_NOT_FOUND` | Commitment not in Merkle tree | Never shielded or wrong secret |
| `NULLIFIER_SPENT` | This commitment has already been unshielded | Double-spend attempt |

---

#### GET /api/proof/status/{jobId}
Poll for proof generation status.

**Response (Pending):**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,
    "status": "pending" | "generating" | "completed" | "failed",
    "progress": number,        // 0-100
    "stage": string,           // "initializing" | "computing_witness" | "generating_proof" | "finalizing"
    "estimatedTimeRemaining": number  // Seconds
  }
}
```

**Response (Completed):**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,
    "status": "completed",
    "progress": 100,
    "result": {
      "nullifier": string,     // Hex-encoded 32-byte nullifier
      "proof": string,         // Hex-encoded proof bytes (96 for MVP)
      "amount": number,
      "recipient": string,
      "instruction": {
        "programId": string,
        "keys": AccountMeta[],
        "data": string
      }
    }
  }
}
```

**Response (Failed):**
```typescript
{
  "success": true,
  "data": {
    "jobId": string,
    "status": "failed",
    "error": {
      "code": "PROOF_GENERATION_FAILED",
      "message": "Circuit constraint violation"
    }
  }
}
```

---

#### GET /api/pool/status
Get current pool statistics.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "totalValueLocked": number,      // Lamports in pool
    "totalDeposits": number,         // Number of shield operations
    "totalWithdrawals": number,      // Number of unshield operations
    "anonymitySetSize": number,      // Current # of unspent commitments
    "merkleRoot": string,            // Current root (hex)
    "poolAddress": string,           // Pool PDA address
    "vaultAddress": string           // Vault PDA address
  }
}
```

---

#### GET /api/health
Backend health check.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "solanaConnection": "connected" | "degraded" | "disconnected",
    "rpcLatency": number,            // ms
    "proofWorkerStatus": "ready" | "busy"
  }
}
```

---

### 3.4 Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request body |
| `INVALID_AMOUNT` | 400 | Amount validation failed |
| `INVALID_ADDRESS` | 400 | Invalid Solana address |
| `COMMITMENT_NOT_FOUND` | 404 | Commitment not in pool |
| `JOB_NOT_FOUND` | 404 | Proof job ID not found |
| `NULLIFIER_SPENT` | 409 | Double-spend attempt |
| `POOL_FULL` | 409 | Merkle tree at capacity |
| `PROOF_GENERATION_FAILED` | 500 | Internal proof error |
| `RPC_ERROR` | 502 | Solana RPC failure |
| `TIMEOUT` | 504 | Operation timed out |

---

## 4. Data Models

### 4.1 Frontend State (Zustand Store)

```typescript
// stores/wallet.ts
interface WalletState {
  // Connection
  connected: boolean;
  publicKey: string | null;
  walletName: string | null;  // "Phantom" | "Solflare" | "Backpack"

  // Balance
  balance: number;  // SOL balance in lamports
  balanceLoading: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

// stores/shield.ts
interface ShieldState {
  // Form
  amount: string;  // User input as string

  // Transaction
  status: 'idle' | 'preparing' | 'signing' | 'confirming' | 'success' | 'error';
  commitment: string | null;
  secret: string | null;  // WARNING: Handle securely!
  txSignature: string | null;
  error: string | null;

  // Actions
  setAmount: (amount: string) => void;
  prepareShield: () => Promise<void>;
  confirmShield: (signedTx: Transaction) => Promise<void>;
  reset: () => void;
}

// stores/unshield.ts
interface UnshieldState {
  // Form
  selectedPosition: Position | null;
  amount: string;
  recipient: string;

  // Proof generation
  status: 'idle' | 'generating' | 'signing' | 'confirming' | 'success' | 'error';
  jobId: string | null;
  progress: number;  // 0-100
  stage: string | null;

  // Result
  txSignature: string | null;
  error: string | null;

  // Actions
  selectPosition: (position: Position) => void;
  setAmount: (amount: string) => void;
  setRecipient: (address: string) => void;
  startUnshield: () => Promise<void>;
  pollProofStatus: () => Promise<void>;
  confirmUnshield: (signedTx: Transaction) => Promise<void>;
  reset: () => void;
}

// stores/positions.ts
interface Position {
  id: string;  // Local UUID
  commitment: string;
  secret: string;  // Encrypted in localStorage
  amount: number;
  createdAt: string;
  txSignature: string;
  status: 'pending' | 'confirmed' | 'spent';
}

interface PositionsState {
  positions: Position[];
  loading: boolean;

  // Actions
  addPosition: (position: Omit<Position, 'id'>) => void;
  markSpent: (commitment: string) => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

// stores/pool.ts
interface PoolState {
  totalValueLocked: number;
  totalDeposits: number;
  anonymitySetSize: number;
  loading: boolean;
  lastUpdated: string | null;

  // Actions
  fetchPoolStatus: () => Promise<void>;
}
```

### 4.2 Backend Pydantic Models

```python
# models/requests.py
from pydantic import BaseModel, Field, validator
from typing import Optional
import re

class ShieldPrepareRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Amount in lamports")
    depositor: str = Field(..., min_length=32, max_length=44)

    @validator('depositor')
    def validate_solana_address(cls, v):
        # Base58 alphabet check
        if not re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', v):
            raise ValueError('Invalid Solana address')
        return v

    @validator('amount')
    def validate_minimum(cls, v):
        if v < 1_000_000:  # 0.001 SOL minimum
            raise ValueError('Minimum shield amount is 0.001 SOL')
        return v


class UnshieldProofRequest(BaseModel):
    commitment: str = Field(..., min_length=64, max_length=64)
    secret: str = Field(..., min_length=64, max_length=64)
    amount: int = Field(..., gt=0)
    recipient: str = Field(..., min_length=32, max_length=44)

    @validator('commitment', 'secret')
    def validate_hex(cls, v):
        if not re.match(r'^[0-9a-fA-F]{64}$', v):
            raise ValueError('Must be 64 hex characters')
        return v.lower()

    @validator('recipient')
    def validate_solana_address(cls, v):
        if not re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', v):
            raise ValueError('Invalid Solana address')
        return v


# models/responses.py
from pydantic import BaseModel
from typing import Optional, List, Any
from enum import Enum
from datetime import datetime

class ProofStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"

class ProofStage(str, Enum):
    INITIALIZING = "initializing"
    COMPUTING_WITNESS = "computing_witness"
    GENERATING_PROOF = "generating_proof"
    FINALIZING = "finalizing"

class AccountMeta(BaseModel):
    pubkey: str
    is_signer: bool
    is_writable: bool

class InstructionData(BaseModel):
    program_id: str
    keys: List[AccountMeta]
    data: str  # Base64 encoded

class ShieldPrepareResponse(BaseModel):
    commitment: str
    secret: str
    amount: int
    leaf_index: Optional[int] = None
    instruction: InstructionData

class ProofJobResponse(BaseModel):
    job_id: str
    status: ProofStatus
    estimated_time: int = 15

class ProofStatusResponse(BaseModel):
    job_id: str
    status: ProofStatus
    progress: int = 0
    stage: Optional[ProofStage] = None
    estimated_time_remaining: Optional[int] = None
    result: Optional[dict] = None
    error: Optional[dict] = None

class PoolStatusResponse(BaseModel):
    total_value_locked: int
    total_deposits: int
    total_withdrawals: int
    anonymity_set_size: int
    merkle_root: str
    pool_address: str
    vault_address: str

class HealthResponse(BaseModel):
    status: str
    version: str
    solana_connection: str
    rpc_latency: int
    proof_worker_status: str
```

### 4.3 On-Chain Account Structures

```rust
// Already defined in Veil SDK, documenting interface:

/// Privacy Pool PDA (seeds: ["privacy_pool"])
/// Size: ~1700 bytes
pub struct PrivacyPool {
    pub authority: Pubkey,                    // 32 bytes
    pub merkle_tree: IncrementalMerkleTree,   // 680 bytes (depth 20)
    pub root_history: [[u8; 32]; 30],         // 960 bytes (30 recent roots)
    pub root_history_index: u8,               // 1 byte
    pub nullifier_count: u64,                 // 8 bytes
    pub relayer_fee_bps: u16,                 // 2 bytes
    pub total_fees_collected: u64,            // 8 bytes
    pub bump: u8,                             // 1 byte
}

/// Nullifier Marker PDA (seeds: ["nullifier", pool, nullifier_bytes])
/// Size: 80 bytes (8 discriminator + 72 data)
pub struct NullifierMarker {
    pub pool: Pubkey,           // 32 bytes
    pub nullifier: [u8; 32],    // 32 bytes
    pub spent_at: u64,          // 8 bytes (slot number)
}

/// PDA Derivations:
/// - Pool: Pubkey::find_program_address(["privacy_pool"], program_id)
/// - Vault: Pubkey::find_program_address(["vault", pool.key()], program_id)
/// - Nullifier: Pubkey::find_program_address(["nullifier", pool.key(), nullifier], program_id)
```

---

## 5. State Management

### 5.1 Proof Generation Progress Tracking

The proof generation is a long-running async operation. Here's how we track it:

```
Frontend                    Backend                     Worker
   |                           |                           |
   |-- POST /unshield/proof -->|                           |
   |<-- { jobId, "pending" } --|                           |
   |                           |-- Queue job ------------->|
   |                           |                           |
   |-- GET /proof/status ----->|                           |
   |<-- { progress: 10% } -----|<-- Update progress -------|
   |                           |                           |
   |-- GET /proof/status ----->|                           |
   |<-- { progress: 50% } -----|<-- Update progress -------|
   |                           |                           |
   |-- GET /proof/status ----->|                           |
   |<-- { status: completed }--|<-- Proof ready -----------|
   |                           |                           |
```

**Frontend Polling Strategy:**
```typescript
// hooks/useProofStatus.ts
const POLL_INTERVAL = 1000;  // 1 second
const MAX_POLL_TIME = 60000; // 60 seconds timeout

function useProofStatus(jobId: string | null) {
  const [status, setStatus] = useState<ProofStatus | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const startTime = Date.now();

    const poll = async () => {
      const res = await fetch(`/api/proof/status/${jobId}`);
      const data = await res.json();
      setStatus(data.data);

      if (data.data.status === 'completed' || data.data.status === 'failed') {
        return; // Stop polling
      }

      if (Date.now() - startTime > MAX_POLL_TIME) {
        setStatus({ ...status, status: 'failed', error: { message: 'Timeout' } });
        return;
      }

      setTimeout(poll, POLL_INTERVAL);
    };

    poll();
  }, [jobId]);

  return status;
}
```

### 5.2 Optimistic Updates vs Confirmed State

| Action | Optimistic Update | Confirmed Update |
|--------|-------------------|------------------|
| Shield | Show "pending" position immediately after signing | Update to "confirmed" after RPC confirmation |
| Unshield | Show progress bar during proof gen | Remove position after tx confirmation |
| Pool stats | N/A (always fetched fresh) | Update after any shield/unshield |

```typescript
// Example: Shield flow with optimistic updates
async function handleShield() {
  // 1. Prepare (get commitment from backend)
  const { commitment, secret, instruction } = await prepareShield(amount);

  // 2. Optimistic: Add pending position
  addPosition({
    commitment,
    secret,
    amount,
    status: 'pending',
    createdAt: new Date().toISOString(),
    txSignature: '',
  });

  // 3. Sign and send transaction
  const signature = await signAndSendTransaction(instruction);

  // 4. Update position with signature (still pending)
  updatePosition(commitment, { txSignature: signature });

  // 5. Wait for confirmation
  const confirmed = await waitForConfirmation(signature);

  // 6. Final: Mark as confirmed
  updatePosition(commitment, { status: 'confirmed' });
}
```

### 5.3 Wallet Connection State Machine

```
                    ┌─────────────┐
                    │ Disconnected│
                    └──────┬──────┘
                           │ connect()
                           ▼
                    ┌─────────────┐
                    │ Connecting  │
                    └──────┬──────┘
                           │ success/fail
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │  Connected  │          │   Error     │
       └──────┬──────┘          └──────┬──────┘
              │ disconnect()           │ retry
              │                        │
              └────────────────────────┘
                         │
                         ▼
                    ┌─────────────┐
                    │ Disconnected│
                    └─────────────┘
```

---

## 6. Error Handling Strategy

### 6.1 Frontend Error Boundaries

```typescript
// components/ErrorBoundary.tsx
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to monitoring service
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}

// Usage in layout
<ErrorBoundary>
  <WalletProvider>
    <ShieldFlow />
  </WalletProvider>
</ErrorBoundary>
```

### 6.2 API Error Handling

```typescript
// lib/api.ts
class APIError extends Error {
  code: string;
  details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await res.json();

    if (!data.success) {
      throw new APIError(
        data.error.code,
        data.error.message,
        data.error.details
      );
    }

    return data.data;
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError('NETWORK_ERROR', 'Failed to connect to server');
  }
}
```

### 6.3 On-Chain Error Mapping

```typescript
// lib/errors.ts
const ANCHOR_ERROR_MAP: Record<number, { code: string; message: string }> = {
  // Veil program errors (from instructions.rs)
  6000: { code: 'INVALID_PROOF', message: 'The ZK proof verification failed' },
  6001: { code: 'NULLIFIER_SPENT', message: 'This commitment has already been withdrawn' },
  6002: { code: 'INVALID_AMOUNT', message: 'Invalid amount specified' },
  6003: { code: 'POOL_FULL', message: 'Privacy pool has reached maximum capacity' },
  6004: { code: 'INVALID_ROOT', message: 'Merkle root is not valid or has expired' },
  6005: { code: 'INSUFFICIENT_FUNDS', message: 'Vault has insufficient funds' },

  // Common Anchor errors
  3012: { code: 'ACCOUNT_EXISTS', message: 'Account already exists (double-spend attempt)' },
  2003: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds for transaction' },
};

function parseAnchorError(error: any): { code: string; message: string } {
  // Extract error code from various Anchor error formats
  const errorCode = error?.error?.errorCode?.number
    || error?.InstructionError?.[1]?.Custom
    || error?.logs?.find((l: string) => l.includes('Error Number:'))?.match(/\d+/)?.[0];

  if (errorCode && ANCHOR_ERROR_MAP[errorCode]) {
    return ANCHOR_ERROR_MAP[errorCode];
  }

  // Fallback for unknown errors
  return {
    code: 'UNKNOWN_ERROR',
    message: 'Transaction failed. Please try again.',
  };
}
```

### 6.4 User-Friendly Error Messages

| Technical Error | User Message | Action |
|-----------------|--------------|--------|
| `INVALID_PROOF` | "Verification failed. Please try generating the proof again." | Retry button |
| `NULLIFIER_SPENT` | "This position has already been withdrawn." | Remove from UI |
| `INSUFFICIENT_FUNDS` | "Not enough SOL in your wallet. You need at least X SOL." | Show required amount |
| `NETWORK_ERROR` | "Connection lost. Retrying..." | Auto-retry with backoff |
| `RPC_ERROR` | "Solana network is slow. Please wait..." | Show retry countdown |
| `TIMEOUT` | "This is taking longer than expected. Please try again." | Retry button |

---

## 7. Sequence Diagrams

### 7.1 Shield Flow (Deposit SOL)

```
┌──────┐          ┌──────────┐          ┌──────────┐          ┌────────┐
│ User │          │ Frontend │          │ Backend  │          │ Solana │
└──┬───┘          └────┬─────┘          └────┬─────┘          └───┬────┘
   │                   │                     │                    │
   │ 1. Enter amount   │                     │                    │
   │ ─────────────────>│                     │                    │
   │                   │                     │                    │
   │                   │ 2. POST /shield/prepare                  │
   │                   │ ───────────────────>│                    │
   │                   │                     │                    │
   │                   │                     │ [Generate secret]  │
   │                   │                     │ [Compute commitment│
   │                   │                     │  via Rust FFI]     │
   │                   │                     │                    │
   │                   │ 3. { commitment,    │ (~500ms)           │
   │                   │    secret, ix }     │                    │
   │                   │ <───────────────────│                    │
   │                   │                     │                    │
   │                   │ 4. Build transaction│                    │
   │                   │ [Store secret locally]                   │
   │                   │                     │                    │
   │ 5. Sign request   │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │
   │ 6. [Wallet popup] │                     │                    │
   │    Approve        │                     │                    │
   │ ─────────────────>│                     │                    │
   │                   │                     │                    │
   │                   │ 7. sendTransaction  │                    │
   │                   │ ───────────────────────────────────────>│
   │                   │                     │                    │
   │                   │                     │        [Validate]  │
   │                   │                     │        [Add to tree│
   │                   │                     │        [Transfer $]│
   │                   │                     │                    │
   │                   │ 8. Confirmed        │                    │
   │                   │ <───────────────────────────────────────│
   │                   │                     │         (~2-5s)    │
   │                   │                     │                    │
   │ 9. Success!       │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │

Total time: ~5-10 seconds
- Step 2-3: ~500ms (commitment generation)
- Step 5-6: ~3s (user signing)
- Step 7-8: ~2-5s (on-chain confirmation)
```

### 7.2 Unshield Flow (Withdraw SOL)

```
┌──────┐          ┌──────────┐          ┌──────────┐          ┌────────┐
│ User │          │ Frontend │          │ Backend  │          │ Solana │
└──┬───┘          └────┬─────┘          └────┬─────┘          └───┬────┘
   │                   │                     │                    │
   │ 1. Select position│                     │                    │
   │    Enter recipient│                     │                    │
   │ ─────────────────>│                     │                    │
   │                   │                     │                    │
   │                   │ 2. POST /unshield/proof                  │
   │                   │ ───────────────────>│                    │
   │                   │                     │                    │
   │                   │ 3. { jobId }        │ [Queue proof job]  │
   │                   │ <───────────────────│                    │
   │                   │                     │         (~100ms)   │
   │                   │                     │                    │
   │ 4. [Show loading] │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │
   │                   │ ┌────────────────────────────────────┐   │
   │                   │ │     PROOF GENERATION LOOP          │   │
   │                   │ │  (polling every 1 second)          │   │
   │                   │ └────────────────────────────────────┘   │
   │                   │                     │                    │
   │                   │ 5. GET /proof/status│                    │
   │                   │ ───────────────────>│                    │
   │                   │                     │ [Worker: generate] │
   │                   │ 6. { progress: 30% }│   (~10-30s total)  │
   │ 7. [Update bar]   │ <───────────────────│                    │
   │ <─────────────────│                     │                    │
   │                   │     ... repeat ...  │                    │
   │                   │                     │                    │
   │                   │ 8. { status:        │                    │
   │                   │    completed,       │                    │
   │                   │    proof, nullifier,│                    │
   │                   │    instruction }    │                    │
   │                   │ <───────────────────│                    │
   │                   │                     │                    │
   │                   │ 9. Build transaction│                    │
   │                   │                     │                    │
   │ 10. Sign request  │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │
   │ 11. [Wallet popup]│                     │                    │
   │     Approve       │                     │                    │
   │ ─────────────────>│                     │                    │
   │                   │                     │                    │
   │                   │ 12. sendTransaction │                    │
   │                   │ ───────────────────────────────────────>│
   │                   │                     │                    │
   │                   │                     │   [Verify proof]   │
   │                   │                     │   [Create nullifier│
   │                   │                     │   [Transfer SOL]   │
   │                   │                     │                    │
   │                   │ 13. Confirmed       │                    │
   │                   │ <───────────────────────────────────────│
   │                   │                     │         (~2-5s)    │
   │                   │                     │                    │
   │ 14. Success!      │                     │                    │
   │     [Confetti]    │                     │                    │
   │ <─────────────────│                     │                    │
   │                   │                     │                    │

Total time: ~20-45 seconds
- Step 2-3: ~100ms (job creation)
- Step 5-8: ~10-30s (proof generation)
- Step 10-11: ~3s (user signing)
- Step 12-13: ~2-5s (on-chain confirmation)
```

---

## 8. Deployment Architecture

### 8.1 Infrastructure Overview

```
                    ┌─────────────────────────────────────────────┐
                    │                   VERCEL                     │
                    │  ┌─────────────────────────────────────────┐ │
                    │  │         Next.js 14 Frontend             │ │
                    │  │  - Static assets via Edge CDN           │ │
                    │  │  - SSR for initial page load            │ │
                    │  │  - Client-side routing                  │ │
                    │  └─────────────────────────────────────────┘ │
                    └─────────────────────┬───────────────────────┘
                                          │
                              HTTPS (api.whalevault.app)
                                          │
                    ┌─────────────────────▼───────────────────────┐
                    │              RAILWAY / RENDER                │
                    │  ┌─────────────────────────────────────────┐ │
                    │  │         FastAPI Backend                 │ │
                    │  │  - uvicorn with 2 workers               │ │
                    │  │  - Veil SDK (Python + Rust FFI)         │ │
                    │  │  - In-memory job queue (for MVP)        │ │
                    │  └──────────────────┬──────────────────────┘ │
                    └─────────────────────┼───────────────────────┘
                                          │
                               HTTPS (Solana JSON-RPC)
                                          │
                    ┌─────────────────────▼───────────────────────┐
                    │            SOLANA DEVNET                     │
                    │  ┌─────────────────────────────────────────┐ │
                    │  │  Program: A24NnD...AEy (307KB)          │ │
                    │  │  Pool PDA: derived from seed            │ │
                    │  │  Vault PDA: holds SOL                   │ │
                    │  │  Nullifier PDAs: track spent            │ │
                    │  └─────────────────────────────────────────┘ │
                    └─────────────────────────────────────────────┘
```

### 8.2 Environment Variables

#### Frontend (.env.local)
```bash
# API
NEXT_PUBLIC_API_URL=https://api.whalevault.app/v1
NEXT_PUBLIC_API_URL_DEV=http://localhost:8000/v1

# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy

# Feature flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

#### Backend (.env)
```bash
# Server
HOST=0.0.0.0
PORT=8000
WORKERS=2
DEBUG=false

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy

# Pool authority (for pool initialization only - remove after init)
# POOL_AUTHORITY_KEYPAIR=<base58 encoded keypair>

# Proof generation
PROOF_TIMEOUT_SECONDS=60
MAX_CONCURRENT_PROOFS=2

# CORS
CORS_ORIGINS=https://whalevault.app,http://localhost:3000

# Logging
LOG_LEVEL=INFO
```

### 8.3 CORS Configuration

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="WhaleVault API", version="1.0.0")

# CORS settings
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    max_age=3600,  # Cache preflight for 1 hour
)
```

### 8.4 Deployment Commands

```bash
# Frontend (Vercel)
# Automatic via GitHub integration, or:
vercel --prod

# Backend (Railway)
# railway.json or Procfile:
web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2

# Backend (Render)
# render.yaml:
services:
  - type: web
    name: whalevault-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: SOLANA_RPC_URL
        value: https://api.devnet.solana.com
```

---

## 9. File/Folder Structure

### 9.1 Frontend (Next.js 14 App Router)

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Landing page (connect wallet CTA)
│   ├── globals.css             # Tailwind imports + custom vars
│   ├── dashboard/
│   │   └── page.tsx            # Main dashboard after connect
│   ├── shield/
│   │   └── page.tsx            # Shield flow
│   ├── unshield/
│   │   └── page.tsx            # Unshield flow
│   └── history/
│       └── page.tsx            # Transaction history
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # Navigation + wallet button
│   │   ├── Footer.tsx          # Links, version
│   │   └── MobileNav.tsx       # Bottom nav for mobile
│   │
│   ├── wallet/
│   │   ├── WalletProvider.tsx  # Solana wallet adapter setup
│   │   ├── ConnectButton.tsx   # Connect/disconnect button
│   │   └── WalletModal.tsx     # Wallet selection modal
│   │
│   ├── dashboard/
│   │   ├── PoolStats.tsx       # TVL, deposits, anonymity set
│   │   ├── PositionsList.tsx   # User's shielded positions
│   │   ├── PositionCard.tsx    # Single position display
│   │   └── ActivityFeed.tsx    # Recent pool activity
│   │
│   ├── shield/
│   │   ├── ShieldForm.tsx      # Amount input + balance
│   │   ├── AmountInput.tsx     # SOL amount with max button
│   │   └── ShieldConfirm.tsx   # Review + sign modal
│   │
│   ├── unshield/
│   │   ├── UnshieldForm.tsx    # Position + recipient form
│   │   ├── PositionSelector.tsx# Select position dropdown
│   │   ├── RecipientInput.tsx  # Address input with validation
│   │   └── UnshieldConfirm.tsx # Review + sign modal
│   │
│   ├── proof/
│   │   ├── ProofProgress.tsx   # Progress bar + stage text
│   │   └── ProofAnimation.tsx  # Animated particles/orbs
│   │
│   ├── feedback/
│   │   ├── SuccessConfetti.tsx # Canvas confetti on success
│   │   ├── ErrorDisplay.tsx    # Error message with retry
│   │   └── Toast.tsx           # Toast notifications (Sonner)
│   │
│   └── ui/                     # Shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── progress.tsx
│       └── skeleton.tsx
│
├── hooks/
│   ├── useShield.ts            # Shield flow logic
│   ├── useUnshield.ts          # Unshield flow logic
│   ├── useProofStatus.ts       # Proof polling
│   ├── usePool.ts              # Pool stats fetching
│   ├── usePositions.ts         # Position management
│   └── useWallet.ts            # Wallet state wrapper
│
├── stores/
│   ├── wallet.ts               # Zustand wallet store
│   ├── shield.ts               # Zustand shield store
│   ├── unshield.ts             # Zustand unshield store
│   ├── positions.ts            # Zustand positions store
│   └── pool.ts                 # Zustand pool store
│
├── lib/
│   ├── api.ts                  # API client with error handling
│   ├── solana.ts               # Solana utilities (PDA derivation)
│   ├── errors.ts               # Error mapping
│   ├── storage.ts              # LocalStorage with encryption
│   ├── utils.ts                # General utilities
│   └── constants.ts            # Program ID, seeds, etc.
│
├── types/
│   ├── api.ts                  # API request/response types
│   ├── position.ts             # Position types
│   └── pool.ts                 # Pool types
│
├── public/
│   ├── logo.svg
│   ├── whale-icon.svg
│   └── og-image.png
│
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

### 9.2 Backend (FastAPI)

```
backend/
├── main.py                     # FastAPI app entry point
│
├── api/
│   ├── __init__.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── shield.py           # POST /api/shield/prepare
│   │   ├── unshield.py         # POST /api/unshield/proof
│   │   ├── proof.py            # GET /api/proof/status/{id}
│   │   ├── pool.py             # GET /api/pool/status
│   │   └── health.py           # GET /api/health
│   │
│   └── middleware/
│       ├── __init__.py
│       ├── error_handler.py    # Global exception handling
│       └── logging.py          # Request logging
│
├── models/
│   ├── __init__.py
│   ├── requests.py             # Pydantic request models
│   ├── responses.py            # Pydantic response models
│   └── errors.py               # Error codes and messages
│
├── services/
│   ├── __init__.py
│   ├── veil_service.py         # Veil SDK wrapper
│   ├── proof_service.py        # Proof generation management
│   ├── pool_service.py         # Pool state fetching
│   └── solana_service.py       # Solana RPC client
│
├── workers/
│   ├── __init__.py
│   └── proof_worker.py         # Background proof generation
│
├── utils/
│   ├── __init__.py
│   ├── validation.py           # Input validation helpers
│   └── encoding.py             # Hex/base58 conversion
│
├── config.py                   # Settings from environment
├── requirements.txt
├── Dockerfile
└── .env.example
```

### 9.3 Key Files and Responsibilities

| File | Responsibility |
|------|----------------|
| `frontend/app/layout.tsx` | Root layout with WalletProvider, Toaster, error boundary |
| `frontend/components/wallet/WalletProvider.tsx` | Solana wallet adapter configuration |
| `frontend/stores/positions.ts` | Position CRUD with localStorage persistence |
| `frontend/hooks/useProofStatus.ts` | Proof polling with timeout and error handling |
| `frontend/lib/api.ts` | Typed API client with automatic error parsing |
| `backend/main.py` | FastAPI app with CORS, routes, middleware |
| `backend/services/veil_service.py` | Wraps Veil SDK for commitment/proof generation |
| `backend/workers/proof_worker.py` | Async proof generation with progress updates |
| `backend/api/routes/unshield.py` | Creates proof jobs, returns job ID |
| `backend/api/routes/proof.py` | Returns proof status and results |

---

## 10. Alternatives Considered

### 10.1 Client-Side Proof Generation

**Description:** Generate ZK proofs in the browser using WASM.

**Pros:**
- No backend dependency for proofs
- User secrets never leave the browser
- Simpler deployment (static site only)

**Cons:**
- Veil SDK uses Rust FFI, not WASM-compatible without significant work
- Browser memory constraints for large circuits
- Inconsistent performance across devices

**When to choose:** If Veil SDK had WASM bindings and we had 2+ weeks.

---

### 10.2 WebSocket for Proof Status

**Description:** Use WebSocket instead of polling for proof progress.

**Pros:**
- Real-time updates without polling overhead
- Lower latency for status changes

**Cons:**
- More complex backend state management
- Connection management complexity
- Overkill for 10-30 second operations

**When to choose:** If we had multiple concurrent proof operations per user.

---

### 10.3 Redis for Job Queue

**Description:** Use Redis instead of in-memory queue for proof jobs.

**Pros:**
- Persistent across server restarts
- Horizontally scalable
- Shared state across workers

**Cons:**
- Additional infrastructure dependency
- Overkill for hackathon demo
- Added complexity

**When to choose:** For production deployment with high concurrency.

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Proof generation exceeds 30s | Medium | High | Show progress stages, set user expectations, implement timeout with graceful failure |
| Devnet RPC rate limiting | Low | Medium | Implement exponential backoff, use backup RPC endpoint |
| User closes tab during proof gen | Medium | Medium | Store job ID in localStorage, allow resume on return |
| Wallet adapter compatibility issues | Low | Medium | Test with top 3 wallets, graceful fallback to manual signing |
| Secret exposure in localStorage | Medium | High | Encrypt secrets with user-derived key, warn users about browser security |
| Backend single point of failure | High | High | Accept for MVP, document Railway/Render auto-restart |
| Program compute budget exceeded | Low | High | Already tested at ~200k CU, within 1.4M limit |
| Mobile UX issues | Medium | Low | Test on iPhone/Android, ensure touch targets are large enough |

---

## 12. Open Questions

### High Priority (Must Answer Before Implementation)

1. **Secret Storage**: Should we encrypt position secrets in localStorage? What key derivation method?
   - Recommendation: Use wallet signature as encryption key seed

2. **Proof Job Expiry**: How long do we keep completed proof jobs in memory?
   - Recommendation: 5 minutes, then require re-generation

3. **Position Sync**: Should positions sync across devices/browsers?
   - Recommendation: No for MVP, localStorage only with export/import option

### Medium Priority (Can Decide During Implementation)

4. **Pool Stats Caching**: How fresh must pool stats be?
   - Recommendation: 30-second cache, refresh on shield/unshield

5. **Transaction History**: On-chain query vs localStorage?
   - Recommendation: localStorage for MVP, with tx signature for verification

6. **Error Retry Strategy**: Automatic retry on RPC errors?
   - Recommendation: 3 retries with exponential backoff (1s, 2s, 4s)

### Low Priority (Polish Phase)

7. **Analytics**: Track proof generation times for optimization?
8. **Sound Effects**: Include on success/error?
9. **Dark/Light Mode**: Support theme toggle?

---

## Appendix A: Program ID and PDAs

```typescript
// Constants
const PROGRAM_ID = "A24NnDgenymQHS8FsNX7gnGgj8gfW7EWLyoxfsjHrAEy";

// PDA Derivations (using @solana/web3.js)
function getPoolPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("privacy_pool")],
    programId
  );
}

function getVaultPDA(programId: PublicKey, pool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), pool.toBuffer()],
    programId
  );
}

function getNullifierPDA(
  programId: PublicKey,
  pool: PublicKey,
  nullifier: Buffer
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nullifier"), pool.toBuffer(), nullifier],
    programId
  );
}
```

---

## Appendix B: Instruction Discriminators

```typescript
// From Veil SDK - first 8 bytes of sha256("global:<instruction_name>")
const DISCRIMINATORS = {
  initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  shieldSol: Buffer.from([183, 4, 24, 123, 20, 45, 203, 91]),
  shield: Buffer.from([112, 186, 93, 111, 79, 168, 36, 51]),
  transfer: Buffer.from([163, 52, 200, 231, 140, 3, 69, 186]),
  unshieldSol: Buffer.from([45, 127, 188, 9, 224, 78, 199, 57]),
  unshield: Buffer.from([126, 89, 240, 247, 56, 193, 126, 10]),
};
```

---

*Document generated: January 25, 2026*
*Ready for implementation review*
