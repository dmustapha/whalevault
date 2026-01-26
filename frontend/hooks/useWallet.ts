"use client";

import { useCallback, useEffect } from "react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletStore } from "@/stores/wallet";
import { LAMPORTS_PER_SOL } from "@/lib/constants";

export function useWallet() {
  const { connection } = useConnection();
  const {
    publicKey,
    connected,
    connecting,
    disconnect: walletDisconnect,
    select,
    wallets,
  } = useSolanaWallet();

  const {
    balance,
    setConnected,
    setPublicKey,
    setBalance,
    setConnecting,
    disconnect: storeDisconnect,
  } = useWalletStore();

  useEffect(() => {
    setConnected(connected);
    setPublicKey(publicKey?.toBase58() ?? null);
    setConnecting(connecting);
  }, [connected, publicKey, connecting, setConnected, setPublicKey, setConnecting]);

  useEffect(() => {
    if (!publicKey || !connection) {
      setBalance(0);
      return;
    }

    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setBalance(0);
      }
    };

    fetchBalance();

    const subscriptionId = connection.onAccountChange(publicKey, (account) => {
      setBalance(account.lamports / LAMPORTS_PER_SOL);
    });

    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [publicKey, connection, setBalance]);

  const disconnect = useCallback(async () => {
    try {
      await walletDisconnect();
      storeDisconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }, [walletDisconnect, storeDisconnect]);

  return {
    connected,
    connecting,
    publicKey: publicKey?.toBase58() ?? null,
    balance,
    wallets,
    select,
    disconnect,
  };
}
