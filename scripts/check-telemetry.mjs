#!/usr/bin/env node
/**
 * Integration check for the telemetry pipeline. Drives a *running* stack and the
 * real backends - there is nothing mocked here, so a failure means the dashboard
 * is lying to you right now.
 *
 *   pnpm dev                    # in another terminal
 *   node scripts/check-telemetry.mjs
 *
 * Env overrides: API (default http://localhost:3001), VM_URL, CF token is read
 * from server/.env if present (T2 self-skips its cross-check without it).
 *
 * Exit code 0 = all green. Each check maps to one fix; see the names.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = readEnv(path.join(ROOT, 'server/.env'));
const API = (process.env.API || 'http://localhost:3001').replace(/\/$/, '');
const VM = (process.env.VM_URL || env.VM_URL || 'http://phis4.perihelion.live:8428').replace(/\/$/, '');
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_API_TOKEN || '';

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
}

const api = async (p) => {
  const r = await fetch(API + p);
  if (!r.ok) throw new Error(`GET ${p} -> HTTP ${r.status}`);
  return r.json();
};
const promQL = async (q) => {
  const r = await fetch(`${VM}/api/v1/query?query=${encodeURIComponent(q)}`);
  const j = await r.json();
  if (j.status !== 'success') throw new Error(`PromQL rejected: ${j.error}`);
  return j.data.result;
};
const byInstance = (rows) => Object.fromEntries(rows.map((r) => [r.metric.instance, Number(r.value[1])]));

/* Checks that consume per-node telemetry: pointless once T0 says there is none. */
const NEEDS_METRICS = 'needs-metrics';

/* ── checks ─────────────────────────────────────────────────────────────── */
/* Each returns a detail string, or throws. `notes` are printed but never fail. */

const CHECKS = [
  ['T0  stack is up + VM connected', async (notes) => {
    const m = await api('/api/metrics');
    const age = Math.round((Date.now() - m.generatedAt) / 1000);
    if (!m.perihelion && !m.aphelion) throw new Error('no planet metrics at all - VM unreachable or nodes: empty');
    if (age > 180) throw new Error(`metrics are ${age}s stale; aggregator is not ticking`);
    notes.push(`snapshot ${age}s old`);
    return `perihelion=${!!m.perihelion} aphelion=${!!m.aphelion}`;
  }],

  /* Fix: whitelist physical NICs. The old blacklist let docker's per-project
     br-<hash> bridges through, double-counting the uplink. Structural assertion
     on the device set, so it can't flake on rate drift. */
  ['T1  net counts physical NICs only', async (notes) => {
    const PHYSICAL = 'e(n|th)[a-z0-9]*|wl[a-z0-9]*';
    const matched = await promQL(`node_network_receive_bytes_total{job="node",device=~"${PHYSICAL}"}`);
    if (!matched.length) throw new Error('whitelist matched zero devices - nodes down, or NIC naming differs');

    const bad = [...new Set(matched.map((r) => r.metric.device))]
      .filter((d) => /^(lo|docker|br-|veth|cni|flannel|tailscale|tun|virbr)/.test(d));
    if (bad.length) throw new Error(`virtual devices leaked into the sum: ${bad.join(', ')}`);

    // Informational: how much the old filter was inflating things.
    const oldSum = byInstance(await promQL(
      `sum by (instance) (rate(node_network_receive_bytes_total{job="node",device!~"lo|docker.*|veth.*|cni.*|flannel.*"}[1m]))`));
    const newSum = byInstance(await promQL(
      `sum by (instance) (rate(node_network_receive_bytes_total{job="node",device=~"${PHYSICAL}"}[1m]))`));
    for (const [inst, v] of Object.entries(newSum)) {
      if (v > oldSum[inst] * 1.05) throw new Error(`${inst}: whitelist sum ${v} exceeds blacklist sum ${oldSum[inst]}`);
      notes.push(`${inst} rx ${Math.round(v)} B/s (old filter reported ${Math.round(oldSum[inst])})`);
    }

    // And the value the dashboard serves must track the physical figure, not the
    // blacklist one. Rates drift between calls, so discriminate by which of the
    // two candidates it lands nearer - only meaningful when they actually differ.
    const m = await api('/api/metrics');
    for (const p of ['perihelion', 'aphelion']) {
      for (const mach of m[p]?.machines ?? []) {
        if (!mach.reachable) continue;
        const inst = `${mach.host}:9100`;
        if (mach.netRxBps === undefined) throw new Error(`${mach.id}: reachable but netRxBps missing`);
        const phys = newSum[inst], virt = oldSum[inst];
        if (phys === undefined || virt === undefined) continue;
        if (virt < phys * 1.5) continue;   // no bridge traffic right now - can't tell them apart
        if (Math.abs(mach.netRxBps - virt) < Math.abs(mach.netRxBps - phys)) {
          throw new Error(`${mach.id}: API reports ${Math.round(mach.netRxBps)} B/s, nearer the virtual-inclusive sum ${Math.round(virt)} than the physical ${Math.round(phys)} - old query still live`);
        }
      }
    }
    return `${[...new Set(matched.map((r) => r.metric.device))].join(', ')}`;
  }, NEEDS_METRICS],

  /* Fix: httpRequests1hGroups + datetime filter. The old 1dGroups query used a
     date range, i.e. whole calendar days - a "24h" number covering up to 48h. */
  ['T2  cloudflare window is a true rolling 24h', async (notes) => {
    const m = await api('/api/metrics');
    const cf = m.cloudflare;
    if (!cf) throw new Error('no cloudflare slice (token unset or all zones filtered out)');
    if (!CF_TOKEN) { notes.push('no token available - comparing shape only, not values'); }

    const total = cf.zones.reduce((a, z) => a + (z.requests24h ?? 0), 0);
    if (total !== cf.totalRequests24h) throw new Error(`totalRequests24h ${cf.totalRequests24h} != sum of zones ${total}`);

    if (!CF_TOKEN) return `${cf.zones.length} zones, ${cf.totalRequests24h} req (unverified)`;

    const gql = async (query, variables) => {
      const j = await (await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      })).json();
      if (j.errors) throw new Error(`cloudflare graphql: ${JSON.stringify(j.errors).slice(0, 200)}`);
      return j.data.viewer.zones;
    };
    const zr = await (await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
      headers: { Authorization: `Bearer ${CF_TOKEN}` },
    })).json();
    const tags = zr.result.map((z) => z.id);
    const since = new Date(Date.now() - 24 * 3600e3), until = new Date();

    const rolling = (await gql(`query($t:[String!]!,$s:Time!,$u:Time!){viewer{zones(filter:{zoneTag_in:$t}){
      httpRequests1hGroups(limit:1,filter:{datetime_geq:$s,datetime_lt:$u}){sum{requests}}}}}`,
      { t: tags, s: since.toISOString(), u: until.toISOString() }))
      .reduce((a, z) => a + (z.httpRequests1hGroups?.[0]?.sum?.requests ?? 0), 0);

    const calendar = (await gql(`query($t:[String!]!){viewer{zones(filter:{zoneTag_in:$t}){
      httpRequests1dGroups(limit:1,filter:{date_geq:"${since.toISOString().slice(0, 10)}",date_leq:"${until.toISOString().slice(0, 10)}"}){sum{requests}}}}}`,
      { t: tags }))
      .reduce((a, z) => a + (z.httpRequests1dGroups?.[0]?.sum?.requests ?? 0), 0);

    notes.push(`rolling 24h=${rolling}, 2-calendar-day=${calendar}, dashboard=${cf.totalRequests24h}`);
    if (rolling > 0 && cf.totalRequests24h === 0) {
      throw new Error(`cloudflare reports ${rolling} req in the last 24h but the dashboard shows 0`
        + ' - token is probably missing Analytics:Read, or is scoped to fewer zones than expected');
    }
    // Traffic accrues between the two calls, so allow drift; the point is which
    // figure the dashboard is anchored to.
    const nearRolling = Math.abs(cf.totalRequests24h - rolling);
    const nearCalendar = Math.abs(cf.totalRequests24h - calendar);
    if (calendar > rolling * 1.05 && nearCalendar < nearRolling) {
      throw new Error(`dashboard total ${cf.totalRequests24h} tracks the calendar-day figure - 1dGroups still live`);
    }
    return `${cf.totalRequests24h} req vs ${rolling} rolling (calendar-day figure would be ${calendar})`;
  }],

  /* Fix: HealthMap keyed by url. "Copy Party" exists on both planets and the two
     entries were clobbering each other. */
  ['T3  health map is 1:1 with services, keyed by url', async (notes) => {
    const [services, health] = await Promise.all([api('/api/services'), api('/api/health/services')]);
    const missing = services.filter((s) => !(s.url in health)).map((s) => `${s.name} (${s.url})`);
    if (missing.length) {
      const shown = missing.slice(0, 3).join(', ') + (missing.length > 3 ? `, +${missing.length - 3} more` : '');
      throw new Error(`no health entry for ${missing.length}/${services.length}: ${shown}`
        + (missing.length === services.length ? ' - the map is keyed by something other than url' : ''));
    }
    if (Object.keys(health).length !== services.length) {
      throw new Error(`${services.length} services but ${Object.keys(health).length} health rows - keys are colliding`);
    }
    const dupNames = [...new Set(services.map((s) => s.name))].filter((n) => services.filter((s) => s.name === n).length > 1);
    for (const n of dupNames) {
      const urls = services.filter((s) => s.name === n).map((s) => s.url);
      if (new Set(urls).size !== urls.length) throw new Error(`"${n}" has duplicate urls - keying by url can't separate them`);
      notes.push(`"${n}" tracked separately on ${urls.length} urls`);
    }
    return `${services.length} services / ${Object.keys(health).length} health rows, ${dupNames.length} duplicate name(s)`;
  }],

  /* Fix: don't fetch() non-http entries. Factorio's UDP port read as `down`
     forever and held a permanent false alert open. */
  ['T4  non-http services report unknown, not down', async (notes) => {
    const [services, health] = await Promise.all([api('/api/services'), api('/api/health/services')]);
    const nonHttp = services.filter((s) => !/^https?:\/\//i.test(s.url));
    if (!nonHttp.length) { notes.push('config has no non-http entries; nothing to exercise'); return 'vacuous'; }
    for (const s of nonHttp) {
      const st = health[s.url]?.state;
      if (st !== 'unknown') throw new Error(`${s.name} (${s.url}) is "${st}", expected "unknown"`);
      notes.push(`${s.name} -> unknown`);
    }
    return `${nonHttp.length} entry/entries correctly unprobed`;
  }],

  /* Fix: CF zones are DNS records, not hosted services. Probing them produced
     permanent false alerts and filed perihelion.live under aphelion. */
  ['T5  cloudflare zones are not services', async () => {
    const [services, metrics] = await Promise.all([api('/api/services'), api('/api/metrics')]);
    const zones = (metrics.cloudflare?.zones ?? []).map((z) => z.zone);
    if (!zones.length) return 'no zones reported; nothing to leak';
    const leaked = services.filter((s) => zones.some((z) => s.url === `https://${z}` && s.name === z));
    if (leaked.length) throw new Error(`zones surfaced as services: ${leaked.map((s) => s.name).join(', ')}`);
    const cloudSourced = services.filter((s) => s.labels?.provider === 'cloudflare');
    if (cloudSourced.length) throw new Error(`cloudflare-sourced services present: ${cloudSourced.map((s) => s.name).join(', ')}`);
    return `${zones.length} zones stayed in the perimeter belt`;
  }],

  /* Not a fix - a standing guard. A reachable machine with holes in it means a
     PromQL query silently stopped matching (label rename, exporter swap). */
  ['T6  reachable machines have complete vitals', async (notes) => {
    const m = await api('/api/metrics');
    const FIELDS = ['cpuPct', 'memPct', 'diskPct', 'netRxBps', 'netTxBps', 'uptimeSeconds', 'load1'];
    let checked = 0;
    for (const p of ['perihelion', 'aphelion']) {
      for (const mach of m[p]?.machines ?? []) {
        if (!mach.reachable) { notes.push(`${mach.id} unreachable - skipped (check the node's exporter)`); continue; }
        const holes = FIELDS.filter((f) => typeof mach[f] !== 'number');
        if (holes.length) throw new Error(`${mach.id}: missing ${holes.join(', ')}`);
        if (mach.cpuPct < 0 || mach.cpuPct > 100) throw new Error(`${mach.id}: cpuPct ${mach.cpuPct} out of range`);
        if (mach.memPct < 0 || mach.memPct > 100) throw new Error(`${mach.id}: memPct ${mach.memPct} out of range`);
        notes.push(`${mach.id} cpu ${mach.cpuPct.toFixed(1)}% mem ${mach.memPct.toFixed(1)}% dsk ${mach.diskPct.toFixed(1)}% up ${(mach.uptimeSeconds / 86400).toFixed(0)}d`);
        checked++;
      }
    }
    if (!checked) throw new Error('no reachable machines at all');
    return `${checked} machine(s) complete`;
  }, NEEDS_METRICS],

  /* Every node in config.yaml must have a matching `instance` label in VM, or the
     dashboard shows a permanently-dead planet for a box that is actually fine. */
  ['T7  every configured node exists in VM', async (notes) => {
    const cfg = await api('/api/config');
    const known = new Set((await promQL('up{job="node"}')).map((r) => r.metric.instance));
    const missing = [];
    for (const p of ['perihelion', 'aphelion']) {
      for (const mach of cfg.nodes?.[p]?.machines ?? []) {
        const inst = `${mach.host}:${mach.port ?? 9100}`;
        if (!known.has(inst)) missing.push(`${mach.id} (${inst})`);
        else notes.push(`${mach.id} -> ${inst}`);
      }
    }
    if (missing.length) throw new Error(`no VM target for: ${missing.join(', ')} - check the scrape config / vmagent labels`);
    return `${known.size} node target(s) matched`;
  }],

  /* A service the server calls `down` that this machine reaches fine is not an
     outage, it is the server's resolver or egress. That is how a container
     without LAN DNS reports half the homelab as dead. */
  ['T8  "down" services are really down', async (notes) => {
    const [services, health] = await Promise.all([api('/api/services'), api('/api/health/services')]);
    const suspect = services.filter((s) => health[s.url]?.state === 'down' && health[s.url]?.statusCode === undefined);
    if (!suspect.length) return 'nothing reported down without a status code';
    const disagree = [];
    for (const s of suspect) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(s.url, { redirect: 'manual', signal: ctrl.signal });
        disagree.push(`${s.name} (server says down, reachable here: HTTP ${r.status})`);
      } catch {
        notes.push(`${s.name} unreachable from here too, genuine outage`);
      } finally { clearTimeout(t); }
    }
    // One disagreement is usually just a flap between health ticks. A systemic
    // pattern is the interesting signal: that means the server can't reach a
    // whole class of hosts (no LAN DNS, blocked egress).
    // ponytail: crude threshold, swap for a re-probe of the health tick if it nags.
    const systemic = disagree.length >= 3 || (disagree.length >= 2 && disagree.length === suspect.length);
    if (systemic) {
      throw new Error(`${disagree.length} of ${suspect.length} are reachable from here: `
        + disagree.join('; ') + ' -> suspect the server DNS/egress, not the services');
    }
    if (disagree.length) {
      notes.push(`${disagree.join('; ')} - single disagreement, likely a flap between ticks`);
    }
    return `${suspect.length} down, ${disagree.length} disagreement(s), no systemic pattern`;
  }],
];

/* ── runner ─────────────────────────────────────────────────────────────── */
const G = '\x1b[32m', R = '\x1b[31m', D = '\x1b[2m', Y = '\x1b[33m', X = '\x1b[0m';
let failed = 0;

console.log(`${D}api ${API}  vm ${VM}  cloudflare token ${CF_TOKEN ? 'present' : 'absent'}${X}`);

// Build provenance first. Every result below is meaningless if you are looking
// at a different build than you think you are.
let build = null;
try { build = await api('/api/version'); } catch { /* image predates the endpoint */ }
if (build) {
  const be = Object.entries(build.backends ?? {}).map(([k, v]) => `${k}=${v ? 'on' : 'OFF'}`).join('  ');
  console.log(`${D}build ${String(build.gitSha).slice(0, 7)} (${build.gitRef}) built ${build.buildTime}${X}`);
  console.log(`${D}up since ${build.startedAt}${X}\n${D}backends: ${be}${X}\n`);
} else {
  console.log(`${Y}build unknown: no /api/version, so this image predates build provenance${X}\n`);
}

let gateFailed = false, skipped = 0;
for (const [name, fn, tag] of CHECKS) {
  if (gateFailed && tag === NEEDS_METRICS) {
    skipped++;
    console.log(`${Y}SKIP${X}  ${name}\n      ${D}no node telemetry to check (see T0)${X}`);
    continue;
  }
  const notes = [];
  try {
    const detail = await fn(notes);
    console.log(`${G}PASS${X}  ${name}\n      ${D}${detail}${X}`);
  } catch (e) {
    failed++;
    console.log(`${R}FAIL${X}  ${name}\n      ${R}${e.message}${X}`);
    // With no metrics at all the node-telemetry checks pass vacuously, which is
    // worse than useless: it reads as a healthy dashboard. Everything else still
    // runs, because those are the checks that explain *why* T0 failed.
    if (name.startsWith('T0')) gateFailed = true;
  }
  for (const n of notes) console.log(`      ${D}· ${n}${X}`);
}

const ran = CHECKS.length - skipped;
console.log(`\n${failed ? R : G}${ran - failed}/${ran} passed${X}`
  + (skipped ? `${Y}, ${skipped} skipped${X}` : ''));
console.log(`
${D}Browser-side checks the script can't reach - open the dashboard and confirm:

  U1  cold start        stop the server, hard-reload the page, start the server again.
                        Header must fill in on its own within ~5s (no manual reload).
                        Regression looks like: "SVCS 0/0 · ALL SYSTEMS NOMINAL".
  U2  bandwidth rock    perimeter belt BANDWIDTH reads e.g. "1.3 GB", never "1.3BB".
  U3  duplicate names   hover both Copy Party contacts (one per planet). Latency and
                        state must differ per contact, not mirror each other.
  U4  non-http target   hover Factorio: grey "UNKNOWN · — · NOT AN HTTP ENDPOINT",
                        and clicking it must not navigate anywhere.${X}`);

process.exit(failed ? 1 : 0);
