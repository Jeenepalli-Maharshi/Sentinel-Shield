import { Router, type IRouter } from "express";
import {
  ImportSampleDatasetBody,
  ImportSampleDatasetResponse,
  SubmitMonitoringRecordBody,
  SubmitMonitoringRecordResponse,
} from "@workspace/api-zod";
import { getUserId } from "../middlewares/requireAuth";
import { writeRateLimit } from "../middlewares/rateLimits";
import { writeAudit } from "../lib/audit";
import { findUserBrand, createScoredAlert } from "../lib/risk-records";
import {
  validateDomain,
  validateSubmittedHttpsUrl,
  type RiskRecord,
} from "../lib/risk-engine";

const router: IRouter = Router();

function brandSlug(name: string): string {
  return name
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "brand";
}

router.post(
  "/monitoring/import-sample",
  writeRateLimit,
  async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const parsed = ImportSampleDatasetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Select a valid brand first." });
      return;
    }
    const brand = await findUserBrand(userId, parsed.data.brandId);
    if (!brand) {
      res.status(404).json({ error: "Brand not found." });
      return;
    }
    const slug = brandSlug(brand.name);
    const firstHandle = brand.socialHandles[0] ?? `official_${slug}`;
    const sampleRecords: RiskRecord[] = [
      {
        recordType: "social_profile",
        source: "Synthetic social profile",
        targetName: `${brand.name} Account Recovery`,
        targetHandle: `${slug}_account_help`,
        targetUrl: `https://profiles.example/${slug}_account_help`,
        claimedDomain: `verify-${slug}.example`,
        logoObservation: "mismatch",
        behavior: 88,
      },
      {
        recordType: "app_listing",
        source: "Synthetic app listing",
        targetName: `${brand.name} Secure Wallet`,
        targetHandle: `com.unverified.${slug}`,
        targetUrl: `https://apps.example/listing/${slug}`,
        claimedDomain: `support-${slug}.example`,
        logoObservation: "mismatch",
        behavior: 76,
      },
      {
        recordType: "social_profile",
        source: "Synthetic comparison profile",
        targetName: `${brand.name} Community`,
        targetHandle: firstHandle,
        targetUrl: `https://profiles.example/${firstHandle.replace(/^@/, "")}`,
        claimedDomain: brand.officialDomain,
        logoObservation: "match",
        behavior: 8,
      },
    ];
    const alerts = [];
    for (const record of sampleRecords) {
      alerts.push(await createScoredAlert(userId, brand, record));
    }
    await writeAudit(userId, "monitoring.sample_imported", "brand", brand.id, {
      imported: alerts.length,
    });
    res
      .status(201)
      .json(ImportSampleDatasetResponse.parse({ imported: alerts.length, alerts }));
  },
);

router.post(
  "/monitoring/submit",
  writeRateLimit,
  async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const parsed = SubmitMonitoringRecordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Check the submitted record and try again." });
      return;
    }
    const brand = await findUserBrand(userId, parsed.data.brandId);
    if (!brand) {
      res.status(404).json({ error: "Brand not found." });
      return;
    }
    let targetUrl: string;
    let claimedDomain: string | null = null;
    try {
      targetUrl = validateSubmittedHttpsUrl(parsed.data.targetUrl);
      if (parsed.data.claimedDomain?.trim()) {
        claimedDomain = validateDomain(parsed.data.claimedDomain);
      }
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid URL or domain.",
      });
      return;
    }

    const record: RiskRecord = {
      ...parsed.data,
      source: parsed.data.source.trim(),
      targetName: parsed.data.targetName.trim(),
      targetHandle: parsed.data.targetHandle.trim(),
      targetUrl,
      claimedDomain,
    };
    const alert = await createScoredAlert(userId, brand, record);
    await writeAudit(userId, "monitoring.record_submitted", "alert", alert.id, {
      brandId: brand.id,
      recordType: alert.recordType,
    });
    res
      .status(201)
      .json(SubmitMonitoringRecordResponse.parse(alert));
  },
);

export default router;
