"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/theme-context";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import {
  Loader2,
  Users,
  Phone,
  Mail,
  User,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  ArrowLeft,
  Plus,
  Sparkles,
} from "lucide-react";
import SendCustomerEmailModal from "@/components/modals/send-customer-email-modal";

type CustomerMetrics = {
  totalOrders: number;
  totalValue: number;
  outstandingBalance: number;
  lastOrderDate: string | null;
  ordersLast30Days: number;
};

type CustomerOrder = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  total: number;
  paymentStatus: string | null;
  amountDue: number;
  amountPaid: number;
};

type EcommerceCustomer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    role: string | null;
  }>;
  metrics: CustomerMetrics;
  latestOrder: CustomerOrder | null;
  recentOrders: CustomerOrder[];
  status: string;
};

export default function EcommerceCustomerDetailClient({
  customerId,
}: {
  customerId: string;
}) {
  const { getThemeColor } = useTheme();
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const [customer, setCustomer] = useState<EcommerceCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      // First, get all customers to find the one with matching ID
      const response = await fetch(`/api/ecommerce/customers?limit=1000`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(
          errorPayload.error || "Failed to fetch ecommerce customers"
        );
      }

      const payload = await response.json();
      const foundCustomer = payload.data?.find(
        (c: EcommerceCustomer) => c.id === customerId
      );

      if (!foundCustomer) {
        throw new Error("Customer not found");
      }

      setCustomer(foundCustomer);
    } catch (error) {
      console.error("Failed to load ecommerce customer", error);
      toastError(
        "Failed to fetch customer details",
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [customerId, toastError]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const handleCallCustomer = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleEmailCustomer = (email: string) => {
    setEmailModalOpen(true);
  };

  const handleViewAllOrders = (accountId: string) => {
    router.push(`/ecommerce/orders?account=${accountId}`);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toastError("Please enter a note");
      return;
    }
    // TODO: In a real implementation, save the note to the account via API
    toastSuccess("Follow-up note added successfully");
    setNewNote("");
  };

  const customerStatusBadge = (status: string) => {
    if (status === "OUTSTANDING") {
      return (
        <Badge className="bg-amber-100 text-amber-800">COD Outstanding</Badge>
      );
    }
    return <Badge className="bg-emerald-100 text-emerald-700">Clear</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="text-gray-500">Loading customer details...</span>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Customer Not Found
          </h2>
          <p className="text-gray-500 mb-4">
            The customer you're looking for doesn't exist.
          </p>
          <Button onClick={() => router.push("/ecommerce/customers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/ecommerce/customers")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-gray-500 mt-1">
            Joined {formatDate(customer.createdAt)}
          </p>
        </div>
        {customerStatusBadge(customer.status)}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span>{customer.name}</span>
            </div>
            {customer.email ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{customer.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEmailCustomer(customer.email!)}
                >
                  <Mail className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
            {customer.phone ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{customer.phone}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCallCustomer(customer.phone!)}
                >
                  <Phone className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
            {customer.owner ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Sparkles className="h-3 w-3" />
                <span>Owner: {customer.owner.name ?? "System"}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Total orders</span>
              <span className="font-medium">{customer.metrics.totalOrders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total value</span>
              <span className="font-medium">
                {formatCurrency(customer.metrics.totalValue, "GHS")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Outstanding COD</span>
              <span className="font-medium">
                {formatCurrency(customer.metrics.outstandingBalance, "GHS")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Orders (30d)</span>
              <span className="font-medium">
                {customer.metrics.ordersLast30Days}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Primary Contacts
        </h3>
        {customer.contacts.length === 0 ? (
          <p className="text-sm text-gray-500">No contacts captured yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {customer.contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="p-4 space-y-1 text-sm text-gray-700">
                  <div className="font-medium">
                    {contact.firstName} {contact.lastName}
                  </div>
                  {contact.role ? (
                    <div className="text-xs text-gray-500">{contact.role}</div>
                  ) : null}
                  {contact.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-gray-400" />
                      <span>{contact.email}</span>
                    </div>
                  ) : null}
                  {contact.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-gray-400" />
                      <span>{contact.phone}</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {customer.status === "OUTSTANDING" && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">
              COD Follow-up Notes
            </h3>
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a follow-up note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddNote();
                    }
                  }}
                />
                <Button onClick={handleAddNote} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Track follow-up attempts for COD collection
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Recent Orders</h3>
          <div className="flex items-center gap-2">
            {customer.status === "OUTSTANDING" ? (
              <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                COD Outstanding
              </Badge>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewAllOrders(customer.id)}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View All Orders
            </Button>
          </div>
        </div>
        {customer.recentOrders.length === 0 ? (
          <p className="text-sm text-gray-500">
            No ecommerce orders recorded yet.
          </p>
        ) : (
          <div className="border rounded-lg divide-y divide-gray-100">
            {customer.recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/ecommerce/orders?order=${order.id}`)}
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">{order.number}</div>
                    <div className="text-xs text-gray-500">
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{formatCurrency(order.total, "GHS")}</span>
                  <Badge className="bg-gray-100 text-gray-700 capitalize">
                    {order.status.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                  <Badge
                    className={
                      order.paymentStatus === "PAID"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }
                  >
                    {order.paymentStatus || "UNPAID"}
                  </Badge>
                  <ArrowUpRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {customer.email && (
        <SendCustomerEmailModal
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          customerName={customer.name}
          emailAddress={customer.email}
        />
      )}
    </div>
  );
}

