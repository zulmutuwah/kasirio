import { create } from 'zustand';
import { Shift, CashMovement } from '../types';

interface SessionState {
  activeShift: Shift | null;
  setActiveShift: (shift: Shift | null) => void;
  openShift: (cashierName: string, initialCash: number) => Shift;
  closeShift: (finalCash: number) => void;
  addMovement: (movement: CashMovement) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeShift: null,

  setActiveShift: (activeShift) => set({ activeShift }),

  openShift: (cashierName: string, initialCash: number) => {
    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      cashierName,
      startTime: new Date().toISOString(),
      initialCash,
      cashMovements: [],
      status: 'OPEN',
    };
    set({ activeShift: newShift });
    return newShift;
  },

  closeShift: (finalCash: number) => {
    const { activeShift } = get();
    if (!activeShift) return;

    const totalMovements = activeShift.cashMovements.reduce((acc, m) => {
      return m.type === 'IN' ? acc + m.amount : acc - m.amount;
    }, 0);

    const expectedCash = activeShift.initialCash + totalMovements;

    set({
      activeShift: {
        ...activeShift,
        endTime: new Date().toISOString(),
        finalCash,
        expectedCash,
        status: 'CLOSED',
      },
    });
  },

  addMovement: (movement: CashMovement) => {
    const { activeShift } = get();
    if (!activeShift) return;
    set({
      activeShift: {
        ...activeShift,
        cashMovements: [...activeShift.cashMovements, movement],
      },
    });
  },
}));
