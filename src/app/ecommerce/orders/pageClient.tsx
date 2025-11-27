"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/theme-context";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import {
  Loader2,
  RefreshCcw,
  Search,
  ShoppingCart,
  Wallet,
  AlertCircle,
  Truck,
  Package,
  Clock,
  CheckCircle2,
  CreditCard,
  WalletCards,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react";

type EcommerceOrderItem = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  discount: number;
  lineTotal: number;
  primaryImage: string | null;
};

type EcommerceOrder = {
  id: string;
  number: string;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "READY_TO_SHIP"
    | "SHIPPED"
    | "DELIVERED"
    | "COMPLETED"
    | "CANCELLED";
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  deliveryAddress: string | { city?: string; region?: string; street?: string; country?: string; postalCode?: string; line1?: string; line2?: string; state?: string; zip?: string } | null;
  deliveryNotes?: string | null;
  deliveryDate?: string | null;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    type?: string | null;
  } | null;
  owner:
    | {
        id: string;
        name: string | null;
        email: string | null;
      }
    | null;
  invoice:
    | {
        id: string;
        number: string;
        paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
        status: string;
        dueDate: string;
        amountDue: number;
        amountPaid: number;
        payments: Array<{
          id: string;
          amount: number;
          method: string;
          reference: string | null;
          createdAt: string;
        }>;
        lead:
          | {
              id: string;
              name?: string | null;
              email?: string | null;
              phone?: string | null;
              company?: string | null;
            }
          | null;
      }
    | null;
  lastPayment?:
    | {
        id: string;
        amount: number;
        method: string;
        reference: string | null;
        createdAt: string;
      }
    | null;
  items: EcommerceOrderItem[];
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

const STATUS_OPTIONS: Array<{ value: EcommerceOrder["status"] | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "READY_TO_SHIP", label: "Ready to Ship" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PAYMENT_STATUS_OPTIONS: Array<{
  value: "all" | "UNPAID" | "PARTIALLY_PAID" | "PAID";
  label: string;
}> = [
  { value: "all", label: "All payment states" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
];

const statusStyles: Record<EcommerceOrder["status"], { bg: string; text: string; Icon: React.ElementType }> = {
  PENDING: { bg: "bg-yellow-100", text: "text-yellow-800", Icon: Clock },
  CONFIRMED: { bg: "bg-blue-100", text: "text-blue-800", Icon: CheckCircle2 },
  PROCESSING: { bg: "bg-orange-100", text: "text-orange-800", Icon: Package },
  READY_TO_SHIP: { bg: "bg-indigo-100", text: "text-indigo-800", Icon: Truck },
  SHIPPED: { bg: "bg-purple-100", text: "text-purple-800", Icon: Truck },
  DELIVERED: { bg: "bg-green-100", text: "text-green-800", Icon: CheckCircle2 },
  COMPLETED: { bg: "bg-emerald-100", text: "text-emerald-800", Icon: CheckCircle2 },
  CANCELLED: { bg: "bg-red-100", text: "text-red-800", Icon: AlertCircle },
};

const paymentStyles: Record<"UNPAID" | "PARTIALLY_PAID" | "PAID", { bg: string; text: string; Icon: React.ElementType }> = {
  UNPAID: { bg: "bg-red-100", text: "text-red-800", Icon: Wallet },
  PARTIALLY_PAID: { bg: "bg-yellow-100", text: "text-yellow-800", Icon: WalletCards },
  PAID: { bg: "bg-green-100", text: "text-green-800", Icon: CreditCard },
};

const STATUS_SEQUENCE: EcommerceOrder["status"][] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
];

const STATUS_LABELS: Record<EcommerceOrder["status"], string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function getNextStatusOptions(current: EcommerceOrder["status"]) {
  const currentIndex = STATUS_SEQUENCE.indexOf(current);
  const options = new Set<EcommerceOrder["status"]>();

  if (currentIndex !== -1 && currentIndex < STATUS_SEQUENCE.length - 1) {
    options.add(STATUS_SEQUENCE[currentIndex + 1]);
  }

  if (currentIndex !== -1 && currentIndex + 2 < STATUS_SEQUENCE.length) {
    options.add(STATUS_SEQUENCE[currentIndex + 2]);
  }

  if (current !== "COMPLETED" && current !== "CANCELLED") {
    options.add("COMPLETED");
  }

  if (current !== "CANCELLED" && current !== "COMPLETED") {
    options.add("CANCELLED");
  }

  // Always include the current value so the select has a default
  options.add(current);

  return Array.from(options);
}

const parseAddress = (value: string | { city?: string; region?: string; street?: string; country?: string; postalCode?: string; line1?: string; line2?: string; state?: string; zip?: string } | null) => {
  if (!value) return null;
  
  // If it's already an object, format it directly
  if (typeof value === "object" && !Array.isArray(value)) {
    const parts = [
      value.line1 || value.street,
      value.line2,
      value.city,
      value.state || value.region,
      value.country,
      value.zip || value.postalCode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  
  // If it's a string, try to parse it as JSON
  if (typeof value === "string") {
  try {
    const data = JSON.parse(value);
    if (typeof data === "object" && data) {
        const parts = [
          data.line1 || data.street,
        data.line2,
        data.city,
          data.state || data.region,
        data.country,
          data.zip || data.postalCode,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(", ") : value;
    }
  } catch {
    /* ignore */
  }
  return value;
  }
  
  return null;
};

export default function EcommerceOrdersClient() {
  const { getThemeColor } = useTheme();
  const [orders, setOrders] = useState<EcommerceOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<EcommerceOrder["status"] | "all">("all");
  const [paymentFilter, setPaymentFilter] =
    useState<"all" | "UNPAID" | "PARTIALLY_PAID" | "PAID">("all");
  const [selectedOrder, setSelectedOrder] = useState<EcommerceOrder | null>(
    null
  );
  const [statusDraft, setStatusDraft] = useState<EcommerceOrder["status"] | "">("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const fetchOrders = useCallback(
    async (page = pagination.page) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("page", page.toString());
        params.append("limit", pagination.limit.toString());
        if (search.trim()) params.append("search", search.trim());
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (paymentFilter !== "all")
          params.append("paymentStatus", paymentFilter);

        const response = await fetch(`/api/ecommerce/orders?${params.toString()}`, {
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("API Error:", response.status, errorData);
          throw new Error(errorData.error || "Failed to fetch ecommerce orders");
        }

        const result = await response.json();
        setOrders(result.data || []);
        setPagination(result.pagination);
      } catch (error) {
        console.error("Failed to load ecommerce orders", error);
        setOrders([]);
        setPagination((prev) => ({ ...prev, total: 0, pages: 1 }));
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, paymentFilter, search, statusFilter, pagination.page]
  );

  useEffect(() => {
    fetchOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, paymentFilter, search]);

  useEffect(() => {
    if (selectedOrder) {
      setStatusDraft(selectedOrder.status);
      setStatusFeedback(null);
    } else {
      setStatusDraft("");
    }
  }, [selectedOrder]);

  const metrics = useMemo(() => {
    const totalValue = orders.reduce((sum, order) => sum + order.total, 0);
    const outstanding = orders.reduce(
      (sum, order) => sum + (order.invoice?.amountDue ?? 0),
      0
    );
    const delivered = orders.filter(
      (order) => order.status === "DELIVERED" || order.status === "COMPLETED"
    ).length;
    return {
      totalOrders: pagination.total,
      totalValue,
      outstanding,
      delivered,
    };
  }, [orders, pagination.total]);

  const handlePageChange = (direction: "next" | "prev") => {
    if (direction === "prev" && pagination.page > 1) {
      const newPage = pagination.page - 1;
      fetchOrders(newPage);
    }
    if (direction === "next" && pagination.page < pagination.pages) {
      const newPage = pagination.page + 1;
      fetchOrders(newPage);
    }
  };
  const handleStatusUpdate = async () => {
    if (!selectedOrder || !statusDraft) return;

    setStatusUpdating(true);
    setStatusFeedback(null);
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: statusDraft,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to update order status");
      }

      await fetchOrders(pagination.page);

      setSelectedOrder((previous) =>
        previous
          ? {
              ...previous,
              status: statusDraft as EcommerceOrder["status"],
              updatedAt: new Date().toISOString(),
            }
          : previous
      );

      setStatusFeedback({
        type: "success",
        message: "Order status updated successfully.",
      });
    } catch (error) {
      console.error("Failed to update ecommerce order status", error);
      setStatusFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update order status",
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const renderStatusBadge = (status: EcommerceOrder["status"]) => {
    const config = statusStyles[status];
    const Icon = config.Icon;
    return (
      <Badge
        className={`${config.bg} ${config.text} font-medium flex items-center gap-1`}
      >
        <Icon className="h-3.5 w-3.5" />
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  const renderPaymentBadge = (
    status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | null | undefined
  ) => {
    if (!status) return <Badge className="bg-gray-100 text-gray-700">N/A</Badge>;
    const config = paymentStyles[status];
    const Icon = config.Icon;
    return (
      <Badge className={`${config.bg} ${config.text} font-medium flex items-center gap-1`}>
        <Icon className="h-3.5 w-3.5" />
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  const renderReconciliationBadge = (order: EcommerceOrder) => {
    if (!order.invoice) return null;
    const amountDue = order.invoice.amountDue ?? 0;

    if (amountDue <= 0) {
      return (
        <Badge className="mt-1 bg-emerald-100 text-emerald-700">
          Settled
        </Badge>
      );
    }

    if (
      order.status === "DELIVERED" ||
      order.status === "COMPLETED" ||
      order.invoice.paymentStatus === "PARTIALLY_PAID"
    ) {
      return (
        <Badge className="mt-1 bg-red-100 text-red-700">
          Collect COD
        </Badge>
      );
    }

    return (
      <Badge className="mt-1 bg-amber-100 text-amber-800">
        Awaiting Payment
      </Badge>
    );
  };

  const statusOptionsForSelect = useMemo(() => {
    if (!selectedOrder) return [];
    return [
      selectedOrder.status,
      ...getNextStatusOptions(selectedOrder.status).filter(
        (option) => option !== selectedOrder.status
      ),
    ];
  }, [selectedOrder]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Ecommerce Orders
          </h1>
          <p className="text-gray-500 mt-1">
            Track online orders and COD fulfillment in real time.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchOrders(pagination.page)}
          className="inline-flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AIRecommendationCard
            title="Ecommerce Orders AI"
            subtitle="Get fulfillment, delivery batching, and COD follow-up suggestions."
            page="ecommerce-orders"
            enableAI
            onRecommendationComplete={(id) => {
              console.log("Ecommerce AI recommendation completed:", id);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Orders</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {metrics.totalOrders}
                  </p>
                </div>
                <ShoppingCart className="h-8 w-8 text-gray-300" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Value</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(metrics.totalValue, "GHS")}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Outstanding</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(metrics.outstanding, "GHS")}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Delivered / Complete</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {metrics.delivered}
                  </p>
                </div>
                <Truck className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search by order, customer, invoice #..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex gap-3 flex-col sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as EcommerceOrder["status"] | "all")
                }
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(
                    event.target.value as "all" | "UNPAID" | "PARTIALLY_PAID" | "PAID"
                  )
                }
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              >
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Outstanding
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          <span>Loading ecommerce orders...</span>
                        </div>
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-500">
                        No ecommerce orders found.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">
                            {order.number}
                          </div>
                          {order.invoice?.number && (
                            <div className="text-xs text-gray-500">
                              Invoice {order.invoice.number}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {order.account?.name || order.invoice?.lead?.name || "Guest Checkout"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {order.account?.email || order.invoice?.lead?.email || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {renderStatusBadge(order.status)}
                        </td>
                        <td className="px-4 py-4">
                          {renderPaymentBadge(order.invoice?.paymentStatus ?? null)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-900">
                          {formatCurrency(order.total, "GHS")}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-900">
                          <div className="flex flex-col items-end">
                            <span>{formatCurrency(order.invoice?.amountDue ?? 0, "GHS")}</span>
                            {renderReconciliationBadge(order)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {order.owner?.name || "System"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOrder(order)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {orders.length} of {pagination.total} orders
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1 || loading}
                onClick={() => handlePageChange("prev")}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.pages || loading}
                onClick={() => handlePageChange("next")}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        {selectedOrder && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Ecommerce Order {selectedOrder.number}</DialogTitle>
              <DialogDescription>
                Created {formatDate(selectedOrder.createdAt)} • Total{" "}
                {formatCurrency(selectedOrder.total, "GHS")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Order Summary
                </h3>
                <div className="grid gap-3 text-sm text-gray-600 md:grid-cols-2">
                  <div>
                    <span className="font-medium text-gray-700">Status:</span>{" "}
                    {renderStatusBadge(selectedOrder.status)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Payment:</span>{" "}
                    {renderPaymentBadge(selectedOrder.invoice?.paymentStatus ?? null)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Subtotal:</span>{" "}
                    {formatCurrency(selectedOrder.subtotal, "GHS")}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tax:</span>{" "}
                    {formatCurrency(selectedOrder.tax, "GHS")}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Discount:</span>{" "}
                    {formatCurrency(selectedOrder.discount, "GHS")}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Outstanding:</span>{" "}
                    {formatCurrency(selectedOrder.invoice?.amountDue ?? 0, "GHS")}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Status & Fulfillment
                </h3>
                <div className="grid gap-3 md:grid-cols-2 text-sm text-gray-600">
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium text-gray-700">Current Status:</span>{" "}
                      {renderStatusBadge(selectedOrder.status)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Payment:</span>{" "}
                      {renderPaymentBadge(selectedOrder.invoice?.paymentStatus ?? null)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-700">Reconciliation:</span>
                      {renderReconciliationBadge(selectedOrder)}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Move to status
                      </label>
                      <Select
                        value={statusDraft || selectedOrder.status}
                        onValueChange={(value) =>
                          setStatusDraft(value as EcommerceOrder["status"])
                        }
                      >
                        {statusOptionsForSelect.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {STATUS_LABELS[statusOption as EcommerceOrder["status"]]}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <Button
                      onClick={handleStatusUpdate}
                      disabled={
                        statusUpdating ||
                        !statusDraft ||
                        statusDraft === selectedOrder.status
                      }
                      className="w-full md:w-auto"
                    >
                      {statusUpdating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Update Status
                    </Button>

                    {statusFeedback ? (
                      <p
                        className={`text-xs ${
                          statusFeedback.type === "error"
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {statusFeedback.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Customer
                </h3>
                <div className="grid gap-3 text-sm text-gray-600 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>
                      {selectedOrder.account?.name ||
                        selectedOrder.invoice?.lead?.name ||
                        "Guest"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span>
                      {selectedOrder.account?.email ||
                        selectedOrder.invoice?.lead?.email ||
                        "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>
                      {selectedOrder.account?.phone ||
                        selectedOrder.invoice?.lead?.phone ||
                        "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{parseAddress(selectedOrder.deliveryAddress) || "—"}</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Items ({selectedOrder.items.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedOrder.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-gray-700">
                            {item.productName || "Product"}
                          </td>
                          <td className="px-4 py-2 text-gray-500">
                            {item.productSku || "—"}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700">
                            {formatCurrency(item.unitPrice, "GHS")}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900 font-medium">
                            {formatCurrency(item.lineTotal, "GHS")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {selectedOrder.invoice?.payments?.length ? (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Payments
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    {selectedOrder.invoice.payments.map((payment) => {
                      const paymentMethodLabel = (payment.method ?? "UNSPECIFIED").replace(/_/g, " ");
                      const paymentDateLabel = payment.createdAt
                        ? formatDate(payment.createdAt)
                        : "Date unavailable";

                      return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-900">
                              {formatCurrency(payment.amount, "GHS")}
                            </div>
                            <div className="text-xs text-gray-500">
                              {paymentMethodLabel} • {paymentDateLabel}
                            </div>
                          </div>
                        </div>
                        {payment.reference && (
                          <span className="text-xs text-gray-500">
                            Ref: {payment.reference}
                          </span>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </section>
              ) : null}

              {selectedOrder.deliveryNotes && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Delivery Notes
                  </h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {selectedOrder.deliveryNotes}
                  </p>
                </section>
              )}

              {selectedOrder.deliveryDate && (
                <section className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>
                    Delivery scheduled for {formatDate(selectedOrder.deliveryDate)}
                  </span>
                </section>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}


