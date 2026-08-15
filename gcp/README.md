# ZECATHON GCP Deployment Guide

This guide covers deploying the ZECATHON platform on Google Cloud Platform.

## Overview

- **Backend**: FastAPI API served on **Cloud Run**.
- **Frontend**: React SPA hosted on **Firebase Hosting** or **Cloud Run**.
- **Database**: SQLite for local / Docker Compose; use **Cloud SQL (PostgreSQL)** for production.
- **File storage**: Local uploads for Docker Compose; use **Cloud Storage** for production.
- **Secrets**: Store `GEMINI_API_KEY`, `SECRET_KEY`, `GITHUB_TOKEN` in **Secret Manager**.

---

## 1. Prerequisites

- A GCP project with billing enabled.
- `gcloud` CLI authenticated (`gcloud auth login && gcloud config set project PROJECT_ID`).
- Docker installed locally.
- Firebase CLI (`npm install -g firebase-tools`) if using Firebase Hosting.

---

## 2. Build and push the backend image

```bash
cd backend
gcloud builds submit --tag gcr.io/PROJECT_ID/zecathon-backend
cd ..
```

## 3. Deploy the backend to Cloud Run

Create required secrets first:

```bash
gcloud secrets create zecathon-secret-key --replication-policy automatic
gcloud secrets versions add zecathon-secret-key --data-file=- <<< "your-very-long-secret-key"

gcloud secrets create zecathon-gemini-key --replication-policy automatic
gcloud secrets versions add zecathon-gemini-key --data-file=- <<< "YOUR_GEMINI_API_KEY"
```

Deploy:

```bash
gcloud run deploy zecathon-backend \
  --image gcr.io/PROJECT_ID/zecathon-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash \
  --update-secrets GEMINI_API_KEY=zecathon-gemini-key:latest,SECRET_KEY=zecathon-secret-key:latest \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 10 \
  --max-instances 5
```

**Note**: SQLite is ephemeral on Cloud Run. For production persistence, use Cloud SQL (set `DATABASE_URL` to a PostgreSQL connection string) and Cloud Storage for uploads.

---

## 4. Deploy the frontend

### Option A: Firebase Hosting (recommended for SPA)

```bash
cd frontend
npm run build
firebase init hosting   # select the dist folder, configure rewrite to index.html
firebase deploy
```

Set the frontend API base URL to the Cloud Run backend URL (e.g. via `api/client.ts` `baseURL` or a runtime env variable).

### Option B: Cloud Run

```bash
cd frontend
gcloud builds submit --tag gcr.io/PROJECT_ID/zecathon-frontend
gcloud run deploy zecathon-frontend \
  --image gcr.io/PROJECT_ID/zecathon-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 5. Docker Compose local deployment

```bash
cp backend/.env.example backend/.env
# edit backend/.env with GEMINI_API_KEY, SECRET_KEY, etc.
docker-compose up --build
```

- Backend: http://localhost:8000
- Frontend: http://localhost

---

## 6. Post-deployment checklist

- [ ] Create the first admin/organiser account via `/api/auth/register`.
- [ ] Upgrade the user role to `admin` directly in the database or via the admin dashboard.
- [ ] Create a hackathon, upload problem statements, and test an evaluation.
- [ ] Verify the public leaderboard share link works without authentication.
- [ ] Confirm the Gemini API key is valid (keys start with `AIza...`).

---

## 7. Production notes

- Use **Cloud SQL** for PostgreSQL instead of SQLite for data persistence and multi-instance scaling.
- Move uploads to **Cloud Storage** and update `UPLOAD_DIR` / file storage logic accordingly.
- Use **Cloud Armor** or a load balancer for rate limiting and DDoS protection; the in-memory limiter resets on each container instance.
- Enable HTTPS for both frontend and backend; Cloud Run and Firebase Hosting provide HTTPS by default.
- Rotate `SECRET_KEY` and `GEMINI_API_KEY` regularly via Secret Manager.
