import './services/logger'; // must be first — patches console before anything else logs
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { loadConfig, clearConfigCache, watchConfig, onConfigChange } from './config/loader';
import { DiscoveryService } from './services/discovery';
import { VictoriaMetricsService, getPlanetMachines } from './services/victoriametrics';
import { CloudflareService } from './services/cloudflare';
import { NginxService } from './services/nginx';
import { HealthService } from './services/health';
import { MetricsAggregator, makeCloudProviders } from './services/metrics';
import { getAll as getLogs } from './services/logger';

const PORT = process.env.PORT || 3001;

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const config = loadConfig();

  // ── Telemetry backends ──────────────────────────────────────────────────
  const vm = new VictoriaMetricsService();
  if (config.integrations?.victoriametrics?.enabled) {
    const url = process.env.VM_URL || config.integrations.victoriametrics.url;
    if (url) await vm.init({ url });
    else console.warn('[VM] enabled but no URL (set VM_URL or integrations.victoriametrics.url)');
  }

  const cloudflare = new CloudflareService();
  if (config.integrations?.cloudflare?.enabled) {
    await cloudflare.init({
      token: process.env.CLOUDFLARE_API_TOKEN || '',
      zones: config.integrations.cloudflare.zones || [],
    });
  }

  const nginx = new NginxService();
  if (config.integrations?.nginx?.enabled) {
    nginx.init({
      configDir: config.integrations.nginx.configDir,
      statusUrl: config.integrations.nginx.statusUrl,
      infrastructure: config.integrations.nginx.infrastructure ?? 'perihelion',
    });
  }

  const cloudProviders = makeCloudProviders(config);
  await Promise.all(cloudProviders.map((p) => p.init()));

  // ── Discovery (services list) ───────────────────────────────────────────
  const discovery = new DiscoveryService();
  discovery.attachCloudflare(cloudflare);
  discovery.attachNginx(nginx);
  discovery.attachCloudProviders(cloudProviders);
  await discovery.init(config);

  // Will be wired to a real socket emit below.
  let emitMetrics: (m: any) => void = () => {};
  let emitHealth: (h: any) => void = () => {};

  // ── Aggregators ─────────────────────────────────────────────────────────
  const aggregator = new MetricsAggregator({
    vm,
    cloudflare,
    nginx,
    cloudProviders,
    config: () => loadConfig(),
    onUpdate: (m) => emitMetrics(m),
  });

  const health = new HealthService(
    () => discovery['cachedServices'] ?? [],   // read whatever the last discovery produced
    (h) => emitHealth(h),
    {
      intervalSeconds: config.integrations?.health?.intervalSeconds ?? 30,
      timeoutMs: config.integrations?.health?.timeoutMs ?? 5000,
    },
  );

  // ── Routes ──────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api/config', (_req, res) => {
    try { res.json(loadConfig()); }
    catch (e) { console.error('config:', e); res.status(500).json({ error: 'Failed to load configuration' }); }
  });

  app.get('/api/services', async (_req, res) => {
    try { res.json(await discovery.discoverAll()); }
    catch (e) { console.error('services:', e); res.status(500).json({ error: 'Failed to load services' }); }
  });

  app.get('/api/discovery/status', (_req, res) => res.json(discovery.getStatus()));

  app.post('/api/discovery/refresh', async (_req, res) => {
    try {
      clearConfigCache();
      discovery.invalidateCache();
      const services = await discovery.discoverAll();
      res.json({ refreshed: true, serviceCount: services.length });
    } catch (e) { console.error('refresh:', e); res.status(500).json({ error: 'Failed to refresh' }); }
  });

  app.get('/api/metrics', async (_req, res) => {
    try {
      const m = aggregator.getLast() ?? (await aggregator.tick());
      res.json(m);
    } catch (e) { console.error('metrics:', e); res.status(500).json({ error: 'Failed to load metrics' }); }
  });

  app.get('/api/health/services', (_req, res) => res.json(health.getAll()));

  app.get('/api/logs', (_req, res) => res.json(getLogs()));

  app.get('/api/nodes/:planet/metrics', async (req, res) => {
    const planet = req.params.planet as 'perihelion' | 'aphelion';
    if (planet !== 'perihelion' && planet !== 'aphelion') {
      res.status(400).json({ error: 'planet must be perihelion or aphelion' });
      return;
    }
    if (!vm.isConnected()) {
      res.status(503).json({ error: 'VictoriaMetrics not connected' });
      return;
    }
    const machines = getPlanetMachines(loadConfig(), planet);
    const m = await vm.getPlanetMetrics(planet, machines);
    res.json(m);
  });

  // ── HTTP + WebSocket ────────────────────────────────────────────────────
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] },
  });

  emitMetrics = (m) => io.emit('metrics:updated', m);
  emitHealth = (h) => io.emit('health:updated', h);

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    // Send last-known snapshot immediately so the client doesn't wait a full tick.
    const last = aggregator.getLast();
    if (last) socket.emit('metrics:updated', last);
    socket.emit('health:updated', health.getAll());
    socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
  });

  // Config hot-reload
  watchConfig();
  onConfigChange(async () => {
    discovery.invalidateCache();
    const services = await discovery.discoverAll();
    io.emit('services:updated', services);
    io.emit('config:updated', loadConfig());
    console.log(`[Config] Pushed update to ${io.engine.clientsCount} client(s)`);
  });

  // Start server
  httpServer.listen(PORT, async () => {
    console.log(`Apseline server running on port ${PORT}`);
    const status = discovery.getStatus();
    console.log(`  Kubernetes: ${status.kubernetes.connected ? 'connected' : 'off'}`);
    console.log(`  Docker:     ${status.docker.connected ? 'connected' : 'off'}`);
    console.log(`  VM:         ${vm.isConnected() ? 'connected' : 'off'}`);
    console.log(`  Cloudflare: ${status.cloudflare.connected ? 'connected' : 'off'}`);
    console.log(`  Nginx:      ${status.nginx.connected ? 'connected' : 'off'}`);
    for (const p of status.cloud) {
      console.log(`  Cloud[${p.name}]: ${p.connected ? 'connected' : 'off (stub)'}`);
    }

    // Prime caches so first client connection has data.
    await discovery.discoverAll();
    aggregator.start();
    health.start();
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
