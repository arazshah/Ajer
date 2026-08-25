import { describe, expect, it } from "vitest";
import {
  buildInitialContractBody,
  canTransitionContractVersion,
  primaryPartyRoles,
} from "@/lib/contracts";

describe("legal contracts", () => {
  it("selects primary legal roles from the deal type", () => {
    expect(primaryPartyRoles("SALE")).toEqual(["SELLER", "BUYER"]);
    expect(primaryPartyRoles("RENT")).toEqual(["LANDLORD", "TENANT"]);
  });

  it("enforces version workflow", () => {
    expect(canTransitionContractVersion("DRAFT", "REVIEW")).toBe(true);
    expect(canTransitionContractVersion("DRAFT", "SIGNED")).toBe(false);
    expect(canTransitionContractVersion("REVIEW", "FINAL")).toBe(true);
    expect(canTransitionContractVersion("FINAL", "SIGNED")).toBe(true);
    expect(canTransitionContractVersion("SIGNED", "DRAFT")).toBe(false);
  });

  it("builds a deterministic initial draft", () => {
    const body = buildInitialContractBody({
      ownerName: "مالک تست",
      applicantName: "متقاضی تست",
      propertyTitle: "ملک تست",
      propertyAddress: "نشانی تست",
      agreedPrice: 1_000n,
    });
    expect(body).toContain("مالک تست");
    expect(body).toContain("متقاضی تست");
    expect(body).toContain("۱٬۰۰۰ تومان");
  });
});
