export type ServiceStatus = 'running' | 'stopped' | 'unreachable' | 'unknown';
export type ServiceSource = 'manual' | 'kubernetes' | 'docker';

export interface Service {
  name: string;
  url: string;
  icon?: string;
  category?: string;
  infrastructure: 'perihelion' | 'aphelion';
  status?: ServiceStatus;
  source?: ServiceSource;
  namespace?: string;       // K8s namespace
  containerId?: string;     // Docker container ID (short)
  labels?: Record<string, string>;
}

export interface DashboardConfig {
  title: string;
  refreshInterval: number;
  integrations?: {
    kubernetes?: { enabled: boolean; kubeconfig?: string; context?: string; autoDiscover?: boolean };
    docker?: { enabled: boolean; socketPath?: string; host?: string; port?: number; autoDiscover?: boolean };
    prometheus?: { enabled: boolean; url: string };
    host?: { enabled: boolean };
  };
  perihelion: Service[];
  aphelion: Service[];
}

export interface K8sMetrics {
  nodes: number;
  pods: { running: number; total: number };
  deployments: number;
  services: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface DockerMetrics {
  containers: { running: number; total: number };
  images: number;
  volumes: number;
  networks: number;
}

export interface HostMetrics {
  cpu: { cores: number; usage: number; temperature?: number };
  memory: { total: number; used: number; percentage: number };
  disk: { total: number; used: number; percentage: number };
  uptime: number;
}

export interface PrometheusMetrics {
  [key: string]: any;
}

export interface AllMetrics {
  kubernetes?: K8sMetrics;
  docker?: DockerMetrics;
  host?: HostMetrics;
  prometheus?: PrometheusMetrics;
}
