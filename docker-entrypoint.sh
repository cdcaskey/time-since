#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}
CONFIG_DIR=${CONFIG_DIR:-/config}
DATA_DIR=${DATA_DIR:-/data}

mkdir -p "$CONFIG_DIR" "$DATA_DIR"

# Seed default config files into CONFIG_DIR, but only where nothing
# already exists — user overrides on the host always win, and later
# image updates can add new default files without clobbering edits.
# find (not a `*` glob) so dotfiles like config-defaults/.env are included —
# a bare `*` glob skips them, and `ls -A`-then-`for f in *` (the previous
# form here) silently no-ops in exactly that case.
if [ -d /app/config-defaults ]; then
  find /app/config-defaults -mindepth 1 -maxdepth 1 | while read -r f; do
    name=$(basename "$f")
    [ -e "$CONFIG_DIR/$name" ] || cp "$f" "$CONFIG_DIR/$name"
  done
fi

# The PUID/PGID remap requires root; if the container was started as a
# non-root user instead (rootless Docker, Kubernetes runAsNonRoot),
# skip it and run as whatever user we already are.
if [ "$(id -u)" = "0" ]; then
  groupmod -o -g "$PGID" app 2>/dev/null || true
  usermod -o -u "$PUID" app 2>/dev/null || true
  chown -R app:app "$CONFIG_DIR" "$DATA_DIR"
  exec su-exec app "$@"
else
  exec "$@"
fi
