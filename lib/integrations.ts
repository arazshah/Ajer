import "server-only";

import { db } from "@/lib/db";
import { ProviderHttpError, type ProviderHttpResult } from "@/lib/provider-http";

export type IntegrationContext = {
  agencyId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string;
};

export async function recordIntegrationSuccess<T>(
  provider: string,
  operation: string,
  result: ProviderHttpResult<T>,
  context: IntegrationContext = {},
) {
  await db.integrationEvent
    .create({
      data: {
        provider,
        operation,
        success: true,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        attempts: result.attempts,
        requestId: result.requestId,
        agencyId: context.agencyId || null,
        userId: context.userId || null,
        entityType: context.entityType || null,
        entityId: context.entityId || null,
      },
    })
    .catch((error) => console.error("Unable to record integration success", error));
}

export async function recordIntegrationFailure(
  provider: string,
  operation: string,
  error: unknown,
  context: IntegrationContext = {},
) {
  const providerError = error instanceof ProviderHttpError ? error : null;
  await db.integrationEvent
    .create({
      data: {
        provider,
        operation,
        success: false,
        statusCode: providerError?.details.statusCode,
        latencyMs: providerError?.details.latencyMs,
        attempts: providerError?.details.attempts || 1,
        errorCode: providerError?.code || "unexpected-error",
        requestId: providerError?.details.requestId,
        agencyId: context.agencyId || null,
        userId: context.userId || null,
        entityType: context.entityType || null,
        entityId: context.entityId || null,
      },
    })
    .catch((recordError) =>
      console.error("Unable to record integration failure", recordError),
    );
}
