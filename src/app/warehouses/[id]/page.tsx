"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { formatCurrency } from "@/lib/utils";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { useTheme } from "@/contexts/theme-context";
import { CurrencySelector } from "@/components/ui/currency-selector";
import { formatCurrency as formatCurrencyWithSymbol, getCurrencySymbol } from "@/lib/currency";
import { 
  Building, 
  MapPin, 
  Calendar, 
  Hash, 
  CheckCircle, 
  XCircle,
  ArrowLeft,
  Package,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ArrowRightLeft,
  AlertTriangle,
  XCircle as XCircleIcon,
  FileText,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { EditWarehouseModal } from "@/components/modals/edit-warehouse-modal";

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
const ProductImage = ({ product, size = 'sm' }: { product: Product; size?: 'xs' | 'sm' | 'md' }) => {
  const images = parseProductImages(product.images);
  const sizeClasses = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8', 
    md: 'h-10 w-10'
  };
  
  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {images.length > 0 ? (
        <>
          <img
            src={images[0]}
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

interface Product {
  id: string;
  name: string;
  sku: string;
  cost: number;
  images?: string | null; // JSON string in database, will be parsed to string[]
  category: {
    name: string;
  };
  stockItems: {
    quantity: number;
    averageCost: number;
    totalValue: number;
  }[];
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  reference?: string;
  reason?: string;
  notes?: string;
  userId?: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    uomBase: string;
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

export default function WarehouseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'products' | 'movements'>('products');
  const [selectedCurrency, setSelectedCurrency] = useState('GHS');
  const [convertedTotalValue, setConvertedTotalValue] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedProductValues, setConvertedProductValues] = useState<Record<string, { averageCost: number; totalValue: number }>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    stockStatus: '',
    priceRange: { min: '', max: '' },
    movementType: '',
    dateRange: { from: '', to: '' }
  });

  const [aiRecommendations, setAiRecommendations] = useState([
    {
      id: '1',
      title: 'Optimize product placement',
      description: 'Reorganize high-turnover products for easier access and faster picking.',
      priority: 'high' as const,
      completed: false,
    },
    {
      id: '2',
      title: 'Review stock levels',
      description: 'Analyze current stock levels and adjust reorder points for optimal inventory.',
      priority: 'medium' as const,
      completed: false,
    },
    {
      id: '3',
      title: 'Update warehouse capacity',
      description: 'Evaluate current capacity utilization and plan for expansion if needed.',
      priority: 'low' as const,
      completed: false,
    },
  ]);

  const warehouseId = params.id as string;

  const fetchWarehouseDetails = async () => {
    try {
      const response = await fetch(`/api/warehouses/${warehouseId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch warehouse details');
      }
      const data = await response.json();
      setWarehouse(data.warehouse);
    } catch (error) {
      console.error('Error fetching warehouse details:', error);
      showError('Failed to load warehouse details');
    }
  };

  const fetchWarehouseProducts = async () => {
    try {
      const response = await fetch(`/api/warehouses/${warehouseId}/products`);
      if (!response.ok) {
        throw new Error('Failed to fetch warehouse products');
      }
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching warehouse products:', error);
      showError('Failed to load warehouse products');
    }
  };

  const fetchWarehouseStockMovements = async () => {
    try {
      const response = await fetch(`/api/stock-movements?warehouseId=${warehouseId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch warehouse stock movements');
      }
      const data = await response.json();
      setStockMovements(data.movements || []);
    } catch (error) {
      console.error('Error fetching warehouse stock movements:', error);
      showError('Failed to load warehouse stock movements');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchWarehouseDetails(),
        fetchWarehouseProducts(),
        fetchWarehouseStockMovements()
      ]);
      setIsLoading(false);
    };

    if (warehouseId) {
      loadData();
    }
  }, [warehouseId]);

  // Calculate totals
  const totalProducts = products.length;
  // Use averageCost from stockItems (consistent with reports) instead of product.cost
  // The API already filters products for this warehouse, so stockItems should be for this warehouse
  const totalValue = products.reduce((sum, product) => {
    // Sum all stock items for this product (should all be for this warehouse)
    const productValue = product.stockItems?.reduce((itemSum, stockItem) => {
      // Use averageCost from stockItem (weighted average) instead of product.cost
      // This matches the calculation method used in reports
      const costPerUnit = stockItem.averageCost || product.cost || 0;
      return itemSum + (stockItem.quantity * costPerUnit);
    }, 0) || 0;
    return sum + productValue;
  }, 0);
  const totalQuantity = products.reduce((sum, product) => {
    return sum + (product.stockItems?.reduce((itemSum, stockItem) => itemSum + stockItem.quantity, 0) || 0);
  }, 0);

  // Convert currency when totalValue changes
  useEffect(() => {
    const convertInitialValue = async () => {
      if (totalValue > 0) {
        setIsConverting(true);
        try {
          const conversion = await convertCurrencyClient('USD', selectedCurrency, totalValue);
          if (conversion) {
            setConvertedTotalValue(conversion.convertedAmount);
          } else {
            setConvertedTotalValue(totalValue);
          }
        } catch (error) {
          console.error('Error converting initial currency:', error);
          setConvertedTotalValue(totalValue);
        } finally {
          setIsConverting(false);
        }
      }
    };

    convertInitialValue();
  }, [totalValue, selectedCurrency]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !filters.category || product.category.name === filters.category;
    
    const stockItem = product.stockItems?.[0];
    const totalStock = stockItem?.quantity || 0;
    const matchesStockStatus = !filters.stockStatus || 
      (filters.stockStatus === 'in-stock' && totalStock > 0) ||
      (filters.stockStatus === 'out-of-stock' && totalStock === 0) ||
      (filters.stockStatus === 'low-stock' && totalStock > 0 && totalStock <= 10);
    
    const productValue = stockItem?.totalValue || 0;
    const matchesPriceRange = (!filters.priceRange.min || productValue >= parseFloat(filters.priceRange.min)) &&
      (!filters.priceRange.max || productValue <= parseFloat(filters.priceRange.max));
    
    return matchesSearch && matchesCategory && matchesStockStatus && matchesPriceRange;
  });

  const filteredMovements = stockMovements.filter(movement => {
    const matchesSearch = movement.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = !filters.movementType || movement.type === filters.movementType;
    
    const movementDate = new Date(movement.createdAt);
    const matchesDateRange = (!filters.dateRange.from || movementDate >= new Date(filters.dateRange.from)) &&
      (!filters.dateRange.to || movementDate <= new Date(filters.dateRange.to));
    
    return matchesSearch && matchesType && matchesDateRange;
  });

  // Pagination logic for products and movements
  const totalProductPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const totalMovementPages = Math.ceil(filteredMovements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
  const paginatedMovements = filteredMovements.slice(startIndex, endIndex);

  const handleRecommendationComplete = (id: string) => {
    setAiRecommendations(prev => 
      prev.map(rec => 
        rec.id === id ? { ...rec, completed: true } : rec
      )
    );
    success("Recommendation completed! Great job!");
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleEditSuccess = () => {
    // Refresh warehouse data after successful edit
    fetchWarehouseDetails();
  };

  // Debug: Log warehouse data when modal opens
  useEffect(() => {
    if (isEditModalOpen) {
      console.log('Warehouse details page: Opening edit modal with warehouse:', warehouse);
    }
  }, [isEditModalOpen, warehouse]);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Client-side currency conversion function
  const convertCurrencyClient = async (fromCurrency: string, toCurrency: string, amount: number) => {
    try {
      const response = await fetch('/api/currency/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          amount
        }),
      });

      if (!response.ok) {
        throw new Error('Currency conversion failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Error converting currency:', error);
      return null;
    }
  };

  const handleCurrencyChange = async (currency: string) => {
    setSelectedCurrency(currency);
    setIsConverting(true);
    
    try {
      // Convert the total value from USD to the selected currency
      const totalConversion = await convertCurrencyClient('USD', currency, totalValue);
      if (totalConversion) {
        setConvertedTotalValue(totalConversion.convertedAmount);
      } else {
        setConvertedTotalValue(totalValue);
      }

      // Convert individual product values
      const productConversions: Record<string, { averageCost: number; totalValue: number }> = {};
      for (const product of products) {
        const stockItem = product.stockItems?.[0];
        if (stockItem) {
          const costPriceConversion = await convertCurrencyClient('USD', currency, product.cost || 0);
          const quantity = stockItem.quantity || 0;
          const totalValue = quantity * (product.cost || 0);
          const totalValueConversion = await convertCurrencyClient('USD', currency, totalValue);
          
          productConversions[product.id] = {
            averageCost: costPriceConversion?.convertedAmount || (product.cost || 0),
            totalValue: totalValueConversion?.convertedAmount || totalValue
          };
        }
      }
      setConvertedProductValues(productConversions);
    } catch (error) {
      console.error('Error converting currency:', error);
      setConvertedTotalValue(totalValue);
    } finally {
      setIsConverting(false);
    }
  };

  // Helper functions for stock movements
  const getMovementTypeInfo = (type: string) => {
    const types: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
      RECEIPT: { label: "Receipt", icon: <TrendingUp className="h-4 w-4" />, color: "bg-green-100 text-green-600" },
      SALE: { label: "Sale", icon: <TrendingDown className="h-4 w-4" />, color: "bg-red-100 text-red-600" },
      ADJUSTMENT: { label: "Adjustment", icon: <RotateCcw className="h-4 w-4" />, color: "bg-blue-100 text-blue-600" },
      TRANSFER_IN: { label: "Transfer In", icon: <ArrowRightLeft className="h-4 w-4" />, color: "bg-purple-100 text-purple-600" },
      TRANSFER_OUT: { label: "Transfer Out", icon: <ArrowRightLeft className="h-4 w-4" />, color: "bg-orange-100 text-orange-600" },
      RETURN: { label: "Return", icon: <TrendingUp className="h-4 w-4" />, color: "bg-cyan-100 text-cyan-600" },
      DAMAGE: { label: "Damage", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-red-100 text-red-600" },
      THEFT: { label: "Theft", icon: <XCircleIcon className="h-4 w-4" />, color: "bg-red-100 text-red-700" },
      EXPIRY: { label: "Expiry", icon: <Calendar className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-600" },
      OTHER: { label: "Other", icon: <FileText className="h-4 w-4" />, color: "bg-gray-100 text-gray-600" }
    };
    return types[type] || types.OTHER;
  };

  const getQuantityColor = (quantity: number) => {
    return quantity > 0 ? "text-green-600" : "text-red-600";
  };

  const getQuantityIcon = (quantity: number) => {
    return quantity > 0 ? (
      <ArrowUp className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-red-600" />
    );
  };

  if (isLoading) {
    return (
      <>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 ml-3">Loading warehouse details...</p>
          </div>
        </div>
      </>
    );
  }

  if (!warehouse) {
    return (
      <>
        <div className="p-6">
          <div className="text-center py-8">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Warehouse not found</h3>
            <p className="text-gray-600 mb-4">The warehouse you're looking for doesn't exist or has been deleted.</p>
            <Button onClick={() => router.push('/warehouses')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Warehouses
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button 
                onClick={() => router.push('/warehouses')} 
                variant="outline" 
                size="sm"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="flex items-center space-x-2 sm:space-x-4">
                {warehouse.image ? (
                  <img 
                    src={`/${warehouse.image}`} 
                    alt={warehouse.name}
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                    <Building className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{warehouse.name}</h1>
                  <p className="text-sm sm:text-base text-gray-600">Warehouse Details & Inventory</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:space-x-2 w-full sm:w-auto">
              <CurrencySelector 
                selectedCurrency={selectedCurrency}
                onCurrencyChange={handleCurrencyChange}
              />
              <Button 
                onClick={() => setIsEditModalOpen(true)}
                variant="outline"
                className="text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: getThemeColor() || '#dc2626' }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Warehouse
              </Button>
            </div>
          </div>

          {/* AI Recommendation and Metrics Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* AI Recommendation Card - Left Side */}
            <div className="lg:col-span-2">
              <AIRecommendationCard
                title="Warehouse Operations AI"
                subtitle="Your intelligent assistant for warehouse optimization"
                recommendations={aiRecommendations}
                onRecommendationComplete={handleRecommendationComplete}
              />
            </div>

            {/* Metrics Cards - Right Side */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Warehouse Code</p>
                    <p className="text-xl font-bold text-gray-900">{warehouse.code}</p>
                  </div>
                  <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                    <Building className={`w-5 h-5 text-${theme.primary}`} />
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Products</p>
                    <p className="text-xl font-bold text-green-600">{totalProducts}</p>
                  </div>
                  <div className="p-2 rounded-full bg-green-100">
                    <Package className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                    <p className="text-xl font-bold text-purple-600">{totalQuantity}</p>
                  </div>
                  <div className="p-2 rounded-full bg-purple-100">
                    <Package className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Value</p>
                    <div className="text-xl font-bold text-orange-600">
                      {isConverting ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
                          Converting...
                        </span>
                      ) : (
                        formatCurrencyWithSymbol(convertedTotalValue, selectedCurrency)
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded-full bg-orange-100">
                    <Hash className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Warehouse Details */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">Warehouse Details</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {warehouse.address && (
                <div>
                  <label className="text-xs font-medium text-gray-600">Address</label>
                  <p className="text-xs text-gray-900 mt-0.5">{warehouse.address}</p>
                </div>
              )}
              
              <div>
                <label className="text-xs font-medium text-gray-600">Status</label>
                <div className="flex items-center gap-1 mt-0.5">
                  {warehouse.isActive ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-gray-400" />
                  )}
                  <span className={`text-xs ${
                    warehouse.isActive ? 'text-green-700' : 'text-gray-500'
                  }`}>
                    {warehouse.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-600">Created</label>
                <p className="text-xs text-gray-900 mt-0.5">
                  {new Date(warehouse.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Location</label>
                <p className="text-xs text-gray-900 mt-0.5">
                  {warehouse.city && warehouse.country 
                    ? `${warehouse.city}, ${warehouse.country}`
                    : warehouse.city || warehouse.country || 'Not specified'
                  }
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Last Updated</label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(warehouse.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Card>

          {/* Tabbed Content */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex overflow-x-auto space-x-1 bg-gray-100 p-1 rounded-lg scrollbar-hide">
                  <button
                    onClick={() => setActiveTab('products')}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                      activeTab === 'products'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Package className="h-3 w-3 sm:h-4 sm:w-4 inline sm:mr-2" />
                    <span className="hidden sm:inline">Products in Warehouse</span>
                    <span className="sm:hidden">Products</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('movements')}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                      activeTab === 'movements'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 inline sm:mr-2" />
                    <span className="hidden sm:inline">Stock Movements</span>
                    <span className="sm:hidden">Movements</span>
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-4">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={activeTab === 'products' ? "Search products..." : "Search movements..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsFiltersOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'products' ? (
                // Products Tab
                filteredProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm ? 'No products found' : 'No products in warehouse'}
                    </h3>
                    <p className="text-gray-600">
                      {searchTerm 
                        ? 'Try adjusting your search terms' 
                        : 'This warehouse doesn\'t have any products yet'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6 sm:mx-0 px-6 sm:px-0">
                    <table className="w-full min-w-[800px] sm:min-w-0">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 sm:px-4 font-medium text-gray-900">Product</th>
                          <th className="text-left py-3 px-2 sm:px-4 font-medium text-gray-900 hidden md:table-cell">SKU</th>
                          <th className="text-left py-3 px-2 sm:px-4 font-medium text-gray-900 hidden lg:table-cell">Category</th>
                          <th className="text-left py-3 px-2 sm:px-4 font-medium text-gray-900">Quantity</th>
                          <th className="text-left py-3 px-2 sm:px-4 font-medium text-gray-900 hidden md:table-cell">Cost Price</th>
                          <th className="text-left py-3 px-2 sm:px-4 font-medium text-gray-900">Total Value</th>
                          <th className="text-left py-3 px-2 sm:px-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProducts.map((product) => (
                          <tr key={product.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2 sm:px-4">
                              <div className="flex items-center">
                                <div className="mr-2 sm:mr-3">
                                  <ProductImage product={product} size="sm" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-gray-900 break-words">{product.name}</div>
                                  <div className="md:hidden text-xs text-gray-500 mt-1">SKU: {product.sku}</div>
                                  <div className="lg:hidden text-xs text-gray-500 mt-1">{product.category.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-4 hidden md:table-cell">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {product.sku}
                              </span>
                            </td>
                            <td className="py-3 px-2 sm:px-4 hidden lg:table-cell">
                              <span className="text-sm text-gray-600">{product.category.name}</span>
                            </td>
                            <td className="py-3 px-2 sm:px-4">
                              <span className="text-sm font-medium text-gray-900">
                                {product.stockItems?.[0]?.quantity || 0}
                              </span>
                            </td>
                            <td className="py-3 px-2 sm:px-4 hidden md:table-cell">
                              <div className="text-sm text-gray-900">
                                {isConverting ? (
                                  <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
                                    ...
                                  </div>
                                ) : (
                                  formatCurrencyWithSymbol(
                                    convertedProductValues[product.id]?.averageCost || product.cost || 0,
                                    selectedCurrency
                                  )
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-4">
                              <div className="text-sm font-medium text-gray-900">
                                {isConverting ? (
                                  <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
                                    ...
                                  </div>
                                ) : (
                                  formatCurrencyWithSymbol(
                                    convertedProductValues[product.id]?.totalValue || ((product.stockItems?.[0]?.quantity || 0) * (product.cost || 0)),
                                    selectedCurrency
                                  )
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2 sm:px-4">
                              <DropdownMenu
                                trigger={
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                }
                                items={[
                                  {
                                    label: "View Product",
                                    icon: <Eye className="h-4 w-4" />,
                                    onClick: () => router.push(`/products/${product.id}`)
                                  },
                                  {
                                    label: "Adjust Stock",
                                    icon: <Package className="h-4 w-4" />,
                                    onClick: () => {
                                      // TODO: Implement stock adjustment
                                      console.log('Adjust stock for', product.id);
                                    }
                                  }
                                ]}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {/* Pagination Controls for Products */}
                    {totalProductPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                        <div className="flex items-center text-xs sm:text-sm text-gray-700">
                          Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: totalProductPages }, (_, i) => i + 1).map((page) => (
                              <Button
                                key={page}
                                variant={page === currentPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className={page === currentPage ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                              >
                                {page}
                              </Button>
                            ))}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalProductPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                // Stock Movements Tab
                filteredMovements.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm ? 'No movements found' : 'No stock movements'}
                    </h3>
                    <p className="text-gray-600">
                      {searchTerm 
                        ? 'Try adjusting your search terms' 
                        : 'This warehouse doesn\'t have any stock movements yet'
                      }
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Type</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Origin/Destination</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Reference</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Reason</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900">Stock After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedMovements.map((movement) => {
                            const typeInfo = getMovementTypeInfo(movement.type);
                            return (
                              <tr key={movement.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4">
                                  <div>
                                    <div className="font-medium text-gray-900">{movement.product.name}</div>
                                    <div className="text-sm text-gray-500">{movement.product.sku}</div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center">
                                    <div className={`p-1 rounded ${typeInfo.color}`}>
                                      {typeInfo.icon}
                                    </div>
                                    <span className="ml-2 font-medium">{typeInfo.label}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className={`flex items-center font-medium ${getQuantityColor(movement.quantity)}`}>
                                    {getQuantityIcon(movement.quantity)}
                                    <span className="ml-1">
                                      {movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.product.uomBase}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-sm text-gray-600">
                                    {(() => {
                                      switch (movement.type) {
                                        case 'RECEIPT':
                                          return 'Supplier';
                                        case 'SALE':
                                          return 'Customer';
                                        case 'TRANSFER_IN':
                                          return movement.warehouse?.name || 'Unknown Warehouse';
                                        case 'TRANSFER_OUT':
                                          return movement.warehouse?.name || 'Unknown Warehouse';
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
                                    })()}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-sm text-gray-600">
                                    {movement.reference || '-'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-sm text-gray-600">
                                    {movement.reason || '-'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="text-sm text-gray-600">
                                    {new Date(movement.createdAt).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(movement.createdAt).toLocaleTimeString()}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {(() => {
                                      // Show current stock level
                                      return movement.stockItem.quantity;
                                    })()} {movement.product.uomBase}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Available: {movement.stockItem.available}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    {totalMovementPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <div className="flex items-center text-sm text-gray-700">
                          Showing {startIndex + 1} to {Math.min(endIndex, filteredMovements.length)} of {filteredMovements.length} movements
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: totalMovementPages }, (_, i) => i + 1).map((page) => (
                              <Button
                                key={page}
                                variant={page === currentPage ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className={page === currentPage ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                              >
                                {page}
                              </Button>
                            ))}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalMovementPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters Modal */}
      {isFiltersOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Filter className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                  <p className="text-sm text-gray-600">Filter {activeTab === 'products' ? 'products' : 'movements'}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsFiltersOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              {activeTab === 'products' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      value={filters.category}
                      onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Categories</option>
                      {Array.from(new Set(products.map(p => p.category.name))).map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stockStatus">Stock Status</Label>
                    <select
                      id="stockStatus"
                      value={filters.stockStatus}
                      onChange={(e) => setFilters(prev => ({ ...prev, stockStatus: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Stock Status</option>
                      <option value="in-stock">In Stock</option>
                      <option value="low-stock">Low Stock</option>
                      <option value="out-of-stock">Out of Stock</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Price Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.priceRange.min}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          priceRange: { ...prev.priceRange, min: e.target.value }
                        }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.priceRange.max}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          priceRange: { ...prev.priceRange, max: e.target.value }
                        }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="movementType">Movement Type</Label>
                    <select
                      id="movementType"
                      value={filters.movementType}
                      onChange={(e) => setFilters(prev => ({ ...prev, movementType: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Types</option>
                      <option value="RECEIPT">Receipt</option>
                      <option value="SALE">Sale</option>
                      <option value="TRANSFER_IN">Transfer In</option>
                      <option value="TRANSFER_OUT">Transfer Out</option>
                      <option value="RETURN">Return</option>
                      <option value="ADJUSTMENT">Adjustment</option>
                      <option value="DAMAGE">Damage</option>
                      <option value="THEFT">Theft</option>
                      <option value="EXPIRY">Expiry</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={filters.dateRange.from}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          dateRange: { ...prev.dateRange, from: e.target.value }
                        }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <Input
                        type="date"
                        value={filters.dateRange.to}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          dateRange: { ...prev.dateRange, to: e.target.value }
                        }))}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      category: '',
                      stockStatus: '',
                      priceRange: { min: '', max: '' },
                      movementType: '',
                      dateRange: { from: '', to: '' }
                    });
                    setCurrentPage(1);
                  }}
                >
                  Clear Filters
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setIsFiltersOpen(false);
                    setCurrentPage(1);
                  }}
                  className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Warehouse Modal */}
      <EditWarehouseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        warehouse={warehouse}
      />
    </>
  );
}
