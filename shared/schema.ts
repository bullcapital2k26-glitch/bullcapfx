import { pgTable, text, serial, integer, boolean, timestamp, numeric, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("USD"),
  leverage: integer("leverage").notNull().default(100),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  currentPrice: doublePrecision("current_price").notNull(),
  change24h: doublePrecision("change_24h").default(0),
  image: text("image"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  type: text("type").notNull(),
  orderType: text("order_type").notNull().default("market"),
  lotSize: doublePrecision("lot_size").notNull(),
  price: doublePrecision("price").notNull(),
  triggerPrice: doublePrecision("trigger_price"),
  status: text("status").notNull().default("open"),
  total: doublePrecision("total").notNull(),
  stopLoss: doublePrecision("stop_loss"),
  takeProfit: doublePrecision("take_profit"),
  pnl: doublePrecision("pnl"),
  closePrice: doublePrecision("close_price"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  lotSize: doublePrecision("lot_size").notNull(),
  averageEntryPrice: doublePrecision("average_entry_price").notNull(),
});

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  processedBy: text("processed_by").references(() => users.id),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  senderId: text("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isAdmin: boolean("is_admin").default(false),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loginHistory = pgTable("login_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ibCodes = pgTable("ib_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  partnerName: text("partner_name").notNull(),
  commissionRate: numeric("commission_rate", { precision: 8, scale: 2 }).notNull().default("5.00"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ibReferrals = pgTable("ib_referrals", {
  id: serial("id").primaryKey(),
  ibCode: text("ib_code").notNull(),
  referredUserId: text("referred_user_id").notNull().references(() => users.id),
  tradeVolume: doublePrecision("trade_volume").notNull().default(0),
  commissionEarned: numeric("commission_earned", { precision: 12, scale: 2 }).notNull().default("0.00"),
});

export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  documentType: text("document_type").notNull(),
  fullName: text("full_name").notNull(),
  documentNumber: text("document_number").notNull(),
  frontImageData: text("front_image_data").notNull(),
  backImageData: text("back_image_data").notNull(),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: text("verified_by"),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const tradeControls = pgTable("trade_controls", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tradeId: integer("trade_id").notNull().references(() => orders.id),
  forceProfitable: boolean("force_profitable").notNull().default(false),
  profitSpeed: text("profit_speed").notNull().default("normal"),
  targetPips: integer("target_pips").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTradeControlSchema = createInsertSchema(tradeControls).omit({ id: true, createdAt: true });
export type TradeControl = typeof tradeControls.$inferSelect;
export type InsertTradeControl = typeof insertTradeControlSchema._type;

export const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({ id: true, submittedAt: true, verifiedAt: true, verifiedBy: true, adminNote: true, status: true });
export type KycDocument = typeof kycDocuments.$inferSelect;

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, total: true, pnl: true, closedAt: true });
export const insertPositionSchema = createInsertSchema(positions).omit({ id: true });
export const insertWatchlistSchema = createInsertSchema(watchlist).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, processedAt: true, processedBy: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });

export type Account = typeof accounts.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type IbReferral = typeof ibReferrals.$inferSelect;
export type LoginHistoryEntry = typeof loginHistory.$inferSelect;
export type IbCode = typeof ibCodes.$inferSelect;

export type CreateOrderRequest = {
  productId: number;
  type: "buy" | "sell";
  orderType?: "market" | "buy_limit" | "sell_limit" | "buy_stop" | "sell_stop";
  lotSize: number;
  triggerPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
};
export type AddToWatchlistRequest = { productId: number };
export type CreateTransactionRequest = { type: string; amount: number; note?: string };

export type PortfolioResponse = {
  account: Account;
  positions: (Position & { product: Product })[];
  totalValue: number;
  totalPnL: number;
};

export const UNITS_PER_LOT = 100000;

export { getInstrument, getAllInstruments } from "./instrumentRegistry";

import { getInstrument } from "./instrumentRegistry";

export function getContractSize(symbol: string): number {
  return getInstrument(symbol).contractSize;
}
