import { create } from 'zustand';

export type View =
  | { kind: 'system' }
  | { kind: 'planet'; nodeId: string }
  | { kind: 'service'; nodeId: string; serviceId: string };

interface ViewStore {
  view: View;
  transitionId: number;
  navigate: (next: View) => void;
  openService: (serviceId: string) => void;
  closeService: () => void;
}

export const useViewStore = create<ViewStore>((set, get) => ({
  view: { kind: 'system' },
  transitionId: 0,
  navigate: (next) => set((s) => ({ view: next, transitionId: s.transitionId + 1 })),
  openService: (serviceId) => {
    const { view } = get();
    if (view.kind !== 'planet') return;
    set({ view: { kind: 'service', nodeId: view.nodeId, serviceId } });
  },
  closeService: () => {
    const { view } = get();
    if (view.kind !== 'service') return;
    set({ view: { kind: 'planet', nodeId: view.nodeId } });
  },
}));
