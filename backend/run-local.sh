#!/usr/bin/env bash
# Local dev launcher. Reuses Orbit's DB connection (same SIMW schema; ATS tables are ATS_-prefixed).
# Reads the DB password from Orbit's application.yml so it never gets copied into this repo.
cd "$(dirname "$0")"
ORBIT_YML="/c/Users/Administrator/Desktop/integration-orbit/backend/src/main/resources/application.yml"
if [ -z "${ATS_DB_PASSWORD:-}" ]; then
  ATS_DB_PASSWORD="$(sed -nE 's/^[[:space:]]*password:[[:space:]]*\$\{ORBIT_DB_PASSWORD:([^}]*)\}.*/\1/p' "$ORBIT_YML" | head -1)"
  export ATS_DB_PASSWORD
fi
# Stable dev signing key so restarts don't sign everyone out (file is gitignored).
if [ -z "${ATS_JWT_SECRET:-}" ] && [ -f .local-jwt-secret ]; then
  ATS_JWT_SECRET="$(cat .local-jwt-secret)"
  export ATS_JWT_SECRET
fi
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot"
mkdir -p .tmp
mkdir -p logs
exec "$JAVA_HOME/bin/java" -Djdk.net.unixdomain.tmpdir="$(cygpath -w "$PWD/.tmp")" -jar target/ats-backend.jar
