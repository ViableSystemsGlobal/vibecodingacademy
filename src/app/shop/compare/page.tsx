"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GitCompare, Package, ShoppingCart, Trash2, X } from "lucide-react";
import { useCompare } from "@/contexts/compare-context";
import { useToast } from "@/contexts/toast-context";
import { useCustomerAuth } from "@/contexts/customer-auth-context";

const ATTRIBUTES = [
  {
    key: "price",
    label: "Price",
    render: (item: any) =>
      formatCurrency(item.price, item.currency),
  },
  {
    key: "sku",
    label: "SKU",
    render: (item: any) => item.sku ?? "—",
  },
  {
    key: "categoryName",
    label: "Category",
    render: (item: any) => item.categoryName ?? "—",
  },
  {
    key: "inStock",
    label: "Availability",
    render: (item: any) =>
      item.inStock
        ? item.stockQuantity && item.stockQuantity > 0
          ? `${item.stockQuantity} in stock`
          : "In stock"
        : "Out of stock",
  },
];

function formatCurrency(amount: number, currency: string = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
  }).format(amount);
}

export default function ComparePage() {
  const { items, removeItem, clear, isLoading, maxItems } = useCompare();
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
      console.error("Failed to add comparison item to cart:", err);
      error(
        "Could not add to cart",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setAddingProductId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Compare Products</h1>
          <p className="text-gray-600 mt-1">
            You can compare up to {maxItems} products at once to find the perfect match.
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
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
              <GitCompare className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Nothing to compare yet</h2>
            <p className="mt-2 text-gray-500">
              Add products to the comparison tray from the shop to see them side by side.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#23185c] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1c1448]"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid gap-6"
              style={{
                gridTemplateColumns: `200px repeat(${items.length}, minmax(220px, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-5">
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Compare Tray
                  </p>
                  <p className="text-xs text-gray-500">
                    {items.length} of {maxItems} items selected
                  </p>
                </div>
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm"
                >
                  <div className="relative">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="absolute right-3 top-3 rounded-full bg-black/50 p-1 text-white transition hover:bg-black/70"
                      aria-label={`Remove ${item.name} from comparison`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={300}
                        height={220}
                        className="h-48 w-full rounded-t-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center rounded-t-2xl bg-gray-100 text-gray-400">
                        <Package className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-5 py-4">
                    <Link
                      href={`/shop/products/${item.id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-[#23185c] transition line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-2 text-sm font-medium text-[#23185c]">
                      {formatCurrency(item.price, item.currency)}
                    </p>
                    <div className="mt-4 space-y-2 text-xs text-gray-500">
                      <p>{item.categoryName ?? "General"}</p>
                      <p>
                        {item.inStock
                          ? item.stockQuantity && item.stockQuantity > 0
                            ? `${item.stockQuantity} in stock`
                            : "In stock"
                          : "Out of stock"}
                      </p>
                    </div>
                    <div className="mt-auto flex flex-col gap-2 pt-4">
                      <button
                        onClick={() => handleAddToCart(item.id)}
                        disabled={addingProductId === item.id}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#23185c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1c1448] disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {addingProductId === item.id ? "Adding..." : "Add to Cart"}
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Attribute rows */}
              {ATTRIBUTES.map((attribute) => (
                <div
                  key={attribute.key}
                  className="contents rounded-2xl border border-gray-100 bg-white"
                >
                  <div className="rounded-2xl bg-gray-50 px-4 py-5 text-sm font-semibold text-gray-700">
                    {attribute.label}
                  </div>
                  {items.map((item) => (
                    <div
                      key={`${attribute.key}-${item.id}`}
                      className="px-5 py-5 text-sm text-gray-700"
                    >
                      {attribute.render(item)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

