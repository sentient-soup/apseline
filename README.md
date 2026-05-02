# Apseline

A sleek homelab dashboard with orbital theme for managing Perihelion (homelab) and Aphelion (cloud) infrastructure.

## Features

- **Service Links Hub**: Quick access to all homelab and cloud services
- **Infrastructure Monitoring**: Real-time metrics from Kubernetes, Docker, and host systems
- **Auto-Discovery**: Automatically discover services from Kubernetes and Docker
- **OAuth/SSO**: Secure access with Authelia/Authentik integration
- **Orbital Theme**: Beautiful astronomy-themed UI with subtle animations

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Zustand + Tailwind CSS + Framer Motion
- **Backend**: Node.js + Express + TypeScript + Socket.io
- **Deployment**: Docker + docker-compose

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (required for this workspace)

### Development

1. Install dependencies:
```bash
pnpm install
```

2. Configure your services in `config.yaml`

3. Start the development servers:
```bash
pnpm run dev
```

This will start:
- Frontend dev server on http://localhost:5173
- Backend API server on http://localhost:3001

### Configuration

Edit `config.yaml` to:
- Add your services (Perihelion = homelab, Aphelion = cloud)
- Enable integrations (Kubernetes, Docker, Prometheus, Host metrics)
- Configure auto-discovery

Copy `server/.env.example` to `server/.env` and configure as needed.

## Project Structure

```
apseline/
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared TypeScript types
├── config.yaml      # Service configuration
└── package.json     # Root workspace config
```

## Roadmap

- [x] Phase 1: Foundation & Project Setup
- [ ] Phase 2: Auto-Discovery System
- [ ] Phase 3: Authentication (OAuth/SSO)
- [ ] Phase 4: Metrics & Monitoring
- [ ] Phase 5: Real-Time Updates (WebSocket)
- [ ] Phase 6: Visual Polish (Orbital Theme)
- [ ] Phase 7: Docker Deployment

## License

Private project for homelab use.
