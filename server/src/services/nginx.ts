import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { NginxMetrics, Service } from '@apseline/shared';

interface NginxConfig {
  configDir?: string;
  statusUrl?: string;
  infrastructure?: 'perihelion' | 'aphelion';
}

const STATUS_TIMEOUT_MS = 4000;

/**
 * Lightweight nginx integration:
 *  - Discovery: scan a directory of vhost .conf files, pull `server_name` + `listen` to derive URLs.
 *    Works for plain nginx OSS — no Plus / Lua / API required.
 *  - Metrics: poll `stub_status` if configured.
 */
export class NginxService {
  private cfg: NginxConfig = {};
  private services: Service[] = [];
  // Carry-state for rate calculation between stub_status polls
  private prev: { t: number; accepts: number; handled: number; requests: number } | null = null;

  init(cfg: NginxConfig): boolean {
    this.cfg = cfg;
    if (cfg.configDir) {
      try {
        this.services = this.parseConfigDir(cfg.configDir, cfg.infrastructure ?? 'perihelion');
        console.log(`[Nginx] Discovered ${this.services.length} vhost(s) from ${cfg.configDir}`);
      } catch (e) {
        console.warn('[Nginx] config scan failed:', (e as Error).message);
        this.services = [];
      }
    }
    return this.services.length > 0 || !!cfg.statusUrl;
  }

  isConnected(): boolean {
    return this.services.length > 0 || !!this.cfg.statusUrl;
  }

  discoverServices(): Service[] {
    return this.services;
  }

  private parseConfigDir(dir: string, infrastructure: 'perihelion' | 'aphelion'): Service[] {
    const files = walkConfFiles(dir);
    const out: Service[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      let text: string;
      try { text = readFileSync(file, 'utf8'); } catch { continue; }
      // Strip comments for cleaner regex matches.
      const stripped = text.replace(/#[^\n]*/g, '');
      // Split into server { ... } blocks (greedy-friendly enough for typical configs).
      const blocks = extractBlocks(stripped, 'server');
      for (const block of blocks) {
        const namesMatch = /\bserver_name\s+([^;]+);/.exec(block);
        const listenMatch = /\blisten\s+([^;]+);/.exec(block);
        if (!namesMatch) continue;
        const names = namesMatch[1].trim().split(/\s+/).filter((n) => n && n !== '_');
        const listenStr = listenMatch?.[1] ?? '80';
        const isTls = /\bssl\b/i.test(listenStr) || /\b443\b/.test(listenStr);
        const portMatch = /(?:^|[\s:])(\d{2,5})\b/.exec(listenStr);
        const port = portMatch ? Number(portMatch[1]) : isTls ? 443 : 80;
        for (const host of names) {
          const protocol = isTls || port === 443 ? 'https' : 'http';
          const showPort = (protocol === 'http' && port !== 80) || (protocol === 'https' && port !== 443);
          const url = `${protocol}://${host}${showPort ? `:${port}` : ''}`;
          if (seen.has(url)) continue;
          seen.add(url);
          out.push({
            name: host,
            url,
            category: 'Nginx',
            infrastructure,
            source: 'nginx',
            labels: { vhostFile: file },
          });
        }
      }
    }
    return out;
  }

  async getMetrics(): Promise<NginxMetrics | null> {
    if (!this.cfg.statusUrl) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), STATUS_TIMEOUT_MS);
    try {
      const res = await fetch(this.cfg.statusUrl, { signal: ctrl.signal });
      if (!res.ok) return null;
      const text = await res.text();
      return this.parseStubStatus(text);
    } catch (e) {
      console.warn('[Nginx] stub_status failed:', (e as Error).message);
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  private parseStubStatus(text: string): NginxMetrics | null {
    // Format:
    //   Active connections: N
    //   server accepts handled requests
    //    A H R
    //   Reading: r Writing: w Waiting: q
    const active = /Active connections:\s+(\d+)/.exec(text)?.[1];
    const counts = /\s(\d+)\s+(\d+)\s+(\d+)\s/.exec(text);
    const rww = /Reading:\s+(\d+)\s+Writing:\s+(\d+)\s+Waiting:\s+(\d+)/.exec(text);
    if (!active || !counts) return null;

    const accepts = Number(counts[1]);
    const handled = Number(counts[2]);
    const requests = Number(counts[3]);
    const now = Date.now();
    let acceptsRate: number | undefined;
    let handledRate: number | undefined;
    let requestsRate: number | undefined;
    if (this.prev) {
      const dt = (now - this.prev.t) / 1000;
      if (dt > 0) {
        acceptsRate = (accepts - this.prev.accepts) / dt;
        handledRate = (handled - this.prev.handled) / dt;
        requestsRate = (requests - this.prev.requests) / dt;
      }
    }
    this.prev = { t: now, accepts, handled, requests };

    return {
      active: Number(active),
      reading: rww ? Number(rww[1]) : undefined,
      writing: rww ? Number(rww[2]) : undefined,
      waiting: rww ? Number(rww[3]) : undefined,
      acceptsPerSec: acceptsRate,
      handledPerSec: handledRate,
      requestsPerSec: requestsRate,
    };
  }
}

function walkConfFiles(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      out = out.concat(walkConfFiles(p));
    } else if (name.endsWith('.conf')) {
      out.push(p);
    }
  }
  return out;
}

/** Pull out top-level `server { ... }` blocks. Handles nesting via brace counting. */
function extractBlocks(text: string, name: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`\\b${name}\\b\\s*\\{`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    if (depth === 0) blocks.push(text.slice(start, i - 1));
  }
  return blocks;
}
