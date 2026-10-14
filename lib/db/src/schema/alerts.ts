import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export type RiskComponents = {
  nameSimilarity: number;
  logoMismatch: number;
  identityMismatch: number;
  behavior: number;
};

export const alertsTable = pgTable(
  "risk_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brandsTable.id, { onDelete: "cascade" }),
    recordType: varchar("record_type", { length: 32 }).notNull(),
    source: varchar("source", { length: 80 }).notNull(),
    targetName: varchar("target_name", { length: 160 }).notNull(),
    targetHandle: varchar("target_handle", { length: 160 }).notNull(),
    targetUrl: varchar("target_url", { length: 2048 }).notNull(),
    claimedDomain: varchar("claimed_domain", { length: 253 }),
    score: integer("score").notNull(),
    severity: varchar("severity", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    components: jsonb("components").$type<RiskComponents>().notNull(),
    evidence: jsonb("evidence")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    summary: text("summary").notNull(),
    reviewNote: text("review_note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("risk_alerts_user_created_idx").on(table.userId, table.createdAt),
    index("risk_alerts_user_brand_idx").on(table.userId, table.brandId),
    index("risk_alerts_user_status_idx").on(table.userId, table.status),
  ],
);

export type Alert = typeof alertsTable.$inferSelect;
export type NewAlert = typeof alertsTable.$inferInsert;
