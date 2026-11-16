import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("lets the later Tailwind utility win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("keeps utilities from different groups", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });
});
