import type { Brand } from "@workspace/db";
import type { RiskComponents } from "@workspace/db";
import { isIP } from "node:net";

export type LogoObservation = "match" | "mismatch" | "unknown";

export type RiskRecord = {
  recordType: "social_profile" | "app_listing";
  source: string;
  targetName: string;
  targetHandle: string;
  targetUrl: string;
  claimedDomain: string | null;
  logoObservation: LogoObservation;
  behavior: number;
};

export type ScoredRisk = {
  score: number;
  severity: "low" | "medium" | "high";
  components: RiskComponents;
  evidence: string[];
  summary: string;
};

function normalizeIdentity(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/^@/, "");
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/, 1)[0] ?? "";
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column] ?? 0;
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      previous[column] = Math.min(
        above + 1,
        (previous[column - 1] ?? 0) + 1,
        diagonal + cost,
      );
      diagonal = above;
    }
  }
  return previous[right.length] ?? Math.max(left.length, right.length);
}

function nameSimilarity(brandName: string, targetName: string): number {
  const normalizedBrand = normalizeIdentity(brandName).replace(/[^a-z0-9]/g, "");
  const normalizedTarget = normalizeIdentity(targetName).replace(
    /[^a-z0-9]/g,
    "",
  );
  if (!normalizedBrand || !normalizedTarget) return 0;
  const distance = levenshteinDistance(normalizedBrand, normalizedTarget);
  return Math.round(
    100 * (1 - distance / Math.max(normalizedBrand.length, normalizedTarget.length)),
  );
}

function domainIsPublic(hostname: string): boolean {
  const host = hostname.toLocaleLowerCase("en-US").replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".test")
  ) {
    return false;
  }
  if (isIP(host) === 4) {
    const [a, b] = host.split(".").map(Number);
    if (
      a === undefined ||
      b === undefined ||
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    ) {
      return false;
    }
  }
  if (isIP(host) === 6) {
    const normalized = host.toLowerCase();
    if (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    ) {
      return false;
    }
  }
  return true;
}

export function validateSubmittedHttpsUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid HTTPS URL.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !domainIsPublic(parsed.hostname)
  ) {
    throw new Error("Only public HTTPS URLs are accepted.");
  }
  return parsed.toString();
}

export function validateDomain(rawDomain: string): string {
  const domain = normalizeDomain(rawDomain);
  if (
    !domain ||
    domain.length > 253 ||
    domain.includes("@") ||
    domain.includes(":") ||
    !domain.includes(".") ||
    !domain
      .split(".")
      .every(
        (label) =>
          label.length > 0 &&
          label.length <= 63 &&
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
      ) ||
    !domainIsPublic(domain)
  ) {
    throw new Error("Enter a public domain name without a path or credentials.");
  }
  return domain;
}

export function scoreRisk(brand: Brand, record: RiskRecord): ScoredRisk {
  const nameScore = nameSimilarity(brand.name, record.targetName);
  const logoMismatch =
    record.logoObservation === "mismatch"
      ? 100
      : record.logoObservation === "match"
        ? 0
        : 0;

  const identityChecks: boolean[] = [];
  const expectedIdentity =
    record.recordType === "social_profile"
      ? brand.socialHandles
      : brand.appIdentifiers;
  if (expectedIdentity.length > 0 && record.targetHandle.trim()) {
    const handle = normalizeIdentity(record.targetHandle);
    identityChecks.push(
      !expectedIdentity.some((item) => normalizeIdentity(item) === handle),
    );
  }
  if (record.claimedDomain) {
    const submittedDomain = normalizeDomain(record.claimedDomain);
    const officialDomain = normalizeDomain(brand.officialDomain);
    identityChecks.push(
      submittedDomain !== officialDomain &&
        !submittedDomain.endsWith(`.${officialDomain}`),
    );
  }
  const identityMismatch = identityChecks.length
    ? Math.round(
        (100 * identityChecks.filter(Boolean).length) / identityChecks.length,
      )
    : 0;

  const components: RiskComponents = {
    nameSimilarity: nameScore,
    logoMismatch,
    identityMismatch,
    behavior: record.behavior,
  };
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        nameScore * 0.15 +
          logoMismatch * 0.25 +
          identityMismatch * 0.35 +
          record.behavior * 0.25,
      ),
    ),
  );
  const severity: ScoredRisk["severity"] =
    score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const evidence: string[] = [];
  if (nameScore >= 55) {
    evidence.push(`Target name is ${nameScore}% similar to the registered brand name.`);
  }
  if (record.logoObservation === "mismatch") {
    evidence.push("The submitted observation marks the logo as a mismatch.");
  } else if (record.logoObservation === "match") {
    evidence.push("The submitted observation marks the logo as matching.");
  } else {
    evidence.push("Logo similarity is unknown and did not increase the risk score.");
  }
  if (identityMismatch > 0) {
    evidence.push("One or more registered handle, app identifier, or claimed domain values do not match.");
  } else if (identityChecks.length > 0) {
    evidence.push("The supplied identity values match the registered brand profile.");
  } else {
    evidence.push("No registered handle or claimed-domain comparison was available.");
  }
  if (record.claimedDomain) {
    evidence.push(`Submitted linked domain: ${record.claimedDomain}.`);
  }
  evidence.push(
    `Analyst-observed behavior indicator: ${record.behavior}/100.`,
  );
  evidence.push("This score prioritizes review and does not establish fraud.");

  return {
    score,
    severity,
    components,
    evidence,
    summary:
      score >= 70
        ? "Multiple identity signals warrant prompt analyst review."
        : score >= 40
          ? "Some identity signals differ; review the evidence before escalation."
          : "Limited risk signals were observed; similarity alone is not proof.",
  };
}
