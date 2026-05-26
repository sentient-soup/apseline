# Apseline Telemetry Setup

End-to-end setup for collecting node telemetry into VictoriaMetrics, plus the Cloudflare and (stubbed) cloud-provider integrations.

## Architecture

```
                          LAN (private network)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  phis4.perihelion.live (Ubuntu baremetal, Docker)           │
│    ├─ victoriametrics  :8428  ◀── single TSDB               │
│    │     (bound to 127.0.0.1, fronted by reverse proxy)     │
│    ├─ node_exporter    :9100                                │
│    └─ cadvisor         :8081                                │
│         ▲                                                   │
│         │ (LAN scrape)                                      │
│  phis1 / phis2 / phis3 .perihelion.live (Debian, k8s + NFS) │
│    ├─ node_exporter    :9100  (DaemonSet, hostNetwork)      │
│    └─ kube-state-metrics  :30080  (NodePort)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS + basic auth
                              │ (vmagent → /api/v1/write)
                              │
                  ┌────────────────────────┐
                  │  ahis1 (aphelion)      │
                  │  (Hetzner VPS, Docker) │
                  │   ├─ node_exporter     │
                  │   ├─ cadvisor          │
                  │   └─ vmagent (pushes)  │
                  └────────────────────────┘

Cloudflare:  apseline server → api.cloudflare.com (GraphQL Analytics)
GCE:         interface stubbed; no implementation yet
```

The dashboard server only needs **one** outbound destination for node telemetry: the VictoriaMetrics URL on the LAN. Hetzner pushes its data in over the public reverse proxy.

## 1. Naming & reachability

This repo uses **`*.perihelion.live`** as the LAN naming scheme — split-horizon DNS where Pi-hole answers internal queries and Cloudflare hosts the public records for the same apex domain. Adjust the names below to match what you've stood up.

LAN hosts (resolve via Pi-hole local DNS records):

| FQDN                       | IP                | Role                           |
|----------------------------|-------------------|--------------------------------|
| `phis4.perihelion.live`    | LAN IP, baremetal | Ubuntu, Docker, TSDB host      |
| `phis1.perihelion.live`    | LAN IP            | k8s cluster (control + worker) |
| `phis2.perihelion.live`    | LAN IP            | k8s cluster                    |
| `phis3.perihelion.live`    | LAN IP            | k8s cluster                    |
| `pihole.perihelion.live`   | 192.168.1.220     | DNS                            |

Public hosts (Cloudflare DNS, no Pi-hole record needed):

| FQDN                       | Points at                                       |
|----------------------------|-------------------------------------------------|
| `vm.perihelion.live`       | WAN IP — TLS-terminated reverse proxy on phis4. Routes only `/api/v1/write` to VictoriaMetrics for ahis1's vmagent push. |

Aphelion (cloud) nodes follow the same `<provider-flavor>+<index>` pattern, prefixed with `a` for aphelion. Today there's `ahis1` (Hetzner VPS, addressed as `ahis1.aphelion.live`); `ahis2`, `ahis3` etc. would be added the same way. They don't need Pi-hole DNS records — the FQDN is just a label identifier here, since the dashboard never contacts these nodes directly (they push via vmagent — see §5).

The `host` value in `config.yaml`'s `nodes:` map should match the FQDN exactly:
- **Perihelion (pull):** the FQDN VictoriaMetrics scrapes (e.g. `phis4.perihelion.live`).
- **Aphelion (push):** the FQDN vmagent writes as the `instance` label (e.g. `ahis1.aphelion.live`).

Either way, the dashboard's PromQL is `instance=~"<host>:<port>"`, so the `host` field is the contract that ties the dashboard query to whatever's actually in VM.

### Linux DNS gotcha

systemd-resolved on Ubuntu has two defaults that bite homelabs:

- It accepts whatever the router announces via IPv6 RA as a DNS server, often preferring the router itself over your DHCPv4-supplied Pi-hole. Symptom: `dig phis1.perihelion.live` returns `SERVFAIL`.
- It refuses single-label lookups (`ResolveUnicastSingleLabel=no` by default). Symptom: `resolvectl query phis1` returns `No appropriate name servers or networks for name found`.

Fix on each Linux host that uses LAN names:

```bash
sudo mkdir -p /etc/systemd/resolved.conf.d
sudo tee /etc/systemd/resolved.conf.d/pihole.conf >/dev/null <<'EOF'
[Resolve]
DNS=192.168.1.220
FallbackDNS=1.1.1.1
Domains=~.
EOF
sudo systemctl restart systemd-resolved
```

`Domains=~.` makes Pi-hole the routing target for every domain. With FQDNs in use throughout, you don't need `ResolveUnicastSingleLabel=yes` — but if you reference any short names you'll want to add it.

Verify:

```bash
resolvectl status | grep -E 'DNS Server|Domain'   # Current DNS Server should be 192.168.1.220
getent hosts phis1.perihelion.live                # should resolve
```

## 2. phis4 (perihelion baremetal) — VictoriaMetrics + collectors

A single `docker-compose.yml` on phis4. VM listens on **localhost only** — your existing reverse proxy will be the only thing that talks to it from the outside.

```yaml
# /opt/apseline-telemetry/docker-compose.yml
services:
  victoriametrics:
    image: victoriametrics/victoria-metrics:v1.106.1
    container_name: victoriametrics
    ports:
      - "127.0.0.1:8428:8428"
    volumes:
      - vmdata:/storage
      - ./scrape.yml:/etc/vm/scrape.yml:ro
    command:
      - "-storageDataPath=/storage"
      - "-retentionPeriod=30d"
      - "-promscrape.config=/etc/vm/scrape.yml"
      - "-promscrape.config.strictParse=false"
    restart: unless-stopped

  node_exporter:
    image: quay.io/prometheus/node-exporter:v1.8.2
    container_name: node_exporter
    pid: host
    network_mode: host
    volumes:
      - /:/host:ro,rslave
    command:
      - "--path.rootfs=/host"
      - "--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)"
    restart: unless-stopped

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.49.1
    container_name: cadvisor
    ports:
      - "8081:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker:/var/lib/docker:ro
      - /dev/disk:/dev/disk:ro
    devices:
      - /dev/kmsg
    privileged: true
    restart: unless-stopped

volumes:
  vmdata:
```

> `node_exporter` and `cadvisor` here listen on **all interfaces** so VictoriaMetrics (a separate container with its own network namespace) can reach them by phis4's LAN address. They're behind your LAN firewall — no public exposure. Only VictoriaMetrics itself is locked to `127.0.0.1` because the reverse proxy is its only intended client.

Scrape config — only LAN nodes here. Hetzner is **not** listed; it pushes its own data in (next section).

```yaml
# /opt/apseline-telemetry/scrape.yml
global:
  scrape_interval: 30s
  external_labels:
    cluster: apseline

scrape_configs:
  - job_name: node
    static_configs:
      - targets: ["phis4.perihelion.live:9100"]
        labels: { node: phis4, planet: perihelion, role: primary }
      - targets: ["phis1.perihelion.live:9100"]
        labels: { node: phis1, planet: perihelion, role: cluster }
      - targets: ["phis2.perihelion.live:9100"]
        labels: { node: phis2, planet: perihelion, role: cluster }
      - targets: ["phis3.perihelion.live:9100"]
        labels: { node: phis3, planet: perihelion, role: cluster }

  - job_name: cadvisor
    static_configs:
      - targets: ["phis4.perihelion.live:8081"]
        labels: { node: phis4, planet: perihelion }

  - job_name: kube-state-metrics
    static_configs:
      - targets: ["phis1.perihelion.live:30080"]
        labels: { planet: perihelion, role: cluster }
```

For the Pi cluster (§4), node_exporter is host-networked across the cluster and reachable directly on each Pi's LAN IP via the same scheme.

Bring it up:

```bash
cd /opt/apseline-telemetry
docker compose up -d
curl http://127.0.0.1:8428/api/v1/query?query=up    # sanity check
```

## 3. Reverse proxy — public ingest endpoint

Pick **one** path off your existing TLS-terminating reverse proxy and point it at VM. Restrict to `/api/v1/write` only — never expose `/api/v1/query` or `/api/v1/admin/*` to the public.

### Caddy

```caddy
vm.perihelion.live {
    @write path /api/v1/write*
    handle @write {
        basic_auth {
            ahis1 $2a$14$...   # bcrypt: caddy hash-password
        }
        reverse_proxy 127.0.0.1:8428
    }
    respond 404
}
```

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name vm.perihelion.live;

    # Reuse your existing certs / TLS config

    location = /api/v1/write {
        auth_basic "vm";
        auth_basic_user_file /etc/nginx/vm.htpasswd;
        proxy_pass http://127.0.0.1:8428;
        proxy_set_header Host $host;
    }

    location / {
        return 404;
    }
}
```

Create the credential (nginx):

```bash
sudo apt install apache2-utils       # provides htpasswd
sudo htpasswd -c /etc/nginx/vm.htpasswd ahis1
# choose a long random password and save it — you'll hand it to vmagent on ahis1
```

> Per-source basic-auth users (one per remote node — `ahis1`, future `ahis2`, `ahis3`) make revocation easy as more remote nodes get added. Use `htpasswd /etc/nginx/vm.htpasswd <new-user>` (no `-c`) to append, since `-c` clobbers the file.

## 4. Pi cluster (k8s) — node_exporter + kube-state-metrics

Two Helm charts, one namespace. From a machine with `kubectl` + `helm` pointed at the cluster:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace telemetry

# node_exporter as a DaemonSet, host-networked so it shows up
# as phisN.perihelion.live:9100 over the LAN
helm install node-exporter prometheus-community/prometheus-node-exporter \
  -n telemetry \
  --set hostNetwork=true \
  --set service.enabled=false

# Cluster-state metrics
helm install kube-state-metrics prometheus-community/kube-state-metrics \
  -n telemetry \
  --set service.type=NodePort \
  --set service.nodePort=30080
```

`kube-state-metrics` is now reachable at `phis1.perihelion.live:30080` (any node IP works for a NodePort) — that matches the scrape config in step 2.

## 5. ahis1 (aphelion Hetzner VPS) — push via vmagent

`ahis1` is the first aphelion node — currently a Hetzner VPS, but the naming is provider-agnostic so future cloud nodes can be `ahis2`, `ahis3`, etc. It runs the same exporters bound to **localhost** (no public exposure of metrics ports), plus `vmagent` which scrapes them and pushes to phis4 over the public ingest URL.

```yaml
# /opt/apseline-telemetry/docker-compose.yml on ahis1
services:
  node_exporter:
    image: quay.io/prometheus/node-exporter:v1.8.2
    pid: host
    network_mode: host
    volumes:
      - /:/host:ro,rslave
    command:
      - "--path.rootfs=/host"
      - "--web.listen-address=127.0.0.1:9100"
    restart: unless-stopped

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.49.1
    ports:
      - "127.0.0.1:8081:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker:/var/lib/docker:ro
    devices:
      - /dev/kmsg
    privileged: true
    restart: unless-stopped

  vmagent:
    image: victoriametrics/vmagent:v1.106.1
    network_mode: host
    volumes:
      - ./vmagent.yml:/etc/vmagent/vmagent.yml:ro
      - ./password:/etc/vmagent/password:ro
      - vmagent-data:/vmagentdata
    command:
      - "-promscrape.config=/etc/vmagent/vmagent.yml"
      - "-remoteWrite.url=https://vm.perihelion.live/api/v1/write"
      - "-remoteWrite.basicAuth.username=ahis1"
      - "-remoteWrite.basicAuth.passwordFile=/etc/vmagent/password"
      - "-remoteWrite.tmpDataPath=/vmagentdata"
    restart: unless-stopped

volumes:
  vmagent-data:
```

`vmagent.yml` — the inline `labels:` block overrides the default `instance` (which would otherwise be `127.0.0.1:9100`) so the dashboard's queries (`instance=~"ahis1.aphelion.live:9100"`) match what arrives at VM:

```yaml
global:
  scrape_interval: 30s
  external_labels:
    cluster: apseline

scrape_configs:
  - job_name: node
    static_configs:
      - targets: ["127.0.0.1:9100"]
        labels: { instance: "ahis1.aphelion.live:9100", node: ahis1, planet: aphelion, role: primary }

  - job_name: cadvisor
    static_configs:
      - targets: ["127.0.0.1:8081"]
        labels: { instance: "ahis1.aphelion.live:8081", node: ahis1, planet: aphelion }
```

Password file:

```bash
echo -n 'super-long-random-password' > /opt/apseline-telemetry/password
chmod 600 /opt/apseline-telemetry/password
```

Bring it up:

```bash
cd /opt/apseline-telemetry
docker compose up -d
docker logs -f vmagent     # should show "remote_write succeeded" lines after a tick
```

Adding a future remote node is copy-paste of this directory with a different `labels:` block (`instance`/`node` swapped) and a fresh basic-auth user on the proxy.

## 6. Cloudflare — API token

Cloudflare uses a normal API token (no agent install). Create one at Dashboard → My Profile → API Tokens with these permissions:

- **Zone → Analytics → Read**
- **Zone → Zone → Read**

Scope to the specific zones you want surfaced. Drop the token in `server/.env` as `CLOUDFLARE_API_TOKEN`. Add the zones to `config.yaml` under `integrations.cloudflare.zones`.

## 7. nginx service discovery (optional)

Two independent paths and they compose:

- **Discovery** — surface vhosts as services on the dashboard.
- **Metrics** — poll `stub_status` for live connection / request-rate numbers.

How you wire each up depends on whether nginx is baremetal or running in Kubernetes.

### Discovery

| Topology | What to use |
|---|---|
| Baremetal / VM nginx with `.conf` files on disk | Set `integrations.nginx.configDir` to your vhost directory (e.g. `/etc/nginx/conf.d`). The dashboard server parses `server_name` / `listen` blocks and treats each vhost as a discovered service. |
| **nginx in Kubernetes** | **Skip the nginx discovery path.** The Kubernetes integration (`integrations.kubernetes.enabled: true` with `autoDiscover: true`) already pulls vhosts in via `Ingress` objects — same data, no file access needed. Leave `integrations.nginx.configDir` unset. |

### Metrics

`stub_status` is just a `location` block inside an nginx `server`, not a separate listener. It reuses whatever ports nginx already serves on (80 / 443). No new ports, no manifest changes.

If you have a generic catch-all server block (typical baremetal config), drop the location into it:

```nginx
server {
  listen 8080;
  server_name _;
  location = /nginx_status {
    stub_status;
    access_log off;
    allow 192.168.0.0/16;
    allow 10.0.0.0/8;
    deny all;
  }
}
```

If your server blocks are each scoped to a specific subdomain (no catch-all — common in k8s deployments where each app has its own block), **add a small dedicated server block** for status only. Pick an internal-only hostname so it never resolves publicly:

```nginx
# add alongside your other per-subdomain server blocks
server {
  listen 80;
  server_name nginx-status.perihelion.live;

  location = /nginx_status {
    stub_status;
    access_log off;
    allow 192.168.0.0/16;
    allow 10.0.0.0/8;
    deny all;
  }

  location / { return 404; }
}
```

Then add a Pi-hole record `nginx-status.perihelion.live` → the LAN IP of your nginx Service (or whatever ingress the cluster exposes nginx on). No public DNS for this name.

Reload nginx (k8s: rolling restart of the deployment whose ConfigMap you edited; baremetal: `nginx -s reload`). Verify from phis4:

```bash
curl http://nginx-status.perihelion.live/nginx_status
# Active connections: 12
# server accepts handled requests
#  4120 4120 8930
# Reading: 0 Writing: 1 Waiting: 11
```

Then point `integrations.nginx.statusUrl` at it:

```yaml
integrations:
  nginx:
    enabled: true
    # configDir: omitted — using k8s integration for discovery
    statusUrl: "http://nginx-status.perihelion.live/nginx_status"
    infrastructure: perihelion
```

> Even with the in-nginx `allow`/`deny` rules as the last line of defense, double-check that whatever fronts your ingress (Cloudflare, your home router) can't proxy `/nginx_status` to the public. Easiest: don't put `nginx-status.perihelion.live` in any public DNS or reverse-proxy rule set.

## 8. Apseline server — `.env` and `config.yaml`

Copy `server/.env.example` → `server/.env` and fill:

```env
VM_URL=http://phis4.perihelion.live:8428
CLOUDFLARE_API_TOKEN=cf_xxx...
```

Edit `config.yaml` to point at your hosts (see `nodes:` for per-planet machines, `integrations.cloudflare.zones` for zones, etc.). The aphelion node's `host` (`ahis1.aphelion.live`) must match the `instance` label vmagent writes (e.g. `ahis1.aphelion.live:9100`) so the dashboard's queries find its data.

## 9. Verifying the pipeline

From phis4:

```bash
# VM reachable
curl "http://127.0.0.1:8428/api/v1/query?query=up"

# All LAN nodes reporting
curl "http://127.0.0.1:8428/api/v1/query?query=node_load1"
```

From any host that can resolve phis4.perihelion.live:

```bash
# ahis1 data is arriving via push (look for instance="ahis1.aphelion.live:9100")
curl "http://phis4.perihelion.live:8428/api/v1/query?query=up{node=\"ahis1\"}"
```

Once the apseline server is running:

```bash
curl http://localhost:3001/api/metrics | jq .perihelion.aggregate
curl http://localhost:3001/api/metrics | jq .aphelion.aggregate
curl http://localhost:3001/api/health/services
```

If `up{job="node"}` returns 1 for every node and `kube_node_info` has rows for every Pi, you're done.

## Alternative: VPN mesh (Tailscale / WireGuard)

If you'd rather not deal with public ingest at all, the same architecture works pull-style over a VPN:

- **Tailscale** on every node (full mesh, MagicDNS) — VM scrapes ahis1 like it's local. Good for many remote nodes.
- **Point-to-point WireGuard** between phis4 ↔ ahis1 — ~20 lines of config total, no mesh, no extra service. Good for "just this one remote box."

In either case the only thing that changes from the setup above is: skip ahis1's `vmagent` (and its password file), drop an ahis1 block back into phis4's `scrape.yml`, and don't expose VM publicly. The dashboard config stays identical.
