import type { Service, DashboardConfig } from '@apseline/shared';
import { KubernetesService } from './kubernetes';
import { DockerService } from './docker';
import { loadConfig } from '../config/loader';

export class DiscoveryService {
  private k8s: KubernetesService;
  private docker: DockerService;
  private cachedServices: Service[] | null = null;
  private lastDiscovery = 0;
  private discoveryInterval: number; // ms

  constructor() {
    this.k8s = new KubernetesService();
    this.docker = new DockerService();
    this.discoveryInterval = 30_000; // default 30s
  }

  async init(config: DashboardConfig): Promise<void> {
    this.discoveryInterval = (config.refreshInterval || 30) * 1000;

    const integrations = config.integrations || {};

    // Initialize Kubernetes if enabled
    if (integrations.kubernetes?.enabled) {
      await this.k8s.init({
        kubeconfig: integrations.kubernetes.kubeconfig,
        context: integrations.kubernetes.context,
        autoDiscover: integrations.kubernetes.autoDiscover,
      });
    }

    // Initialize Docker if enabled
    if (integrations.docker?.enabled) {
      await this.docker.init({
        socketPath: integrations.docker.socketPath,
        host: integrations.docker.host,
        port: integrations.docker.port,
        autoDiscover: integrations.docker.autoDiscover,
      });
    }
  }

  async discoverAll(): Promise<Service[]> {
    const now = Date.now();

    // Return cached if within refresh interval
    if (this.cachedServices && (now - this.lastDiscovery) < this.discoveryInterval) {
      return this.cachedServices;
    }

    const config = loadConfig();

    // Start with manual services (always source: 'manual')
    const manualServices: Service[] = [
      ...config.perihelion.map(s => ({ ...s, source: 'manual' as const, status: s.status || 'unknown' as const })),
      ...config.aphelion.map(s => ({ ...s, source: 'manual' as const, status: s.status || 'unknown' as const })),
    ];

    // Auto-discover from Kubernetes
    const k8sServices = this.k8s.isConnected()
      ? await this.k8s.discoverServices('perihelion')
      : [];

    // Auto-discover from Docker
    const dockerServices = this.docker.isConnected()
      ? await this.docker.discoverServices('perihelion')
      : [];

    // Merge: manual services take priority over auto-discovered (by URL match)
    const merged = this.mergeServices(manualServices, [...k8sServices, ...dockerServices]);

    this.cachedServices = merged;
    this.lastDiscovery = now;

    return merged;
  }

  private mergeServices(manual: Service[], discovered: Service[]): Service[] {
    const result = [...manual];
    const manualUrls = new Set(manual.map(s => this.normalizeUrl(s.url)));

    for (const service of discovered) {
      const normalizedUrl = this.normalizeUrl(service.url);
      if (!manualUrls.has(normalizedUrl)) {
        result.push(service);
        manualUrls.add(normalizedUrl);
      }
    }

    return result;
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
    } catch {
      return url.toLowerCase().replace(/\/$/, '');
    }
  }

  getStatus() {
    return {
      kubernetes: {
        connected: this.k8s.isConnected(),
      },
      docker: {
        connected: this.docker.isConnected(),
      },
      lastDiscovery: this.lastDiscovery || null,
      cachedServiceCount: this.cachedServices?.length || 0,
    };
  }

  invalidateCache(): void {
    this.cachedServices = null;
    this.lastDiscovery = 0;
  }
}
