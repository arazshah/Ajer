import { describe, expect, it } from "vitest";
import { propertySchema, requirementSchema } from "@/lib/validation";
import { can } from "@/lib/permissions";
describe("validation", () => {
  it("accepts property", () =>
    expect(
      propertySchema.safeParse({
        title: "آپارتمان خوب",
        transactionType: "SALE",
        propertyType: "APARTMENT",
        ownerId: "1",
        assignedAgentId: "2",
        neighborhood: "استادان",
        address: "خیابان استادان پلاک ۱",
        area: 90,
        latitude: 37.5,
        longitude: 45.1,
        description: "توضیحات کامل فایل ملکی",
      }).success,
    ).toBe(true));
  it("rejects reversed area", () =>
    expect(
      requirementSchema.safeParse({
        title: "خرید آپارتمان",
        applicantId: "1",
        transactionType: "SALE",
        propertyTypes: ["APARTMENT"],
        minArea: 120,
        maxArea: 80,
      }).success,
    ).toBe(false));
});
describe("permissions", () => {
  it("admin manages settings", () =>
    expect(can("ADMIN", "manage_settings")).toBe(true));
  it("agent cannot manage users", () =>
    expect(can("AGENT", "manage_users")).toBe(false));
});
