/**
 * Connection and privilege check for the configured database.
 *
 * The important assertion is the last one: the role we connect as must not be
 * able to bypass RLS. If it can, every policy in the product is decorative.
 *
 * Run with: npm run db:check
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in —\n" +
      "see docs/SUPABASE_SETUP.md.",
  );
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

type Row = {
  current_role: string;
  session_role: string;
  is_superuser: boolean;
  bypassrls: boolean;
  has_app_schema: boolean;
};

try {
  const [row] = await sql<Row[]>`
    select
      current_user                                               as current_role,
      session_user                                               as session_role,
      coalesce((select rolsuper     from pg_roles where rolname = session_user), false) as is_superuser,
      coalesce((select rolbypassrls from pg_roles where rolname = session_user), false) as bypassrls,
      exists (select 1 from information_schema.schemata where schema_name = 'app') as has_app_schema
  `;

  console.log(`connected as:   ${row.current_role} (session: ${row.session_role})`);
  console.log(`app schema:     ${row.has_app_schema ? "present" : "MISSING"}`);
  console.log(`superuser:      ${row.is_superuser}`);
  console.log(`bypassrls:      ${row.bypassrls}`);

  const problems: string[] = [];
  if (!row.has_app_schema)
    problems.push("schema `app` is missing — run db/migrations/0000_roles.sql");
  if (row.is_superuser)
    problems.push("connected role is a SUPERUSER — it ignores every RLS policy");
  if (row.bypassrls)
    problems.push("connected role has BYPASSRLS — it ignores every RLS policy");

  if (problems.length > 0) {
    console.error("\nFAILED:");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("\nSee docs/SUPABASE_SETUP.md step 4.");
    process.exit(1);
  }

  console.log("\nOK — connection works and the role cannot bypass RLS.");
} finally {
  await sql.end();
}
