import Docker from 'dockerode';
import type { Service } from '@apseline/shared';

interface DockerMetrics {
  containers: { running: number; total: number };
  images: number;
  volumes: number;
  networks: number;
}

interface DockerDiscoveryConfig {
  socketPath?: string;
  host?: string;
  port?: number;
  autoDiscover?: boolean;
}

export class DockerService {
  private docker: Docker | null = null;
  private connected = false;

  async init(config: DockerDiscoveryConfig): Promise<boolean> {
    try {
      const opts: Docker.DockerOptions = {};

      if (config.host) {
        opts.host = config.host;
        opts.port = config.port || 2375;
      } else {
        opts.socketPath = config.socketPath || '/var/run/docker.sock';
      }

      this.docker = new Docker(opts);

      // Test connection
      await this.docker.ping();
      this.connected = true;
      console.log('[Docker] Connected to daemon');
      return true;
    } catch (error) {
      console.warn('[Docker] Failed to connect:', (error as Error).message);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async discoverServices(infrastructure: 'perihelion' | 'aphelion'): Promise<Service[]> {
    if (!this.connected || !this.docker) {
      return [];
    }

    const services: Service[] = [];

    try {
      const containers = await this.docker.listContainers({ all: true });

      for (const container of containers) {
        const labels = container.Labels || {};

        // Skip containers explicitly hidden
        if (labels['apseline.hidden'] === 'true') continue;

        // Use apseline labels for explicit control, or infer from container
        const name = labels['apseline.name'] || this.formatContainerName(container.Names[0]);
        const category = labels['apseline.category'] || 'Docker';
        const urlOverride = labels['apseline.url'];
        const infra = labels['apseline.infrastructure'] || infrastructure;

        // Determine URL from port mappings or label override
        let url = urlOverride || '';
        if (!url && container.Ports && container.Ports.length > 0) {
          // Find the first port with a public binding
          const publicPort = container.Ports.find(p => p.PublicPort && p.Type === 'tcp');
          if (publicPort) {
            const host = publicPort.IP === '0.0.0.0' ? 'localhost' : (publicPort.IP || 'localhost');
            url = `http://${host}:${publicPort.PublicPort}`;
          }
        }

        // Only add services that have a reachable URL
        if (!url) continue;

        const isRunning = container.State === 'running';

        services.push({
          name,
          url,
          category,
          infrastructure: infra as 'perihelion' | 'aphelion',
          source: 'docker',
          containerId: container.Id.substring(0, 12),
          status: isRunning ? 'running' : 'stopped',
          labels,
        });
      }
    } catch (error) {
      console.error('[Docker] Discovery error:', (error as Error).message);
    }

    return services;
  }

  async getMetrics(): Promise<DockerMetrics | null> {
    if (!this.connected || !this.docker) {
      return null;
    }

    try {
      const [containers, images, volumes, networks] = await Promise.all([
        this.docker.listContainers({ all: true }),
        this.docker.listImages(),
        this.docker.listVolumes(),
        this.docker.listNetworks(),
      ]);

      const running = containers.filter(c => c.State === 'running').length;

      return {
        containers: { running, total: containers.length },
        images: images.length,
        volumes: volumes.Volumes?.length || 0,
        networks: networks.length,
      };
    } catch (error) {
      console.error('[Docker] Metrics error:', (error as Error).message);
      return null;
    }
  }

  private formatContainerName(name: string): string {
    return name
      .replace(/^\//, '')       // Remove leading slash
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
