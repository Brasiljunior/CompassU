# Explicit Data API grants and recovery

Verified and applied October 21, 2026.

The chronological files in `supabase/migrations` were recovered from production's
42 recorded migrations. Table creation files include explicit server CRUD and
sequence grants so they can run with automatic grants disabled. Existing versions
are not rerun on production. The new `20261021142642` migration reconciles receipt
setup, records explicit grants for the current 38 tables and seven sequences,
removes browser TRUNCATE/REFERENCES/TRIGGER/MAINTAIN privileges, and opts
postgres-created tables and sequences into explicit access now.

The receipt setup is idempotent and preserves existing receipt metadata and files.
Normal browser CRUD, RLS policies, and administrator function grants are preserved.
Future table migrations must grant only the intended roles and operations in the
same file, enable RLS, and add policies matching the access model. Include sequence
privileges when server inserts generate numeric identifiers. Do not restore broad
default grants to work around a permission error.

## Verification

A disposable Supabase branch was rebuilt from an empty public schema with automatic
table and sequence grants disabled, using all 43 migration files in order.
`tests/api-grants.sql` then passed with rollback-only synthetic fixtures:

- Student profile creation, 80 responses, scoring/finalization, and favorites.
- Cross-user assessment isolation and denial of student finance/analytics access.
- Master administrator role and context access.
- Service-role invitation reminder creation, claim, and update.
- Company bill, receipt registration, payment, and bill editing.
- All 38 tables have RLS and server CRUD; no browser TRUNCATE privileges.

Production checks after applying the new migration confirmed the same 38-table
permission assertions and unchanged counts for profiles, attempts, responses,
invoices, expenses, payments, and receipt metadata. No production data was reset.
This verification covers database behavior, not a complete browser/email/storage
upload end-to-end test. The receipt test registers metadata without uploading a file.

## Remaining advisor notices

Six server-only tables have RLS without browser policies. Their browser table grants
are revoked; no permissive policy was added simply to silence the advisor.

Twenty-six signed-in-callable SECURITY DEFINER functions remain intentionally
callable. Their current definitions were reviewed for caller identity, membership,
administrator, invitation-token, or scope checks. Changing them all to INVOKER or
revoking execution would break the access helpers or administrator flows. The
rollback test exercises student denial and administrator context; it is not an
exhaustive authorization audit of every function and every scoped role.

## Recovery limits

These migrations recreate database structure and their embedded seed SQL. They are
not a backup of application records, Auth accounts, reference catalogs, questions,
or Storage objects. A complete operational recovery still requires approved data
backups/imports, Storage restoration, secrets, and Edge Function deployment. Do not
reset production to test this process. Never merge a disposable test branch's reset
migration into production.

The applied migration uses a five-second lock timeout. If lock acquisition fails,
retry the migration during a quieter period rather than allowing prolonged blocking.
