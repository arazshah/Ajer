import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "./db";
import { requireUser } from "./auth";

export const permissionCatalog = [
  ["dashboard.view", "داشبورد", "مشاهده داشبورد دفتر"],
  ["properties.view", "فایل‌ها", "مشاهده فایل‌های ملکی"],
  ["properties.create", "فایل‌ها", "ثبت و تکثیر فایل ملکی"],
  ["properties.manage_all", "فایل‌ها", "ویرایش و بایگانی فایل همه مشاوران"],
  ["contacts.view", "مخاطبان", "مشاهده مالکان و متقاضیان"],
  ["contacts.manage", "مخاطبان", "ثبت و ویرایش مالکان و متقاضیان"],
  ["requirements.manage", "تقاضا", "ثبت و مدیریت نیازهای متقاضیان"],
  ["activities.manage", "پیگیری", "ثبت و مدیریت پیگیری‌های خود"],
  ["activities.manage_all", "پیگیری", "مدیریت پیگیری‌های تمام پرسنل"],
  ["visits.manage", "بازدید", "ثبت و مدیریت بازدیدهای خود"],
  ["visits.manage_all", "بازدید", "مدیریت بازدیدهای تمام پرسنل"],
  ["deals.view", "معامله", "مشاهده معاملات خود"],
  ["deals.create", "معامله", "ایجاد معامله"],
  ["deals.manage", "معامله", "تغییر وضعیت معاملات خود"],
  ["deals.manage_all", "معامله", "مدیریت معاملات تمام پرسنل"],
  ["deals.finance", "مالی معامله", "قرارداد، کمیسیون، وصول و تسویه"],
  ["commissions.view", "کمیسیون", "مشاهده تعرفه‌ها و سهم‌ها"],
  ["commissions.manage", "کمیسیون", "مدیریت تعرفه و تأیید تسویه"],
  ["accounting.view", "حسابداری", "مشاهده صندوق، بانک و گزارش‌های مالی"],
  ["accounting.manage", "حسابداری", "ثبت گردش، چک، حقوق و تسویه حساب‌ها"],
  ["documents.verify", "مدارک", "تأیید یا رد مدارک مخاطب و ملک"],
  ["reports.view", "گزارش", "مشاهده گزارش‌های مدیریتی دفتر"],
  ["users.manage", "پرسنل", "ایجاد کاربر و مدیریت دسترسی‌ها"],
  ["settings.manage", "تنظیمات", "تغییر تنظیمات دفتر"],
  ["data.export", "خروجی", "دریافت خروجی اطلاعات دفتر"],
  ["ai.use", "هوش مصنوعی", "استفاده از جست‌وجوی هوشمند"],
] as const;

export type Permission = (typeof permissionCatalog)[number][0];
export const allPermissions = permissionCatalog.map(([key]) => key);

const roleDefaults: Record<Role, readonly Permission[]> = {
  ADMIN: allPermissions,
  MANAGER: allPermissions.filter(
    (key) => key !== "users.manage" && key !== "settings.manage",
  ),
  AGENT: [
    "dashboard.view",
    "properties.view",
    "properties.create",
    "contacts.view",
    "contacts.manage",
    "requirements.manage",
    "activities.manage",
    "visits.manage",
    "deals.view",
    "deals.create",
    "deals.manage",
    "ai.use",
  ],
};

export function defaultPermissions(role: Role) {
  return new Set(roleDefaults[role]);
}

export type Action =
  | "view_operations"
  | "manage_users"
  | "manage_settings"
  | "delete_user";

/** Compatibility helper for the original coarse role checks. */
export function can(role: Role, action: Action) {
  const mapping: Record<Action, Permission> = {
    view_operations: "dashboard.view",
    manage_users: "users.manage",
    manage_settings: "settings.manage",
    delete_user: "users.manage",
  };
  return defaultPermissions(role).has(mapping[action]);
}

export async function getUserPermissions(user: { id: string; role: Role }) {
  const permissions = defaultPermissions(user.role);
  const overrides = await db.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true, allowed: true },
  });
  for (const override of overrides) {
    if (!allPermissions.includes(override.permission as Permission)) continue;
    if (override.allowed) permissions.add(override.permission as Permission);
    else permissions.delete(override.permission as Permission);
  }
  // The office owner must never lock themselves out of administration.
  if (user.role === "ADMIN") return new Set(allPermissions);
  return permissions;
}

export async function hasPermission(
  user: { id: string; role: Role },
  permission: Permission,
) {
  return (await getUserPermissions(user)).has(permission);
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!(await hasPermission(user, permission)))
    redirect("/dashboard?error=forbidden");
  return user;
}
