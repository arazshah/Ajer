export type CommissionPolicyInput = {
  ownerRateBasisPoints: number;
  applicantRateBasisPoints: number;
  fixedOwnerAmountToman: bigint;
  fixedApplicantAmountToman: bigint;
  taxRateBasisPoints: number;
  maximumPerSideToman: bigint | null;
};

function assertBasisPoints(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000)
    throw new Error(`${name} basis points are invalid.`);
}

function rateAmount(base: bigint, basisPoints: number) {
  return (base * BigInt(basisPoints)) / 10_000n;
}

function cap(value: bigint, maximum: bigint | null) {
  return maximum !== null && value > maximum ? maximum : value;
}

export function calculateCommission(input: {
  baseToman: bigint;
  policy: CommissionPolicyInput;
  discountToman?: bigint;
}) {
  if (input.baseToman < 0n)
    throw new Error("Commission base cannot be negative.");
  assertBasisPoints(input.policy.ownerRateBasisPoints, "Owner rate");
  assertBasisPoints(input.policy.applicantRateBasisPoints, "Applicant rate");
  assertBasisPoints(input.policy.taxRateBasisPoints, "Tax rate");

  const ownerAmountToman = cap(
    rateAmount(input.baseToman, input.policy.ownerRateBasisPoints) +
      input.policy.fixedOwnerAmountToman,
    input.policy.maximumPerSideToman,
  );
  const applicantAmountToman = cap(
    rateAmount(input.baseToman, input.policy.applicantRateBasisPoints) +
      input.policy.fixedApplicantAmountToman,
    input.policy.maximumPerSideToman,
  );
  const gross = ownerAmountToman + applicantAmountToman;
  const discountToman = input.discountToman ?? 0n;
  if (discountToman < 0n || discountToman > gross)
    throw new Error("Commission discount is outside the allowed range.");
  const distributableAmountToman = gross - discountToman;
  const taxAmountToman = rateAmount(
    distributableAmountToman,
    input.policy.taxRateBasisPoints,
  );
  return {
    ownerAmountToman,
    applicantAmountToman,
    discountToman,
    distributableAmountToman,
    taxAmountToman,
    totalAmountToman: distributableAmountToman + taxAmountToman,
  };
}

export function calculateAllocation(
  distributableAmountToman: bigint,
  basisPoints: number,
) {
  if (basisPoints < 0 || basisPoints > 10_000)
    throw new Error("Allocation share must be between 0 and 100 percent.");
  return rateAmount(distributableAmountToman, basisPoints);
}
