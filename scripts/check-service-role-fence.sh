#!/usr/bin/env bash
# The service-role key bypasses RLS (docs/PLAN.md §4), so the set of modules
# that may touch it is fixed:
#
#   src/lib/env.server.ts  — the one place it is read from the environment
#   src/lib/db/admin/**    — the audited operations that legitimately use it
#
# Anything else referencing it is a security defect. This backs up the ESLint
# import fence, which cannot see a new file reading process.env directly.
set -euo pipefail

allowed_re='^src/lib/env\.server\.ts$|^src/lib/db/admin/'

offenders=$(
  grep -rl --include='*.ts' --include='*.tsx' 'SUPABASE_SERVICE_ROLE_KEY' src/ \
    | { grep -Ev "$allowed_re" || true; }
)

if [ -n "$offenders" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY referenced outside the fenced modules:"
  echo "$offenders" | sed 's/^/  - /'
  echo
  echo "It bypasses RLS. Use @/lib/db/user or @/lib/db/txn instead, or add the"
  echo "operation to src/lib/db/admin/** where it is audited (docs/PLAN.md §4)."
  exit 1
fi

echo "OK — service-role key confined to the fenced modules."
