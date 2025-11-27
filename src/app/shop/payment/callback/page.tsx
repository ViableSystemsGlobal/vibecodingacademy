"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/contexts/toast-context";
import { trackPurchase } from "@/lib/analytics";

function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: showError } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasTrackedPurchase = useRef(false);

  useEffect(() => {
    const reference = searchParams.get("reference");
    const trxref = searchParams.get("trxref"); // Paystack uses this
    const cancelled = searchParams.get("cancelled"); // Some gateways send this

    // If cancelled parameter is present, redirect immediately
    if (cancelled === "true" || cancelled === "1") {
      setStatus("failed");
      setIsRedirecting(true);
      showError("Payment cancelled", "You cancelled the payment. Redirecting to checkout...");
      setTimeout(() => {
        router.push("/shop/checkout");
      }, 2000);
      return;
    }

    if (!reference && !trxref) {
      // No reference means payment was cancelled before completion
      setStatus("failed");
      setIsRedirecting(true);
      showError("Payment cancelled", "You cancelled the payment. Redirecting to checkout...");
      setTimeout(() => {
        router.push("/shop/checkout");
      }, 2000);
      return;
    }

    // Verify payment status
    verifyPayment(reference || trxref || "");
  }, [searchParams, router, showError]);

  const verifyPayment = async (reference: string) => {
    try {
      // Verify payment via our backend API (uses secret key)
      const response = await fetch(`/api/public/shop/payment/verify?reference=${reference}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to verify payment");
      }

      const data = await response.json();

      if (data.success && data.verified) {
        // Payment successful
        setStatus("success");
        const order = data.order ?? null;
        if (order) {
          setOrderDetails(order);
          if (!hasTrackedPurchase.current) {
            trackPurchase({
              transactionId: order.orderNumber ?? data.reference,
              value: order.total ?? data.amount,
              currency: order.currency ?? data.currency ?? "GHS",
              items: Array.isArray(order.items)
                ? order.items.map((item: any) => ({
                    id: item.id ?? item.productId,
                    name: item.name ?? item.productName ?? "Product",
                    price: item.price ?? item.unitPrice ?? 0,
                    quantity: item.quantity ?? 1,
                    currency: item.currency ?? order.currency ?? "GHS",
                    sku: item.sku ?? undefined,
                  }))
                : [],
            });
            hasTrackedPurchase.current = true;
          }
        } else if (!hasTrackedPurchase.current) {
          trackPurchase({
            transactionId: data.reference,
            value: data.amount,
            currency: data.currency ?? "GHS",
            items: [],
          });
          hasTrackedPurchase.current = true;
        }

        success("Payment successful!", "Your order has been confirmed");
      } else {
        // Payment failed or cancelled
        const isCancelled = data.cancelled || 
                           data.message?.toLowerCase().includes("cancel") || 
                           data.gatewayResponse?.toLowerCase().includes("cancel") ||
                           false;
        
        setStatus("failed");
        if (isCancelled) {
          setIsRedirecting(true);
          showError("Payment cancelled", "You cancelled the payment. Redirecting to checkout...");
          // Redirect to checkout after 2 seconds
          setTimeout(() => {
            router.push("/shop/checkout");
          }, 2000);
        } else {
        showError("Payment failed", data.message || "Please try again");
        }
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      setStatus("failed");
      showError(
        "Payment verification failed",
        "Please check your order status or contact support. Redirecting to checkout..."
      );
      // Redirect to checkout after 3 seconds on error
      setTimeout(() => {
        router.push("/shop/checkout");
      }, 3000);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifying Payment...</h2>
          <p className="text-gray-600">Please wait while we confirm your payment</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
              <p className="text-gray-600 mb-6">
                Thank you for your payment. Your order has been confirmed.
              </p>

              {orderDetails && (
                <div className="bg-gray-50 rounded-lg p-6 text-left mb-6">
                  <h3 className="font-semibold mb-3">Order Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Number:</span>
                      <span className="font-medium">{orderDetails.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-medium">
                        {orderDetails.currency
                          ? new Intl.NumberFormat("en-GH", {
                              style: "currency",
                              currency: orderDetails.currency,
                            }).format(orderDetails.total ?? 0)
                          : `₵${orderDetails.total?.toFixed(2) || "0.00"}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Status:</span>
                      <span className="font-medium text-green-600">Paid</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Status:</span>
                      <span className="font-medium">{orderDetails.status}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/shop/account/orders"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  View Orders
                </Link>
                <Link
                  href="/shop"
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isRedirecting ? "Payment Cancelled" : "Payment Failed"}
            </h1>
            <p className="text-gray-600 mb-6">
              {isRedirecting ? (
                <>
                  You cancelled the payment. Redirecting you back to checkout...
                  <br />
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin inline-block mt-2" />
                </>
              ) : (
                "Unfortunately, your payment could not be processed. Please try again or use a different payment method."
              )}
            </p>

            {!isRedirecting && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/shop/checkout"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                  Back to Checkout
              </Link>
              <Link
                href="/shop/cart"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Back to Cart
              </Link>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
            <p className="text-gray-600">Please wait</p>
          </div>
        </div>
      }
    >
      <PaymentCallbackContent />
    </Suspense>
  );
}

