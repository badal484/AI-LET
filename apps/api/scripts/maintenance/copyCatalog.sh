#!/usr/bin/env bash
# Fills a NEW, EMPTY production database with Loveek's platform data from your Mac — characters (with
# their versions, categories, tags, discovery settings), plans and prices, admin roles — and creates one
# admin login. No users, chats or test data are copied. Run once, after the first deploy has applied the
# migrations:
#
#   cd apps/api
#   TARGET_DATABASE_URL='<Render Postgres → External Database URL>' \
#   ADMIN_EMAIL='you@example.com' ADMIN_PASSWORD='a long new password' \
#   bash scripts/maintenance/copyCatalog.sh
#
# SOURCE_DATABASE_URL defaults to DATABASE_URL in apps/api/.env. Refuses if the target already has characters.
set -euo pipefail
cd "$(dirname "$0")/../.."

SRC="${SOURCE_DATABASE_URL:-$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')}"
SRC="${SRC%%\?*}"
TGT="${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL (Render Postgres → External Database URL)}"
: "${ADMIN_EMAIL:?Set ADMIN_EMAIL}"
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD}"
if [ "${#ADMIN_PASSWORD}" -lt 12 ]; then echo "ADMIN_PASSWORD must be at least 12 characters." >&2; exit 1; fi

q() { psql "$1" -X -v ON_ERROR_STOP=1 -At -c "$2"; }

echo "→ Checking the target database…"
[ "$(q "$TGT" "select count(*) from _prisma_migrations where finished_at is not null")" -gt 0 ] || { echo "Target has no migrations yet — deploy first." >&2; exit 1; }
[ "$(q "$TGT" "select count(*) from characters")" = "0" ] || { echo "Target already has characters — refusing to copy over them." >&2; exit 1; }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
LOAD="$WORK/load.sql"
echo "BEGIN;" > "$LOAD"

# table → columns to blank (links to test users / creator accounts that don't exist in production)
copy_table() {
  local table="$1" blank="${2:-}"
  local cols select=""
  cols="$(q "$SRC" "select string_agg(quote_ident(column_name), ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='$table'")"
  IFS=',' read -ra arr <<< "$cols"
  for c in "${arr[@]}"; do
    if [[ ",$blank," == *",${c//\"/},"* ]]; then select+="NULL as $c,"; else select+="$c,"; fi
  done
  select="${select%,}"
  psql "$SRC" -X -v ON_ERROR_STOP=1 -q -c "\copy (select $select from $table) to '$WORK/$table.csv' csv header"
  echo "\\copy $table ($cols) from '$WORK/$table.csv' csv header" >> "$LOAD"
  echo "   $table: $(q "$SRC" "select count(*) from $table") rows"
}

echo "→ Reading from your Mac…"
for t in admin_permissions admin_roles admin_role_permissions \
         billing_products billing_plans billing_prices plan_entitlements plan_usage_limits billing_promotions \
         character_categories character_tags; do copy_table "$t"; done
copy_table characters "created_by_id,creator_profile_id,current_published_version_id"
copy_table character_versions "created_by_id"
for t in character_discovery_configs character_tag_links character_skills curated_collections; do copy_table "$t"; done

# Characters ↔ versions point at each other: set each character's published version after both exist.
psql "$SRC" -X -v ON_ERROR_STOP=1 -q -c "\copy (select id, current_published_version_id from characters) to '$WORK/published.csv' csv header"
cat >> "$LOAD" <<SQL
CREATE TEMP TABLE _published (id uuid, version_id uuid);
\copy _published from '$WORK/published.csv' csv header
UPDATE characters c SET current_published_version_id = p.version_id FROM _published p WHERE p.id = c.id;
COMMIT;
SQL

echo "→ Writing to the production database (one transaction)…"
psql "$TGT" -X -v ON_ERROR_STOP=1 -q -f "$LOAD"

echo "→ Creating the admin login…"
DATABASE_URL="$TGT" ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" npx tsx scripts/maintenance/createAdmin.ts

echo "✓ Done: $(q "$TGT" "select count(*) from characters where status='PUBLISHED'") published characters, admin $ADMIN_EMAIL."
