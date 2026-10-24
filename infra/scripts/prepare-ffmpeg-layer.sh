#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAYER_BIN="$ROOT/layers/ffmpeg/bin"

if [[ -x "$LAYER_BIN/ffmpeg" && -x "$LAYER_BIN/ffprobe" ]]; then
  echo "ffmpeg layer binaries already present"
  exit 0
fi

mkdir -p "$LAYER_BIN"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

URL="${FFMPEG_STATIC_URL:-https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz}"
echo "Downloading static ffmpeg from $URL"
curl -fsSL "$URL" -o "$TMP/ffmpeg.tar.xz"
tar -xJf "$TMP/ffmpeg.tar.xz" -C "$TMP"

FFMPEG_BIN="$(find "$TMP" -type f -name ffmpeg -print -quit)"
FFPROBE_BIN="$(find "$TMP" -type f -name ffprobe -print -quit)"

if [[ -z "$FFMPEG_BIN" || -z "$FFPROBE_BIN" ]]; then
  echo "Could not find ffmpeg/ffprobe in the archive" >&2
  exit 1
fi

cp "$FFMPEG_BIN" "$LAYER_BIN/ffmpeg"
cp "$FFPROBE_BIN" "$LAYER_BIN/ffprobe"
chmod +x "$LAYER_BIN/ffmpeg" "$LAYER_BIN/ffprobe"
echo "Wrote $LAYER_BIN/ffmpeg and $LAYER_BIN/ffprobe"
