import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

interface LocationState {
  lat: number | null;
  lng: number | null;
  setCoords: (lat: number, lng: number) => void;
}

export const useLocation = create<LocationState>((set) => ({
  lat: null,
  lng: null,
  setCoords: (lat, lng) => set({ lat, lng }),
}));

interface AuthState {
  session: Session | null;
  ready: boolean;
  setSession: (s: Session | null) => void;
  setReady: (b: boolean) => void;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  ready: false,
  setSession: (session) => set({ session }),
  setReady: (ready) => set({ ready }),
}));
