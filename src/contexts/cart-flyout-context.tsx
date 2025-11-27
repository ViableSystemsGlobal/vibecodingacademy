"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCustomerAuth } from "@/contexts/customer-auth-context";

interface CartItemSummary {
  productId: string;
  name: string;
  sku?: string;
  price: number;
  currency: string;
  quantity: number;
  maxQuantity?: number;
  lineTotal: number;
  image?: string | null;
}

interface CartSummary {
  items: CartItemSummary[];
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
}

interface CartFlyoutContextValue {
  isOpen: boolean;
  summary: CartSummary;
  loading: boolean;
  error: string | null;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  refreshCart: () => Promise<void>;
}

const DEFAULT_SUMMARY: CartSummary = {
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  itemCount: 0,
};

const CartFlyoutContext = createContext<CartFlyoutContextValue | undefined>(undefined);

export function CartFlyoutProvider({ children }: { children: React.ReactNode }) {
  const { cartCount } = useCustomerAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<CartSummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/public/shop/cart", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load cart");
      }

      const data = await response.json();
      setSummary({
        items: data.items ?? [],
        subtotal: data.subtotal ?? 0,
        tax: data.tax ?? 0,
        total: data.total ?? 0,
        itemCount: data.itemCount ?? 0,
      });
    } catch (fetchError) {
      console.error("Error loading cart summary", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load cart");
      setSummary(DEFAULT_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  const openCart = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleCart = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isOpen) {
      void refreshCart();
    }
  }, [isOpen, refreshCart]);

  useEffect(() => {
    void refreshCart();
  }, [cartCount, refreshCart]);

  const value = useMemo<CartFlyoutContextValue>(() => ({
    isOpen,
    summary,
    loading,
    error,
    openCart,
    closeCart,
    toggleCart,
    refreshCart,
  }), [isOpen, summary, loading, error, openCart, closeCart, toggleCart, refreshCart]);

  return (
    <CartFlyoutContext.Provider value={value}>
      {children}
    </CartFlyoutContext.Provider>
  );
}

export function useCartFlyout() {
  const context = useContext(CartFlyoutContext);
  if (context === undefined) {
    throw new Error("useCartFlyout must be used within a CartFlyoutProvider");
  }
  return context;
}
