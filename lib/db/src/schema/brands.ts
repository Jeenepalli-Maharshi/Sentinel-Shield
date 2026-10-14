import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const brandsTable = pgTable(
  "risk_brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    logoUrl: varchar("logo_url", { length: 2048 }),
    officialDomain: varchar("official_domain", { length: 253 }).notNull(),
    socialHandles: jsonb("social_handles")
      .$type<string[]>()
      .notNull()
      .default([]),
    appIdentifiers: jsonb("app_identifiers")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("risk_brands_user_idx").on(table.userId)],
);

export type Brand = typeof brandsTable.$inferSelect;
export type NewBrand = typeof brandsTable.$inferInsert;
