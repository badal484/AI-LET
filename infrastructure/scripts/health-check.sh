#!/usr/bin/env bash
set -e

API_URL="${1:-http://localhost:4000/health}"

echo "Checking API health at $API_URL..."
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" || echo "000")

if [ "$HTTP_RESPONSE" -eq 200 ]; then
  echo "✅ API is healthy (HTTP 200)"
  exit 0
else
  echo "❌ Health check failed with HTTP $HTTP_RESPONSE"
  exit 1
fi
