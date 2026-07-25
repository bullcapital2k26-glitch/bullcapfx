import { db } from "./db";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import {
  users, accounts, products, orders, positions, watchlist, transactions, conversations, messages, ibReferrals, loginHistory, ibCodes, kycDocuments, tradeControls,
  type User, type UpsertUser, type Account, type Product, type Order, type Position,
  type Transaction, type Conversation, type Message, type IbReferral, type LoginHistoryEntry, type IbCode,
  type KycDocument, type TradeControl, type InsertTradeControl, type CreateOrderRequest, getContractSize
} from "@shared/schema";
import { sessions, users } from "@shared/models/auth";
import { authStorage } from "./replit_integrations/auth";
import { calculatePnL, getMarginUSD } from "./utils/pipCalculator";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  updateUserIbCode(userId: string, ibCode: string): Promise<void>;
  markOnboarded(userId: string): Promise<void>;
  updateUserPreferences(userId: string, prefs: Partial<Pick<User, 'notifPriceAlerts' | 'notifOrderUpdates' | 'notifMarginWarnings' | 'notifPromotions' | 'prefTheme' | 'prefCurrency' | 'prefLanguage' | 'prefChartType'>>): Promise<void>;
  updateUserPassword(userId: string, newPasswordHash: string): Promise<void>;

  getAccount(userId: string): Promise<Account>;
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getOrders(userId: string): Promise<(Order & { product: Product })[]>;
  getOpenOrders(userId: string): Promise<(Order & { product: Product })[]>;
  getAllOpenOrders(): Promise<(Order & { product: Product })[]>;
  getAllPendingOrders(): Promise<(Order & { product: Product })[]>;
  getPositions(userId: string): Promise<(Position & { product: Product })[]>;
  getWatchlist(userId: string): Promise<Product[]>;
  addToWatchlist(userId: string, productId: number): Promise<void>;
  removeFromWatchlist(userId: string, productId: number): Promise<void>;
  executeOrder(userId: string, order: CreateOrderRequest, explicitPrice?: number): Promise<Order>;
  executePendingOrder(orderId: number, executionPrice: number): Promise<Order>;
  closeOrder(orderId: number, closePrice: number, reason: string): Promise<Order>;
  updateOrderSlTp(orderId: number, stopLoss: number | null, takeProfit: number | null): Promise<Order>;
  cancelOrder(orderId: number): Promise<Order>;
  seedProducts(): Promise<void>;

  createIbReferral(ibCode: string, userId: string): Promise<void>;
  updateIbCommission(userId: string, lotSize: number): Promise<void>;
  getAllIbStats(): Promise<{ ibCode: string; referredUsers: number; totalVolume: number; totalCommission: string }[]>;

  recordLogin(userId: string, ipAddress: string | null, userAgent: string | null): Promise<void>;
  getLoginHistory(userId: string, limit?: number): Promise<LoginHistoryEntry[]>;
  getUserSessions(userId: string): Promise<{ sid: string; expire: Date; }[]>;
  deleteSession(sid: string): Promise<void>;

  createIbCode(code: string, partnerName: string, commissionRate: string): Promise<IbCode>;
  getAllIbCodes(): Promise<IbCode[]>;
  getIbCodeByCode(code: string): Promise<IbCode | undefined>;
  updateIbCode(id: number, updates: Partial<Pick<IbCode, 'partnerName' | 'commissionRate' | 'isActive'>>): Promise<IbCode>;
  deleteIbCode(id: number): Promise<void>;

  createTransaction(userId: string, type: string, amount: number, note?: string): Promise<Transaction>;
  getUserTransactions(userId: string): Promise<Transaction[]>;

  getAllUsers(): Promise<(User & { account?: Account })[]>;
  getUserDetail(userId: string): Promise<{ user: User; account: Account; orders: (Order & { product: Product })[]; positions: (Position & { product: Product })[] } | null>;
  adjustUserBalance(userId: string, amount: number, adminId: string): Promise<Account>;
  getAllTransactions(): Promise<(Transaction & { user?: User })[]>;
  updateTransactionStatus(id: number, status: string, adminId: string): Promise<Transaction>;
  getAllOrders(): Promise<(Order & { product: Product; user?: User })[]>;
  getAdminStats(): Promise<{ userCount: number; totalBalance: number; pendingTransactions: number; activePositions: number }>;

  createConversation(userId: string, subject: string): Promise<Conversation>;
  getUserConversations(userId: string): Promise<(Conversation & { user?: User; lastMessage?: string })[]>;
  getAllConversations(): Promise<(Conversation & { user?: User; lastMessage?: string })[]>;
  getMessages(conversationId: number): Promise<Message[]>;
  sendMessage(conversationId: number, senderId: string, content: string, isAdmin: boolean, attachmentUrl?: string, attachmentName?: string): Promise<Message>;
  closeConversation(conversationId: number): Promise<Conversation>;

  submitKyc(userId: string, data: { documentType: string; fullName: string; documentNumber: string; frontImageData: string; backImageData: string }): Promise<KycDocument>;
  getKycByUser(userId: string): Promise<KycDocument | undefined>;
  getAllKyc(): Promise<(KycDocument & { user?: User })[]>;
  updateKycStatus(id: number, status: string, adminId: string, adminNote?: string): Promise<KycDocument>;

  upsertTradeControl(data: InsertTradeControl): Promise<TradeControl>;
  getTradeControlByTradeId(tradeId: number): Promise<TradeControl | undefined>;
  getAllActiveTradeControls(): Promise<TradeControl[]>;
  deactivateTradeControl(tradeId: number): Promise<void>;
  listTradeControls(): Promise<(TradeControl & { user?: User; order?: Order & { product?: Product } })[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return authStorage.getUser(id);
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }
  async createUser(user: UpsertUser): Promise<User> {
    return authStorage.upsertUser(user);
  }
  async updateUserIbCode(userId: string, ibCode: string): Promise<void> {
    await db.update(users).set({ ibCode }).where(eq(users.id, userId));
  }
  async markOnboarded(userId: string): Promise<void> {
    await db.update(users).set({ onboarded: true }).where(eq(users.id, userId));
  }

  async updateUserPreferences(userId: string, prefs: Partial<Pick<User, 'notifPriceAlerts' | 'notifOrderUpdates' | 'notifMarginWarnings' | 'notifPromotions' | 'prefTheme' | 'prefCurrency' | 'prefLanguage' | 'prefChartType'>>): Promise<void> {
    await db.update(users).set(prefs).where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, newPasswordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));
  }

  async getAccount(userId: string): Promise<Account> {
    let [account] = await db.select().from(accounts).where(eq(accounts.userId, userId));
    if (!account) {
      [account] = await db.insert(accounts).values({ userId }).returning();
    }
    return account;
  }

  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(products.symbol);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getOrders(userId: string): Promise<(Order & { product: Product })[]> {
    const rows = await db.select()
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
    return rows.map(row => ({ ...row.orders, product: row.products }));
  }

  async getOpenOrders(userId: string): Promise<(Order & { product: Product })[]> {
    const rows = await db.select()
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(and(eq(orders.userId, userId), eq(orders.status, "open")))
      .orderBy(desc(orders.createdAt));
    return rows.map(row => ({ ...row.orders, product: row.products }));
  }

  async getAllOpenOrders(): Promise<(Order & { product: Product })[]> {
    const rows = await db.select()
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.status, "open"))
      .orderBy(desc(orders.createdAt));
    return rows.map(row => ({ ...row.orders, product: row.products }));
  }

  async getAllPendingOrders(): Promise<(Order & { product: Product })[]> {
    const rows = await db.select()
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.status, "pending"))
      .orderBy(desc(orders.createdAt));
    return rows.map(row => ({ ...row.orders, product: row.products }));
  }

  async getPositions(userId: string): Promise<(Position & { product: Product })[]> {
    const rows = await db.select()
      .from(positions)
      .innerJoin(products, eq(positions.productId, products.id))
      .where(eq(positions.userId, userId));
    return rows.map(row => ({ ...row.positions, product: row.products }));
  }

  async getWatchlist(userId: string): Promise<Product[]> {
    const rows = await db.select()
      .from(watchlist)
      .innerJoin(products, eq(watchlist.productId, products.id))
      .where(eq(watchlist.userId, userId));
    return rows.map(row => row.products);
  }

  async addToWatchlist(userId: string, productId: number): Promise<void> {
    await db.insert(watchlist).values({ userId, productId }).onConflictDoNothing();
  }

  async removeFromWatchlist(userId: string, productId: number): Promise<void> {
    await db.delete(watchlist).where(and(eq(watchlist.userId, userId), eq(watchlist.productId, productId)));
  }

  async executeOrder(userId: string, orderReq: CreateOrderRequest, explicitPrice?: number): Promise<Order> {
    const isPending = orderReq.orderType && orderReq.orderType !== "market";

    return await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, orderReq.productId));
      if (!product) throw new Error("Product not found");

      const executionPrice = explicitPrice ?? product.currentPrice;
      const cs = getContractSize(product.symbol);
      const units = orderReq.lotSize * cs;

      let [account] = await tx.select().from(accounts).where(eq(accounts.userId, userId));
      if (!account) {
        [account] = await tx.insert(accounts).values({ userId }).returning();
      }

      const leverage = account.leverage || 100;
      const [usdJpyProd] = await tx.select({ currentPrice: products.currentPrice })
        .from(products).where(eq(products.symbol, "USD/JPY"));
      const usdJpyRate = usdJpyProd?.currentPrice ?? 145;
      const marginRequired = getMarginUSD(product.symbol, units, executionPrice, leverage, usdJpyRate);
      const balance = Number(account.balance);

      const openOrdRows = await tx.select().from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .where(and(eq(orders.userId, userId), eq(orders.status, "open")));
      let marginUsed = 0;
      for (const row of openOrdRows) {
        const rowCs = getContractSize(row.products.symbol);
        const rowUnits = row.orders.lotSize * rowCs;
        marginUsed += getMarginUSD(row.products.symbol, rowUnits, row.orders.price, leverage, usdJpyRate);
      }

      const posRows = await tx.select().from(positions)
        .innerJoin(products, eq(positions.productId, products.id))
        .where(eq(positions.userId, userId));
      let unrealizedPnl = 0;
      for (const row of posRows) {
        const rowCs = getContractSize(row.products.symbol);
        const u = Math.abs(row.positions.lotSize) * rowCs;
        if (row.positions.lotSize > 0) {
          unrealizedPnl += (row.products.currentPrice - row.positions.averageEntryPrice) * u;
        } else {
          unrealizedPnl += (row.positions.averageEntryPrice - row.products.currentPrice) * u;
        }
      }

      const equity = balance + unrealizedPnl;
      const freeMargin = equity - marginUsed;

      if (freeMargin < marginRequired) {
        throw new Error("Insufficient margin");
      }

      if (isPending) {
        if (!orderReq.triggerPrice) throw new Error("Trigger price required for pending orders");
        const margin = executionPrice * units;
        const [order] = await tx.insert(orders).values({
          userId, productId: product.id, type: orderReq.type,
          orderType: orderReq.orderType!, lotSize: orderReq.lotSize,
          price: executionPrice, triggerPrice: orderReq.triggerPrice,
          total: margin, status: "pending",
          stopLoss: orderReq.stopLoss || null,
          takeProfit: orderReq.takeProfit || null,
        }).returning();
        return order;
      }

      const margin = executionPrice * units;

      const [existingPos] = await tx.select().from(positions)
        .where(and(eq(positions.userId, userId), eq(positions.productId, product.id)));

      if (orderReq.type === 'buy') {
        if (existingPos) {
          const totalLots = existingPos.lotSize + orderReq.lotSize;
          const existingUnits = existingPos.lotSize * cs;
          const newAvg = ((existingUnits * existingPos.averageEntryPrice) + (units * executionPrice)) / (existingUnits + units);
          await tx.update(positions).set({ lotSize: totalLots, averageEntryPrice: newAvg }).where(eq(positions.id, existingPos.id));
        } else {
          await tx.insert(positions).values({ userId, productId: product.id, lotSize: orderReq.lotSize, averageEntryPrice: executionPrice });
        }
      } else {
        if (existingPos) {
          const newLots = existingPos.lotSize - orderReq.lotSize;
          if (newLots <= 0.000001) {
            await tx.delete(positions).where(eq(positions.id, existingPos.id));
          } else {
            await tx.update(positions).set({ lotSize: newLots }).where(eq(positions.id, existingPos.id));
          }
        } else {
          await tx.insert(positions).values({ userId, productId: product.id, lotSize: -orderReq.lotSize, averageEntryPrice: executionPrice });
        }
      }

      const [order] = await tx.insert(orders).values({
        userId, productId: product.id, type: orderReq.type, orderType: "market",
        lotSize: orderReq.lotSize,
        price: executionPrice, total: margin, status: "open",
        stopLoss: orderReq.stopLoss || null,
        takeProfit: orderReq.takeProfit || null,
      }).returning();

      this.updateIbCommission(userId, orderReq.lotSize).catch(() => {});

      return order;
    });
  }

  async executePendingOrder(orderId: number, executionPrice: number): Promise<Order> {
    return await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
      if (!order || order.status !== "pending") throw new Error("Pending order not found");

      const [product] = await tx.select().from(products).where(eq(products.id, order.productId));
      const cs = getContractSize(product?.symbol ?? "");
      const units = order.lotSize * cs;
      const margin = executionPrice * units;

      const [existingPos] = await tx.select().from(positions)
        .where(and(eq(positions.userId, order.userId), eq(positions.productId, order.productId)));

      if (order.type === 'buy') {
        if (existingPos) {
          const totalLots = existingPos.lotSize + order.lotSize;
          const existingUnits = existingPos.lotSize * cs;
          const newAvg = ((existingUnits * existingPos.averageEntryPrice) + (units * executionPrice)) / (existingUnits + units);
          await tx.update(positions).set({ lotSize: totalLots, averageEntryPrice: newAvg }).where(eq(positions.id, existingPos.id));
        } else {
          await tx.insert(positions).values({ userId: order.userId, productId: order.productId, lotSize: order.lotSize, averageEntryPrice: executionPrice });
        }
      } else {
        if (existingPos) {
          const newLots = existingPos.lotSize - order.lotSize;
          if (newLots <= 0.000001) {
            await tx.delete(positions).where(eq(positions.id, existingPos.id));
          } else {
            await tx.update(positions).set({ lotSize: newLots }).where(eq(positions.id, existingPos.id));
          }
        } else {
          await tx.insert(positions).values({ userId: order.userId, productId: order.productId, lotSize: -order.lotSize, averageEntryPrice: executionPrice });
        }
      }

      const [updated] = await tx.update(orders)
        .set({ status: "open", price: executionPrice, total: margin })
        .where(eq(orders.id, orderId)).returning();

      this.updateIbCommission(order.userId, order.lotSize).catch(() => {});

      return updated;
    });
  }

  async closeOrder(orderId: number, closePrice: number, reason: string): Promise<Order> {
    return await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
      if (!order) throw new Error("Order not found");
      if (order.status !== "open") throw new Error("Order already closed");

      const [product] = await tx.select().from(products).where(eq(products.id, order.productId));
      const pnl = calculatePnL(product?.symbol ?? "", order.type, order.price, closePrice, order.lotSize);

      const [account] = await tx.select().from(accounts).where(eq(accounts.userId, order.userId));
      if (account) {
        const newBalance = Number(account.balance) + pnl;
        await tx.update(accounts).set({ balance: String(Math.max(0, newBalance)) }).where(eq(accounts.id, account.id));
      }

      const [existingPos] = await tx.select().from(positions)
        .where(and(eq(positions.userId, order.userId), eq(positions.productId, order.productId)));

      if (existingPos) {
        if (order.type === "buy") {
          const newLots = existingPos.lotSize - order.lotSize;
          if (newLots <= 0.000001) {
            await tx.delete(positions).where(eq(positions.id, existingPos.id));
          } else {
            await tx.update(positions).set({ lotSize: newLots }).where(eq(positions.id, existingPos.id));
          }
        } else {
          const newLots = existingPos.lotSize + order.lotSize;
          if (Math.abs(newLots) <= 0.000001) {
            await tx.delete(positions).where(eq(positions.id, existingPos.id));
          } else {
            await tx.update(positions).set({ lotSize: newLots }).where(eq(positions.id, existingPos.id));
          }
        }
      }

      const [updated] = await tx.update(orders)
        .set({ status: "closed", pnl, closePrice, closedAt: new Date() })
        .where(eq(orders.id, orderId)).returning();
      return updated;
    });
  }

  async updateOrderSlTp(orderId: number, stopLoss: number | null, takeProfit: number | null): Promise<Order> {
    const [updated] = await db.update(orders)
      .set({ stopLoss, takeProfit })
      .where(eq(orders.id, orderId)).returning();
    if (!updated) throw new Error("Order not found");
    return updated;
  }

  async cancelOrder(orderId: number): Promise<Order> {
    const [updated] = await db.update(orders)
      .set({ status: "cancelled", closedAt: new Date() })
      .where(eq(orders.id, orderId)).returning();
    if (!updated) throw new Error("Order not found");
    return updated;
  }

  async createIbReferral(ibCode: string, userId: string): Promise<void> {
    await db.insert(ibReferrals).values({ ibCode, referredUserId: userId }).onConflictDoNothing();
  }

  async updateIbCommission(userId: string, lotSize: number): Promise<void> {
    const [referral] = await db.select().from(ibReferrals).where(eq(ibReferrals.referredUserId, userId));
    if (!referral) return;
    const [ibCodeRecord] = await db.select().from(ibCodes).where(eq(ibCodes.code, referral.ibCode));
    const commissionPerLot = ibCodeRecord ? Number(ibCodeRecord.commissionRate) : 5;
    await db.update(ibReferrals)
      .set({
        tradeVolume: referral.tradeVolume + lotSize,
        commissionEarned: String(Number(referral.commissionEarned) + (lotSize * commissionPerLot)),
      })
      .where(eq(ibReferrals.id, referral.id));
  }

  async recordLogin(userId: string, ipAddress: string | null, userAgent: string | null): Promise<void> {
    await db.insert(loginHistory).values({ userId, ipAddress, userAgent });
  }

  async getLoginHistory(userId: string, limit = 20): Promise<LoginHistoryEntry[]> {
    return db.select().from(loginHistory).where(eq(loginHistory.userId, userId)).orderBy(desc(loginHistory.createdAt)).limit(limit);
  }

  async getUserSessions(userId: string): Promise<{ sid: string; expire: Date }[]> {
    const allSessions = await db.select().from(sessions);
    return allSessions.filter(s => {
      try {
        const sess = s.sess as any;
        return sess?.passport?.user?.claims?.sub === userId;
      } catch { return false; }
    }).map(s => ({ sid: s.sid, expire: s.expire }));
  }

  async deleteSession(sid: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.sid, sid));
  }

  async createIbCode(code: string, partnerName: string, commissionRate: string): Promise<IbCode> {
    const [created] = await db.insert(ibCodes).values({ code, partnerName, commissionRate }).returning();
    return created;
  }

  async getAllIbCodes(): Promise<IbCode[]> {
    return db.select().from(ibCodes).orderBy(desc(ibCodes.createdAt));
  }

  async getIbCodeByCode(code: string): Promise<IbCode | undefined> {
    const [found] = await db.select().from(ibCodes).where(eq(ibCodes.code, code));
    return found;
  }

  async updateIbCode(id: number, updates: Partial<Pick<IbCode, 'partnerName' | 'commissionRate' | 'isActive'>>): Promise<IbCode> {
    const [updated] = await db.update(ibCodes).set(updates).where(eq(ibCodes.id, id)).returning();
    if (!updated) throw new Error("IB code not found");
    return updated;
  }

  async deleteIbCode(id: number): Promise<void> {
    await db.delete(ibCodes).where(eq(ibCodes.id, id));
  }

  async getAllIbStats(): Promise<{ ibCode: string; referredUsers: number; totalVolume: number; totalCommission: string }[]> {
    const allReferrals = await db.select().from(ibReferrals);
    const codeMap = new Map<string, { referredUsers: number; totalVolume: number; totalCommission: number }>();
    for (const r of allReferrals) {
      const existing = codeMap.get(r.ibCode) || { referredUsers: 0, totalVolume: 0, totalCommission: 0 };
      existing.referredUsers += 1;
      existing.totalVolume += r.tradeVolume;
      existing.totalCommission += Number(r.commissionEarned);
      codeMap.set(r.ibCode, existing);
    }
    return Array.from(codeMap.entries()).map(([ibCode, stats]) => ({
      ibCode,
      referredUsers: stats.referredUsers,
      totalVolume: stats.totalVolume,
      totalCommission: stats.totalCommission.toFixed(2),
    }));
  }

  async seedProducts(): Promise<void> {
    const allProducts = [
      { symbol: "EUR/USD", name: "Euro / US Dollar", type: "forex", currentPrice: 1.0845, change24h: 0.05 },
      { symbol: "GBP/USD", name: "British Pound / US Dollar", type: "forex", currentPrice: 1.2630, change24h: -0.1 },
      { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", type: "forex", currentPrice: 149.85, change24h: 0.12 },
      { symbol: "USD/CHF", name: "US Dollar / Swiss Franc", type: "forex", currentPrice: 0.8820, change24h: -0.08 },
      { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", type: "forex", currentPrice: 1.3545, change24h: 0.03 },
      { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", type: "forex", currentPrice: 0.6580, change24h: 0.15 },
      { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar", type: "forex", currentPrice: 0.6120, change24h: -0.07 },
      { symbol: "EUR/GBP", name: "Euro / British Pound", type: "forex", currentPrice: 0.8585, change24h: 0.04 },
      { symbol: "EUR/JPY", name: "Euro / Japanese Yen", type: "forex", currentPrice: 162.45, change24h: 0.18 },
      { symbol: "EUR/CHF", name: "Euro / Swiss Franc", type: "forex", currentPrice: 0.9565, change24h: -0.02 },
      { symbol: "GBP/JPY", name: "British Pound / Japanese Yen", type: "forex", currentPrice: 189.25, change24h: 0.22 },
      { symbol: "GBP/CHF", name: "British Pound / Swiss Franc", type: "forex", currentPrice: 1.1135, change24h: -0.05 },
      { symbol: "AUD/JPY", name: "Australian Dollar / Japanese Yen", type: "forex", currentPrice: 98.60, change24h: 0.28 },
      { symbol: "CAD/JPY", name: "Canadian Dollar / Japanese Yen", type: "forex", currentPrice: 110.65, change24h: 0.09 },
      { symbol: "CHF/JPY", name: "Swiss Franc / Japanese Yen", type: "forex", currentPrice: 169.90, change24h: 0.14 },
      { symbol: "NZD/JPY", name: "New Zealand Dollar / Japanese Yen", type: "forex", currentPrice: 93.82, change24h: 0.11 },
      { symbol: "GBP/AUD", name: "British Pound / Australian Dollar", type: "forex", currentPrice: 1.8744, change24h: -0.12 },
      { symbol: "GBP/NZD", name: "British Pound / New Zealand Dollar", type: "forex", currentPrice: 2.2658, change24h: 0.09 },
      { symbol: "GBP/CAD", name: "British Pound / Canadian Dollar", type: "forex", currentPrice: 1.8212, change24h: -0.06 },
      { symbol: "EUR/AUD", name: "Euro / Australian Dollar", type: "forex", currentPrice: 1.6196, change24h: 0.07 },
      { symbol: "EUR/NZD", name: "Euro / New Zealand Dollar", type: "forex", currentPrice: 1.9574, change24h: 0.03 },
      { symbol: "EUR/CAD", name: "Euro / Canadian Dollar", type: "forex", currentPrice: 1.5729, change24h: -0.04 },
      { symbol: "AUD/NZD", name: "Australian Dollar / New Zealand Dollar", type: "forex", currentPrice: 1.0789, change24h: 0.05 },
      { symbol: "AUD/CAD", name: "Australian Dollar / Canadian Dollar", type: "forex", currentPrice: 0.9625, change24h: -0.03 },
      { symbol: "NZD/CAD", name: "New Zealand Dollar / Canadian Dollar", type: "forex", currentPrice: 0.7963, change24h: 0.02 },
      { symbol: "XAU/USD", name: "Gold", type: "commodity", currentPrice: 2045.30, change24h: 0.3 },
      { symbol: "XAG/USD", name: "Silver", type: "commodity", currentPrice: 24.85, change24h: 0.5 },
      { symbol: "WTI", name: "Crude Oil WTI", type: "commodity", currentPrice: 78.45, change24h: -0.8 },
      { symbol: "BRENT", name: "Brent Crude Oil", type: "commodity", currentPrice: 82.30, change24h: -0.6 },
      { symbol: "NATGAS", name: "Natural Gas", type: "commodity", currentPrice: 2.85, change24h: 1.2 },
      { symbol: "AAPL", name: "Apple Inc.", type: "stock", currentPrice: 225.40, change24h: 0.8 },
      { symbol: "TSLA", name: "Tesla Inc.", type: "stock", currentPrice: 178.90, change24h: -3.1 },
      { symbol: "NVDA", name: "NVIDIA Corp.", type: "stock", currentPrice: 124.50, change24h: 1.5 },
      { symbol: "AMZN", name: "Amazon.com Inc.", type: "stock", currentPrice: 205.50, change24h: 1.2 },
      { symbol: "GOOGL", name: "Alphabet Inc.", type: "stock", currentPrice: 172.80, change24h: 0.6 },
      { symbol: "MSFT", name: "Microsoft Corp.", type: "stock", currentPrice: 415.20, change24h: 0.4 },
      { symbol: "META", name: "Meta Platforms Inc.", type: "stock", currentPrice: 610.40, change24h: 1.8 },
      { symbol: "NFLX", name: "Netflix Inc.", type: "stock", currentPrice: 985.60, change24h: -0.9 },
      { symbol: "AMD", name: "Advanced Micro Devices Inc.", type: "stock", currentPrice: 112.35, change24h: 2.1 },
      { symbol: "UBER", name: "Uber Technologies Inc.", type: "stock", currentPrice: 82.75, change24h: 0.7 },
      { symbol: "US30", name: "Dow Jones 30", type: "indices", currentPrice: 38876.50, change24h: 0.4 },
      { symbol: "SPX500", name: "S&P 500", type: "indices", currentPrice: 5432.10, change24h: 0.4 },
      { symbol: "NAS100", name: "Nasdaq 100", type: "indices", currentPrice: 19876.50, change24h: 0.9 },
      { symbol: "BTC/USD", name: "Bitcoin / US Dollar", type: "crypto", currentPrice: 67500.00, change24h: 1.25 },
      { symbol: "ETH/USD", name: "Ethereum / US Dollar", type: "crypto", currentPrice: 3200.00, change24h: 0.85 },
      { symbol: "LTC/USD", name: "Litecoin / US Dollar", type: "crypto", currentPrice: 85.00, change24h: -0.45 },
    ];

    const existing = await db.select({ symbol: products.symbol }).from(products);
    const existingSymbols = new Set(existing.map(e => e.symbol));
    const missing = allProducts.filter(p => !existingSymbols.has(p.symbol));

    if (missing.length > 0) {
      await db.insert(products).values(missing);
    }
  }

  async createTransaction(userId: string, type: string, amount: number, note?: string): Promise<Transaction> {
    const [txn] = await db.insert(transactions).values({
      userId, type, amount: String(amount), status: "pending", note: note || null,
    }).returning();
    return txn;
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
  }

  async getAllUsers(): Promise<(User & { account?: Account })[]> {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const allAccounts = await db.select().from(accounts);
    const accountMap = new Map(allAccounts.map(a => [a.userId, a]));
    return allUsers.map(u => ({ ...u, account: accountMap.get(u.id) }));
  }

  async getUserDetail(userId: string): Promise<{ user: User; account: Account; orders: (Order & { product: Product })[]; positions: (Position & { product: Product })[] } | null> {
    const user = await this.getUser(userId);
    if (!user) return null;
    const account = await this.getAccount(userId);
    const userOrders = await this.getOrders(userId);
    const userPositions = await this.getPositions(userId);
    return { user, account, orders: userOrders, positions: userPositions };
  }

  async adjustUserBalance(userId: string, amount: number, adminId: string): Promise<Account> {
    const account = await this.getAccount(userId);
    const newBalance = Number(account.balance) + amount;
    if (newBalance < 0) throw new Error("Balance cannot go below zero");
    await db.update(accounts).set({ balance: String(newBalance) }).where(eq(accounts.id, account.id));

    await db.insert(transactions).values({
      userId, type: amount >= 0 ? "deposit" : "withdrawal",
      amount: String(Math.abs(amount)), status: "approved",
      note: "Admin adjustment", processedBy: adminId, processedAt: new Date(),
    });

    return { ...account, balance: String(newBalance) };
  }

  async getAllTransactions(): Promise<(Transaction & { user?: User })[]> {
    const allTxns = await db.select().from(transactions).orderBy(desc(transactions.createdAt));
    const userIds = [...new Set(allTxns.map(t => t.userId))];
    const allUsers = userIds.length > 0 ? await db.select().from(users) : [];
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    return allTxns.map(t => ({ ...t, user: userMap.get(t.userId) }));
  }

  async updateTransactionStatus(id: number, status: string, adminId: string): Promise<Transaction> {
    const [txn] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!txn) throw new Error("Transaction not found");
    if (txn.status !== "pending") throw new Error("Transaction already processed");

    if (status === "approved") {
      const account = await this.getAccount(txn.userId);
      const amount = Number(txn.amount);
      if (txn.type === "deposit") {
        await db.update(accounts).set({ balance: String(Number(account.balance) + amount) }).where(eq(accounts.id, account.id));
      } else {
        const newBal = Number(account.balance) - amount;
        if (newBal < 0) throw new Error("Insufficient balance for withdrawal");
        await db.update(accounts).set({ balance: String(newBal) }).where(eq(accounts.id, account.id));
      }
    }

    const [updated] = await db.update(transactions)
      .set({ status, processedBy: adminId, processedAt: new Date() })
      .where(eq(transactions.id, id)).returning();
    return updated;
  }

  async getAllOrders(): Promise<(Order & { product: Product; user?: User })[]> {
    const rows = await db.select().from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .orderBy(desc(orders.createdAt));
    const userIds = [...new Set(rows.map(r => r.orders.userId))];
    const allUsers = userIds.length > 0 ? await db.select().from(users) : [];
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    return rows.map(row => ({ ...row.orders, product: row.products, user: userMap.get(row.orders.userId) }));
  }

  async getAdminStats(): Promise<{ userCount: number; totalBalance: number; pendingTransactions: number; activePositions: number }> {
    const allUsers = await db.select().from(users);
    const allAccounts = await db.select().from(accounts);
    const pendingTxns = await db.select().from(transactions).where(eq(transactions.status, "pending"));
    const allPositions = await db.select().from(positions);

    return {
      userCount: allUsers.length,
      totalBalance: allAccounts.reduce((sum, a) => sum + Number(a.balance), 0),
      pendingTransactions: pendingTxns.length,
      activePositions: allPositions.length,
    };
  }

  async createConversation(userId: string, subject: string): Promise<Conversation> {
    const [conv] = await db.insert(conversations).values({ userId, subject, status: "open" }).returning();
    return conv;
  }

  async getUserConversations(userId: string): Promise<(Conversation & { user?: User; lastMessage?: string })[]> {
    const convs = await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
    return this.enrichConversations(convs);
  }

  async getAllConversations(): Promise<(Conversation & { user?: User; lastMessage?: string })[]> {
    const convs = await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
    return this.enrichConversations(convs);
  }

  private async enrichConversations(convs: Conversation[]): Promise<(Conversation & { user?: User; lastMessage?: string })[]> {
    if (convs.length === 0) return [];
    const allUsers = await db.select().from(users);
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const results = [];
    for (const conv of convs) {
      const msgs = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      results.push({
        ...conv,
        user: userMap.get(conv.userId),
        lastMessage: msgs[0]?.content,
      });
    }
    return results;
  }

  async getMessages(conversationId: number): Promise<(Message & { senderName: string; senderEmail: string })[]> {
    const rows = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        content: messages.content,
        isAdmin: messages.isAdmin,
        attachmentUrl: messages.attachmentUrl,
        attachmentName: messages.attachmentName,
        createdAt: messages.createdAt,
        senderFirstName: users.firstName,
        senderLastName: users.lastName,
        senderEmail: users.email,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return rows.map(r => {
      const fullName = [r.senderFirstName, r.senderLastName].filter(Boolean).join(" ");
      const emailPrefix = r.senderEmail ? r.senderEmail.split("@")[0] : "";
      return {
        ...r,
        senderName: fullName || emailPrefix || "User",
        senderEmail: r.senderEmail || "",
      };
    });
  }

  async sendMessage(conversationId: number, senderId: string, content: string, isAdminFlag: boolean, attachmentUrl?: string, attachmentName?: string): Promise<Message> {
    const [msg] = await db.insert(messages).values({
      conversationId, senderId, content, isAdmin: isAdminFlag,
      ...(attachmentUrl ? { attachmentUrl, attachmentName } : {}),
    }).returning();
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
    return msg;
  }

  async closeConversation(conversationId: number): Promise<Conversation> {
    const [conv] = await db.update(conversations)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(conversations.id, conversationId)).returning();
    return conv;
  }

  async submitKyc(userId: string, data: { documentType: string; fullName: string; documentNumber: string; frontImageData: string; backImageData: string }): Promise<KycDocument> {
    const existing = await this.getKycByUser(userId);
    if (existing) {
      const [updated] = await db.update(kycDocuments)
        .set({ ...data, status: "pending", adminNote: null, verifiedAt: null, verifiedBy: null, submittedAt: new Date() })
        .where(eq(kycDocuments.userId, userId)).returning();
      return updated;
    }
    const [doc] = await db.insert(kycDocuments).values({ userId, ...data, status: "pending" }).returning();
    return doc;
  }

  async getKycByUser(userId: string): Promise<KycDocument | undefined> {
    const [doc] = await db.select().from(kycDocuments).where(eq(kycDocuments.userId, userId));
    return doc;
  }

  async getAllKyc(): Promise<(KycDocument & { user?: User })[]> {
    const docs = await db.select().from(kycDocuments).orderBy(desc(kycDocuments.submittedAt));
    const result: (KycDocument & { user?: User })[] = [];
    for (const doc of docs) {
      const user = await this.getUser(doc.userId);
      result.push({ ...doc, user });
    }
    return result;
  }

  async updateKycStatus(id: number, status: string, adminId: string, adminNote?: string): Promise<KycDocument> {
    const [doc] = await db.update(kycDocuments)
      .set({ status, adminNote: adminNote || null, verifiedAt: new Date(), verifiedBy: adminId })
      .where(eq(kycDocuments.id, id)).returning();
    return doc;
  }

  async upsertTradeControl(data: InsertTradeControl): Promise<TradeControl> {
    const [existing] = await db.select().from(tradeControls).where(eq(tradeControls.tradeId, data.tradeId));
    if (existing) {
      const [updated] = await db.update(tradeControls)
        .set({ forceProfitable: data.forceProfitable, profitSpeed: data.profitSpeed, targetPips: data.targetPips, isActive: data.isActive ?? true })
        .where(eq(tradeControls.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(tradeControls).values(data).returning();
    return created;
  }

  async getTradeControlByTradeId(tradeId: number): Promise<TradeControl | undefined> {
    const [tc] = await db.select().from(tradeControls).where(eq(tradeControls.tradeId, tradeId));
    return tc;
  }

  async getAllActiveTradeControls(): Promise<TradeControl[]> {
    return db.select().from(tradeControls).where(eq(tradeControls.isActive, true));
  }

  async deactivateTradeControl(tradeId: number): Promise<void> {
    await db.update(tradeControls).set({ isActive: false, forceProfitable: false }).where(eq(tradeControls.tradeId, tradeId));
  }

  async listTradeControls(): Promise<(TradeControl & { user?: User; order?: Order & { product?: Product } })[]> {
    const all = await db.select().from(tradeControls).where(eq(tradeControls.isActive, true)).orderBy(desc(tradeControls.createdAt));
    const result: (TradeControl & { user?: User; order?: Order & { product?: Product } })[] = [];
    for (const tc of all) {
      const user = await this.getUser(tc.userId);
      const orderRows = await db.select().from(orders)
        .innerJoin(products, eq(orders.productId, products.id))
        .where(eq(orders.id, tc.tradeId));
      const order = orderRows[0] ? { ...orderRows[0].orders, product: orderRows[0].products } : undefined;
      result.push({ ...tc, user, order });
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
