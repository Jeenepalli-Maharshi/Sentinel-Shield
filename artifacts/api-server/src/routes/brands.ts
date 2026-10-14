import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateBrandBody,
  CreateBrandResponse,
  DeleteBrandParams,
  GetBrandParams,
  GetBrandResponse,
  ListBrandsResponse,
  UpdateBrandBody,
  UpdateBrandParams,
  UpdateBrandResponse,
} from "@workspace/api-zod";
import { brandsTable, db } from "@workspace/db";
import { writeRateLimit } from "../middlewares/rateLimits";
import { getUserId } from "../middlewares/requireAuth";
import { writeAudit } from "../lib/audit";
import { findUserBrand, toBrandResponse } from "../lib/risk-records";
import { validateDomain, validateSubmittedHttpsUrl } from "../lib/risk-engine";

const router: IRouter = Router();

function cleanList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function cleanLogoUrl(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null || value.trim() === "") return value;
  return validateSubmittedHttpsUrl(value);
}

router.get("/brands", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const brands = await db
    .select()
    .from(brandsTable)
    .where(eq(brandsTable.userId, userId))
    .orderBy(desc(brandsTable.createdAt));
  res.json(ListBrandsResponse.parse(brands.map(toBrandResponse)));
});

router.post("/brands", writeRateLimit, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the brand details and try again." });
    return;
  }
  let officialDomain: string;
  let logoUrl: string | null | undefined;
  try {
    officialDomain = validateDomain(parsed.data.officialDomain);
    logoUrl = cleanLogoUrl(parsed.data.logoUrl);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid domain or logo URL.",
    });
    return;
  }
  const [brand] = await db
    .insert(brandsTable)
    .values({
      userId,
      name: parsed.data.name.trim(),
      logoUrl: logoUrl ?? null,
      officialDomain,
      socialHandles: cleanList(parsed.data.socialHandles),
      appIdentifiers: cleanList(parsed.data.appIdentifiers),
    })
    .returning();
  if (!brand) {
    res.status(500).json({ error: "Brand could not be saved." });
    return;
  }
  await writeAudit(userId, "brand.created", "brand", brand.id);
  res.status(201).json(CreateBrandResponse.parse(toBrandResponse(brand)));
});

router.get("/brands/:brandId", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid brand identifier." });
    return;
  }
  const brand = await findUserBrand(userId, params.data.brandId);
  if (!brand) {
    res.status(404).json({ error: "Brand not found." });
    return;
  }
  res.json(GetBrandResponse.parse(toBrandResponse(brand)));
});

router.patch("/brands/:brandId", writeRateLimit, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateBrandParams.safeParse(req.params);
  const parsed = UpdateBrandBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    res.status(400).json({ error: "Provide at least one valid brand field." });
    return;
  }
  let officialDomain: string | undefined;
  let logoUrl: string | null | undefined;
  try {
    officialDomain =
      parsed.data.officialDomain === undefined
        ? undefined
        : validateDomain(parsed.data.officialDomain);
    logoUrl = cleanLogoUrl(parsed.data.logoUrl);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid domain or logo URL.",
    });
    return;
  }
  const updates = {
    name: parsed.data.name?.trim(),
    logoUrl,
    officialDomain,
    socialHandles:
      parsed.data.socialHandles === undefined
        ? undefined
        : cleanList(parsed.data.socialHandles),
    appIdentifiers:
      parsed.data.appIdentifiers === undefined
        ? undefined
        : cleanList(parsed.data.appIdentifiers),
  };
  const [brand] = await db
    .update(brandsTable)
    .set(updates)
    .where(
      and(
        eq(brandsTable.userId, userId),
        eq(brandsTable.id, params.data.brandId),
      ),
    )
    .returning();
  if (!brand) {
    res.status(404).json({ error: "Brand not found." });
    return;
  }
  await writeAudit(userId, "brand.updated", "brand", brand.id);
  res.json(UpdateBrandResponse.parse(toBrandResponse(brand)));
});

router.delete(
  "/brands/:brandId",
  writeRateLimit,
  async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const params = DeleteBrandParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid brand identifier." });
      return;
    }
    const [deleted] = await db
      .delete(brandsTable)
      .where(
        and(
          eq(brandsTable.userId, userId),
          eq(brandsTable.id, params.data.brandId),
        ),
      )
      .returning({ id: brandsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Brand not found." });
      return;
    }
    await writeAudit(userId, "brand.deleted", "brand", deleted.id);
    res.sendStatus(204);
  },
);

export default router;
