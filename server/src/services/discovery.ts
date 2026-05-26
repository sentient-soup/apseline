import type { Service, DashboardConfig } from '@apseline/shared';
import { KubernetesService } from './kubernetes';
import { DockerService } from './docker';
import { CloudflareService } from './cloudflare';
import { NginxService } from './nginx';
import type { CloudProvider } from './cloud';
import { loadConfig } from '../config/loader';

export class DiscoveryService {
  private k8s: KubernetesService;
  private docker: DockerService;
  private cloudflare: CloudflareService | null = null;
  private nginx: NginxService | null = null;
  private cloudProviders: CloudProvider[] = [];
  private cachedServices: Service[] | null = null;
  private lastDiscovery = 0;
  private discoveryInterval: number;

  constructor() {
    this.k8s = new KubernetesService();
    this.docker = new DockerService();
    this.discoveryInterval = 30_000;
  }

  attachCloudflare(cf: CloudflareService) { this.cloudflare = cf; }
  attachNginx(nginx: NginxService) { this.nginx = nginx; }
  attachCloudProviders(providers: CloudProvider[]) { this.cloudProviders = providers; }

  async init(config: DashboardConfig): Promise<void> {
    this.discoveryInterval = (config.refreshInterval || 30) * 1000;
    const integrations = config.integrations || {};

    if (integrations.kubernetes?.enabled) {
      await this.k8s.init({
        kubeconfig: integrations.kubernetes.kubeconfig,
        context: integrations.kubernetes.context,
        autoDiscover: integrations.kubernetes.autoDiscover,
      });
    }

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
    if (this.cachedServices && (now - this.lastDiscovery) < this.discoveryInterval) {
      return this.cachedServices;
    }

    const config = loadConfig();

    const manualServices: Service[] = [
      ...config.perihelion.map((s) => ({ ...s, source: 'manual' as const, status: s.status || 'unknown' as const })),
      ...config.aphelion.map((s) => ({ ...s, source: 'manual' as const, status: s.status || 'unknown' as const })),
    ];

    const discoveredArrays = await Promise.all([
      this.k8s.isConnected() ? this.k8s.discoverServices('perihelion') : Promise.resolve([]),
      this.docker.isConnected() ? this.docker.discoverServices('perihelion') : Promise.resolve([]),
      this.nginx?.isConnected() ? Promise.resolve(this.nginx.discoverServices()) : Promise.resolve([]),
      this.cloudflare?.isConnected() ? Promise.resolve(this.cloudflare.discoverServices()) : Promise.resolve([]),
      ...this.cloudProviders.map((p) =>
        p.isConnected() ? p.discoverServices('aphelion') : Promise.resolve([]),
      ),
    ]);

    const merged = this.mergeServices(manualServices, discoveredArrays.flat());
    this.cachedServices = merged;
    this.lastDiscovery = now;
    return merged;
  }

  private mergeServices(manual: Service[], discovered: Service[]): Service[] {
    const result = [...manual];
    const manualUrls = new Set(manual.map((s) => this.normalizeUrl(s.url)));
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
      kubernetes: { connected: this.k8s.isConnected() },
      docker: { connected: this.docker.isConnected() },
      cloudflare: { connected: !!this.cloudflare?.isConnected() },
      nginx: { connected: !!this.nginx?.isConnected() },
      cloud: this.cloudProviders.map((p) => ({ name: p.name, connected: p.isConnected() })),
      lastDiscovery: this.lastDiscovery || null,
      cachedServiceCount: this.cachedServices?.length || 0,
    };
  }

  invalidateCache(): void {
    this.cachedServices = null;
    this.lastDiscovery = 0;
  }
}
