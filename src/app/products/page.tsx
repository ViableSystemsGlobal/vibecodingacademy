"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { CurrencyToggle, useCurrency, formatCurrency as formatCurrencyWithSymbol } from "@/components/ui/currency-toggle";
import { AddProductModal } from "@/components/modals/add-product-modal";
import { useSearchParams } from "next/navigation";
import { BulkImportModal } from "@/components/modals/bulk-import-modal";
import { BulkImageUploadModal } from "@/components/modals/bulk-image-upload-modal";
import { AddCategoryModal } from "@/components/modals/add-category-modal";
import { EditProductModal } from "@/components/modals/edit-product-modal";
import { ConfirmDeleteModal } from "@/components/modals/confirm-delete-modal";
import { StockAdjustmentModal } from "@/components/modals/stock-adjustment-modal";
import { DropdownMenu } from "@/components/ui/dropdown-menu-custom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { useApiLoading } from "@/hooks/use-api-loading";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { DataTable } from "@/components/ui/data-table";
import { GRNGenerationModal } from "@/components/modals/grn-generation-modal";
import { BarcodeDisplay } from "@/components/ui/barcode-display";
import { SkeletonTable, SkeletonCard } from "@/components/ui/skeleton";
import { 
  Plus, 
  Search, 
  Filter, 
  Package, 
  Edit, 
  Trash2, 
  Eye,
  MoreHorizontal,
  Upload,
  Download,
  Copy,
  Archive,
  History,
  FileText,
  BarChart3,
  QrCode,
  Copy as CopyIcon,
  Image
} from "lucide-react";

// TypeScript interfaces for API data
interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

interface StockItem {
  id: string;
  productId: string;
  quantity: number;
  reserved: number;
  available: number;
  warehouseId: string;
  createdAt: string;
  updatedAt: string;
}

interface Product {
  id: string;
  type?: string;
  sku: string;
  serviceCode?: string;
  name: string;
  description?: string;
  images?: string | null; // JSON string in database, will be parsed to string[]
  attributes?: any;
  uomBase: string;
  uomSell: string;
  price?: number;
  cost?: number;
  originalPrice?: number;
  originalCost?: number;
  originalPriceCurrency?: string;
  originalCostCurrency?: string;
  baseCurrency?: string;
  importCurrency: string;
  active: boolean;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  stockItems?: StockItem[];
  barcode?: string;
  barcodeType?: string;
  duration?: string;
  unit?: string;
}

// Mock data for now
const mockProducts = [
  {
    id: 1,
    sku: "PROD-001",
    name: "Premium Wireless Headphones",
    description: "High-quality wireless headphones with noise cancellation",
    category: "Electronics",
    price: 299.99,
    stock: 45,
    status: "active",
    createdAt: "2024-01-15"
  },
  {
    id: 2,
    sku: "PROD-002", 
    name: "Ergonomic Office Chair",
    description: "Comfortable office chair with lumbar support",
    category: "Furniture",
    price: 199.99,
    stock: 12,
    status: "active",
    createdAt: "2024-01-14"
  },
  {
    id: 3,
    sku: "PROD-003",
    name: "Smart Fitness Tracker",
    description: "Advanced fitness tracker with heart rate monitoring",
    category: "Electronics", 
    price: 149.99,
    stock: 0,
    status: "inactive",
    createdAt: "2024-01-13"
  }
];

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, changeCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBulkImageUploadOpen, setIsBulkImageUploadOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Auto-open Add Product modal when navigated with ?new=1
  React.useEffect(() => {
    const isNew = searchParams?.get('new');
    if (isNew === '1') {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  const [isLoading, setIsLoading] = useState(false);
  const { withLoading } = useApiLoading();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStockAdjustmentOpen, setIsStockAdjustmentOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Total counts for metrics (from server)
  const [totalActiveProducts, setTotalActiveProducts] = useState(0);
  const [totalLowStockProducts, setTotalLowStockProducts] = useState(0);
  const [totalOutOfStockProducts, setTotalOutOfStockProducts] = useState(0);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isAdmin, setIsAdmin] = useState(false); // This should come from user context

  // Helper function to copy barcode to clipboard
  const copyBarcodeToClipboard = async (barcode: string) => {
    try {
      await navigator.clipboard.writeText(barcode);
      success('Barcode copied to clipboard');
    } catch (error) {
      showError('Failed to copy barcode');
    }
  };

  const [filters, setFilters] = useState({
    priceRange: { min: '', max: '' },
    stockRange: { min: '', max: '' },
    status: '',
    dateRange: { from: '', to: '' },
    tags: [] as string[]
  });
  const { themeColor, getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  
  // Debug: Log the current theme
  console.log('Current themeColor:', themeColor);
  console.log('Current theme object:', theme);
  const { success, error: showError } = useToast();

  // Helper function to get proper focus ring classes
  const getFocusRingClasses = () => {
    const colorMap: { [key: string]: string } = {
      'purple-600': 'focus:ring-purple-500',
      'blue-600': 'focus:ring-blue-500',
      'green-600': 'focus:ring-green-500',
      'orange-600': 'focus:ring-orange-500',
      'red-600': 'focus:ring-red-500',
      'indigo-600': 'focus:ring-indigo-500',
      'pink-600': 'focus:ring-pink-500',
      'teal-600': 'focus:ring-teal-500',
    };
    return colorMap[theme.primary] || 'focus:ring-blue-500';
  };

  // Helper function to get proper button background classes
  const getButtonBackgroundClasses = () => {
    const colorMap: { [key: string]: string } = {
      'purple-600': 'bg-purple-600 hover:bg-purple-700',
      'blue-600': 'bg-blue-600 hover:bg-blue-700',
      'green-600': 'bg-green-600 hover:bg-green-700',
      'orange-600': 'bg-orange-600 hover:bg-orange-700',
      'red-600': 'bg-red-600 hover:bg-red-700',
      'indigo-600': 'bg-indigo-600 hover:bg-indigo-700',
      'pink-600': 'bg-pink-600 hover:bg-pink-700',
      'teal-600': 'bg-teal-600 hover:bg-teal-700',
    };
    const classes = colorMap[theme.primary] || 'bg-blue-600 hover:bg-blue-700';
    console.log('Theme primary:', theme.primary, 'Button classes:', classes); // Debug log
    return classes;
  };



  // Fetch products and categories on component mount
  React.useEffect(() => {
    fetchProducts(1);
    fetchCategories();
  }, []);

  // Listen for category refresh events
  React.useEffect(() => {
    const handleCategoryRefresh = () => {
      fetchCategories();
    };

    window.addEventListener('categoryAdded', handleCategoryRefresh);
    
    return () => {
      window.removeEventListener('categoryAdded', handleCategoryRefresh);
    };
  }, []);

  // Immediate effect for category filter and sorting
  React.useEffect(() => {
    setCurrentPage(1);
    fetchProducts(1);
  }, [selectedCategory, sortBy, sortOrder]);

  // Debounced search effect (only for search term)
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchProducts(1);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);
  
  // Handle sorting change
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  };
  
  // Handle search change with debounce
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    fetchProducts(page);
  };

  // Listen for the custom event to open Add Category modal
  React.useEffect(() => {
    const handleOpenAddCategoryModal = () => {
      setIsAddCategoryModalOpen(true);
    };

    window.addEventListener('openAddCategoryModal', handleOpenAddCategoryModal);
    
    return () => {
      window.removeEventListener('openAddCategoryModal', handleOpenAddCategoryModal);
    };
  }, []);

  const fetchProducts = async (page: number = currentPage) => {
    await withLoading(async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && selectedCategory !== 'all' && { category: selectedCategory }),
        ...(sortBy && { sortBy }),
        ...(sortOrder && { sortOrder }),
      });
      
      const response = await fetch(`/api/products?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalProducts(data.pagination?.total || 0);
        setCurrentPage(page);
        
        // Update metric totals from server
        if (data.metrics) {
          setTotalActiveProducts(data.metrics.totalActive || 0);
          setTotalLowStockProducts(data.metrics.totalLowStock || 0);
          setTotalOutOfStockProducts(data.metrics.totalOutOfStock || 0);
        }
      } else {
        console.error('Failed to fetch products');
        setProducts([]);
      }
    }, {
      onError: (error) => {
        console.error('Error fetching products:', error);
        setProducts([]);
      }
    });
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data || []);
      } else {
        console.error('Failed to fetch categories');
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  // Client-side filtering removed - now using server-side filtering

  const categoryOptions = ["all", ...Array.from(new Set(products.map(p => p.category?.name).filter(Boolean)))];

  // Action handlers
  const handleViewProduct = (product: Product) => {
    router.push(`/products/${product.id}`);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditModalOpen(true);
  };

  const handleProductEditSuccess = () => {
    fetchProducts(); // Refresh the products list to show updated images
  };

  const handleDuplicateProduct = async (product: Product) => {
    try {
      const response = await fetch('/api/products/duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId: product.id }),
      });

      if (response.ok) {
        const duplicatedProduct = await response.json();
        fetchProducts(); // Refresh the products list
        success(`Product "${product.name}" duplicated successfully as "${duplicatedProduct.name}"`);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to duplicate product');
      }
    } catch (error) {
      console.error('Error duplicating product:', error);
      showError('Failed to duplicate product');
    }
  };

  const handleExportProduct = async (product: Product) => {
    try {
      const response = await fetch('/api/products/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: [product.id] }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `product-${product.sku}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        success(`Product "${product.name}" exported successfully`);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to export product');
      }
    } catch (error) {
      console.error('Error exporting product:', error);
      showError('Failed to export product');
    }
  };

  const handleViewHistory = (product: Product) => {
    // Navigate to product stock movements page
    router.push(`/products/${product.id}/stock-movements`);
  };

  const handleArchiveProduct = async (product: Product) => {
    try {
      const response = await fetch('/api/products/archive', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: product.id }),
      });

      if (response.ok) {
        setProducts(products.map(p => 
          p.id === product.id ? { ...p, active: false } : p
        ));
        success(`Product "${product.name}" archived successfully`);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to archive product');
      }
    } catch (error) {
      console.error('Error archiving product:', error);
      showError('Failed to archive product');
    }
  };

  // Bulk action handlers
  const handleBulkDelete = () => {
    if (selectedProducts.length === 0) return;
    setIsBulkDeleteModalOpen(true);
  };

  const handleBulkActivate = async () => {
    if (selectedProducts.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/products/bulk-activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedProducts }),
      });

      if (!response.ok) {
        throw new Error('Failed to activate products');
      }

      const result = await response.json();
      
      // Update the products in state
      setProducts(products.map(p => 
        selectedProducts.includes(p.id) ? { ...p, active: true } : p
      ));
      setSelectedProducts([]);
      
      success("Products Activated", `Successfully activated ${result.count} product(s)`);
    } catch (error) {
      console.error('Error activating products:', error);
      showError("Activation Failed", 'Failed to activate selected products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedProducts.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/products/bulk-deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedProducts }),
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate products');
      }

      const result = await response.json();
      
      // Update the products in state
      setProducts(products.map(p => 
        selectedProducts.includes(p.id) ? { ...p, active: false } : p
      ));
      setSelectedProducts([]);
      
      success("Products Deactivated", `Successfully deactivated ${result.count} product(s)`);
    } catch (error) {
      console.error('Error deactivating products:', error);
      showError("Deactivation Failed", 'Failed to deactivate selected products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (!isAdmin && deleteConfirmation.toLowerCase() !== 'delete') {
      showError('You must type "delete" to confirm deletion');
      return;
    }
    
    try {
      const response = await fetch('/api/products/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedProducts }),
      });

      if (response.ok) {
        setProducts(products.filter(p => !selectedProducts.includes(p.id)));
        setSelectedProducts([]);
        setIsBulkDeleteModalOpen(false);
        setDeleteConfirmation('');
        success(`Successfully deleted ${selectedProducts.length} product(s)`);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to delete products');
      }
    } catch (error) {
      console.error('Error deleting products:', error);
      showError('Failed to delete products');
    }
  };

  const handleBulkArchive = async () => {
    try {
      // Archive products instead of deleting
      const response = await fetch('/api/products/bulk-archive', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedProducts }),
      });

      if (response.ok) {
        setProducts(products.map(p => 
          selectedProducts.includes(p.id) ? { ...p, status: 'archived' } : p
        ));
        setSelectedProducts([]);
        setIsBulkDeleteModalOpen(false);
        success(`Successfully archived ${selectedProducts.length} product(s)`);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to archive products');
      }
    } catch (error) {
      console.error('Error archiving products:', error);
      showError('Failed to archive products');
    }
  };

  const handleBulkExport = async () => {
    if (selectedProducts.length === 0) return;
    
    try {
      const response = await fetch('/api/products/bulk-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedProducts }),
      });

      if (response.ok) {
        const { data, filename } = await response.json();
        const { downloadCSV } = await import('@/lib/export-utils');
        downloadCSV(data, filename);
        success(`Successfully exported ${selectedProducts.length} product(s)`);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to export products');
      }
    } catch (error) {
      console.error('Error exporting products:', error);
      showError('Failed to export products');
    }
  };

  const handleGenerateGRN = () => {
    if (selectedProducts.length === 0) {
      showError('Please select products to generate GRN');
      return;
    }
    setIsGRNModalOpen(true);
  };

  const handleDeleteProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProduct) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove product from local state
        setProducts(products.filter(p => p.id !== selectedProduct.id));
        setIsDeleteModalOpen(false);
        setSelectedProduct(null);
        success("Product Deleted", `"${selectedProduct.name}" has been successfully deleted.`);
      } else {
        const errorData = await response.json();
        console.error('Failed to delete product:', errorData.error);
        showError("Delete Failed", errorData.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      showError("Network Error", 'Unable to connect to server. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRecommendationComplete = (id: string) => {
    // Handle recommendation completion (AI card will manage its own state)
    console.log('Recommendation completed:', id);
    success("Recommendation completed! Great job!");
  };

  const applyFilters = () => {
    // Filter products based on current filter state
    let filtered = products;
    
    if (filters.priceRange.min) {
      filtered = filtered.filter(p => (p.price || 0) >= parseFloat(filters.priceRange.min));
    }
    if (filters.priceRange.max) {
      filtered = filtered.filter(p => (p.price || 0) <= parseFloat(filters.priceRange.max));
    }
    if (filters.stockRange.min) {
      filtered = filtered.filter(p => {
        const totalStock = p.stockItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        return totalStock >= parseInt(filters.stockRange.min);
      });
    }
    if (filters.stockRange.max) {
      filtered = filtered.filter(p => {
        const totalStock = p.stockItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        return totalStock <= parseInt(filters.stockRange.max);
      });
    }
    if (filters.status) {
      filtered = filtered.filter(p => p.active ? 'active' : 'inactive' === filters.status);
    }
    
    setProducts(filtered);
    setIsFiltersModalOpen(false);
    success('Filters applied successfully');
  };

  const clearFilters = () => {
    setFilters({
      priceRange: { min: '', max: '' },
      stockRange: { min: '', max: '' },
      status: '',
      dateRange: { from: '', to: '' },
      tags: []
    });
    // Reload original products
    fetchProducts();
    success('Filters cleared');
  };


  const handleAddStock = (product: Product) => {
    setSelectedProduct(product);
    setIsStockAdjustmentOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your product catalog and inventory</p>
        </div>
        <div className="flex items-center space-x-3">
          <CurrencyToggle value={currency} onChange={changeCurrency} />
          <Button 
            variant="outline"
            onClick={() => router.push('/inventory/stock-movements')}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Stock Movements
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsBulkImportOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button 
            className="text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: getThemeColor() }}
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* AI Recommendation and Metrics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Recommendation Card - Left Side */}
        <div className="lg:col-span-2">
          <AIRecommendationCard
            title="Product Management AI"
            subtitle="Your intelligent assistant for inventory optimization"
            onRecommendationComplete={handleRecommendationComplete}
            page="products"
            enableAI={true}
          />
        </div>

        {/* Metrics Cards - Right Side */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-xl font-bold text-gray-900">{totalProducts}</p>
              </div>
              <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                <Package className={`w-5 h-5 text-${theme.primary}`} />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Products</p>
                <p className="text-xl font-bold text-green-600">{totalActiveProducts}</p>
              </div>
              <div className="p-2 rounded-full bg-green-100">
                <Package className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-xl font-bold text-orange-600">{totalLowStockProducts}</p>
              </div>
              <div className="p-2 rounded-full bg-orange-100">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                <p className="text-xl font-bold text-red-600">{totalOutOfStockProducts}</p>
              </div>
              <div className="p-2 rounded-full bg-red-100">
                <Package className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Products Table */}
      <Card className="p-6">
        {isLoading ? (
          <SkeletonTable rows={10} columns={6} />
        ) : (
          <DataTable
            data={products}
            enableSelection={true}
            selectedItems={selectedProducts}
            onSelectionChange={setSelectedProducts}
            onRowClick={handleViewProduct}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalProducts}
            onPageChange={handlePageChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            searchValue={searchTerm}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search products by name, SKU, or description..."
            enableExport={true}
            exportFilename="products"
            isLoading={isLoading}
            bulkActions={
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleBulkActivate}
                  disabled={selectedProducts.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Package className="h-4 w-4 mr-1" />
                  Make Active
                </Button>
                <Button
                  size="sm"
                  onClick={handleBulkDeactivate}
                  disabled={selectedProducts.length === 0}
                  className="hover:opacity-90 text-white"
                  style={{ backgroundColor: getThemeColor() }}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Make Inactive
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateGRN}
                  disabled={selectedProducts.length === 0}
                  className="text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: getThemeColor() }}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Generate GRN
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkExport}
                  disabled={selectedProducts.length === 0}
                >
                  Export
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedProducts.length === 0}
                >
                  Delete
                </Button>
              </div>
            }
            columns={[
              {
                key: 'name',
                label: 'Product',
                sortable: true,
                render: (product) => (
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden">
                      {(() => {
                        // Parse images from JSON string or handle null/array
                        let images = [];
                        if (product.images) {
                          if (typeof product.images === 'string') {
                            try {
                              images = JSON.parse(product.images);
                            } catch (e) {
                              images = [];
                            }
                          } else if (Array.isArray(product.images)) {
                            images = product.images;
                          }
                        }
                        
                        if (images.length > 0) {
                          return (
                            <>
                              <img
                                src={images[0]}
                                alt={product.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  // Fallback to icon if image fails to load
                                  e.currentTarget.style.display = 'none';
                                  const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (nextElement) {
                                    nextElement.style.display = 'flex';
                                  }
                                }}
                              />
                              <div className="h-full w-full flex items-center justify-center" style={{display: 'none'}}>
                                <Package className="h-5 w-5 text-gray-500" />
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <div className="h-full w-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-gray-500" />
                            </div>
                          );
                        }
                      })()}
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                        {product.type && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            product.type === 'SERVICE' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {product.type === 'SERVICE' ? 'Service' : 'Product'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {product.sku || product.serviceCode}
                      </div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {product.description}
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: 'category',
                label: 'Category',
                sortable: true,
                render: (product) => (
                  <span className="text-sm text-gray-900">{product.category?.name || 'Uncategorized'}</span>
                )
              },
              {
                key: 'price',
                label: 'Price',
                sortable: true,
                render: (product) => (
                  <span className="text-sm text-gray-900">
                    {formatCurrencyWithSymbol(product.price || 0, currency, product.originalPriceCurrency || product.baseCurrency || 'GHS')}
                  </span>
                )
              },
              {
                key: 'stock',
                label: 'Stock',
                render: (product) => {
                  const totalAvailable = product.stockItems?.reduce((sum, item) => sum + item.available, 0) || 0;
                  return (
                    <span className={`text-sm font-medium ${
                      totalAvailable === 0 
                        ? "text-red-600" 
                        : totalAvailable < 20 
                          ? "text-amber-600" 
                          : `text-${theme.primary}`
                    }`}>
                      {totalAvailable}
                    </span>
                  );
                }
              },
              {
                key: 'sellingUnit',
                label: 'Selling Unit',
                render: (product) => (
                  <span className="text-sm text-gray-900">{product.uomSell || 'pcs'}</span>
                )
              },
              {
                key: 'barcode',
                label: 'Barcode',
                render: (product) => (
                  <div className="flex items-center gap-2">
                    {product.barcode ? (
                      <div className="flex flex-col items-center gap-1">
                        <BarcodeDisplay
                          value={product.barcode}
                          type={product.barcodeType || 'EAN13'}
                          width={120}
                          height={30}
                          className="h-8 w-20"
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => product.barcode && copyBarcodeToClipboard(product.barcode)}
                            title="Copy barcode"
                            className="h-5 w-5 p-0"
                          >
                            <CopyIcon className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
                            {product.barcodeType || 'EAN13'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-8 w-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                          <Image className="h-4 w-4 text-gray-400" />
                        </div>
                        <span className="text-xs text-gray-400 italic">No barcode</span>
                      </div>
                    )}
                  </div>
                )
              },
              {
                key: 'active',
                label: 'Status',
                sortable: true,
                render: (product) => (
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    product.active
                      ? `bg-${theme.primaryBg} text-${theme.primaryText}`
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {product.active ? 'Active' : 'Inactive'}
                  </span>
                )
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (product) => (
                  <DropdownMenu
                    trigger={
                      <Button 
                        variant="ghost" 
                        size="sm"
                        title="Product Actions"
                        className="h-8 w-8 p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    }
                    items={[
                      {
                        label: "View Details",
                        icon: <Eye className="h-4 w-4" />,
                        onClick: () => handleViewProduct(product)
                      },
                      {
                        label: "Edit Product",
                        icon: <Edit className="h-4 w-4" />,
                        onClick: () => handleEditProduct(product)
                      },
                      {
                        label: "Add Stock",
                        icon: <Plus className="h-4 w-4" />,
                        onClick: () => handleAddStock(product)
                      },
                      {
                        label: "Duplicate Product",
                        icon: <Copy className="h-4 w-4" />,
                        onClick: () => handleDuplicateProduct(product)
                      },
                      {
                        label: "Export Product",
                        icon: <Download className="h-4 w-4" />,
                        onClick: () => handleExportProduct(product)
                      },
                      {
                        label: "View History",
                        icon: <History className="h-4 w-4" />,
                        onClick: () => handleViewHistory(product)
                      },
                      {
                        label: "Archive Product",
                        icon: <Archive className="h-4 w-4" />,
                        onClick: () => handleArchiveProduct(product),
                        className: "text-amber-600 hover:text-amber-700"
                      },
                      {
                        label: "Delete Product",
                        icon: <Trash2 className="h-4 w-4" />,
                        onClick: () => handleDeleteProduct(product),
                        className: "text-red-600 hover:text-red-700"
                      }
                    ]}
                  />
                )
              }
            ]}
          />
        )}
      </Card>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          // Refresh the products list
          fetchProducts();
          setIsAddModalOpen(false);
        }}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={() => {
          fetchProducts(); // Refresh the products list
        }}
      />

      {/* Add Category Modal */}
      <AddCategoryModal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        onSuccess={() => {
          // Refresh categories and products to update category filter
          fetchCategories();
          fetchProducts();
          setIsAddCategoryModalOpen(false);
        }}
      />


      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleProductEditSuccess}
        product={selectedProduct}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedProduct(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product?"
        itemName={selectedProduct?.name || ""}
        isLoading={isDeleting}
      />

      {/* Stock Adjustment Modal */}
      {isStockAdjustmentOpen && selectedProduct && (
        <StockAdjustmentModal
          isOpen={isStockAdjustmentOpen}
          onClose={() => setIsStockAdjustmentOpen(false)}
          product={{
            ...selectedProduct,
            images: selectedProduct.images ? (typeof selectedProduct.images === 'string' ? JSON.parse(selectedProduct.images) : selectedProduct.images) : []
          }}
          onSuccess={() => {
            fetchProducts();
            setIsStockAdjustmentOpen(false);
          }}
        />
      )}

      {/* GRN Generation Modal */}
      <GRNGenerationModal
        isOpen={isGRNModalOpen}
        onClose={() => setIsGRNModalOpen(false)}
        products={products.filter(p => selectedProducts.includes(p.id))}
      />

      {/* Filters Modal */}
      <Dialog open={isFiltersModalOpen} onOpenChange={setIsFiltersModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
            <DialogDescription>
              Filter products by price, stock, status, and more
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min Price"
                  value={filters.priceRange.min}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    priceRange: { ...prev.priceRange, min: e.target.value }
                  }))}
                />
                <Input
                  type="number"
                  placeholder="Max Price"
                  value={filters.priceRange.max}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    priceRange: { ...prev.priceRange, max: e.target.value }
                  }))}
                />
              </div>
            </div>

            {/* Stock Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min Stock"
                  value={filters.stockRange.min}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    stockRange: { ...prev.stockRange, min: e.target.value }
                  }))}
                />
                <Input
                  type="number"
                  placeholder="Max Stock"
                  value={filters.stockRange.max}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    stockRange: { ...prev.stockRange, max: e.target.value }
                  }))}
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsFiltersModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={applyFilters}
                className="text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: getThemeColor() }}
              >
                Apply Filters
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={isBulkDeleteModalOpen} onOpenChange={setIsBulkDeleteModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Confirm Bulk Delete</DialogTitle>
            <DialogDescription>
              You are about to permanently delete {selectedProducts.length} product(s). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Archive className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Consider Archiving Instead
                  </h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    If these products have associated inventory movements or are referenced elsewhere, 
                    archiving is safer and preserves data integrity.
                  </p>
                </div>
              </div>
            </div>

            {!isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type "delete" to confirm <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Type 'delete' to confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="border-red-300 focus:border-red-500 focus:ring-red-500"
                />
              </div>
            )}

            {isAdmin && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Admin Override:</strong> You have admin privileges and can delete without typing confirmation.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleBulkArchive}>
              <Archive className="mr-2 h-4 w-4" />
              Archive Instead
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsBulkDeleteModalOpen(false);
                setDeleteConfirmation('');
              }}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmBulkDelete}
                disabled={!isAdmin && deleteConfirmation.toLowerCase() !== 'delete'}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}

