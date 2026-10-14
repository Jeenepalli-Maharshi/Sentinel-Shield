import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateCaseBody,
  CreateCaseResponse,
  ListCasesQueryParams,
  ListCasesResponse,
  UpdateCaseBody,
  UpdateCaseParams,
  UpdateCaseResponse,
} from "@workspace/api-zod";
import { alertsTable, brandsTable, casesTable, db } from "@workspace/db";
import { getUserId } from "../middlewares/requireAuth";
import { writeRateLimit } from "../middlewares/rateLimits";
import { writeAudit } from "../lib/audit";
import { findUserAlert } from "../lib/risk-records";

const router: IRouter = Router();

function toCaseResponse(
  caseRecord: typeof casesTable.$inferSelect,
  brandName: string,
  targetName: string,
) {
  return {
    ...caseRecord,
    brandName,
    targetName,
    createdAt: caseRecord.createdAt.toISOString(),
    updatedAt: caseRecord.updatedAt.toISOString(),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

router.get("/cases", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = ListCasesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid case filters." });
    return;
  }
  const filters = [eq(casesTable.userId, userId)];
  if (parsed.data.status) filters.push(eq(casesTable.status, parsed.data.status));
  if (parsed.data.search?.trim()) {
    const term = `%${escapeLike(parsed.data.search.trim())}%`;
    const matches = or(
      ilike(casesTable.title, term),
      ilike(alertsTable.targetName, term),
      ilike(brandsTable.name, term),
    );
    if (matches) filters.push(matches);
  }
  const rows = await db
    .select({
      caseRecord: casesTable,
      brandName: brandsTable.name,
      targetName: alertsTable.targetName,
    })
    .from(casesTable)
    .innerJoin(
      alertsTable,
      and(
        eq(alertsTable.id, casesTable.alertId),
        eq(alertsTable.userId, userId),
      ),
    )
    .innerJoin(
      brandsTable,
      and(
        eq(brandsTable.id, alertsTable.brandId),
        eq(brandsTable.userId, userId),
      ),
    )
    .where(and(...filters))
    .orderBy(desc(casesTable.updatedAt))
    .limit(500);
  res.json(
    ListCasesResponse.parse(
      rows.map(({ caseRecord, brandName, targetName }) =>
        toCaseResponse(caseRecord, brandName, targetName),
      ),
    ),
  );
});

router.post("/cases", writeRateLimit, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateCaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the case details and try again." });
    return;
  }
  const alertRow = await findUserAlert(userId, parsed.data.alertId);
  if (!alertRow) {
    res.status(404).json({ error: "Alert not found." });
    return;
  }
  const [caseRecord] = await db
    .insert(casesTable)
    .values({
      userId,
      alertId: alertRow.alert.id,
      title: parsed.data.title.trim(),
      priority: parsed.data.priority,
    })
    .returning();
  if (!caseRecord) {
    res.status(500).json({ error: "Case could not be created." });
    return;
  }
  const [updatedAlert] = await db
    .update(alertsTable)
    .set({ status: "escalated", reviewedAt: new Date() })
    .where(
      and(
        eq(alertsTable.id, alertRow.alert.id),
        eq(alertsTable.userId, userId),
      ),
    )
    .returning({ id: alertsTable.id });
  await writeAudit(userId, "case.created", "case", caseRecord.id, {
    alertId: alertRow.alert.id,
    priority: caseRecord.priority,
  });
  if (updatedAlert) {
    await writeAudit(userId, "alert.escalated", "alert", updatedAlert.id, {
      caseId: caseRecord.id,
    });
  }
  res.status(201).json(
    CreateCaseResponse.parse(
      toCaseResponse(caseRecord, alertRow.brandName, alertRow.alert.targetName),
    ),
  );
});

router.patch(
  "/cases/:caseId",
  writeRateLimit,
  async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const params = UpdateCaseParams.safeParse(req.params);
    const parsed = UpdateCaseBody.safeParse(req.body);
    if (
      !params.success ||
      !parsed.success ||
      Object.keys(parsed.data ?? {}).length === 0
    ) {
      res.status(400).json({ error: "Provide a valid case update." });
      return;
    }
    const updates = {
      status: parsed.data.status,
      analystNote: parsed.data.analystNote?.trim(),
      updatedAt: new Date(),
    };
    const [caseRecord] = await db
      .update(casesTable)
      .set(updates)
      .where(
        and(
          eq(casesTable.id, params.data.caseId),
          eq(casesTable.userId, userId),
        ),
      )
      .returning();
    if (!caseRecord) {
      res.status(404).json({ error: "Case not found." });
      return;
    }
    const alertRow = await findUserAlert(userId, caseRecord.alertId);
    if (!alertRow) {
      res.status(404).json({ error: "Related alert not found." });
      return;
    }
    await writeAudit(userId, "case.updated", "case", caseRecord.id, {
      status: caseRecord.status,
    });
    res.json(
      UpdateCaseResponse.parse(
        toCaseResponse(
          caseRecord,
          alertRow.brandName,
          alertRow.alert.targetName,
        ),
      ),
    );
  },
);

export default router;
