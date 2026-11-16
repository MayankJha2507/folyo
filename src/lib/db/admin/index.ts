import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env.server";

/**
 * The service-role path. **This client bypasses RLS entirely.**
 *
 * Nothing outside this directory may import it — enforced by an ESLint
 * `no-restricted-imports` rule and a CI grep (docs/PLAN.md §4). Every exported
 * operation must:
 *
 *   1. take an `AdminContext`, which only `assertPlatformAdmin` can produce, and
 *   2. write an `audit_log` row recording who did what.
 *
 * If an operation does not need to bypass RLS, it does not belong here.
 */

const AUTHORISED = Symbol("platform-admin-verified");

export interface AdminContext {
  readonly actorId: string;
  readonly [AUTHORISED]: true;
}

let client: SupabaseClient | undefined;

function serviceClient() {
  if (!client) {
    client = createClient(
      publicEnv().NEXT_PUBLIC_SUPABASE_URL,
      serverEnv().SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}

/**
 * Verify that `userId` is a platform administrator and mint the capability
 * every admin operation requires.
 *
 * Membership is read from the `platform_admins` table — never from a JWT
 * claim, which a user could influence.
 */
export async function assertPlatformAdmin(userId: string): Promise<AdminContext> {
  const { data, error } = await serviceClient()
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Platform admin check failed: ${error.message}`);
  if (!data) throw new Error("Not a platform administrator");

  return { actorId: userId, [AUTHORISED]: true };
}

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown>;
}

/**
 * Record an administrative action. Called by every operation in this module;
 * an unaudited service-role write is a defect.
 */
export async function recordAudit(ctx: AdminContext, entry: AuditEntry) {
  const { error } = await serviceClient().from("audit_log").insert({
    actor_id: ctx.actorId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    meta: entry.meta ?? {},
  });
  if (error) throw new Error(`Audit write failed: ${error.message}`);
}

/**
 * Escape hatch for operations defined in sibling modules within this fenced
 * directory. Not exported beyond `src/lib/db/admin/**`.
 */
export function privilegedClient(_ctx: AdminContext) {
  return serviceClient();
}
