# ZECATHON GCP Deployment Guide

This guide covers production deployment of the ZECATHON platform on Google Cloud Platform.

## Quick deploy — one script

For a fully automated deployment, use the provided script:

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"
export GEMINI_API_KEY="AIza..."            # optional but recommended
export GITHUB_TOKEN="ghp_..."               # optional, raises GitHub API limits
./gcp/deploy.sh
```

The script will:
1. Enable the required GCP APIs.
2. Create an Artifact Registry repository.
3. Create a Cloud SQL PostgreSQL instance and database user.
4. Create Secret Manager secrets for `SECRET_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`, and `DATABASE_URL`.
5. Build and push the backend image via Cloud Build.
6. Deploy the backend to Cloud Run connected to Cloud SQL.
7. Build the frontend and deploy it to **Firebase Hosting** with `/api` and `/uploads` rewrites to the Cloud Run service.

Run `./gcp/deploy.sh` from the **repository root**.

## CI/CD pipeline

For automated deploys on every push to `main`, use `gcp/cloudbuild.yaml`:

1. Create a Cloud Build trigger pointing at `gcp/cloudbuild.yaml`.
2. Set the following substitutions:
   - `_PROJECT_ID` — your GCP project ID
   - `_REGION` — e.g. `us-central1`
   - `_REPO_NAME` — Artifact Registry repository (default: `zecathon`)
   - `_SERVICE_NAME` — Cloud Run service name (default: `zecathon-backend`)
   - `_DB_INSTANCE` — Cloud SQL connection name: `PROJECT_ID:REGION:INSTANCE_ID`
3. Ensure the four Secret Manager secrets below exist before the first run.

## Self-hosted VM deployment (no gcloud CLI)

If you prefer to run everything on a single GCP Compute Engine VM and manage it through the browser SSH terminal, use this path instead. It does **not** require `gcloud`, Cloud Run, Cloud SQL, or Firebase Hosting.

Architecture:
- **VM**: GCP Compute Engine (Ubuntu 22.04/24.04 LTS, e2-medium or larger).
- **Database**: PostgreSQL running inside Docker with a persistent volume.
- **Backend**: Docker container running **gunicorn** + uvicorn workers.
- **Frontend**: Built React SPA served by host **nginx**.
- **Reverse proxy / SSL**: Host **nginx** with optional Let's Encrypt (via certbot) or a self-signed certificate.
- **Process management**: **systemd** `zecathon.service` keeps the Docker stack up.

### Steps

1. In the GCP Console, create a Compute Engine VM and add firewall rules for **TCP 80** and **TCP 443**.
2. (Optional) Point a domain's DNS A record to the VM's external IP. If you don't provide a domain, the script automatically detects the VM's external IP and uses a self-signed certificate.
3. Open the browser SSH terminal and run:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/Zethetaprojects/Zecathon.git /opt/zecathon
cd /opt/zecathon
sudo ./gcp/deploy-vm.sh
```

The script will:
1. Install Docker, nginx, certbot, and Node.js.
2. Build the frontend SPA.
3. Configure nginx and obtain an SSL certificate.
4. Create a systemd service that starts PostgreSQL + backend via `gcp/docker-compose.vm.yml`.
5. Start the application and wait for the backend health check.

After deployment:

```bash
sudo systemctl status zecathon
sudo journalctl -u zecathon -f
sudo docker compose -f /opt/zecathon/gcp/docker-compose.vm.yml logs -f
```

To redeploy after code changes:

```bash
cd /opt/zecathon
git pull origin main
sudo systemctl restart zecathon
sudo systemctl reload nginx
```

## Manual deployment steps

If you prefer to deploy manually instead of using `gcp/deploy.sh`, follow the steps below.

## Overview

- **Backend**: FastAPI API served on **Cloud Run**.
- **Frontend**: React SPA served from **Cloud Storage** behind **Cloud Load Balancing** / **Cloud CDN**, or hosted on **Firebase Hosting**.
- **Database**: PostgreSQL via **Cloud SQL** for production.
- **File storage**: Local uploads for Docker Compose / Cloud Run; use **Cloud Storage** for production file uploads.
- **Secrets**: Store `GEMINI_API_KEY`, `SECRET_KEY`, `DATABASE_URL`, `GITHUB_TOKEN` in **Secret Manager**.
- **Container images**: Use **Artifact Registry** (recommended) instead of the legacy `gcr.io` path.

---

## 1. Prerequisites

- A GCP project with billing enabled.
- `gcloud` CLI authenticated (`gcloud auth login && gcloud config set project PROJECT_ID`).
- Docker installed locally.
- Firebase CLI (`npm install -g firebase-tools`) if using Firebase Hosting.

---

## 2. Build and push the backend image

Set up an Artifact Registry repository first (e.g. `zecathon`):

```bash
gcloud artifacts repositories create zecathon --repository-format=docker --location=us-central1
```

Then build and push:

```bash
cd backend
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT_ID/zecathon/backend
cd ..
```

## 3. Deploy the backend to Cloud Run

Create the required secrets first:

```bash
gcloud secrets create zecathon-secret-key --replication-policy automatic
gcloud secrets versions add zecathon-secret-key --data-file=- <<< "your-very-long-secret-key"

gcloud secrets create zecathon-gemini-key --replication-policy automatic
gcloud secrets versions add zecathon-gemini-key --data-file=- <<< "YOUR_GEMINI_API_KEY"

gcloud secrets create zecathon-db-url --replication-policy automatic
gcloud secrets versions add zecathon-db-url --data-file=- <<< "postgresql+psycopg2://DB_USER:DB_PASS@/DB_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_ID"
```

Deploy to Cloud Run (connect to the Cloud SQL instance and expose the service):

```bash
gcloud run deploy zecathon-backend \
  --image us-central1-docker.pkg.dev/PROJECT_ID/zecathon/backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-3.5-flash-lite \
  --update-secrets GEMINI_API_KEY=zecathon-gemini-key:latest,SECRET_KEY=zecathon-secret-key:latest,DATABASE_URL=zecathon-db-url:latest \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_ID \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 10 \
  --max-instances 5
```

**Note**: SQLite is ephemeral on Cloud Run. For production persistence, use Cloud SQL (set `DATABASE_URL` to a PostgreSQL connection string) and Cloud Storage for uploads.

---

## 4. Deploy the frontend

The frontend is a Vite-built React SPA. It makes requests to `/api` and `/uploads`, so the production host must serve those paths from the backend.

### Option A — Cloud Storage + Cloud Load Balancing (recommended for production)

1. Build the SPA:

```bash
cd frontend
npm ci
npm run build
```

2. Upload the `dist/` folder to a Cloud Storage bucket configured for static website hosting.

3. Put a load balancer in front of the bucket with URL maps:
   - `/*` → bucket (static site)
   - `/api/*` → Cloud Run backend service
   - `/uploads/*` → Cloud Run backend service

Set the backend Cloud Run URL as the origin for `/api` and `/uploads`.

### Option B — Firebase Hosting

```bash
cd frontend
npm ci
npm run build
firebase init hosting   # select the dist folder, configure rewrite to index.html
firebase deploy
```

Firebase Hosting rewrites to `index.html` for SPA routing, but you will still need to proxy `/api` and `/uploads` to the backend (e.g. via Firebase Hosting rewrites to a Cloud Function/Cloud Run, or by pointing the frontend `api/client.ts` baseURL directly at the Cloud Run URL and switching uploads to a public Cloud Storage bucket).

---

## 5. Docker Compose local deployment

Use the production-like compose file with a local PostgreSQL container:

```bash
cp backend/.env.example backend/.env
# edit backend/.env with GEMINI_API_KEY, SECRET_KEY, etc.
docker compose -f docker-compose.yml up --build
```

- Backend API docs: http://localhost:8000/docs
- Frontend: http://localhost
- PostgreSQL: localhost:5432 (user `zecathon`, password `zecathon_secret`, database `zecathon`)
- The frontend nginx container proxies `/api` and `/uploads` to the backend service.

For an external managed database, use `docker-compose.prod.yml` and set `DATABASE_URL` to the PostgreSQL connection string.

---

## 6. Post-deployment checklist

- [ ] Create the first admin or organiser account via `/api/auth/register`.
- [ ] Upgrade a user role to `admin` via the admin dashboard or the `PUT /api/auth/users/{id}/role` endpoint.
- [ ] Create a hackathon, upload problem statements, and test an evaluation.
- [ ] Verify the public leaderboard share link works without authentication.
- [ ] Confirm uploaded problem statements and non-tech submissions are reachable via `/uploads/{filename}` (proxied by nginx or served by the backend).
- [ ] Confirm the Gemini API key is valid (keys start with `AIza...`).

---

## 7. Production notes

- Use **Cloud SQL** for PostgreSQL instead of SQLite for data persistence and multi-instance scaling. The Cloud Run service must be connected to the Cloud SQL instance (see `--add-cloudsql-instances` above).
- Move uploads to **Cloud Storage** and update `app/services/file_storage.py` to upload/download objects from the bucket. Serve public uploads through a Cloud Storage bucket or proxy them via the load balancer under `/uploads`.
- Use **Cloud Armor** or a load balancer for rate limiting and DDoS protection; the in-memory limiter resets on each container instance.
- Enable HTTPS for both frontend and backend; Cloud Run, Firebase Hosting, and Cloud Load Balancing provide HTTPS by default.
- Rotate `SECRET_KEY`, `GEMINI_API_KEY`, and database credentials regularly via Secret Manager.
- The `frontend/nginx/default.conf` included in the Docker image already proxies `/api` and `/uploads` to the backend service. If you serve the frontend from Cloud Storage instead, replicate those path rules in the load balancer.
