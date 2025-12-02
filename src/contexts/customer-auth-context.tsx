"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast-context";

interface Customer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string; // For backward compatibility
  phone?: string;
  createdAt: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  lastLoginAt?: string;
}

interface CustomerAuthContextType {
  customer: Customer | null;
  loading: boolean;
  login: (email: string, password: string, recaptchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData, recaptchaToken?: string) => Promise<void>;
  refreshCartCount: () => Promise<void>;
  cartCount: number;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

const CustomerAuthContext = createContext<CustomerAuthContextType>({
  customer: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  register: async () => {},
  refreshCartCount: async () => {},
  cartCount: 0,
});

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const router = useRouter();
  const { success, error } = useToast();

  const fetchCartCount = useCallback(async () => {
    try {
      const response = await fetch("/api/public/shop/cart", {
        credentials: "include",
      });
      if (!response.ok) {
        setCartCount(0);
        return;
      }
      const data = await response.json();
      setCartCount(data.itemCount || 0);
    } catch (err) {
      setCartCount(0);
    }
  }, []);

  // Check if customer is logged in on mount
  useEffect(() => {
    checkAuth();
    void fetchCartCount();
  }, [fetchCartCount]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/public/shop/auth/me", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.customer) {
          setCustomer(data.customer);
        } else {
          setCustomer(null);
        }
      } else {
        // Not authenticated, set customer to null
        setCustomer(null);
      }
      await fetchCartCount();
    } catch (err) {
      console.error("Auth check failed:", err);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, recaptchaToken?: string) => {
    try {
      const response = await fetch("/api/public/shop/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, recaptchaToken }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      setCustomer(data.customer);
      await fetchCartCount();
      success("Login successful!");
      router.push("/shop/account");
    } catch (err) {
      error(err instanceof Error ? err.message : "Login failed");
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/public/shop/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      setCustomer(null);
      success("Logged out successfully");
      router.push("/shop");
    } catch (err) {
      error("Logout failed");
    }
  };

  const register = async (data: RegisterData, recaptchaToken?: string) => {
    try {
      const response = await fetch("/api/public/shop/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...data, recaptchaToken }),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Registration failed");
      }

      setCustomer(result.customer);
      await fetchCartCount();
      success("Registration successful!");
      router.push("/shop/account");
    } catch (err) {
      error(err instanceof Error ? err.message : "Registration failed");
      throw err;
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        loading,
        login,
        logout,
        register,
        refreshCartCount: fetchCartCount,
        cartCount,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  }
  return context;
}
