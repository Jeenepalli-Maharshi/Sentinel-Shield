import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { alertsTable } from "./alerts";

export const casesTable = pgTable(
  "risk_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alertsTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    priority: varchar("priority", { length: 16 }).notNull(),
    analystNote: text("analyst_note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("risk_cases_user_updated_idx").on(table.userId, table.updatedAt),
    index("risk_cases_user_alert_idx").on(table.userId, table.alertId),
  ],
);

export type Case = typeof casesTable.$inferSelect;
export type NewCase = typeof casesTable.$inferInsert;
