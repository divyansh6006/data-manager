#!/usr/bin/env bash
# Deploy/update script for the Lead Management CRM on a Linux VPS.
# Run this ON THE SERVER, from the repo root, after the code is already there
# (git pull / rsync / scp) and backend/.env has been configured with real
# production values (JWT_SECRET, DATABASE_URL, CORS_ORIGIN, etc).
#
# Usage: bash deploy/deploy.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Installing backend dependencies"
cd "$REPO_ROOT/backend"
npm ci --omit=dev

echo "==> Running database migrations"
NODE_ENV=production npm run migrate

echo "==> Installing frontend dependencies and building"
cd "$REPO_ROOT/frontend"
npm ci
npm run build

echo "==> Restarting backend service"
sudo systemctl restart skilllabs-backend

echo "==> Reloading nginx"
sudo nginx -t
sudo systemctl reload nginx

echo "==> Done. Tail logs with: journalctl -u skilllabs-backend -f"
