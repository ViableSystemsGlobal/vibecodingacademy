"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useCustomerAuth } from "@/contexts/customer-auth-context";

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string | null;
  sku?: string | null;
  addedAt: string;
}

interface WishlistContextValue {
  items: WishlistItem[];
  count: number;
  isLoading: boolean;
  addItem: (item: Omit<WishlistItem, "addedAt">) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  isInWishlist: (id: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "poolshop-wishlist-v1";
const DEFAULT_PROFILE = "guest";

type WishlistStorage = Record<string, WishlistItem[]>;

function safeParseStorage(value: string | null): WishlistStorage {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getProfileKey(email?: string | null) {
  if (!email) return DEFAULT_PROFILE;
  return email.trim().toLowerCase() || DEFAULT_PROFILE;
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { customer } = useCustomerAuth();
  const profileKey = getProfileKey(customer?.email);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storage = safeParseStorage(localStorage.getItem(STORAGE_KEY));
    setItems(storage[profileKey] ?? []);
    setIsLoading(false);
  }, [profileKey]);

  useEffect(() => {
    if (typeof window === "undefined" || isLoading) return;
    const storage = safeParseStorage(localStorage.getItem(STORAGE_KEY));
    storage[profileKey] = items;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    } catch (error) {
      console.warn("Failed to persist wishlist:", error);
    }
  }, [items, profileKey, isLoading]);

  const addItem = (item: Omit<WishlistItem, "addedAt">) => {
    setItems((previous) => {
      if (previous.some((existing) => existing.id === item.id)) {
        return previous;
      }
      return [
        {
          ...item,
          addedAt: new Date().toISOString(),
        },
        ...previous,
      ];
    });
  };

  const removeItem = (id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  };

  const clear = () => {
    setItems([]);
  };

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      count: items.length,
      isLoading,
      addItem,
      removeItem,
      clear,
      isInWishlist: (id: string) => items.some((item) => item.id === id),
    }),
    [items, isLoading]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}

