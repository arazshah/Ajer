import "server-only";

import {
  recordIntegrationFailure,
  recordIntegrationSuccess,
  type IntegrationContext,
} from "@/lib/integrations";
import { fetchJsonWithPolicy, ProviderHttpError } from "@/lib/provider-http";
import { getPlatformSettings } from "@/lib/platform-settings";

const apiBase = (sandbox: boolean) =>
  sandbox
    ? "https://sandbox.zarinpal.com/pg/v4/payment"
    : "https://payment.zarinpal.com/pg/v4/payment";

function merchantId(value: string) {
  if (!/^[A-Za-z0-9-]{36}$/.test(value))
    throw new Error("ZARINPAL_MERCHANT_ID must contain 36 valid characters.");
  return value;
}

async function request<T extends { code: number }>(
  path: "request" | "verify",
  body: object,
  sandbox: boolean,
  context: IntegrationContext,
) {
  try {
    const result = await fetchJsonWithPolicy<{
      data?: T;
      errors?: { code?: number; message?: string } | unknown[];
    }>({
      provider: "ZARINPAL",
      url: `${apiBase(sandbox)}/${path}.json`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      },
      timeoutMs: 20_000,
      maxAttempts: path === "verify" ? 2 : 1,
    });
    if (!result.data.data) {
      const code =
        result.data.errors && !Array.isArray(result.data.errors)
          ? result.data.errors.code
          : undefined;
      throw new ProviderHttpError(
        "ZarinPal rejected the request.",
        code == null ? "provider-rejected" : `provider-code-${code}`,
        false,
        {
          provider: "ZARINPAL",
          statusCode: result.statusCode,
          attempts: result.attempts,
          latencyMs: result.latencyMs,
          requestId: result.requestId,
        },
      );
    }
    return { data: result.data.data, result };
  } catch (error) {
    await recordIntegrationFailure("ZARINPAL", path, error, context);
    throw error;
  }
}

export async function requestZarinpalPayment(input: {
  amountToman: number;
  callbackUrl: string;
  description: string;
  orderId: string;
  mobile?: string;
  email?: string;
  context?: IntegrationContext;
}) {
  const { payments } = await getPlatformSettings();
  if (!payments.enabled) throw new Error("Payments are disabled.");
  const context = input.context || {};
  const { data, result } = await request<{
    code: number;
    authority: string;
  }>(
    "request",
    {
      merchant_id: merchantId(payments.merchantId),
      amount: input.amountToman * 10,
      currency: "IRR",
      callback_url: input.callbackUrl,
      description: input.description,
      metadata: {
        mobile: input.mobile,
        email: input.email,
        order_id: input.orderId,
      },
    },
    payments.sandbox,
    context,
  );
  if (data.code !== 100 || !data.authority) {
    const error = new ProviderHttpError(
      "ZarinPal rejected the payment request.",
      `provider-code-${data.code}`,
      false,
      {
        provider: "ZARINPAL",
        statusCode: result.statusCode,
        attempts: result.attempts,
        latencyMs: result.latencyMs,
        requestId: result.requestId,
      },
    );
    await recordIntegrationFailure("ZARINPAL", "request", error, context);
    throw error;
  }
  await recordIntegrationSuccess("ZARINPAL", "request", result, context);
  const gateway = payments.sandbox
    ? "https://sandbox.zarinpal.com/pg/StartPay"
    : "https://payment.zarinpal.com/pg/StartPay";
  return { authority: data.authority, url: `${gateway}/${data.authority}` };
}

export async function verifyZarinpalPayment(input: {
  authority: string;
  amountToman: number;
  context?: IntegrationContext;
}) {
  const { payments } = await getPlatformSettings();
  if (!payments.enabled) throw new Error("Payments are disabled.");
  const context = input.context || {};
  const { data, result } = await request<{
    code: number;
    ref_id?: number;
    card_pan?: string;
  }>(
    "verify",
    {
      merchant_id: merchantId(payments.merchantId),
      amount: input.amountToman * 10,
      authority: input.authority,
    },
    payments.sandbox,
    context,
  );
  if (![100, 101].includes(data.code)) {
    const error = new ProviderHttpError(
      "ZarinPal verification was not successful.",
      `provider-code-${data.code}`,
      false,
      {
        provider: "ZARINPAL",
        statusCode: result.statusCode,
        attempts: result.attempts,
        latencyMs: result.latencyMs,
        requestId: result.requestId,
      },
    );
    await recordIntegrationFailure("ZARINPAL", "verify", error, context);
    throw error;
  }
  await recordIntegrationSuccess("ZARINPAL", "verify", result, context);
  return {
    refId: String(data.ref_id ?? ""),
    alreadyVerified: data.code === 101,
  };
}
