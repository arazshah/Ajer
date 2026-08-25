import type { BillingRequestStatus, ManualPaymentMethod } from "@prisma/client";

export const manualPaymentLabels: Record<ManualPaymentMethod, string> = {
  BANK_TRANSFER: "واریز بانکی",
  CARD_TO_CARD: "کارت‌به‌کارت",
  CASH: "پرداخت نقدی",
  REQUEST_CONTACT: "درخواست تماس",
  OTHER: "سایر روش‌ها",
};

export const billingRequestStatusLabels: Record<BillingRequestStatus, string> = {
  PENDING: "در انتظار بررسی",
  NEEDS_INFO: "نیازمند اطلاعات بیشتر",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
  CANCELED: "لغوشده",
};

export function billingRequestBadge(status: BillingRequestStatus) {
  if (status === "APPROVED") return "badge-active";
  if (status === "PENDING" || status === "NEEDS_INFO") return "badge-warn";
  return "badge-danger";
}
