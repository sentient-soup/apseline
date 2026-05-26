import type { Service } from '@apseline/shared';

/**
 * Common interface for cloud-provider integrations (GCE, AWS, Azure, Linode, Hetzner Cloud API, etc).
 *
 * Each provider should expose:
 *  - service discovery: pull running app definitions / VMs / functions and surface them as Apseline services
 *  - basic network telemetry: bytes in/out, request counts where available
 *
 * Providers are *additive* to the VictoriaMetrics path: VM gives us OS-level node telemetry over
 * tailscale; cloud providers give us provider-native data we can't get from inside the box
 * (load-balancer hits, egress bytes, instance state machine, billing hints).
 */
export interface CloudProviderNetworkMetrics {
  provider: string;
  ingressBytes24h?: number;
  egressBytes24h?: number;
  requests24h?: number;
  errors24h?: number;
}

export interface CloudProvider {
  /** Stable identifier ("gce", "cloudflare", "aws", ...). Used for logs/labels. */
  readonly name: string;

  /** Try to authenticate / verify credentials. Return false to skip without throwing. */
  init(): Promise<boolean>;

  /** Whether init succeeded and the provider is usable. */
  isConnected(): boolean;

  /**
   * Discover services / app definitions exposed by the provider.
   * Each one becomes a satellite around the relevant planet.
   */
  discoverServices(infrastructure: 'perihelion' | 'aphelion'): Promise<Service[]>;

  /** High-level network telemetry. Implementations may return null if unavailable. */
  getNetworkMetrics(): Promise<CloudProviderNetworkMetrics | null>;
}
