"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid3x3, ShoppingCart, User } from "lucide-react";
import { useCustomerAuth } from "@/contexts/customer-auth-context";
import { useCartFlyout } from "@/contexts/cart-flyout-context";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { customer, cartCount } = useCustomerAuth();
  const { openCart } = useCartFlyout();

  const isHomeActive = pathname === "/" || (pathname === "/shop" && !pathname.includes("?"));
  const isCategoriesActive = pathname.includes("view=categories") || pathname.includes("/categories");
  const isCartActive = pathname.includes("/cart") || pathname.includes("/checkout");

  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: Home,
      active: isHomeActive,
    },
    {
      label: "Categories",
      href: "/shop?view=categories",
      icon: Grid3x3,
      active: isCategoriesActive,
    },
    {
      label: "Basket",
      href: "#",
      icon: ShoppingCart,
      active: isCartActive,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        openCart();
      },
      badge: cartCount > 0 ? cartCount : null,
    },
    {
      label: "Account",
      href: customer ? "/shop/account" : "/shop/auth/login",
      icon: User,
      active: pathname.startsWith("/shop/account") || pathname.startsWith("/shop/auth"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isItemActive = item.active;
          
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isItemActive
                  ? "text-red-600"
                  : "text-gray-700"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`h-6 w-6 ${
                    isItemActive ? "text-red-600" : "text-gray-700"
                  }`}
                />
                {item.badge !== null && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-xs mt-1 ${
                  isItemActive ? "text-red-600 font-medium" : "text-gray-700"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

