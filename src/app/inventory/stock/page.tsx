"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyToggle, useCurrency, formatCurrency as formatCurrencyWithSymbol } from "@/components/ui/currency-toggle";
import { 
  Search, 
  Filter, 
  Package, 
  TrendingUp, 
  TrendingDown,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  DollarSign,
  MoreHorizontal,
  Edit,
  BarChart3,
  X
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { DropdownMenu } from "@/components/ui/dropdown-menu-custom";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { useAbilities } from "@/hooks/use-abilities-new";
import { useSession } from "next-auth/react";

interface Product {
  id: string;
  name: string;
  sku: string;
  uomBase: string;
  active: boolean;
  price: number;
  cost: number;
  originalPrice?: number;
  originalPriceCurrency?: string;
  originalCostCurrency?: string;
  baseCurrency?: string;
  importCurrency: string;
  stockItems?: Array<{
    id: string;
    productId: string;
    quantity: number;
    reserved: number;
    available: number;
    averageCost: number;
    totalValue: number;
    reorderPoint: number;
    warehouseId?: string;
    createdAt: string;
    updatedAt: string;
    warehouse?: {
      id: string;
      name: string;
      code: string;
    };
  }>;
  category?: {
    id: string;
    name: string;
  };
  // Aggregated stock metrics (from API)
  totalQuantity?: number;
  totalReserved?: number;
  totalAvailable?: number;
  maxReorderPoint?: number;
  totalValue?: number;
  stockStatus?: 'in-stock' | 'low-stock' | 'out-of-stock';
}

interface Category {
  id: string;
  name: string;
}

// Component that uses useSearchParams
function StockPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, changeCurrency } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStockItems, setSelectedStockItems] = useState<string[]>([]);
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const { success } = useToast();
  const { data: session } = useSession();
  const { hasAbility } = useAbilities();
  
  // Check if user can view cost prices
  const canViewCost = session?.user?.role === 'SUPER_ADMIN' || 
                      session?.user?.role === 'ADMIN' || 
                      hasAbility('stock', 'view_cost');

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Metrics state
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    inStockProducts: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    totalInventoryValue: 0,
  });

  // Read URL parameters on mount and set initial state
  useEffect(() => {
    const stockStatusParam = searchParams.get('stockStatus');
    if (stockStatusParam) {
      setStockStatus(stockStatusParam);
    }
  }, [searchParams]);

  const handleViewProduct = (product: Product) => {
    router.push(`/products/${product.id}`);
  };

  // Initial load on mount - wait for URL params to be read
  useEffect(() => {
    fetchCategories();
    // Read stockStatus from URL for initial fetch
    const stockStatusParam = searchParams.get('stockStatus') || '';
    fetchStock(1, stockStatusParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect for filters and sorting (skip initial mount)
  useEffect(() => {
    const isInitialMount = currentPage === 1 && !searchTerm && !selectedCategory && !stockStatus && !sortBy;
    if (isInitialMount) {
      return;
    }
    fetchStock(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, stockStatus, priceRange.min, priceRange.max, sortBy, sortOrder]);

  // Debounced search effect (including when cleared)
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchStock(1);
    }, searchTerm ? 500 : 0);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchStock = async (page: number = currentPage, overrideStockStatus?: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', itemsPerPage.toString());
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (selectedCategory && selectedCategory !== '' && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      const statusToUse = overrideStockStatus !== undefined ? overrideStockStatus : stockStatus;
      if (statusToUse && statusToUse !== '' && statusToUse !== 'all') {
        params.append('stockStatus', statusToUse);
      }
      if (priceRange.min) {
        params.append('priceMin', priceRange.min);
      }
      if (priceRange.max) {
        params.append('priceMax', priceRange.max);
      }
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      if (sortOrder) {
        params.append('sortOrder', sortOrder);
      }
      
      const response = await fetch(`/api/inventory/stock?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📦 Stock API Response:', {
          productsCount: data.products?.length || 0,
          total: data.pagination?.total || 0,
          pages: data.pagination?.pages || 0,
          metrics: data.metrics,
        });
        setProducts(Array.isArray(data.products) ? data.products : []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalItems(data.pagination?.total || 0);
        setCurrentPage(page);
        
        // Update metrics from API
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      } else {
        let errorData: any = {};
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', parseError);
          errorData = { rawResponse: await response.text().catch(() => 'Unable to read response') };
        }
        console.error('❌ Failed to fetch stock:', response.status, errorData);
        setProducts([]);
        setTotalPages(1);
        setTotalItems(0);
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
      setProducts([]);
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

  // Use metrics from API instead of calculating client-side
  const { totalProducts, inStockProducts, lowStockProducts, outOfStockProducts } = metrics;
  // Fetch exchange rate for conversion
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('/api/currency/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromCurrency: 'USD',
            toCurrency: 'GHS',
            amount: 1
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setExchangeRate(data.exchangeRate || 11.0); // Fallback to 11.0 if not found
        } else {
          setExchangeRate(11.0); // Fallback if API fails
        }
      } catch (error) {
        console.error('Error fetching exchange rate:', error);
        setExchangeRate(11.0); // Fallback on error
      }
    };
    fetchExchangeRate();
  }, []);

  // Server-side filtering is handled by the API, so we just use products directly
  // Total Inventory Value is calculated by the API and stored in metrics.totalInventoryValue
  // No client-side filtering needed
  const filteredProducts = products;

  const handleRecommendationComplete = (id: string) => {
    // AIRecommendationCard manages its own state internally
    success("Recommendation completed! Great job!");
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setStockStatus("");
    setPriceRange({ min: "", max: "" });
    setCurrentPage(1);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedCategory) count++;
    if (stockStatus) count++;
    if (priceRange.min || priceRange.max) count++;
    return count;
  };

  const getStockStatus = (product: Product) => {
    const totalAvailable = product.stockItems?.reduce((sum, item) => sum + item.available, 0) || 0;
    const maxReorderPoint = product.stockItems?.reduce((max, item) => Math.max(max, item.reorderPoint), 0) || 0;
    
    if (totalAvailable === 0) return { status: "Out of Stock", color: "bg-red-100 text-red-800" };
    if (totalAvailable <= maxReorderPoint) return { status: "Low Stock", color: "bg-yellow-100 text-yellow-800" };
    return { status: "In Stock", color: "bg-green-100 text-green-800" };
  };

  const getRowClassName = (product: Product) => {
    const totalAvailable = product.stockItems?.reduce((sum, item) => sum + item.available, 0) || 0;
    const maxReorderPoint = product.stockItems?.reduce((max, item) => Math.max(max, item.reorderPoint), 0) || 0;
    
    // Highlight out of stock items in red
    if (totalAvailable === 0) {
      return "bg-red-50 hover:bg-red-100";
    }
    
    // Highlight low stock items in yellow
    if (totalAvailable > 0 && totalAvailable <= maxReorderPoint) {
      return "bg-yellow-50 hover:bg-yellow-100";
    }
    
    return "";
  };

  if (isLoading) {
    return (
      <>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 ml-3">Loading stock data...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Overview</h1>
            <p className="text-gray-600">View stock levels for all products</p>
          </div>
          <CurrencyToggle value={currency} onChange={changeCurrency} />
        </div>

        {/* AI Recommendation and Metrics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Recommendation Card - Left Side */}
          <div className="lg:col-span-2">
            <AIRecommendationCard
              title="Inventory Management AI"
              subtitle="Your intelligent assistant for stock optimization"
              onRecommendationComplete={handleRecommendationComplete}
              page="stock"
              enableAI={true}
            />
          </div>

          {/* Metrics Cards - Right Side */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency((metrics.totalInventoryValue || 0) * (exchangeRate || 11.0), 'GHS')}</p>
                </div>
                <div className="p-2 rounded-full bg-blue-100">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Stock</p>
                  <p className="text-xl font-bold text-green-600">{inStockProducts}</p>
                  <p className="text-xs text-gray-500">out of {totalProducts} products</p>
                </div>
                <div className="p-2 rounded-full bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-xl font-bold text-orange-600">{lowStockProducts}</p>
                </div>
                <div className="p-2 rounded-full bg-orange-100">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-xl font-bold text-red-600">{outOfStockProducts}</p>
                </div>
                <div className="p-2 rounded-full bg-red-100">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </Card>
          </div>
        </div>


        {/* Products Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Products Stock ({totalItems})</CardTitle>
                <CardDescription>
                  Click on any product to view detailed stock movements
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data={filteredProducts}
              enableSelection={true}
              selectedItems={selectedStockItems}
              onSelectionChange={setSelectedStockItems}
              onRowClick={handleViewProduct}
              getRowClassName={getRowClassName}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={(page) => {
                setCurrentPage(page);
                fetchStock(page);
              }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search products by name or SKU..."
              enableExport={true}
              exportFilename="stock"
              isLoading={isLoading}
              customFilters={
                <div className="flex items-center gap-2">
                  <select 
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select 
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={stockStatus}
                    onChange={(e) => {
                      setStockStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">All Stock Status</option>
                    <option value="in-stock">In Stock</option>
                    <option value="low-stock">Low Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsMoreFiltersOpen(true)}
                  >
                    More Filters
                    {getActiveFiltersCount() > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                        {getActiveFiltersCount()}
                      </span>
                    )}
                  </Button>
                  <Dialog open={isMoreFiltersOpen} onOpenChange={setIsMoreFiltersOpen}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>More Filters</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price Range
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="number"
                              placeholder="Min Price"
                              value={priceRange.min}
                              onChange={(e) => {
                                setPriceRange(prev => ({ ...prev, min: e.target.value }));
                                setCurrentPage(1);
                              }}
                            />
                            <Input
                              type="number"
                              placeholder="Max Price"
                              value={priceRange.max}
                              onChange={(e) => {
                                setPriceRange(prev => ({ ...prev, max: e.target.value }));
                                setCurrentPage(1);
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between pt-4">
                          <Button 
                            variant="outline" 
                            onClick={handleClearFilters}
                            className="text-gray-600"
                          >
                            Clear All
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
              }
              bulkActions={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const { downloadCSV } = await import('@/lib/export-utils');
                        const exportData = filteredProducts
                          .filter(p => selectedStockItems.includes(p.id))
                          .map(product => {
                            const totalAvailable = product.stockItems?.reduce((sum, item) => sum + item.available, 0) || 0;
                            const totalReserved = product.stockItems?.reduce((sum, item) => sum + item.reserved, 0) || 0;
                            const totalQuantity = product.stockItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                            const totalValue = totalQuantity * (product.cost || 0);
                            const maxReorderPoint = product.stockItems?.reduce((max, item) => Math.max(max, item.reorderPoint), 0) || 0;
                            const warehouseNames = product.stockItems?.map(item => item.warehouse?.name).filter(Boolean) || [];
                            
                            return {
                              'Product Name': product.name,
                              'SKU': product.sku,
                              'Category': product.category?.name || 'Uncategorized',
                              'Available Stock': totalAvailable,
                              'Reserved': totalReserved,
                              'Unit Price': product.price || 0,
                              'Cost Price': product.cost || 0,
                              'Total Value': totalValue,
                              'Warehouse': warehouseNames.join(', ') || 'N/A',
                              'Status': totalAvailable > 0 ? 'In Stock' : 'Out of Stock'
                            };
                          });
                        downloadCSV(exportData, `stock_export_${new Date().toISOString().split('T')[0]}.csv`);
                        success(`Successfully exported ${selectedStockItems.length} stock item(s)`);
                      } catch (error) {
                        success('Export functionality coming soon!');
                      }
                    }}
                    disabled={selectedStockItems.length === 0}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Export
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => success('Adjust stock functionality coming soon!')}
                    disabled={selectedStockItems.length === 0}
                    className="text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: getThemeColor() }}
                  >
                    Adjust Stock
                  </Button>
                </div>
              }
              columns={[
                {
                  key: 'product',
                  label: 'Product',
                  sortable: true,
                  exportable: true,
                  render: (product) => (
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.sku}</div>
                    </div>
                  ),
                  exportFormat: (product) => `${product.name} (${product.sku})`
                },
                {
                  key: 'category',
                  label: 'Category',
                  sortable: true,
                  exportable: true,
                  render: (product) => (
                    <span className="text-sm text-gray-600">
                      {product.category?.name || 'No Category'}
                    </span>
                  ),
                  exportFormat: (product) => product.category?.name || 'No Category'
                },
                {
                  key: 'stockLevel',
                  label: 'Stock Level',
                  sortable: true,
                  exportable: true,
                  render: (product) => {
                    const totalQuantity = product.totalQuantity ?? product.stockItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                    return (
                      <div className="text-sm text-gray-600">
                        {totalQuantity} {product.uomBase}
                      </div>
                    );
                  },
                  exportFormat: (product) => {
                    const totalQuantity = product.totalQuantity ?? product.stockItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                    return `${totalQuantity} ${product.uomBase}`;
                  }
                },
                {
                  key: 'available',
                  label: 'Available',
                  sortable: true,
                  exportable: true,
                  render: (product) => {
                    const totalAvailable = product.totalAvailable ?? product.stockItems?.reduce((sum, item) => sum + item.available, 0) || 0;
                    return (
                      <div className="text-sm text-gray-600">
                        {totalAvailable}
                      </div>
                    );
                  },
                  exportFormat: (product) => {
                    return (product.totalAvailable ?? product.stockItems?.reduce((sum, item) => sum + item.available, 0) || 0).toString();
                  }
                },
                {
                  key: 'reserved',
                  label: 'Reserved',
                  sortable: true,
                  exportable: true,
                  render: (product) => {
                    const totalReserved = product.totalReserved ?? product.stockItems?.reduce((sum, item) => sum + item.reserved, 0) || 0;
                    return (
                      <div className="text-sm text-gray-600">
                        {totalReserved}
                      </div>
                    );
                  },
                  exportFormat: (product) => {
                    return (product.totalReserved ?? product.stockItems?.reduce((sum, item) => sum + item.reserved, 0) || 0).toString();
                  }
                },
                {
                  key: 'unitPrice',
                  label: 'Unit Price',
                  sortable: true,
                  exportable: true,
                  render: (product) => (
                    <div className="text-sm text-gray-600">
                      {formatCurrencyWithSymbol(product.price || 0, currency, product.originalPriceCurrency || product.baseCurrency || 'GHS')}
                    </div>
                  ),
                  exportFormat: (product) => (product.price || 0).toString()
                },
                ...(canViewCost ? [
                  {
                    key: 'costPrice',
                    label: 'Cost Price',
                    sortable: true,
                    exportable: true,
                    render: (product) => (
                      <div className="text-sm text-gray-600">
                        {formatCurrencyWithSymbol(product.cost || 0, currency, product.originalCostCurrency || product.importCurrency || 'USD')}
                      </div>
                    ),
                    exportFormat: (product) => (product.cost || 0).toString()
                  },
                  {
                    key: 'costValue',
                    label: 'Cost Value',
                    sortable: true,
                    exportable: true,
                    render: (product) => {
                      // Use totalValue from API if available, otherwise calculate
                      const stockValue = product.totalValue ?? product.stockItems?.filter((item: any) => item.warehouseId !== null).reduce((sum: number, item: any) => {
                        const costInUSD = item.averageCost || 0;
                        const quantity = item.quantity || 0;
                        const usdToGhsRate = exchangeRate || 11.0;
                        const valueInGHS = (costInUSD * quantity) * usdToGhsRate;
                        return sum + valueInGHS;
                      }, 0) || 0;
                      return (
                        <div className="text-sm text-gray-600">
                          {formatCurrency(stockValue, 'GHS')}
                        </div>
                      );
                    },
                    exportFormat: (product) => {
                      const stockValue = product.totalValue ?? product.stockItems?.filter((item: any) => item.warehouseId !== null).reduce((sum: number, item: any) => {
                        const costInUSD = item.averageCost || 0;
                        const quantity = item.quantity || 0;
                        return sum + (costInUSD * quantity);
                      }, 0) || 0;
                      return stockValue.toString();
                    }
                  }
                ] : []),
                {
                  key: 'warehouse',
                  label: 'Warehouse',
                  exportable: true,
                  render: (product) => {
                    const warehouseNames = product.stockItems?.map(item => item.warehouse?.name).filter(Boolean) || [];
                    return (
                      <div className="text-sm text-gray-600">
                        {warehouseNames.length > 0 ? (
                          <div className="space-y-1">
                            {warehouseNames.map((name, index) => (
                              <div key={index}>{name}</div>
                            ))}
                          </div>
                        ) : (
                          'No Warehouse'
                        )}
                      </div>
                    );
                  },
                  exportFormat: (product) => {
                    const warehouseNames = product.stockItems?.map(item => item.warehouse?.name).filter(Boolean) || [];
                    return warehouseNames.join(', ') || 'No Warehouse';
                  }
                },
                {
                  key: 'status',
                  label: 'Status',
                  sortable: true,
                  exportable: true,
                  render: (product) => {
                    const stockStatus = getStockStatus(product);
                    return (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium whitespace-nowrap ${stockStatus.color}`}>
                        {stockStatus.status}
                      </span>
                    );
                  },
                  exportFormat: (product) => {
                    const status = getStockStatus(product);
                    return status.status;
                  }
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  sortable: false,
                  exportable: false,
                  render: (product) => (
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
                          onClick: () => window.open(`/products/${product.id}`, '_blank')
                        },
                        {
                          label: "Edit Product",
                          icon: <Edit className="h-4 w-4" />,
                          onClick: () => window.open(`/products/${product.id}`, '_blank')
                        },
                        {
                          label: "Stock Movements",
                          icon: <BarChart3 className="h-4 w-4" />,
                          onClick: () => window.open(`/products/${product.id}/stock-movements`, '_blank')
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
    </>
  );
}

// Main export with Suspense boundary
export default function StockPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 ml-3">Loading stock data...</p>
        </div>
      </div>
    }>
      <StockPageContent />
    </Suspense>
  );
}