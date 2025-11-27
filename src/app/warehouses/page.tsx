"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddWarehouseModal } from "@/components/modals/add-warehouse-modal";
import { EditWarehouseModal } from "@/components/modals/edit-warehouse-modal";
import { useToast } from "@/contexts/toast-context";
import { useRouter } from "next/navigation";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { DataTable } from "@/components/ui/data-table";
import { useTheme } from "@/contexts/theme-context";
import { 
  Search, 
  Filter, 
  Building, 
  Plus,
  MapPin,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  CheckCircle,
  XCircle
} from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu-custom";

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  country?: string;
  image?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function WarehousesPage() {
  const { success, error: showError } = useToast();
  const router = useRouter();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const themeColor = getThemeColor();
  
  const handleViewWarehouse = (warehouse: Warehouse) => {
    router.push(`/warehouses/${warehouse.id}`);
  };
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalWarehouses, setTotalWarehouses] = useState(0);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;



  const fetchWarehouses = async (page: number = currentPage) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(sortBy && { sortBy }),
        ...(sortOrder && { sortOrder }),
      });

      const response = await fetch(`/api/warehouses?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch warehouses');
      }
      const data = await response.json();
      setWarehouses(data.warehouses || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalWarehouses(data.pagination?.total || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      showError('Failed to fetch warehouses');
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
    fetchWarehouses(page);
  };

  // Immediate effect for sorting
  useEffect(() => {
    fetchWarehouses(1);
  }, [sortBy, sortOrder]);

  // Debounced search effect (only for search term)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchWarehouses(1);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleWarehouseSuccess = () => {
    fetchWarehouses();
  };

  const handleEditWarehouse = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setIsEditModalOpen(true);
  };

  const handleRecommendationComplete = (id: string) => {
    // Handle recommendation completion (AI card will manage its own state)
    console.log('Recommendation completed:', id);
    success("Recommendation completed! Great job!");
  };

  const handleDeleteWarehouse = async (warehouseId: string, warehouseName: string) => {
    if (!confirm(`Are you sure you want to delete "${warehouseName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/warehouses/${warehouseId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete warehouse');
      }

      success('Warehouse deleted successfully');
      fetchWarehouses();
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      showError(error instanceof Error ? error.message : 'Failed to delete warehouse');
    }
  };

  // Calculate stats from all warehouses (we'll need to fetch separately or use total from API)
  const activeWarehouses = warehouses.filter(w => w.isActive).length;
  const inactiveWarehouses = warehouses.filter(w => !w.isActive).length;

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouses</h1>
          <p className="text-gray-600">Manage your warehouse locations and inventory storage</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="hover:opacity-90 text-white"
          style={{ backgroundColor: getThemeColor() }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Warehouse
        </Button>
      </div>

      {/* AI Recommendation and Metrics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Recommendation Card - Left Side */}
        <div className="lg:col-span-2">
          <AIRecommendationCard
            title="Warehouse Management AI"
            subtitle="Your intelligent assistant for warehouse optimization"
            onRecommendationComplete={handleRecommendationComplete}
            page="warehouses"
            enableAI={true}
          />
        </div>

        {/* Metrics Cards - Right Side */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Warehouses</p>
                <p className="text-xl font-bold text-gray-900">{totalWarehouses}</p>
              </div>
              <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                <Building className={`w-5 h-5 text-${theme.primary}`} />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-xl font-bold text-green-600">{activeWarehouses}</p>
              </div>
              <div className="p-2 rounded-full bg-green-100">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-xl font-bold text-gray-600">{inactiveWarehouses}</p>
              </div>
              <div className="p-2 rounded-full bg-gray-100">
                <XCircle className="w-5 h-5 text-gray-600" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Warehouses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Warehouses ({totalWarehouses})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={warehouses}
            enableSelection={true}
            selectedItems={selectedWarehouses}
            onSelectionChange={setSelectedWarehouses}
            onRowClick={handleViewWarehouse}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalWarehouses}
            onPageChange={handlePageChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            searchValue={searchTerm}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search warehouses by name, code, city, or address..."
            enableExport={true}
            exportFilename="warehouses"
            isLoading={isLoading}
              bulkActions={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const { downloadCSV } = await import('@/lib/export-utils');
                        const exportData = warehouses
                          .filter(w => selectedWarehouses.includes(w.id))
                          .map(warehouse => ({
                            'Name': warehouse.name,
                            'Code': warehouse.code,
                            'Address': warehouse.address || '',
                            'City': warehouse.city || '',
                            'Country': warehouse.country || '',
                            'Status': warehouse.isActive ? 'Active' : 'Inactive',
                            'Created Date': new Date(warehouse.createdAt).toLocaleDateString()
                          }));
                        downloadCSV(exportData, `warehouses_export_${new Date().toISOString().split('T')[0]}.csv`);
                        success(`Successfully exported ${selectedWarehouses.length} warehouse(s)`);
                      } catch (error) {
                        success('Export functionality coming soon!');
                      }
                    }}
                    disabled={selectedWarehouses.length === 0}
                  >
                    Export
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => success('Delete functionality coming soon!')}
                    disabled={selectedWarehouses.length === 0}
                  >
                    Delete
                  </Button>
                </div>
              }
              columns={[
                {
                  key: 'name',
                  label: 'Warehouse',
                  sortable: true,
                  render: (warehouse) => (
                    <div className="flex items-center">
                      {warehouse.image ? (
                        <img 
                          key={warehouse.id}
                          src={`/${warehouse.image}`} 
                          alt={warehouse.name}
                          className="w-10 h-10 rounded-lg object-cover mr-3"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const iconDiv = target.nextElementSibling;
                            if (iconDiv && iconDiv.tagName === 'DIV') {
                              (iconDiv as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div 
                        className="p-2 rounded-lg mr-3 items-center justify-center"
                        style={{ 
                          backgroundColor: theme.primaryBg || 'rgba(59, 130, 246, 0.1)',
                          display: warehouse.image ? 'none' : 'flex'
                        }}
                      >
                        <Building 
                          className="h-4 w-4"
                          style={{ color: themeColor || '#2563eb' }}
                        />
                        </div>
                      <div>
                        <div className="font-medium text-gray-900">{warehouse.name}</div>
                      </div>
                    </div>
                  )
                },
                {
                  key: 'code',
                  label: 'Code',
                  sortable: true,
                  render: (warehouse) => (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {warehouse.code}
                    </span>
                  )
                },
                {
                  key: 'location',
                  label: 'Location',
                  render: (warehouse) => (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-1" />
                      {warehouse.city && warehouse.country ? (
                        `${warehouse.city}, ${warehouse.country}`
                      ) : (
                        <span className="text-gray-400">No location set</span>
                      )}
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (warehouse) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      warehouse.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {warehouse.isActive ? 'Active' : 'Inactive'}
                    </span>
                  )
                },
                {
                  key: 'created',
                  label: 'Created',
                  render: (warehouse) => (
                    <div className="text-sm text-gray-600">
                      {new Date(warehouse.createdAt).toLocaleDateString()}
                    </div>
                  )
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (warehouse) => (
                    <DropdownMenu
                      trigger={
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      }
                      items={[
                        {
                          label: "View Details",
                          icon: <Eye className="h-4 w-4" />,
                          onClick: () => handleViewWarehouse(warehouse)
                        },
                        {
                          label: "Edit Warehouse",
                          icon: <Edit className="h-4 w-4" />,
                          onClick: () => handleEditWarehouse(warehouse)
                        },
                        {
                          label: "Delete Warehouse",
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => handleDeleteWarehouse(warehouse.id, warehouse.name),
                          className: "text-red-600"
                        }
                      ]}
                    />
                  )
                }
              ]}
            />
        </CardContent>
      </Card>
      </div>
      
      <AddWarehouseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleWarehouseSuccess}
      />
      
      <EditWarehouseModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedWarehouse(null);
        }}
        onSuccess={handleWarehouseSuccess}
        warehouse={selectedWarehouse}
      />
    </>
  );
}
