"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { useShield } from "@/hooks/useShield";
import { useConfetti } from "@/hooks/useConfetti";
import { formatAmount } from "@/lib/utils";
import { SUPPORTED_TOKENS, LAMPORTS_PER_SOL, type SupportedToken } from "@/lib/constants";

export default function ShieldPage() {
  const router = useRouter();
  const { connected, balance } = useWallet();
  const { status, error, txSignature, shield, reset } = useShield();
  const { fire: fireConfetti } = useConfetti();

  const [selectedToken, setSelectedToken] = useState<SupportedToken>(SUPPORTED_TOKENS[0]);
  const [amount, setAmount] = useState("");

  const isLoading = status === "preparing" || status === "signing" || status === "confirming";

  // Handle success/error with toast
  useEffect(() => {
    if (status === "success") {
      fireConfetti();
      toast.success("Assets shielded successfully!", {
        description: `Transaction: ${txSignature?.slice(0, 8)}...`,
      });
      setAmount("");
      reset();
      setTimeout(() => router.push("/dashboard"), 1500);
    } else if (status === "error" && error) {
      toast.error("Failed to shield assets", {
        description: error,
      });
    }
  }, [status, error, txSignature, reset, router, fireConfetti]);

  const handleShield = async () => {
    if (!connected) {
      toast.error("Please connect your wallet first");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (numAmount > balance) {
      toast.error("Insufficient balance");
      return;
    }

    const lamports = Math.floor(numAmount * LAMPORTS_PER_SOL);
    await shield(lamports);
  };

  const getButtonText = () => {
    switch (status) {
      case "preparing":
        return "Preparing transaction...";
      case "signing":
        return "Waiting for signature...";
      case "confirming":
        return "Confirming on chain...";
      default:
        return amount ? `Shield ${amount} ${selectedToken.symbol}` : "Shield Assets";
    }
  };

  const handleMaxClick = () => {
    if (balance > 0) {
      setAmount(balance.toString());
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-12 h-12 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Connect Your Wallet
          </h1>
          <p className="text-gray-400 mb-6">
            Connect your wallet to shield your assets
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Shield Assets</h1>
        <p className="text-gray-400">
          Convert your public assets into shielded, privacy-protected positions.
        </p>
      </motion.div>

      <Card gradient>
        <CardHeader>
          <h2 className="text-xl font-semibold text-white">Shield</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Select Token
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SUPPORTED_TOKENS.map((token) => (
                <button
                  key={token.mint}
                  onClick={() => setSelectedToken(token)}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    selectedToken.mint === token.mint
                      ? "border-whale-500 bg-whale-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">
                      {token.symbol.charAt(0)}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">{token.symbol}</div>
                    <div className="text-sm text-gray-400">{token.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">Amount</label>
              <span className="text-sm text-gray-400">
                Balance: {formatAmount(balance, 4)} {selectedToken.symbol}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-4 pr-20 rounded-xl bg-white/5 border border-white/10 text-white text-xl placeholder:text-gray-500 focus:outline-none focus:border-whale-500 transition-colors"
              />
              <button
                onClick={handleMaxClick}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-whale-500/20 text-whale-400 text-sm font-medium hover:bg-whale-500/30 transition-colors"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-vault-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm text-gray-300">
                  Shielding converts your tokens into a privacy-protected
                  position. You can unshield at any time to convert back to
                  regular tokens.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleShield}
            loading={isLoading}
            fullWidth
            size="lg"
            disabled={!amount || parseFloat(amount) <= 0}
          >
            {getButtonText()}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
