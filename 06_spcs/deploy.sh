#!/usr/bin/env bash
# =====================================================================
# FOI Sentinel v2 — build, push and (re)deploy the SPCS service
# Prereqs: Docker running; Snow CLI logged in (connection PG-SNOWFLAKE);
#          infra.sql already run (compute pool + image repository exist).
# =====================================================================
set -euo pipefail

CONN="${SNOWFLAKE_CONNECTION:-PG-SNOWFLAKE}"
DB="FOI"; SCHEMA="FOI_SENTINEL_V2"; REPO="IMAGES"; IMAGE="foi_sentinel"; TAG="${1:-latest}"
HERE="$(cd "$(dirname "$0")" && pwd)"

# 1. Resolve the image registry URL
REG_URL="$(snow spcs image-registry url --connection "$CONN" | tail -1)"
echo "Registry: $REG_URL"

# 2. Stage the shared app_pages next to the Dockerfile build context
rm -rf "$HERE/app_pages"
cp -R "$HERE/../05_app/app_pages" "$HERE/app_pages"

# 3. Build (linux/amd64 for SPCS), tag, push. Docker requires a lowercase repo path.
PATH_LC="$(echo "${DB}/${SCHEMA}/${REPO}/${IMAGE}" | tr '[:upper:]' '[:lower:]')"
FULL="${REG_URL}/${PATH_LC}:${TAG}"
docker build --platform linux/amd64 -t "$FULL" "$HERE"
snow spcs image-registry login --connection "$CONN"
docker push "$FULL"

# 4. Upgrade in place if the service exists (keeps the same endpoint URL); else create.
EXISTS="$(snow sql --connection "$CONN" -q "SHOW SERVICES LIKE 'FOI_SENTINEL_UI' IN SCHEMA ${DB}.${SCHEMA};" 2>/dev/null | grep -c FOI_SENTINEL_UI || true)"
if [ "$EXISTS" -gt 0 ]; then
  echo "Service exists — upgrading in place (URL preserved)..."
  snow sql --connection "$CONN" -q "ALTER SERVICE ${DB}.${SCHEMA}.FOI_SENTINEL_UI FROM SPECIFICATION \$\$
$(cat "$HERE/service-spec.yaml")
\$\$;"
else
  snow spcs service create FOI_SENTINEL_UI \
    --compute-pool FOI_SENTINEL_POOL \
    --spec-path "$HERE/service-spec.yaml" \
    --database "$DB" --schema "$SCHEMA" \
    --connection "$CONN"
  snow sql --connection "$CONN" -q "
  GRANT SERVICE ROLE ${DB}.${SCHEMA}.FOI_SENTINEL_UI!ALL_ENDPOINTS_USAGE TO ROLE FOI_REVIEWER;"
fi

echo "Fetching the public URL..."
snow sql --connection "$CONN" -q "SHOW ENDPOINTS IN SERVICE ${DB}.${SCHEMA}.FOI_SENTINEL_UI;"
