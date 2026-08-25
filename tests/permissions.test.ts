import { describe, expect, it } from "vitest";
import { allPermissions, defaultPermissions } from "@/lib/permissions";

describe("role permission defaults", () => {
  it("gives admins every permission", () => {
    expect([...defaultPermissions("ADMIN")].sort()).toEqual(
      [...allPermissions].sort(),
    );
  });

  it("keeps office settings and personnel away from managers by default", () => {
    const permissions = defaultPermissions("MANAGER");
    expect(permissions.has("deals.finance")).toBe(true);
    expect(permissions.has("users.manage")).toBe(false);
    expect(permissions.has("settings.manage")).toBe(false);
  });

  it("limits agents to daily operations on their own work", () => {
    const permissions = defaultPermissions("AGENT");
    expect(permissions.has("deals.create")).toBe(true);
    expect(permissions.has("deals.manage_all")).toBe(false);
    expect(permissions.has("commissions.view")).toBe(false);
  });
});
