import { z } from "zod";
export const propertySchema = z.object({
  title: z.string().min(3, "عنوان باید حداقل ۳ نویسه باشد"),
  transactionType: z.enum(["SALE", "RENT", "MORTGAGE_RENT", "PRESALE"]),
  propertyType: z.enum([
    "APARTMENT",
    "HOUSE",
    "VILLA",
    "LAND",
    "COMMERCIAL",
    "OFFICE",
    "STORE",
    "WAREHOUSE",
  ]),
  ownerId: z.string().min(1, "مالک را انتخاب کنید"),
  assignedAgentId: z.string().min(1),
  neighborhood: z.string().min(2, "محله الزامی است"),
  address: z.string().min(5, "نشانی کامل را وارد کنید"),
  area: z.coerce.number().positive("متراژ باید مثبت باشد"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  description: z.string().min(10, "توضیحات کامل‌تری وارد کنید"),
  priceTotal: z.string().optional(),
  depositAmount: z.string().optional(),
  monthlyRent: z.string().optional(),
});
export const requirementSchema = z
  .object({
    title: z.string().min(3, "عنوان الزامی است"),
    applicantId: z.string().min(1, "متقاضی را انتخاب کنید"),
    transactionType: z.enum(["SALE", "RENT", "MORTGAGE_RENT", "PRESALE"]),
    propertyTypes: z.array(z.string()).min(1, "حداقل یک نوع ملک"),
    minArea: z.number().nonnegative().optional(),
    maxArea: z.number().positive().optional(),
    minBudget: z.bigint().optional(),
    maxBudget: z.bigint().optional(),
  })
  .refine((v) => !v.minArea || !v.maxArea || v.maxArea >= v.minArea, {
    message: "حداکثر متراژ باید بیشتر باشد",
  });
