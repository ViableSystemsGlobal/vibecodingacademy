"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Search,
  Filter,
  Plus,
  Eye,
  Trash2,
  Download,
  CreditCard,
  Building,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { AddPaymentModal } from "@/components/modals/add-payment-modal";
import { ConfirmationModal } from "@/components/modals/confirmation-modal";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

interface Payment {
  id: string;
  number: string;
  amount: number;
  method: string;
  reference?: string;
  receivedAt: string;
  account: {
    id: string;
    name: string;
  };
  receiver: {
    name: string;
  };
  allocations: Array<{
    invoice: {
      id: string;
      number: string;
    };
    amount: number;
  }>;
}

const PAYMENT_METHODS = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  MOBILE_MONEY: 'Mobile Money',
  CREDIT_CARD: 'Credit Card',
  CHECK: 'Check'
};

export default function PaymentsPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currency, setCurrency] = useState('GHS');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  // Metrics
  const [metrics, setMetrics] = useState({
    totalPayments: 0,
    totalAmount: 0,
    thisMonth: 0,
    lastMonth: 0
  });

  useEffect(() => {
    loadPayments();
    fetchCurrencySettings();
  }, [filterMethod, currentPage]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMethod]);

  const fetchCurrencySettings = async () => {
    try {
      const response = await fetch('/api/settings/currency');
      if (response.ok) {
        const data = await response.json();
        setCurrency(data.baseCurrency || 'GHS');
      }
    } catch (err) {
      console.error('Error fetching currency settings:', err);
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      const url = new URL('/api/payments', window.location.origin);
      url.searchParams.append('page', currentPage.toString());
      url.searchParams.append('limit', itemsPerPage.toString());
      
      if (filterMethod) {
        url.searchParams.append('method', filterMethod);
      }

      const response = await fetch(url.toString(), {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments || []);
        setTotalCount(data.total || 0);
        
        // For metrics, we need all payments data
        if (data.allPayments) {
          calculateMetrics(data.allPayments);
        } else {
          calculateMetrics(data.payments || []);
        }
      } else {
        showError('Failed to load payments');
      }
    } catch (err) {
      console.error('Error loading payments:', err);
      showError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (paymentsData: Payment[]) => {
    const now = new Date();
    const thisMonth = paymentsData.filter(p => {
      const paymentDate = new Date(p.receivedAt);
      return paymentDate.getMonth() === now.getMonth() && 
             paymentDate.getFullYear() === now.getFullYear();
    });
    
    const lastMonth = paymentsData.filter(p => {
      const paymentDate = new Date(p.receivedAt);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return paymentDate >= lastMonthDate && paymentDate < new Date(now.getFullYear(), now.getMonth(), 1);
    });

    setMetrics({
      totalPayments: paymentsData.length,
      totalAmount: paymentsData.reduce((sum, p) => sum + p.amount, 0),
      thisMonth: thisMonth.reduce((sum, p) => sum + p.amount, 0),
      lastMonth: lastMonth.reduce((sum, p) => sum + p.amount, 0)
    });
  };

  const handleDelete = async () => {
    if (!selectedPayment) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/payments/${selectedPayment.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        success('Payment deleted successfully');
        loadPayments();
        setShowDeleteModal(false);
        setSelectedPayment(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete payment');
      }
    } catch (err) {
      console.error('Error deleting payment:', err);
      showError(err instanceof Error ? err.message : 'Failed to delete payment');
    } finally {
      setDeleting(false);
    }
  };

  // Client-side search within current page (only searches current page results)
  const filteredPayments = payments.filter(payment => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      payment.number.toLowerCase().includes(search) ||
      payment.account.name.toLowerCase().includes(search) ||
      payment.reference?.toLowerCase().includes(search) ||
      payment.allocations.some(alloc => 
        alloc.invoice.number.toLowerCase().includes(search)
      )
    );
  });

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
            <p className="text-gray-600 mt-1">Track and manage customer payments</p>
          </div>
          <Button
            onClick={() => setShowPaymentModal(true)}
            className="hover:opacity-90 text-white"
            style={{ backgroundColor: getThemeColor() }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>

        {/* AI Card + Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* AI Recommendation Card - Left Side (2/5) */}
          <div className="lg:col-span-2">
            <AIRecommendationCard
              title="Payment Management AI"
              subtitle="Your intelligent assistant for cash flow optimization"
              page="payments"
              enableAI={true}
              onRecommendationComplete={(id) => {
                console.log('Recommendation completed:', id);
              }}
            />
          </div>

          {/* Metrics Cards - Right Side (3/5, 2x2 Grid) */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Payments</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 break-words">{metrics.totalPayments}</p>
                </div>
                <DollarSign className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Amount</p>
                  <p className={`text-lg sm:text-xl font-bold text-${theme.primary} break-words`}>{formatCurrency(metrics.totalAmount, currency)}</p>
                </div>
                <TrendingUp className={`h-6 w-6 text-${theme.primary} flex-shrink-0 mt-1`} />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">This Month</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600 break-words">{formatCurrency(metrics.thisMonth, currency)}</p>
                </div>
                <Calendar className="h-6 w-6 text-green-400 flex-shrink-0 mt-1" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Last Month</p>
                  <p className="text-lg sm:text-xl font-bold text-orange-600 break-words">{formatCurrency(metrics.lastMonth, currency)}</p>
                </div>
                <TrendingUp className="h-6 w-6 text-orange-400 flex-shrink-0 mt-1" />
              </div>
            </Card>
          </div>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Search by payment number, customer, invoice, or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className="pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Methods</option>
                  {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading payments...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No payments found</p>
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  className="mt-4 hover:opacity-90 text-white"
                  style={{ backgroundColor: getThemeColor() }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Record First Payment
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Payment #</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Method</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Invoices</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Received By</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900">{payment.number}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <Building className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-gray-900">{payment.account.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-green-600">{formatCurrency(payment.amount, currency)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {PAYMENT_METHODS[payment.method as keyof typeof PAYMENT_METHODS] || payment.method}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            {payment.allocations.map((alloc, idx) => (
                              <Link
                                key={idx}
                                href={`/invoices/${alloc.invoice.id}`}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                {alloc.invoice.number}
                              </Link>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {formatDate(payment.receivedAt)}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {payment.receiver.name}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Delete payment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && filteredPayments.length > 0 && (
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} payments
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.ceil(totalCount / itemsPerPage) }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first page, last page, current page, and pages around current
                        const totalPages = Math.ceil(totalCount / itemsPerPage);
                        return page === 1 || 
                               page === totalPages || 
                               (page >= currentPage - 1 && page <= currentPage + 1);
                      })
                      .map((page, index, array) => (
                        <div key={page} className="flex items-center gap-1">
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                          <Button
                            onClick={() => setCurrentPage(page)}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            className="w-10"
                          >
                            {page}
                          </Button>
                        </div>
                      ))}
                  </div>
                  <Button
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
                    disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Modal */}
      <AddPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          loadPayments();
          setShowPaymentModal(false);
        }}
        accountId=""
        accountName=""
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPayment(null);
        }}
        onConfirm={handleDelete}
        title="Delete Payment"
        message={`Are you sure you want to delete payment ${selectedPayment?.number}? This action cannot be undone and will update the associated invoices.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={deleting}
      />
    </>
  );
}
