import "server-only";

import { z } from "zod";

/**
 * The single module that reads secrets.
 *
 * `server-only` makes importing this from a client component a build error, and
 * an ESLint rule plus a CI grep keep `SUPABASE_SERVICE_ROLE_KEY` confined to
 * here and `src/lib/db/admin/**` (docs/PLAN.md §4).
 *
 * Secrets are read lazily, so a missing key fails at the call site that needs
 * it with a clear message, rather than crashing an unrelated page at import.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

function read<T extends z.ZodType>(schema: T, source: string): z.infer<T> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Missing or invalid environment variables (${source}): ${missing}. ` +
        `Copy .env.example to .env.local and fill them in — see docs/SUPABASE_SETUP.md.`,
    );
  }
  return parsed.data;
}

/** Safe to reference from anywhere; these values reach the browser anyway. */
export function publicEnv() {
  return read(publicSchema, "public");
}

/**
 * Server-only secrets. The service-role key bypasses RLS entirely — callers
 * must be inside the audited admin path.
 */
export function serverEnv() {
  return read(serverSchema, "server");
}
