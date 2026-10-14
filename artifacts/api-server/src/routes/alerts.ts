import { and, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetAlertParams,
  ListAlertsQueryParams,
  ListAlertsResponse,
  ReviewAlertBody,
  ReviewAlertParams,
  ReviewAlertResponse,
} from "@workspace/api-zod";
import { alertsTable, db } from "@workspace/db";
import { writeRateLimit } from "../middlewares/rateLimits";
import { getUserId } from "../middlewares/requireAuth";
import { writeAudit } from "../lib/audit";
import {
  findUserAlert,
  listUserAlerts,
  parseAlertResponse,
} from "../lib/risk-records";

const router: IRouter = Router();

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

router.get("/alerts", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = ListAlertsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid alert filters." });
    return;
  }
  const filters = [eq(alertsTable.userId, userId)];
  if (parsed.data.brandId) {
    filters.push(eq(alertsTable.brandId, parsed.data.brandId));
  }
  if (parsed.data.status) {
    filters.push(eq(alertsTable.status, parsed.data.status));
  }
  if (parsed.data.severity) {
    filters.push(eq(alertsTable.severity, parsed.data.severity));
  }
  if (parsed.data.search?.trim()) {
    const search = `%${escapeLike(parsed.data.search.trim())}%`;
    const searchMatch = or(
      ilike(alertsTable.targetName, search),
      ilike(alertsTable.targetHandle, search),
      ilike(alertsTable.source, search),
    );
    if (searchMatch) filters.push(searchMatch);
  }
  const all = await listUserAlerts(userId);
  const hasFilters =
    parsed.data.brandId ||
    parsed.data.status ||
    parsed.data.severity ||
    parsed.data.search?.trim();
  if (!hasFilters) {
    res.json(ListAlertsResponse.parse(all));
    return;
  }
  const rows = await db
    .select({ id: alertsTable.id })
    .from(alertsTable)
    .where(and(...filters));
  const matchingIds = new Set(rows.map((row) => row.id));
  res.json(
    ListAlertsResponse.parse(all.filter((alert) => matchingIds.has(alert.id))),
  );
});

router.get("/alerts/:alertId", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid alert identifier." });
    return;
  }
  const row = await findUserAlert(userId, params.data.alertId);
  if (!row) {
    res.status(404).json({ error: "Alert not found." });
    return;
  }
  res.json(parseAlertResponse(row.alert, row.brandName));
});

router.patch(
  "/alerts/:alertId/review",
  writeRateLimit,
  async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const params = ReviewAlertParams.safeParse(req.params);
    const parsed = ReviewAlertBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid review update." });
      return;
    }
    const existing = await findUserAlert(userId, params.data.alertId);
    if (!existing) {
      res.status(404).json({ error: "Alert not found." });
      return;
    }
    const [updated] = await db
      .update(alertsTable)
      .set({
        status: parsed.data.status,
        reviewNote:
          parsed.data.note === undefined ? existing.alert.reviewNote : parsed.data.note.trim(),
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(alertsTable.id, params.data.alertId),
          eq(alertsTable.userId, userId),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Alert not found." });
      return;
    }
    await writeAudit(userId, "alert.reviewed", "alert", updated.id, {
      status: updated.status,
    });
    res.json(
      ReviewAlertResponse.parse(
        parseAlertResponse(updated, existing.brandName),
      ),
    );
  },
);

export default router;
