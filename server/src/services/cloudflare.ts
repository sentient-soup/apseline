import type { CloudflareMetrics, CloudflareZoneMetrics } from '@apseline/shared';

interface CloudflareConfig {
  token: string;
  zones: string[];           // zone names, e.g. "example.com"
}

const API = 'https://api.cloudflare.com/client/v4';
const GQL = `${API}/graphql`;
const REQ_TIMEOUT_MS = 8000;

interface ZoneInfo { id: string; name: string }

export class CloudflareService {
  private token: string | null = null;
  private zoneNames: string[] = [];
  private zones: ZoneInfo[] = [];
  private connected = false;

  async init(cfg: CloudflareConfig): Promise<boolean> {
    this.token = cfg.token;
    this.zoneNames = cfg.zones;
    if (!this.token) {
      console.warn('[Cloudflare] no API token provided');
      this.connected = false;
      return false;
    }
    try {
      this.zones = await this.fetchZones();
      this.connected = this.zones.length > 0;
      console.log(`[Cloudflare] Connected (${this.zones.length} zone${this.zones.length === 1 ? '' : 's'})`);
      return this.connected;
    } catch (e) {
      console.warn('[Cloudflare] init failed:', (e as Error).message);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async fetchZones(): Promise<ZoneInfo[]> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
    try {
      const url = `${API}/zones?per_page=50`;
      const res = await fetch(url, { headers: this.headers(), signal: ctrl.signal });
      if (!res.ok) throw new Error(`zones HTTP ${res.status}`);
      const json: any = await res.json();
      const all: ZoneInfo[] = (json.result || []).map((z: any) => ({ id: z.id, name: z.name }));
      // If user pinned a subset of zones, filter; otherwise keep all.
      if (this.zoneNames.length > 0) {
        const wanted = new Set(this.zoneNames);
        return all.filter((z) => wanted.has(z.name));
      }
      return all;
    } finally {
      clearTimeout(t);
    }
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  // Zones are deliberately NOT discovered as services: they are DNS records, not
  // things we host, so HTTP-probing them produced permanent false "down" alerts
  // (and filed perihelion.live under aphelion). Zone data renders in the
  // perimeter belt from getMetrics() instead.

  async getMetrics(): Promise<CloudflareMetrics | null> {
    if (!this.connected || this.zones.length === 0) return null;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const until = new Date().toISOString();

    // Hourly buckets, not daily: `httpRequests1dGroups` with a date range covers
    // whole calendar days, so a "24h" window silently spanned up to 48h of traffic.
    // Requesting no dimensions collapses the buckets into one total per zone.
    const query = `query ($zoneTags: [String!]!, $since: Time!, $until: Time!) {
      viewer {
        zones(filter: { zoneTag_in: $zoneTags }) {
          zoneTag
          httpRequests1hGroups(limit: 1, filter: { datetime_geq: $since, datetime_lt: $until }) {
            sum {
              requests
              cachedRequests
              bytes
              threats
            }
            uniq { uniques }
          }
        }
      }
    }`;

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
      const res = await fetch(GQL, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          query,
          variables: { zoneTags: this.zones.map((z) => z.id), since, until },
        }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`graphql HTTP ${res.status}`);
      const json: any = await res.json();
      const rows: any[] = json?.data?.viewer?.zones ?? [];

      const byTag = new Map<string, any>(rows.map((r) => [r.zoneTag, r.httpRequests1hGroups?.[0]]));

      const zoneMetrics: CloudflareZoneMetrics[] = this.zones.map((z) => {
        const g = byTag.get(z.id);
        const sum = g?.sum;
        const uniq = g?.uniq;
        const reqs = sum?.requests ?? 0;
        const cached = sum?.cachedRequests ?? 0;
        return {
          zone: z.name,
          requests24h: reqs,
          cachedRequests24h: cached,
          cacheHitRatio: reqs > 0 ? cached / reqs : undefined,
          bandwidthBytes24h: sum?.bytes,
          threats24h: sum?.threats,
          uniqueVisitors24h: uniq?.uniques,
        };
      });

      const totalRequests = zoneMetrics.reduce((a, z) => a + (z.requests24h ?? 0), 0);
      const totalCached = zoneMetrics.reduce((a, z) => a + (z.cachedRequests24h ?? 0), 0);

      return {
        zones: zoneMetrics,
        totalRequests24h: totalRequests,
        averageCacheHitRatio: totalRequests > 0 ? totalCached / totalRequests : undefined,
      };
    } catch (e) {
      console.warn('[Cloudflare] metrics failed:', (e as Error).message);
      return null;
    }
  }
}
