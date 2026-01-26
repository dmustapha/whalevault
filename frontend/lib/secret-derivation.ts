"use client";

import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { Position } from "@/types";

/**
 * Derives deterministic secrets from wallet signatures.
 *
 * Key insight: The secret must be derived BEFORE the commitment is created.
 * We use a nonce (timestamp + uuid) as the basis for derivation, then use
 * the derived secret to compute the commitment.
 *
 * Flow:
 * 1. Shield: Generate nonce → Sign message → Derive secret → Compute commitment
 * 2. Unshield: Use stored nonce → Sign message → Derive same secret → Generate proof
 *
 * Security properties:
 * - Deterministic: Same nonce + wallet always produces same secret
 * - Unforgeable: Only the wallet owner can sign the message
 * - Non-transferable: Secret is bound to the specific wallet
 */

const DOMAIN_SEPARATOR = "WhaleVault Shield";
const VERSION = 1;
const CHAIN_ID = "solana-devnet";

/**
 * Constructs the message to be signed for secret derivation.
 * Uses nonce (not commitment) as the binding value.
 */
function constructSignMessage(nonce: string): Uint8Array {
  const message = [
    DOMAIN_SEPARATOR,
    `Nonce: ${nonce}`,
    `Chain ID: ${CHAIN_ID}`,
    `Version: ${VERSION}`,
  ].join("\n");

  return new TextEncoder().encode(message);
}

/**
 * Converts a Uint8Array to a hex string.
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derives a secret from a wallet signature using HKDF-SHA256.
 *
 * @param signature - The 64-byte signature from the wallet
 * @param nonce - The nonce (used as salt for domain separation)
 * @returns 32-byte derived secret as hex string
 */
async function deriveSecretFromSignature(
  signature: Uint8Array,
  nonce: string
): Promise<string> {
  // Import signature as key material for HKDF
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    signature.buffer.slice(
      signature.byteOffset,
      signature.byteOffset + signature.byteLength
    ) as ArrayBuffer,
    "HKDF",
    false,
    ["deriveBits"]
  );

  // Use nonce as salt for domain separation
  const encoder = new TextEncoder();
  const salt = encoder.encode(nonce);
  const info = encoder.encode("whalevault-secret-v1");

  // Derive 32 bytes (256 bits) using HKDF-SHA256
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt.buffer.slice(
        salt.byteOffset,
        salt.byteOffset + salt.byteLength
      ) as ArrayBuffer,
      info: info.buffer.slice(
        info.byteOffset,
        info.byteOffset + info.byteLength
      ) as ArrayBuffer,
    },
    keyMaterial,
    256
  );

  // Convert to hex string
  return toHex(new Uint8Array(derivedBits));
}

/**
 * Generates a unique nonce for a new shield operation.
 * Format: "{timestamp}-{uuid}"
 */
export function generateNonce(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

/**
 * Derives a secret for a new shield operation.
 *
 * This is called during shield BEFORE the commitment is created:
 * 1. Generate nonce
 * 2. Sign message with nonce
 * 3. Derive secret from signature
 * 4. Use secret to compute commitment (via backend)
 *
 * @param wallet - The connected wallet
 * @param nonce - The nonce for this shield operation
 * @returns The derived secret as a hex string
 */
export async function deriveShieldSecret(
  wallet: WalletContextState,
  nonce: string
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  if (!wallet.signMessage) {
    throw new Error(
      "Wallet does not support message signing. Please use a wallet that supports signMessage (Phantom, Solflare, etc.)"
    );
  }

  const message = constructSignMessage(nonce);

  try {
    console.log("[SecretDerivation] Requesting signature for shield secret");
    const signature = await wallet.signMessage(message);
    const secret = await deriveSecretFromSignature(signature, nonce);
    console.log("[SecretDerivation] Shield secret derived successfully");
    return secret;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("User rejected") ||
        error.message.includes("rejected"))
    ) {
      throw new Error("Signature required to shield funds");
    }
    throw error;
  }
}

/**
 * Derives a secret for unshielding using the position's stored nonce.
 *
 * @param nonce - The nonce stored with the position
 * @param wallet - The connected wallet
 * @returns The derived secret as a hex string
 */
async function deriveSecretFromNonce(
  nonce: string,
  wallet: WalletContextState
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  if (!wallet.signMessage) {
    throw new Error(
      "Wallet does not support message signing. Please use a wallet that supports signMessage (Phantom, Solflare, etc.)"
    );
  }

  const message = constructSignMessage(nonce);

  try {
    console.log("[SecretDerivation] Requesting signature for unshield");
    const signature = await wallet.signMessage(message);
    const secret = await deriveSecretFromSignature(signature, nonce);
    console.log("[SecretDerivation] Unshield secret derived successfully");
    return secret;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("User rejected") ||
        error.message.includes("rejected"))
    ) {
      throw new Error("Signature required to unshield this position");
    }
    throw error;
  }
}

/**
 * Checks if a position has a legacy stored secret.
 * Used for migration from localStorage-based secrets.
 */
export function hasLegacySecret(position: Position): boolean {
  return typeof position.secret === "string" && position.secret.length > 0;
}

/**
 * Checks if a position uses the new nonce-based derivation.
 */
export function hasNonce(position: Position): boolean {
  return typeof position.nonce === "string" && position.nonce.length > 0;
}

/**
 * Gets the secret for a position, handling both legacy and nonce-based derivation.
 *
 * Priority:
 * 1. If position has nonce → derive from nonce (new flow)
 * 2. If position has legacy secret → use stored secret (legacy flow)
 * 3. Otherwise → error (position is incompatible)
 *
 * @param position - The position to get secret for
 * @param wallet - The connected wallet
 * @returns The secret (either stored or derived)
 */
export async function getPositionSecret(
  position: Position,
  wallet: WalletContextState
): Promise<string> {
  // New flow: position has nonce for derivation
  if (hasNonce(position)) {
    console.log("[SecretDerivation] Deriving secret from nonce");
    return deriveSecretFromNonce(position.nonce!, wallet);
  }

  // Legacy flow: position has stored secret
  if (hasLegacySecret(position)) {
    console.log("[SecretDerivation] Using legacy stored secret");
    return position.secret!;
  }

  // Incompatible position - no way to recover secret
  throw new Error(
    "This position cannot be unshielded. It was created without a nonce and has no stored secret."
  );
}

// ============================================================================
// DEPRECATED - These functions are kept for backward compatibility
// ============================================================================

/**
 * @deprecated Use deriveShieldSecret for shield and getPositionSecret for unshield
 */
export async function deriveSecret(
  commitment: string,
  wallet: WalletContextState
): Promise<string> {
  console.warn(
    "[SecretDerivation] deriveSecret is deprecated. Use deriveShieldSecret or getPositionSecret."
  );

  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  if (!wallet.signMessage) {
    throw new Error("Wallet does not support message signing");
  }

  // Legacy: use commitment as nonce (won't work for new positions)
  const message = new TextEncoder().encode(
    [
      "WhaleVault Position",
      `Commitment: ${commitment}`,
      `Chain ID: ${CHAIN_ID}`,
      `Version: ${VERSION}`,
    ].join("\n")
  );

  const signature = await wallet.signMessage(message);
  return deriveSecretFromSignature(signature, commitment);
}
