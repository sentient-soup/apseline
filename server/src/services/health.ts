import type { HealthMap, Service, ServiceHealth } from '@apseline/shared';

interface HealthConfig {
  intervalSeconds: number;
  timeoutMs: number;
}

const DEFAULTS: HealthConfig = { intervalSeconds: 30, timeoutMs: 5000 };

export class HealthService {
  private cfg: HealthConfig;
  private map: HealthMap = {};
  private timer: NodeJS.Timeout | null = null;
  private getServices: () => Service[];
  private onUpdate: (map: HealthMap) => void;

  constructor(getServices: () => Service[], onUpdate: (map: HealthMap) => void, cfg: Partial<HealthConfig> = {}) {
    this.cfg = { ...DEFAULTS, ...cfg };
    this.getServices = getServices;
    this.onUpdate = onUpdate;
  }

  start(): void {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.cfg.intervalSeconds * 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getAll(): HealthMap {
    return this.map;
  }

  private async tick(): Promise<void> {
    const services = this.getServices();
    const results = await Promise.all(services.map((s) => this.probe(s)));
    const next: HealthMap = {};
    services.forEach((s, i) => { next[s.name] = results[i]; });
    this.map = next;
    this.onUpdate(next);
  }

  private async probe(s: Service): Promise<ServiceHealth> {
    const start = Date.now();
    const timeoutMs = s.healthCheck?.timeoutMs ?? this.cfg.timeoutMs;
    const expectStatus = s.healthCheck?.expectStatus;
    const path = s.healthCheck?.path ?? '';
    const url = path ? joinUrl(s.url, path) : s.url;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'manual' });
      const latencyMs = Date.now() - start;
      const code = res.status;
      const ok = expectStatus !== undefined ? code === expectStatus : code < 500;
      return {
        state: ok ? (code >= 400 ? 'degraded' : 'up') : 'down',
        statusCode: code,
        latencyMs,
        lastChecked: Date.now(),
      };
    } catch (e) {
      return {
        state: 'down',
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        error: (e as Error).message,
      };
    } finally {
      clearTimeout(t);
    }
  }
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
