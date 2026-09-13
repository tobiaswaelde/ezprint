---
title: Self-hosted deployment
description: Deploy one container with pinned image tags, persistent SQLite storage, migrations, and health checks.
---

# Self-hosted deployment

Use a current Docker daemon with the Compose plugin, access to GHCR, and writable local storage for the persistent
volume. Run exactly **one replica**: SQLite is a single-writer database and setup locking is process-local.
All application icons are included in the image, so browsers do not need access to Iconify or another icon CDN.

The image is `ghcr.io/tobiaswaelde/ezprint`. Pin `vMAJOR.MINOR.PATCH` in production. `latest` follows
the newest release, while `sha-…` identifies a specific commit build.

## Install

Copy [`compose.example.yml`](https://github.com/tobiaswaelde/ezprint/blob/main/compose.example.yml) to
`compose.yml`, pin the image tag, and retain the database path and volume:

```yaml
services:
  app:
    image: ghcr.io/tobiaswaelde/ezprint:v1.0.0
    restart: unless-stopped
    environment:
      DATABASE_URL: file:/data/app.db
      NUXT_SESSION_TTL_HOURS: 168
      NUXT_BACKUP_MAX_BYTES: 1073741824
      DATA_DIR: /data
    ports: ['3000:3000']
    volumes: [app-data:/data]
```

No login secret is supplied through the environment. The first account is created in the browser. Protect port
3000 with a firewall or TLS reverse proxy.

```bash
docker compose pull
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

## Startup behavior

The image runs as UID/GID 1001, verifies that `/data` is writable, creates SQLite when needed, and runs
`prisma migrate deploy` before the server starts. The health endpoint returns HTTP 200 only after a successful
database query. Restarts reuse the volume and apply only pending migrations.
The restart policy is also required for an application-initiated restore: ezPrint exits after staging a validated
backup, then creates a freshly migrated database and imports the logical backup during the automatic restart.

After a healthy start, open `http://HOST:3000` and complete [first-run setup](/guide/setup). Before changing image
versions, follow the [upgrade procedure](/operations/upgrades). Report vulnerabilities privately under the
[security policy](https://github.com/tobiaswaelde/ezprint/blob/main/SECURITY.md).
