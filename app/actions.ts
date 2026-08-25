"use server";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  getSessionUser,
  revokeUserSessions,
} from "@/lib/auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normalizeMobile, parseMoney, toEnglishDigits } from "@/lib/format";
import { propertySchema } from "@/lib/validation";
import type { PersonnelType } from "@prisma/client";
import { normalizeNationalCode, propertyFingerprint } from "@/lib/crm";
import type { Source } from "@prisma/client";
import {
  allPermissions,
  defaultPermissions,
  hasPermission,
  requirePermission,
} from "@/lib/permissions";
import { parseJalaliDate, parseJalaliDateTime } from "@/lib/jalali";
import {
  checkLoginThrottle,
  clearIdentityThrottle,
  getClientContext,
  recordSecurityEvent,
  registerLoginFailure,
} from "@/lib/security";

const DUMMY_PASSWORD_HASH =
  "$2b$12$oM7wox6xJ2TFiU.3fj9NRexgGEUn4JVIzEcjImF6qRKdQhXFtKL6i";

export async function loginAction(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password = String(formData.get("password") ?? "");
  const context = await getClientContext();
  const throttle = await checkLoginThrottle("agency", email, context.ipAddress);
  if (throttle.blocked) {
    await recordSecurityEvent({
      eventType: "LOGIN_BLOCKED",
      success: false,
      context,
      metadata: { scope: "agency" },
    });
    return { error: "تلاش‌های ورود بیش از حد مجاز است؛ ۱۵ دقیقه دیگر دوباره تلاش کنید." };
  }
  const user = await db.user.findUnique({ where: { email } });
  const passwordValid = await bcrypt.compare(
    password,
    user?.passwordHash || DUMMY_PASSWORD_HASH,
  );
  const accountLocked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
  if (!user || !user.isActive || accountLocked || !passwordValid) {
    await registerLoginFailure("agency", email, context.ipAddress);
    if (user) {
      const nextFailures = user.failedLoginCount + 1;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: nextFailures,
          ...(nextFailures >= 5
            ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
            : {}),
        },
      });
    }
    await recordSecurityEvent({
      eventType: accountLocked ? "LOGIN_BLOCKED" : "LOGIN_FAILURE",
      success: false,
      context,
      agencyId: user?.agencyId,
      userId: user?.id,
      metadata: { scope: "agency" },
    });
    return { error: "ایمیل یا رمز عبور نادرست است." };
  }
  await Promise.all([
    clearIdentityThrottle("agency", email),
    db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    }),
    recordSecurityEvent({
      eventType: "LOGIN_SUCCESS",
      success: true,
      context,
      agencyId: user.agencyId,
      userId: user.id,
    }),
  ]);
  await createSession(user.id);
  redirect("/dashboard");
}
export async function logoutAction() {
  const [user, context] = await Promise.all([
    getSessionUser(),
    getClientContext(),
  ]);
  await destroySession();
  if (user)
    await recordSecurityEvent({
      eventType: "LOGOUT",
      success: true,
      context,
      agencyId: user.agencyId,
      userId: user.id,
    });
  redirect("/login");
}
export async function toggleActivity(id: string) {
  const user = await requirePermission("activities.manage");
  const canManageAll = await hasPermission(user, "activities.manage_all");
  const a = await db.activity.findFirst({
    where: {
      id,
      agencyId: user.agencyId,
      ...(!canManageAll ? { userId: user.id } : {}),
    },
  });
  if (!a) return;
  await db.activity.update({
    where: { id },
    data: { completed: !a.completed },
  });
  revalidatePath("/activities");
  revalidatePath("/dashboard");
}
export async function updateDealStatus(
  id: string,
  status: "NEGOTIATION" | "AGREED" | "CONTRACTED" | "COMPLETED" | "CANCELLED",
) {
  const user = await requirePermission("deals.manage");
  const canManageAll = await hasPermission(user, "deals.manage_all");
  const deal = await db.deal.findFirst({
    where: {
      id,
      agencyId: user.agencyId,
      ...(!canManageAll ? { assignedAgentId: user.id } : {}),
    },
    include: { contract: true, commission: true },
  });
  if (!deal) return;
  const allowed = {
    NEGOTIATION: ["AGREED", "CANCELLED"],
    AGREED: ["NEGOTIATION", "CONTRACTED", "CANCELLED"],
    CONTRACTED: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  } as const;
  if (!(allowed[deal.status] as readonly string[]).includes(status)) return;
  if (
    status === "CONTRACTED" &&
    (!deal.contract?.contractNumber || !deal.contract.contractDate)
  )
    redirect(`/deals/${id}?error=contract-required`);
  if (status === "CONTRACTED" && !deal.contract?.signedAt)
    redirect(`/deals/${id}?error=legal-contract-required`);
  if (status === "CONTRACTED" && deal.commission?.status !== "APPROVED")
    redirect(`/deals/${id}?error=commission-approval-required`);
  if (status === "COMPLETED" && deal.commission?.status !== "RECEIVED")
    redirect(`/deals/${id}?error=commission-receipt-required`);
  await db.$transaction(async (tx) => {
    await tx.deal.update({ where: { id }, data: { status } });
    await tx.dealStatusHistory.create({
      data: {
        dealId: id,
        changedById: user.id,
        fromStatus: deal.status,
        toStatus: status,
      },
    });
    if (["CONTRACTED", "COMPLETED", "CANCELLED"].includes(status))
      await tx.property.update({
        where: { id: deal.propertyId },
        data: {
          status:
            status === "CONTRACTED"
              ? "RESERVED"
              : status === "COMPLETED"
                ? deal.type === "SALE" || deal.type === "PRESALE"
                  ? "SOLD"
                  : "RENTED"
                : "ACTIVE",
        },
      });
    if (status === "CANCELLED" && deal.commission) {
      await tx.dealCommission.update({
        where: { id: deal.commission.id },
        data: { status: "VOID" },
      });
      await tx.commissionAllocation.updateMany({
        where: { commissionId: deal.commission.id, status: { not: "PAID" } },
        data: { status: "REVERSED" },
      });
    }
  });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
}
export async function archiveProperty(id: string) {
  const user = await requirePermission("properties.view");
  const canManageAll = await hasPermission(user, "properties.manage_all");
  await db.property.updateMany({
    where: {
      id,
      agencyId: user.agencyId,
      ...(!canManageAll ? { assignedAgentId: user.id } : {}),
    },
    data: { status: "ARCHIVED" },
  });
  await db.auditLog.create({
    data: {
      agencyId: user.agencyId,
      userId: user.id,
      entityType: "Property",
      entityId: id,
      action: "ARCHIVE",
    },
  });
  revalidatePath("/properties");
}
export async function duplicateProperty(id: string) {
  const user = await requirePermission("properties.create");
  const canManageAll = await hasPermission(user, "properties.manage_all");
  const p = await db.property.findFirst({
    where: {
      id,
      agencyId: user.agencyId,
      ...(!canManageAll ? { assignedAgentId: user.id } : {}),
    },
    include: { images: true },
  });
  if (!p) return;
  const count = await db.property.count({ where: { agencyId: user.agencyId } });
  const { id: _, createdAt, updatedAt, images, code, ...data } = p;
  void _;
  void createdAt;
  void updatedAt;
  void code;
  const copy = await db.property.create({
    data: {
      ...data,
      assignedAgentId: user.id,
      code: `AJ-1405-${String(count + 1).padStart(3, "0")}`,
      title: `کپی ${p.title}`,
      status: "DRAFT",
      images: {
        create: images.map(({ id: __, propertyId, createdAt: ___, ...im }) => {
          void __;
          void propertyId;
          void ___;
          return im;
        }),
      },
    },
  });
  redirect(`/properties/${copy.id}/edit`);
}
export async function saveProperty(_: unknown, fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const user = await requirePermission(
    id ? "properties.view" : "properties.create",
  );
  const canManageAll = await hasPermission(user, "properties.manage_all");
  const parsed = propertySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [owner, assignedAgent] = await Promise.all([
    db.contact.findFirst({ where: { id: d.ownerId, agencyId: user.agencyId } }),
    db.user.findFirst({
      where: { id: d.assignedAgentId, agencyId: user.agencyId, isActive: true },
    }),
  ]);
  if (!owner || !assignedAgent)
    return { error: "مالک یا مسئول فایل متعلق به این دفتر نیست." };
  if (!canManageAll && d.assignedAgentId !== user.id)
    return { error: "فایل فقط می‌تواند به حساب خود شما واگذار شود." };
  const fingerprint = propertyFingerprint({
    ownerId: d.ownerId,
    propertyType: d.propertyType,
    address: d.address,
    area: d.area,
  });
  const duplicateProperty = await db.property.findFirst({
    where: {
      agencyId: user.agencyId,
      fingerprint,
      ...(id ? { id: { not: id } } : {}),
    },
    select: { code: true, title: true },
  });
  if (duplicateProperty)
    return {
      error: `این ملک احتمالاً تکراری است: ${duplicateProperty.code} · ${duplicateProperty.title}`,
    };
  const base = {
    ...d,
    priceTotal: parseMoney(d.priceTotal ?? ""),
    depositAmount: parseMoney(d.depositAmount ?? ""),
    monthlyRent: parseMoney(d.monthlyRent ?? ""),
    agencyId: user.agencyId,
    city: user.agency.city,
    status:
      String(fd.get("intent")) === "active"
        ? ("ACTIVE" as const)
        : ("DRAFT" as const),
    parking: fd.get("parking") === "on",
    elevator: fd.get("elevator") === "on",
    storage: fd.get("storage") === "on",
    balcony: fd.get("balcony") === "on",
    bedrooms: Number(fd.get("bedrooms") || 0) || null,
    description: d.description,
    fingerprint,
  };
  if (id) {
    await db.property.updateMany({
      where: {
        id,
        agencyId: user.agencyId,
        ...(!canManageAll ? { assignedAgentId: user.id } : {}),
      },
      data: base,
    });
    revalidatePath(`/properties/${id}`);
    redirect(`/properties/${id}`);
  }
  const count = await db.property.count({ where: { agencyId: user.agencyId } });
  const p = await db.property.create({
    data: {
      ...base,
      code: `AJ-1405-${String(count + 1).padStart(3, "0")}`,
      district: "مرکزی",
      exclusivity: "NORMAL",
      source: "OWNER",
      images: {
        create: { url: "/property-1.png", alt: d.title, isCover: true },
      },
    },
  });
  redirect(`/properties/${p.id}`);
}
export async function saveContact(fd: FormData) {
  const user = await requirePermission("contacts.manage");
  const mobile = normalizeMobile(String(fd.get("mobile")));
  const nationalCode =
    normalizeNationalCode(String(fd.get("nationalCode") || "")) || null;
  if (!/^09\d{9}$/.test(mobile)) return;
  if (nationalCode && nationalCode.length !== 10) return;
  const source = String(fd.get("source") || "OTHER");
  if (
    ![
      "OWNER",
      "REFERRAL",
      "FIELD_RESEARCH",
      "WEBSITE",
      "SOCIAL_MEDIA",
      "OTHER",
    ].includes(source)
  )
    return;
  const existing = await db.contact.findFirst({
    where: {
      agencyId: user.agencyId,
      OR: [{ mobile }, ...(nationalCode ? [{ nationalCode }] : [])],
    },
  });
  if (existing)
    redirect(
      `/${fd.get("kind") === "owner" ? "owners" : "applicants"}?duplicate=1`,
    );
  await db.contact.create({
    data: {
      agencyId: user.agencyId,
      type: fd.get("kind") === "owner" ? "OWNER" : "APPLICANT",
      fullName: String(fd.get("fullName")),
      mobile,
      nationalCode,
      assignedAgentId: user.id,
      source: source as Source,
      notes: String(fd.get("notes") ?? ""),
    },
  });
  revalidatePath("/owners");
  revalidatePath("/applicants");
}
export async function saveSetting(fd: FormData) {
  const user = await requirePermission("settings.manage");
  for (const key of [
    "agencyName",
    "phone",
    "address",
    "city",
    "defaultLatitude",
    "defaultLongitude",
    "defaultZoom",
    "currency",
    "propertyCodePrefix",
  ]) {
    const value = String(fd.get(key) ?? "");
    await db.appSetting.upsert({
      where: { agencyId_key: { agencyId: user.agencyId, key } },
      update: { value },
      create: { agencyId: user.agencyId, key, value },
    });
  }
  await db.agency.update({
    where: { id: user.agencyId },
    data: {
      name: String(fd.get("agencyName")),
      phone: String(fd.get("phone")),
      address: String(fd.get("address")),
      city: String(fd.get("city")),
    },
  });
  revalidatePath("/settings");
}
export async function createActivity(fd: FormData) {
  const user = await requirePermission("activities.manage");
  const contactId = String(fd.get("contactId")) || null;
  const propertyId = String(fd.get("propertyId")) || null;
  const [contact, property] = await Promise.all([
    contactId
      ? db.contact.findFirst({
          where: { id: contactId, agencyId: user.agencyId },
        })
      : null,
    propertyId
      ? db.property.findFirst({
          where: { id: propertyId, agencyId: user.agencyId },
        })
      : null,
  ]);
  if ((contactId && !contact) || (propertyId && !property)) return;
  const nextActionAt = parseJalaliDateTime(
    String(fd.get("nextActionAt") || ""),
  );
  if (!nextActionAt) return;
  await db.activity.create({
    data: {
      agencyId: user.agencyId,
      userId: user.id,
      contactId,
      propertyId,
      type: "FOLLOW_UP",
      subject: String(fd.get("subject")),
      description: String(fd.get("description")),
      occurredAt: new Date(),
      nextActionAt,
      priority: "NORMAL",
    },
  });
  revalidatePath("/activities");
}
export async function createVisit(fd: FormData) {
  const user = await requirePermission("visits.manage");
  const scheduledAt = parseJalaliDateTime(String(fd.get("scheduledAt") || ""));
  if (!scheduledAt) return;
  if (scheduledAt.getTime() < Date.now() - 3600000) return;
  const propertyId = String(fd.get("propertyId"));
  const applicantId = String(fd.get("applicantId"));
  const [property, applicant] = await Promise.all([
    db.property.findFirst({
      where: { id: propertyId, agencyId: user.agencyId },
    }),
    db.contact.findFirst({
      where: { id: applicantId, agencyId: user.agencyId },
    }),
  ]);
  if (!property || !applicant) return;
  await db.visit.create({
    data: {
      agencyId: user.agencyId,
      propertyId,
      applicantId,
      assignedAgentId: user.id,
      scheduledAt,
      status: "SCHEDULED",
      notes: String(fd.get("notes") ?? ""),
    },
  });
  revalidatePath("/visits");
}
export async function updateVisitStatus(
  id: string,
  status: "COMPLETED" | "CANCELLED" | "NO_SHOW",
) {
  const user = await requirePermission("visits.manage");
  const canManageAll = await hasPermission(user, "visits.manage_all");
  await db.visit.updateMany({
    where: {
      id,
      agencyId: user.agencyId,
      ...(!canManageAll ? { assignedAgentId: user.id } : {}),
    },
    data: { status },
  });
  revalidatePath("/visits");
}
export async function createDeal(fd: FormData) {
  const user = await requirePermission("deals.create");
  const property = await db.property.findFirst({
    where: { id: String(fd.get("propertyId")), agencyId: user.agencyId },
  });
  if (!property) return;
  const applicant = await db.contact.findFirst({
    where: { id: String(fd.get("applicantId")), agencyId: user.agencyId },
  });
  if (!applicant) return;
  const deal = await db.deal.create({
    data: {
      agencyId: user.agencyId,
      propertyId: property.id,
      applicantId: applicant.id,
      ownerId: property.ownerId,
      assignedAgentId: user.id,
      type:
        property.transactionType === "SALE"
          ? "SALE"
          : property.transactionType === "PRESALE"
            ? "PRESALE"
            : "RENT",
      status: "NEGOTIATION",
      agreedPrice: parseMoney(String(fd.get("agreedPrice") ?? "")),
      notes: String(fd.get("notes") ?? ""),
    },
  });
  await db.dealStatusHistory.create({
    data: {
      dealId: deal.id,
      changedById: user.id,
      toStatus: "NEGOTIATION",
      note: "ایجاد پرونده معامله",
    },
  });
  redirect(`/deals/${deal.id}`);
}
export async function createRequirement(fd: FormData) {
  const user = await requirePermission("requirements.manage");
  const applicantId = String(fd.get("applicantId"));
  const applicant = await db.contact.findFirst({
    where: { id: applicantId, agencyId: user.agencyId },
  });
  if (!applicant) return;
  const r = await db.requirement.create({
    data: {
      agencyId: user.agencyId,
      applicantId,
      assignedAgentId: user.id,
      title: String(fd.get("title")),
      transactionType: String(fd.get("transactionType")) as "SALE",
      propertyTypesJson: JSON.stringify(fd.getAll("propertyTypes")),
      city: user.agency.city,
      neighborhoodsJson: JSON.stringify(
        String(fd.get("neighborhoods"))
          .split("،")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
      minArea: Number(fd.get("minArea")) || null,
      maxArea: Number(fd.get("maxArea")) || null,
      minBudget: parseMoney(String(fd.get("minBudget") ?? "")),
      maxBudget: parseMoney(String(fd.get("maxBudget") ?? "")),
      parkingRequired: fd.get("parkingRequired") === "on",
      elevatorRequired: fd.get("elevatorRequired") === "on",
      urgency: "NORMAL",
      status: "ACTIVE",
    },
  });
  redirect(`/matching?requirement=${r.id}`);
}
export async function createUser(fd: FormData) {
  const admin = await requirePermission("users.manage");
  const password = String(fd.get("password"));
  if (
    password.length < 10 ||
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  )
    return;
  const role = String(fd.get("role"));
  if (!["ADMIN", "MANAGER", "AGENT"].includes(role)) return;
  if (role === "ADMIN" && admin.role !== "ADMIN") return;
  const personnelType = String(fd.get("personnelType") || "AGENT");
  if (
    ![
      "OWNER",
      "MANAGER",
      "AGENT",
      "MARKETER",
      "CONTRACT_EXPERT",
      "RECEPTIONIST",
      "ACCOUNTANT",
      "PHOTOGRAPHER",
      "OTHER",
    ].includes(personnelType)
  )
    return;
  const defaultCommissionPercent = Number(
    toEnglishDigits(String(fd.get("defaultCommissionPercent") || 50)).replace(
      "٫",
      ".",
    ),
  );
  if (
    !Number.isFinite(defaultCommissionPercent) ||
    defaultCommissionPercent < 0 ||
    defaultCommissionPercent > 100
  )
    return;
  await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        agencyId: admin.agencyId,
        fullName: String(fd.get("fullName")),
        email: String(fd.get("email")).trim().toLowerCase(),
        mobile: normalizeMobile(String(fd.get("mobile"))),
        passwordHash: await bcrypt.hash(password, 12),
        role: role as "ADMIN" | "MANAGER" | "AGENT",
        isActive: true,
      },
    });
    await tx.employeeProfile.create({
      data: {
        agencyId: admin.agencyId,
        userId: created.id,
        employeeCode: `EMP-${created.id.slice(-6).toUpperCase()}`,
        personnelType: personnelType as PersonnelType,
        jobTitle: String(fd.get("jobTitle") || "") || null,
        defaultCommissionBasisPoints: Math.min(
          10_000,
          Math.max(0, Math.round(defaultCommissionPercent * 100)),
        ),
      },
    });
  });
  revalidatePath("/users");
}

export async function updateEmployeeProfile(fd: FormData) {
  const admin = await requirePermission("users.manage");
  const userId = String(fd.get("userId") || "");
  const personnelType = String(fd.get("personnelType") || "AGENT");
  const employmentStatus = String(fd.get("employmentStatus") || "ACTIVE");
  const allowedPersonnelTypes = [
    "OWNER",
    "MANAGER",
    "AGENT",
    "MARKETER",
    "CONTRACT_EXPERT",
    "RECEPTIONIST",
    "ACCOUNTANT",
    "PHOTOGRAPHER",
    "OTHER",
  ];
  if (
    !allowedPersonnelTypes.includes(personnelType) ||
    !["ACTIVE", "ON_LEAVE", "SUSPENDED", "ENDED"].includes(employmentStatus)
  )
    return;
  const target = await db.user.findFirst({
    where: { id: userId, agencyId: admin.agencyId },
    include: { employeeProfile: true },
  });
  if (!target?.employeeProfile) return;
  if (target.role === "ADMIN" && admin.role !== "ADMIN") return;
  const managerId = String(fd.get("managerId") || "") || null;
  if (managerId === userId) return;
  if (
    managerId &&
    !(await db.user.findFirst({
      where: { id: managerId, agencyId: admin.agencyId, isActive: true },
    }))
  )
    return;
  const defaultCommissionPercent = Number(
    toEnglishDigits(String(fd.get("defaultCommissionPercent") || 0)).replace(
      "٫",
      ".",
    ),
  );
  if (
    !Number.isFinite(defaultCommissionPercent) ||
    defaultCommissionPercent < 0 ||
    defaultCommissionPercent > 100
  )
    return;
  let fixedSalaryToman: bigint | null;
  try {
    fixedSalaryToman = parseMoney(String(fd.get("fixedSalaryToman") || ""));
  } catch {
    return;
  }
  if (target.id === admin.id && employmentStatus !== "ACTIVE") return;
  if (target.role === "ADMIN" && employmentStatus !== "ACTIVE") {
    const activeAdmins = await db.user.count({
      where: { agencyId: admin.agencyId, role: "ADMIN", isActive: true },
    });
    if (activeAdmins <= 1) return;
  }
  const hiredAtRaw = String(fd.get("hiredAt") || "");
  const hiredAt = hiredAtRaw
    ? parseJalaliDate(hiredAtRaw)
    : target.employeeProfile.hiredAt;
  if (!hiredAt) return;
  await db.$transaction([
    db.user.update({
      where: { id: target.id },
      data: { isActive: employmentStatus === "ACTIVE" },
    }),
    db.employeeProfile.update({
      where: { userId: target.id },
      data: {
        personnelType: personnelType as PersonnelType,
        employmentStatus: employmentStatus as
          | "ACTIVE"
          | "ON_LEAVE"
          | "SUSPENDED"
          | "ENDED",
        managerId,
        jobTitle: String(fd.get("jobTitle") || "") || null,
        hiredAt,
        endedAt: employmentStatus === "ENDED" ? new Date() : null,
        nationalCode: String(fd.get("nationalCode") || "") || null,
        bankName: String(fd.get("bankName") || "") || null,
        iban: String(fd.get("iban") || "") || null,
        fixedSalaryToman,
        defaultCommissionBasisPoints: Math.round(
          defaultCommissionPercent * 100,
        ),
        notes: String(fd.get("notes") || "") || null,
      },
    }),
  ]);
  if (employmentStatus !== "ACTIVE") await revokeUserSessions(target.id);
  revalidatePath("/users");
}

export async function unlockUserAccess(fd: FormData) {
  const operator = await requirePermission("users.manage");
  const userId = String(fd.get("userId") || "");
  const target = await db.user.findFirst({
    where: { id: userId, agencyId: operator.agencyId },
  });
  if (!target) return;
  await db.$transaction([
    db.user.update({
      where: { id: target.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    }),
    db.auditLog.create({
      data: {
        agencyId: operator.agencyId,
        userId: operator.id,
        entityType: "User",
        entityId: target.id,
        action: "UNLOCK_ACCESS",
      },
    }),
  ]);
  revalidatePath("/users");
}

export async function saveUserPermissions(fd: FormData) {
  const operator = await requirePermission("users.manage");
  const userId = String(fd.get("userId") || "");
  const target = await db.user.findFirst({
    where: { id: userId, agencyId: operator.agencyId },
  });
  if (!target || target.role === "ADMIN") return;
  const defaults = defaultPermissions(target.role);
  const overrides = allPermissions.flatMap((permission) => {
    const allowed = fd.get(`permission:${permission}`) === "on";
    return allowed === defaults.has(permission)
      ? []
      : [{ userId: target.id, permission, allowed }];
  });
  await db.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { userId: target.id } });
    if (overrides.length)
      await tx.userPermission.createMany({ data: overrides });
    await tx.auditLog.create({
      data: {
        agencyId: operator.agencyId,
        userId: operator.id,
        entityType: "User",
        entityId: target.id,
        action: "UPDATE_PERMISSIONS",
        changesJson: JSON.stringify(
          overrides.map(({ permission, allowed }) => ({ permission, allowed })),
        ),
      },
    });
  });
  revalidatePath("/users");
}
