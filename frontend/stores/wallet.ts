import { create } from "zustand";
import type { WalletState } from "@/types";

interface WalletStore extends WalletState {
  setConnected: (connected: boolean) => void;
  setPublicKey: (publicKey: string | null) => void;
  setBalance: (balance: number) => void;
  setConnecting: (connecting: boolean) => void;
  connect: () => void;
  disconnect: () => void;
  reset: () => void;
}

const initialState: WalletState = {
  connected: false,
  publicKey: null,
  balance: 0,
  connecting: false,
};

export const useWalletStore = create<WalletStore>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  setPublicKey: (publicKey) => set({ publicKey }),

  setBalance: (balance) => set({ balance }),

  setConnecting: (connecting) => set({ connecting }),

  connect: () => set({ connecting: true }),

  disconnect: () =>
    set({
      connected: false,
      publicKey: null,
      balance: 0,
      connecting: false,
    }),

  reset: () => set(initialState),
}));
