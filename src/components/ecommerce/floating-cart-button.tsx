"use client";

import { ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import { useCartFlyout } from "@/contexts/cart-flyout-context";
import { useCustomerAuth } from "@/contexts/customer-auth-context";
import { formatCurrency } from "@/lib/utils";

export function FloatingCartButton() {
  const { openCart, summary } = useCartFlyout();
  const { cartCount } = useCustomerAuth();

  const itemCount = summary.itemCount ?? cartCount ?? 0;
  const totalLabel = useMemo(() => {
    if (summary.total > 0) {
      return formatCurrency(summary.total, "GHS");
    }
    return formatCurrency(0, "GHS");
  }, [summary.total]);

  return (
    <button
      type="button"
      onClick={openCart}
      className="group fixed right-0 top-1/2 z-40 flex h-24 -translate-y-1/2 flex-col items-center rounded-l-2xl border border-[#23185c]/20 border-r-0 bg-white px-1.5 py-2 text-[9px] font-semibold text-[#23185c] shadow-[0_6px_18px_-12px_rgba(35,24,92,0.45)] transition hover:-translate-y-1/2 hover:shadow-[0_10px_24px_-12px_rgba(35,24,92,0.5)]"
      aria-label="View cart"
    >
      <span className="flex flex-col items-center gap-1 text-[#23185c]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#23185c]/10 text-[#23185c] transition group-hover:bg-[#23185c]/14">
          <ShoppingBag className="h-3 w-3" />
        </span>
        <span className="text-[8px] font-medium uppercase tracking-[0.18em] text-[#23185c]/70">
          Cart
        </span>
        <span className="text-[11px] font-semibold text-[#23185c]">
          {itemCount}
        </span>
      </span>
      <span className="mt-2 w-full rounded-full bg-[#23185c] px-2 py-0.5 text-center text-[10px] font-bold text-white transition group-hover:bg-[#1c1448]">
        {totalLabel}
      </span>
    </button>
  );
}
