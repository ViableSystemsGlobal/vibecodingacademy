import { Suspense } from "react";
import type { Metadata } from "next";
import EcommerceCategoriesClient from "./pageClient";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Ecommerce Categories | Sales Management System",
  description: "Manage product categories and merchandising for your ecommerce store",
};

export default function EcommerceCategoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <EcommerceCategoriesClient />
    </Suspense>
  );
}

