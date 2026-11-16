import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws when imported outside a server context, which Vitest's
// node environment is not. Stub it so the module under test can load.
vi.mock("server-only", () => ({}));

const ORIGINAL = { ...process.env };

async function freshEnvModule() {
  vi.resetModules();
  return import("@/lib/env.server");
}

beforeEach(() => {
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_APP_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
  ]) {
    delete process.env[key];
  }
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("publicEnv", () => {
  it("names the missing variables rather than failing vaguely", async () => {
    const { publicEnv } = await freshEnvModule();
    expect(() => publicEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects a URL that is not a URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const { publicEnv } = await freshEnvModule();
    expect(() => publicEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("defaults the app URL for local development", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const { publicEnv } = await freshEnvModule();
    expect(publicEnv().NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("does not require server secrets to be present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const { publicEnv } = await freshEnvModule();
    expect(() => publicEnv()).not.toThrow();
  });
});

describe("serverEnv", () => {
  it("fails when the service-role key is absent", async () => {
    process.env.DATABASE_URL = "postgres://localhost/folyo";
    const { serverEnv } = await freshEnvModule();
    expect(() => serverEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("returns both secrets once set", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.DATABASE_URL = "postgres://localhost/folyo";
    const { serverEnv } = await freshEnvModule();
    expect(serverEnv()).toEqual({
      SUPABASE_SERVICE_ROLE_KEY: "service",
      DATABASE_URL: "postgres://localhost/folyo",
    });
  });
});
