import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import EcommerceCustomerDetailClient from "./pageClient";

export const metadata: Metadata = {
  title: "Customer Details | Ecommerce | Sales Management System",
  description: "View customer details, order history, and account information",
};

export default async function EcommerceCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  return <EcommerceCustomerDetailClient customerId={id} />;
}

