import { describe, expect, it } from "vitest";
import { calculateAllocation, calculateCommission } from "@/lib/commission";

describe("commission engine", () => {
  it("calculates both sides, discount and tax without floating point", () => {
    expect(
      calculateCommission({
        baseToman: 10_000_000_000n,
        discountToman: 5_000_000n,
        policy: {
          ownerRateBasisPoints: 25,
          applicantRateBasisPoints: 25,
          fixedOwnerAmountToman: 0n,
          fixedApplicantAmountToman: 0n,
          taxRateBasisPoints: 1_000,
          maximumPerSideToman: null,
        },
      }),
    ).toEqual({
      ownerAmountToman: 25_000_000n,
      applicantAmountToman: 25_000_000n,
      discountToman: 5_000_000n,
      distributableAmountToman: 45_000_000n,
      taxAmountToman: 4_500_000n,
      totalAmountToman: 49_500_000n,
    });
  });

  it("caps each payer independently", () => {
    const result = calculateCommission({
      baseToman: 100_000_000_000n,
      policy: {
        ownerRateBasisPoints: 100,
        applicantRateBasisPoints: 100,
        fixedOwnerAmountToman: 0n,
        fixedApplicantAmountToman: 0n,
        taxRateBasisPoints: 0,
        maximumPerSideToman: 100_000_000n,
      },
    });
    expect(result.totalAmountToman).toBe(200_000_000n);
  });

  it("calculates internal shares on distributable revenue", () => {
    expect(calculateAllocation(80_000_000n, 3_500)).toBe(28_000_000n);
  });
});
