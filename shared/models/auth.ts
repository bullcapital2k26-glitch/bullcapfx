import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  ibCode: text("ib_code"),
  onboarded: boolean("onboarded").default(false),
  notifPriceAlerts: boolean("notif_price_alerts").default(true),
  notifOrderUpdates: boolean("notif_order_updates").default(true),
  notifMarginWarnings: boolean("notif_margin_warnings").default(true),
  notifPromotions: boolean("notif_promotions").default(false),
  prefTheme: varchar("pref_theme").default("dark"),
  prefCurrency: varchar("pref_currency").default("USD"),
  prefLanguage: varchar("pref_language").default("en"),
  prefChartType: varchar("pref_chart_type").default("candlestick"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
