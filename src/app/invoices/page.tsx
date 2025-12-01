"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { SendInvoiceModal } from "../../components/modals/send-invoice-modal";
import { SkeletonTable, SkeletonMetricCard } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { 
  Plus, 
  Search, 
  Filter,
  Download,
  Mail,
  Eye,
  Edit,
  Copy,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  MoreVertical,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface Invoice {
  id: string;
  number: string;
  subject: string;
  status: 'DRAFT' | 'SENT' | 'OVERDUE' | 'VOID';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  total: number;
  amountPaid: number;
  amountDue: number;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  taxInclusive?: boolean;
  notes?: string;
  account?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  distributor?: {
    id: string;
    businessName: string;
    email?: string;
    phone?: string;
  };
  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  lines?: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
  }>;
  owner: {
    id: string;
    name: string;
  };
}

// Component that uses useSearchParams
function InvoicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { success, error: showError } = useToast();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendInvoiceModalOpen, setSendInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // Bulk selection state
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [currency, setCurrency] = useState('GHS');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;

  // Stats
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalValue: 0,
    overdueAmount: 0,
    paidThisMonth: 0,
  });

  // Read URL parameters on mount
  useEffect(() => {
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    if (status) {
      setStatusFilter(status);
    }
    if (paymentStatus) {
      setPaymentStatusFilter(paymentStatus);
    }
  }, [searchParams]);

  // Initial load on mount
  useEffect(() => {
    loadInvoices(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Immediate effect for sorting and filters (skip initial mount)
  useEffect(() => {
    // Skip initial mount - already loaded above
    const isInitialMount = currentPage === 1 && !searchTerm && !statusFilter && !paymentStatusFilter && !sortBy;
    if (isInitialMount) {
      return;
    }
    loadInvoices(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, paymentStatusFilter, sortBy, sortOrder]);

  // Debounced search effect (including when cleared)
  const isMountedRef = useRef(false);
  useEffect(() => {
    // Skip initial mount (handled by initial load effect)
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      loadInvoices(1);
    }, searchTerm ? 500 : 0); // No debounce when clearing (empty search)

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  useEffect(() => {
    fetchCurrencySettings();
  }, []);

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

  const loadInvoices = async (page: number = currentPage) => {
    try {
      setLoading(true);
      const url = new URL('/api/invoices', window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('limit', itemsPerPage.toString());
      
      if (searchTerm) {
        url.searchParams.append('search', searchTerm);
      }
      if (statusFilter) {
        url.searchParams.append('status', statusFilter);
      }
      if (paymentStatusFilter) {
        url.searchParams.append('paymentStatus', paymentStatusFilter);
      }
      if (sortBy) {
        url.searchParams.append('sortBy', sortBy);
      }
      if (sortOrder) {
        url.searchParams.append('sortOrder', sortOrder);
      }
      
      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
        setTotalCount(data.pagination?.total || data.total || 0);
        setTotalPages(data.pagination?.pages || Math.ceil((data.pagination?.total || data.total || 0) / itemsPerPage));
        setCurrentPage(page);
        
        // Calculate stats from all invoices data
        const allInvoices = data.allInvoices || data.invoices || [];
        const totalInvoices = allInvoices.length;
        const totalValue = allInvoices.reduce((sum: number, inv: Invoice) => sum + inv.total, 0);
        const overdueAmount = allInvoices.filter((inv: Invoice) => 
          inv.status === 'OVERDUE' && inv.paymentStatus !== 'PAID'
        ).reduce((sum: number, inv: Invoice) => sum + inv.amountDue, 0);
        const paidThisMonth = allInvoices.filter((inv: Invoice) => 
          inv.paymentStatus === 'PAID' && 
          new Date(inv.paidDate || inv.issueDate).getMonth() === new Date().getMonth()
        ).reduce((sum: number, inv: Invoice) => sum + inv.total, 0);
        
        setStats({
          totalInvoices,
          totalValue,
          overdueAmount,
          paidThisMonth,
        });
      } else {
        showError("Failed to load invoices");
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      showError("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  // Handle sorting change
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  };
  
  // Handle search change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    loadInvoices(page);
  };

  // Bulk selection functions (updated for DataTable)
  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedInvoices(selectedIds);
  };

  const handleStatusUpdate = async (invoice: Invoice, newStatus: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus
        }),
      });

      if (response.ok) {
        success("Status Updated", `Invoice ${invoice.number} status updated to ${newStatus}`);
        loadInvoices();
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to update status");
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showError("Failed to update status");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
      SENT: { label: 'Sent', className: 'bg-blue-100 text-blue-800' },
      OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-800' },
      VOID: { label: 'Void', className: 'bg-gray-100 text-gray-500' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    const statusConfig = {
      UNPAID: { label: 'Unpaid', className: 'bg-red-100 text-red-800' },
      PARTIALLY_PAID: { label: 'Partially Paid', className: 'bg-yellow-100 text-yellow-800' },
      PAID: { label: 'Paid', className: 'bg-green-100 text-green-800' },
    };

    const config = statusConfig[paymentStatus as keyof typeof statusConfig] || statusConfig.UNPAID;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const isOverdueUnpaid = (invoice: Invoice) => {
    const today = new Date();
    const dueDate = new Date(invoice.dueDate);
    const isOverdue = dueDate < today;
    const isUnpaid = invoice.paymentStatus === 'UNPAID' || invoice.paymentStatus === 'PARTIALLY_PAID';
    return isOverdue && isUnpaid;
  };

  const getInvoiceRowClassName = (invoice: Invoice) => {
    if (isOverdueUnpaid(invoice)) {
      return "bg-red-50 hover:bg-red-100 cursor-pointer transition-colors";
    }
    return "hover:bg-gray-50 cursor-pointer transition-colors";
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setSendInvoiceModalOpen(true);
  };

  const handleConvertFromQuotation = async (invoice: Invoice) => {
    try {
      // TODO: Implement convert from quotation
      success(`Converting from quotation...`);
      // For now, just show a success message
      // Later we'll implement the actual conversion logic
    } catch (error) {
      console.error('Error converting from quotation:', error);
      showError("Failed to convert from quotation");
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.number}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        success(`Invoice ${invoice.number} deleted successfully`);
        loadInvoices(); // Reload the list
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to delete invoice");
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showError("Failed to delete invoice");
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    try {
      // Create a new window with the invoice content formatted for printing
      const printWindow = window.open('', '_blank');
      
      if (!printWindow) {
        showError("Unable to open print window. Please check your popup blocker.");
        return;
      }

      // Fetch the PDF content from our API
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (response.ok) {
        const htmlContent = await response.text();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        printWindow.onload = () => {
          printWindow.print();
          printWindow.close();
        };
        
        success("Invoice ready for download/printing");
      } else {
        showError("Failed to generate invoice PDF");
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      showError("Failed to download invoice");
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-gray-600">Manage your customer invoices and payments</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:space-x-3">
            <Link href="/invoices/create">
              <Button 
                className="text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: getThemeColor() }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </Link>
          </div>
        </div>

        {/* AI Recommendation and Metrics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* AI Recommendation Card - Left Side (2/5) */}
          <div className="lg:col-span-2">
            <AIRecommendationCard
              title="Invoice Management AI"
              subtitle="Your intelligent assistant for payment optimization"
              onRecommendationComplete={(id) => {
                console.log('Recommendation completed:', id);
              }}
              page="invoices"
              enableAI={true}
            />
          </div>

          {/* Metrics Cards - Right Side (3/5, 2x2 Grid) */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Invoices</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 break-words">{stats.totalInvoices}</p>
                </div>
                <FileText className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Value</p>
                  <p className={`text-lg sm:text-xl font-bold text-${theme.primary} break-words`}>{formatCurrency(stats.totalValue, currency)}</p>
                </div>
                <DollarSign className={`h-6 w-6 text-${theme.primary} flex-shrink-0 mt-1`} />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Overdue</p>
                  <p className="text-lg sm:text-xl font-bold text-red-600 break-words">{formatCurrency(stats.overdueAmount, currency)}</p>
                </div>
                <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-1" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Paid This Month</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600 break-words">{formatCurrency(stats.paidThisMonth, currency)}</p>
                </div>
                <CreditCard className="h-6 w-6 text-green-400 flex-shrink-0 mt-1" />
              </div>
            </Card>
          </div>
        </div>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={invoices}
              enableSelection={true}
              selectedItems={selectedInvoices}
              onSelectionChange={handleSelectionChange}
              onRowClick={(invoice) => router.push(`/invoices/${invoice.id}`)}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCount}
              onPageChange={handlePageChange}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              searchValue={searchTerm}
              onSearchChange={handleSearchChange}
              searchPlaceholder="Search invoices by number, subject, or customer..."
              enableExport={true}
              exportFilename="invoices"
              isLoading={loading}
              getRowClassName={(invoice) => getInvoiceRowClassName(invoice)}
              customFilters={
                <>
              <select
                value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="OVERDUE">Overdue</option>
                <option value="VOID">Void</option>
              </select>

              <select
                value={paymentStatusFilter}
                    onChange={(e) => {
                      setPaymentStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Payment Statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
              </select>
                </>
              }
              bulkActions={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => success(`Selected ${selectedInvoices.length} invoice(s)`)}
                    disabled={selectedInvoices.length === 0}
                  >
                    Bulk Actions
              </Button>
            </div>
              }
              columns={[
                {
                  key: 'number',
                  label: 'Invoice',
                  sortable: true,
                  render: (invoice) => (
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{invoice.number}</span>
                    </div>
                  )
                },
                {
                  key: 'subject',
                  label: 'Customer',
                  sortable: true,
                  render: (invoice) => (
                    <div>
                      <div className="text-sm text-gray-900">{invoice.subject}</div>
                      <div className="text-sm text-gray-500">
                        {invoice.account?.name || invoice.distributor?.businessName || (invoice.lead ? `${invoice.lead.firstName} ${invoice.lead.lastName}` : 'Unknown')}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'total',
                  label: 'Amount',
                  sortable: true,
                  render: (invoice) => (
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.total, currency)}
                      </div>
                      {invoice.amountDue > 0 && (
                        <div className="text-sm text-red-600">
                          Due: {formatCurrency(invoice.amountDue, currency)}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  key: 'dueDate',
                  label: 'Due Date',
                  sortable: true,
                  render: (invoice) => (
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  sortable: true,
                  render: (invoice) => (
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="focus:outline-none">
                            {getStatusBadge(invoice.status)}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusUpdate(invoice, 'DRAFT')}>
                            <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                            Draft
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(invoice, 'SENT')}>
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            Sent
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(invoice, 'OVERDUE')}>
                            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                            Overdue
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(invoice, 'VOID')}>
                            <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                            Void
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                },
                {
                  key: 'paymentStatus',
                  label: 'Payment',
                  sortable: true,
                  render: (invoice) => getPaymentStatusBadge(invoice.paymentStatus)
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (invoice) => (
                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/invoices/${invoice.id}`)}
                        title="View invoice"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
                        title="Edit invoice"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDownload(invoice)}
                        title="Download as PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleSendInvoice(invoice)}
                        title="Send invoice via email/SMS"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleConvertFromQuotation(invoice)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Mark as Paid
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteInvoice(invoice)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                }
              ]}
            />
          </CardContent>
        </Card>

        {/* Send Invoice Modal */}
        {selectedInvoice && (
          <SendInvoiceModal
            isOpen={sendInvoiceModalOpen}
            onClose={() => {
              setSendInvoiceModalOpen(false);
              setSelectedInvoice(null);
            }}
            invoice={selectedInvoice}
          />
        )}
      </div>
    </>
  );
}

// Main export with Suspense boundary
export default function InvoicesPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-6">
        <SkeletonTable />
      </div>
    }>
      <InvoicesPageContent />
    </Suspense>
  );
}
