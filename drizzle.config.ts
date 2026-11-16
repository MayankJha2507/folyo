import type { Config } from "drizzle-kit";

/**
 * Drizzle is used for migrations tooling and typed queries only.
 *
 * Migrations are hand-written SQL in `db/migrations/` (see the note in
 * src/lib/db/schema.ts): `drizzle-kit generate` is deliberately NOT part of the
 * workflow, because policies and SECURITY DEFINER functions must be reviewed as
 * SQL. This config exists so `drizzle-kit` can introspect and check drift.
 */
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
} satisfies Config;
