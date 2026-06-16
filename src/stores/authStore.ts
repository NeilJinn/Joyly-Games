import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Entitlement, HostAccount } from "../types/auth";

interface AuthState {
  account: HostAccount | null;
  isSignedIn: boolean;
  entitlement: Entitlement;
  setAccount: (account: HostAccount) => void;
  clearAccount: () => void;
  setEntitlement: (entitlement: Entitlement) => void;
}

const DEFAULT_ENTITLEMENT: Entitlement = {
  points: 120,
  hasActiveTimePass: false,
  timePassExpiresAt: 0,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      account: null,
      isSignedIn: false,
      entitlement: DEFAULT_ENTITLEMENT,
      setAccount: (account) => set({ account, isSignedIn: true }),
      clearAccount: () =>
        set({ account: null, isSignedIn: false, entitlement: DEFAULT_ENTITLEMENT }),
      setEntitlement: (entitlement) => set({ entitlement }),
    }),
    {
      name: "joyly-auth",
      partialize: (state) => ({ account: state.account, isSignedIn: state.isSignedIn }),
    },
  ),
);
