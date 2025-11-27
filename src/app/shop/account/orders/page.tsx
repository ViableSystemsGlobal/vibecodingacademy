"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  Calendar,
  CreditCard,
  Truck,
  Eye,
  ShoppingCart,
  AlertCircle,
  FileText,
  ArrowLeft,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCustomerAuth } from "@/contexts/customer-auth-context";
import { useToast } from "@/contexts/toast-context";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  image: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  quotationNumber?: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  orderDate: string;
  dueDate?: string;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  items: OrderItem[];
  itemCount: number;
  customer: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  shippingAddress?: any;
  billingAddress?: any;
  notes?: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const { customer, loading: authLoading } = useCustomerAuth();
  const { error: showError } = useToast();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  useEffect(() => {
    if (!authLoading && !customer) {
      router.push("/shop/auth/login?redirect=/shop/account/orders");
    }
  }, [authLoading, customer, router]);

  useEffect(() => {
    if (customer) {
      fetchOrders();
    }
  }, [customer, page, selectedStatus]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      });

      const response = await fetch(`/api/public/shop/orders?${params}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to fetch orders (${response.status})`;
        console.error("Orders API error:", errorMessage, response.status);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setOrders(data.orders || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error("Error fetching orders:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load orders";
      showError(errorMessage);
      setOrders([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const response = await fetch("/api/public/shop/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ orderId }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch order details");
      }

      const data = await response.json();
      setSelectedOrder(data);
      setShowOrderDetails(true);
    } catch (error) {
      console.error("Error fetching order details:", error);
      showError("Failed to load order details");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "COMPLETED":
      case "PAID":
        return "text-green-600 bg-green-50";
      case "PROCESSING":
      case "SENT":
        return "text-blue-600 bg-blue-50";
      case "PENDING":
        return "text-yellow-600 bg-yellow-50";
      case "CANCELLED":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "COMPLETED":
      case "PAID":
        return <CheckCircle className="h-4 w-4" />;
      case "PROCESSING":
      case "SENT":
        return <Clock className="h-4 w-4" />;
      case "PENDING":
        return <AlertCircle className="h-4 w-4" />;
      case "CANCELLED":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus.toUpperCase()) {
      case "PAID":
        return "text-green-600 bg-green-50";
      case "PARTIALLY_PAID":
        return "text-yellow-600 bg-yellow-50";
      case "PENDING":
      case "UNPAID":
        return "text-red-600 bg-red-50";
      case "REFUNDED":
      case "PARTIALLY_REFUNDED":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getPaymentStatusIcon = (paymentStatus: string) => {
    switch (paymentStatus.toUpperCase()) {
      case "PAID":
        return <CheckCircle className="h-4 w-4" />;
      case "PARTIALLY_PAID":
        return <AlertCircle className="h-4 w-4" />;
      case "PENDING":
      case "UNPAID":
        return <XCircle className="h-4 w-4" />;
      case "REFUNDED":
      case "PARTIALLY_REFUNDED":
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const formatPaymentStatus = (paymentStatus: string) => {
    switch (paymentStatus.toUpperCase()) {
      case "PAID":
        return "Paid";
      case "PARTIALLY_PAID":
        return "Partially Paid";
      case "PENDING":
        return "Pending";
      case "UNPAID":
        return "Unpaid";
      case "REFUNDED":
        return "Refunded";
      case "PARTIALLY_REFUNDED":
        return "Partially Refunded";
      default:
        return paymentStatus;
    }
  };

  const formatCurrency = (amount: number, currency: string = "GHS") => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleReorder = async (order: Order) => {
    // TODO: Implement reorder functionality
    console.log("Reorder:", order);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm mb-6">
        <Link href="/shop" className="text-gray-500 hover:text-gray-700">
          Shop
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <Link href="/shop/account" className="text-gray-500 hover:text-gray-700">
          My Account
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="text-gray-900 font-medium">Orders</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
        <Link
          href="/shop"
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
        >
          <ShoppingCart className="h-5 w-5" />
          <span>Continue Shopping</span>
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "PENDING", "PROCESSING", "COMPLETED", "CANCELLED"].map((status) => (
          <button
            key={status}
            onClick={() => {
              setSelectedStatus(status);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedStatus === status
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {status === "all" ? "All Orders" : status.charAt(0) + status.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500 mb-6">
            {selectedStatus === "all"
              ? "You haven't placed any orders yet"
              : `No ${selectedStatus.toLowerCase()} orders`}
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>Start Shopping</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                {/* Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div className="flex flex-wrap items-center gap-3 mb-2 sm:mb-0">
                    <h3 className="font-semibold text-gray-900">
                      Order #{order.orderNumber}
                    </h3>
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {getStatusIcon(order.status)}
                      <span>{order.status}</span>
                    </span>
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(
                        order.paymentStatus
                      )}`}
                    >
                      {getPaymentStatusIcon(order.paymentStatus)}
                      <span>Payment: {formatPaymentStatus(order.paymentStatus)}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(order.orderDate)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CreditCard className="h-4 w-4" />
                      <span>{order.paymentMethod}</span>
                    </div>
                  </div>
                </div>

                {/* Order Items Preview */}
                <div className="border-t border-b py-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      Total: {formatCurrency(order.total, order.currency)}
                    </span>
                  </div>
                  
                  {/* First 3 items preview */}
                  <div className="space-y-2">
                    {order.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center space-x-3">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.productName}
                            width={40}
                            height={40}
                            className="rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Qty: {item.quantity} × {formatCurrency(item.unitPrice, order.currency)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-xs text-gray-500 pl-13">
                        +{order.items.length - 3} more {order.items.length - 3 === 1 ? "item" : "items"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Order Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3 sm:mb-0">
                    {order.status === "PROCESSING" && (
                      <>
                        <Truck className="h-4 w-4 text-blue-600" />
                        <span>Estimated delivery in 3-5 business days</span>
                      </>
                    )}
                    {order.status === "COMPLETED" && (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Order delivered successfully</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => fetchOrderDetails(order.id)}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View Details</span>
                    </button>
                    {order.status === "COMPLETED" && (
                      <button
                        onClick={() => handleReorder(order)}
                        className="flex items-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        <span>Reorder</span>
                      </button>
                    )}
                    <button
                      className="flex items-center space-x-1 text-gray-600 hover:text-gray-700"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Invoice</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-2 rounded-lg ${
                  page === p
                    ? "bg-blue-600 text-white"
                    : "bg-white border hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </nav>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Order Details</h2>
              <button
                onClick={() => setShowOrderDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Order info */}
              <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Order #{selectedOrder.orderNumber}</h3>
                    <p className="text-sm text-gray-600">
                      Placed on {formatDate(selectedOrder.orderDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      selectedOrder.status
                    )}`}
                  >
                    {getStatusIcon(selectedOrder.status)}
                    <span>{selectedOrder.status}</span>
                  </span>
                    <span
                      className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor(
                        selectedOrder.paymentStatus
                      )}`}
                    >
                      {getPaymentStatusIcon(selectedOrder.paymentStatus)}
                      <span>Payment: {formatPaymentStatus(selectedOrder.paymentStatus)}</span>
                    </span>
                  </div>
                </div>
                
                {/* Payment Information */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold mb-3 text-sm text-gray-700">Payment Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Payment Method:</span>
                      <span className="ml-2 font-medium">{selectedOrder.paymentMethod || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Payment Status:</span>
                      <span className={`ml-2 font-medium ${getPaymentStatusColor(selectedOrder.paymentStatus).split(' ')[0]}`}>
                        {formatPaymentStatus(selectedOrder.paymentStatus)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Amount Paid:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {formatCurrency(selectedOrder.amountPaid, selectedOrder.currency)}
                      </span>
                    </div>
                    {selectedOrder.amountDue > 0 && (
                      <div>
                        <span className="text-gray-600">Amount Due:</span>
                        <span className="ml-2 font-medium text-red-600">
                          {formatCurrency(selectedOrder.amountDue, selectedOrder.currency)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Order Items</h4>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-start space-x-4 p-3 bg-gray-50 rounded-lg">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.productName}
                          width={60}
                          height={60}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="w-[60px] h-[60px] bg-gray-200 rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h5 className="font-medium">{item.productName}</h5>
                        <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
                        <p className="text-sm">
                          Quantity: {item.quantity} × {formatCurrency(item.unitPrice, selectedOrder.currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.lineTotal, selectedOrder.currency)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal, selectedOrder.currency)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Discount</span>
                      <span className="text-green-600">-{formatCurrency(selectedOrder.discount, selectedOrder.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Tax</span>
                    <span>{formatCurrency(selectedOrder.tax, selectedOrder.currency)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total, selectedOrder.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
