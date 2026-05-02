import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { loadConfig, clearConfigCache, watchConfig, onConfigChange } from './config/loader';
import { DiscoveryService } from './services/discovery';

const PORT = process.env.PORT || 3001;

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Initialize discovery service
  const config = loadConfig();
  const discovery = new DiscoveryService();
  await discovery.init(config);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Get dashboard config
  app.get('/api/config', (_req, res) => {
    try {
      const config = loadConfig();
      res.json(config);
    } catch (error) {
      console.error('Error loading config:', error);
      res.status(500).json({ error: 'Failed to load configuration' });
    }
  });

  // Get all services (manual + auto-discovered, merged)
  app.get('/api/services', async (_req, res) => {
    try {
      const services = await discovery.discoverAll();
      res.json(services);
    } catch (error) {
      console.error('Error discovering services:', error);
      res.status(500).json({ error: 'Failed to load services' });
    }
  });

  // Get discovery status (which integrations are connected)
  app.get('/api/discovery/status', (_req, res) => {
    res.json(discovery.getStatus());
  });

  // Force re-discovery (invalidate cache)
  app.post('/api/discovery/refresh', async (_req, res) => {
    try {
      clearConfigCache();
      discovery.invalidateCache();
      const services = await discovery.discoverAll();
      res.json({ refreshed: true, serviceCount: services.length });
    } catch (error) {
      console.error('Error refreshing discovery:', error);
      res.status(500).json({ error: 'Failed to refresh services' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Create Socket.io server
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  // Socket connection handler
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Watch config.yaml for changes and push updates to all clients
  watchConfig();
  onConfigChange(async () => {
    discovery.invalidateCache();
    const services = await discovery.discoverAll();
    io.emit('services:updated', services);
    io.emit('config:updated', loadConfig());
    console.log(`[Config] Pushed update to ${io.engine.clientsCount} client(s)`);
  });

  // Start server
  httpServer.listen(PORT, () => {
    console.log(`Apseline server running on port ${PORT}`);
    const status = discovery.getStatus();
    console.log(`  Kubernetes: ${status.kubernetes.connected ? 'connected' : 'not configured'}`);
    console.log(`  Docker: ${status.docker.connected ? 'connected' : 'not configured'}`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
