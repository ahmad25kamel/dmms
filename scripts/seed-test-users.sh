#!/usr/bin/env bash
# Seed test users for development/E2E testing.
# Usage: ./scripts/seed-test-users.sh [BASE_URL]
# Default BASE_URL: http://localhost:3005

set -euo pipefail

BASE="${1:-http://localhost:3005}/api/dmms"

register() {
  local username="$1" name="$2" password="$3" role="$4"
  echo "Registering $username ($role)..."
  curl -sf -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$username\",\"name\":\"$name\",\"password\":\"$password\",\"role\":\"$role\"}" \
    | jq -r '.data.username // "already exists"'
}

login_token() {
  local username="$1" password="$2"
  curl -sf -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$username\",\"password\":\"$password\"}" \
    | jq -r '.data.token'
}

# Register base users
register "test_pm"          "Test PM"          "password123" "pm"
register "test_contributor" "Test Contributor" "password123" "contributor"
register "test_admin"       "Test Admin"       "password123" "contributor"

# Promote test_admin to admin via admin API
# First, log in as an existing admin if available, or use direct DB promotion instructions.
echo ""
echo "✅ Users registered:"
echo "   test_pm / password123 (pm)"
echo "   test_contributor / password123 (contributor)"
echo "   test_admin / password123 (needs admin promotion)"
echo ""
echo "To promote test_admin to admin, run:"
echo "   mysql -u \$DB_USERNAME -p\$DB_PASSWORD \$DB_DATABASE -e \\"
echo "   \"UPDATE dmms_users SET role='admin' WHERE username='test_admin';\""
echo ""
echo "Or via admin API (if you already have an admin token):"
echo "   ADMIN_TOKEN=<your-admin-token>"
echo "   USER_ID=\$(curl -sf \$BASE/users | jq -r '.data[] | select(.username==\"test_admin\") | .id')"
echo "   curl -sf -X PATCH \"\$BASE/admin/users/\$USER_ID/role\" \\"
echo "        -H \"Authorization: Bearer \$ADMIN_TOKEN\" \\"
echo "        -H \"Content-Type: application/json\" \\"
echo "        -d '{\"role\":\"admin\"}'"
