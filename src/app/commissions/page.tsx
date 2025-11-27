"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import {
  DollarSign,
  Search,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  Check,
  Banknote
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { formatCurrency } from "@/lib/utils";

interface Commission {
  id: string;
  commissionType: string;
  status: string;
  baseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  currency?: string;
  createdAt: string;
  paidDate?: string;
  agent: {
    agentCode: string;
    user: {
      name: string;
      email: string;
    };
  };
  invoice?: {
    number: string;
    account?: { name: string };
  };
  quotation?: {
    number: string;
    account?: { name: string };
  };
  order?: {
    orderNumber: string;
    distributor?: { businessName: string };
  };
  opportunity?: {
    name: string;
    account?: { name: string };
  };
}

export default function CommissionsPage() {
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const themeColor = getThemeColor();
  const { success, error: showError } = useToast();
  
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Metrics
  const [metrics, setMetrics] = useState({
    totalCommissions: 0,
    pendingCommissions: 0,
    approvedCommissions: 0,
    paidCommissions: 0
  });

  // AI Recommendations
  const [aiRecommendations] = useState([
    {
      id: '1',
      title: 'Pending Commission Review',
      description: 'Review and approve pending commissions to keep your team motivated',
      action: 'View Pending',
      actionType: 'action' as const,
      priority: 'high' as const,
      completed: false,
      onAction: () => {
        setStatusFilter('PENDING');
        setCurrentPage(1);
        success('Filter Applied', 'Showing pending commissions only');
      }
    },
    {
      id: '2',
      title: 'Commission Payout Schedule',
      description: 'Approve commissions to prepare for the next payout cycle',
      action: 'Review Approved',
      actionType: 'insight' as const,
      priority: 'medium' as const,
      completed: false,
      onAction: () => {
        setStatusFilter('APPROVED');
        setCurrentPage(1);
        success('Filter Applied', 'Showing approved commissions ready for payout');
      }
    },
    {
      id: '3',
      title: 'Commission Analytics',
      description: 'Analyze commission trends to optimize your compensation structure',
      action: 'View All',
      actionType: 'filter' as const,
      priority: 'low' as const,
      completed: false,
      onAction: () => {
        setStatusFilter('');
        setTypeFilter('');
        setCurrentPage(1);
        success('Filter Reset', 'Showing all commissions');
      }
    }
  ]);

  const handleRecommendationComplete = (id: string) => {
    console.log('Recommendation completed:', id);
  };

  // Initial load on mount
  useEffect(() => {
    fetchCommissions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect for filters and sorting (skip initial mount)
  useEffect(() => {
    const isInitialMount = currentPage === 1 && !searchTerm && !statusFilter && !typeFilter && !sortBy;
    if (isInitialMount) {
      return;
    }
    fetchCommissions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, sortBy, sortOrder]);

  // Debounced search effect (including when cleared)
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchCommissions(1);
    }, searchTerm ? 500 : 0);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleApproveCommission = async (commissionId: string) => {
    try {
      const response = await fetch(`/api/commissions/${commissionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Approved via commissions page' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve commission');
      }

      success('Success', 'Commission approved successfully');
      await fetchCommissions(currentPage); // Reload data
    } catch (err) {
      console.error('Error approving commission:', err);
      showError('Error', err instanceof Error ? err.message : 'Failed to approve commission');
    }
  };

  const handleMarkAsPaid = async (commissionId: string) => {
    try {
      const response = await fetch(`/api/commissions/${commissionId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidDate: new Date().toISOString() })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark commission as paid');
      }

      success('Success', 'Commission marked as paid');
      await fetchCommissions(currentPage); // Reload data
    } catch (err) {
      console.error('Error marking commission as paid:', err);
      showError('Error', err instanceof Error ? err.message : 'Failed to mark commission as paid');
    }
  };

  const fetchCommissions = async (page: number = currentPage) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', itemsPerPage.toString());
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (typeFilter) {
        params.append('type', typeFilter);
      }
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      if (sortOrder) {
        params.append('sortOrder', sortOrder);
      }
      
      const response = await fetch(`/api/commissions?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to fetch commissions');
      
      const data = await response.json();
      setCommissions(Array.isArray(data.commissions) ? data.commissions : []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalItems(data.pagination?.total || 0);
      setCurrentPage(page);
      
      // Calculate metrics from current page data (or fetch separately if needed)
      const total = data.commissions.reduce((sum: number, c: Commission) => sum + c.commissionAmount, 0);
      const pending = data.commissions
        .filter((c: Commission) => c.status === 'PENDING')
        .reduce((sum: number, c: Commission) => sum + c.commissionAmount, 0);
      const approved = data.commissions
        .filter((c: Commission) => c.status === 'APPROVED')
        .reduce((sum: number, c: Commission) => sum + c.commissionAmount, 0);
      const paid = data.commissions
        .filter((c: Commission) => c.status === 'PAID')
        .reduce((sum: number, c: Commission) => sum + c.commissionAmount, 0);
      
      setMetrics({
        totalCommissions: total, // This is only for current page, consider fetching separately
        pendingCommissions: pending,
        approvedCommissions: approved,
        paidCommissions: paid
      });
    } catch (error) {
      console.error('Error fetching commissions:', error);
      showError('Error', 'Failed to load commissions');
      setCommissions([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      DISPUTED: 'bg-orange-100 text-orange-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.PENDING}`}>
        {status}
      </span>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      INVOICE_SALE: 'Invoice Sale',
      QUOTATION_SENT: 'Quotation Sent',
      ORDER_PLACED: 'Order Placed',
      OPPORTUNITY_WON: 'Opportunity Won',
      RECURRING_REVENUE: 'Recurring Revenue',
      BONUS: 'Bonus'
    };
    return labels[type] || type;
  };

  const getSourceInfo = (commission: Commission) => {
    if (commission.invoice) {
      return {
        label: commission.invoice.number,
        customer: commission.invoice.account?.name || 'N/A'
      };
    }
    if (commission.quotation) {
      return {
        label: commission.quotation.number,
        customer: commission.quotation.account?.name || 'N/A'
      };
    }
    if (commission.order) {
      return {
        label: commission.order.orderNumber,
        customer: commission.order.distributor?.businessName || 'N/A'
      };
    }
    if (commission.opportunity) {
      return {
        label: commission.opportunity.name,
        customer: commission.opportunity.account?.name || 'N/A'
      };
    }
    return { label: '-', customer: '-' };
  };

  const columns = [
    {
      key: 'agent',
      label: 'Agent',
      render: (commission: Commission) => (
        <div>
          <div className="font-medium text-gray-900">{commission.agent.user.name}</div>
          <div className="text-sm text-gray-500">{commission.agent.agentCode}</div>
        </div>
      )
    },
    {
      key: 'type',
      label: 'Type',
      render: (commission: Commission) => (
        <div className="text-sm text-gray-900">{getTypeLabel(commission.commissionType)}</div>
      )
    },
    {
      key: 'source',
      label: 'Source',
      render: (commission: Commission) => {
        const source = getSourceInfo(commission);
        return (
          <div>
            <div className="text-sm text-gray-900">{source.label}</div>
            <div className="text-xs text-gray-500">{source.customer}</div>
          </div>
        );
      }
    },
    {
      key: 'baseAmount',
      label: 'Base Amount',
      render: (commission: Commission) => (
        <div className="text-sm text-gray-900">
          {formatCurrency(commission.baseAmount, 'GHS')}
        </div>
      )
    },
    {
      key: 'rate',
      label: 'Rate',
      render: (commission: Commission) => (
        <div className="text-sm text-gray-900">{commission.commissionRate}%</div>
      )
    },
    {
      key: 'commission',
      label: 'Commission',
      render: (commission: Commission) => (
        <div className="text-sm font-medium text-gray-900">
          {formatCurrency(commission.commissionAmount, 'GHS')}
        </div>
      )
    },
    {
      key: 'earnedDate',
      label: 'Earned Date',
      render: (commission: Commission) => (
        <div className="text-sm text-gray-900">
          {new Date(commission.createdAt).toLocaleDateString()}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (commission: Commission) => getStatusBadge(commission.status)
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (commission: Commission) => (
        <div className="flex items-center gap-2">
          {commission.status === 'PENDING' && (
            <Button
              size="sm"
              onClick={() => handleApproveCommission(commission.id)}
              className="flex items-center gap-1"
              style={{ backgroundColor: themeColor, color: 'white' }}
            >
              <Check className="h-3 w-3" />
              Approve
            </Button>
          )}
          {commission.status === 'APPROVED' && (
            <Button
              size="sm"
              onClick={() => handleMarkAsPaid(commission.id)}
              className="flex items-center gap-1 bg-green-600 text-white hover:bg-green-700"
            >
              <Banknote className="h-3 w-3" />
              Mark Paid
            </Button>
          )}
          {commission.status === 'PAID' && (
            <span className="text-xs text-gray-500">Completed</span>
          )}
        </div>
      )
    }
  ];

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading commissions...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
            <p className="text-gray-600">Track and manage sales commissions</p>
          </div>
          <Button
            style={{ backgroundColor: getThemeColor(), color: 'white' }}
            className="hover:opacity-90"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* AI Recommendation and Metrics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Recommendation Card - Left Side */}
          <div className="lg:col-span-2">
            <AIRecommendationCard 
              title="Commission Insights AI"
              subtitle="Optimize your commission structure"
              recommendations={aiRecommendations}
              onRecommendationComplete={handleRecommendationComplete}
            />
          </div>

          {/* Metrics Cards - Right Side */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Commissions</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(metrics.totalCommissions, 'GHS')}</p>
                </div>
                <div className="p-2 rounded-full bg-purple-100">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-xl font-bold text-yellow-600">{formatCurrency(metrics.pendingCommissions, 'GHS')}</p>
                </div>
                <div className="p-2 rounded-full bg-yellow-100">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(metrics.approvedCommissions, 'GHS')}</p>
                </div>
                <div className="p-2 rounded-full bg-blue-100">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Paid</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(metrics.paidCommissions, 'GHS')}</p>
                </div>
                <div className="p-2 rounded-full bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Commissions Table */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle>Commissions List</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={commissions}
              columns={columns.map(col => ({
                ...col,
                sortable: col.key !== 'actions' && col.key !== 'source',
                exportable: col.key !== 'actions',
                exportFormat: col.key === 'status'
                  ? (c: Commission) => c.status
                  : col.key === 'type'
                  ? (c: Commission) => getTypeLabel(c.commissionType)
                  : col.key === 'agent'
                  ? (c: Commission) => `${c.agent.user.name} (${c.agent.agentCode})`
                  : col.key === 'source'
                  ? (c: Commission) => {
                      const source = getSourceInfo(c);
                      return `${source.label} - ${source.customer}`;
                    }
                  : col.key === 'commission'
                  ? (c: Commission) => formatCurrency(c.commissionAmount, 'GHS')
                  : col.key === 'baseAmount'
                  ? (c: Commission) => formatCurrency(c.baseAmount, 'GHS')
                  : undefined
              }))}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={(page) => {
                setCurrentPage(page);
                fetchCommissions(page);
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search commissions by agent, invoice, quote, or order..."
              enableExport={true}
              exportFilename="commissions"
              isLoading={isLoading}
              customFilters={
                <>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PAID">Paid</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="DISPUTED">Disputed</option>
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="INVOICE_SALE">Invoice Sale</option>
                    <option value="QUOTATION_SENT">Quotation Sent</option>
                    <option value="ORDER_PLACED">Order Placed</option>
                    <option value="OPPORTUNITY_WON">Opportunity Won</option>
                    <option value="RECURRING_REVENUE">Recurring Revenue</option>
                    <option value="BONUS">Bonus</option>
                  </select>
                </>
              }
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
