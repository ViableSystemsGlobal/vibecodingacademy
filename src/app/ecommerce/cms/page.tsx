import { Suspense } from "react";
import type { Metadata } from "next";
import EcommerceCmsClient from "./pageClient";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Ecommerce CMS | Sales Management System",
  description: "Manage storefront content, sections, and promotional banners",
};

export default function EcommerceCmsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <EcommerceCmsClient />
    </Suspense>
  );
}
