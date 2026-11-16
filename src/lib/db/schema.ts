import {
  bigserial,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema — the typed mirror of `db/migrations/*.sql`.
 *
 * Migrations are hand-written SQL, not generated. Policies, SECURITY DEFINER
 * functions and role grants are the security surface of this product and must
 * be read as SQL by a human; a generated diff would hide them. Drizzle's job
 * here is types and query building, so this file tracks the migrations rather
 * than the other way round.
 */

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  locale: text("locale").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformAdmins = pgTable("platform_admins", {
  userId: uuid("user_id").primaryKey(),
  grantedBy: uuid("granted_by"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  meta: jsonb("meta").notNull().default({}),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type PlatformAdmin = typeof platformAdmins.$inferSelect;

/** Migrations represented by this file, in order. */
export const APPLIED_MIGRATIONS = ["0000_roles", "0001_profiles"] as const;
