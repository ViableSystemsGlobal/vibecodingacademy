import { Metadata } from "next";
import { Suspense } from "react";
import BestDealsClient from "./pageClient";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Best Deals | Ecommerce | Sales Management System",
  description: "Manage products featured in the Best Deals section on the homepage.",
};

export default function BestDealsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <BestDealsClient />
    </Suspense>
  );
}

