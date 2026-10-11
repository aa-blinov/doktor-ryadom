#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
caddy_file=${CADDY_FILE:-/home/ubuntu/infra/caddy/Caddyfile}
fragment="$project_dir/deploy/Caddyfile.fragment"
if grep -Eq '^doktor-ryadom\.duckdns\.org[[:space:]]*\{' "$caddy_file"; then
  docker exec edge-caddy caddy validate --config /etc/caddy/Caddyfile
  docker exec edge-caddy caddy reload --config /etc/caddy/Caddyfile
  exit 0
fi
candidate=$(mktemp)
trap 'rm -f "$candidate"' EXIT
cat "$caddy_file" "$fragment" > "$candidate"
docker exec -i edge-caddy sh -c 'cat > /tmp/ryadom-persistent-Caddyfile' < "$candidate"
docker exec edge-caddy caddy validate --config /tmp/ryadom-persistent-Caddyfile --adapter caddyfile
backup="${caddy_file}.before-ryadom.$(date +%Y%m%d-%H%M%S)"
cp -p -- "$caddy_file" "$backup"
printf '\n' >> "$caddy_file"
cat "$fragment" >> "$caddy_file"
if ! docker exec edge-caddy caddy reload --config /etc/caddy/Caddyfile; then
  cat "$backup" > "$caddy_file"
  docker exec edge-caddy caddy reload --config /etc/caddy/Caddyfile
  exit 1
fi
printf 'Caddyfile updated. Backup: %s\n' "$backup"
