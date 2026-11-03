#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/lambda/transcode"
if command -v npm >/dev/null 2>&1; then
  npm install --omit=dev
else
  echo "npm is required to install transcode Lambda dependencies" >&2
  exit 1
fi
