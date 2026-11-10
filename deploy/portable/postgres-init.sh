#!/bin/sh
set -eu
# Values are bound by psql, never interpolated into SQL text by the shell.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=app_password="$PORTABLE_DB_APP_PASSWORD" <<'SQL'
CREATE ROLE portable_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE observatorio_portable_test TO portable_app;
GRANT USAGE, CREATE ON SCHEMA public TO portable_app;
SQL
