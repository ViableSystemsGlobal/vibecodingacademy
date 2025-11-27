"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Package, ShoppingCart, Trash2 } from "lucide-react";
import { useWishlist } from "@/contexts/wishlist-context";
import { useToast } from "@/contexts/toast-context";
import { useCustomerAuth } from "@/contexts/customer-auth-context";

const formatCurrency = (amount: number, currency: string = "GHS") =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
  }).format(amount);

export default function WishlistPage() {
  const { items, removeItem, clear, isLoading } = useWishlist();
  const { success, error } = useToast();
  const { refreshCartCount } = useCustomerAuth();
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  const handleAddToCart = async (productId: string) => {
    try {
      setAddingProductId(productId);
      const response = await fetch("/api/public/shop/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to add to cart");
      }

      success("Added to cart", "Item moved to your bag");
      await refreshCartCount();
    } catch (err) {
      console.error("Failed to add wishlist item to cart:", err);
      error(
        "Could not add to cart",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setAddingProductId(null);
    }
  };

  const handleRemove = (productId: string) => {
    removeItem(productId);
    success("Removed", "Item removed from your wishlist");
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
          <p className="text-gray-600 mt-1">
            Save your favourite products here and add them to your cart anytime.
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear Wishlist
            </button>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-[#23185c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1c1448]"
            >
              Continue Shopping
            </Link>
          </div>
        )}
      </div>

      <div className="mt-10">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#23185c]" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#23185c]/10 text-[#23185c]">
              <Heart className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">No favourites yet</h2>
            <p className="mt-2 text-gray-500">
              Tap the heart icon on products you love to save them here.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#23185c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1c1448]"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <Link href={`/shop/products/${item.id}`} className="relative block">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={400}
                      height={280}
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-gray-400">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                </Link>

                <div className="flex flex-1 flex-col px-5 py-5">
                  <Link href={`/shop/products/${item.id}`}>
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-[#23185c] transition">
                      {item.name}
                    </h3>
                  </Link>
                  <p className="mt-2 text-gray-700">
                    {formatCurrency(item.price, item.currency)}
                  </p>

                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={() => handleAddToCart(item.id)}
                      disabled={addingProductId === item.id}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#23185c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1c1448] disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {addingProductId === item.id ? "Adding..." : "Add to Cart"}
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

