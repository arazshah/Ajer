import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { db } from "@/lib/db";

export const PLATFORM_SETTING_KEYS = {
  platformName: "platform.name",
  appUrl: "platform.appUrl",
  supportEmail: "platform.supportEmail",
  supportPhone: "platform.supportPhone",
  trialDays: "platform.trialDays",
  signupEnabled: "platform.signupEnabled",
  billingMode: "billing.mode",
  manualAccountHolder: "billing.manual.accountHolder",
  manualCardNumber: "billing.manual.cardNumber",
  manualIban: "billing.manual.iban",
  manualInstructions: "billing.manual.instructions",
  aiEnabled: "ai.enabled",
  aiApiKey: "ai.apiKey",
  aiBaseUrl: "ai.baseUrl",
  aiModel: "ai.model",
  smsEnabled: "sms.enabled",
  smsApiKey: "sms.apiKey",
  smsBaseUrl: "sms.baseUrl",
  smsWelcomeTemplateId: "sms.welcomeTemplateId",
  smsPaymentTemplateId: "sms.paymentTemplateId",
  smsVisitTemplateId: "sms.visitTemplateId",
  smsOfferTemplateId: "sms.offerTemplateId",
  smsPasswordResetTemplateId: "sms.passwordResetTemplateId",
  paymentsEnabled: "payments.enabled",
  zarinpalMerchantId: "payments.zarinpalMerchantId",
  zarinpalSandbox: "payments.zarinpalSandbox",
} as const;

export type PlatformSettingKey =
  (typeof PLATFORM_SETTING_KEYS)[keyof typeof PLATFORM_SETTING_KEYS];

const SECRET_KEYS = new Set<PlatformSettingKey>([
  PLATFORM_SETTING_KEYS.aiApiKey,
  PLATFORM_SETTING_KEYS.smsApiKey,
  PLATFORM_SETTING_KEYS.zarinpalMerchantId,
]);

function encryptionKey() {
  const secret =
    process.env.SETTINGS_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY or SESSION_SECRET must contain at least 32 characters.",
    );
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decrypt(value: string) {
  if (!value.startsWith("enc:v1:")) return value;
  const [, , iv, tag, encrypted] = value.split(":");
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted setting.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return value === "true";
}

function positiveInt(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

export async function getPlatformSettings() {
  const rows = await db.platformSetting.findMany();
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const read = (key: PlatformSettingKey, fallback = "") => {
    const stored = values.get(key);
    if (stored === undefined) return fallback;
    if (!SECRET_KEYS.has(key)) return stored;
    try {
      return decrypt(stored);
    } catch (error) {
      console.error(`Unable to decrypt platform setting ${key}`, error);
      return fallback;
    }
  };

  const aiApiKey = read(
    PLATFORM_SETTING_KEYS.aiApiKey,
    process.env.AI_API_KEY || process.env.AVALAI_API_KEY || "",
  );
  const smsApiKey = read(
    PLATFORM_SETTING_KEYS.smsApiKey,
    process.env.SMSIR_API_KEY || "",
  );
  const merchantId = read(
    PLATFORM_SETTING_KEYS.zarinpalMerchantId,
    process.env.ZARINPAL_MERCHANT_ID || "",
  );
  const rawBillingMode = read(PLATFORM_SETTING_KEYS.billingMode, "MANUAL");
  const billingMode = ["MANUAL", "ONLINE", "BOTH"].includes(rawBillingMode)
    ? (rawBillingMode as "MANUAL" | "ONLINE" | "BOTH")
    : "MANUAL";

  return {
    platform: {
      name: read(PLATFORM_SETTING_KEYS.platformName, "آجر"),
      appUrl: read(PLATFORM_SETTING_KEYS.appUrl, process.env.APP_URL || ""),
      supportEmail: read(PLATFORM_SETTING_KEYS.supportEmail),
      supportPhone: read(PLATFORM_SETTING_KEYS.supportPhone),
      trialDays: positiveInt(read(PLATFORM_SETTING_KEYS.trialDays), 30),
      signupEnabled: bool(read(PLATFORM_SETTING_KEYS.signupEnabled), true),
    },
    ai: {
      enabled: bool(read(PLATFORM_SETTING_KEYS.aiEnabled), true),
      apiKey: aiApiKey,
      baseUrl: read(
        PLATFORM_SETTING_KEYS.aiBaseUrl,
        process.env.AI_BASE_URL ||
          process.env.AVALAI_BASE_URL ||
          "https://api.avalai.ir/v1",
      ),
      model: read(
        PLATFORM_SETTING_KEYS.aiModel,
        process.env.AI_MODEL || process.env.AVALAI_MODEL || "gpt-5.4-mini",
      ),
      configured: Boolean(aiApiKey),
    },
    sms: {
      enabled: bool(read(PLATFORM_SETTING_KEYS.smsEnabled), true),
      apiKey: smsApiKey,
      baseUrl: read(
        PLATFORM_SETTING_KEYS.smsBaseUrl,
        process.env.SMSIR_BASE_URL || "https://api.sms.ir/v1",
      ),
      welcomeTemplateId: read(
        PLATFORM_SETTING_KEYS.smsWelcomeTemplateId,
        process.env.SMSIR_WELCOME_TEMPLATE_ID || "",
      ),
      paymentTemplateId: read(
        PLATFORM_SETTING_KEYS.smsPaymentTemplateId,
        process.env.SMSIR_PAYMENT_TEMPLATE_ID || "",
      ),
      visitTemplateId: read(
        PLATFORM_SETTING_KEYS.smsVisitTemplateId,
        process.env.SMSIR_VISIT_TEMPLATE_ID || "",
      ),
      offerTemplateId: read(
        PLATFORM_SETTING_KEYS.smsOfferTemplateId,
        process.env.SMSIR_OFFER_TEMPLATE_ID || "",
      ),
      passwordResetTemplateId: read(
        PLATFORM_SETTING_KEYS.smsPasswordResetTemplateId,
        process.env.SMSIR_PASSWORD_RESET_TEMPLATE_ID || "",
      ),
      configured: Boolean(smsApiKey),
    },
    payments: {
      enabled:
        (billingMode === "ONLINE" || billingMode === "BOTH") &&
        bool(read(PLATFORM_SETTING_KEYS.paymentsEnabled), true),
      merchantId,
      sandbox: bool(
        read(
          PLATFORM_SETTING_KEYS.zarinpalSandbox,
          process.env.ZARINPAL_SANDBOX,
        ),
        false,
      ),
      configured: Boolean(merchantId),
    },
    billing: {
      mode: billingMode,
      manualEnabled: billingMode === "MANUAL" || billingMode === "BOTH",
      onlineEnabled: billingMode === "ONLINE" || billingMode === "BOTH",
      accountHolder: read(PLATFORM_SETTING_KEYS.manualAccountHolder),
      cardNumber: read(PLATFORM_SETTING_KEYS.manualCardNumber),
      iban: read(PLATFORM_SETTING_KEYS.manualIban),
      instructions: read(
        PLATFORM_SETTING_KEYS.manualInstructions,
        "پس از انتخاب پلن، روش پرداخت یا درخواست تماس را ثبت کنید. نتیجه بررسی از همین صفحه اعلام می‌شود.",
      ),
    },
  };
}

export async function savePlatformSettings(
  entries: Partial<Record<PlatformSettingKey, string>>,
) {
  await db.$transaction(
    Object.entries(entries).map(([key, value]) =>
      db.platformSetting.upsert({
        where: { key },
        create: {
          key,
          value: SECRET_KEYS.has(key as PlatformSettingKey)
            ? encrypt(value)
            : value,
        },
        update: {
          value: SECRET_KEYS.has(key as PlatformSettingKey)
            ? encrypt(value)
            : value,
        },
      }),
    ),
  );
}

export async function deletePlatformSetting(key: PlatformSettingKey) {
  await db.platformSetting.deleteMany({ where: { key } });
}
