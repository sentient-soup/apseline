import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import type { Service, DashboardConfig } from '@apseline/shared';

type Infrastructure = 'perihelion' | 'aphelion';

interface DiscoveryStatus {
  kubernetes: { connected: boolean };
  docker: { connected: boolean };
  lastDiscovery: number | null;
  cachedServiceCount: number;
}

interface ServicesStore {
  // State
  config: DashboardConfig | null;
  services: Service[];
  activeInfra: Infrastructure;
  loading: boolean;
  error: string | null;
  discoveryStatus: DiscoveryStatus | null;

  // Actions
  setActiveInfra: (infra: Infrastructure) => void;
  fetchConfig: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchDiscoveryStatus: () => Promise<void>;
  refreshServices: () => Promise<void>;
  connectSocket: () => () => void;
}

let socket: Socket | null = null;

export const useServicesStore = create<ServicesStore>((set) => ({
  // Initial state
  config: null,
  services: [],
  activeInfra: 'perihelion',
  loading: false,
  error: null,
  discoveryStatus: null,

  // Actions
  setActiveInfra: (infra) => set({ activeInfra: infra }),

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('Failed to fetch config');
      }
      const config = await response.json();
      set({ config, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  fetchServices: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/services');
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      const services = await response.json();
      set({ services, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  fetchDiscoveryStatus: async () => {
    try {
      const response = await fetch('/api/discovery/status');
      if (response.ok) {
        const status = await response.json();
        set({ discoveryStatus: status });
      }
    } catch {
      // Non-critical, silently fail
    }
  },

  refreshServices: async () => {
    try {
      await fetch('/api/discovery/refresh', { method: 'POST' });
      const response = await fetch('/api/services');
      if (response.ok) {
        const services = await response.json();
        set({ services });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh',
      });
    }
  },

  connectSocket: () => {
    if (socket) {
      socket.disconnect();
    }

    socket = io({ path: '/socket.io' });

    socket.on('services:updated', (services: Service[]) => {
      set({ services });
    });

    socket.on('config:updated', (config: DashboardConfig) => {
      set({ config });
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  },
}));
