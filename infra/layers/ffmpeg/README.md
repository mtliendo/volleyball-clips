# ffmpeg Lambda layer

`bin/ffmpeg` and `bin/ffprobe` are produced by `scripts/prepare-ffmpeg-layer.sh` and are not committed.

The deploy script downloads a static amd64 ffmpeg build and places the binaries here so Lambda sees them at `/opt/bin`.
