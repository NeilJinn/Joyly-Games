#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Stopping existing processes..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

echo "Building app..."
npm run build

echo "Starting dev:all..."
npm run dev:all
