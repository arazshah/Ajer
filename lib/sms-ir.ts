import "server-only";

import {
  recordIntegrationFailure,
  recordIntegrationSuccess,
  type IntegrationContext,
} from "@/lib/integrations";
import { fetchJsonWithPolicy, ProviderHttpError } from "@/lib/provider-http";
import { getPlatformSettings } from "@/lib/platform-settings";

type SmsParameter = { name: string; value: string };

type SmsIrResponse = {
  status?: number;
  message?: string;
  data?: { messageId?: number | string } | number | string | null;
};

function messageId(response: SmsIrResponse) {
  if (typeof response.data === "string" || typeof response.data === "number")
    return String(response.data);
  if (response.data?.messageId != null) return String(response.data.messageId);
  return null;
}

export async function sendSmsTemplate(
  mobile: string,
  templateId: number | undefined,
  parameters: SmsParameter[],
  context: IntegrationContext = {},
) {
  const { sms } = await getPlatformSettings();
  if (!sms.enabled || !sms.apiKey || !templateId)
    return { sent: false as const, reason: "not-configured" };
  try {
    const result = await fetchJsonWithPolicy<SmsIrResponse>({
      provider: "SMS_IR",
      url: `${sms.baseUrl.replace(/\/$/, "")}/send/verify`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": sms.apiKey,
        },
        body: JSON.stringify({
          Mobile: mobile,
          TemplateId: templateId,
          Parameters: parameters,
        }),
      },
      timeoutMs: 15_000,
      // Sending is not retried in-process because a lost response may still
      // represent a delivered SMS. The durable queue controls later retries.
      maxAttempts: 1,
    });
    if (result.data.status === 0) {
      throw new ProviderHttpError(
        "SMS.ir rejected the template message.",
        "provider-rejected",
        false,
        {
          provider: "SMS_IR",
          statusCode: result.statusCode,
          attempts: result.attempts,
          latencyMs: result.latencyMs,
          requestId: result.requestId,
        },
      );
    }
    await recordIntegrationSuccess("SMS_IR", "send-template", result, context);
    return {
      sent: true as const,
      providerMessageId: messageId(result.data),
    };
  } catch (error) {
    await recordIntegrationFailure("SMS_IR", "send-template", error, context);
    return {
      sent: false as const,
      reason:
        error instanceof ProviderHttpError ? error.code : "provider-error",
    };
  }
}

export async function sendWelcomeSms(
  mobile: string,
  name: string,
  context: IntegrationContext = {},
) {
  const { sms } = await getPlatformSettings();
  return sendSmsTemplate(
    mobile,
    Number(sms.welcomeTemplateId) || undefined,
    [{ name: "NAME", value: name }],
    context,
  );
}

export async function sendPaymentSms(
  mobile: string,
  days: number,
  context: IntegrationContext = {},
) {
  const { sms } = await getPlatformSettings();
  return sendSmsTemplate(
    mobile,
    Number(sms.paymentTemplateId) || undefined,
    [{ name: "DAYS", value: String(days) }],
    context,
  );
}
