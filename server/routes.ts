import type { Express, RequestHandler, Request, Response } from "express";
import { type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated, getSession } from "./replit_integrations/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { startPriceEngine, registerWsClient, broadcastChatMessage, broadcastToAdmins, getBidAsk, getPriceHistory, getPolygonTickerForSymbol } from "./price-engine";
import { priceModifier } from "./services/priceModifier";
import crypto from "crypto";
import { db } from "./db";
import { users, conversations, getContractSize, passwordResetTokens } from "@shared/schema";
import { getMarginUSD, calculatePnL } from "./utils/pipCalculator";
import { eq, and, isNull, gt } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";

const VALID_INTERVALS = ["1min", "5min", "15min", "30min", "1h"] as const;
type HistoryInterval = typeof VALID_INTERVALS[number];

type CachedCandles = {
  data: { time: number; open: number; high: number; low: number; close: number }[];
  expiry: number;
};
const historyCache = new Map<string, CachedCandles>();
const HISTORY_CACHE_TTL = 5 * 60_000;

const isAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
    next();
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
};

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only images and PDF files are allowed"));
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/uploads", (await import("express")).default.static(UPLOADS_DIR));

  const sessionMiddleware = getSession();
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wss.on("connection", (ws: any, req: any) => {
    ws.userId = null;
    ws.isAdmin = false;

    const mockRes = { setHeader: () => {}, end: () => {} } as any;
    sessionMiddleware(req, mockRes, async () => {
      try {
        const session = req.session as any;
        const passport = session?.passport;
        const user = passport?.user;
        if (user?.claims?.sub) {
          ws.userId = user.claims.sub;
          const dbUser = await storage.getUser(user.claims.sub);
          ws.isAdmin = dbUser?.isAdmin || false;
        }
      } catch {}
    });

    registerWsClient(ws);
  });

  app.get("/api/products", async (_req, res) => {
    const prods = await storage.getProducts();
    res.json(prods);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.get("/api/price-history/:productId", (req, res) => {
    const productId = Number(req.params.productId);
    if (isNaN(productId)) return res.status(400).json({ message: "Invalid product ID" });
    res.json(getPriceHistory(productId));
  });

  app.get("/api/history/:symbol/:interval", async (req, res) => {
    try {
      const symbol = decodeURIComponent(req.params.symbol);
      const interval = req.params.interval as HistoryInterval;

      if (!VALID_INTERVALS.includes(interval)) {
        return res.status(400).json({ message: `Invalid interval. Must be one of: ${VALID_INTERVALS.join(", ")}` });
      }

      const apiSymbol = getPolygonTickerForSymbol(symbol);
      if (!apiSymbol) {
        return res.json([]);
      }

      const cacheKey = `${symbol}:${interval}`;
      const cached = historyCache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        return res.json(cached.data);
      }

      const apiKey = process.env.TWELVEDATA_API_KEY;
      if (!apiKey) {
        return res.json([]);
      }

      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(apiSymbol)}&interval=${interval}&outputsize=100&apikey=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        return res.json([]);
      }

      const json = await response.json() as any;

      if (json.code === 429 || json.status === "error" || !json.values || !Array.isArray(json.values)) {
        return res.json([]);
      }

      const candles = json.values
        .map((v: any) => {
          const dt = new Date(v.datetime.includes("T") ? v.datetime : v.datetime.replace(" ", "T"));
          const time = Math.floor(dt.getTime() / 1000);
          return {
            time,
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
          };
        })
        .filter((c: any) => !isNaN(c.time) && !isNaN(c.open))
        .sort((a: any, b: any) => a.time - b.time);

      historyCache.set(cacheKey, { data: candles, expiry: Date.now() + HISTORY_CACHE_TTL });

      res.json(candles);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/account", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const account = await storage.getAccount(userId);
    const pos = await storage.getPositions(userId);
    const openOrders = await storage.getOpenOrders(userId);
    const balance = Number(account.balance);
    const leverage = account.leverage || 100;

    let totalPnL = 0;
    pos.forEach(p => {
      const ba = getBidAsk(p.product.id);
      const price = ba ? (p.lotSize > 0 ? ba.bid : ba.ask) : p.product.currentPrice;
      const side = p.lotSize > 0 ? "buy" : "sell";
      totalPnL += calculatePnL(p.product.symbol, side, p.averageEntryPrice, price, Math.abs(p.lotSize));
    });

    const equity = balance + totalPnL;
    const usdJpyBidAsk = getBidAsk(3);
    const usdJpyRate = usdJpyBidAsk?.bid ?? 145;
    let marginUsed = 0;
    for (const o of openOrders) {
      const cs = getContractSize(o.product.symbol);
      marginUsed += getMarginUSD(o.product.symbol, o.lotSize * cs, o.price, leverage, usdJpyRate);
    }
    const freeMargin = equity - marginUsed;
    const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : Infinity;
    const portfolioValue = balance + totalPnL;

    res.json({ account, portfolioValue, totalPnL, equity, marginUsed, freeMargin, marginLevel, leverage });
  });

  app.get("/api/orders", isAuthenticated, async (req: any, res) => {
    const allOrders = await storage.getOrders(req.user.claims.sub);
    res.json(allOrders);
  });

  app.get("/api/orders/open", isAuthenticated, async (req: any, res) => {
    const openOrders = await storage.getOpenOrders(req.user.claims.sub);
    res.json(openOrders);
  });

  app.post("/api/orders", isAuthenticated, async (req: any, res) => {
    try {
      const input = z.object({
        productId: z.number(),
        type: z.enum(["buy", "sell"]),
        orderType: z.enum(["market", "buy_limit", "sell_limit", "buy_stop", "sell_stop"]).optional().default("market"),
        lotSize: z.number().positive().max(100),
        triggerPrice: z.number().positive().optional().nullable(),
        stopLoss: z.number().positive().optional().nullable(),
        takeProfit: z.number().positive().optional().nullable(),
      }).parse(req.body);

      const ba = getBidAsk(input.productId);
      if (!ba) return res.status(400).json({ message: "Price not available" });

      if (input.orderType === "market") {
        const executionPrice = input.type === "buy" ? ba.ask : ba.bid;

        if (input.stopLoss) {
          if (input.type === "buy" && input.stopLoss >= executionPrice) {
            return res.status(400).json({ message: "Buy Stop Loss must be below entry price" });
          }
          if (input.type === "sell" && input.stopLoss <= executionPrice) {
            return res.status(400).json({ message: "Sell Stop Loss must be above entry price" });
          }
        }
        if (input.takeProfit) {
          if (input.type === "buy" && input.takeProfit <= executionPrice) {
            return res.status(400).json({ message: "Buy Take Profit must be above entry price" });
          }
          if (input.type === "sell" && input.takeProfit >= executionPrice) {
            return res.status(400).json({ message: "Sell Take Profit must be below entry price" });
          }
        }

        const order = await storage.executeOrder(req.user.claims.sub, input, executionPrice);
        res.status(201).json(order);
      } else {
        if (!input.triggerPrice) {
          return res.status(400).json({ message: "Trigger price required for pending orders" });
        }

        switch (input.orderType) {
          case "buy_limit":
            if (input.triggerPrice >= ba.ask) return res.status(400).json({ message: "Buy Limit trigger must be below current ask price" });
            break;
          case "sell_limit":
            if (input.triggerPrice <= ba.bid) return res.status(400).json({ message: "Sell Limit trigger must be above current bid price" });
            break;
          case "buy_stop":
            if (input.triggerPrice <= ba.ask) return res.status(400).json({ message: "Buy Stop trigger must be above current ask price" });
            break;
          case "sell_stop":
            if (input.triggerPrice >= ba.bid) return res.status(400).json({ message: "Sell Stop trigger must be below current bid price" });
            break;
        }

        const refPrice = input.triggerPrice;
        if (input.stopLoss) {
          if (input.type === "buy" && input.stopLoss >= refPrice) return res.status(400).json({ message: "Buy Stop Loss must be below trigger price" });
          if (input.type === "sell" && input.stopLoss <= refPrice) return res.status(400).json({ message: "Sell Stop Loss must be above trigger price" });
        }
        if (input.takeProfit) {
          if (input.type === "buy" && input.takeProfit <= refPrice) return res.status(400).json({ message: "Buy Take Profit must be above trigger price" });
          if (input.type === "sell" && input.takeProfit >= refPrice) return res.status(400).json({ message: "Sell Take Profit must be below trigger price" });
        }

        const order = await storage.executeOrder(req.user.claims.sub, input);
        res.status(201).json(order);
      }
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const input = z.object({
        stopLoss: z.number().positive().optional().nullable(),
        takeProfit: z.number().positive().optional().nullable(),
      }).parse(req.body);

      const openOrders = await storage.getOpenOrders(req.user.claims.sub);
      const order = openOrders.find(o => o.id === orderId);
      if (!order) return res.status(404).json({ message: "Open order not found" });

      const entryPrice = order.price;

      if (input.stopLoss) {
        if (order.type === "buy" && input.stopLoss >= entryPrice) {
          return res.status(400).json({ message: "Buy Stop Loss must be below entry price" });
        }
        if (order.type === "sell" && input.stopLoss <= entryPrice) {
          return res.status(400).json({ message: "Sell Stop Loss must be above entry price" });
        }
      }
      if (input.takeProfit) {
        if (order.type === "buy" && input.takeProfit <= entryPrice) {
          return res.status(400).json({ message: "Buy Take Profit must be above entry price" });
        }
        if (order.type === "sell" && input.takeProfit >= entryPrice) {
          return res.status(400).json({ message: "Sell Take Profit must be below entry price" });
        }
      }

      const updated = await storage.updateOrderSlTp(orderId, input.stopLoss ?? null, input.takeProfit ?? null);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const allOrders = await storage.getOrders(req.user.claims.sub);
      const order = allOrders.find(o => o.id === orderId && o.status === "pending");
      if (!order) return res.status(404).json({ message: "Pending order not found" });
      const cancelled = await storage.cancelOrder(orderId);
      res.json(cancelled);
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/orders/:id/close", isAuthenticated, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const openOrders = await storage.getOpenOrders(req.user.claims.sub);
      const order = openOrders.find(o => o.id === orderId);
      if (!order) return res.status(404).json({ message: "Open order not found" });

      const ba = getBidAsk(order.productId);
      if (!ba) return res.status(400).json({ message: "Price not available" });

      const rawClosePrice = order.type === "buy" ? ba.bid : ba.ask;
      const closePrice = priceModifier.getEffectivePrice(orderId, order.price, rawClosePrice, order.type);
      const closed = await storage.closeOrder(orderId, closePrice, "manual");
      priceModifier.remove(orderId);
      storage.deactivateTradeControl(orderId).catch(() => {});
      res.json(closed);
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/positions", isAuthenticated, async (req: any, res) => {
    const pos = await storage.getPositions(req.user.claims.sub);
    res.json(pos);
  });

  app.get("/api/watchlist", isAuthenticated, async (req: any, res) => {
    const wl = await storage.getWatchlist(req.user.claims.sub);
    res.json(wl);
  });

  app.post("/api/watchlist", isAuthenticated, async (req: any, res) => {
    const { productId } = req.body;
    await storage.addToWatchlist(req.user.claims.sub, productId);
    res.status(201).json({ success: true });
  });

  app.delete("/api/watchlist/:productId", isAuthenticated, async (req: any, res) => {
    await storage.removeFromWatchlist(req.user.claims.sub, Number(req.params.productId));
    res.json({ success: true });
  });

  app.post("/api/onboarding", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { ibCode } = req.body;
    if (ibCode && typeof ibCode === "string" && ibCode.trim()) {
      const user = await storage.getUser(userId);
      if (!user?.ibCode) {
        const ibCodeRecord = await storage.getIbCodeByCode(ibCode.trim());
        if (ibCodeRecord && ibCodeRecord.isActive) {
          await storage.updateUserIbCode(userId, ibCode.trim());
          await storage.createIbReferral(ibCode.trim(), userId);
        }
      }
    }
    await storage.markOnboarded(userId);
    res.json({ success: true });
  });

  app.get("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      notifPriceAlerts: user.notifPriceAlerts ?? true,
      notifOrderUpdates: user.notifOrderUpdates ?? true,
      notifMarginWarnings: user.notifMarginWarnings ?? true,
      notifPromotions: user.notifPromotions ?? false,
      prefTheme: user.prefTheme ?? "dark",
      prefCurrency: user.prefCurrency ?? "USD",
      prefLanguage: user.prefLanguage ?? "en",
      prefChartType: user.prefChartType ?? "candlestick",
    });
  });

  app.patch("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = z.object({
        notifPriceAlerts: z.boolean().optional(),
        notifOrderUpdates: z.boolean().optional(),
        notifMarginWarnings: z.boolean().optional(),
        notifPromotions: z.boolean().optional(),
        prefTheme: z.enum(["dark", "light"]).optional(),
        prefCurrency: z.enum(["USD", "EUR", "GBP", "JPY", "INR"]).optional(),
        prefLanguage: z.enum(["en", "ar", "zh", "es"]).optional(),
        prefChartType: z.enum(["candlestick", "line"]).optional(),
      }).parse(req.body);
      await storage.updateUserPreferences(userId, input);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/user/ib-code", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { ibCode } = z.object({ ibCode: z.string().min(1).max(50) }).parse(req.body);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.ibCode) return res.status(400).json({ message: "IB code already set. Contact support to change it." });
      const ibCodeRecord = await storage.getIbCodeByCode(ibCode);
      if (!ibCodeRecord || !ibCodeRecord.isActive) return res.status(400).json({ message: "Invalid IB code. Please check and try again." });
      await storage.updateUserIbCode(userId, ibCode);
      await storage.createIbReferral(ibCode, userId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const user = await authStorage.getUserByEmail(email);
      if (user) {
        await db.update(passwordResetTokens).set({ usedAt: new Date() })
          .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });
      }
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Please enter a valid email" });
      res.json({ success: true });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const input = z.object({
        token: z.string().min(1),
        newPassword: z.string().min(6, "Password must be at least 6 characters"),
      }).parse(req.body);

      const [resetRecord] = await db.select().from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.token, input.token),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ));

      if (!resetRecord) {
        return res.status(400).json({ message: "This reset link is invalid or has expired" });
      }

      const newHash = await bcrypt.hash(input.newPassword, 10);
      await storage.updateUserPassword(resetRecord.userId, newHash);
      await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetRecord.id));
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const input = z.object({
        newPassword: z.string().min(6, "Password must be at least 6 characters"),
      }).parse(req.body);

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const newHash = await bcrypt.hash(input.newPassword, 10);
      await storage.updateUserPassword(userId, newHash);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/password-reset-requests", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const pending = await db.select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId,
        token: passwordResetTokens.token,
        createdAt: passwordResetTokens.createdAt,
        expiresAt: passwordResetTokens.expiresAt,
      }).from(passwordResetTokens)
        .where(and(
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ));

      const results = await Promise.all(pending.map(async (r) => {
        const user = await storage.getUser(r.userId);
        return { ...r, email: user?.email || "Unknown", name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() };
      }));

      res.json(results);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string(),
      }).refine(d => d.newPassword === d.confirmPassword, {
        message: "Passwords do not match", path: ["confirmPassword"],
      }).parse(req.body);

      const user = await storage.getUser(userId);
      if (!user || !user.passwordHash) return res.status(400).json({ message: "Cannot change password for this account" });

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Current password is incorrect" });

      const newHash = await bcrypt.hash(input.newPassword, 10);
      await storage.updateUserPassword(userId, newHash);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/user/login-history", isAuthenticated, async (req: any, res) => {
    const history = await storage.getLoginHistory(req.user.claims.sub);
    res.json(history);
  });

  app.get("/api/user/sessions", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const userSessions = await storage.getUserSessions(userId);
    const currentSid = (req as any).sessionID;
    const { createHash } = await import("crypto");
    res.json(userSessions.map((s, idx) => {
      const opaqueId = createHash("sha256").update(s.sid).digest("hex").slice(0, 16);
      return {
        id: opaqueId,
        displayId: "..." + s.sid.slice(-4),
        expire: s.expire,
        isCurrent: s.sid === currentSid,
      };
    }));
  });

  app.delete("/api/user/sessions/:opaqueId", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const opaqueId = req.params.opaqueId;
    const { createHash } = await import("crypto");
    const userSessions = await storage.getUserSessions(userId);
    const currentSid = (req as any).sessionID;
    const target = userSessions.find(s => {
      const hash = createHash("sha256").update(s.sid).digest("hex").slice(0, 16);
      return hash === opaqueId;
    });
    if (!target) return res.status(404).json({ message: "Session not found" });
    if (target.sid === currentSid) {
      return res.status(400).json({ message: "Cannot revoke your current session" });
    }
    await storage.deleteSession(target.sid);
    res.json({ success: true });
  });

  app.get("/api/transactions", isAuthenticated, async (req: any, res) => {
    const txns = await storage.getUserTransactions(req.user.claims.sub);
    res.json(txns);
  });

  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const input = z.object({
        type: z.enum(["deposit", "withdrawal"]),
        amount: z.number().positive(),
        note: z.string().optional(),
      }).parse(req.body);

      if (input.type === "withdrawal") {
        const account = await storage.getAccount(req.user.claims.sub);
        if (Number(account.balance) < input.amount) {
          return res.status(400).json({ message: "Insufficient balance" });
        }
      }

      const txn = await storage.createTransaction(req.user.claims.sub, input.type, input.amount, input.note);
      res.status(201).json(txn);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/chat/conversations", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (user?.isAdmin) {
      const convs = await storage.getAllConversations();
      return res.json(convs);
    }
    const convs = await storage.getUserConversations(userId);
    res.json(convs);
  });

  app.post("/api/chat/conversations", isAuthenticated, async (req: any, res) => {
    const { subject } = req.body;
    const conv = await storage.createConversation(req.user.claims.sub, subject || "Support Request");
    res.status(201).json(conv);
  });

  app.get("/api/chat/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const convId = Number(req.params.id);

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId));
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    if (!user?.isAdmin && conv.userId !== userId) return res.status(403).json({ message: "Forbidden" });

    const msgs = await storage.getMessages(convId);
    res.json(msgs);
  });

  app.post("/api/chat/upload", isAuthenticated, (req: any, res) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "File too large (max 10 MB)"
          : err.message || "Upload failed";
        return res.status(400).json({ message });
      }
      if (!req.file) return res.status(400).json({ message: "No file provided" });
      res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname });
    });
  });

  app.post("/api/chat/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const convId = Number(req.params.id);
    const { content, attachmentUrl, attachmentName } = req.body;

    const hasContent = content && typeof content === "string" && content.trim().length > 0;
    const hasAttachment = attachmentUrl && typeof attachmentUrl === "string";

    if (!hasContent && !hasAttachment) {
      return res.status(400).json({ message: "Message content or attachment required" });
    }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId));
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    if (!user?.isAdmin && conv.userId !== userId) return res.status(403).json({ message: "Forbidden" });

    const msg = await storage.sendMessage(
      convId, userId, hasContent ? content.trim() : "",
      user?.isAdmin || false,
      hasAttachment ? attachmentUrl : undefined,
      hasAttachment ? (attachmentName || "attachment") : undefined,
    );

    if (user?.isAdmin) {
      broadcastChatMessage([conv.userId], msg);
    } else {
      broadcastToAdmins(msg);
    }

    res.status(201).json(msg);
  });

  app.patch("/api/chat/conversations/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    const conv = await storage.closeConversation(Number(req.params.id));
    res.json(conv);
  });

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (_req, res) => {
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req, res) => {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers);
  });

  app.get("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    const detail = await storage.getUserDetail(req.params.id as string);
    if (!detail) return res.status(404).json({ message: "User not found" });
    res.json(detail);
  });

  app.post("/api/admin/users/:id/balance", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { amount } = z.object({ amount: z.number() }).parse(req.body);
      const account = await storage.adjustUserBalance(req.params.id, amount, req.user.claims.sub);
      res.json(account);
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/transactions", isAuthenticated, isAdmin, async (_req, res) => {
    const txns = await storage.getAllTransactions();
    res.json(txns);
  });

  app.patch("/api/admin/transactions/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status } = z.object({ status: z.enum(["approved", "rejected"]) }).parse(req.body);
      const txn = await storage.updateTransactionStatus(Number(req.params.id), status, req.user.claims.sub);
      res.json(txn);
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/orders", isAuthenticated, isAdmin, async (_req, res) => {
    const allOrders = await storage.getAllOrders();
    res.json(allOrders);
  });

  app.get("/api/admin/ib-stats", isAuthenticated, isAdmin, async (_req, res) => {
    const stats = await storage.getAllIbStats();
    res.json(stats);
  });

  app.get("/api/admin/ib-codes", isAuthenticated, isAdmin, async (_req, res) => {
    const codes = await storage.getAllIbCodes();
    res.json(codes);
  });

  app.post("/api/admin/ib-codes", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const input = z.object({
        code: z.string().min(1).max(50),
        partnerName: z.string().min(1).max(100),
        commissionRate: z.string().optional().default("5.00"),
      }).parse(req.body);
      const created = await storage.createIbCode(input.code, input.partnerName, input.commissionRate);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/ib-codes/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const input = z.object({
        partnerName: z.string().min(1).max(100).optional(),
        commissionRate: z.string().optional(),
        isActive: z.boolean().optional(),
      }).parse(req.body);
      const updated = await storage.updateIbCode(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/ib-codes/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteIbCode(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/kyc", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const doc = await storage.getKycByUser(userId);
      res.json(doc || null);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/kyc", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = z.object({
        documentType: z.enum(["aadhaar", "driving_license"]),
        fullName: z.string().min(2).max(100),
        documentNumber: z.string().min(4).max(50),
        frontImageData: z.string().min(10),
        backImageData: z.string().min(10),
      }).parse(req.body);
      const doc = await storage.submitKyc(userId, input);
      res.status(201).json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/kyc", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const docs = await storage.getAllKyc();
      res.json(docs);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/kyc/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const input = z.object({
        status: z.enum(["verified", "rejected"]),
        adminNote: z.string().optional(),
      }).parse(req.body);
      const doc = await storage.updateKycStatus(Number(req.params.id), input.status, req.user.claims.sub, input.adminNote);
      res.json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/users/:id/orders", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const openOrders = await storage.getOpenOrders(req.params.id);
      res.json(openOrders);
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/trade-control", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const input = z.object({
        userId: z.string().min(1),
        tradeId: z.number(),
        forceProfitable: z.boolean(),
        profitSpeed: z.enum(["slow", "normal", "fast"]),
        targetPips: z.number().int().min(1).max(100000),
      }).parse(req.body);

      const openOrders = await storage.getOpenOrders(input.userId);
      const targetOrder = openOrders.find(o => o.id === input.tradeId);
      if (!targetOrder) {
        return res.status(400).json({ message: "Trade not found or not open for this user" });
      }

      const tc = await storage.upsertTradeControl({
        userId: input.userId,
        tradeId: input.tradeId,
        forceProfitable: input.forceProfitable,
        profitSpeed: input.profitSpeed,
        targetPips: input.targetPips,
        isActive: input.forceProfitable,
      });

      priceModifier.set({
        tradeId: input.tradeId,
        userId: input.userId,
        forceProfitable: input.forceProfitable,
        profitSpeed: input.profitSpeed,
        targetPips: input.targetPips,
        product: targetOrder.product.symbol,
      });

      res.json(tc);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/trade-control-state", isAuthenticated, isAdmin, (_req: any, res) => {
    res.json(priceModifier.listStates());
  });

  app.get("/api/admin/trade-controls", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const controls = await storage.listTradeControls();
      res.json(controls);
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/trade-control/:tradeId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const tradeId = Number(req.params.tradeId);
      await storage.deactivateTradeControl(tradeId);
      priceModifier.remove(tradeId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  await storage.seedProducts();
  await startPriceEngine();

  return httpServer;
}
