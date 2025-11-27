"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  TrendingUp,
  ShoppingCart,
  Package,
  RefreshCcw,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";

interface AnalyticsResponse {
  range: {
    start: string;
    end: string;
    days: number;
  };
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    totalItems: number;
    orderCountByStatus: Record<string, number>;
  };
  revenueTrend: Array<{ date: string; total: number }>;
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    currency: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: string;
  }>;
}

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

const STATUS_BADGE_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-sky-100 text-sky-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-purple-100 text-purple-800",
};

export default function EcommerceAnalyticsClient() {
  const [range, setRange] = useState<string>(RANGE_OPTIONS[1].value);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/ecommerce/analytics?days=${range}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load analytics");
      }

      const payload = (await response.json()) as AnalyticsResponse;
      setData(payload);
    } catch (err) {
      console.error("Analytics load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAnalytics();
    return () => controller.abort();
  }, [loadAnalytics, refreshKey]);

  const orderStatusSummary = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.metrics.orderCountByStatus)
      .map(([status, count]) => ({
        status,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Storefront Analytics</h1>
          <p className="text-gray-500">
            Monitor revenue, orders, and product performance for the ecommerce storefront.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={range}
            onValueChange={setRange}
            className="w-[160px]"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-200">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading analytics…
          </div>
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <h2 className="text-lg font-semibold text-red-700">Failed to load analytics</h2>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <Button variant="secondary" onClick={() => setRefreshKey((key) => key + 1)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="space-y-1 pb-2">
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <CardTitle className="text-2xl font-semibold">
                  {formatCurrency(data.metrics.totalRevenue, "GHS")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span>{data.range.days}-day window</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-1 pb-2">
                <p className="text-sm font-medium text-gray-500">Total Orders</p>
                <CardTitle className="text-2xl font-semibold">
                  {data.metrics.totalOrders.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-500" />
                  <span>{data.range.days} days</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-1 pb-2">
                <p className="text-sm font-medium text-gray-500">Average Order Value</p>
                <CardTitle className="text-2xl font-semibold">
                  {formatCurrency(data.metrics.averageOrderValue, "GHS")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  <span>Revenue / orders</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="space-y-1 pb-2">
                <p className="text-sm font-medium text-gray-500">Items Sold</p>
                <CardTitle className="text-2xl font-semibold">
                  {data.metrics.totalItems.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-500" />
                  <span>Units shipped</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Revenue Trend</CardTitle>
                  <p className="text-sm text-gray-500">
                    Daily revenue over the selected range
                  </p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  {formatDate(data.range.start)} – {formatDate(data.range.end)}
                </Badge>
              </CardHeader>
              <CardContent className="h-72">
                {data.revenueTrend.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    No revenue recorded during this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.revenueTrend}>
                      <defs>
                        <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        }
                        minTickGap={32}
                        stroke="#9CA3AF"
                      />
                      <YAxis
                        tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                        stroke="#9CA3AF"
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value, "GHS")}
                        labelFormatter={(value) =>
                          new Date(value).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#1d4ed8"
                        fill="url(#revenue)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Order Status</CardTitle>
                <p className="text-sm text-gray-500">
                  Distribution of order statuses in the selected range.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {orderStatusSummary.length === 0 ? (
                  <p className="text-sm text-gray-500">No orders recorded.</p>
                ) : (
                  orderStatusSummary.map(({ status, count }) => (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                    >
                      <Badge className={STATUS_BADGE_COLOR[status] ?? "bg-gray-100 text-gray-700"}>
                        {status}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
                <p className="text-sm text-gray-500">
                  Highest volume products for the selected period.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-gray-500">No products sold yet.</p>
                ) : (
                  data.topProducts.map((product, index) => (
                    <div key={product.productId} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {index + 1}. {product.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {product.quantity.toLocaleString()} units ·{" "}
                          {formatCurrency(product.revenue, "GHS")}
                        </p>
                      </div>
                      <Badge variant="secondary">{product.quantity}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <p className="text-sm text-gray-500">Latest orders placed on the storefront.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.recentOrders.length === 0 ? (
                  <p className="text-sm text-gray-500">No orders recorded in this period.</p>
                ) : (
                  data.recentOrders.map((order) => (
                    <div key={order.id} className="space-y-2 rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900">{order.orderNumber}</p>
                        <Badge className={STATUS_BADGE_COLOR[order.status] ?? "bg-gray-100 text-gray-700"}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{order.customerName}</span>
                        <span>{formatCurrency(order.total, order.currency)}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Payment: {order.paymentStatus}</span>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

