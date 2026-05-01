#!/bin/bash
set -e

DB_PATH="${DB_PATH:-/tmp/document_analysis.db}"
export DB_PATH

if [ ! -f "$DB_PATH" ]; then
  echo "Decompressing database..."
  gunzip -c document_analysis.db.gz > "$DB_PATH"
  echo "Database ready ($(du -sh $DB_PATH | cut -f1))"
else
  echo "Database already present at $DB_PATH"
fi

exec npx tsx api_server.ts
