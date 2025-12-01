"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { CurrencyToggle, useCurrency, formatCurrency as formatCurrencyWithSymbol, useExchangeRates } from "@/components/ui/currency-toggle";
import { EditProductModal } from "@/components/modals/edit-product-modal";
import { AddProductToPriceListFromProductModal } from "@/components/modals/add-product-to-price-list-from-product-modal";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { BarcodeDisplay } from "@/components/barcode-display";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { useAbilities } from "@/hooks/use-abilities-new";
import { useSession } from "next-auth/react";
import { 
  ArrowLeft, 
  ArrowRight,
  Package, 
  DollarSign, 
  Tag, 
  Hash, 
  FileText, 
  Calendar, 
  Edit,
  Trash2,
  MoreHorizontal,
  Eye,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
  History,
  Archive,
  Upload,
  X,
  Mail,
  CheckSquare,
  Square,
  FolderOpen,
  Plus,
  Building,
  HelpCircle
} from "lucide-react";

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
  averageCost: number;
  totalValue: number;
  reorderPoint: number;
  warehouseId: string;
  createdAt: string;
  updatedAt: string;
  warehouse?: {
    id: string;
    name: string;
    code: string;
    address?: string;
    city?: string;
    country?: string;
  };
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  images?: string | null;
  attributes?: any;
  uomBase: string;
  uomSell: string;
  price?: number;
  cost?: number;
  costPrice: number;
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
  barcode?: string | null;
  barcodeType?: string | null;
  category?: Category;
  stockItems?: StockItem[];
  additionalBarcodes?: any[];
}

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { getThemeClasses } = useTheme();
  const { success, error: showError } = useToast();
  const theme = getThemeClasses();
  const { currency, changeCurrency } = useCurrency();
  const { rates: exchangeRates } = useExchangeRates();
  const { data: session } = useSession();
  const { hasAbility } = useAbilities();
  
  // Check if user can view cost prices
  const canViewCost = session?.user?.role === 'SUPER_ADMIN' || 
                      session?.user?.role === 'ADMIN' || 
                      hasAbility('products', 'view_cost');
  
  // Helper function to format currency using exchange rates from API
  const formatCurrencyWithRate = (amount: number, toCurrency: string, fromCurrency: string): string => {
    const selectedCurrency = { code: 'GHS', symbol: 'GH₵', name: 'Ghana Cedi' };
    const currencyMap: { [key: string]: { code: string; symbol: string } } = {
      'GHS': { code: 'GHS', symbol: 'GH₵' },
      'USD': { code: 'USD', symbol: '$' },
      'EUR': { code: 'EUR', symbol: '€' }
    };
    const curr = currencyMap[toCurrency] || selectedCurrency;
    
    let convertedAmount = amount;
    if (fromCurrency !== toCurrency) {
      const rateKey = `${fromCurrency}_${toCurrency}`;
      const rate = exchangeRates[rateKey];
      
      if (rate) {
        convertedAmount = amount * rate;
      } else {
        // Try reverse rate
        const reverseKey = `${toCurrency}_${fromCurrency}`;
        const reverseRate = exchangeRates[reverseKey];
        if (reverseRate) {
          convertedAmount = amount / reverseRate;
        } else {
          // Fallback to default rates if API rates not available
          const defaultRates: { [key: string]: { [key: string]: number } } = {
            'USD': { 'GHS': 15, 'EUR': 0.85 },
            'GHS': { 'USD': 1/15, 'EUR': 1/17.65 },
            'EUR': { 'USD': 1.18, 'GHS': 17.65 }
          };
          const defaultRate = defaultRates[fromCurrency]?.[toCurrency];
          if (defaultRate) {
            convertedAmount = amount * defaultRate;
          } else {
            // Last resort: show original amount with warning
            console.warn(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
            convertedAmount = amount;
          }
        }
      }
    }
    
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);
    
    return `${curr.symbol}${formatted}`;
  };
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'pricing' | 'warehouses' | 'barcodes'>('overview');
  const [documents, setDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isBulkActionModalOpen, setIsBulkActionModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'email' | 'download'>('delete');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [isAddToPriceListModalOpen, setIsAddToPriceListModalOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to: '',
    cc: '',
    message: ''
  });

  // Helper function to get total stock across all warehouses
  const getTotalStock = () => {
    if (!product?.stockItems) return { quantity: 0, reserved: 0, available: 0 };
    return product.stockItems.reduce((total, item) => ({
      quantity: total.quantity + item.quantity,
      reserved: total.reserved + item.reserved,
      available: total.available + item.available
    }), { quantity: 0, reserved: 0, available: 0 });
  };

  // Reset image index when product changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [product]);

  const nextImage = () => {
    if (product && product.images) {
      let images: string[] = [];
      if (typeof product.images === 'string') {
        try {
          images = JSON.parse(product.images);
        } catch (e) {
          images = [];
        }
      } else if (Array.isArray(product.images)) {
        images = product.images;
      }
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (product && product.images) {
      let images: string[] = [];
      if (typeof product.images === 'string') {
        try {
          images = JSON.parse(product.images);
        } catch (e) {
          images = [];
        }
      } else if (Array.isArray(product.images)) {
        images = product.images;
      }
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const fetchDocuments = async () => {
    if (!product) return;
    try {
      const response = await fetch(`/api/products/${product.id}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleLinkSupplierBarcode = async (barcode: string, source: string) => {
    try {
      const response = await fetch('/api/products/barcode/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product?.id,
          barcode: barcode.trim(),
          source,
          description: `${source} variant`,
          isPrimary: false
        })
      });

      if (response.ok) {
        success('Supplier barcode linked successfully');
        window.location.reload();
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to link barcode');
      }
    } catch (error) {
      console.error('Error linking barcode:', error);
      showError('Failed to link supplier barcode');
    }
  };

  const handleRemoveSupplierBarcode = async (barcodeId: string) => {
    try {
      const response = await fetch(`/api/products/barcode/${barcodeId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        success('Supplier barcode removed');
        window.location.reload();
      } else {
        showError('Failed to remove barcode');
      }
    } catch (error) {
      console.error('Error removing barcode:', error);
      showError('Failed to remove supplier barcode');
    }
  };

  const fetchPriceLists = async () => {
    if (!product) return;
    try {
      const response = await fetch(`/api/products/${product.id}/price-lists`);
      if (response.ok) {
        const data = await response.json();
        setPriceLists(data || []);
      }
    } catch (error) {
      console.error('Error fetching price lists:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !product) {
      console.log('No file selected or product not loaded');
      return;
    }

    console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('productId', product.id);

    try {
      const response = await fetch('/api/products/documents', {
        method: 'POST',
        body: formData,
      });

      console.log('Upload response status:', response.status);
      console.log('Upload response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        success('Document uploaded successfully');
        fetchDocuments(); // Refresh documents list
      } else {
        let errorMessage = 'Failed to upload document';
        try {
          const responseText = await response.text();
          console.error('Upload error response text:', responseText);
          
          if (responseText) {
            const errorData = JSON.parse(responseText);
            console.error('Upload error parsed:', errorData);
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage = `Upload failed with status ${response.status} - No response body`;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `Upload failed with status ${response.status}`;
        }
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      showError('Error uploading document');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDownloadDocument = async (documentId: string, filename: string) => {
    try {
      const response = await fetch(`/api/products/documents/${documentId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        showError('Failed to download document');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      showError('Error downloading document');
    }
  };

  const handleDeleteDocument = (documentId: string) => {
    setDocumentToDelete(documentId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;

    try {
      const response = await fetch(`/api/products/documents/${documentToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        success('Document deleted successfully');
        fetchDocuments(); // Refresh documents list
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      showError('Error deleting document');
    } finally {
      setIsDeleteModalOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleEmailFormChange = (field: string, value: string) => {
    setEmailForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSendSingleDocumentEmail = (documentId: string, filename: string) => {
    // Set the document to be emailed and open the email modal
    setSelectedDocuments([documentId]);
    setBulkAction('email');
    setIsBulkActionModalOpen(true);
  };

  const handleSelectDocument = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleSelectAllDocuments = () => {
    if (selectedDocuments.length === documents.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(documents.map(doc => doc.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedDocuments.length} document(s)?`)) return;

    try {
      const deletePromises = selectedDocuments.map(id => 
        fetch(`/api/products/documents/${id}`, { method: 'DELETE' })
      );
      
      await Promise.all(deletePromises);
      success(`${selectedDocuments.length} document(s) deleted successfully`);
      setSelectedDocuments([]);
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting documents:', error);
      showError('Failed to delete documents');
    }
  };

  const handleBulkDownload = async () => {
    if (selectedDocuments.length === 0) return;

    try {
      // Download each document individually
      for (const docId of selectedDocuments) {
        const doc = documents.find(d => d.id === docId);
        if (doc) {
          const response = await fetch(`/api/products/documents/${docId}/download`);
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.originalName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }
        }
      }
      success(`${selectedDocuments.length} document(s) downloaded successfully`);
    } catch (error) {
      console.error('Error downloading documents:', error);
      showError('Failed to download documents');
    }
  };

  const handleBulkEmail = async () => {
    if (selectedDocuments.length === 0 || !emailForm.to.trim()) return;

    try {
      // Parse email addresses (comma-separated)
      const toEmails = emailForm.to.split(',').map(email => email.trim()).filter(email => email);
      const ccEmails = emailForm.cc ? emailForm.cc.split(',').map(email => email.trim()).filter(email => email) : [];

      // In a real application, you would send an API request to email the documents
      // This would include the email form data and selected documents
      const emailData = {
        to: toEmails,
        cc: ccEmails,
        message: emailForm.message,
        documentIds: selectedDocuments,
        productId: product?.id
      };

      console.log('Email data:', emailData);
      
      success(`Documents sent to ${toEmails.join(', ')} successfully`);
      setSelectedDocuments([]);
      setEmailForm({ to: '', cc: '', message: '' });
    } catch (error) {
      console.error('Error emailing documents:', error);
      showError('Failed to email documents');
    }
  };

  const handleBulkAction = () => {
    switch (bulkAction) {
      case 'delete':
        handleBulkDelete();
        break;
      case 'download':
        handleBulkDownload();
        break;
      case 'email':
        handleBulkEmail();
        break;
    }
    setIsBulkActionModalOpen(false);
  };

  const handleDownloadImages = async () => {
    if (!product || !images.length) return;

    try {
      // Create a zip file with all product images
      // For now, we'll download each image individually
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_image_${i + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Add a small delay between downloads
        if (i < images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      success(`${images.length} image(s) downloaded successfully`);
    } catch (error) {
      console.error('Error downloading images:', error);
      showError('Failed to download images');
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/products/${params.id}`);
        
        if (response.ok) {
          const data = await response.json();
          setProduct(data);
        } else if (response.status === 404) {
          setError("Product not found");
        } else {
          setError("Failed to load product details");
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        setError("Network error. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  // Fetch documents when documents tab is active
  useEffect(() => {
    if (activeTab === 'documents' && product) {
      fetchDocuments();
    }
  }, [activeTab, product]);

  // Fetch price lists when pricing tab is active
  useEffect(() => {
    if (activeTab === 'pricing' && product) {
      fetchPriceLists();
    }
  }, [activeTab, product]);

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    // Refresh product data
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        console.log('Refreshing product with ID:', params.id); // Debug log
        const response = await fetch(`/api/products/${params.id}`);
        console.log('Response status:', response.status); // Debug log
        
        if (response.ok) {
          const data = await response.json();
          console.log('Updated product data:', data); // Debug log
          setProduct(data); // API returns product directly, not wrapped in data.product
          setError(null); // Clear any previous errors
        } else if (response.status === 404) {
          console.error('Product not found after edit, ID:', params.id);
          setError("Product not found");
        } else {
          console.error('Failed to load product, status:', response.status);
          setError("Failed to load product");
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        setError("Failed to load product");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProduct();
    setIsEditModalOpen(false);
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${product?.name}"? This action cannot be undone.`)) {
      try {
        const response = await fetch(`/api/products/${params.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          success('Product deleted successfully');
          router.push('/products');
        } else {
          const errorData = await response.json();
          showError(errorData.error || 'Failed to delete product');
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        showError('Network error. Please try again.');
      }
    }
  };

  const handleDuplicateProduct = () => {
    success('Duplicate product functionality coming soon!');
  };

  const handleExportProduct = () => {
    success('Export product functionality coming soon!');
  };

  const handleViewHistory = () => {
    // Navigate to product-specific stock movements page
    router.push(`/products/${product?.id}/stock-movements`);
  };

  const handleArchiveProduct = () => {
    success('Archive product functionality coming soon!');
  };

  const handleAddToPriceList = () => {
    setIsAddToPriceListModalOpen(true);
  };

  const handleRemoveFromPriceList = async (priceListId: string) => {
    if (window.confirm('Are you sure you want to remove this product from the price list?')) {
      try {
        const response = await fetch(`/api/products/${product?.id}/price-lists/remove?priceListId=${priceListId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          success('Product removed from price list successfully');
          fetchPriceLists(); // Refresh price lists
        } else {
          const errorData = await response.json();
          showError(errorData.error || 'Failed to remove product from price list');
        }
      } catch (error) {
        console.error('Error removing product from price list:', error);
        showError('Network error. Please try again.');
      }
    }
  };

  const handleRefreshPriceLists = () => {
    fetchPriceLists();
  };

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading product details...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Product Not Found</h2>
            <p className="text-gray-600 mb-4">{error || "The product you're looking for doesn't exist."}</p>
            <Button onClick={() => router.push('/products')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Parse images from JSON string
  let images: string[] = [];
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

  // Calculate profit margin using converted prices in the same currency
  // Uses the same exchange rates as formatCurrencyWithRate for consistency
  const calculateProfitMargin = () => {
    if (!product.price || !product.cost) return 0;
    
    // Convert selling price to selected currency
    const sellingCurrency = product.originalPriceCurrency || product.baseCurrency || 'GHS';
    let sellingPriceInSelectedCurrency = product.price;
    if (sellingCurrency !== currency) {
      const rateKey = `${sellingCurrency}_${currency}`;
      const rate = exchangeRates[rateKey];
      if (rate) {
        sellingPriceInSelectedCurrency = product.price * rate;
      }
    }
    
    // Convert cost price to selected currency
    const costCurrency = product.originalCostCurrency || product.importCurrency || 'USD';
    let costPriceInSelectedCurrency = product.cost;
    if (costCurrency !== currency) {
      const rateKey = `${costCurrency}_${currency}`;
      const rate = exchangeRates[rateKey];
      if (rate) {
        costPriceInSelectedCurrency = product.cost * rate;
      }
    }
    
    if (sellingPriceInSelectedCurrency <= 0) return 0;
    
    return ((sellingPriceInSelectedCurrency - costPriceInSelectedCurrency) / sellingPriceInSelectedCurrency) * 100;
  };
  
  const profitMargin = calculateProfitMargin();

  // Stock status
  const totalStock = getTotalStock();
  const stockStatus = totalStock.available === 0 
    ? 'out-of-stock' 
    : totalStock.available < 20 
      ? 'low-stock' 
      : 'in-stock';

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/products')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back to Products</span>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{product.name}</h1>
              <p className="text-sm sm:text-base text-gray-600">SKU: {product.sku}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:space-x-3 w-full sm:w-auto">
            <CurrencyToggle value={currency} onChange={changeCurrency} />
            <Button 
              variant="outline" 
              onClick={handleEdit}
              className="flex items-center"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Product
            </Button>
            <div className="relative">
              <DropdownMenu
                trigger={
                  <Button 
                    variant="outline" 
                    className="flex items-center"
                  >
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    More Actions
                  </Button>
                }
                items={[
                  {
                    label: "Duplicate Product",
                    icon: <Copy className="h-4 w-4" />,
                    onClick: handleDuplicateProduct
                  },
                  {
                    label: "Export Product",
                    icon: <Download className="h-4 w-4" />,
                    onClick: handleExportProduct
                  },
                  {
                    label: "View Stock History",
                    icon: <History className="h-4 w-4" />,
                    onClick: handleViewHistory
                  },
                  {
                    label: "Archive Product",
                    icon: <Archive className="h-4 w-4" />,
                    onClick: handleArchiveProduct,
                    className: "text-amber-600 hover:text-amber-700"
                  },
                  {
                    label: "Delete Product",
                    icon: <Trash2 className="h-4 w-4" />,
                    onClick: handleDelete,
                    className: "text-red-600 hover:text-red-700"
                  }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Tabbed Interface */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex overflow-x-auto space-x-4 sm:space-x-8 scrollbar-hide">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'overview'
                  ? `border-${theme.primary} text-${theme.primaryText}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="h-3 w-3 sm:h-4 sm:w-4 inline sm:mr-2" />
              <span className="hidden sm:inline">Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-2 px-1 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'documents'
                  ? `border-${theme.primary} text-${theme.primaryText}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 inline sm:mr-2" />
              <span className="hidden sm:inline">Documents</span>
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              className={`py-2 px-1 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'pricing'
                  ? `border-${theme.primary} text-${theme.primaryText}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 inline sm:mr-2" />
              <span className="hidden sm:inline">Pricing</span>
            </button>
            <button
              onClick={() => setActiveTab('warehouses')}
              className={`py-2 px-1 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'warehouses'
                  ? `border-${theme.primary} text-${theme.primaryText}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="h-3 w-3 sm:h-4 sm:w-4 inline sm:mr-2" />
              <span className="hidden sm:inline">Warehouses</span>
            </button>
            <button
              onClick={() => setActiveTab('barcodes')}
              className={`py-2 px-1 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                activeTab === 'barcodes'
                  ? `border-${theme.primary} text-${theme.primaryText}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Hash className="h-3 w-3 sm:h-4 sm:w-4 inline sm:mr-2" />
              <span className="hidden sm:inline">Barcodes</span>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="flex flex-col lg:flex-row gap-6 lg:h-screen lg:overflow-hidden">
            {/* LEFT SIDE - Fixed Product Identity */}
            <div className="w-full lg:w-96 flex-shrink-0 space-y-6 lg:overflow-y-auto lg:pr-2">
              {/* Product Image */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 mr-2" />
                    Product Image
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-square rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden relative group">
                    {images.length > 0 ? (
                      <>
                        <img
                          src={images[currentImageIndex]}
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
                        {/* Navigation Arrows - Only show if multiple images */}
                        {images.length > 1 && (
                          <>
                            <button
                              onClick={prevImage}
                              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              onClick={nextImage}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            {/* Image Counter */}
                            <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                              {currentImageIndex + 1} / {images.length}
                            </div>
                          </>
                        )}
                      </>
                    ) : null}
                    <div className={`h-full w-full flex items-center justify-center ${images.length > 0 ? 'hidden' : 'flex'}`}>
                      <Package className="h-16 w-16 text-gray-400" />
                    </div>
                  </div>

                  {/* Download Images Button */}
                  {images.length > 0 && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadImages}
                        className="flex items-center w-full"
                        title="Download product images"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Images
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Product Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Product Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Badges */}
                  <div className="flex flex-col gap-3">
                    <span className={`inline-flex px-3 py-2 text-sm font-semibold rounded-full text-center ${
                      product.active
                        ? `bg-${theme.primaryBg} text-${theme.primaryText}`
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {product.active ? 'Active' : 'Inactive'}
                    </span>
                    
                    <span className={`inline-flex px-3 py-2 text-sm font-semibold rounded-full text-center ${
                      stockStatus === 'out-of-stock'
                        ? "bg-red-100 text-red-800"
                        : stockStatus === 'low-stock'
                          ? "bg-amber-100 text-amber-800"
                          : "bg-green-100 text-green-800"
                    }`}>
                      {stockStatus === 'out-of-stock' ? 'Out of Stock' : 
                       stockStatus === 'low-stock' ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>

                  {/* Description */}
                  {product.description && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                      <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
                    </div>
                  )}

                  {/* Quick Info */}
                  <div className="border-t pt-4 space-y-3">
                    <div>
                      <span className="text-xs font-medium text-gray-500">Category</span>
                      <p className="text-sm text-gray-900">{product.category?.name || 'Uncategorized'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">SKU</span>
                      <p className="text-sm text-gray-900 font-mono">{product.sku}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">Units</span>
                      <p className="text-sm text-gray-900">{product.uomBase} / {product.uomSell}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT SIDE - Scrollable Detailed Information */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Product ID</span>
                        <p className="text-sm text-gray-900 font-mono">{product.id}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Category</span>
                        <p className="text-sm text-gray-900">{product.category?.name || 'Uncategorized'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Base Unit</span>
                        <p className="text-sm text-gray-900">{product.uomBase}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Selling Unit</span>
                        <p className="text-sm text-gray-900">{product.uomSell}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Selling Currency</span>
                        <p className="text-sm text-gray-900">{product.originalPriceCurrency || product.baseCurrency || 'GHS'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Cost Currency</span>
                        <p className="text-sm text-gray-900">{product.originalCostCurrency || product.importCurrency || 'USD'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Created</span>
                        <p className="text-sm text-gray-900">
                          {new Date(product.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Last Updated</span>
                        <p className="text-sm text-gray-900">
                          {new Date(product.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pricing Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Pricing Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`grid gap-6 ${canViewCost ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-1'}`}>
                    <div className="text-center p-6 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-gray-900">
                        {formatCurrencyWithRate(product.price || 0, currency, product.originalPriceCurrency || product.baseCurrency || 'GHS')}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">Selling Price</div>
                      {product.originalPriceCurrency && product.originalPriceCurrency !== currency && (
                        <div className="text-xs text-gray-500 mt-2">
                          Original: {formatCurrencyWithRate(product.price || 0, product.originalPriceCurrency || 'GHS', product.originalPriceCurrency || 'GHS')}
                        </div>
                      )}
                    </div>
                    
                    {canViewCost && (
                      <>
                        <div className="text-center p-6 bg-gray-50 rounded-lg">
                          <div className="text-3xl font-bold text-gray-900">
                            {formatCurrencyWithRate(product.cost || 0, currency, product.originalCostCurrency || product.importCurrency || 'USD')}
                          </div>
                          <div className="text-sm text-gray-600 mt-2">Cost Price</div>
                          {product.originalCostCurrency && product.originalCostCurrency !== currency && (
                            <div className="text-xs text-gray-500 mt-2">
                              Original: {formatCurrencyWithRate(product.cost || 0, product.originalCostCurrency || 'USD', product.originalCostCurrency || 'USD')}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-center p-6 bg-gray-50 rounded-lg">
                          <div className={`text-3xl font-bold flex items-center justify-center ${
                            profitMargin > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {profitMargin > 0 ? <TrendingUp className="h-6 w-6 mr-2" /> : <TrendingDown className="h-6 w-6 mr-2" />}
                            {profitMargin.toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-600 mt-2">Profit Margin</div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stock Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 mr-2" />
                    Stock Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-6 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-gray-900">
                        {totalStock.quantity}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">Total Quantity</div>
                    </div>
                    
                    <div className="text-center p-6 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-gray-900">
                        {totalStock.reserved}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">Reserved</div>
                    </div>
                    
                    <div className="text-center p-6 bg-gray-50 rounded-lg">
                      <div className={`text-3xl font-bold ${
                        totalStock.available === 0
                          ? "text-red-600"
                          : totalStock.available < 20
                            ? "text-amber-600"
                            : "text-green-600"
                      }`}>
                        {totalStock.available}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">Available</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Barcode Information */}
              {product.barcode && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Hash className="h-5 w-5 mr-2" />
                      Barcode Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">Barcode</span>
                        <span className="text-sm text-gray-900 font-mono">{product.barcode}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">Type</span>
                        <span className="text-sm text-gray-900">{product.barcodeType || 'EAN13'}</span>
                      </div>
                      
                      {/* Barcode Display */}
                      <div className="flex justify-center">
                        <BarcodeDisplay
                          value={product.barcode}
                          format={(product.barcodeType as any) || 'EAN13'}
                          height={100}
                          width={2}
                          fontSize={16}
                          showActions={true}
                          productName={product.name}
                          productSku={product.sku}
                          price={product.price}
                        />
                      </div>
                      
                      {product.additionalBarcodes && product.additionalBarcodes.length > 0 && (
                        <div className="border-t pt-6">
                          <h4 className="text-sm font-medium text-gray-700 mb-4">Additional Barcodes</h4>
                          <div className="space-y-3">
                            {product.additionalBarcodes.map((ab: any) => (
                              <div key={ab.id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-900">{ab.source || 'Supplier'}: {ab.barcode}</span>
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">{ab.barcodeType}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stock Movements */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center text-lg">
                        <TrendingUp className="h-5 w-5 mr-2" />
                        Stock Movements
                      </CardTitle>
                      <CardDescription>
                        Recent stock movements for this product
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/products/${product.id}/stock-movements`)}
                      className="flex items-center"
                    >
                      View All Movements
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <StockMovementsSummary productId={product.id} />
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Upload product-related documents such as manuals, certificates, or specifications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="document-upload"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="document-upload"
                    className={`cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      {isUploading ? 'Uploading...' : 'Click to upload documents'}
                    </p>
                    <p className="text-sm text-gray-500">
                      PDF, DOC, DOCX, TXT, JPG, PNG files up to 10MB
                    </p>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Documents List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Product Documents
                    </CardTitle>
                    <CardDescription>
                      Manage and download product documents.
                    </CardDescription>
                  </div>
                  {documents.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllDocuments}
                        className="flex items-center"
                      >
                        {selectedDocuments.length === documents.length ? (
                          <CheckSquare className="h-4 w-4 mr-1" />
                        ) : (
                          <Square className="h-4 w-4 mr-1" />
                        )}
                        {selectedDocuments.length === documents.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      {selectedDocuments.length > 0 && (
                        <DropdownMenu
                          trigger={
                            <Button variant="outline" size="sm" className="flex items-center">
                              <MoreHorizontal className="h-4 w-4 mr-1" />
                              Bulk Actions ({selectedDocuments.length})
                            </Button>
                          }
                          items={[
                            {
                              label: "Download Selected",
                              icon: <Download className="h-4 w-4" />,
                              onClick: () => {
                                setBulkAction('download');
                                setIsBulkActionModalOpen(true);
                              }
                            },
                            {
                              label: "Email Selected",
                              icon: <Mail className="h-4 w-4" />,
                              onClick: () => {
                                setBulkAction('email');
                                setIsBulkActionModalOpen(true);
                              }
                            },
                            {
                              label: "Delete Selected",
                              icon: <Trash2 className="h-4 w-4" />,
                              onClick: () => {
                                setBulkAction('delete');
                                setIsBulkActionModalOpen(true);
                              },
                              className: "text-red-600 hover:text-red-700"
                            }
                          ]}
                        />
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded</h3>
                    <p className="text-gray-600">
                      Upload documents to get started.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleSelectDocument(doc.id)}
                            className="flex-shrink-0"
                          >
                            {selectedDocuments.includes(doc.id) ? (
                              <CheckSquare className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{doc.originalName}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(doc.createdAt).toLocaleDateString()} • {(doc.fileSize / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc.id, doc.originalName)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendSingleDocumentEmail(doc.id, doc.originalName)}
                            className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white border-0`}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Send Email
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            {/* Price Lists Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <DollarSign className="h-5 w-5 mr-2" />
                      Price Lists ({priceLists.length})
                    </CardTitle>
                    <CardDescription>
                      Manage pricing across different channels and customer segments
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={handleAddToPriceList}
                    className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Price List
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {priceLists.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Price Lists</h3>
                    <p className="text-gray-500 mb-4">
                      This product is not included in any price lists yet.
                    </p>
                    <Button 
                      onClick={handleAddToPriceList}
                      className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Price List
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Price List</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Channel</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Currency</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Unit Price</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Channel Price</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceLists.map((priceList) => (
                          <tr key={priceList.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{priceList.name}</div>
                              <div className="text-sm text-gray-500">
                                {priceList._count.items} product{priceList._count.items !== 1 ? 's' : ''}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                {priceList.channel}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600">{priceList.currency}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-gray-900">
                                {formatCurrency(priceList.items[0].unitPrice, priceList.currency)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600">
                                {priceList.items[0].basePrice 
                                  ? formatCurrency(priceList.items[0].basePrice, priceList.currency)
                                  : 'N/A'
                                }
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                new Date(priceList.effectiveFrom) <= new Date() &&
                                (!priceList.effectiveTo || new Date(priceList.effectiveTo) >= new Date())
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {new Date(priceList.effectiveFrom) <= new Date() &&
                                (!priceList.effectiveTo || new Date(priceList.effectiveTo) >= new Date())
                                  ? 'Active'
                                  : 'Inactive'
                                }
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => router.push(`/price-lists/${priceList.id}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleRemoveFromPriceList(priceList.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Warehouses Tab */}
        {activeTab === 'warehouses' && (
          <div className="space-y-6">
            {/* Warehouse Stock Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Stock Distribution Across Warehouses
                </CardTitle>
                <CardDescription>
                  Current stock levels for {product?.name} across all warehouses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!product || !product.stockItems || product.stockItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No stock information available for this product.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Warehouse</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Code</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-900">Total Quantity</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-900">Available</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-900">Reserved</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-900">Reorder Point</th>
                          {canViewCost && (
                            <>
                              <th className="text-right py-3 px-4 font-medium text-gray-900">Average Cost</th>
                              <th className="text-right py-3 px-4 font-medium text-gray-900">Total Value</th>
                            </>
                          )}
                          <th className="text-center py-3 px-4 font-medium text-gray-900">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.stockItems
                          .filter(stockItem => stockItem.warehouse && stockItem.warehouse.id) // Filter out items without valid warehouse
                          .map((stockItem) => {
                          const isLowStock = stockItem.available <= stockItem.reorderPoint;
                          const isOutOfStock = stockItem.available === 0;
                          
                          return (
                            <tr 
                              key={stockItem.id} 
                              className={`border-b hover:bg-gray-50 ${
                                isOutOfStock ? 'bg-red-50' : isLowStock ? 'bg-yellow-50' : ''
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center">
                                  <div className="p-2 rounded-lg bg-blue-100 mr-3">
                                    <Package className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {stockItem.warehouse?.name || 'No Warehouse'}
                                    </div>
                                    {stockItem.warehouse?.address && (
                                      <div className="text-sm text-gray-500">
                                        {stockItem.warehouse.address}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  {stockItem.warehouse?.code || 'N/A'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="font-medium text-gray-900">
                                  {stockItem.quantity.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`font-medium ${
                                  isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-green-600'
                                }`}>
                                  {stockItem.available.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-gray-600">
                                  {stockItem.reserved.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-gray-600">
                                  {stockItem.reorderPoint.toLocaleString()}
                                </span>
                              </td>
                              {canViewCost && (
                                <>
                                  <td className="py-3 px-4 text-right">
                                    <span className="text-gray-600">
                                      {formatCurrencyWithSymbol(product?.costPrice || 0, currency)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span className="font-medium text-gray-900">
                                      {formatCurrencyWithSymbol((stockItem.quantity * (product?.costPrice || 0)), currency)}
                                    </span>
                                  </td>
                                </>
                              )}
                              <td className="py-3 px-4 text-center">
                                {isOutOfStock ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <X className="h-3 w-3 mr-1" />
                                    Out of Stock
                                  </span>
                                ) : isLowStock ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Low Stock
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckSquare className="h-3 w-3 mr-1" />
                                    In Stock
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Statistics */}
            {product && product.stockItems && product.stockItems.filter(item => item.warehouse && item.warehouse.id).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Stock</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {product.stockItems
                            .filter(item => item.warehouse && item.warehouse.id)
                            .reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 rounded-full bg-blue-100">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Available</p>
                        <p className="text-2xl font-bold text-green-600">
                          {product.stockItems
                            .filter(item => item.warehouse && item.warehouse.id)
                            .reduce((sum, item) => sum + item.available, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 rounded-full bg-green-100">
                        <CheckSquare className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Reserved</p>
                        <p className="text-2xl font-bold text-yellow-600">
                          {product.stockItems
                            .filter(item => item.warehouse && item.warehouse.id)
                            .reduce((sum, item) => sum + item.reserved, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 rounded-full bg-yellow-100">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Value</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {formatCurrencyWithSymbol(
                            product.stockItems
                              .filter(item => item.warehouse && item.warehouse.id)
                              .reduce((sum, item) => sum + item.totalValue, 0), 
                            currency
                          )}
                        </p>
                      </div>
                      <div className="p-2 rounded-full bg-purple-100">
                        <DollarSign className="w-5 h-5 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Barcodes Tab */}
        {activeTab === 'barcodes' && (
          <div className="space-y-6">
            {/* Primary Barcode */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Hash className="h-5 w-5 mr-2" />
                  Primary Barcode
                </CardTitle>
                <CardDescription>
                  Your internal barcode used across all operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {product?.barcode ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Barcode Number</label>
                        <p className="text-lg font-mono font-semibold">{product.barcode}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Type</label>
                        <p className="text-lg">{product.barcodeType || 'EAN13'}</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <BarcodeDisplay
                        value={product.barcode}
                        format={(product.barcodeType as any) || 'EAN13'}
                        height={100}
                        width={2}
                        fontSize={20}
                        showActions={true}
                        productName={product.name}
                        productSku={product.sku}
                        price={product.price}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Hash className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No barcode assigned</p>
                    <p className="text-sm text-gray-400 mt-2">Edit product to add a barcode</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supplier Barcodes */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center">
                      <Building className="h-5 w-5 mr-2" />
                      Supplier Barcodes
                    </CardTitle>
                    <CardDescription>
                      Additional barcodes from different suppliers (all point to this product)
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const barcode = prompt('Enter supplier barcode:');
                      if (barcode) {
                        const source = prompt('Supplier name:') || 'Supplier';
                        handleLinkSupplierBarcode(barcode, source);
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Link Supplier Barcode
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {product?.additionalBarcodes && product.additionalBarcodes.length > 0 ? (
                  <div className="space-y-3">
                    {product.additionalBarcodes.map((barcode: any) => (
                      <div key={barcode.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-gray-900">{barcode.source || 'Supplier'}</span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                {barcode.barcodeType}
                              </span>
                            </div>
                            <p className="font-mono text-sm text-gray-700">{barcode.barcode}</p>
                            {barcode.description && (
                              <p className="text-xs text-gray-500 mt-1">{barcode.description}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Remove this supplier barcode mapping?')) {
                                handleRemoveSupplierBarcode(barcode.id);
                              }
                            }}
                          >
                            <X className="h-4 w-4 text-gray-400 hover:text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Building className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No supplier barcodes linked</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Link supplier barcodes so you can scan either your barcode or theirs
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Barcode Usage Guide */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center">
                  <HelpCircle className="h-5 w-5 mr-2" />
                  How Multiple Barcodes Work
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-900">
                <div className="space-y-2">
                  <p>✓ Your primary barcode is always used for internal operations</p>
                  <p>✓ Supplier barcodes let you scan products in their original packaging</p>
                  <p>✓ All barcodes (yours + suppliers) point to this same product</p>
                  <p>✓ When receiving stock, you can scan either barcode - both work!</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        product={product}
      />

      {/* Bulk Action Confirmation Modal */}
      {isBulkActionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-white rounded-lg p-6 ${bulkAction === 'email' ? 'max-w-lg' : 'max-w-md'} w-full mx-4`}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {bulkAction === 'email' ? 'Send Documents via Email' : 'Confirm Bulk Action'}
            </h3>
            
            {bulkAction === 'email' ? (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To (Email Addresses) *
                  </label>
                  <input
                    type="email"
                    multiple
                    value={emailForm.to}
                    onChange={(e) => handleEmailFormChange('to', e.target.value)}
                    placeholder="recipient@example.com, another@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CC (Optional)
                  </label>
                  <input
                    type="email"
                    multiple
                    value={emailForm.cc}
                    onChange={(e) => handleEmailFormChange('cc', e.target.value)}
                    placeholder="cc@example.com, copy@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    value={emailForm.message}
                    onChange={(e) => handleEmailFormChange('message', e.target.value)}
                    placeholder="Add a custom message to include with the documents..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="text-sm text-gray-600">
                  <p>📎 Attaching {selectedDocuments.length} document(s)</p>
                  <p>📧 Using standard email template from settings</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-600 mb-6">
                {bulkAction === 'delete' && `Are you sure you want to delete ${selectedDocuments.length} document(s)? This action cannot be undone.`}
                {bulkAction === 'download' && `Download ${selectedDocuments.length} document(s)?`}
              </p>
            )}
            
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBulkActionModalOpen(false);
                  setEmailForm({ to: '', cc: '', message: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                variant={bulkAction === 'delete' ? 'destructive' : 'default'}
                onClick={handleBulkAction}
                className={bulkAction === 'email' ? `bg-${theme.primary} hover:bg-${theme.primaryDark} text-white` : ''}
                disabled={bulkAction === 'email' && !emailForm.to.trim()}
              >
                {bulkAction === 'delete' && 'Delete'}
                {bulkAction === 'download' && 'Download'}
                {bulkAction === 'email' && 'Send Email'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Document Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Document
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this document? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDocumentToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteDocument}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product to Price List Modal */}
      <AddProductToPriceListFromProductModal
        isOpen={isAddToPriceListModalOpen}
        onClose={() => setIsAddToPriceListModalOpen(false)}
        onSuccess={handleRefreshPriceLists}
        productId={product.id}
        productName={product.name}
        productPrice={product.originalPrice || product.price}
        productCurrency={product.originalPriceCurrency || product.baseCurrency || 'GHS'}
      />
    </>
  );
}

// Stock Movements Summary Component
function StockMovementsSummary({ productId }: { productId: string }) {
  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMovements();
  }, [productId]);

  const fetchMovements = async () => {
    try {
      const response = await fetch(`/api/stock-movements?productId=${productId}&limit=4`);
      if (response.ok) {
        const data = await response.json();
        setMovements(data.movements || []);
      }
    } catch (error) {
      console.error('Error fetching stock movements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMovementTypeInfo = (type: string) => {
    const types: any = {
      'RECEIPT': { label: 'Receipt', icon: '↓', color: 'text-green-600' },
      'ADJUSTMENT': { label: 'Adjustment', icon: '↻', color: 'text-blue-600' },
      'TRANSFER_IN': { label: 'Transfer In', icon: '→', color: 'text-purple-600' },
      'TRANSFER_OUT': { label: 'Transfer Out', icon: '←', color: 'text-orange-600' },
      'SALE': { label: 'Sale', icon: '↑', color: 'text-emerald-600' },
      'RETURN': { label: 'Return', icon: '↗', color: 'text-cyan-600' },
      'DAMAGE': { label: 'Damage', icon: '⚠', color: 'text-red-600' },
      'THEFT': { label: 'Theft', icon: '✗', color: 'text-red-700' },
      'EXPIRY': { label: 'Expiry', icon: '📅', color: 'text-yellow-600' },
      'OTHER': { label: 'Other', icon: '📄', color: 'text-gray-600' }
    };
    return types[type] || types['OTHER'];
  };

  const getQuantityColor = (quantity: number) => {
    return quantity > 0 ? "text-green-600" : "text-red-600";
  };

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500">Loading movements...</div>;
  }

  if (movements.length === 0) {
    return <div className="text-center py-4 text-gray-500">No stock movements recorded yet.</div>;
  }

  return (
    <div className="space-y-3">
      {movements.map((movement) => {
        const typeInfo = getMovementTypeInfo(movement.type);
        return (
          <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`text-lg ${typeInfo.color}`}>
                {typeInfo.icon}
              </div>
              <div>
                <div className="font-medium text-sm">{typeInfo.label}</div>
                <div className="text-xs text-gray-500">
                  {new Date(movement.createdAt).toLocaleDateString()} at {new Date(movement.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`font-medium ${getQuantityColor(movement.quantity)}`}>
                {movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.product.uomBase}
              </div>
              {movement.unitCost && movement.unitCost > 0 && (
                <div className="text-xs text-gray-600">
                  ${movement.unitCost.toFixed(2)}/unit
                </div>
              )}
              {movement.reference && (
                <div className="text-xs text-gray-500">{movement.reference}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
