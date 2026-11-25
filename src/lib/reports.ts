export type ReportOrder = {
  status: string;
  paymentStatus: string;
  channel: "retail" | "wholesale";
  goodsMinor: number;
  discountMinor: number;
  bundleDiscountMinor: number;
  loyaltyDiscountMinor: number;
  totalMinor: number;
  refundedMinor: number;
  costMinor: number | null;
  category?: string;
  createdAt: Date;
};

export type FinancialSummary = {
  revenueMinor: number;
  paidRevenueMinor: number;
  pendingMinor: number;
  canceledMinor: number;
  refundedMinor: number;
  netMinor: number;
  cogsMinor: number | null;
  estimatedGrossProfitMinor: number | null;
  marginPercent: number | null;
  averageOrderMinor: number;
  orderCount: number;
  retailMinor: number;
  wholesaleMinor: number;
  bundleDiscountMinor: number;
  loyaltyDiscountMinor: number;
  costsComplete: boolean;
};

const paidStatus = (order: ReportOrder) => order.paymentStatus === "paid" || order.paymentStatus === "refunded";

export function financialSummary(orders: ReportOrder[]): FinancialSummary {
  const live = orders.filter((order) => order.status !== "canceled");
  const paid = live.filter(paidStatus);
  const paidTotal = paid.reduce((sum, order) => sum + order.totalMinor, 0);
  const refundedMinor = orders.reduce((sum, order) => sum + order.refundedMinor, 0);
  const costsComplete = paid.every((order) => order.costMinor != null);
  const cogsMinor = costsComplete ? paid.reduce((sum, order) => sum + (order.costMinor ?? 0), 0) : null;
  const paidMerchandise = paid.reduce((sum, order) => sum + order.goodsMinor - order.discountMinor, 0);
  const estimatedGrossProfitMinor = cogsMinor == null ? null : paidMerchandise - refundedMinor - cogsMinor;
  const marginBase = paidMerchandise - refundedMinor;
  return {
    revenueMinor: live.reduce((sum, order) => sum + order.goodsMinor, 0),
    paidRevenueMinor: paidTotal,
    pendingMinor: live.filter((order) => order.paymentStatus === "unpaid").reduce((sum, order) => sum + order.totalMinor, 0),
    canceledMinor: orders.filter((order) => order.status === "canceled").reduce((sum, order) => sum + order.goodsMinor, 0),
    refundedMinor,
    netMinor: paidTotal - refundedMinor,
    cogsMinor,
    estimatedGrossProfitMinor,
    marginPercent:
      estimatedGrossProfitMinor == null || marginBase <= 0
        ? null
        : Math.round((estimatedGrossProfitMinor / marginBase) * 1000) / 10,
    averageOrderMinor: live.length ? Math.round(live.reduce((sum, order) => sum + order.totalMinor, 0) / live.length) : 0,
    orderCount: live.length,
    retailMinor: live.filter((order) => order.channel === "retail").reduce((sum, order) => sum + order.goodsMinor, 0),
    wholesaleMinor: live.filter((order) => order.channel === "wholesale").reduce((sum, order) => sum + order.goodsMinor, 0),
    bundleDiscountMinor: live.reduce((sum, order) => sum + order.bundleDiscountMinor, 0),
    loyaltyDiscountMinor: live.reduce((sum, order) => sum + order.loyaltyDiscountMinor, 0),
    costsComplete,
  };
}

export function periodBounds(from: Date, to: Date) {
  const length = to.getTime() - from.getTime();
  return { previousFrom: new Date(from.getTime() - length), previousTo: from };
}
