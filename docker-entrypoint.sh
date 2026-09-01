#!/bin/sh
set -e

# Seed the SQLite database if it does not exist yet (first boot on a fresh
# persistent disk). The seed script is idempotent: it replaces all rows, so
# running it on every boot would wipe merchant decisions/feedback. Hence the
# existence check.
if [ ! -f "$DATABASE_PATH" ]; then
  echo "==> Database not found, seeding $DATABASE_PATH ..."
  node ./server/dist/scripts/seed.js
  echo "==> Seeding complete."
fi

echo "==> Starting MerchantShield server on :$PORT ..."
exec node ./server/dist/index.js