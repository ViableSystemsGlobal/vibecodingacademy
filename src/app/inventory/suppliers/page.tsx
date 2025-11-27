'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Edit, Trash2, Users, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { SkeletonTable } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export default function SuppliersPage() {
  const { status } = useSession();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const { success, error } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>({ name: '', status: 'ACTIVE' });
  const [editing, setEditing] = useState<Supplier | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Populate form when editing changes
  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || '',
        email: editing.email || '',
        phone: editing.phone || '',
        status: editing.status || 'ACTIVE'
      });
    } else {
      setForm({ name: '', status: 'ACTIVE' });
    }
  }, [editing]);

  // Initial load on mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchSuppliers(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Effect for filters and sorting (skip initial mount)
  useEffect(() => {
    if (status === 'authenticated') {
      const isInitialMount = currentPage === 1 && !searchTerm && !statusFilter && !sortBy;
      if (isInitialMount) {
        return;
      }
      fetchSuppliers(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sortBy, sortOrder, status]);

  // Debounced search effect (including when cleared)
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (status === 'authenticated') {
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        return;
      }
      
      const timeoutId = setTimeout(() => {
        setCurrentPage(1);
        fetchSuppliers(1);
      }, searchTerm ? 500 : 0);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, status]);

  const fetchSuppliers = async (page: number = currentPage) => {
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
      
      const response = await fetch(`/api/suppliers?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalItems(data.pagination?.total || 0);
        setCurrentPage(page);
      } else {
        console.error('Failed to fetch suppliers');
        setSuppliers([]);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  };

  const submit = async () => {
    if (!form.name) return;
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `/api/suppliers/${editing.id}` : '/api/suppliers';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) {
      success(editing ? 'Supplier updated' : 'Supplier created');
      setShowAdd(false);
      setEditing(null);
      setForm({ name: '', status: 'ACTIVE' });
      await fetchSuppliers(currentPage);
    } else {
      error('Failed to save supplier');
    }
  };

  const remove = async (s: Supplier) => {
    const res = await fetch(`/api/suppliers/${s.id}`, { method: 'DELETE' });
    if (res.ok) { 
      success('Supplier deleted'); 
      await fetchSuppliers(currentPage);
    } else { 
      error('Failed to delete'); 
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${theme.primaryBg}`}>
            <Users className={`h-5 w-5 text-${theme.primary}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Suppliers</h1>
            <p className="text-gray-600">Manage inventory suppliers</p>
          </div>
        </div>
        <Button 
          className="text-white hover:opacity-90 transition-opacity" 
          style={{ backgroundColor: getThemeColor() }}
          onClick={() => { setShowAdd(true); setEditing(null); }}
        >
          <Plus className="w-4 h-4 mr-2" /> Add Supplier
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <SkeletonTable rows={8} columns={4} />
          ) : (
            <DataTable
              data={suppliers}
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  sortable: true,
                  exportable: true,
                  render: (s: Supplier) => (
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                  ),
                  exportFormat: (s: Supplier) => s.name
                },
                {
                  key: 'contact',
                  label: 'Contact',
                  exportable: true,
                  render: (s: Supplier) => (
                    <div className="text-sm">
                      {s.email && <div>{s.email}</div>}
                      {s.phone && <div className="text-gray-500">{s.phone}</div>}
                    </div>
                  ),
                  exportFormat: (s: Supplier) => s.email || s.phone || '-'
                },
                {
                  key: 'status',
                  label: 'Status',
                  sortable: true,
                  exportable: true,
                  render: (s: Supplier) => (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      s.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {s.status}
                    </span>
                  ),
                  exportFormat: (s: Supplier) => s.status
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  sortable: false,
                  exportable: false,
                  render: (s: Supplier) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(s); setShowAdd(true); }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => remove(s)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                },
              ]}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={(page) => {
                setCurrentPage(page);
                fetchSuppliers(page);
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search suppliers by name, email, or phone..."
              enableExport={true}
              exportFilename="suppliers"
              isLoading={loading}
              onRowClick={(s) => {
                setEditing(s as Supplier);
                setShowAdd(true);
              }}
              customFilters={
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              }
            />
          )}
        </CardContent>
      </Card>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
            <div className="space-y-3">
              <Input placeholder="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Address" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <select className="w-full px-3 py-2 border rounded" value={(form.status as any) || 'ACTIVE'} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancel</Button>
              <Button 
                className="text-white hover:opacity-90 transition-opacity" 
                style={{ backgroundColor: getThemeColor() }}
                onClick={submit}
              >
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


