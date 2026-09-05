import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveClientState = {
  /** Operator/client id the whole app is currently scoped to (client admins with several clients). */
  activeClientId: string | null;
  setActiveClientId: (value: string | null) => void;
};

export const useActiveClientStore = create<ActiveClientState>()(
  persist(
    (set) => ({
      activeClientId: null,
      setActiveClientId: (value) => set({ activeClientId: value }),
    }),
    { name: "bk-active-client", version: 1 },
  ),
);
