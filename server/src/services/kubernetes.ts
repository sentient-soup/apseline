import * as k8s from '@kubernetes/client-node';
import type { Service } from '@apseline/shared';

interface K8sDiscoveryConfig {
  kubeconfig?: string;
  context?: string;
  autoDiscover?: boolean;
}

export class KubernetesService {
  private coreApi: k8s.CoreV1Api | null = null;
  private networkingApi: k8s.NetworkingV1Api | null = null;
  private connected = false;

  async init(config: K8sDiscoveryConfig): Promise<boolean> {
    try {
      const kc = new k8s.KubeConfig();

      if (config.kubeconfig) {
        kc.loadFromFile(config.kubeconfig);
      } else {
        kc.loadFromDefault();
      }

      if (config.context) {
        kc.setCurrentContext(config.context);
      }

      this.coreApi = kc.makeApiClient(k8s.CoreV1Api);
      this.networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

      // Test connection by listing namespaces
      await this.coreApi.listNamespace();
      this.connected = true;
      console.log('[K8s] Connected to cluster');
      return true;
    } catch (error) {
      console.warn('[K8s] Failed to connect:', (error as Error).message);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async discoverServices(infrastructure: 'perihelion' | 'aphelion'): Promise<Service[]> {
    if (!this.connected || !this.coreApi || !this.networkingApi) {
      return [];
    }

    const services: Service[] = [];

    try {
      // Discover from Ingresses (most reliable for web UIs)
      const ingresses = await this.networkingApi.listIngressForAllNamespaces();
      for (const ingress of ingresses.items) {
        const name = ingress.metadata?.annotations?.['apseline/name']
          || ingress.metadata?.name || 'unknown';
        const category = ingress.metadata?.annotations?.['apseline/category'] || 'Kubernetes';
        const hidden = ingress.metadata?.annotations?.['apseline/hidden'] === 'true';

        if (hidden) continue;

        for (const rule of ingress.spec?.rules || []) {
          if (rule.host) {
            const tls = ingress.spec?.tls?.some(t => t.hosts?.includes(rule.host!));
            const protocol = tls ? 'https' : 'http';
            services.push({
              name: this.formatName(name),
              url: `${protocol}://${rule.host}`,
              category,
              infrastructure,
              source: 'kubernetes',
              namespace: ingress.metadata?.namespace,
              status: 'running',
              labels: ingress.metadata?.labels as Record<string, string>,
            });
          }
        }
      }

      // Discover from LoadBalancer/NodePort services
      const k8sServices = await this.coreApi.listServiceForAllNamespaces();
      for (const svc of k8sServices.items) {
        const type = svc.spec?.type;
        if (type !== 'LoadBalancer' && type !== 'NodePort') continue;

        const name = svc.metadata?.annotations?.['apseline/name']
          || svc.metadata?.name || 'unknown';
        const category = svc.metadata?.annotations?.['apseline/category'] || 'Kubernetes';
        const hidden = svc.metadata?.annotations?.['apseline/hidden'] === 'true';

        if (hidden) continue;

        // Skip kube-system services unless explicitly labeled
        if (svc.metadata?.namespace === 'kube-system' && !svc.metadata?.annotations?.['apseline/name']) {
          continue;
        }

        let url = '';
        if (type === 'LoadBalancer') {
          const ip = svc.status?.loadBalancer?.ingress?.[0]?.ip
            || svc.status?.loadBalancer?.ingress?.[0]?.hostname;
          const port = svc.spec?.ports?.[0]?.port;
          if (ip && port) {
            url = `http://${ip}:${port}`;
          }
        } else if (type === 'NodePort') {
          const nodePort = svc.spec?.ports?.[0]?.nodePort;
          if (nodePort) {
            url = `http://localhost:${nodePort}`;
          }
        }

        if (url) {
          // Avoid duplicating services already found via ingress
          const alreadyExists = services.some(s => s.name === this.formatName(name));
          if (!alreadyExists) {
            services.push({
              name: this.formatName(name),
              url,
              category,
              infrastructure,
              source: 'kubernetes',
              namespace: svc.metadata?.namespace,
              status: 'running',
              labels: svc.metadata?.labels as Record<string, string>,
            });
          }
        }
      }
    } catch (error) {
      console.error('[K8s] Discovery error:', (error as Error).message);
    }

    return services;
  }

  async getMetrics() {
    if (!this.connected || !this.coreApi) {
      return null;
    }

    try {
      const [pods, nodes, deployments, services] = await Promise.all([
        this.coreApi.listPodForAllNamespaces(),
        this.coreApi.listNode(),
        // Use core API info we have access to
        this.coreApi.listNamespace(),
        this.coreApi.listServiceForAllNamespaces(),
      ]);

      const runningPods = pods.items.filter(p => p.status?.phase === 'Running').length;

      return {
        nodes: nodes.items.length,
        pods: { running: runningPods, total: pods.items.length },
        deployments: 0, // Would need AppsV1Api
        services: services.items.length,
      };
    } catch (error) {
      console.error('[K8s] Metrics error:', (error as Error).message);
      return null;
    }
  }

  private formatName(name: string): string {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
