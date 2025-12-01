"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { downloadQuotationAsPDF } from "@/lib/quotation-download";
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
import { SendQuoteModal } from "../../components/modals/send-quote-modal";
import { ConfirmationModal } from "@/components/modals/confirmation-modal";
import { SkeletonTableRow, SkeletonMetricCard } from "@/components/ui/skeleton-loading";
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
  CheckSquare,
  Square
} from "lucide-react";
import Link from "next/link";

interface Quotation {
  id: string;
  number: string;
  subject: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  total: number;
  subtotal: number;
  tax: number;
  currency?: string;
  taxInclusive?: boolean;
  notes?: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
  customerType?: 'STANDARD' | 'CREDIT';
  account: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  distributor?: {
    id: string;
    businessName: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  lines?: Array<{
    id: string;
    productId?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    taxes?: Array<{
      name: string;
      rate: number;
      amount: number;
    }>;
    product?: {
      id: string;
      name: string;
      sku?: string;
    };
    productName?: string;
    sku?: string;
    description?: string;
  }>;
  owner: {
    id: string;
    name: string;
  };
}

export default function QuotationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { success, error: showError } = useToast();
  const { getThemeClasses, getThemeColor, customLogo } = useTheme();
  const theme = getThemeClasses();
  
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sendQuoteModalOpen, setSendQuoteModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;
  
  // Bulk selection state
  const [selectedQuotations, setSelectedQuotations] = useState<string[]>([]);
  
  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
    type: 'danger'
  });

  // Initial load on mount
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      loadQuotations(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]); // Run when authenticated

  // Immediate effect for sorting and filters (skip initial mount)
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Skip initial mount - already loaded above
      const isInitialMount = currentPage === 1 && !searchTerm && statusFilter === 'ALL' && !sortBy;
      if (isInitialMount) {
        return;
      }
      loadQuotations(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sortBy, sortOrder, status, session]);

  // Debounced search effect (including when cleared)
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Skip initial mount (handled by initial load effect)
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        return;
      }
      
      const timeoutId = setTimeout(() => {
        setCurrentPage(1);
        loadQuotations(1);
      }, searchTerm ? 500 : 0); // No debounce when clearing (empty search)

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, status, session]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      loadAllQuotationsForMetrics();
    }
  }, [status, session]);

  const loadAllQuotationsForMetrics = async () => {
    try {
      // Check if user is logged in
      if (status === 'loading' || !session?.user) {
        return;
      }
      
      // Fetch all quotations without pagination for metrics
      const params = new URLSearchParams({
        page: '1',
        limit: '1000' // Large limit to get all quotations
      });
      
      const response = await fetch(`/api/quotations?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Map quotations to include customer name from either account or distributor
        const mappedQuotations = (data.quotations || []).map((q: any) => ({
          ...q,
          account: q.account ? {
            ...q.account,
            name: q.account.name || 'Unknown Customer'
          } : undefined,
          distributor: q.distributor ? {
            ...q.distributor,
            name: q.distributor.businessName || 'Unknown Distributor'
          } : undefined,
          lead: q.lead ? {
            ...q.lead,
            name: q.lead.firstName && q.lead.lastName ? `${q.lead.firstName} ${q.lead.lastName}` : 'Unknown Lead'
          } : undefined,
        }));
        
        setAllQuotations(mappedQuotations);
      } else {
        console.error('Failed to load quotations for metrics:', response.status);
      }
    } catch (error) {
      console.error('Error loading all quotations for metrics:', error);
    }
  };

  const loadQuotations = async (page: number = 1) => {
    try {
      setIsLoading(true);
      
      // Check if user is logged in
      if (status === 'loading') {
        setIsLoading(false);
        return;
      }
      
      if (!session?.user) {
        showError("Please log in to view quotations");
        setIsLoading(false);
        return;
      }
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString()
      });
      
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      
      if (sortOrder) {
        params.append('sortOrder', sortOrder);
      }
      
      const response = await fetch(`/api/quotations?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Update pagination data
        setCurrentPage(data.pagination?.page || 1);
        setTotalPages(data.pagination?.pages || 1);
        setTotalItems(data.pagination?.total || 0);
        
        // Map quotations to include customer name from either account, distributor, or lead
        const mappedQuotations = (data.quotations || []).map((q: any) => ({
          ...q,
          account: q.account ? {
            ...q.account,
            name: q.account.name || 'Unknown Customer'
          } : undefined,
          distributor: q.distributor ? {
            ...q.distributor,
            name: q.distributor.businessName || 'Unknown Distributor'
          } : undefined,
          lead: q.lead ? {
            ...q.lead,
            name: q.lead.firstName && q.lead.lastName ? `${q.lead.firstName} ${q.lead.lastName}` : 'Unknown Lead'
          } : undefined
        }));
        
        setQuotations(mappedQuotations);
        setCurrentPage(page);
      } else {
        if (response.status === 401) {
          showError("Please log in to view quotations");
          window.location.href = '/auth/signin';
      } else {
        showError("Failed to load quotations");
        }
      }
    } catch (error) {
      console.error('Error loading quotations:', error);
      showError("Failed to load quotations", "Network error or server unavailable");
    } finally {
      setIsLoading(false);
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
    loadQuotations(page);
  };
  
  // Handle selection change
  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedQuotations(selectedIds);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
      SENT: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent' },
      ACCEPTED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Accepted' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
      EXPIRED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Expired' },
    };
    const badge = badges[status as keyof typeof badges] || badges.DRAFT;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const handleSendQuote = async (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setSendQuoteModalOpen(true);
  };

  const handleConvertToInvoice = async (quotation: Quotation) => {
    try {
      const response = await fetch(`/api/quotations/${quotation.id}/convert-to-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // If invoice already exists, show a confirmation modal to navigate to it
        if (response.status === 409 && errorData.invoiceId) {
          const invoiceId = errorData.invoiceId;
          const invoiceNumber = errorData.invoiceNumber;
          
          if (window.confirm(
            `This quotation has already been converted to Invoice ${invoiceNumber}.\n\n` +
            `Would you like to view the invoice now?`
          )) {
            router.push(`/invoices/${invoiceId}`);
          }
          return;
        }
        
        showError(errorData.error || "Failed to convert quotation to invoice");
        return;
      }

      const result = await response.json();
      
      success(`Quotation ${quotation.number} converted to invoice successfully!`);
      
      // Optionally redirect to the new invoice
      if (result.invoice?.id) {
        router.push(`/invoices/${result.invoice.id}`);
      }
    } catch (error) {
      console.error('Error converting to invoice:', error);
      showError("Failed to convert quotation to invoice");
    }
  };

  const handleStatusUpdate = async (quotation: Quotation, newStatus: string) => {
    try {
      const response = await fetch(`/api/quotations/${quotation.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: quotation.subject,
          status: newStatus
        }),
      });

      if (response.ok) {
        success("Status Updated", `Quotation ${quotation.number} status updated to ${newStatus}`);
        loadQuotations(currentPage);
        loadAllQuotationsForMetrics();
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to update status");
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showError("Failed to update status");
    }
  };

  const handleDeleteQuotation = async (quotation: Quotation) => {
    showConfirmation(
      "Delete Quotation",
      `Are you sure you want to delete quotation ${quotation.number}?`,
      "Delete Quotation",
      async () => {
    try {
      const response = await fetch(`/api/quotations/${quotation.id}`, {
        method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
      });

      if (response.ok) {
        success(`Quotation ${quotation.number} deleted successfully`);
        loadQuotations(); // Reload the list
            closeConfirmation(); // Close the modal
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to delete quotation");
      }
    } catch (error) {
      console.error('Error deleting quotation:', error);
      showError("Failed to delete quotation");
    }
      }
    );
  };

  const handleDownload = (e: React.MouseEvent, quotation: Quotation) => {
    // Prevent any event propagation that might trigger other handlers
    e.preventDefault();
    e.stopPropagation();
    
    // Open window immediately (synchronously) in direct response to user click
    // This must happen synchronously to avoid popup blocker
    const timestamp = Date.now();
    const pdfUrl = `/api/quotations/${quotation.id}/pdf?t=${timestamp}`;
    const newWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    
    if (!newWindow) {
      showError('Please allow popups to view the PDF, or try clicking the download button again.');
      return;
    }
    
    success("Quotation PDF opened in new tab. You can print it from there.");
  };

  // Helper function to show confirmation modal
  const showConfirmation = (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void,
    type: 'danger' | 'warning' | 'info' = 'danger'
  ) => {
    setConfirmationModal({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm,
      type
    });
  };

  const closeConfirmation = () => {
    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
  };

  // Bulk selection functions (updated for DataTable)

  const handleBulkDelete = async () => {
    if (selectedQuotations.length === 0) return;
    
    showConfirmation(
      "Delete Multiple Quotations",
      `Are you sure you want to delete ${selectedQuotations.length} quotation(s)?`,
      "Delete All",
      async () => {
        try {
          const deletePromises = Array.from(selectedQuotations).map(id => 
            fetch(`/api/quotations/${id}`, {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            })
          );

          const results = await Promise.all(deletePromises);
          const failed = results.filter(r => !r.ok).length;
          
          if (failed === 0) {
            success(`Successfully deleted ${selectedQuotations.length} quotation(s)`);
            setSelectedQuotations([]);
            loadQuotations(currentPage);
            loadAllQuotationsForMetrics();
            closeConfirmation(); // Close the modal
          } else {
            showError(`Failed to delete ${failed} quotation(s)`);
          }
        } catch (error) {
          console.error('Error bulk deleting quotations:', error);
          showError("Failed to delete quotations");
        }
      }
    );
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedQuotations.length === 0) return;

    try {
      const updatePromises = selectedQuotations.map(id => 
        fetch(`/api/quotations/${id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      );

      const results = await Promise.all(updatePromises);
      const failed = results.filter(r => !r.ok).length;
      
      if (failed === 0) {
        success(`Successfully updated ${selectedQuotations.length} quotation(s) to ${newStatus}`);
        setSelectedQuotations([]);
        loadQuotations(currentPage);
        loadAllQuotationsForMetrics();
      } else {
        showError(`Failed to update ${failed} quotation(s)`);
      }
    } catch (error) {
      console.error('Error bulk updating quotations:', error);
      showError("Failed to update quotations");
    }
  };

  // Simple helper to convert currency to GHS (using approximate rate)
  const convertToGHS = (amount: number, currency: string = 'GHS'): number => {
    if (currency === 'GHS') return amount;
    // Simple conversion rates - keeping it simple as requested
    const rates: { [key: string]: number } = {
      'USD': 12.5,
      'EUR': 13.8,
      'GBP': 15.8,
      'NGN': 0.015,
      'KES': 0.09,
      'ZAR': 0.67
    };
    return amount * (rates[currency] || 1);
  };

  // Simple helper to get currency symbol
  const getCurrencySymbol = (code: string): string => {
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'NGN': '₦',
      'KES': 'KSh',
      'ZAR': 'R',
      'GHS': 'GH₵'
    };
    return symbols[code] || code + ' ';
  };

  const stats = {
    total: allQuotations.length,
    draft: allQuotations.filter(q => q.status === 'DRAFT').length,
    sent: allQuotations.filter(q => q.status === 'SENT').length,
    accepted: allQuotations.filter(q => q.status === 'ACCEPTED').length,
    totalValue: Number(allQuotations.reduce((sum, q) => sum + q.total, 0).toFixed(2)),
  };

  // Remove the loading return - we'll show skeleton loading instead

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Quotations</h1>
            <p className="text-sm sm:text-base text-gray-600">Create and manage sales quotations</p>
          </div>
          <Link href="/quotations/create" className="w-full sm:w-auto">
            <Button 
              className="text-white hover:opacity-90 transition-opacity w-full sm:w-auto"
              style={{ backgroundColor: getThemeColor() }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Quotation
            </Button>
          </Link>
        </div>

        {/* AI Recommendation and Metrics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* AI Recommendation Card - Left Side (2/5) */}
          <div className="lg:col-span-2">
            <AIRecommendationCard
              title="Quotation Management AI"
              subtitle="Your intelligent assistant for sales optimization"
              onRecommendationComplete={(id) => {
                console.log('Recommendation completed:', id);
              }}
              page="quotations"
              enableAI={true}
            />
          </div>

          {/* Metrics Cards - Right Side (3/5, 2x2 Grid) */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isLoading ? (
              <>
                <SkeletonMetricCard />
                <SkeletonMetricCard />
                <SkeletonMetricCard />
                <SkeletonMetricCard />
              </>
            ) : (
              <>
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Quotes</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 break-words">{stats.total}</p>
                </div>
                <FileText className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Sent</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600 break-words">{stats.sent}</p>
                </div>
                <Send className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Accepted</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600 break-words">{stats.accepted}</p>
                </div>
                <CheckCircle className="h-6 w-6 text-green-400 flex-shrink-0 mt-1" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Value</p>
                  <p className={`text-lg sm:text-xl font-bold text-${theme.primary} break-words`}>GH₵{stats.totalValue.toLocaleString()}</p>
                  {/* Note: Total value shows in GHS for aggregation - individual quotations show their own currency */}
                </div>
                <FileText className={`h-6 w-6 text-${theme.primary} flex-shrink-0 mt-1`} />
              </div>
            </Card>
              </>
            )}
          </div>
        </div>

        {/* Quotations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Quotations</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={quotations}
              enableSelection={true}
              selectedItems={selectedQuotations}
              onSelectionChange={handleSelectionChange}
              onRowClick={(quotation) => router.push(`/quotations/${quotation.id}`)}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={handlePageChange}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              searchValue={searchTerm}
              onSearchChange={handleSearchChange}
              searchPlaceholder="Search quotations by number or subject..."
              enableExport={true}
              exportFilename="quotations"
              isLoading={isLoading}
              customFilters={
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              }
              bulkActions={
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Update Status
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('DRAFT')}>
                        <Clock className="h-4 w-4 mr-2" />
                        Draft
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('SENT')}>
                        <Send className="h-4 w-4 mr-2" />
                        Sent
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('ACCEPTED')}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accepted
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('REJECTED')}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleBulkDelete}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              }
              columns={[
                {
                  key: 'number',
                  label: 'Quote #',
                  sortable: true,
                  render: (quotation) => (
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{quotation.number}</span>
                    </div>
                  )
                },
                {
                  key: 'subject',
                  label: 'Subject',
                  sortable: true,
                  render: (quotation) => (
                    <div className="text-sm text-gray-900">{quotation.subject}</div>
                  )
                },
                {
                  key: 'customer',
                  label: 'Customer',
                  sortable: true,
                  render: (quotation) => (
                    <div className="text-sm text-gray-900">
                      {quotation.account?.name || quotation.distributor?.name || quotation.lead?.name || 'Unknown'}
                    </div>
                  )
                },
                {
                  key: 'total',
                  label: 'Total',
                  sortable: true,
                  render: (quotation) => (
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        GH₵{convertToGHS(quotation.total, quotation.currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {quotation.currency && quotation.currency !== 'GHS' && (
                        <div className="text-xs text-gray-500">
                          {getCurrencySymbol(quotation.currency)}{quotation.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  key: 'validUntil',
                  label: 'Valid Until',
                  sortable: true,
                  render: (quotation) => (
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      {quotation.validUntil ? (() => {
                        try {
                          const date = new Date(quotation.validUntil);
                          if (isNaN(date.getTime())) {
                            return 'No expiry';
                          }
                          return date.toLocaleDateString();
                        } catch (e) {
                          return 'No expiry';
                        }
                      })() : 'No expiry'}
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  sortable: true,
                  render: (quotation) => (
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="focus:outline-none">
                            {getStatusBadge(quotation.status)}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusUpdate(quotation, 'DRAFT')}>
                            <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                            Draft
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(quotation, 'SENT')}>
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            Sent
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(quotation, 'ACCEPTED')}>
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            Accepted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(quotation, 'REJECTED')}>
                            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                            Rejected
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusUpdate(quotation, 'EXPIRED')}>
                            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                            Expired
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (quotation) => (
                    <div className="flex items-center flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/quotations/${quotation.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/quotations/${quotation.id}/edit`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => handleDownload(e, quotation)}
                        title="Download as PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleSendQuote(quotation)}
                        title="Send quotation via email/SMS"
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
                          <DropdownMenuItem onClick={() => handleConvertToInvoice(quotation)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Convert to Invoice
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteQuotation(quotation)}
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

      </div>

      {/* Send Quote Modal */}
      {selectedQuotation && (
        <SendQuoteModal
          isOpen={sendQuoteModalOpen}
          onClose={() => {
            setSendQuoteModalOpen(false);
            setSelectedQuotation(null);
          }}
          quotation={selectedQuotation}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationModal.onConfirm}
        title={confirmationModal.title}
        message={confirmationModal.message}
        confirmText={confirmationModal.confirmText}
        cancelText="Cancel"
        type={confirmationModal.type}
        isLoading={false}
      />
    </>
  );
}

