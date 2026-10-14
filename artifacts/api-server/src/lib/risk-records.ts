import { and, desc, eq } from "drizzle-orm";
import {
  alertsTable,
  brandsTable,
  db,
  type Brand,
  type NewAlert,
} from "@workspace/db";
import {
  GetAlertResponse,
  ListAlertsResponseItem,
  ListBrandsResponseItem,
} from "@workspace/api-zod";
import { scoreRisk, type RiskRecord } from "./risk-engine";

export function toBrandResponse(brand: Brand) {
  return ListBrandsResponseItem.parse({
    ...brand,
    createdAt: brand.createdAt.toISOString(),
  });
}

export async function findUserBrand(
  userId: string,
  brandId: string,
): Promise<Brand | undefined> {
  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.userId, userId), eq(brandsTable.id, brandId)))
    .limit(1);
  return brand;
}

export async function createScoredAlert(
  userId: string,
  brand: Brand,
  record: RiskRecord,
) {
  const scored = scoreRisk(brand, record);
  const values: NewAlert = {
    userId,
    brandId: brand.id,
    recordType: record.recordType,
    source: record.source.trim(),
    targetName: record.targetName.trim(),
    targetHandle: record.targetHandle.trim(),
    targetUrl: record.targetUrl,
    claimedDomain: record.claimedDomain,
    score: scored.score,
    severity: scored.severity,
    status: "open",
    components: scored.components,
    evidence: scored.evidence,
    summary: scored.summary,
  };
  const [alert] = await db.insert(alertsTable).values(values).returning();
  if (!alert) throw new Error("Alert could not be created.");
  return toAlertResponse(alert, brand.name);
}

export function toAlertResponse(
  alert: typeof alertsTable.$inferSelect,
  brandName: string,
) {
  return ListAlertsResponseItem.parse({
    ...alert,
    brandName,
    createdAt: alert.createdAt.toISOString(),
    reviewedAt: alert.reviewedAt?.toISOString() ?? null,
  });
}

export async function findUserAlert(userId: string, alertId: string) {
  const [row] = await db
    .select({ alert: alertsTable, brandName: brandsTable.name })
    .from(alertsTable)
    .innerJoin(
      brandsTable,
      and(
        eq(brandsTable.id, alertsTable.brandId),
        eq(brandsTable.userId, userId),
      ),
    )
    .where(and(eq(alertsTable.id, alertId), eq(alertsTable.userId, userId)))
    .limit(1);
  return row;
}

export async function listUserAlerts(userId: string) {
  const rows = await db
    .select({ alert: alertsTable, brandName: brandsTable.name })
    .from(alertsTable)
    .innerJoin(
      brandsTable,
      and(
        eq(brandsTable.id, alertsTable.brandId),
        eq(brandsTable.userId, userId),
      ),
    )
    .where(eq(alertsTable.userId, userId))
    .orderBy(desc(alertsTable.createdAt))
    .limit(500);
  return rows.map(({ alert, brandName }) =>
    toAlertResponse(alert, brandName),
  );
}

export function parseAlertResponse(
  alert: typeof alertsTable.$inferSelect,
  brandName: string,
) {
  return GetAlertResponse.parse({
    ...alert,
    brandName,
    createdAt: alert.createdAt.toISOString(),
    reviewedAt: alert.reviewedAt?.toISOString() ?? null,
  });
}
