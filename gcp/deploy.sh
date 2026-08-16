#!/usr/bin/env bash
# ZECATHON — One-click GCP deployment script
#
# What it does:
#   1. Enables required GCP APIs.
#   2. Creates an Artifact Registry repository.
#   3. Creates/verifies a Cloud SQL PostgreSQL instance + database + user.
#   4. Creates Secret Manager secrets for SECRET_KEY, GEMINI_API_KEY, GITHUB_TOKEN, DATABASE_URL.
#   5. Builds and pushes the backend Docker image.
#   6. Deploys the backend to Cloud Run connected to Cloud SQL.
#   7. Builds the frontend SPA and deploys it to Firebase Hosting.
#
# Usage:
#   export GCP_PROJECT_ID="your-project-id"
#   export GCP_REGION="us-central1"
#   export GEMINI_API_KEY="AIza..."          # optional but recommended
#   export GITHUB_TOKEN="ghp_..."             # optional, raises GitHub API limits
#   ./gcp/deploy.sh
#
# Required tools:
#   - gcloud (authenticated and project set)
#   - docker (for local image builds; optional — Cloud Build is used by default)
#   - firebase CLI (npm install -g firebase-tools)
#   - npm / node

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration (override via environment variables)
# -----------------------------------------------------------------------------
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GCP_REGION:-us-central1}"
ZONE="${GCP_ZONE:-${REGION}-a}"
REPO_NAME="${ARTIFACT_REGISTRY_REPO:-zecathon}"
BACKEND_SERVICE="${CLOUD_RUN_SERVICE:-zecathon-backend}"
DB_INSTANCE="${CLOUD_SQL_INSTANCE:-zecathon-db}"
DB_NAME="${CLOUD_SQL_DB:-zecathon}"
DB_USER="${CLOUD_SQL_USER:-zecathon}"
DB_PASSWORD="${CLOUD_SQL_PASSWORD:-}"
SECRET_KEY="${SECRET_KEY:-}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
FIREBASE_PROJECT="${FIREBASE_PROJECT_ID:-${PROJECT_ID}}"
FRONTEND_MODE="${FRONTEND_MODE:-firebase}"  # firebase | gcs

# Derived values
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/backend"
SQL_INSTANCE_CONNECTION="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
prompt_if_missing() {
  local var_name="$1"
  local prompt_text="$2"
  local current_value="${!var_name}"
  if [[ -z "$current_value" ]]; then
    read -rp "$prompt_text" current_value
    eval "export $var_name=\"$current_value\""
  fi
}

random_password() {
  openssl rand -base64 24 | tr '+/' '-_' | cut -c1-24
}

random_secret() {
  openssl rand -hex 48
}

confirm() {
  read -rp "$1 [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

# -----------------------------------------------------------------------------
# Preflight checks
# -----------------------------------------------------------------------------
log_info "Preflight checks..."

command -v gcloud >/dev/null 2>&1 || { log_error "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"; exit 1; }
command -v npm >/dev/null 2>&1 || { log_error "npm not found. Install Node.js: https://nodejs.org"; exit 1; }
command -v firebase >/dev/null 2>&1 || { log_error "firebase CLI not found. Install: npm install -g firebase-tools"; exit 1; }

prompt_if_missing PROJECT_ID "GCP project ID (current: ${PROJECT_ID:-none}): "
if [[ -z "$PROJECT_ID" ]]; then
  log_error "PROJECT_ID is required."
  exit 1
fi

gcloud config set project "$PROJECT_ID" >/dev/null 2>&1

prompt_if_missing GEMINI_API_KEY "Gemini API key (optional, press Enter to skip): "
prompt_if_missing GITHUB_TOKEN "GitHub token (optional, press Enter to skip): "

if [[ -z "$SECRET_KEY" ]]; then
  SECRET_KEY=$(random_secret)
  log_info "Generated a 96-char SECRET_KEY."
fi

if [[ -z "$DB_PASSWORD" ]]; then
  DB_PASSWORD=$(random_password)
  log_info "Generated a 24-char database password."
fi

log_ok "Preflight complete."

# -----------------------------------------------------------------------------
# 1. Enable APIs
# -----------------------------------------------------------------------------
log_info "Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  firebase.googleapis.com \
  firebasemanagement.googleapis.com \
  storage.googleapis.com
log_ok "APIs enabled."

# -----------------------------------------------------------------------------
# 2. Artifact Registry repository
# -----------------------------------------------------------------------------
log_info "Ensuring Artifact Registry repository '${REPO_NAME}' exists..."
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="ZECATHON container images"
  log_ok "Created Artifact Registry repository."
else
  log_ok "Artifact Registry repository already exists."
fi

# -----------------------------------------------------------------------------
# 3. Cloud SQL PostgreSQL instance
# -----------------------------------------------------------------------------
log_info "Ensuring Cloud SQL instance '${DB_INSTANCE}' exists..."
if ! gcloud sql instances describe "$DB_INSTANCE" >/dev/null 2>&1; then
  log_warn "Creating Cloud SQL instance can take 5-10 minutes."
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-size=10GB \
    --storage-auto-increase \
    --no-deletion-protection \
    --availability-type=zonal \
    --root-password="$(random_password)"
  log_ok "Created Cloud SQL instance."
else
  log_ok "Cloud SQL instance already exists."
fi

log_info "Ensuring database '${DB_NAME}' exists..."
if ! gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE" >/dev/null 2>&1; then
  gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
  log_ok "Created database."
else
  log_ok "Database already exists."
fi

log_info "Ensuring database user '${DB_USER}' exists..."
if ! gcloud sql users describe "$DB_USER" --instance="$DB_INSTANCE" >/dev/null 2>&1; then
  gcloud sql users create "$DB_USER" \
    --instance="$DB_INSTANCE" \
    --password="$DB_PASSWORD"
  log_ok "Created database user."
else
  gcloud sql users set-password "$DB_USER" \
    --instance="$DB_INSTANCE" \
    --password="$DB_PASSWORD" || log_warn "Could not update DB password (may be using IAM)."
  log_ok "Database user exists; password updated."
fi

# Cloud SQL Unix-socket connection string used by Cloud Run
DATABASE_URL="postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${SQL_INSTANCE_CONNECTION}"

# -----------------------------------------------------------------------------
# 4. Secret Manager secrets
# -----------------------------------------------------------------------------
log_info "Configuring Secret Manager secrets..."

ensure_secret() {
  local name="$1"
  local value="$2"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=-
}

ensure_secret "zecathon-secret-key" "$SECRET_KEY"
ensure_secret "zecathon-gemini-key" "$GEMINI_API_KEY"
ensure_secret "zecathon-github-token" "$GITHUB_TOKEN"
ensure_secret "zecathon-db-url" "$DATABASE_URL"
log_ok "Secrets configured."

# -----------------------------------------------------------------------------
# 5. Build and push backend image
# -----------------------------------------------------------------------------
log_info "Building and pushing backend image via Cloud Build..."
gcloud builds submit backend --tag "${IMAGE_TAG}:latest"
log_ok "Backend image pushed to ${IMAGE_TAG}:latest"

# -----------------------------------------------------------------------------
# 6. Deploy backend to Cloud Run
# -----------------------------------------------------------------------------
log_info "Deploying backend to Cloud Run..."

ENV_VARS=(
  "GEMINI_MODEL=gemini-3.5-flash-lite"
  "UPLOAD_DIR=/data/uploads"
  "MAX_UPLOAD_SIZE=20971520"
  "ACCESS_TOKEN_EXPIRE_MINUTES=60"
)

gcloud run deploy "$BACKEND_SERVICE" \
  --image "${IMAGE_TAG}:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "$(IFS=,; echo "${ENV_VARS[*]}")" \
  --update-secrets "GEMINI_API_KEY=zecathon-gemini-key:latest,SECRET_KEY=zecathon-secret-key:latest,DATABASE_URL=zecathon-db-url:latest,GITHUB_TOKEN=zecathon-github-token:latest" \
  --add-cloudsql-instances "$SQL_INSTANCE_CONNECTION" \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 10 \
  --max-instances 5 \
  --timeout 300

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format 'value(status.url)')
log_ok "Backend deployed at ${BACKEND_URL}"

# -----------------------------------------------------------------------------
# 7. Build frontend and deploy
# -----------------------------------------------------------------------------
log_info "Building frontend..."
cd frontend
npm ci
npm run build

if [[ "$FRONTEND_MODE" == "firebase" ]]; then
  log_info "Deploying frontend to Firebase Hosting..."

  # Ensure Firebase project is selected
  firebase use "$FIREBASE_PROJECT" || {
    log_warn "Firebase project not initialized locally. Attempting to create/select..."
    firebase projects:create "$FIREBASE_PROJECT" || log_warn "Project may already exist or use a different ID."
    firebase use "$FIREBASE_PROJECT"
  }

  # Generate firebase.json if it doesn't exist
  if [[ ! -f firebase.json ]]; then
    cat > firebase.json <<EOF
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "$BACKEND_SERVICE",
          "region": "$REGION"
        }
      },
      {
        "source": "/uploads/**",
        "run": {
          "serviceId": "$BACKEND_SERVICE",
          "region": "$REGION"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
EOF
    log_info "Generated firebase.json with backend rewrites."
  fi

  firebase deploy --only hosting
  FRONTEND_URL=$(firebase hosting:channel:list --json 2>/dev/null | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
  [[ -z "$FRONTEND_URL" ]] && FRONTEND_URL="https://${FIREBASE_PROJECT}.web.app"

elif [[ "$FRONTEND_MODE" == "gcs" ]]; then
  log_warn "FRONTEND_MODE=gcs selected. Cloud Storage + Load Balancer setup is not fully automated in this script."
  log_warn "Upload the 'frontend/dist' folder to a Cloud Storage bucket and configure a load balancer:"
  log_warn "  /api/*   -> ${BACKEND_URL}/api/*"
  log_warn "  /uploads/* -> ${BACKEND_URL}/uploads/*"
  log_warn "  /*       -> bucket"
  FRONTEND_URL="(configure manually)"
else
  log_error "Unknown FRONTEND_MODE: $FRONTEND_MODE. Use 'firebase' or 'gcs'."
  exit 1
fi

cd ..

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo
log_ok "ZECATHON deployment complete!"
echo
printf "  %-24s : %s\n" "GCP Project" "$PROJECT_ID"
printf "  %-24s : %s\n" "Region" "$REGION"
printf "  %-24s : %s\n" "Backend (Cloud Run)" "$BACKEND_URL"
printf "  %-24s : %s\n" "Frontend" "$FRONTEND_URL"
printf "  %-24s : %s\n" "Cloud SQL instance" "$SQL_INSTANCE_CONNECTION"
printf "  %-24s : %s\n" "Database" "$DB_NAME"
printf "  %-24s : %s\n" "Artifact Registry" "${IMAGE_TAG}:latest"
echo
log_info "Next steps:"
echo "  1. Register an admin account at ${FRONTEND_URL}/register"
echo "  2. Upgrade the first user to admin via the DB or the role endpoint:"
echo "     PUT ${BACKEND_URL}/api/auth/users/1/role?role=admin  (bearer token required)"
echo "  3. Create a hackathon and upload problem statements."
echo "  4. Test a tech or non-tech evaluation."
echo
echo "  Secrets stored in Secret Manager:"
echo "    - zecathon-secret-key"
echo "    - zecathon-gemini-key"
echo "    - zecathon-github-token"
echo "    - zecathon-db-url"
echo
echo "  To redeploy only the backend after code changes:"
echo "    gcloud builds submit backend --tag ${IMAGE_TAG}:latest"
echo "    gcloud run deploy ${BACKEND_SERVICE} --image ${IMAGE_TAG}:latest --region ${REGION}"
echo
