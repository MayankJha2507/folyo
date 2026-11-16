import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

import { serverEnv } from "@/lib/env.server";
import * as schema from "@/lib/db/schema";

/**
 * Multi-statement server work that still runs under RLS (docs/PLAN.md §4).
 *
 * Two things make this safe, and both must hold:
 *
 * 1. `DATABASE_URL` connects as `folyo_app` — a role that owns no tables and
 *    does **not** have BYPASSRLS. Policies therefore apply to it exactly as to
 *    any user. (`db/migrations/0000_roles.sql` creates it; a test asserts the
 *    connected role is not privileged.)
 * 2. Every transaction establishes the caller's identity with `SET LOCAL`
 *    before any statement, so `auth.uid()` resolves to the real user and
 *    cannot leak past the transaction or across pooled connections.
 *
 * There is deliberately no exported raw connection or `db` object: `withUser`
 * is the only way in, so a call site cannot forget to set identity.
 */

let client: postgres.Sql | undefined;

function connection() {
  if (!client) {
    // prepare:false is required behind Supabase's connection pooler.
    client = postgres(serverEnv().DATABASE_URL, { prepare: false, max: 5 });
  }
  return client;
}

type Tx = Parameters<
  Parameters<ReturnType<typeof drizzle<typeof schema>>["transaction"]>[0]
>[0];

/**
 * Run `fn` in a transaction acting as `userId`.
 *
 * `userId` must come from a server-verified session (`requireUser()`), never
 * from client input — it is the identity every policy will trust.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const db = drizzle(connection(), { schema });

  return db.transaction(async (tx) => {
    // Drop from the connection role to `authenticated`, then supply the claims
    // Supabase's auth.uid() reads. Both are LOCAL: they end with the
    // transaction, so a pooled connection cannot carry them to the next caller.
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify({
        sub: userId,
        role: "authenticated",
      })}, true)`,
    );

    return fn(tx);
  });
}

/**
 * Identity as the database sees it. Used by the test suite to assert that a
 * given access path really does execute as the expected, non-privileged role.
 */
export async function describeIdentity(userId: string) {
  return withUser(userId, async (tx) => {
    const rows = await tx.execute<{
      uid: string | null;
      current_role: string;
      session_role: string;
      is_superuser: boolean;
      bypassrls: boolean;
    }>(sql`
      select
        auth.uid()::text                        as uid,
        current_user                            as current_role,
        session_user                            as session_role,
        (select usesuper from pg_user where usename = session_user) as is_superuser,
        (select rolbypassrls from pg_roles where rolname = session_user) as bypassrls
    `);
    return rows[0];
  });
}
