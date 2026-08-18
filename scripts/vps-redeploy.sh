#!/bin/bash
set -euo pipefail
cd /var/www/blood

echo "=== Pull mobile ==="
git fetch origin mobile
git reset --hard origin/mobile

echo "=== Clean install (keep lockfile) ==="
rm -rf node_modules
npm install --no-audit --no-fund

ROLLDOWN_VER=$(node -p "require('./node_modules/vite/node_modules/rolldown/package.json').version")
echo "=== Linux native bindings (rolldown=$ROLLDOWN_VER) ==="
npm install \
  "@rolldown/binding-linux-x64-gnu@$ROLLDOWN_VER" \
  lightningcss-linux-x64-gnu \
  @tailwindcss/oxide-linux-x64-gnu \
  --no-save --no-audit --no-fund

echo "=== Build ==="
npm run build

echo "=== Restart ==="
set -a
# shellcheck disable=SC1091
. ./.env
set +a
pm2 restart blood --update-env || pm2 start .output/server/index.mjs --name blood
pm2 save
sleep 2
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3000/
pm2 logs blood --err --lines 10 --nostream
echo "DONE $(git log -1 --oneline)"
