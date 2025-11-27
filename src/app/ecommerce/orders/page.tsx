import { Suspense } from "react";
import type { Metadata } from "next";
import EcommerceOrdersClient from "./pageClient";

export const metadata: Metadata = {
  title: "Ecommerce Orders | Sales Management System",
  description: "Manage and track ecommerce orders, fulfillment, and delivery",
};

export default function EcommerceOrdersPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading orders...</div>}>
      <EcommerceOrdersClient />
    </Suspense>
  );
}

