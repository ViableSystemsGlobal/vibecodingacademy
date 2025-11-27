import { Suspense } from "react";
import type { Metadata } from "next";
import EcommerceAnalyticsClient from "./pageClient";

export const metadata: Metadata = {
  title: "Ecommerce Analytics | Sales Management System",
  description: "View ecommerce analytics, revenue trends, and performance metrics",
};

export default function EcommerceAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading analytics...</div>}>
      <EcommerceAnalyticsClient />
    </Suspense>
  );
}

