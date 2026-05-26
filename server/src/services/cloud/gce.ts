import type { Service } from '@apseline/shared';
import type { CloudProvider, CloudProviderNetworkMetrics } from './index';

/**
 * Google Compute Engine provider. Stub-only.
 *
 * When implemented this should:
 *  - auth via a service-account JSON key (env: GCP_SERVICE_ACCOUNT_KEY) or workload identity
 *  - call compute.instances.list across configured projects/regions and surface each VM as a Service
 *  - pull network telemetry from Cloud Monitoring (`compute.googleapis.com/instance/network/sent_bytes_count`,
 *    `received_bytes_count`) and aggregate over 24h
 *  - optionally pull GCE load-balancer / Cloud Run revision data
 */
export interface GceConfig {
  enabled: boolean;
  project?: string;
  // Future: regions, credentialsPath, scopes
}

export class GceProvider implements CloudProvider {
  readonly name = 'gce';
  private cfg: GceConfig;
  private connected = false;

  constructor(cfg: GceConfig) {
    this.cfg = cfg;
  }

  async init(): Promise<boolean> {
    if (!this.cfg.enabled) {
      this.connected = false;
      return false;
    }
    // Intentionally not implemented. Mark as not-connected so the aggregator skips it.
    console.log('[GCE] enabled in config but provider is stubbed — not collecting');
    this.connected = false;
    return false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async discoverServices(_infrastructure: 'perihelion' | 'aphelion'): Promise<Service[]> {
    return [];
  }

  async getNetworkMetrics(): Promise<CloudProviderNetworkMetrics | null> {
    return null;
  }
}
