export type ServiceStatus = 'running' | 'stopped' | 'unreachable' | 'unknown';
export type ServiceSource = 'manual' | 'kubernetes' | 'docker' | 'nginx' | 'cloud';
export type HealthState = 'up' | 'down' | 'degraded' | 'unknown';

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  ts: number;
}

export interface ServiceHealth {
  state: HealthState;
  statusCode?: number;
  latencyMs?: number;
  lastChecked: number;     // epoch ms
  error?: string;
}

export interface Service {
  name: string;
  url: string;
  icon?: string;
  category?: string;
  infrastructure: 'perihelion' | 'aphelion';
  status?: ServiceStatus;
  source?: ServiceSource;
  namespace?: string;
  containerId?: string;
  labels?: Record<string, string>;
  health?: ServiceHealth;
  // Optional per-service health-check overrides
  healthCheck?: {
    path?: string;
    expectStatus?: number;
    timeoutMs?: number;
  };
}

export interface NodeMachine {
  id: string;              // e.g. "baremetal", "pi1", "hetzner"
  host: string;            // tailnet hostname used as VM scrape target & label
  role?: string;           // free-form (primary, cluster, edge)
  port?: number;           // node_exporter port (default 9100)
}

export interface PlanetNodeConfig {
  machines: NodeMachine[];
}

export interface DashboardConfig {
  title: string;
  refreshInterval: number;
  integrations?: {
    kubernetes?: { enabled: boolean; kubeconfig?: string; context?: string; autoDiscover?: boolean };
    docker?: { enabled: boolean; socketPath?: string; host?: string; port?: number; autoDiscover?: boolean };
    victoriametrics?: { enabled: boolean; url?: string };
    cloudflare?: { enabled: boolean; zones?: string[] };
    nginx?: { enabled: boolean; configDir?: string; statusUrl?: string; infrastructure?: 'perihelion' | 'aphelion' };
    cloud?: {
      gce?: { enabled: boolean; project?: string };
    };
    health?: { enabled: boolean; intervalSeconds?: number; timeoutMs?: number };
  };
  nodes?: {
    perihelion?: PlanetNodeConfig;
    aphelion?: PlanetNodeConfig;
  };
  perihelion: Service[];
  aphelion: Service[];
}

// ── Telemetry shapes ──────────────────────────────────────────────────────

export interface MachineMetrics {
  id: string;
  host: string;
  role?: string;
  cpuPct?: number;             // 0..100
  memUsedBytes?: number;
  memTotalBytes?: number;
  memPct?: number;             // 0..100
  diskUsedBytes?: number;
  diskTotalBytes?: number;
  diskPct?: number;
  netRxBps?: number;           // bytes/sec
  netTxBps?: number;
  uptimeSeconds?: number;
  load1?: number;
  reachable: boolean;          // up{instance=...} == 1
}

export interface ClusterMetrics {
  nodes: number;
  pods: { running: number; total: number };
  deployments?: number;
  namespaces?: number;
}

export interface PlanetMetrics {
  planet: 'perihelion' | 'aphelion';
  machines: MachineMetrics[];
  cluster?: ClusterMetrics;
  // Aggregates rolled up across machines
  aggregate: {
    cpuPct?: number;
    memPct?: number;
    diskPct?: number;
    netRxBps?: number;
    netTxBps?: number;
    machinesUp: number;
    machinesTotal: number;
  };
}

export interface CloudflareZoneMetrics {
  zone: string;
  requests24h?: number;
  cachedRequests24h?: number;
  cacheHitRatio?: number;       // 0..1
  bandwidthBytes24h?: number;
  threats24h?: number;
  uniqueVisitors24h?: number;
}

export interface CloudflareMetrics {
  zones: CloudflareZoneMetrics[];
  totalRequests24h: number;
  averageCacheHitRatio?: number;
}

export interface NginxMetrics {
  active?: number;
  reading?: number;
  writing?: number;
  waiting?: number;
  acceptsPerSec?: number;
  handledPerSec?: number;
  requestsPerSec?: number;
}

export interface AllMetrics {
  perihelion?: PlanetMetrics;
  aphelion?: PlanetMetrics;
  cloudflare?: CloudflareMetrics;
  nginx?: NginxMetrics;
  generatedAt: number;          // epoch ms
}

export type HealthMap = Record<string, ServiceHealth>;
