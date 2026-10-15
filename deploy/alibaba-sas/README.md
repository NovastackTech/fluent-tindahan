# Alibaba SAS - tindahan-dev.novastack-inc.online @ 8.220.128.80

Fluent Tindahan runs on the shared Novastack SAS next to the other apps, isolated in its own containers.

| Setting | Value |
| --- | --- |
| **Public IP** | `8.220.128.80` |
| **Domain** | `tindahan-dev.novastack-inc.online` |
| **Install folder** | `/opt/fluent-tindahan` (`.env` and `backups/` survive redeploys) |
| **Docker project** | `fluent-tindahan` (`fluent-tindahan-db`, `-api`, `-web`) |
| **Port** | `127.0.0.1:8089` (loopback only; public traffic comes through Caddy) |

Ports in use on this server: 8085 pms, 8086 car-repair, 8087 aluminum-glass, 8088 school, 8090 laundry, 8095 fieldledger site, 8096 novastack-inc.online, 43123 lying-in. This app takes **8089**.

## 1. DNS (Cloudflare)

In the `novastack-inc.online` zone add:

| Type | Name | Content | Proxy status |
| --- | --- | --- | --- |
| A | `tindahan-dev` | `8.220.128.80` | **DNS only** (grey cloud) |

Keep it DNS only so Caddy can issue the certificate. If you later switch to Proxied, set **SSL/TLS** to **Full (strict)** first; Flexible causes a redirect loop.

```powershell
Resolve-DnsName tindahan-dev.novastack-inc.online -Server 1.1.1.1 -DnsOnly   # A 8.220.128.80
```

## 2. Secrets (first deploy)

The API refuses to start in Production without PayMongo keys. Before the first deploy:

```powershell
copy deploy\alibaba-sas\secrets.env.example deploy\alibaba-sas\secrets.env
# fill PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET
```

`install.sh` generates `/opt/fluent-tindahan/.env` (random `POSTGRES_PASSWORD`), merges `secrets.env` into it and deletes the uploaded copy. Later deploys keep the server `.env`; ship `secrets.env` again only to rotate keys. Reference: `tindahan.env.example`.

## 3. Deploy (Windows, from the repo root)

```powershell
.\deploy-alibaba-sas.cmd                      # first time on this server: add -ModifyDockerCaddy
```

You enter the root SSH password once. The script packages the project (no `.git`, `node_modules`, build output, local `.env` or the `tindahan/` vault), streams it into `/opt/fluent-tindahan`, and runs `install.sh`:

1. `setup-server.sh`: installs Docker only if missing.
2. `deploy.sh`: checks secrets, takes a `pg_dump` snapshot into `backups/` if the database is running, builds and starts the stack, and waits for `http://127.0.0.1:8089/api/health`. It fails if the snapshot or the health check fails.
3. Adds `tindahan-dev.novastack-inc.online` to the server's Caddy and checks `https://tindahan-dev.novastack-inc.online/api/health`.

| Option | Use |
| --- | --- |
| `-ModifyDockerCaddy` | Allow adding the site to the Lying-in Caddyfile when that Caddy has no shared sites folder (backup + rollback). Needed once on first setup |
| `-Pull` | Re-run `install.sh` on the code already on the server (no upload) |
| `-NoProxy` | Update the stack only; leave Caddy alone |
| `-NoBackup` | Skip the pre-deploy `pg_dump` snapshot |
| `-PackageOnly` | Build the archive and list its contents without connecting |
| `-SshKeyPath <file>` | Use an SSH key instead of the password |

## 4. Reverse proxy and HTTPS (automatic)

Ports 80/443 belong to the Caddy container of the Lying-in project (`lyingin-pis-caddy-1`). `install.sh` picks the first match:

1. **Host Caddy service** (`/etc/caddy/Caddyfile`): appends a site proxying to `127.0.0.1:8089`.
2. **Host nginx service**: writes `/etc/nginx/conf.d/tindahan-dev.novastack-inc.online.conf` from `nginx-tindahan.conf.example` and runs certbot once DNS resolves.
3. **Caddy in a Docker container** (this server): joins it to the `novastack-edge` network and proxies to `fluent-tindahan-web:80`. If that Caddy imports `/opt/novastack-caddy/sites`, the site goes into `tindahan-dev.novastack-inc.online.caddy` there; otherwise it is appended to its host-mounted Caddyfile with `-ModifyDockerCaddy`.

Caddy issues and renews the certificate automatically. Proxy setup never fails the deploy. Open TCP **80** and **443** in the SAS Firewall console; 8089 stays closed.

## 5. Verify

```bash
curl -fsS http://127.0.0.1:8089/api/health                       # on the server
curl -fsS https://tindahan-dev.novastack-inc.online/api/health   # from anywhere
```

## Backups

Every deploy writes `/opt/fluent-tindahan/backups/db_YYYYMMDD_HHMMSS.sql.gz` before rebuilding.

```bash
cd /opt/fluent-tindahan
C="docker compose -p fluent-tindahan -f docker-compose.yml -f deploy/alibaba-sas/docker-compose.sas.yml"
$C exec -T db pg_dump -U fluent fluent_tindahan | gzip > backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz   # manual snapshot
gunzip -c backups/db_YYYYMMDD_HHMMSS.sql.gz | $C exec -T db psql -U fluent fluent_tindahan          # restore
```

## Update on the server (SSH)

```bash
sudo bash /opt/fluent-tindahan/deploy/alibaba-sas/install.sh --skip-setup
```
