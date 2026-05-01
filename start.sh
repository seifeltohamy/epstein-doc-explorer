#!/bin/bash
set -e

DB_PATH="${DB_PATH:-/tmp/document_analysis.db}"
export DB_PATH

if [ ! -f "$DB_PATH" ]; then
  echo "Downloading database from Supabase Storage..."
  curl -fL \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    "${SUPABASE_URL}/storage/v1/object/database/document_analysis.db" \
    -o "$DB_PATH"
  echo "Database downloaded ($(du -sh $DB_PATH | cut -f1))"
else
  echo "Database already present at $DB_PATH"
fi

exec npx tsx api_server.ts
