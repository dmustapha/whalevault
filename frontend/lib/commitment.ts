import { API_BASE_URL } from "./constants";
import type { ComputeCommitmentResponse } from "@/types/api";

/**
 * Computes a commitment from amount and secret via the backend.
 *
 * The commitment is computed as: Poseidon(amount, secret)
 *
 * This is used during shield to:
 * 1. Derive secret from wallet signature
 * 2. Compute commitment using this function
 * 3. Send commitment to backend for shield instruction
 *
 * @param amount - Amount in lamports
 * @param secret - 64-character hex string (32 bytes)
 * @returns The commitment as a 64-character hex string
 */
export async function computeCommitment(
  amount: number,
  secret: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/commitment/compute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, secret }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail || `Failed to compute commitment: ${response.status}`
    );
  }

  const data: ComputeCommitmentResponse = await response.json();
  return data.commitment;
}
