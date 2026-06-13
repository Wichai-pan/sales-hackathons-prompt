# Deploy Notes — Frankfurt server (Owner-owned)

> Server prep done by Owner. These constraints MUST shape the foundation's docker-compose.yml (V's WAVE 0)
> and the deploy. The Frankfurt box is SHARED with a live production project — do not disturb it.

## Server facts (43.165.2.182, Debian 12, root, ssh alias `frankfurt`)

- Docker 29.3.1 + Compose v5.1.1 installed. git 2.39.5 installed.
- **SHARED SERVER — another live project "jianglai" runs here** (containers: jianglai-frontend, jianglai-backend:8000, jianglai-db mariadb:3307, global-nginx-proxy:80; network `jl_default`). **DO NOT touch, stop, or reuse these. Do not bind port 80, 8000, or 3307.**
- Resources: 2 vCPU, 3.6Gi RAM (~0.5Gi free + 2.1Gi swap free), 38G disk free. RAM is TIGHT → watch for build OOM.
- Free ports: **3000, 5432, 443** are free. Port 80 is taken by jianglai's nginx.
- Deploy dir: **`/opt/hmd-crm`** (created).

## Constraints for docker-compose.yml (V — bake these in)

- **Project isolation**: set an explicit `name: hmd-crm` (compose project name) so our network/volumes are namespaced (`hmd-crm_default`), never colliding with `jl_*`.
- **App port**: map Next.js to host **3000** → access demo at `http://43.165.2.182:3000`. Do NOT use 80.
- **Postgres**: keep it INTERNAL to the compose network — either don't map it to the host at all, or map to **5432** (free) only if local tooling needs it. Never expose it publicly without a password. Use a strong `POSTGRES_PASSWORD`.
- **Memory**: prefer Next.js `output: 'standalone'` + a production build (not `next dev`) for the deployed demo, to keep RAM low. Building on the server risks OOM on 0.5Gi free — mitigations: build with `NODE_OPTIONS=--max-old-space-size=1024`, or build the image locally and push, or Owner adds temporary swap before `compose up --build`.
- Postgres image: use a slim tag (e.g., `postgres:16-alpine`).

## Owner deploy flow (once foundation lands)

```bash
ssh frankfurt
cd /opt/hmd-crm
git clone https://github.com/Wichai-pan/sales-hackathons-prompt.git . # or git pull
cp .env.example .env   # fill DATABASE_URL (internal), AUTH_SECRET, APP_URL=http://43.165.2.182:3000, DEMO_MODE=true, Azure OpenAI if available
docker compose up -d --build   # if OOM: add swap first, or build locally
# verify: curl localhost:3000 ; demo at http://43.165.2.182:3000
```

## TODO / risks

- AZURE OPENAI creds = TBD (AI has deterministic fallback; non-blocking).
- Build OOM risk on 0.5Gi free RAM → Owner will add temporary swap or build the image off-box if `compose up --build` fails.
- Demo is served over plain HTTP on :3000 (fine for hackathon). HTTPS/domain not needed.
