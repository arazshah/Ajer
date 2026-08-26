"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizeMobile } from "@/lib/format";

export type DemoRequestState = {
  error?: string;
  success?: string;
} | null;

const demoRequestSchema = z.object({
  managerName: z.string().trim().min(3, "نام مدیر را کامل وارد کنید.").max(80),
  mobile: z.string().transform((value) => normalizeMobile(value)),
  agencyName: z.string().trim().min(2, "نام دفتر املاک را وارد کنید.").max(120),
  cityArea: z.string().trim().min(2, "شهر و منطقه را وارد کنید.").max(120),
  consultantCount: z.coerce
    .number()
    .int()
    .min(1, "تعداد مشاوران باید حداقل یک نفر باشد.")
    .max(500, "تعداد مشاوران واردشده معتبر نیست."),
});

export async function createDemoRequest(
  _: DemoRequestState,
  formData: FormData,
): Promise<DemoRequestState> {
  // Honeypot: a normal user never sees or fills this field.
  if (String(formData.get("website") || ""))
    return { success: "درخواست شما ثبت شد؛ به‌زودی با شما تماس می‌گیریم." };

  const parsed = demoRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message || "اطلاعات فرم معتبر نیست.",
    };
  if (!/^09\d{9}$/.test(parsed.data.mobile))
    return { error: "شماره همراه باید با ۰۹ شروع شود و ۱۱ رقم باشد." };

  const recent = await db.demoRequest.findFirst({
    where: {
      mobile: parsed.data.mobile,
      createdAt: { gt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (!recent) await db.demoRequest.create({ data: parsed.data });

  revalidatePath("/super-admin");
  return {
    success:
      "درخواست دمو ثبت شد. برای هماهنگی یک جلسه کوتاه با شما تماس می‌گیریم.",
  };
}
