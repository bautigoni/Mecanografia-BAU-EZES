# Deploying TYPELY on Oracle VPS

> **Branching:** dos ramas largas. En **`dev`** se trabaja; **`production`** es
> la que queda desplegada y solo recibe cambios que ya andan y están listos para
> salir, por **pull request desde `dev`**. Nunca commitear directo a
> `production`. Ver `CLAUDE.md` §17.
>
> **El autodeploy nunca anduvo.** Las diez corridas del workflow fallaron con
> `ssh: no key found`: el secreto `SSH_PRIVATE_KEY` existe pero no es una clave
> parseable. Y su script corre `docker compose up -d --build`, justo el build
> completo que tumba la VM de 956MB (ver `CLAUDE.md` §13.1). Hoy se despliega a
> mano con lo que sigue en este documento.
>
> **Falta un paso de admin:** la rama desplegada todavía se llama `main` en
> GitHub. Hay que renombrarla a `production` (hace falta admin) y confirmar que
> el ruleset `protect-main` haya seguido el renombre. Hasta entonces
> `.github/workflows/deploy.yml` no dispara solo: espera una rama `production`,
> y se puede correr a mano desde Actions.
>
> **Ojo en el VPS:** `/opt/apps/typely` corre `git pull`, y su rama local seguía
> a `origin/dev` de la estructura vieja. Verificá a qué apunta antes del próximo
> deploy.

> **Estado real del VPS actual (`bauhub`, 168.75.68.75):** el repo vive en
> **`/opt/apps/typely`** (no `/typely`) y existe un
> **`docker-compose.override.yml` local (NO commiteado)** que (1) publica el
> API en **`127.0.0.1:3007`** porque el 3006 lo ocupa otra app del host
> (guessify) y (2) mantiene vivo el contenedor `typely-invite-mailer`
> (`Dockerfile.mailer`, puerto 8787) para `/api/invitations/send`. El
> Caddyfile rutea `/api/invitations/send`→8787, `/api/*`→3007 y el resto→3005.
> No borrar ese override ni los backups `.env.bak-*` del VPS. Para smoke
> tests locales en ese host usá `curl http://127.0.0.1:3007/health`.

The app ships as **three containers** behind Caddy:

1. `db` — Postgres 16 (loopback only, port 5432). Schema is applied from
   `db/init/*.sql` on first start.
2. `api` — Fastify + Drizzle (loopback only, port 3006). Caddy reverse-
   proxies `/api/*` to this service. All auth, user management,
   progress reporting, and teacher analytics live here.
3. `mecanografia` — the existing static-site container, served by Nginx
   on port 80 (host `127.0.0.1:3005`). Caddy reverse-proxies the
   public hostname into that loopback port. The frontend also calls
   `/api/*` (same hostname), which Caddy routes to the api service.

Caddy terminates TLS, rate-limits `/api/*`, and reverse-proxies the rest.

## Prerequisites

The VPS must already have:

- Docker Engine + the `docker compose` plugin
- Caddy (or any reverse proxy) running on the host
- Outbound network access to `registry-1.docker.io` and `npmjs.org`
- A DNS A/AAAA record for `typely.bauhub.online` pointing to the VPS

## 1. Clone the repository

```bash
sudo mkdir -p /typely
sudo chown "$USER":"$USER" /typely
git clone <your-git-url> /typely
cd /typely
```

## 2. Provision the secrets

The `db` and `api` services read secrets from `secrets/*.txt` (mounted
at `/run/secrets/*` inside the containers). **Never commit real
values.** The `secrets/` directory is `.gitignore`d.

```bash
mkdir -p secrets
openssl rand -base64 64 > secrets/jwt_secret.txt
openssl rand -base64 24 | tr -d '/+=' > secrets/db_password.txt
printf 'postgres://typely:%s@db:5432/typely\n' "$(cat secrets/db_password.txt)" > secrets/database_url.txt
: > secrets/resend_api_key.txt   # empty = invite emails disabled, share-link only
chmod 600 secrets/*.txt
```

> The `RESEND_API_KEY` is optional. If empty, the invitation email
> endpoint returns 503 and the admin gets a shareable invite link
> instead. The product works fully without it.

## 3. Build and start the containers

```bash
docker compose up -d --build
```

Compose starts `db` first (waiting for the `pg_isready` healthcheck),
then `api` (waits for the DB), then `mecanografia` (waits for the DB
to ensure the API can talk to it on first boot).

```bash
docker compose ps
docker compose logs --tail=50 api
docker compose logs --tail=50 db
```

## 4. Seed the superadmin

The seed is idempotent. It creates the canonical superadmin
(`bautistagoni@northfield.edu.ar` by default — change via
`SUPERADMIN_EMAIL` in your shell before running), the first sede
"Principal", and prints the password to stdout. **Change the password
after first login.**

```bash
docker compose exec -e SUPERADMIN_PASSWORD='your-strong-password' api node dist/seed.js
```

The seed prints the credentials exactly once. Capture them now.

## 5. Smoke-test the container locally

```bash
curl -I http://127.0.0.1:3005
curl -I http://127.0.0.1:3006/health
```

You should see `HTTP/1.1 200 OK` from both. A follow-up
`curl http://127.0.0.1:3005/some/deep/route` must also return the SPA
`index.html` (not a 404) — that confirms the React Router fallback in
`nginx.conf` is wired up correctly.

## 6. Add the Caddy reverse-proxy block

Open the host Caddyfile (typically `/etc/caddy/Caddyfile`) and append:

```caddy
typely.bauhub.online {
    # Static SPA
    reverse_proxy 127.0.0.1:3005

    # API + rate limiting. The `rate_limit` directive is part of the
    # standard Caddy distribution. Key by client IP behind a single
    # reverse proxy. Tune `burst` and `rps` to taste — these are
    # conservative defaults that allow the gameplay UI (which fires a
    # few requests per level complete) while blocking naive abuse.
    @api path /api/*
    rate_limit @api 30r/m {
        127.0.0.1/32
    }
    reverse_proxy @api 127.0.0.1:3006 {
        header_up X-Real-IP {remote_host}
    }
}
```

Validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy will request a Let's Encrypt certificate on first hit. Verify from
outside the VPS:

```bash
curl -I https://typely.bauhub.online
curl -I https://typely.bauhub.online/api/health
```

`HTTP/2 200` for both confirms TLS + proxy are both working.

## 7. Updating the app

```bash
cd /typely
git pull
docker compose up -d --build
```

Compose detects the rebuilt image and recreates the affected services
with zero downtime for the others (the `db` container is never
recreated on rebuilds). Optionally prune the previous image layer once
the new one is verified working:

```bash
docker image prune -f
```

> **Build-time env vars (`VITE_*`).** `VITE_GOOGLE_CLIENT_ID` (and any other
> `VITE_*` var) is **baked into the JS bundle at build time** by Vite, not read
> at runtime. After adding or changing it in the host `.env`, you **must**
> `docker compose up -d --build` — a plain `restart` keeps the old bundle.
> Symptom of a skipped rebuild: the Google button shows the toast
> *"Google Login no está configurado."* and the browser console logs
> `[TYPELY] VITE_GOOGLE_CLIENT_ID is empty at build time`. Set
> `VITE_GOOGLE_CLIENT_ID=…apps.googleusercontent.com` (and optionally
> `VITE_GOOGLE_ALLOWED_DOMAINS=northfield.edu.ar`) in `.env`, then rebuild.

## 8. Rolling back

If a release misbehaves, roll back by checking out the previous commit
and rebuilding:

```bash
cd /typely
git log --oneline -n 5            # find the last good commit
git checkout <commit-sha>
docker compose up -d --build
```

The DB volume (`dbdata`) is never touched on rollback, so progress
records are preserved.

## 9. Backups

The DB is a plain Postgres data directory (`dbdata` volume) — easy to
back up. Recommended: a daily `pg_dump` with off-site rotation.

```bash
docker compose exec -T db pg_dump -U typely -d typely \
  | gzip > /opt/backups/typely-$(date +%Y%m%d).sql.gz
```

Wire that into a cron at 03:00 UTC (low traffic):

```cron
0 3 * * * cd /typely && \
  /usr/bin/docker compose exec -T db pg_dump -U typely -d typely \
  | gzip > /opt/backups/typely-$(date +\%Y\%m\%d).sql.gz
```

Keep at least 30 daily backups; old `attempts` partitions are the
biggest cost (they can be excluded from routine backups with
`--exclude-table-data='attempts*'` if the analytics log outgrows your
backup budget).

## 10. Common operations

| Action                       | Command                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| Tail frontend logs           | `docker compose logs -f mecanografia`                         |
| Tail API logs                | `docker compose logs -f api`                                  |
| Tail DB logs                 | `docker compose logs -f db`                                   |
| Restart the frontend         | `docker compose restart mecanografia`                         |
| Restart the API              | `docker compose restart api`                                  |
| Stop & remove the containers | `docker compose down`                                         |
| Stop & remove the DB too     | `docker compose down -v`  *(destroys all progress)*           |
| Open a psql shell            | `docker compose exec db psql -U typely -d typely`             |
| Re-read Caddyfile            | `sudo systemctl reload caddy`                                 |
| Check what's listening       | `sudo ss -tlnp \| grep -E '3005\|3006\|5432'`                 |
| List current partitions      | `docker compose exec db psql -U typely -d typely -c "\d+ attempts"` |
| Pre-create next month        | `docker compose exec db psql -U typely -d typely -f /docker-entrypoint-initdb.d/002_partitions.sql` |

## Notes

- The containers only bind to `127.0.0.1`, so the app cannot be hit
  directly from the public internet — all traffic must go through Caddy.
- `nginx.conf` enables long-term caching on hashed `/assets/*` files and
  forces `no-store` on `index.html`, so updates roll out cleanly without
  manual cache busting.
- `.dockerignore` keeps `node_modules`, `dist`, `.env`, `Images/`,
  `Images-new/`, `Skills/`, and the project's `.claude/` folder out of
  the build context — builds are fast and no secrets leak into the image.
- `secrets/*` is also excluded from the build context, so the secrets
  never enter the image. They are mounted at runtime by compose.
- Postgres is tuned for the 1 GB VPS: a max of 10 pooled connections,
  idle timeout 30s. Bump `max` in `api/src/db/index.ts` only if the
  VPS is upgraded.
- The `attempts` table is partitioned by month. The pre-creation
  script (`db/init/002_partitions.sql`) is idempotent and safe to run
  from a monthly cron.
