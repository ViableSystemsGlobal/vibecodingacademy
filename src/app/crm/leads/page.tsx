'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, Users, TrendingUp, Clock, CheckCircle, Grid, List, Upload, FileBarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu } from '@/components/ui/dropdown-menu-custom';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { AddLeadModal } from '@/components/modals/add-lead-modal';
import { EditLeadModal } from '@/components/modals/edit-lead-modal';
import { ViewLeadModal } from '@/components/modals/view-lead-modal';
import { ConfirmDeleteModal } from '@/components/modals/confirm-delete-modal';
import { ConvertToOpportunityModal } from '@/components/modals/convert-to-opportunity-modal';
import { AIRecommendationCard } from '@/components/ai-recommendation-card';
import { DataTable } from '@/components/ui/data-table';
import { SkeletonTable, SkeletonMetricCard } from '@/components/ui/skeleton';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  leadType: 'INDIVIDUAL' | 'COMPANY';
  company?: string;
  subject?: string;
  source?: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
  assignedTo?: User[];
  interestedProducts?: Product[];
  followUpDate?: string;
  notes?: string;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
}

const statusColors = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  QUALIFIED: 'bg-green-100 text-green-800',
  QUOTE_SENT: 'bg-purple-100 text-purple-800', // Quote sent = converted
  CONVERTED_TO_OPPORTUNITY: 'bg-purple-100 text-purple-800', // Main status when quote is sent
  CONVERTED: 'bg-purple-100 text-purple-800', // Legacy status
  LOST: 'bg-red-100 text-red-800',
  UNQUALIFIED: 'bg-gray-100 text-gray-800',
};

// Helper function to normalize status for display and filtering
const normalizeLeadStatus = (status: string): string => {
  // Map legacy QUOTE_SENT to CONVERTED_TO_OPPORTUNITY
  if (status === 'QUOTE_SENT') {
    return 'CONVERTED_TO_OPPORTUNITY';
  }
  // Map legacy CONVERTED to CONVERTED_TO_OPPORTUNITY
  if (status === 'CONVERTED' || status === 'OPPORTUNITY' || status === 'NEW_OPPORTUNITY') {
    return 'CONVERTED_TO_OPPORTUNITY';
  }
  return status;
};

// Helper function to get display label for status
const getStatusLabel = (status: string): string => {
  const normalized = normalizeLeadStatus(status);
  if (normalized === 'CONVERTED_TO_OPPORTUNITY') {
    return 'Converted';
  }
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export default function LeadsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const { success, error } = useToast();
  
  const handleRowClick = (lead: Lead) => {
    router.push(`/crm/leads/${lead.id}`);
  };

  // All state hooks must be called before any conditional returns
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  // Auto-open Add Lead modal when navigated with ?new=1
  useEffect(() => {
    const isNew = searchParams?.get('new');
    if (isNew === '1') {
      setShowAddModal(true);
    }
  }, [searchParams]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [metrics, setMetrics] = useState({
    total: 0,
    new: 0,
    qualified: 0,
    converted: 0,
  });
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  const [aiRecommendations, setAiRecommendations] = useState([
    {
      id: '1',
      title: 'Follow up with new leads',
      description: 'You have 3 new leads from today that need immediate follow-up within 24 hours.',
      priority: 'high' as const,
      completed: false,
    },
    {
      id: '2',
      title: 'Qualify recent prospects',
      description: 'Review and qualify 5 leads that have been in "New" status for over 3 days.',
      priority: 'medium' as const,
      completed: false,
    },
    {
      id: '3',
      title: 'Update lead scores',
      description: 'Update lead scores based on recent interactions and engagement levels.',
      priority: 'low' as const,
      completed: false,
    },
  ]);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const fetchLeads = async (page: number = currentPage) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(sortBy && { sortBy }),
        ...(sortOrder && { sortOrder }),
      });

      const response = await fetch(`/api/leads?${params}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalLeads(data.pagination?.total || 0);
        setCurrentPage(page);
        calculateMetrics(data.leads || []);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
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
    fetchLeads(page);
  };

  const calculateMetrics = (leadsData: Lead[]) => {
    const newLeads = leadsData.filter(lead => normalizeLeadStatus(lead.status) === 'NEW').length;
    const qualifiedLeads = leadsData.filter(lead => normalizeLeadStatus(lead.status) === 'QUALIFIED').length;
    const convertedLeads = leadsData.filter(lead => normalizeLeadStatus(lead.status) === 'CONVERTED_TO_OPPORTUNITY').length;
    
    setMetrics({
      total: leadsData.length,
      new: newLeads,
      qualified: qualifiedLeads,
      converted: convertedLeads,
    });
  };

  // Immediate effect for filters and sorting
  useEffect(() => {
    fetchLeads(1);
  }, [statusFilter, sortBy, sortOrder]);

  // Debounced search effect (only for search term)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchLeads(1);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Don't show loading skeleton during navigation

  // Don't render if not authenticated
  if (status === 'unauthenticated') {
    return null;
  }

  const handleAddLead = async (leadData: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    leadType: 'INDIVIDUAL' | 'COMPANY';
    company?: string;
    subject?: string;
    source?: string;
    status: string;
    assignedTo?: User[];
    interestedProducts?: Product[];
    followUpDate?: string;
    notes?: string;
  }) => {
    if (status !== 'authenticated') {
      alert('Please sign in to create leads');
      return;
    }
    
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
        credentials: 'include',
      });

      if (response.ok) {
        await fetchLeads();
        setShowAddModal(false);
        success('Lead created successfully!');
      } else {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('Error adding lead:', errorData);
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        alert(`Failed to create lead: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error adding lead:', error);
      alert(`Failed to create lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEditLead = async (leadData: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    leadType: 'INDIVIDUAL' | 'COMPANY';
    company?: string;
    subject?: string;
    source?: string;
    status: string;
    assignedTo?: User[];
    interestedProducts?: Product[];
    followUpDate?: string;
    notes?: string;
  }) => {
    if (!selectedLead) return;

    try {
      const response = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
        credentials: 'include',
      });

      if (response.ok) {
        await fetchLeads();
        setShowEditModal(false);
        setSelectedLead(null);
        success('Lead updated successfully!');
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to update lead');
      }
    } catch (err) {
      console.error('Error updating lead:', err);
      error('Failed to update lead');
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead) return;

    try {
      const response = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchLeads();
        setShowDeleteModal(false);
        setSelectedLead(null);
        success('Lead deleted successfully!');
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to delete lead');
      }
    } catch (err) {
      console.error('Error deleting lead:', err);
      error('Failed to delete lead');
    }
  };

  const handleCreateQuote = (lead: Lead) => {
    console.log('🎯 Creating quote for lead:', lead.firstName, lead.lastName);
    // Navigate to create quote page with lead details pre-filled
    // The lead will be converted to opportunity only after the quote is saved
    const queryParams = new URLSearchParams({
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadEmail: lead.email || '',
      leadPhone: lead.phone || '',
      leadCompany: lead.company || '',
    });
    
    const url = `/quotations/create?${queryParams.toString()}`;
    console.log('🎯 Navigating to:', url);
    router.push(url);
  };

  const handleConvertToOpportunity = async (stage: string) => {
    if (!selectedLead) return;

    try {
      const response = await fetch(`/api/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedLead,
          status: stage
        }),
        credentials: 'include',
      });

      if (response.ok) {
        await fetchLeads();
        setShowConvertModal(false);
        setSelectedLead(null);
        success(`Lead converted to opportunity at ${stage} stage!`);
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to convert lead to opportunity');
      }
    } catch (err) {
      console.error('Error converting lead:', err);
      error('Failed to convert lead to opportunity');
    }
  };

  const openEditModal = (lead: Lead) => {
    setSelectedLead(lead);
    setShowEditModal(true);
  };

  const openConvertModal = (lead: Lead) => {
    setSelectedLead(lead);
    setShowConvertModal(true);
  };

  const openViewModal = (lead: Lead) => {
    setSelectedLead(lead);
    setShowViewModal(true);
  };

  const openDeleteModal = (lead: Lead) => {
    setSelectedLead(lead);
    setShowDeleteModal(true);
  };

  const handleRecommendationComplete = (id: string) => {
    setAiRecommendations(prev => 
      prev.map(rec => 
        rec.id === id ? { ...rec, completed: true } : rec
      )
    );
    success('Recommendation completed! Great job!');
  };

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    e.dataTransfer.setData('application/json', JSON.stringify(lead));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const leadData = JSON.parse(e.dataTransfer.getData('application/json'));
    
    // Normalize both statuses for comparison
    const currentNormalized = normalizeLeadStatus(leadData.status);
    const newNormalized = normalizeLeadStatus(newStatus);
    
    if (currentNormalized === newNormalized) {
      return; // No change needed
    }

    // Use CONVERTED_TO_OPPORTUNITY for CONVERTED status
    const statusToSave = newStatus === 'CONVERTED' ? 'CONVERTED_TO_OPPORTUNITY' : newStatus;

    try {
      const response = await fetch(`/api/leads/${leadData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leadData, status: statusToSave }),
        credentials: 'include',
      });

      if (response.ok) {
        // Update local state
        setLeads(prevLeads => 
          prevLeads.map(lead => 
            lead.id === leadData.id ? { ...lead, status: statusToSave as any } : lead
          )
        );
        
        // Recalculate metrics
        const updatedLeads = leads.map(lead => 
          lead.id === leadData.id ? { ...lead, status: statusToSave as any } : lead
        );
        calculateMetrics(updatedLeads);
        
        // Show success toast
        success(`Lead moved to ${newStatus.toLowerCase()} successfully!`);
      } else {
        error('Failed to update lead status');
      }
    } catch (err) {
      console.error('Error updating lead status:', err);
      error('Failed to update lead status');
    }
  };

  // Bulk action handlers
  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return;
    
    try {
      const response = await fetch('/api/leads/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedLeads }),
      });

      if (response.ok) {
        setLeads(leads.filter(l => !selectedLeads.includes(l.id)));
        setSelectedLeads([]);
        success(`Successfully deleted ${selectedLeads.length} lead(s)`);
        calculateMetrics(leads.filter(l => !selectedLeads.includes(l.id)));
      } else {
        error('Failed to delete leads');
      }
    } catch (err) {
      console.error('Error deleting leads:', err);
      error('Failed to delete leads');
    }
  };

  const handleBulkExport = async () => {
    if (selectedLeads.length === 0) return;
    
    try {
      const response = await fetch('/api/leads/bulk-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedLeads }),
      });

      if (response.ok) {
        const { data, filename } = await response.json();
        const { downloadCSV } = await import('@/lib/export-utils');
        downloadCSV(data, filename);
        success(`Successfully exported ${selectedLeads.length} lead(s)`);
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to export leads');
      }
    } catch (err) {
      console.error('Error exporting leads:', err);
      error('Failed to export leads');
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedLeads.length === 0) return;
    
    try {
      const response = await fetch('/api/leads/bulk-update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedLeads, status: newStatus }),
      });

      if (response.ok) {
        setLeads(leads.map(lead => 
          selectedLeads.includes(lead.id) ? { ...lead, status: newStatus as any } : lead
        ));
        setSelectedLeads([]);
        success(`Successfully updated ${selectedLeads.length} lead(s) to ${newStatus.toLowerCase()}`);
        calculateMetrics(leads.map(lead => 
          selectedLeads.includes(lead.id) ? { ...lead, status: newStatus as any } : lead
        ));
      } else {
        error('Failed to update leads');
      }
    } catch (err) {
      console.error('Error updating leads:', err);
      error('Failed to update leads');
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-gray-600">Manage your sales leads and prospects</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'text-white hover:opacity-90 transition-opacity' : 'hover:bg-gray-200'}
              style={viewMode === 'list' ? { backgroundColor: getThemeColor() } : {}}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className={viewMode === 'kanban' ? 'text-white hover:opacity-90 transition-opacity' : 'hover:bg-gray-200'}
              style={viewMode === 'kanban' ? { backgroundColor: getThemeColor() } : {}}
            >
              <Grid className="w-4 h-4" />
            </Button>
          </div>
          <Button 
            variant="outline"
            onClick={() => {/* TODO: Implement import functionality */}}
            className="mr-2"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button 
            onClick={() => setShowAddModal(true)}
            className="text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: getThemeColor() }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* AI Recommendation and Metrics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Recommendation Card - Left Side */}
        <div className="lg:col-span-2">
          <AIRecommendationCard
            title="Lead Management AI"
            subtitle="Your intelligent assistant for lead optimization"
            onRecommendationComplete={handleRecommendationComplete}
            page="leads"
            enableAI={true}
          />
        </div>

        {/* Metrics Cards - Right Side */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Leads</p>
                <p className="text-xl font-bold text-gray-900">{metrics.total}</p>
              </div>
              <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                <Users className={`w-5 h-5 text-${theme.primary}`} />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New Leads</p>
                <p className="text-xl font-bold text-blue-600">{metrics.new}</p>
              </div>
              <div className="p-2 rounded-full bg-blue-100">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Qualified</p>
                <p className="text-xl font-bold text-green-600">{metrics.qualified}</p>
              </div>
              <div className="p-2 rounded-full bg-green-100">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Converted</p>
                <p className="text-xl font-bold text-purple-600">{metrics.converted}</p>
              </div>
              <div className="p-2 rounded-full bg-purple-100">
                <CheckCircle className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {viewMode === 'list' ? (
        <Card className="p-6">
        {loading ? (
          <SkeletonTable rows={8} columns={5} />
        ) : (
          <DataTable
            data={leads}
            enableSelection={true}
            selectedItems={selectedLeads}
            onSelectionChange={setSelectedLeads}
            onRowClick={handleRowClick}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalLeads}
            onPageChange={handlePageChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            searchValue={searchTerm}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search leads by name, email, company, phone, or subject..."
            enableExport={true}
            exportFilename="leads"
            isLoading={loading}
            customFilters={
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                  fetchLeads(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="NEW">New</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="CONVERTED_TO_OPPORTUNITY">Converted (Quote Sent)</option>
                <option value="LOST">Lost</option>
              </select>
            }
            bulkActions={
              <div className="flex gap-2">
                <select
                  onChange={(e) => e.target.value && handleBulkStatusUpdate(e.target.value)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue=""
                >
                  <option value="">Update Status</option>
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="CONVERTED">Converted</option>
                  <option value="LOST">Lost</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkExport}
                  disabled={selectedLeads.length === 0}
                >
                  Export
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedLeads.length === 0}
                >
                  Delete
                </Button>
              </div>
            }
            columns={[
              {
                key: 'subject',
                label: 'Subject',
                render: (lead) => (
                  <div>
                    <div className="font-medium text-gray-900">
                      {lead.subject || 'No Subject'}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${statusColors[normalizeLeadStatus(lead.status) as keyof typeof statusColors] || statusColors.NEW}`}>
                        {getStatusLabel(lead.status)}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        lead.leadType === 'COMPANY' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {lead.leadType === 'COMPANY' ? 'Company' : 'Individual'}
                      </span>
                    </div>
                  </div>
                )
              },
              {
                key: 'firstName',
                label: 'Name',
                sortable: true,
                render: (lead) => (
                  <div className="font-medium">
                    {lead.firstName} {lead.lastName}
                  </div>
                )
              },
              {
                key: 'company',
                label: 'Company',
                sortable: true,
                render: (lead) => <span>{lead.company || '-'}</span>
              },
              {
                key: 'contact',
                label: 'Contact',
                render: (lead) => (
                  <div className="text-sm">
                    {lead.email && <div>{lead.email}</div>}
                    {lead.phone && <div className="text-gray-500">{lead.phone}</div>}
                  </div>
                )
              },
              {
                key: 'source',
                label: 'Source',
                render: (lead) => <span>{lead.source || '-'}</span>
              },
              {
                key: 'assignedTo',
                label: 'Assigned To',
                render: (lead) => (
                  <div className="flex flex-wrap gap-1">
                    {lead.assignedTo && lead.assignedTo.length > 0 ? (
                      lead.assignedTo.map((user) => (
                        <span
                          key={user.id}
                          className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full"
                        >
                          {user.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">Unassigned</span>
                    )}
                  </div>
                )
              },
              {
                key: 'followUpDate',
                label: 'Follow-up Date',
                render: (lead) => (
                  <div className="text-sm">
                    {lead.followUpDate ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900">
                          {new Date(lead.followUpDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        {new Date(lead.followUpDate) < new Date() && (
                          <span className="text-red-600 text-xs font-medium">Overdue</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                )
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (lead) => (
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      trigger={
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      }
                    items={[
                      {
                        label: 'View',
                        icon: <Eye className="w-4 h-4" />,
                        onClick: () => openViewModal(lead),
                      },
                      {
                        label: 'Edit',
                        icon: <Edit className="w-4 h-4" />,
                        onClick: () => openEditModal(lead),
                      },
                      {
                        label: 'Create Quote',
                        icon: <FileBarChart className="w-4 h-4" />,
                        onClick: () => handleCreateQuote(lead),
                        className: 'text-green-600',
                      },
                      {
                        label: 'Convert to Opportunity',
                        icon: <TrendingUp className="w-4 h-4" />,
                        onClick: () => openConvertModal(lead),
                        className: 'text-blue-600',
                      },
                      {
                        label: 'Delete',
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: () => openDeleteModal(lead),
                        className: 'text-red-600',
                      },
                    ]}
                    />
                  </div>
                )
              }
            ]}
          />
        )}
      </Card>
      ) : (
        <Card className="p-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="NEW">New</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="CONVERTED_TO_OPPORTUNITY">Converted (Quote Sent)</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* New Leads Column */}
          <div 
            className="bg-gray-50 rounded-lg p-4 min-h-[400px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'NEW')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">New Leads</h3>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                {leads.filter(lead => normalizeLeadStatus(lead.status) === 'NEW').length}
              </span>
            </div>
            <div className="space-y-3">
              {leads.filter(lead => normalizeLeadStatus(lead.status) === 'NEW').map((lead) => (
                <Card 
                  key={lead.id} 
                  className="p-4 cursor-move hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">
                      {lead.firstName} {lead.lastName}
                    </h4>
                    <DropdownMenu
                      trigger={<MoreHorizontal className="w-4 h-4 text-gray-400" />}
                      items={[
                        {
                          label: 'View',
                          icon: <Eye className="w-4 h-4" />,
                          onClick: () => openViewModal(lead),
                        },
                        {
                          label: 'Edit',
                          icon: <Edit className="w-4 h-4" />,
                          onClick: () => openEditModal(lead),
                        },
                        {
                          label: 'Create Quote',
                          icon: <FileBarChart className="w-4 h-4" />,
                          onClick: () => handleCreateQuote(lead),
                          className: 'text-green-600',
                        },
                        {
                          label: 'Convert to Opportunity',
                          icon: <TrendingUp className="w-4 h-4" />,
                          onClick: () => openConvertModal(lead),
                          className: 'text-blue-600',
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 className="w-4 h-4" />,
                          onClick: () => openDeleteModal(lead),
                          className: 'text-red-600',
                        },
                      ]}
                      
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{lead.company || 'No company'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{lead.email}</span>
                    {lead.followUpDate && (
                      <span className="text-xs text-gray-500">
                        Follow-up: {new Date(lead.followUpDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Qualified Leads Column */}
          <div 
            className="bg-gray-50 rounded-lg p-4 min-h-[400px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'QUALIFIED')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Qualified</h3>
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                {leads.filter(lead => normalizeLeadStatus(lead.status) === 'QUALIFIED').length}
              </span>
            </div>
            <div className="space-y-3">
              {leads.filter(lead => normalizeLeadStatus(lead.status) === 'QUALIFIED').map((lead) => (
                <Card 
                  key={lead.id} 
                  className="p-4 cursor-move hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">
                      {lead.firstName} {lead.lastName}
                    </h4>
                    <DropdownMenu
                      trigger={<MoreHorizontal className="w-4 h-4 text-gray-400" />}
                      items={[
                        {
                          label: 'View',
                          icon: <Eye className="w-4 h-4" />,
                          onClick: () => openViewModal(lead),
                        },
                        {
                          label: 'Edit',
                          icon: <Edit className="w-4 h-4" />,
                          onClick: () => openEditModal(lead),
                        },
                        {
                          label: 'Create Quote',
                          icon: <FileBarChart className="w-4 h-4" />,
                          onClick: () => handleCreateQuote(lead),
                          className: 'text-green-600',
                        },
                        {
                          label: 'Convert to Opportunity',
                          icon: <TrendingUp className="w-4 h-4" />,
                          onClick: () => openConvertModal(lead),
                          className: 'text-blue-600',
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 className="w-4 h-4" />,
                          onClick: () => openDeleteModal(lead),
                          className: 'text-red-600',
                        },
                      ]}
                      
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{lead.company || 'No company'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{lead.email}</span>
                    {lead.followUpDate && (
                      <span className="text-xs text-gray-500">
                        Follow-up: {new Date(lead.followUpDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Converted Leads Column */}
          <div 
            className="bg-gray-50 rounded-lg p-4 min-h-[400px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'CONVERTED_TO_OPPORTUNITY')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Converted</h3>
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
                {leads.filter(lead => normalizeLeadStatus(lead.status) === 'CONVERTED_TO_OPPORTUNITY').length}
              </span>
            </div>
            <div className="space-y-3">
              {leads.filter(lead => normalizeLeadStatus(lead.status) === 'CONVERTED_TO_OPPORTUNITY').map((lead) => (
                <Card 
                  key={lead.id} 
                  className="p-4 cursor-move hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">
                      {lead.firstName} {lead.lastName}
                    </h4>
                    <DropdownMenu
                      trigger={<MoreHorizontal className="w-4 h-4 text-gray-400" />}
                      items={[
                        {
                          label: 'View',
                          icon: <Eye className="w-4 h-4" />,
                          onClick: () => openViewModal(lead),
                        },
                        {
                          label: 'Edit',
                          icon: <Edit className="w-4 h-4" />,
                          onClick: () => openEditModal(lead),
                        },
                        {
                          label: 'Create Quote',
                          icon: <FileBarChart className="w-4 h-4" />,
                          onClick: () => handleCreateQuote(lead),
                          className: 'text-green-600',
                        },
                        {
                          label: 'Convert to Opportunity',
                          icon: <TrendingUp className="w-4 h-4" />,
                          onClick: () => openConvertModal(lead),
                          className: 'text-blue-600',
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 className="w-4 h-4" />,
                          onClick: () => openDeleteModal(lead),
                          className: 'text-red-600',
                        },
                      ]}
                      
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{lead.company || 'No company'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{lead.email}</span>
                    {lead.followUpDate && (
                      <span className="text-xs text-gray-500">
                        Follow-up: {new Date(lead.followUpDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Lost Leads Column */}
          <div 
            className="bg-gray-50 rounded-lg p-4 min-h-[400px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'LOST')}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Lost</h3>
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                {leads.filter(lead => lead.status === 'LOST').length}
              </span>
            </div>
            <div className="space-y-3">
              {leads.filter(lead => lead.status === 'LOST').map((lead) => (
                <Card 
                  key={lead.id} 
                  className="p-4 cursor-move hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">
                      {lead.firstName} {lead.lastName}
                    </h4>
                    <DropdownMenu
                      trigger={<MoreHorizontal className="w-4 h-4 text-gray-400" />}
                      items={[
                        {
                          label: 'View',
                          icon: <Eye className="w-4 h-4" />,
                          onClick: () => openViewModal(lead),
                        },
                        {
                          label: 'Edit',
                          icon: <Edit className="w-4 h-4" />,
                          onClick: () => openEditModal(lead),
                        },
                        {
                          label: 'Create Quote',
                          icon: <FileBarChart className="w-4 h-4" />,
                          onClick: () => handleCreateQuote(lead),
                          className: 'text-green-600',
                        },
                        {
                          label: 'Convert to Opportunity',
                          icon: <TrendingUp className="w-4 h-4" />,
                          onClick: () => openConvertModal(lead),
                          className: 'text-blue-600',
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 className="w-4 h-4" />,
                          onClick: () => openDeleteModal(lead),
                          className: 'text-red-600',
                        },
                      ]}
                      
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{lead.company || 'No company'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{lead.email}</span>
                    {lead.followUpDate && (
                      <span className="text-xs text-gray-500">
                        Follow-up: {new Date(lead.followUpDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
          </div>
        </Card>
      )}

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddLead}
        />
      )}

      {showEditModal && selectedLead && (
        <EditLeadModal
          lead={selectedLead}
          onClose={() => {
            setShowEditModal(false);
            setSelectedLead(null);
          }}
          onSave={handleEditLead}
        />
      )}

      {showViewModal && selectedLead && (
        <ViewLeadModal
          lead={selectedLead}
          onClose={() => {
            setShowViewModal(false);
            setSelectedLead(null);
          }}
        />
      )}

      {showDeleteModal && selectedLead && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          title="Delete Lead"
          message="Are you sure you want to delete this lead?"
          itemName={`${selectedLead.firstName} ${selectedLead.lastName}`}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedLead(null);
          }}
          onConfirm={handleDeleteLead}
        />
      )}

      {showConvertModal && selectedLead && (
        <ConvertToOpportunityModal
          isOpen={showConvertModal}
          onClose={() => {
            setShowConvertModal(false);
            setSelectedLead(null);
          }}
          onConvert={handleConvertToOpportunity}
          leadName={`${selectedLead.firstName} ${selectedLead.lastName}`}
        />
      )}
      </div>
    </>
  );
}

