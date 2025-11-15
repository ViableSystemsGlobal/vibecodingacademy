"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Select } from "@/components/ui/select";
import { useTheme } from "@/contexts/theme-context";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import {
  Loader2,
  Search,
  Users,
  Wallet,
  Sparkles,
  ArrowUpRight,
  RefreshCcw,
  Mail,
  Phone,
} from "lucide-react";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";

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

type CustomersResponse = {
  data: EcommerceCustomer[];
  metrics: {
    totalCustomers: number;
    outstandingCod: number;
    activeCustomers: number;
    newCustomers: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

const STATUS_OPTIONS = [
  { value: "all", label: "All customers" },
  { value: "overdue", label: "COD outstanding" },
  { value: "inactive", label: "Inactive (30d)" },
];

export default function EcommerceCustomersClient() {
  const { getThemeColor } = useTheme();
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const [customers, setCustomers] = useState<EcommerceCustomer[]>([]);
  const [summary, setSummary] = useState<CustomersResponse["metrics"]>({
    totalCustomers: 0,
    outstandingCod: 0,
    activeCustomers: 0,
    newCustomers: 0,
  });
  const [pagination, setPagination] =
    useState<CustomersResponse["pagination"]>({
      page: 1,
      limit: 20,
      total: 0,
      pages: 1,
    });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchCustomers = useCallback(
    async (pageOverride?: number) => {
      setLoading(true);
      try {
        const nextPage = pageOverride ?? pagination.page;
        const params = new URLSearchParams();
        params.set("page", String(nextPage));
        params.set("limit", String(pagination.limit));
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== "all") params.set("status", statusFilter);

        const response = await fetch(
          `/api/ecommerce/customers?${params.toString()}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(
            errorPayload.error || "Failed to fetch ecommerce customers"
          );
        }

        const payload = (await response.json()) as CustomersResponse;
        setCustomers(payload.data || []);
        setSummary(payload.metrics);
        setPagination(payload.pagination);
      } catch (error) {
        console.error("Failed to load ecommerce customers", error);
        toastError(
          "Failed to fetch ecommerce customers",
          error instanceof Error ? error.message : undefined
        );
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, search, statusFilter, toastError]
  );

  useEffect(() => {
    fetchCustomers(1);
  }, [statusFilter, search, fetchCustomers]);

  const handlePageChange = (direction: "next" | "prev") => {
    if (direction === "prev" && pagination.page > 1) {
      fetchCustomers(pagination.page - 1);
    } else if (direction === "next" && pagination.page < pagination.pages) {
      fetchCustomers(pagination.page + 1);
    }
  };

  const refreshCurrentPage = () => {
    fetchCustomers(pagination.page);
  };



  const outstandingBadge = (value: number) => {
    if (value > 0) {
      return (
        <Badge className="bg-red-100 text-red-700">
          {formatCurrency(value, "GHS")}
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-100 text-emerald-700">Settled</Badge>
    );
  };

  const customerStatusBadge = (status: string) => {
    if (status === "OUTSTANDING") {
      return (
        <Badge className="bg-amber-100 text-amber-800">COD Outstanding</Badge>
      );
    }
    return <Badge className="bg-emerald-100 text-emerald-700">Clear</Badge>;
  };

  const metricsCards = useMemo(
    () => [
      {
        title: "Total Customers",
        value: summary.totalCustomers,
        icon: <Users className="h-8 w-8 text-gray-300" />,
      },
      {
        title: "Outstanding COD",
        value: formatCurrency(summary.outstandingCod, "GHS"),
        icon: <Wallet className="h-8 w-8 text-amber-500" />,
      },
      {
        title: "Active (30d)",
        value: summary.activeCustomers,
        icon: <Sparkles className="h-8 w-8 text-blue-500" />,
      },
      {
        title: "New This Month",
        value: summary.newCustomers,
        icon: <ArrowUpRight className="h-8 w-8 text-emerald-500" />,
      },
    ],
    [summary]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Ecommerce Customers
          </h1>
          <p className="text-gray-500 mt-1">
            Review online customer history, COD balances, and fulfillment
            activity.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refreshCurrentPage}
          className="inline-flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AIRecommendationCard
            title="Ecommerce Customers AI"
            subtitle="Get follow-up priorities and COD collection prompts."
            page="ecommerce-orders"
            enableAI
            onRecommendationComplete={(id) =>
              console.log("Ecommerce customers recommendation completed:", id)
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {metricsCards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.title}</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {card.value}
                    </p>
                  </div>
                  {card.icon}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-3 flex-col sm:flex-row">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Orders
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Outstanding
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Order
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          <span>Loading ecommerce customers...</span>
                        </div>
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        No ecommerce customers found.
                      </td>
                    </tr>
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">
                            {customer.name}
                          </div>
                          <div className="text-xs text-gray-500 capitalize">
                            {customer.type?.toLowerCase()}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          <div className="flex flex-col gap-1">
                            {customer.email ? (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3 text-gray-400" />
                                {customer.email}
                              </span>
                            ) : null}
                            {customer.phone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-gray-400" />
                                {customer.phone}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4">{customerStatusBadge(customer.status)}</td>
                        <td className="px-4 py-4 text-right text-sm text-gray-900">
                          {customer.metrics.totalOrders}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-900">
                          {formatCurrency(customer.metrics.totalValue, "GHS")}
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-900">
                          {outstandingBadge(customer.metrics.outstandingBalance)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {customer.metrics.lastOrderDate
                            ? formatDate(customer.metrics.lastOrderDate)
                            : "—"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/ecommerce/customers/${customer.id}`)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {customers.length} of {pagination.total} customers
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1 || loading}
                onClick={() => handlePageChange("prev")}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.pages || loading}
                onClick={() => handlePageChange("next")}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}


