import { create } from "zustand";
import type { Transaction } from "@/types";

interface TransactionsStore {
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  reset: () => void;
}

const STORAGE_KEY = "whalevault_transactions";

export const useTransactionsStore = create<TransactionsStore>((set) => ({
  transactions: [],

  setTransactions: (transactions) => {
    set({ transactions });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  },

  addTransaction: (transaction) =>
    set((state) => {
      const updated = [...state.transactions, transaction];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { transactions: updated };
    }),

  reset: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ transactions: [] });
  },
}));
