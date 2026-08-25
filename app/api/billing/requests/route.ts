import { createHash, randomUUID } from "node:crypto";
import type { ManualPaymentMethod } from "@prisma/client";
import { requireAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseJalaliDate } from "@/lib/jalali";
import {
  deletePrivateObject,
  detectedMime,
  extensionForMime,
  storePrivateObject,
} from "@/lib/uploads";
import { getPlatformSettings } from "@/lib/platform-settings";
import { consumeRateLimit } from "@/lib/security";

export const runtime = "nodejs";
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const methods = ["BANK_TRANSFER", "CARD_TO_CARD", "CASH", "REQUEST_CONTACT", "OTHER"];

function text(form: FormData, key: string, max = 500) {
  return String(form.get(key) || "").trim().slice(0, max);
}
function redirectTo(error?: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: error
        ? `/billing?requestError=${encodeURIComponent(error)}`
        : "/billing?request=created",
    },
  });
}

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser();
  if (user.role !== "ADMIN") return redirectTo("فقط مدیر دفتر می‌تواند درخواست تمدید ثبت کند.");
  const settings = await getPlatformSettings();
  if (!settings.billing.manualEnabled)
    return redirectTo("ثبت درخواست دستی در حال حاضر فعال نیست.");
  const rate = await consumeRateLimit({
    scope: "manual-billing-request",
    key: user.id,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed)
    return redirectTo("تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.");
  const form = await request.formData();
  const plan = await db.plan.findFirst({ where: { id: text(form, "planId", 80), isActive: true } });
  if (!plan) return redirectTo("پلن انتخاب‌شده فعال نیست.");
  const rawMethod = text(form, "method", 30);
  if (!methods.includes(rawMethod)) return redirectTo("روش پرداخت معتبر نیست.");
  const method = rawMethod as ManualPaymentMethod;
  const aiEnabled = form.get("aiEnabled") === "on";
  const aiAmountToman = aiEnabled ? plan.aiPriceToman : 0;
  const referenceCode = text(form, "referenceCode", 100) || null;
  const transferDateRaw = text(form, "transferDate", 20);
  const transferDate = transferDateRaw ? parseJalaliDate(transferDateRaw) : null;
  if (transferDateRaw && !transferDate) return redirectTo("تاریخ واریز شمسی معتبر نیست.");
  const receipt = form.get("receipt");
  const hasReceipt = receipt instanceof File && receipt.size > 0;
  if (["BANK_TRANSFER", "CARD_TO_CARD"].includes(method) && !referenceCode && !hasReceipt)
    return redirectTo("برای واریز بانکی یا کارت‌به‌کارت، کد پیگیری یا فیش را ثبت کنید.");

  let storageKey: string | null = null;
  let receiptData:
    | { originalName: string; mimeType: string; sizeBytes: number; sha256: string }
    | null = null;
  if (hasReceipt) {
    if (receipt.size > MAX_RECEIPT_BYTES) return redirectTo("حجم فیش بیشتر از ۵ مگابایت است.");
    const bytes = new Uint8Array(await receipt.arrayBuffer());
    const mimeType = detectedMime(bytes);
    const extension = mimeType ? extensionForMime(mimeType) : null;
    if (!mimeType || !extension || (!mimeType.startsWith("image/") && mimeType !== "application/pdf"))
      return redirectTo("فیش باید تصویر JPG، PNG، WebP یا PDF معتبر باشد.");
    storageKey = `${user.agencyId}/billing/${randomUUID()}.${extension}`;
    await storePrivateObject(storageKey, bytes, mimeType);
    receiptData = {
      originalName: receipt.name.slice(0, 240),
      mimeType,
      sizeBytes: receipt.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.agencyId}))`;
      await tx.billingRequest.updateMany({
        where: { agencyId: user.agencyId, status: { in: ["PENDING", "NEEDS_INFO"] } },
        data: { status: "CANCELED", reviewNote: "با درخواست جدید جایگزین شد." },
      });
      const asset = receiptData && storageKey
        ? await tx.fileAsset.create({
            data: {
              agencyId: user.agencyId,
              uploadedById: user.id,
              storageKey,
              ...receiptData,
            },
          })
        : null;
      const created = await tx.billingRequest.create({
        data: {
          agencyId: user.agencyId,
          requestedById: user.id,
          planId: plan.id,
          receiptAssetId: asset?.id,
          method,
          months: plan.months,
          aiEnabled,
          baseAmountToman: plan.basePriceToman,
          aiAmountToman,
          requestedAmountToman: plan.basePriceToman + aiAmountToman,
          payerName: text(form, "payerName", 120) || null,
          referenceCode,
          transferDate,
          notes: text(form, "notes", 1500) || null,
        },
      });
      await tx.auditLog.create({
        data: {
          agencyId: user.agencyId,
          userId: user.id,
          entityType: "BillingRequest",
          entityId: created.id,
          action: "CREATE_MANUAL_BILLING_REQUEST",
        },
      });
    });
  } catch {
    if (storageKey) await deletePrivateObject(storageKey);
    return redirectTo("ثبت درخواست انجام نشد؛ دوباره تلاش کنید.");
  }
  return redirectTo();
}
