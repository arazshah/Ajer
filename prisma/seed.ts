import {
  PrismaClient,
  PropertyStatus,
  PropertyType,
  TransactionType,
  ContactType,
  Source,
  ActivityType,
  Priority,
  VisitStatus,
  DealStatus,
  DealType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
const neighborhoods = [
  "خیام",
  "دانشکده",
  "استادان",
  "فرهنگیان",
  "شهرک ایثار",
  "شهرک ولیعصر",
  "مولوی",
  "امام",
  "کاشانی",
  "مدنی",
  "بند",
  "البرز",
  "شهرچای",
  "گلشهر",
  "منطقه آزادگان",
];
const names = [
  "مریم احمدی",
  "رضا کریمی",
  "نگار شریفی",
  "حسین محمدی",
  "سارا کاظمی",
  "فرهاد یوسفی",
  "الهام نادری",
  "میلاد اکبری",
  "شادی مرادی",
  "کیوان رستمی",
  "آرزو قاسمی",
  "بهنام امینی",
  "ترانه صادقی",
  "مازیار محمودی",
  "رها فراهانی",
  "سامان عزیزی",
  "نسترن قربانی",
  "پویان جعفری",
];
async function main() {
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.deal.deleteMany();
  await db.visit.deleteMany();
  await db.activity.deleteMany();
  await db.requirement.deleteMany();
  await db.propertyImage.deleteMany();
  await db.property.deleteMany();
  await db.contact.deleteMany();
  await db.appSetting.deleteMany();
  await db.user.deleteMany();
  await db.agency.deleteMany();
  const agency = await db.agency.create({
    data: {
      name: "املاک آجر ارومیه",
      phone: "۰۴۴-۳۳۴۴۰۰۰۰",
      address: "ارومیه، خیابان استادان، پلاک نمایشی ۲۴",
      city: "ارومیه",
    },
  });
  const hash = await bcrypt.hash("Ajer123!", 12);
  const admin = await db.user.create({
    data: {
      agencyId: agency.id,
      fullName: "مدیر آژانس",
      email: "admin@ajer.ir",
      mobile: "09120000001",
      passwordHash: hash,
      role: "ADMIN",
    },
  });
  const agent = await db.user.create({
    data: {
      agencyId: agency.id,
      fullName: "علی رضایی",
      email: "agent@ajer.ir",
      mobile: "09120000002",
      passwordHash: hash,
      role: "AGENT",
    },
  });
  const contacts = [];
  for (let i = 0; i < 18; i++)
    contacts.push(
      await db.contact.create({
        data: {
          agencyId: agency.id,
          type:
            i < 8
              ? ContactType.OWNER
              : i < 16
                ? ContactType.APPLICANT
                : ContactType.BOTH,
          fullName: names[i],
          mobile: `09000000${String(i + 10).padStart(3, "0")}`,
          source: i % 2 ? Source.REFERRAL : Source.OWNER,
          notes: "اطلاعات کاملاً ساختگی برای نسخه نمایشی آجر",
        },
      }),
    );
  const types: PropertyType[] = [
    "APARTMENT",
    "APARTMENT",
    "VILLA",
    "LAND",
    "COMMERCIAL",
    "OFFICE",
    "HOUSE",
    "STORE",
  ];
  const txs: TransactionType[] = [
    "SALE",
    "MORTGAGE_RENT",
    "SALE",
    "SALE",
    "RENT",
    "PRESALE",
  ];
  const statuses: PropertyStatus[] = [
    "ACTIVE",
    "ACTIVE",
    "ACTIVE",
    "RESERVED",
    "ACTIVE",
    "SOLD",
    "RENTED",
    "INACTIVE",
  ];
  const properties = [];
  for (let i = 0; i < 24; i++) {
    const tx = txs[i % txs.length],
      type = types[i % types.length],
      n = neighborhoods[i % neighborhoods.length],
      area = 65 + (i % 10) * 17;
    properties.push(
      await db.property.create({
        data: {
          agencyId: agency.id,
          assignedAgentId: i % 3 ? agent.id : admin.id,
          ownerId: contacts[i % 8].id,
          code: `AJ-1405-${String(i + 1).padStart(3, "0")}`,
          title: `${type === "APARTMENT" ? "آپارتمان" : type === "VILLA" ? "ویلای دلباز" : type === "LAND" ? "زمین مسکونی" : type === "COMMERCIAL" ? "واحد تجاری" : type === "OFFICE" ? "دفتر اداری" : type === "STORE" ? "مغازه" : "خانه حیاط‌دار"} در ${n}`,
          description: `فایل نمایشی خوش‌موقعیت در محله ${n} ارومیه با دسترسی مناسب و شرایط بازدید هماهنگ‌شده. تمام مشخصات این فایل ساختگی است.`,
          transactionType: tx,
          propertyType: type,
          status: statuses[i % statuses.length],
          exclusivity: i % 5 === 0 ? "EXCLUSIVE" : "NORMAL",
          source: "OWNER",
          city: "ارومیه",
          district: `منطقه ${(i % 5) + 1}`,
          neighborhood: n,
          address: `ارومیه، ${n}، کوچه نمایشی ${i + 1}`,
          latitude: 37.5527 + ((i % 6) - 2.5) * 0.009,
          longitude: 45.0761 + (Math.floor(i / 6) - 1.5) * 0.012,
          area,
          landArea: type === "LAND" || type === "VILLA" ? area + 140 : null,
          bedrooms:
            type === "LAND" || type === "COMMERCIAL" ? null : 1 + (i % 4),
          floor: i % 6,
          totalFloors: 6,
          constructionYear: 1390 + (i % 14),
          parking: i % 3 !== 0,
          elevator: i % 4 !== 0,
          storage: i % 2 === 0,
          balcony: i % 3 === 0,
          renovated: i % 5 === 0,
          priceTotal:
            tx === "SALE" || tx === "PRESALE"
              ? BigInt(2400000000 + i * 390000000)
              : null,
          depositAmount:
            tx === "MORTGAGE_RENT" || tx === "RENT"
              ? BigInt(350000000 + i * 25000000)
              : null,
          monthlyRent:
            tx === "MORTGAGE_RENT" || tx === "RENT"
              ? BigInt(9000000 + i * 850000)
              : null,
          negotiable: i % 2 === 0,
          publishedAt: new Date(Date.now() - i * 86400000),
          images: {
            create: {
              url: `/property-${(i % 6) + 1}.png`,
              alt: `تصویر نمایشی ملک در ${n}`,
              isCover: true,
            },
          },
        },
      }),
    );
  }
  const reqs = [];
  for (let i = 0; i < 12; i++)
    reqs.push(
      await db.requirement.create({
        data: {
          agencyId: agency.id,
          applicantId: contacts[8 + (i % 8)].id,
          assignedAgentId: i % 2 ? agent.id : admin.id,
          title: `درخواست ${txs[i % txs.length] === "SALE" ? "خرید" : "اجاره"} در ${neighborhoods[i]}`,
          transactionType: txs[i % txs.length],
          propertyTypesJson: JSON.stringify([
            types[i % types.length],
            "APARTMENT",
          ]),
          city: "ارومیه",
          neighborhoodsJson: JSON.stringify([
            neighborhoods[i],
            neighborhoods[(i + 1) % 15],
          ]),
          minArea: 60,
          maxArea: 180,
          minBedrooms: 1,
          maxBedrooms: 4,
          minBudget: 1000000000n,
          maxBudget: 8500000000n,
          maxDeposit: 1200000000n,
          maxMonthlyRent: 45000000n,
          parkingRequired: i % 3 === 0,
          elevatorRequired: i % 4 === 0,
          urgency: i % 4 === 0 ? "IMMEDIATE" : "NORMAL",
        },
      }),
    );
  for (let i = 0; i < 30; i++)
    await db.activity.create({
      data: {
        agencyId: agency.id,
        userId: i % 2 ? agent.id : admin.id,
        contactId: contacts[i % 18].id,
        propertyId: properties[i % 24].id,
        requirementId: i < 12 ? reqs[i].id : null,
        type:
          i % 3 === 0
            ? ActivityType.FOLLOW_UP
            : i % 3 === 1
              ? ActivityType.CALL
              : ActivityType.NOTE,
        subject: i % 3 === 0 ? "پیگیری شرایط فایل" : "گفت‌وگو با مشتری",
        description: "گزارش ساختگی فعالیت ثبت‌شده برای نمایش گردش کار آجر",
        occurredAt: new Date(Date.now() - i * 3600000 * 8),
        nextActionAt:
          i % 3 === 0 ? new Date(Date.now() + (i - 8) * 3600000 * 6) : null,
        completed: i % 5 === 0,
        priority: i % 4 === 0 ? Priority.HIGH : Priority.NORMAL,
      },
    });
  for (let i = 0; i < 9; i++)
    await db.visit.create({
      data: {
        agencyId: agency.id,
        propertyId: properties[i].id,
        applicantId: contacts[8 + (i % 8)].id,
        requirementId: reqs[i].id,
        assignedAgentId: i % 2 ? agent.id : admin.id,
        scheduledAt: new Date(Date.now() + (i - 2) * 86400000),
        status: i < 2 ? VisitStatus.COMPLETED : VisitStatus.SCHEDULED,
        feedback: i < 2 ? "بازدید مثبت بود؛ پیگیری قیمت انجام شود." : null,
        applicantRating: i < 2 ? 4 : null,
      },
    });
  const dealStatuses: DealStatus[] = [
    "NEGOTIATION",
    "AGREED",
    "CONTRACTED",
    "COMPLETED",
    "CANCELLED",
  ];
  for (let i = 0; i < 5; i++)
    await db.deal.create({
      data: {
        agencyId: agency.id,
        propertyId: properties[i].id,
        applicantId: contacts[8 + i].id,
        ownerId: contacts[i].id,
        assignedAgentId: i % 2 ? agent.id : admin.id,
        type: txs[i] === TransactionType.SALE ? DealType.SALE : DealType.RENT,
        status: dealStatuses[i],
        agreedPrice: properties[i].priceTotal,
        depositAmount: properties[i].depositAmount,
        monthlyRent: properties[i].monthlyRent,
        commissionAmount: BigInt(25000000 + i * 9000000),
        contractNumber: i >= 2 ? `CN-1405-${i + 1}` : null,
        contractDate: i >= 2 ? new Date(Date.now() - i * 86400000 * 10) : null,
      },
    });
  for (let i = 0; i < 8; i++)
    await db.notification.create({
      data: {
        userId: i % 2 ? agent.id : admin.id,
        title: i % 2 ? "بازدید پیش‌رو" : "پیگیری عقب‌افتاده",
        message:
          i % 2
            ? "بازدید فردا را با متقاضی هماهنگ کنید."
            : "زمان پیگیری یک مشتری گذشته است.",
        link: i % 2 ? "/visits" : "/activities",
        read: i > 5,
      },
    });
  for (const [key, value] of Object.entries({
    defaultLatitude: "37.5527",
    defaultLongitude: "45.0761",
    defaultZoom: "12",
    currency: "تومان",
    propertyCodePrefix: "AJ",
  }))
    await db.appSetting.create({ data: { agencyId: agency.id, key, value } });
  console.log(
    `Seeded ${properties.length} properties, ${contacts.length} contacts, ${reqs.length} requirements.`,
  );
}
main().finally(() => db.$disconnect());
