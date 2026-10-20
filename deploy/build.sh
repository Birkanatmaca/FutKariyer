#!/bin/sh
# Builds the deployable context into deploy/out: static linux/amd64 binaries and the admin web build.
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/deploy/out"
rm -rf "$out" && mkdir -p "$out/bin"
cd "$root/backend"
# The version in every log line and in build_info: date and commit, plus
# "-dirty" when the working tree had uncommitted changes.
commit=$(git -C "$root" rev-parse --short HEAD 2>/dev/null || echo unknown)
git -C "$root" diff --quiet HEAD 2>/dev/null || commit="$commit-dirty"
version="$(date -u +%Y.%m.%d)+$commit"
for cmd in api migrate admin seed; do
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "-s -w -X main.version=$version" -o "$out/bin/$cmd" "./cmd/$cmd"
done
cd "$root/frontend" && npm run build >/dev/null
cp -R "$root/frontend/dist" "$out/admin"
cp "$root/deploy/Dockerfile" "$root/deploy/entrypoint.sh" "$root/deploy/docker-compose.yml" "$out/"
echo "built $out ($version)"
