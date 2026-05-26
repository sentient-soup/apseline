import type { AllMetrics, DashboardConfig } from '@apseline/shared';
import { VictoriaMetricsService, getPlanetMachines } from './victoriametrics';
import { CloudflareService } from './cloudflare';
import { NginxService } from './nginx';
import { GceProvider } from './cloud/gce';
import type { CloudProvider } from './cloud';

interface MetricsAggregatorOpts {
  vm: VictoriaMetricsService;
  cloudflare: CloudflareService;
  nginx: NginxService;
  cloudProviders: CloudProvider[];
  config: () => DashboardConfig;
  onUpdate: (m: AllMetrics) => void;
  intervalSeconds?: number;
}

/**
 * Periodically pulls from every backend and emits a unified AllMetrics blob.
 * Backends that aren't connected return null and just leave their slice empty.
 */
export class MetricsAggregator {
  private opts: MetricsAggregatorOpts;
  private timer: NodeJS.Timeout | null = null;
  private last: AllMetrics | null = null;

  constructor(opts: MetricsAggregatorOpts) {
    this.opts = opts;
  }

  start(): void {
    if (this.timer) return;
    const interval = (this.opts.intervalSeconds ?? this.opts.config().refreshInterval ?? 30) * 1000;
    this.tick();
    this.timer = setInterval(() => this.tick(), interval);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getLast(): AllMetrics | null {
    return this.last;
  }

  async tick(): Promise<AllMetrics> {
    const cfg = this.opts.config();
    const { vm, cloudflare, nginx } = this.opts;

    const periMachines = getPlanetMachines(cfg, 'perihelion');
    const aphMachines = getPlanetMachines(cfg, 'aphelion');

    const [perihelion, aphelion, cloudflareMetrics, nginxMetrics] = await Promise.all([
      vm.isConnected() && periMachines.length ? vm.getPlanetMetrics('perihelion', periMachines) : null,
      vm.isConnected() && aphMachines.length ? vm.getPlanetMetrics('aphelion', aphMachines) : null,
      cloudflare.isConnected() ? cloudflare.getMetrics() : null,
      nginx.isConnected() ? nginx.getMetrics() : null,
    ]);

    // Cloud providers are stub-eligible — gather what we can.
    await Promise.all(
      this.opts.cloudProviders
        .filter((p) => p.isConnected())
        .map((p) => p.getNetworkMetrics().catch(() => null)),
    );

    const m: AllMetrics = {
      perihelion: perihelion ?? undefined,
      aphelion: aphelion ?? undefined,
      cloudflare: cloudflareMetrics ?? undefined,
      nginx: nginxMetrics ?? undefined,
      generatedAt: Date.now(),
    };

    this.last = m;
    this.opts.onUpdate(m);
    return m;
  }
}

export function makeCloudProviders(cfg: DashboardConfig): CloudProvider[] {
  const providers: CloudProvider[] = [];
  const gceCfg = cfg.integrations?.cloud?.gce;
  if (gceCfg?.enabled) {
    providers.push(new GceProvider(gceCfg));
  }
  return providers;
}
