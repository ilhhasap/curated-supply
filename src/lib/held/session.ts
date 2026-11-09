import { create } from "zustand";
import type { SessionPerson } from "./types";

type HeldState = {
  person: SessionPerson | null;
  ready: boolean;
  setPerson: (person: SessionPerson | null) => void;
};

export const useHeld = create<HeldState>((set) => ({
  person: null,
  ready: false,
  setPerson: (person) => set({ person, ready: true }),
}));
