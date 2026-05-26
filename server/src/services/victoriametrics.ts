import type {
  DashboardConfig,
  MachineMetrics,
  PlanetMetrics,
  ClusterMetrics,
  NodeMachine,
} from '@apseline/shared';

interface VMConfig {
  url: string;
}

interface VMValue { metric: Record<string, string>; value: [number, string] }
interface VMQueryResp { status: 'success' | 'error'; data: { resultType: string; result: VMValue[] }; error?: string }

const DEFAULT_PORT = 9100;
const QUERY_TIMEOUT_MS = 5000;

function instanceFor(m: NodeMachine): string {
  return `${m.host}:${m.port ?? DEFAULT_PORT}`;
}

export class VictoriaMetricsService {
  private baseUrl: string | null = null;
  private connected = false;

  async init(cfg: VMConfig): Promise<boolean> {
    this.baseUrl = cfg.url.replace(/\/$/, '');
    try {
      const ok = await this.ping();
      this.connected = ok;
      console.log(ok ? `[VM] Connected: ${this.baseUrl}` : `[VM] Unreachable: ${this.baseUrl}`);
      return ok;
    } catch (e) {
      console.warn('[VM] init failed:', (e as Error).message);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async ping(): Promise<boolean> {
    if (!this.baseUrl) return false;
    const r = await this.query('vm_app_uptime_seconds or vector(1)');
    return r !== null;
  }

  /** Run an instant PromQL query and return raw results. */
  async query(promQL: string): Promise<VMValue[] | null> {
    if (!this.baseUrl) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), QUERY_TIMEOUT_MS);
    try {
      const url = `${this.baseUrl}/api/v1/query?query=${encodeURIComponent(promQL)}`;
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        console.warn(`[VM] query HTTP ${res.status}: ${promQL}`);
        return null;
      }
      const json = (await res.json()) as VMQueryResp;
      if (json.status !== 'success') {
        console.warn(`[VM] query non-success (${json.error}): ${promQL}`);
        return null;
      }
      if (process.env.VM_DEBUG === '1') {
        console.log(`[VM] ${json.data.result.length} rows for: ${promQL}`);
      }
      return json.data.result;
    } catch (e) {
      console.warn(`[VM] query failed (${promQL}):`, (e as Error).message);
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  /** Map result rows by a label value for cheap lookup. */
  private indexBy(rows: VMValue[] | null, label: string): Map<string, number> {
    const m = new Map<string, number>();
    if (!rows) return m;
    for (const row of rows) {
      const key = row.metric[label];
      const v = Number(row.value[1]);
      if (key && Number.isFinite(v)) m.set(key, v);
    }
    return m;
  }

  /** Build per-planet telemetry for one node group. */
  async getPlanetMetrics(
    planet: 'perihelion' | 'aphelion',
    machines: NodeMachine[],
  ): Promise<PlanetMetrics | null> {
    if (!this.connected || machines.length === 0) return null;

    // One regex for the planet's instances cuts roundtrips.
    const instanceRegex = machines.map(instanceFor).map(escapeRegex).join('|');
    const sel = `{instance=~"${instanceRegex}"}`;

    // Run all queries in parallel.
    const [
      upRows,
      cpuRows,
      memTotalRows,
      memAvailRows,
      diskTotalRows,
      diskFreeRows,
      netRxRows,
      netTxRows,
      uptimeRows,
      load1Rows,
    ] = await Promise.all([
      this.query(`up${sel}`),
      // 100 - idle% averaged across CPUs over 1m
      this.query(`100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle",instance=~"${instanceRegex}"}[1m])) * 100)`),
      this.query(`node_memory_MemTotal_bytes${sel}`),
      this.query(`node_memory_MemAvailable_bytes${sel}`),
      this.query(`sum by (instance) (node_filesystem_size_bytes{instance=~"${instanceRegex}",fstype!~"tmpfs|overlay|squashfs",mountpoint="/"})`),
      this.query(`sum by (instance) (node_filesystem_avail_bytes{instance=~"${instanceRegex}",fstype!~"tmpfs|overlay|squashfs",mountpoint="/"})`),
      this.query(`sum by (instance) (rate(node_network_receive_bytes_total{instance=~"${instanceRegex}",device!~"lo|docker.*|veth.*|cni.*|flannel.*"}[1m]))`),
      this.query(`sum by (instance) (rate(node_network_transmit_bytes_total{instance=~"${instanceRegex}",device!~"lo|docker.*|veth.*|cni.*|flannel.*"}[1m]))`),
      this.query(`node_time_seconds${sel} - node_boot_time_seconds${sel}`),
      this.query(`node_load1${sel}`),
    ]);

    const ix = {
      up: this.indexBy(upRows, 'instance'),
      cpu: this.indexBy(cpuRows, 'instance'),
      memTotal: this.indexBy(memTotalRows, 'instance'),
      memAvail: this.indexBy(memAvailRows, 'instance'),
      diskTotal: this.indexBy(diskTotalRows, 'instance'),
      diskFree: this.indexBy(diskFreeRows, 'instance'),
      netRx: this.indexBy(netRxRows, 'instance'),
      netTx: this.indexBy(netTxRows, 'instance'),
      uptime: this.indexBy(uptimeRows, 'instance'),
      load1: this.indexBy(load1Rows, 'instance'),
    };

    const machineMetrics: MachineMetrics[] = machines.map((m) => {
      const inst = instanceFor(m);
      const memTotal = ix.memTotal.get(inst);
      const memAvail = ix.memAvail.get(inst);
      const memUsed = memTotal !== undefined && memAvail !== undefined ? memTotal - memAvail : undefined;
      const diskTotal = ix.diskTotal.get(inst);
      const diskFree = ix.diskFree.get(inst);
      const diskUsed = diskTotal !== undefined && diskFree !== undefined ? diskTotal - diskFree : undefined;
      return {
        id: m.id,
        host: m.host,
        role: m.role,
        reachable: ix.up.get(inst) === 1,
        cpuPct: ix.cpu.get(inst),
        memUsedBytes: memUsed,
        memTotalBytes: memTotal,
        memPct: memTotal && memUsed !== undefined ? (memUsed / memTotal) * 100 : undefined,
        diskUsedBytes: diskUsed,
        diskTotalBytes: diskTotal,
        diskPct: diskTotal && diskUsed !== undefined ? (diskUsed / diskTotal) * 100 : undefined,
        netRxBps: ix.netRx.get(inst),
        netTxBps: ix.netTx.get(inst),
        uptimeSeconds: ix.uptime.get(inst),
        load1: ix.load1.get(inst),
      };
    });

    // Cluster metrics from kube-state-metrics, if any rows exist for this planet.
    let cluster: ClusterMetrics | undefined;
    if (planet === 'perihelion') {
      const [nodes, podsRunning, podsTotal, namespaces] = await Promise.all([
        this.query(`count(kube_node_info)`),
        this.query(`sum(kube_pod_status_phase{phase="Running"})`),
        this.query(`count(kube_pod_info)`),
        this.query(`count(kube_namespace_created)`),
      ]);
      const single = (rows: VMValue[] | null) => (rows && rows[0] ? Number(rows[0].value[1]) : undefined);
      const n = single(nodes);
      if (n !== undefined) {
        cluster = {
          nodes: n,
          pods: { running: single(podsRunning) ?? 0, total: single(podsTotal) ?? 0 },
          namespaces: single(namespaces),
        };
      }
    }

    return {
      planet,
      machines: machineMetrics,
      cluster,
      aggregate: aggregate(machineMetrics),
    };
  }
}

function aggregate(machines: MachineMetrics[]): PlanetMetrics['aggregate'] {
  if (machines.length === 0) {
    return { machinesUp: 0, machinesTotal: 0 };
  }
  const reachable = machines.filter((m) => m.reachable);
  const avg = (key: keyof MachineMetrics) => {
    const vals = reachable.map((m) => m[key]).filter((v): v is number => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
  };
  const sum = (key: keyof MachineMetrics) => {
    const vals = reachable.map((m) => m[key]).filter((v): v is number => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined;
  };
  return {
    cpuPct: avg('cpuPct'),
    memPct: avg('memPct'),
    diskPct: avg('diskPct'),
    netRxBps: sum('netRxBps'),
    netTxBps: sum('netTxBps'),
    machinesUp: reachable.length,
    machinesTotal: machines.length,
  };
}

/**
 * Escape regex special chars for use inside a PromQL `=~"..."` matcher.
 * The matcher value is parsed as a Go-style string literal *before* being
 * compiled as a regex, so each `\` we want to reach the regex engine has to
 * be written as `\\` in the string literal — i.e. *two* backslashes here.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&');
}

export function getPlanetMachines(config: DashboardConfig, planet: 'perihelion' | 'aphelion'): NodeMachine[] {
  return config.nodes?.[planet]?.machines ?? [];
}
