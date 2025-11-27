'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, TrendingUp, FileBarChart, CheckCircle, XCircle, DollarSign, Calendar, CheckSquare, Square, ChevronLeft, ChevronRight, ChevronDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { AIRecommendationCard } from '@/components/ai-recommendation-card';
import { ConfirmationModal } from '@/components/modals/confirmation-modal';
import { EditOpportunityModal } from '@/components/modals/edit-opportunity-modal';
import { MiniLineChart } from '@/components/ui/mini-line-chart';
import { SkeletonTable, SkeletonMetricCard } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { formatCurrency } from '@/lib/utils';
import { CurrencyToggle, useCurrency } from '@/components/ui/currency-toggle';

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  value?: number;
  probability?: number;
  closeDate?: string;
  wonDate?: string;
  lostReason?: string;
  accountId?: string;
  leadId?: string;
  ownerId: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  account?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    type: string;
  };
  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
  };
  quotations: Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    createdAt: string;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    createdAt: string;
  }>;
}

export default function OpportunitiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const { success, error } = useToast();
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Removed showAddModal - opportunities are now auto-created from quotes
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Bulk actions state
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([]);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  // Use the CurrencyToggle hook for consistent currency management
  const { currency, changeCurrency } = useCurrency();
  const [baseCurrency, setBaseCurrency] = useState('GHS');
  
  // Simple currency conversion rates (hardcoded for now)
  const exchangeRates: Record<string, Record<string, number>> = {
    'GHS': { 'USD': 0.08, 'EUR': 0.07, 'GBP': 0.06 },
    'USD': { 'GHS': 12.5, 'EUR': 0.85, 'GBP': 0.75 },
    'EUR': { 'GHS': 14.7, 'USD': 1.18, 'GBP': 0.88 },
    'GBP': { 'GHS': 16.7, 'USD': 1.33, 'EUR': 1.14 }
  };
  
  const handleViewOpportunity = (opportunity: Opportunity) => {
    router.push(`/crm/opportunities/${opportunity.id}`);
  };

  const [aiRecommendations, setAiRecommendations] = useState([
    {
      id: '1',
      title: 'Follow up on quote sent',
      description: 'You have 2 opportunities with quotes sent that need follow-up within 48 hours.',
      priority: 'high' as const,
      completed: false,
    },
    {
      id: '2',
      title: 'Move negotiations forward',
      description: 'Review 3 opportunities in negotiation stage and schedule next steps.',
      priority: 'medium' as const,
      completed: false,
    },
    {
      id: '3',
      title: 'Close pending deals',
      description: 'Focus on opportunities with high probability of closing this month.',
      priority: 'high' as const,
      completed: false,
    },
  ]);

  // Opportunity stages
  const stages = [
    { key: 'NEW_OPPORTUNITY', label: 'New Opportunity', color: 'bg-blue-100 text-blue-800' },
    { key: 'QUOTE_SENT', label: 'Quote Sent', color: 'bg-yellow-100 text-yellow-800' },
    { key: 'NEGOTIATION', label: 'Negotiation', color: 'bg-purple-100 text-purple-800' },
    { key: 'CONTRACT_SIGNED', label: 'Contract Signed', color: 'bg-emerald-100 text-emerald-800' },
    { key: 'WON', label: 'Won', color: 'bg-green-100 text-green-800' },
    { key: 'LOST', label: 'Lost', color: 'bg-red-100 text-red-800' },
  ];

  // Initial load on mount
  useEffect(() => {
    if (session?.user) {
      fetchCurrencySettings();
      fetchOpportunities(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Effect for sorting and filters
  useEffect(() => {
    if (session?.user) {
      // Skip initial mount - already loaded above
      const isInitialMount = currentPage === 1 && !searchTerm && !statusFilter && !sortBy;
      if (isInitialMount) {
        return;
      }
      fetchOpportunities(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sortBy, sortOrder, session]);

  // Debounced search effect (including when cleared)
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (session?.user) {
      // Skip initial mount (handled by initial load effect)
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        return;
      }
      
      const timeoutId = setTimeout(() => {
        setCurrentPage(1);
        fetchOpportunities(1);
      }, searchTerm ? 500 : 0); // No debounce when clearing (empty search)

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, session]);

  const fetchOpportunities = async (page: number = currentPage) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', itemsPerPage.toString());
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      if (sortOrder) {
        params.append('sortOrder', sortOrder);
      }
      
      const response = await fetch(`/api/opportunities?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setOpportunities(Array.isArray(data.opportunities) ? data.opportunities : []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalItems(data.pagination?.total || 0);
        setCurrentPage(page);
      } else {
        console.error('Failed to fetch opportunities');
        setOpportunities([]);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setOpportunities([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  const getStageInfo = (stage: string) => {
    return stages.find(s => s.key === stage) || { key: stage, label: stage, color: 'bg-gray-100 text-gray-800' };
  };

  // Format currency amount - react to currency changes
  const formatCurrencyAmount = (amount?: number) => {
    // Use the current currency state directly - this will be fresh on every render
    const currentCurrency = currency || baseCurrency || 'GHS';
    const currentBaseCurrency = baseCurrency || 'GHS';
    
    if (amount === undefined || amount === null || isNaN(amount)) {
      return formatCurrency(0, currentCurrency);
    }
    
    // Convert from base currency to selected currency
    let convertedAmount = amount;
    
    if (currentBaseCurrency !== currentCurrency) {
      const rate = exchangeRates[currentBaseCurrency]?.[currentCurrency];
      if (rate && !isNaN(rate)) {
        convertedAmount = amount * rate;
      }
    }
    
    // Use the selected currency for formatting - this will show the correct symbol
    return formatCurrency(convertedAmount, currentCurrency);
  };

  const calculatePipelineValue = () => {
    return opportunities.reduce((total, opp) => {
      // Only include active opportunities in pipeline (exclude WON and LOST)
      if (opp.value && opp.stage !== 'LOST' && opp.stage !== 'WON') {
        return total + (opp.value * (opp.probability || 0) / 100);
      }
      return total;
    }, 0);
  };

  const calculateProjectedClose = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return opportunities.filter(opp => {
      if (!opp.closeDate || opp.stage === 'LOST') return false;
      const closeDate = new Date(opp.closeDate);
      return closeDate.getMonth() === currentMonth && closeDate.getFullYear() === currentYear;
    }).length;
  };

  const calculateClosedRevenue = () => {
    return opportunities.reduce((total, opp) => {
      if (opp.value && opp.stage === 'WON') {
        return total + opp.value;
      }
      return total;
    }, 0);
  };

  // Generate trend data for metrics
  const generateTrendData = () => {
    // Generate 7 data points for the last 7 days
    const totalTrend = Array.from({ length: 7 }, (_, i) => {
      const baseValue = Math.max(0, opportunities.length - 3 + i);
      return baseValue + Math.random() * 2;
    });

    const pipelineTrend = Array.from({ length: 7 }, (_, i) => {
      const baseValue = calculatePipelineValue() * (0.7 + i * 0.05);
      return baseValue + Math.random() * 1000;
    });

    const revenueTrend = Array.from({ length: 7 }, (_, i) => {
      const baseValue = calculateClosedRevenue() * (0.6 + i * 0.06);
      return baseValue + Math.random() * 500;
    });

    return { totalTrend, pipelineTrend, revenueTrend };
  };

  const trends = generateTrendData();

  // Sort handler
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  };

  // Bulk action helper functions
  const showConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmationModal({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  const closeConfirmation = () => {
    setConfirmationModal({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: () => {}
    });
  };

  const handleSelectOpportunity = (opportunityId: string) => {
    setSelectedOpportunities(prev => {
      if (prev.includes(opportunityId)) {
        return prev.filter(id => id !== opportunityId);
      } else {
        return [...prev, opportunityId];
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedOpportunities.length === 0) return;
    
    showConfirmation(
      'Delete Opportunities',
      `Are you sure you want to delete ${selectedOpportunities.length} opportunity(ies)? This will also delete all associated tasks, comments, files, emails, SMS, and meetings. Quotations and invoices will be unlinked.`,
      async () => {
        try {
          const deletePromises = selectedOpportunities.map(id =>
            fetch(`/api/opportunities/${id}`, { 
              method: 'DELETE',
              credentials: 'include'
            })
          );
          
          const results = await Promise.all(deletePromises);
          const successCount = results.filter(r => r.ok).length;
          const failCount = results.length - successCount;
          
          // Refresh opportunities
          await fetchOpportunities(currentPage);
          
          // Clear selection
          setSelectedOpportunities([]);
          
          if (successCount > 0) {
            success(`Successfully deleted ${successCount} opportunity(ies)`);
          }
          if (failCount > 0) {
            error(`Failed to delete ${failCount} opportunity(ies)`);
          }
        } catch (err) {
          console.error('Error deleting opportunities:', err);
          error('Failed to delete opportunities');
        } finally {
          closeConfirmation();
        }
      }
    );
  };

  const handleBulkStatusUpdate = (newStatus: string) => {
    if (selectedOpportunities.length === 0) return;
    
    showConfirmation(
      'Update Opportunity Status',
      `Are you sure you want to update ${selectedOpportunities.length} opportunity(ies) to ${newStatus}?`,
      async () => {
        try {
          const updatePromises = selectedOpportunities.map(id =>
            fetch(`/api/opportunities/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
            })
          );
          
          await Promise.all(updatePromises);
          
          // Refresh opportunities
          await fetchOpportunities(currentPage);
          
          // Clear selection
          setSelectedOpportunities([]);
          
          success(`Successfully updated ${selectedOpportunities.length} opportunity(ies) to ${newStatus}`);
        } catch (err) {
          console.error('Error updating opportunities:', err);
          error('Failed to update opportunities');
        } finally {
          closeConfirmation();
        }
      }
    );
  };

  const fetchCurrencySettings = async () => {
    try {
      const response = await fetch('/api/settings/currency');
      if (response.ok) {
        const data = await response.json();
        const fetchedBaseCurrency = data.baseCurrency || 'GHS';
        setBaseCurrency(fetchedBaseCurrency);
      }
    } catch (err) {
      console.error('Error fetching currency settings:', err);
    }
  };

  const handleRecommendationComplete = (id: string) => {
    setAiRecommendations(prev => 
      prev.map(rec => 
        rec.id === id ? { ...rec, completed: true } : rec
      )
    );
    success('Recommendation completed! Great job!');
  };

  const handleEditOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setShowEditModal(true);
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setSelectedOpportunity(null);
  };

  const handleDeleteOpportunity = async (opportunity: Opportunity) => {
    const contactName = opportunity.lead ? `${opportunity.lead.firstName} ${opportunity.lead.lastName}` : opportunity.account?.name || opportunity.name;
    showConfirmation(
      'Delete Opportunity',
      `Are you sure you want to delete the opportunity "${contactName}"? This will also delete all associated tasks, comments, files, emails, SMS, and meetings. Quotations and invoices will be unlinked.`,
      async () => {
        try {
          const response = await fetch(`/api/opportunities/${opportunity.id}`, {
            method: 'DELETE',
            credentials: 'include',
          });

          if (response.ok) {
            success('Opportunity deleted successfully');
            fetchOpportunities(currentPage); // Refresh the list
          } else {
            const data = await response.json();
            error(data.error || 'Failed to delete opportunity');
          }
        } catch (err) {
          console.error('Error deleting opportunity:', err);
          error('Failed to delete opportunity');
        } finally {
          closeConfirmation();
        }
      }
    );
  };

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Don't show loading skeleton during navigation

  // Don't render if not authenticated
  if (status === 'unauthenticated') {
    return null;
  }



  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Opportunities</h1>
            <p className="text-gray-600">Manage your sales opportunities</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Currency Toggle - same as products page */}
            <CurrencyToggle value={currency} onChange={changeCurrency} />
            <Button
              onClick={() => router.push('/crm/leads')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              View Leads
            </Button>
            <Button
              onClick={() => router.push('/quotations/create')}
              className="text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: getThemeColor() }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Quote (Creates Opportunity)
            </Button>
          </div>
        </div>

        {/* AI Recommendation and Metrics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Recommendation Card - Left Side */}
          <div>
            <AIRecommendationCard 
              title="Opportunity Management AI"
              subtitle="Your intelligent assistant for opportunity optimization"
              onRecommendationComplete={handleRecommendationComplete}
              page="opportunities"
              enableAI={true}
            />
          </div>

          {/* Metrics Cards - Right Side */}
          <div className="space-y-4">
            {/* Main Metrics Row - 3 cards equal width */}
            <div className="grid grid-cols-3 gap-4">
              {/* Total Opportunities */}
              <Card className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-600">Total Opportunities</p>
                  <div className={`p-1.5 rounded-full bg-${theme.primaryBg}`}>
                    <FileBarChart className={`w-3.5 h-3.5 text-${theme.primary}`} />
                </div>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-lg font-bold text-gray-900">{opportunities.length}</p>
                  <MiniLineChart 
                    data={trends.totalTrend} 
                    color={getThemeColor()} 
                    width={50} 
                    height={18} 
                  />
              </div>
            </Card>
            
              {/* Pipeline Value */}
              <Card className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-600">Pipeline Value</p>
                  <div className="p-1.5 rounded-full bg-blue-100">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                </div>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-lg font-bold text-blue-600" key={`pipeline-${currency}`}>{formatCurrencyAmount(calculatePipelineValue())}</p>
                  <MiniLineChart 
                    data={trends.pipelineTrend} 
                    color="#2563eb" 
                    width={50} 
                    height={18} 
                  />
              </div>
            </Card>
            
              {/* Closed Revenue */}
              <Card className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-600">Closed Revenue</p>
                  <div className="p-1.5 rounded-full bg-green-100">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-lg font-bold text-green-600" key={`revenue-${currency}`}>{formatCurrencyAmount(calculateClosedRevenue())}</p>
                  <MiniLineChart 
                    data={trends.revenueTrend} 
                    color="#16a34a" 
                    width={50} 
                    height={18} 
                  />
                </div>
              </Card>
              </div>
            
            {/* Additional Metrics Row - 4 cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-600">Projected Close</p>
                    <p className="text-lg font-bold text-purple-600">{calculateProjectedClose()}</p>
                  </div>
                  <div className="p-1.5 rounded-full bg-purple-100">
                    <Calendar className="w-4 h-4 text-purple-600" />
                  </div>
                </div>
              </Card>
              
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Quote Sent</p>
                    <p className="text-lg font-bold text-yellow-600">{opportunities.filter(o => o.stage === 'QUOTE_SENT').length}</p>
                  </div>
                  <div className="p-1.5 rounded-full bg-yellow-100">
                    <FileBarChart className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
            </Card>
            
              <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-600">Won Deals</p>
                    <p className="text-lg font-bold text-emerald-600">{opportunities.filter(o => o.stage === 'WON').length}</p>
                </div>
                  <div className="p-1.5 rounded-full bg-emerald-100">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </Card>
            
              <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-600">Lost Deals</p>
                    <p className="text-lg font-bold text-red-600">{opportunities.filter(o => o.stage === 'LOST').length}</p>
                  </div>
                  <div className="p-1.5 rounded-full bg-red-100">
                    <XCircle className="w-4 h-4 text-red-600" />
                </div>
                </div>
              </Card>
              </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">


          {/* Opportunities List */}
          {opportunities.length === 0 && !loading && (
            <Card className="p-12 text-center">
              <FileBarChart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No opportunities found</h3>
              <p className="text-gray-500 mb-6">Get started by converting leads to opportunities.</p>
              <div className="flex justify-center gap-3">
                <Button 
                  onClick={() => router.push('/crm/leads')} 
                  variant="outline"
                  className="border-gray-300 hover:bg-gray-50"
                >
                  View Leads
                </Button>
                <Button 
                  onClick={() => router.push('/quotations/create')}
                  className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white border-0 font-medium`}
                  style={{
                    backgroundColor: theme.primary,
                    color: 'white'
                  }}
                >
                  Create Quote (Creates Opportunity)
                </Button>
              </div>
            </Card>
          )}

          {/* Bulk Actions Bar */}
          {selectedOpportunities.length > 0 && (
            <Card>
              <div className="p-4 bg-blue-50 border-l-4 border-blue-400">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-blue-800">
                      {selectedOpportunities.length} opportunity(ies) selected
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Update Status
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleBulkStatusUpdate('NEW_OPPORTUNITY')}>
                          New Opportunity
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusUpdate('QUOTE_SENT')}>
                          Quote Sent
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusUpdate('NEGOTIATION')}>
                          Negotiation
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusUpdate('CONTRACT_SIGNED')}>
                          Contract Signed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusUpdate('WON')}>
                          Won
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusUpdate('LOST')}>
                          Lost
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleBulkDelete}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setSelectedOpportunities([]);
                      }}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Opportunities Table */}
          <Card>
            <CardContent className="p-6">
              <DataTable
              data={opportunities}
              columns={[
                {
                  key: 'contact',
                  label: 'Contact',
                  sortable: true,
                  exportable: true,
                  render: (opp: Opportunity) => {
                    const contactName = opp.lead ? `${opp.lead.firstName} ${opp.lead.lastName}` : opp.account?.name || '-';
                    const contactEmail = opp.lead?.email || opp.account?.email || '';
                    return (
                      <div>
                        <div className="text-sm font-medium text-gray-900">{contactName}</div>
                        <div className="text-sm text-gray-500">{contactEmail}</div>
                      </div>
                    );
                  },
                  exportFormat: (opp: Opportunity) => {
                    const contactName = opp.lead ? `${opp.lead.firstName} ${opp.lead.lastName}` : opp.account?.name || '-';
                    return contactName;
                  }
                },
                {
                  key: 'company',
                  label: 'Company',
                  sortable: true,
                  exportable: true,
                  render: (opp: Opportunity) => {
                    const companyName = opp.lead?.company || opp.account?.name || '-';
                    return <span className="text-sm text-gray-900">{companyName}</span>;
                  },
                  exportFormat: (opp: Opportunity) => opp.lead?.company || opp.account?.name || '-'
                },
                {
                  key: 'stage',
                  label: 'Stage',
                  sortable: true,
                  exportable: true,
                  render: (opp: Opportunity) => {
                    const stageInfo = getStageInfo(opp.stage);
                    return (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stageInfo.color}`}>
                        {stageInfo.label}
                      </span>
                    );
                  },
                  exportFormat: (opp: Opportunity) => {
                    const stageInfo = getStageInfo(opp.stage);
                    return stageInfo.label;
                  }
                },
                {
                  key: 'value',
                  label: 'Deal Value',
                  sortable: true,
                  exportable: true,
                  render: (opp: Opportunity) => (
                    <span className="text-sm text-gray-900">{formatCurrencyAmount(opp.value)}</span>
                  ),
                  exportFormat: (opp: Opportunity) => formatCurrencyAmount(opp.value)
                },
                {
                  key: 'probability',
                  label: 'Probability',
                  sortable: true,
                  exportable: true,
                  render: (opp: Opportunity) => (
                    <span className="text-sm text-gray-900">{opp.probability ? `${opp.probability}%` : '-'}</span>
                  ),
                  exportFormat: (opp: Opportunity) => opp.probability ? `${opp.probability}%` : '-'
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  sortable: false,
                  exportable: false,
                  render: (opp: Opportunity) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/crm/opportunities/${opp.id}`)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditOpportunity(opp)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/quotations?opportunityId=${opp.id}`)}>
                          <FileBarChart className="w-4 h-4 mr-2" />
                          Create Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteOpportunity(opp)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                }
              ]}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={(page) => {
                setCurrentPage(page);
                fetchOpportunities(page);
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search opportunities by name or customer..."
              enableExport={true}
              exportFilename="opportunities"
              isLoading={loading}
              enableSelection={true}
              selectedItems={selectedOpportunities}
              onSelectionChange={setSelectedOpportunities}
              onRowClick={(opp) => handleViewOpportunity(opp)}
              customFilters={
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Stages</option>
                  {stages.map(stage => (
                    <option key={stage.key} value={stage.key}>{stage.label}</option>
                  ))}
                </select>
              }
              bulkActions={
                <div className="flex items-center space-x-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Update Status
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('NEW_OPPORTUNITY')}>
                        New Opportunity
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('QUOTE_SENT')}>
                        Quote Sent
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('NEGOTIATION')}>
                        Negotiation
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('CONTRACT_SIGNED')}>
                        Contract Signed
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('WON')}>
                        Won
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate('LOST')}>
                        Lost
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleBulkDelete}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              }
            />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        onConfirm={confirmationModal.onConfirm}
        onClose={closeConfirmation}
      />

      {/* Edit Opportunity Modal */}
      <EditOpportunityModal
        isOpen={showEditModal}
        onClose={handleEditModalClose}
        opportunity={selectedOpportunity}
        onSave={fetchOpportunities}
      />
    </>
  );
}
