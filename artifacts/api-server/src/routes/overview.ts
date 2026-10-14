import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetOverviewResponse } from "@workspace/api-zod";
import {
  alertsTable,
  brandsTable,
  casesTable,
  db,
} from "@workspace/db";
import { getUserId } from "../middlewares/requireAuth";
import { listUserAlerts } from "../lib/risk-records";

const router: IRouter = Router();

router.get("/overview", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [brandResult] = await db
    .select({ value: count() })
    .from(brandsTable)
    .where(eq(brandsTable.userId, userId));
  const [openResult] = await db
    .select({ value: count() })
    .from(alertsTable)
    .where(
      and(
        eq(alertsTable.userId, userId),
        inArray(alertsTable.status, ["open", "reviewing"]),
      ),
    );
  const [highResult] = await db
    .select({ value: count() })
    .from(alertsTable)
    .where(
      and(
        eq(alertsTable.userId, userId),
        eq(alertsTable.severity, "high"),
        inArray(alertsTable.status, ["open", "reviewing"]),
      ),
    );
  const [caseResult] = await db
    .select({ value: count() })
    .from(casesTable)
    .where(
      and(
        eq(casesTable.userId, userId),
        inArray(casesTable.status, ["open", "investigating"]),
      ),
    );
  const allAlerts = await listUserAlerts(userId);
  const recentAlerts = allAlerts.slice(0, 5);
  const result = GetOverviewResponse.parse({
    brandCount: brandResult?.value ?? 0,
    openAlerts: openResult?.value ?? 0,
    highRiskAlerts: highResult?.value ?? 0,
    activeCases: caseResult?.value ?? 0,
    recentAlerts,
    severityCounts: {
      high: allAlerts.filter(
        (alert) =>
          alert.severity === "high" &&
          (alert.status === "open" || alert.status === "reviewing"),
      ).length,
      medium: allAlerts.filter(
        (alert) =>
          alert.severity === "medium" &&
          (alert.status === "open" || alert.status === "reviewing"),
      ).length,
      low: allAlerts.filter(
        (alert) =>
          alert.severity === "low" &&
          (alert.status === "open" || alert.status === "reviewing"),
      ).length,
    },
  });
  res.json(result);
});

export default router;
