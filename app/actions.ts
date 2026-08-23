"use server";
import { db } from "@/lib/db";
import { createSession, requireAdmin, requireUser } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { normalizeMobile, parseMoney } from "@/lib/format";
import { propertySchema } from "@/lib/validation";
export async function loginAction(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (
    !user ||
    !user.isActive ||
    !(await bcrypt.compare(password, user.passwordHash))
  )
    return { error: "ایمیل یا رمز عبور نادرست است." };
  await createSession(user.id);
  redirect("/dashboard");
}
export async function logoutAction() {
  (await cookies()).delete("ajer_session");
  redirect("/login");
}
export async function toggleActivity(id: string) {
  const user = await requireUser();
  const a = await db.activity.findFirst({
    where: { id, agencyId: user.agencyId },
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
  const user = await requireUser();
  await db.deal.updateMany({
    where: { id, agencyId: user.agencyId },
    data: { status },
  });
  revalidatePath("/deals");
}
export async function archiveProperty(id: string) {
  const user = await requireUser();
  await db.property.updateMany({
    where: { id, agencyId: user.agencyId },
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
  const user = await requireUser();
  const p = await db.property.findFirst({
    where: { id, agencyId: user.agencyId },
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
  const user = await requireUser();
  const parsed = propertySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const id = String(fd.get("id") ?? "");
  const base = {
    ...d,
    priceTotal: parseMoney(d.priceTotal ?? ""),
    depositAmount: parseMoney(d.depositAmount ?? ""),
    monthlyRent: parseMoney(d.monthlyRent ?? ""),
    agencyId: user.agencyId,
    city: "ارومیه",
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
  };
  if (id) {
    await db.property.updateMany({
      where: { id, agencyId: user.agencyId },
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
  const user = await requireUser();
  const mobile = normalizeMobile(String(fd.get("mobile")));
  const existing = await db.contact.findFirst({
    where: { agencyId: user.agencyId, mobile },
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
      source: "OTHER",
      notes: String(fd.get("notes") ?? ""),
    },
  });
  revalidatePath("/owners");
  revalidatePath("/applicants");
}
export async function saveSetting(fd: FormData) {
  const user = await requireAdmin();
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
  const user = await requireUser();
  await db.activity.create({
    data: {
      agencyId: user.agencyId,
      userId: user.id,
      contactId: String(fd.get("contactId")) || null,
      propertyId: String(fd.get("propertyId")) || null,
      type: "FOLLOW_UP",
      subject: String(fd.get("subject")),
      description: String(fd.get("description")),
      occurredAt: new Date(),
      nextActionAt: new Date(String(fd.get("nextActionAt"))),
      priority: "NORMAL",
    },
  });
  revalidatePath("/activities");
}
export async function createVisit(fd: FormData) {
  const user = await requireUser();
  const scheduledAt = new Date(String(fd.get("scheduledAt")));
  if (scheduledAt.getTime() < Date.now() - 3600000) return;
  await db.visit.create({
    data: {
      agencyId: user.agencyId,
      propertyId: String(fd.get("propertyId")),
      applicantId: String(fd.get("applicantId")),
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
  const user = await requireUser();
  await db.visit.updateMany({
    where: { id, agencyId: user.agencyId },
    data: { status },
  });
  revalidatePath("/visits");
}
export async function createDeal(fd: FormData) {
  const user = await requireUser();
  const property = await db.property.findFirst({
    where: { id: String(fd.get("propertyId")), agencyId: user.agencyId },
  });
  if (!property) return;
  await db.deal.create({
    data: {
      agencyId: user.agencyId,
      propertyId: property.id,
      applicantId: String(fd.get("applicantId")),
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
  revalidatePath("/deals");
}
export async function createRequirement(fd: FormData) {
  const user = await requireUser();
  const r = await db.requirement.create({
    data: {
      agencyId: user.agencyId,
      applicantId: String(fd.get("applicantId")),
      assignedAgentId: user.id,
      title: String(fd.get("title")),
      transactionType: String(fd.get("transactionType")) as "SALE",
      propertyTypesJson: JSON.stringify(fd.getAll("propertyTypes")),
      city: "ارومیه",
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
  const admin = await requireAdmin();
  const password = String(fd.get("password"));
  if (password.length < 8) return;
  await db.user.create({
    data: {
      agencyId: admin.agencyId,
      fullName: String(fd.get("fullName")),
      email: String(fd.get("email")).toLowerCase(),
      mobile: normalizeMobile(String(fd.get("mobile"))),
      passwordHash: await bcrypt.hash(password, 12),
      role: String(fd.get("role")) as "AGENT",
      isActive: true,
    },
  });
  revalidatePath("/users");
}
