import type { ContractVersionStatus, DealType } from "@prisma/client";

export const DEFAULT_CONTRACT_CHECKLIST = [
  { title: "اصل مدارک هویتی مالک / فروشنده", category: "هویت" },
  { title: "اصل مدارک هویتی متقاضی / خریدار", category: "هویت" },
  { title: "سند یا مدرک مالکیت معتبر", category: "مالکیت" },
  { title: "استعلام و تطبیق مشخصات ملک", category: "ملک" },
  { title: "تأیید محاسبه کمیسیون", category: "مالی" },
  { title: "نسخه نهایی قرارداد آماده امضا", category: "قرارداد" },
] as const;

export function primaryPartyRoles(type: DealType) {
  return type === "SALE" || type === "PRESALE"
    ? (["SELLER", "BUYER"] as const)
    : (["LANDLORD", "TENANT"] as const);
}

export function canTransitionContractVersion(
  current: ContractVersionStatus,
  next: ContractVersionStatus,
) {
  const transitions: Record<
    ContractVersionStatus,
    readonly ContractVersionStatus[]
  > = {
    DRAFT: ["REVIEW", "ARCHIVED"],
    REVIEW: ["DRAFT", "FINAL", "ARCHIVED"],
    FINAL: ["SIGNED", "ARCHIVED"],
    SIGNED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  return transitions[current].includes(next);
}

export function buildInitialContractBody(input: {
  contractNumber?: string | null;
  ownerName: string;
  applicantName: string;
  propertyTitle: string;
  propertyAddress: string;
  agreedPrice?: bigint | null;
  depositAmount?: bigint | null;
  monthlyRent?: bigint | null;
  terms?: string | null;
}) {
  const money = (value?: bigint | null) =>
    value == null
      ? "طبق توافق نهایی طرفین"
      : `${value.toLocaleString("fa-IR")} تومان`;
  return [
    `پیش‌نویس قرارداد ${input.contractNumber || "بدون شماره"}`,
    "ماده ۱ ـ طرفین قرارداد",
    `طرف اول: ${input.ownerName}\nطرف دوم: ${input.applicantName}`,
    "ماده ۲ ـ موضوع قرارداد",
    `${input.propertyTitle} به نشانی ${input.propertyAddress}`,
    "ماده ۳ ـ شرایط مالی",
    `مبلغ توافقی: ${money(input.agreedPrice)}\nودیعه: ${money(input.depositAmount)}\nاجاره ماهانه: ${money(input.monthlyRent)}`,
    "ماده ۴ ـ تعهدات و شروط تکمیلی",
    input.terms ||
      "تعهدات، زمان تحویل و شروط تکمیلی پس از بررسی طرفین درج شود.",
    "ماده ۵ ـ نسخ و امضا",
    "این متن پیش‌نویس سامانه است و نسخه نهایی پس از بررسی مدارک، تأیید طرفین و امضا معتبر خواهد بود.",
  ].join("\n\n");
}
