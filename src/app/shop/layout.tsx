"use client";

import { EcommerceLayout } from "@/components/ecommerce/layout";
import { CustomerAuthProvider } from "@/contexts/customer-auth-context";
import { useEffect } from "react";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Update document title for shop pages
    const updateTitle = () => {
      const path = window.location.pathname;
      if (path.startsWith('/shop')) {
        if (path === '/shop') {
          document.title = "Shop | Ecommerce";
        } else if (path.includes('/products/')) {
          // Title will be set by product detail page
        } else if (path.includes('/cart')) {
          document.title = "Shopping Cart | Ecommerce";
        } else if (path.includes('/checkout')) {
          document.title = "Checkout | Ecommerce";
        } else if (path.includes('/account')) {
          document.title = "My Account | Ecommerce";
        } else if (path.includes('/wishlist')) {
          document.title = "Wishlist | Ecommerce";
        } else if (path.includes('/compare')) {
          document.title = "Compare Products | Ecommerce";
        }
      }
    };
    updateTitle();
    // Update on navigation
    const interval = setInterval(updateTitle, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <CustomerAuthProvider>
      <EcommerceLayout>{children}</EcommerceLayout>
    </CustomerAuthProvider>
  );
}
