"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { AddStockMovementModal } from "@/components/modals/add-stock-movement-modal";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu-custom";
import { BulkStockMovementModal } from "@/components/modals/bulk-stock-movement-modal";
import { 
  Plus, 
  Search, 
  Filter, 
  Package, 
  TrendingUp, 
  TrendingDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  FileText,
  Eye,
  FileSpreadsheet,
  MoreHorizontal,
  Download,
  Undo2
} from "lucide-react";

// Helper function to parse product images
const parseProductImages = (images: string | null | undefined): string[] => {
  if (!images) return [];
  if (typeof images === 'string') {
    try {
      return JSON.parse(images);
    } catch (e) {
      return [];
    }
  }
  if (Array.isArray(images)) {
    return images;
  }
  return [];
};


// Product Image Component
const ProductImage = ({ product, size = 'sm' }: { product: { id: string; name: string; sku: string; images?: string | null }; size?: 'xs' | 'sm' | 'md' }) => {
  const images = parseProductImages(product.images);
  const sizeClasses = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8', 
    md: 'h-10 w-10'
  };
  
  // Use image path directly like products page does - no complex normalization needed
  const imageUrl = images.length > 0 ? images[0] : null;
  
  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
              if (nextElement) {
                nextElement.style.display = 'flex';
              }
            }}
          />
          <div className="h-full w-full flex items-center justify-center" style={{display: 'none'}}>
            <Package className="h-3 w-3 text-gray-500" />
          </div>
        </>
      ) : (
        <Package className="h-3 w-3 text-gray-500" />
      )}
    </div>
  );
};

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  reference?: string;
  reason?: string;
  notes?: string;
  userId?: string;
  createdAt: string;
  origin?: string;
  product: {
    id: string;
    name: string;
    sku: string;
    uomBase: string;
    images?: string | null;
  };
  stockItem: {
    id: string;
    quantity: number;
    available: number;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  fromWarehouse?: {
    id: string;
    name: string;
    code: string;
  };
  toWarehouse?: {
    id: string;
    name: string;
    code: string;
  };
}

interface StockMovementType {
  value: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

interface StockMovementsClientProps {
  initialMovements: StockMovement[];
}

// Internal component that uses useSearchParams
function StockMovementsContent({ initialMovements }: StockMovementsClientProps) {
  const [movements, setMovements] = useState<StockMovement[]>(initialMovements);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const { success, error: showError } = useToast();


  const handleViewMovement = (movement: StockMovement) => {
    if (movement.product?.id) {
      router.push(`/products/${movement.product.id}`);
    }
  };



  const movementTypes: StockMovementType[] = [
    {
      value: "RECEIPT",
      label: "Receipt",
      icon: <ArrowDown className="h-4 w-4" />,
      color: "text-green-600",
      description: "Stock received from supplier"
    },
    {
      value: "ADJUSTMENT",
      label: "Adjustment",
      icon: <RotateCcw className="h-4 w-4" />,
      color: "text-blue-600",
      description: "Manual stock adjustment"
    },
    {
      value: "TRANSFER_IN",
      label: "Transfer In",
      icon: <ArrowRightLeft className="h-4 w-4" />,
      color: "text-purple-600",
      description: "Stock transferred in"
    },
    {
      value: "TRANSFER_OUT",
      label: "Transfer Out",
      icon: <ArrowRightLeft className="h-4 w-4" />,
      color: "text-orange-600",
      description: "Stock transferred out"
    },
    {
      value: "SALE",
      label: "Sale",
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-emerald-600",
      description: "Stock sold to customer"
    },
    {
      value: "RETURN",
      label: "Return",
      icon: <ArrowUp className="h-4 w-4" />,
      color: "text-cyan-600",
      description: "Stock returned from customer"
    },
    {
      value: "DAMAGE",
      label: "Damage",
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "text-red-600",
      description: "Stock damaged/lost"
    },
    {
      value: "THEFT",
      label: "Theft",
      icon: <XCircle className="h-4 w-4" />,
      color: "text-red-700",
      description: "Stock stolen"
    },
    {
      value: "EXPIRY",
      label: "Expiry",
      icon: <Calendar className="h-4 w-4" />,
      color: "text-yellow-600",
      description: "Stock expired"
    },
    {
      value: "OTHER",
      label: "Other",
      icon: <FileText className="h-4 w-4" />,
      color: "text-gray-600",
      description: "Other reasons"
    }
  ];

  const fetchMovements = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedType !== "all") params.append("type", selectedType);
      
      // Add product filter if present in URL
      const productParam = searchParams.get('product');
      if (productParam) {
        params.append("productId", productParam);
      }
      
      const response = await fetch(`/api/stock-movements?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMovements(data.movements || []);
      } else {
        console.error('Failed to fetch stock movements');
      }
    } catch (error) {
      console.error('Error fetching stock movements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [selectedType, searchParams]);

  const handleRecommendationComplete = (id: string) => {
    // Handle recommendation completion (AI card will manage its own state)
    console.log('Recommendation completed:', id);
    success("Recommendation completed! Great job!");
  };

  // Handle product filter from URL
  useEffect(() => {
    const productParam = searchParams.get('product');
    if (productParam) {
      setSearchTerm(productParam);
    }
  }, [searchParams]);

  const handleMovementAdded = () => {
    // Refresh the movements list
    fetchMovements();
  };

  const handleBulkUploadSuccess = () => {
    // Refresh the movements list
    fetchMovements();
    setIsBulkUploadModalOpen(false);
  };

  const handleDownloadGRN = async (movement: StockMovement) => {
    try {
      // Debug: Log the notes content
      console.log('Movement notes:', movement.notes);
      
      // Check if movement has any GRN-related content in notes
      if (!movement.notes || (!movement.notes.includes('GRN:') && !movement.notes.includes('grn') && !movement.notes.includes('uploads/stock-movements'))) {
        showError(`No GRN document found for this movement. Notes: ${movement.notes || 'No notes'}`);
        return;
      }

      const response = await fetch(`/api/stock-movements/${movement.id}/grn`);
      
      if (!response.ok) {
        const errorData = await response.json();
        showError(errorData.error || "Failed to download GRN");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GRN-${movement.reference || movement.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      success("GRN document downloaded successfully");
    } catch (error) {
      console.error('Error downloading GRN:', error);
      showError("Failed to download GRN document");
    }
  };

  const handleReverseMovement = async (movement: StockMovement) => {
    try {
      const response = await fetch(`/api/stock-movements/${movement.id}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to reverse movement');
      }

      success("Movement reversed successfully");
      fetchMovements(); // Refresh the table
    } catch (error) {
      console.error('Error reversing movement:', error);
      showError("Failed to reverse movement");
    }
  };

  const getMovementTypeInfo = (type: string) => {
    return movementTypes.find(t => t.value === type) || movementTypes[movementTypes.length - 1];
  };

  const filteredMovements = movements.filter(movement => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (movement.product?.name && movement.product.name.toLowerCase().includes(searchLower)) ||
      (movement.product?.sku && movement.product.sku.toLowerCase().includes(searchLower)) ||
      (movement.reference && movement.reference.toLowerCase().includes(searchLower)) ||
      (movement.reason && movement.reason.toLowerCase().includes(searchLower));
    
    const matchesType = selectedType === "all" || movement.type === selectedType;
    
    // Date filtering
    const movementDate = new Date(movement.createdAt);
    const matchesDateFrom = !dateFrom || movementDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || movementDate <= new Date(dateTo + 'T23:59:59');
    
    // Warehouse filtering
    const matchesWarehouse = selectedWarehouse === "all" || 
      (selectedWarehouse === "main" && movement.warehouse?.name === "Main Warehouse") ||
      (selectedWarehouse === "retail" && movement.warehouse?.name === "Retail Store") ||
      (selectedWarehouse === "poolshop" && movement.warehouse?.name === "PoolShop Main");
    
    return matchesSearch && matchesType && matchesDateFrom && matchesDateTo && matchesWarehouse;
  });

  const getQuantityColor = (quantity: number) => {
    return quantity > 0 ? "text-green-600" : "text-red-600";
  };

  const getQuantityIcon = (quantity: number) => {
    return quantity > 0 ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
          <p className="text-gray-600">Track and manage all stock movements</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            onClick={fetchMovements}
            variant="outline"
          >
            Refresh Data
          </Button>
          <Button 
            onClick={() => setIsBulkUploadModalOpen(true)}
            variant="outline"
            className="mr-2"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: getThemeColor() }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Stock Movement
          </Button>
        </div>
      </div>

      {/* AI Recommendation and Metrics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Recommendation Card - Left Side */}
        <div className="lg:col-span-2">
          <AIRecommendationCard
            title="Stock Movement AI"
            subtitle="Your intelligent assistant for movement tracking"
            onRecommendationComplete={handleRecommendationComplete}
            page="stock-movements"
            enableAI={true}
          />
        </div>

        {/* Metrics Cards - Right Side */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Movements</p>
                <p className="text-xl font-bold text-gray-900">{movements.length}</p>
              </div>
              <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                <Package className={`w-5 h-5 text-${theme.primary}`} />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock Ins</p>
                <p className="text-xl font-bold text-green-600">{movements.filter(m => m.quantity > 0).length}</p>
              </div>
              <div className="p-2 rounded-full bg-green-100">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock Outs</p>
                <p className="text-xl font-bold text-red-600">{movements.filter(m => m.quantity < 0).length}</p>
              </div>
              <div className="p-2 rounded-full bg-red-100">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Adjustments</p>
                <p className="text-xl font-bold text-blue-600">{movements.filter(m => m.type === 'ADJUSTMENT').length}</p>
              </div>
              <div className="p-2 rounded-full bg-blue-100">
                <RotateCcw className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stock Movements ({filteredMovements.length})</CardTitle>
              <CardDescription>
                Complete history of all stock movements and adjustments
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pb-0">
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by product name, SKU, reference, or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {movementTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsMoreFiltersOpen(true)}
                className="flex items-center space-x-1"
              >
                <Filter className="h-4 w-4" />
                <span>More Filters</span>
              </Button>
            </div>
          </div>
        </CardContent>
        <CardContent className="p-0">
          <DataTable
            data={filteredMovements}
            enableSelection={true}
            selectedItems={selectedMovements}
            onSelectionChange={setSelectedMovements}
            onRowClick={handleViewMovement}
            bulkActions={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const { downloadCSV } = await import('@/lib/export-utils');
                      const exportData = movements
                        .filter(m => selectedMovements.includes(m.id))
                        .map(movement => ({
                          'Product': movement.product?.name || 'Product Deleted',
                          'SKU': movement.product?.sku || movement.productId || 'N/A',
                          'Type': movement.type,
                          'Quantity': movement.quantity,
                          'Reference': movement.reference || '',
                          'Reason': movement.reason || '',
                          'Date': new Date(movement.createdAt).toLocaleDateString(),
                          'Stock After': movement.stockItem.quantity,
                          'Available': movement.stockItem.available
                        }));
                      downloadCSV(exportData, `stock_movements_export_${new Date().toISOString().split('T')[0]}.csv`);
                      success(`Successfully exported ${selectedMovements.length} movement(s)`);
                    } catch (error) {
                      success('Export functionality coming soon!');
                    }
                  }}
                  disabled={selectedMovements.length === 0}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Export
                </Button>
                <Button
                  size="sm"
                  onClick={() => success('Delete functionality coming soon!')}
                  disabled={selectedMovements.length === 0}
                  className="text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: getThemeColor() }}
                >
                  Delete
                </Button>
              </div>
            }
            columns={[
              {
                key: 'product',
                label: 'Product',
                render: (movement) => (
                  <div className="flex items-center space-x-3">
                    {movement.product ? (
                      <>
                        <ProductImage product={movement.product} size="sm" />
                        <div>
                          <div className="font-medium text-gray-900">{movement.product.name}</div>
                          <div className="text-sm text-gray-500">{movement.product.sku}</div>
                        </div>
                      </>
                    ) : (
                      <div>
                        <div className="font-medium text-gray-500 italic">Product Deleted</div>
                        <div className="text-sm text-gray-400">SKU: {movement.productId || 'N/A'}</div>
                      </div>
                    )}
                  </div>
                )
              },
              {
                key: 'type',
                label: 'Type',
                render: (movement) => {
                  const typeInfo = getMovementTypeInfo(movement.type);
                  return (
                    <div className="flex items-center">
                      <div className={`p-1 rounded ${typeInfo.color}`}>
                        {typeInfo.icon}
                      </div>
                      <span className="ml-2 font-medium">{typeInfo.label}</span>
                    </div>
                  );
                }
              },
              {
                key: 'quantity',
                label: 'Quantity',
                render: (movement) => (
                  <div className={`flex items-center font-medium ${getQuantityColor(movement.quantity)}`}>
                    {getQuantityIcon(movement.quantity)}
                    <span className="ml-1">
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.product?.uomBase || 'pcs'}
                    </span>
                  </div>
                )
              },
              {
                key: 'origin',
                label: 'Origin/Destination',
                render: (movement) => {
                  // Generate origin based on movement type and warehouse information
                  const getOrigin = () => {
                    switch (movement.type) {
                      case 'RECEIPT':
                        return 'Supplier';
                      case 'SALE':
                        return 'Customer';
                      case 'TRANSFER_IN':
                        return movement.toWarehouse?.name || movement.warehouse?.name || 'Other Warehouse';
                      case 'TRANSFER_OUT':
                        return movement.fromWarehouse?.name || movement.warehouse?.name || 'Other Warehouse';
                      case 'TRANSFER':
                        // For combined transfer type, show both warehouses
                        if (movement.fromWarehouse && movement.toWarehouse) {
                          return `${movement.fromWarehouse.name} → ${movement.toWarehouse.name}`;
                        } else if (movement.fromWarehouse) {
                          return `${movement.fromWarehouse.name} → Other`;
                        } else if (movement.toWarehouse) {
                          return `Other → ${movement.toWarehouse.name}`;
                        }
                        return 'Warehouse Transfer';
                      case 'RETURN':
                        return 'Customer Return';
                      case 'ADJUSTMENT':
                        return movement.warehouse?.name || 'System Adjustment';
                      case 'DAMAGE':
                      case 'THEFT':
                      case 'EXPIRY':
                        return movement.warehouse?.name || 'Internal';
                      default:
                        return movement.warehouse?.name || 'Unknown';
                    }
                  };

                  return (
                    <span className="text-sm text-gray-600">
                      {movement.origin || getOrigin()}
                    </span>
                  );
                }
              },
              {
                key: 'reference',
                label: 'Reference',
                render: (movement) => (
                  <span className="text-sm text-gray-600">
                    {movement.reference || '-'}
                  </span>
                )
              },
              {
                key: 'reason',
                label: 'Reason',
                render: (movement) => (
                  <span className="text-sm text-gray-600">
                    {movement.reason || '-'}
                  </span>
                )
              },
              {
                key: 'date',
                label: 'Date',
                render: (movement) => (
                  <div>
                    <div className="text-sm text-gray-600">
                      {new Date(movement.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(movement.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                )
              },
              {
                key: 'stockAfter',
                label: 'Current Stock',
                render: (movement) => (
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {movement.stockItem?.quantity || 0} {movement.product?.uomBase || 'pcs'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Available: {movement.stockItem?.available || 0}
                    </div>
                  </div>
                )
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (movement) => (
                  <DropdownMenu
                    trigger={
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    }
                    items={[
                      ...(movement.product?.id ? [{
                        label: "View Product",
                        icon: <Eye className="h-4 w-4" />,
                        onClick: () => router.push(`/products/${movement.product.id}`)
                      }] : []),
                      {
                        label: "Download GRN",
                        icon: <Download className="h-4 w-4" />,
                        onClick: () => handleDownloadGRN(movement)
                      },
                      {
                        label: "Reverse Movement",
                        icon: <Undo2 className="h-4 w-4" />,
                        onClick: () => handleReverseMovement(movement)
                      }
                    ]}
                  />
                )
              }
            ]}
            itemsPerPage={10}
          />
        </CardContent>
      </Card>

      {/* Add Movement Modal */}
      <AddStockMovementModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleMovementAdded}
      />

      {/* Bulk Upload Modal */}
      <BulkStockMovementModal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        onSuccess={handleBulkUploadSuccess}
      />

      {/* More Filters Modal */}
      <Dialog open={isMoreFiltersOpen} onOpenChange={setIsMoreFiltersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>More Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <Input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  const selectedDate = e.target.value;
                  if (dateTo && selectedDate && new Date(selectedDate) > new Date(dateTo)) {
                    setDateTo("");
                  }
                  setDateFrom(selectedDate);
                }}
                className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <Input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  const selectedDate = e.target.value;
                  if (dateFrom && selectedDate && new Date(selectedDate) < new Date(dateFrom)) {
                    setDateTo("");
                  } else {
                    setDateTo(selectedDate);
                  }
                }}
                className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              />
              {dateFrom && dateTo && new Date(dateTo) < new Date(dateFrom) && (
                <p className="text-red-500 text-xs mt-1">Date To cannot be before Date From</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse
              </label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                <option value="all">All Warehouses</option>
                <option value="main">Main Warehouse</option>
                <option value="retail">Retail Store</option>
                <option value="poolshop">PoolShop Main</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSelectedWarehouse("all");
                }}
              >
                Clear Filters
              </Button>
              <Button
                onClick={() => setIsMoreFiltersOpen(false)}
                className="text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: getThemeColor() }}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main export with Suspense boundary
export function StockMovementsClient({ initialMovements }: StockMovementsClientProps) {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 ml-3">Loading stock movements...</p>
        </div>
      </div>
    }>
      <StockMovementsContent initialMovements={initialMovements} />
    </Suspense>
  );
}
