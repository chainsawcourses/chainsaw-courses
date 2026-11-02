import { Router } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  learnerSubscriptionsTable,
  subscriptionBillingEventsTable,
  subscriptionDeliveryAttemptsTable,
  usersTable,
} from "@workspace/db";
import { RecordSubscriptionBillingEventBody } from "@workspace/api-zod";
import {
  nextSubscriptionPaidThroughAt,
  subscriptionEventIsNewer,
  subscriptionEventClearsPaidThrough,
  subscriptionStatusEndsAccess,
} from "../lib/subscriptionEvents";
import { hasBillingSecret } from "../lib/billingAuth";
import { reconcileBillingSupportNotifications } from "../lib/billingSupportNotifications";

const router = Router();

function triggerSupportNotificationReconciliation(): void {
  void reconcileBillingSupportNotifications().catch((error) => {
    console.error("Could not trigger billing support notification reconciliation", error);
  });
}

function asDate(value: string | Date | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function safeString(value: unknown, maxLength = 512): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function safeAttemptInput(raw: unknown): {
  providerEventId: string;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  learnerId: number | null;
  learnerEmail: string | null;
  eventType: string;
  eventOccurredAt: Date | null;
} | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const providerEventId = safeString(body.providerEventId);
  const provider = safeString(body.provider);
  const providerCustomerId = safeString(body.providerCustomerId);
  const providerSubscriptionId = safeString(body.providerSubscriptionId);
  const eventType = safeString(body.eventType);
  const learnerId = typeof body.learnerId === "number" && Number.isInteger(body.learnerId)
    ? body.learnerId
    : null;
  const learnerEmail = safeString(body.learnerEmail, 320)?.toLowerCase() ?? null;
  if (!providerEventId && !provider && !providerCustomerId && !providerSubscriptionId &&
    !eventType && learnerId === null && !learnerEmail) return null;
  const occurredValue = typeof body.occurredAt === "string" ? body.occurredAt : null;
  const eventOccurredAt = occurredValue ? asDate(occurredValue) ?? null : null;
  return {
    providerEventId: providerEventId ?? "unknown",
    provider: provider ?? "unknown",
    providerCustomerId,
    providerSubscriptionId,
    learnerId,
    learnerEmail,
    eventType: eventType ?? "invalid",
    eventOccurredAt,
  };
}

async function createDeliveryAttempt(
  raw: unknown,
  outcome: string,
  httpStatus: number,
  errorCode?: string,
): Promise<number | null> {
  const input = safeAttemptInput(raw);
  if (!input) return null;
  const [attempt] = await db.insert(subscriptionDeliveryAttemptsTable).values({
    ...input,
    outcome,
    httpStatus,
    errorCode: errorCode ?? null,
  }).returning({ id: subscriptionDeliveryAttemptsTable.id });
  return attempt?.id ?? null;
}

type AttemptResult = {
  outcome: string;
  httpStatus: number;
  duplicate?: boolean;
  applied?: boolean;
  errorCode?: string;
  userId?: number | null;
};

async function finaliseDeliveryAttempt(attemptId: number, result: AttemptResult): Promise<void> {
  await db.update(subscriptionDeliveryAttemptsTable)
    .set({
      learnerId: result.userId ?? undefined,
      outcome: result.outcome,
      httpStatus: result.httpStatus,
      duplicate: result.duplicate ?? false,
      applied: result.applied ?? false,
      errorCode: result.errorCode ?? null,
    })
    .where(eq(subscriptionDeliveryAttemptsTable.id, attemptId));
}

router.post("/billing/subscription-events", async (req, res): Promise<void> => {
  const suppliedSecret = req.headers["x-website-billing-secret"];
  const headerSecret = Array.isArray(suppliedSecret) ? suppliedSecret[0] : suppliedSecret;
  const authorization = req.headers.authorization;
  const bearerSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const secret = headerSecret ?? bearerSecret;
  if (!hasBillingSecret(secret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = RecordSubscriptionBillingEventBody.safeParse(req.body);
  if (!parsed.success) {
    try {
      const raw = req.body && typeof req.body === "object"
        ? req.body as Record<string, unknown>
        : null;
      const hasInvalidDate = raw !== null && (
        (raw.occurredAt !== undefined &&
          asDate(typeof raw.occurredAt === "string" ? raw.occurredAt : null) === undefined) ||
        (raw.paidThroughAt !== undefined && raw.paidThroughAt !== null &&
          asDate(typeof raw.paidThroughAt === "string" ? raw.paidThroughAt : null) === undefined)
      );
      await createDeliveryAttempt(
        req.body,
        hasInvalidDate ? "invalid_date" : "invalid_payload",
        400,
        hasInvalidDate ? "invalid_date" : "invalid_payload",
      );
      triggerSupportNotificationReconciliation();
    } catch (error) {
      req.log.warn({ err: error }, "Could not record invalid billing delivery attempt");
    }
    res.status(400).json({ error: "Invalid billing event" });
    return;
  }

  const input = parsed.data;
  const occurredAt = asDate(input.occurredAt);
  if (!occurredAt) {
    try {
      await createDeliveryAttempt(req.body, "invalid_date", 400, "invalid_occurred_at");
      triggerSupportNotificationReconciliation();
    } catch (error) {
      req.log.warn({ err: error }, "Could not record invalid billing date attempt");
    }
    res.status(400).json({ error: "occurredAt must be a valid date-time" });
    return;
  }
  const paidThroughAt = asDate(input.paidThroughAt);
  if (input.paidThroughAt !== undefined && paidThroughAt === undefined) {
    try {
      await createDeliveryAttempt(req.body, "invalid_date", 400, "invalid_paid_through_at");
      triggerSupportNotificationReconciliation();
    } catch (error) {
      req.log.warn({ err: error }, "Could not record invalid paid-through date attempt");
    }
    res.status(400).json({ error: "paidThroughAt must be a valid date-time or null" });
    return;
  }

  const providerCustomerId = input.providerCustomerId ?? null;
  const providerSubscriptionId = input.providerSubscriptionId ?? null;
  const learnerId = input.learnerId ?? null;
  const learnerEmail = input.learnerEmail?.trim().toLowerCase() || null;
  const status = input.status.trim().toLowerCase();

  let attemptId: number | null = null;
  try {
    // This insert intentionally happens before reconciliation. It must not be
    // part of the transaction below, because a rollback must not erase the
    // evidence that this authenticated delivery was attempted.
    attemptId = await createDeliveryAttempt(req.body, "received", 202);
    if (attemptId === null) {
      res.status(500).json({ error: "Billing delivery could not be recorded" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      // Serialize delivery of a provider event, including retries racing each
      // other, without exposing the provider secret or payload in logs.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"billing-event:" + input.providerEventId}))`);
      const streamKey = providerSubscriptionId
        ? `${input.provider}:subscription:${providerSubscriptionId}`
        : providerCustomerId
          ? `${input.provider}:customer:${providerCustomerId}`
          : learnerId !== null
            ? `${input.provider}:learner:${learnerId}`
            : `${input.provider}:email:${learnerEmail ?? ""}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"billing-stream:" + streamKey}))`);

      const [duplicate] = await tx
        .select({
          id: subscriptionBillingEventsTable.id,
          userId: subscriptionBillingEventsTable.userId,
        })
        .from(subscriptionBillingEventsTable)
        .where(eq(subscriptionBillingEventsTable.providerEventId, input.providerEventId))
        .limit(1);
      if (duplicate) {
        return {
          response: { accepted: true, duplicate: true, applied: false },
          attempt: {
            outcome: "duplicate",
            httpStatus: 200,
            duplicate: true,
            applied: false,
            userId: duplicate.userId,
          } satisfies AttemptResult,
        };
      }

      let subscription: typeof learnerSubscriptionsTable.$inferSelect | undefined;
      if (providerSubscriptionId) {
        [subscription] = await tx.select().from(learnerSubscriptionsTable).where(and(
          eq(learnerSubscriptionsTable.provider, input.provider),
          eq(learnerSubscriptionsTable.providerSubscriptionId, providerSubscriptionId),
        )).limit(1);
      }

      // A delayed event for a retired provider ID is still attributable to
      // the learner through immutable history, and can therefore be recorded
      // as stale rather than creating a second subscription.
      let ledgerLearnerId: number | null = null;
      if (!subscription && providerSubscriptionId) {
        const [knownLifecycleEvent] = await tx
          .select({ userId: subscriptionBillingEventsTable.userId })
          .from(subscriptionBillingEventsTable)
          .where(and(
            eq(subscriptionBillingEventsTable.provider, input.provider),
            eq(subscriptionBillingEventsTable.providerSubscriptionId, providerSubscriptionId),
          ))
          .limit(1);
        ledgerLearnerId = knownLifecycleEvent?.userId ?? null;
      }
      if (!subscription && providerCustomerId) {
        [subscription] = await tx.select().from(learnerSubscriptionsTable).where(and(
          eq(learnerSubscriptionsTable.provider, input.provider),
          eq(learnerSubscriptionsTable.providerCustomerId, providerCustomerId),
        )).limit(1);
      }

      let learner: typeof usersTable.$inferSelect | undefined;
      if (subscription) {
        [learner] = await tx.select().from(usersTable).where(and(
          eq(usersTable.id, subscription.userId),
          isNull(usersTable.deletedAt),
        )).limit(1);
      } else if (ledgerLearnerId !== null) {
        [learner] = await tx.select().from(usersTable).where(and(
          eq(usersTable.id, ledgerLearnerId),
          isNull(usersTable.deletedAt),
        )).limit(1);
      } else if (learnerId !== null) {
        [learner] = await tx.select().from(usersTable).where(and(
          eq(usersTable.id, learnerId),
          isNull(usersTable.deletedAt),
        )).limit(1);
      } else if (learnerEmail) {
        const learners = await tx.select().from(usersTable).where(and(
          sql`lower(${usersTable.email}) = ${learnerEmail}`,
          isNull(usersTable.deletedAt),
        ));
        if (learners.length > 1) {
          return {
            response: { ambiguousLearner: true as const },
            attempt: {
              outcome: "ambiguous_learner",
              httpStatus: 409,
              errorCode: "ambiguous_learner",
            } satisfies AttemptResult,
          };
        }
        learner = learners[0];
      }
      if (!learner) {
        return {
          response: { missingLearner: true as const },
          attempt: {
            outcome: "missing_learner",
            httpStatus: 404,
            errorCode: "missing_learner",
          } satisfies AttemptResult,
        };
      }
      if (learnerId !== null && learner.id !== learnerId) {
        return {
          response: { invalidLearner: true as const },
          attempt: {
            outcome: "invalid_learner",
            httpStatus: 400,
            errorCode: "invalid_learner",
            userId: learner.id,
          } satisfies AttemptResult,
        };
      }
      if (learnerEmail && learner.email.trim().toLowerCase() !== learnerEmail) {
        return {
          response: { invalidLearner: true as const },
          attempt: {
            outcome: "invalid_learner",
            httpStatus: 400,
            errorCode: "invalid_learner",
            userId: learner.id,
          } satisfies AttemptResult,
        };
      }

      // A first provider event may omit an identifier. Once the learner has
      // been resolved by email, reuse the single learner subscription rather
      // than attempting a second row when identifiers arrive later.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"billing-user:" + learner.id}))`);
      if (providerSubscriptionId) {
        [subscription] = await tx.select().from(learnerSubscriptionsTable).where(and(
          eq(learnerSubscriptionsTable.provider, input.provider),
          eq(learnerSubscriptionsTable.providerSubscriptionId, providerSubscriptionId),
        )).limit(1);
      }
      if (!subscription && providerCustomerId) {
        [subscription] = await tx.select().from(learnerSubscriptionsTable).where(and(
          eq(learnerSubscriptionsTable.provider, input.provider),
          eq(learnerSubscriptionsTable.providerCustomerId, providerCustomerId),
        )).limit(1);
      }
      if (!subscription) {
        [subscription] = await tx.select().from(learnerSubscriptionsTable)
          .where(eq(learnerSubscriptionsTable.userId, learner.id))
          .limit(1);
      }

      // A previously unseen provider ID can establish a later, granting
      // lifecycle and restart its event sequence. An ID already present in
      // immutable history is retired once another ID is canonical; delayed
      // events from it must never move the learner backwards.
      let isNewLifecycle = false;
      let isRetiredLifecycleEvent = false;
      if (subscription && providerSubscriptionId &&
        providerSubscriptionId !== subscription.providerSubscriptionId) {
        const lifecycleEvents = await tx
          .select({ id: subscriptionBillingEventsTable.id })
          .from(subscriptionBillingEventsTable)
          .where(and(
            eq(subscriptionBillingEventsTable.provider, input.provider),
            eq(subscriptionBillingEventsTable.providerSubscriptionId, providerSubscriptionId),
          ))
          .limit(1);
        const isGrantingLifecycleEvent =
          paidThroughAt instanceof Date &&
          !subscriptionStatusEndsAccess(status) &&
          !subscriptionEventClearsPaidThrough(status, input.eventType, paidThroughAt);
        const isLaterThanCurrentLifecycle =
          !subscription.lastEventOccurredAt ||
          occurredAt.getTime() > subscription.lastEventOccurredAt.getTime();
        isNewLifecycle =
          lifecycleEvents.length === 0 &&
          isGrantingLifecycleEvent &&
          isLaterThanCurrentLifecycle;
        isRetiredLifecycleEvent = !isNewLifecycle;
      }

      let createdSubscription = false;
      if (!subscription) {
        [subscription] = await tx.insert(learnerSubscriptionsTable).values({
          userId: learner.id,
          provider: input.provider,
          providerCustomerId,
          providerSubscriptionId,
          status,
          paidThroughAt: paidThroughAt ?? null,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
          lastEventOccurredAt: occurredAt,
          lastEventSequence: input.sequence ?? null,
        }).returning();
        createdSubscription = true;
      }

      const applied = createdSubscription ||
        (isNewLifecycle && !isRetiredLifecycleEvent) ||
        (!isRetiredLifecycleEvent && subscriptionEventIsNewer(subscription, input.sequence, occurredAt));
      await tx.insert(subscriptionBillingEventsTable).values({
        providerEventId: input.providerEventId,
        provider: input.provider,
        providerCustomerId,
        providerSubscriptionId,
        userId: learner.id,
        eventType: input.eventType,
        eventOccurredAt: occurredAt,
        eventSequence: input.sequence ?? null,
        status,
        paidThroughAt: paidThroughAt ?? null,
        paidThroughAtProvided: input.paidThroughAt !== undefined,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? null,
        payload: JSON.stringify(req.body),
      });

      if (applied && subscription.id) {
        const clearsPaidThrough = subscriptionEventClearsPaidThrough(
          status,
          input.eventType,
          paidThroughAt,
        );
        const nextPaidThroughAt = nextSubscriptionPaidThroughAt(
          subscription.paidThroughAt,
          status,
          input.eventType,
          paidThroughAt,
          input.paidThroughAt !== undefined,
        );
        await tx.update(learnerSubscriptionsTable)
          .set({
            providerCustomerId: providerCustomerId ?? subscription.providerCustomerId,
            providerSubscriptionId: providerSubscriptionId ?? subscription.providerSubscriptionId,
            status,
            paidThroughAt: nextPaidThroughAt,
            cancelAtPeriodEnd: input.cancelAtPeriodEnd ??
              (isNewLifecycle || clearsPaidThrough ? false : subscription.cancelAtPeriodEnd),
            lastEventOccurredAt: occurredAt,
            lastEventSequence: input.sequence ?? subscription.lastEventSequence,
            updatedAt: new Date(),
          })
          .where(eq(learnerSubscriptionsTable.id, subscription.id));
      }

      return {
        response: { accepted: true, duplicate: false, applied },
        attempt: {
          outcome: applied ? "accepted" : "stale",
          httpStatus: 200,
          applied,
          userId: learner.id,
        } satisfies AttemptResult,
      };
    });

    try {
      await finaliseDeliveryAttempt(attemptId, result.attempt);
    } catch (attemptError) {
      req.log.warn({ err: attemptError }, "Could not finalise billing delivery attempt");
    }
    triggerSupportNotificationReconciliation();

    if ("missingLearner" in result.response) {
      res.status(404).json({ error: "Learner identity not found" });
      return;
    }
    if ("ambiguousLearner" in result.response) {
      res.status(409).json({ error: "Learner identity is ambiguous; learnerId is required" });
      return;
    }
    if ("invalidLearner" in result.response) {
      res.status(400).json({ error: "Learner identity does not match the supplied email or learnerId" });
      return;
    }
    res.json(result.response);
  } catch (error) {
    if (attemptId !== null) {
      try {
        await db.update(subscriptionDeliveryAttemptsTable)
          .set({ outcome: "internal_error", httpStatus: 500, errorCode: "internal_error" })
          .where(eq(subscriptionDeliveryAttemptsTable.id, attemptId));
        triggerSupportNotificationReconciliation();
      } catch (attemptError) {
        req.log.warn({ err: attemptError }, "Could not finalise failed billing delivery attempt");
      }
    }
    req.log.error({ err: error }, "Failed to record subscription billing event");
    res.status(500).json({ error: "Billing event could not be recorded" });
  }
});

export default router;