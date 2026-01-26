/**
 * Frontend error handling utilities
 * Typed error classes matching backend error codes
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "VEIL_ERROR"
  | "RPC_ERROR"
  | "WALLET_ERROR"
  | "TRANSACTION_ERROR"
  | "PROOF_ERROR"
  | "INTERNAL_ERROR";

export interface ErrorDetails {
  [key: string]: unknown;
}

/**
 * Base error class for WhaleVault frontend errors
 */
export class WhaleVaultError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetails;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: ErrorCode = "INTERNAL_ERROR",
    details: ErrorDetails = {},
    isRetryable = false
  ) {
    super(message);
    this.name = "WhaleVaultError";
    this.code = code;
    this.details = details;
    this.isRetryable = isRetryable;
  }
}

/**
 * Wallet connection/signing errors
 */
export class WalletError extends WhaleVaultError {
  constructor(message: string, details: ErrorDetails = {}) {
    super(message, "WALLET_ERROR", details, false);
    this.name = "WalletError";
  }
}

/**
 * Transaction building/sending errors
 */
export class TransactionError extends WhaleVaultError {
  constructor(message: string, details: ErrorDetails = {}, isRetryable = true) {
    super(message, "TRANSACTION_ERROR", details, isRetryable);
    this.name = "TransactionError";
  }
}

/**
 * ZK proof generation errors
 */
export class ProofError extends WhaleVaultError {
  constructor(message: string, details: ErrorDetails = {}, isRetryable = true) {
    super(message, "PROOF_ERROR", details, isRetryable);
    this.name = "ProofError";
  }
}

/**
 * API/network errors
 */
export class APIError extends WhaleVaultError {
  readonly statusCode: number;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode = "INTERNAL_ERROR",
    details: ErrorDetails = {}
  ) {
    const isRetryable = statusCode >= 500 || statusCode === 429;
    super(message, code, details, isRetryable);
    this.name = "APIError";
    this.statusCode = statusCode;
  }
}

/**
 * Map backend error codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Please check your input and try again.",
  NOT_FOUND: "The requested resource could not be found.",
  VEIL_ERROR: "Privacy system error. Please try again.",
  RPC_ERROR: "Network error. Please check your connection.",
  WALLET_ERROR: "Wallet error. Please reconnect your wallet.",
  TRANSACTION_ERROR: "Transaction failed. Please try again.",
  PROOF_ERROR: "Proof generation failed. Please try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again later.",
};

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof WhaleVaultError) {
    return ERROR_MESSAGES[error.code] || error.message;
  }

  if (error instanceof Error) {
    // Handle common wallet errors
    if (error.message.includes("User rejected")) {
      return "Transaction was cancelled.";
    }
    if (error.message.includes("insufficient funds")) {
      return "Insufficient balance for this transaction.";
    }
    if (error.message.includes("blockhash")) {
      return "Transaction expired. Please try again.";
    }
    return error.message;
  }

  return "An unexpected error occurred.";
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof WhaleVaultError) {
    return error.isRetryable;
  }

  if (error instanceof Error) {
    // Network errors are usually retryable
    if (error.message.includes("network") || error.message.includes("timeout")) {
      return true;
    }
    // User rejections are not retryable
    if (error.message.includes("User rejected")) {
      return false;
    }
  }

  return false;
}

/**
 * Parse API error response into typed error
 */
export function parseAPIError(response: {
  error?: { code?: string; message?: string; details?: ErrorDetails };
  status?: number;
}): APIError {
  const error = response.error || {};
  const code = (error.code as ErrorCode) || "INTERNAL_ERROR";
  const message = error.message || "An error occurred";
  const details = error.details || {};
  const status = response.status || 500;

  return new APIError(message, status, code, details);
}
