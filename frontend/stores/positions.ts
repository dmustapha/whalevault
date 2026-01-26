import { create } from "zustand";
import type { Position, PositionsState } from "@/types";

interface PositionsStore extends PositionsState {
  setPositions: (positions: Position[]) => void;
  addPosition: (position: Position) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  removePosition: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: PositionsState = {
  positions: [],
  loading: false,
  error: null,
};

export const usePositionsStore = create<PositionsStore>((set) => ({
  ...initialState,

  setPositions: (positions) => set({ positions, error: null }),

  addPosition: (position) =>
    set((state) => ({
      positions: [...state.positions, position],
    })),

  updatePosition: (id, updates) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  removePosition: (id) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
