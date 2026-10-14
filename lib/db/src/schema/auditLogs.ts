import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable(
  "risk_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    resourceType: varchar("resource_type", { length: 40 }).notNull(),
    resourceId: varchar("resource_id", { length: 64 }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("risk_audit_user_created_idx").on(table.userId, table.createdAt),
    index("risk_audit_resource_idx").on(table.resourceType, table.resourceId),
  ],
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
