"use client";

import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { formatAddress, formatAmount } from "@/lib/utils";

interface ConnectButtonProps {
  className?: string;
}

export function ConnectButton({ className }: ConnectButtonProps) {
  const { setVisible } = useWalletModal();
  const { connected, connecting, publicKey, balance, disconnect } = useWallet();

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm font-medium text-white">
            {formatAmount(balance, 4)} SOL
          </span>
          <span className="text-xs text-gray-400">
            {formatAddress(publicKey)}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={disconnect}
          className={className}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      size="md"
      loading={connecting}
      onClick={() => setVisible(true)}
      className={className}
    >
      Connect Wallet
    </Button>
  );
}
