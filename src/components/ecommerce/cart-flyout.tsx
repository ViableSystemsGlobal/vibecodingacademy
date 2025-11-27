"use client";

import Link from "next/link";
import Image from "next/image";
import { X, ShoppingCart, ArrowRight, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useCartFlyout } from "@/contexts/cart-flyout-context";
import { useCustomerAuth } from "@/contexts/customer-auth-context";
import { formatCurrency } from "@/lib/utils";
import { useBranding } from "@/contexts/branding-context";

export function CartFlyout() {
  const { isOpen, closeCart, summary, loading, error, refreshCart } = useCartFlyout();
  const { refreshCartCount } = useCustomerAuth();
  const { getThemeColor } = useBranding();
  const themeColor = getThemeColor();

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
      void refreshCart();
      return () => {
        document.body.classList.remove("overflow-hidden");
      };
    }

    document.body.classList.remove("overflow-hidden");
    return undefined;
  }, [isOpen, refreshCart]);

  const hasItems = summary.items.length > 0;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeCart}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: themeColor }}
            >
              Quick Cart
            </p>
            <h2 className="text-lg font-bold text-gray-900">Your Bag</h2>
          </div>
          <button
            onClick={closeCart}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
              <ShoppingCart className="h-10 w-10 animate-pulse text-gray-400" />
              <p className="text-sm">Updating your cart...</p>
            </div>
          ) : !hasItems ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingCart className="h-12 w-12 text-gray-300" />
              <div>
                <h3 className="text-base font-semibold text-gray-800">Your bag is empty</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Browse products and add your favourites to see them here.
                </p>
              </div>
              <Link
                href="/shop"
                onClick={closeCart}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Start Shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {summary.items.map((item) => (
                <div key={item.productId} className="flex gap-4 rounded-2xl border border-gray-100 p-3 shadow-sm">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400">
                        <ShoppingCart className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-500">SKU: {item.sku ?? "—"}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(item.price, item.currency)}
                      </span>
                      <span className="text-gray-500">x {item.quantity}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Line total</span>
                      <span className="font-semibold text-gray-800">
                        {formatCurrency(item.lineTotal, item.currency)}
                      </span>
                    </div>
                  </div>
                  <button
                    className="self-start rounded-full border border-gray-200 p-2 text-gray-400 transition hover:border-red-200 hover:text-red-500"
                    aria-label="Remove item"
                    onClick={async () => {
                      try {
                        const response = await fetch("/api/public/shop/cart", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ productId: item.productId, quantity: 0 }),
                        });
                        if (!response.ok) {
                          throw new Error("Failed to remove item");
                        }
                        await refreshCart();
                        await refreshCartCount();
                      } catch (removeError) {
                        console.error("Failed to remove cart item", removeError);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error ? (
            <p className="mt-4 text-xs text-red-500">{error}</p>
          ) : null}
        </div>

        <div className="border-t border-gray-100 px-6 py-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(summary.subtotal, "GHS")}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>VAT (12.5%)</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(summary.tax, "GHS")}
              </span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(summary.total, "GHS")}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/shop/cart"
              onClick={closeCart}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{
                borderColor: themeColor,
                color: themeColor,
              }}
            >
              View Full Cart
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/shop/checkout"
              onClick={closeCart}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: themeColor }}
            >
              Proceed to Checkout
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
