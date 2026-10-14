import { db, auditLogsTable } from "@workspace/db";

export async function writeAudit(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  await db.insert(auditLogsTable).values({
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
  });
}
