import { create } from 'zustand';
import { SyncState } from '../utils/syncEngine';

interface SyncStoreState {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;

  setSyncState: (state: SyncState) => void;
  setPendingCount: (pendingCount: number) => void;
  setLastSyncedAt: (lastSyncedAt: string | null) => void;
  setErrorMessage: (errorMessage: string | null) => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  state: typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE',
  pendingCount: 0,
  lastSyncedAt: null,
  errorMessage: null,

  setSyncState: (state) => set({ state }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
}));
