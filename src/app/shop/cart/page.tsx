"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, CreditCard, Package } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/toast-context";
import { useBranding } from "@/contexts/branding-context";

interface CartItem {
  productId: string;
  name: string;
  sku: string | null;
  price: number;
  currency: string;
  quantity: number;
  maxQuantity: number;
  lineTotal: number;
  image: string | null;
}

interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { getThemeColor } = useBranding();
  const themeColor = getThemeColor();

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/public/shop/cart");
      const data = await response.json();
      setCart(data);
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId: string, newQuantity: number) => {
    try {
      setUpdating(productId);
      const response = await fetch("/api/public/shop/cart", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          quantity: newQuantity,
        }),
      });

      if (response.ok) {
        await fetchCart();
        success("Cart updated");
      } else {
        showError("Failed to update quantity", "Please try again");
      }
    } catch (error) {
      console.error("Failed to update quantity:", error);
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (productId: string) => {
    await updateQuantity(productId, 0);
  };

  const clearCart = async () => {
    if (confirm("Are you sure you want to clear your cart?")) {
      try {
        const response = await fetch("/api/public/shop/cart", {
          method: "DELETE",
        });

        if (response.ok) {
          await fetchCart();
        }
      } catch (error) {
        console.error("Failed to clear cart:", error);
      }
    }
  };

  const formatPrice = (price: number, currency: string = "GHS") => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="h-20 w-20 bg-gray-200 rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
                <p className="text-gray-500 mb-6">Start shopping to add items to your cart</p>
                <Link
                  href="/shop"
                  className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Continue Shopping</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
              <p className="text-gray-500 mt-2">
                {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} in your cart
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {/* Cart Items */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">Cart Items</h2>
                      <button
                        onClick={clearCart}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Clear Cart
                      </button>
                    </div>
                  </div>

                  <div className="divide-y">
                    {cart.items.map((item) => (
                      <div key={item.productId} className="p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:space-x-4 sm:gap-0">
                          {/* Product Image */}
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-24 w-24 object-cover rounded-lg sm:h-20 sm:w-20"
                            />
                          ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-gray-200 sm:h-20 sm:w-20">
                              <Package className="h-8 w-8 text-gray-400" />
                            </div>
                          )}

                          {/* Product Details */}
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{item.name}</h3>
                            {item.sku && (
                              <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                            )}
                            <p className="text-lg font-semibold text-gray-900 mt-1">
                              {formatPrice(item.price, item.currency)}
                            </p>
                          </div>

                          {/* Quantity Controls */}
                          <div className="mt-2 flex items-center space-x-2 sm:mt-0">
                            <button
                              onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                              disabled={updating === item.productId || item.quantity <= 1}
                              className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Minus className="h-4 w-4" />
                            </button>

                            <span className="w-12 text-center font-medium">{item.quantity}</span>

                            <button
                              onClick={() => updateQuantity(item.productId, Math.min(item.maxQuantity, item.quantity + 1))}
                              disabled={updating === item.productId || item.quantity >= item.maxQuantity}
                              className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Line Total */}
                          <div className="mt-2 text-right sm:mt-0">
                            <p className="font-semibold text-gray-900">
                              {formatPrice(item.lineTotal, item.currency)}
                            </p>
                            <button
                              onClick={() => removeItem(item.productId)}
                              disabled={updating === item.productId}
                              className="text-red-600 hover:text-red-700 mt-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {item.maxQuantity <= 5 && (
                          <p className="text-sm text-orange-600 mt-2">
                            Only {item.maxQuantity} left in stock
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Continue Shopping Link */}
                <Link
                  href="/shop"
                  className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mt-4"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Continue Shopping</span>
                </Link>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="rounded-lg bg-white p-6 shadow lg:sticky lg:top-6">
                  <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

                  <div className="space-y-3">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatPrice(cart.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>VAT (12.5%)</span>
                      <span>{formatPrice(cart.tax)}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total</span>
                        <span>{formatPrice(cart.total)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push("/shop/checkout")}
                    className="mt-6 flex w-full items-center justify-center space-x-2 rounded-full px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-95"
                    style={{ backgroundColor: themeColor }}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span>Proceed to Checkout</span>
                  </button>

                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">
                      🔒 Secure checkout powered by your trusted admin system
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}