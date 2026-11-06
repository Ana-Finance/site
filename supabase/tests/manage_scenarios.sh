#!/usr/bin/env bash
# Scénarios du script de gestion (scripts/supabase-manage.mjs) sur des bases jetables.
# Appelé par run.sh avec ADMIN_URL_BASE = URL de connexion sans nom de base (…/postgres?host=…).
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
mk() { "${PSQL[@]}" "$BASE_URL/postgres$QS" -c "drop database if exists $1" -c "create database $1"; "${PSQL[@]}" "$BASE_URL/$1$QS" -f supabase/tests/stubs.sql; }
run() { LOCAL_DATABASE_URL="$BASE_URL/$1$QS" SUPABASE_PROJECT_REF=local node scripts/supabase-manage.mjs "${@:2}"; }
expect() { grep -q "$2" <<<"$1" || { echo "ÉCHEC : « $2 » attendu dans :"; echo "$1"; exit 1; }; }

echo "scénario   base vierge"
mk m_fresh
out=$(run m_fresh migrations); expect "$out" "Migrations : 4 appliquée"
out=$(run m_fresh seed); expect "$out" "15 page(s) en base (15 ajoutée"
out=$(run m_fresh migrations); expect "$out" "Migrations : 0 appliquée"
out=$(run m_fresh seed); expect "$out" "15 page(s) en base (0 ajoutée"
out=$(run m_fresh diagnostic); expect "$out" "Tables : 12 (RLS active sur 12) ✓"; expect "$out" "Migrations enregistrées : 4 ✓"; expect "$out" "Bucket « media » privé : ✓"

echo "scénario   fichiers déjà collés à la main dans l'éditeur SQL"
mk m_manual
for f in supabase/migrations/*.sql supabase/seed/content.sql; do "${PSQL[@]}" "$BASE_URL/m_manual$QS" -f "$f"; done
out=$(run m_manual migrations); expect "$out" "Migrations : 0 appliquée"; expect "$out" "exécutée à la main"
out=$(run m_manual seed); expect "$out" "(0 ajoutée"

echo "scénario   seul le premier fichier a été collé"
mk m_partial
"${PSQL[@]}" "$BASE_URL/m_partial$QS" -f supabase/migrations/20261105000100_schema.sql
out=$(run m_partial migrations); expect "$out" "Migrations : 3 appliquée"
out=$(run m_partial seed); expect "$out" "15 page(s) en base"

echo "scénario   base sans historique"
mk m_empty
out=$(run m_empty diagnostic); expect "$out" "historique absent"
echo "OK : scénarios du script de gestion vérifiés."
