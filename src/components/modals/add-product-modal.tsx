"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencySelector } from "@/components/ui/currency-selector";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { parseNumberInput, getNumberInputValue } from "@/lib/number-input-utils";
import { 
  X, 
  Package, 
  Save, 
  Loader2,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Trash2,
  FileText
} from "lucide-react";
import { AddBrandModal } from "@/components/modals/add-brand-modal";

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddProductModal({ isOpen, onClose, onSuccess }: AddProductModalProps) {
  const { success, error: showError } = useToast();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const themeColor = getThemeColor();
  const [formData, setFormData] = useState({
    type: "PRODUCT" as "PRODUCT" | "SERVICE",
    sku: "",
    name: "",
    description: "",
    brandId: "",
    categoryId: "",
    price: 0,
    cost: 0,
    costCurrency: "USD",
    sellingCurrency: "USD",
    exchangeRateMode: "automatic" as "automatic" | "manual" | "fixed",
    customExchangeRate: 1,
    uomBase: "pcs",
    uomSell: "pcs",
    reorderPoint: 0,
    active: true,
    images: [] as string[],
    // Service-specific fields
    serviceCode: "",
    duration: "",
    unit: "hour",
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddBrandModalOpen, setIsAddBrandModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState<number | null>(null);
  const [convertedSellingPrice, setConvertedSellingPrice] = useState<number | null>(null);
  const [isPriceManuallySet, setIsPriceManuallySet] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchBrands();
      fetchUnits();
    }
  }, [isOpen]);

  // Listen for category refresh events
  useEffect(() => {
    const handleCategoryRefresh = () => {
      fetchCategories();
    };

    window.addEventListener('categoryAdded', handleCategoryRefresh);
    
    return () => {
      window.removeEventListener('categoryAdded', handleCategoryRefresh);
    };
  }, []);

  // Listen for brand refresh events
  useEffect(() => {
    const handleBrandRefresh = () => {
      fetchBrands();
    };

    window.addEventListener('brandAdded', handleBrandRefresh);
    
    return () => {
      window.removeEventListener('brandAdded', handleBrandRefresh);
    };
  }, []);

  // Fetch exchange rate when currencies change
  useEffect(() => {
    if (formData.costCurrency && formData.sellingCurrency) {
      fetchExchangeRate(formData.costCurrency, formData.sellingCurrency);
    }
  }, [formData.costCurrency, formData.sellingCurrency]);

  // Auto-calculate selling price when in automatic mode (only if not manually set)
  useEffect(() => {
    if (formData.exchangeRateMode === "automatic" && 
        formData.cost > 0 && 
        currentExchangeRate && 
        formData.costCurrency !== formData.sellingCurrency &&
        !isPriceManuallySet) {
      const calculatedPrice = formData.cost * currentExchangeRate;
      setFormData(prev => ({
        ...prev,
        price: Math.round(calculatedPrice * 100) / 100 // Round to 2 decimal places
      }));
    }
  }, [formData.cost, currentExchangeRate, formData.exchangeRateMode, formData.costCurrency, formData.sellingCurrency, isPriceManuallySet]);

  // Reset manual flag when cost or currencies change significantly
  useEffect(() => {
    setIsPriceManuallySet(false);
  }, [formData.costCurrency, formData.sellingCurrency]);

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands');
      if (response.ok) {
        const data = await response.json();
        setBrands(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch brands:', error);
      setBrands([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || data || []);
      } else {
        console.warn('Categories API not available, using mock categories');
        // Use mock categories as fallback
        setCategories([
          { id: '1', name: 'Electronics' },
          { id: '2', name: 'Furniture' },
          { id: '3', name: 'Clothing' },
          { id: '4', name: 'Books' }
        ]);
      }
    } catch (error) {
      console.warn('Categories API not available, using mock categories:', error);
      // Use mock categories as fallback
      setCategories([
        { id: '1', name: 'Electronics' },
        { id: '2', name: 'Furniture' },
        { id: '3', name: 'Clothing' },
        { id: '4', name: 'Books' }
      ]);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await fetch('/api/units');
      if (response.ok) {
        const data = await response.json();
        setUnits(data || []);
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchExchangeRate = async (fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) {
      setCurrentExchangeRate(1);
      return;
    }

    try {
      const response = await fetch('/api/currency/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          amount: 1
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentExchangeRate(data.exchangeRate);
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Convert images array to JSON string for database storage
      const dataToSend = {
        ...formData,
        images: JSON.stringify(formData.images),
        // Map new fields to database schema
        originalPrice: formData.price,
        originalCost: formData.cost,
        originalPriceCurrency: formData.sellingCurrency,
        originalCostCurrency: formData.costCurrency,
        exchangeRateAtImport: formData.exchangeRateMode === "manual" ? formData.customExchangeRate : currentExchangeRate,
        baseCurrency: formData.sellingCurrency,
        // Service-specific fields
        serviceCode: formData.type === "SERVICE" ? formData.sku : null,
        duration: formData.type === "SERVICE" ? formData.duration : null,
        unit: formData.type === "SERVICE" ? formData.unit : null,
        // Make SKU optional for services
        sku: formData.type === "PRODUCT" ? formData.sku : null
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        const itemType = formData.type === "SERVICE" ? "Service" : "Product";
        success(`${itemType} Created`, `"${formData.name}" has been successfully added.`);
        onSuccess();
        onClose();
        // Reset form
        setIsPriceManuallySet(false);
        setFormData({
          type: "PRODUCT",
          sku: "",
          name: "",
          description: "",
          brandId: "",
          categoryId: "",
          price: 0,
          cost: 0,
          costCurrency: "USD",
          sellingCurrency: "USD",
          exchangeRateMode: "automatic",
          customExchangeRate: 1,
          uomBase: "pcs",
          uomSell: "pcs",
          reorderPoint: 0,
          active: true,
          images: [] as string[],
          serviceCode: "",
          duration: "",
          unit: "hour",
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create product');
        showError("Error", errorData.error || 'Failed to create product');
      }
    } catch (error) {
      console.error('Network error creating product:', error);
      setError('Network error. Please try again.');
      showError("Network Error", 'Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateSKU = () => {
    // Generate a unique SKU based on category and timestamp
    const categoryPrefix = formData.categoryId ? 
      categories.find(c => c.id === formData.categoryId)?.name.substring(0, 3).toUpperCase() || 'PROD' : 
      'PROD';
    
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 random chars
    
    const generatedSKU = `${categoryPrefix}-${timestamp}-${randomSuffix}`;
    
    setFormData(prev => ({
      ...prev,
      sku: generatedSKU
    }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Upload file to server
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'product');

        const response = await fetch('/api/upload/images', {
          method: 'POST',
          body: formData,
        });

        // Check content type before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || result.message || 'Failed to upload image');
        }

        if (!result.url) {
          throw new Error('Invalid response: missing image URL');
        }

        return result.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));
    } catch (error) {
      console.error('Error uploading images:', error);
      setError('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Add New Product</span>
            </CardTitle>
            <CardDescription>
              Create a new product in your catalog
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              {/* Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: "PRODUCT" }))}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.type === "PRODUCT"
                        ? `border-${theme.primary} bg-${theme.primary} text-white`
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                    style={formData.type === "PRODUCT" ? { 
                      borderColor: theme.primary, 
                      backgroundColor: theme.primary, 
                      color: 'white' 
                    } : {}}
                  >
                    <Package className="h-5 w-5 inline mr-2" />
                    Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: "SERVICE" }))}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.type === "SERVICE"
                        ? `border-${theme.primary} bg-${theme.primary} text-white`
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                    style={formData.type === "SERVICE" ? { 
                      borderColor: theme.primary, 
                      backgroundColor: theme.primary, 
                      color: 'white' 
                    } : {}}
                  >
                    <FileText className="h-5 w-5 inline mr-2" />
                    Service
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === "PRODUCT" ? "SKU" : "Service Code"} *
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.sku}
                      onChange={(e) => handleInputChange('sku', e.target.value)}
                      placeholder={formData.type === "PRODUCT" ? "e.g., PROD-001" : "e.g., SVC-001"}
                      required
                      className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateSKU}
                      className={`border-${theme.primary} text-${theme.primary} hover:bg-${theme.primaryHover}`}
                    >
                      Generate SKU
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Premium Wireless Headphones"
                    required
                    className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
                  />
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Brand
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddBrandModalOpen(true)}
                      className={`text-xs text-${theme.primary} hover:text-${theme.primaryDark} hover:underline`}
                    >
                      + Add Brand
                    </button>
                  </div>
                  <select
                    value={formData.brandId}
                    onChange={(e) => handleInputChange('brandId', e.target.value)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                  >
                    <option value="">Select a brand (optional)</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        // Open Add Category modal
                        const event = new CustomEvent('openAddCategoryModal');
                        window.dispatchEvent(event);
                      }}
                      className={`text-xs text-${theme.primary} hover:text-${theme.primaryDark} hover:underline`}
                    >
                      + Add Category
                    </button>
                  </div>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => handleInputChange('categoryId', e.target.value)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder={formData.type === "PRODUCT" ? "Product description..." : "Service description..."}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                  rows={3}
                />
              </div>

              {/* Service-specific fields */}
              {formData.type === "SERVICE" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration
                    </label>
                    <Input
                      value={formData.duration}
                      onChange={(e) => handleInputChange('duration', e.target.value)}
                      placeholder="e.g., 1 hour, 2 days"
                      className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => handleInputChange('unit', e.target.value)}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                    >
                      <option value="hour">Hour</option>
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="session">Session</option>
                      <option value="project">Project</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Images
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isUploading ? (
                          <Loader2 className="w-8 h-8 mb-2 text-gray-500 animate-spin" />
                        ) : (
                          <Upload className="w-8 h-8 mb-2 text-gray-500" />
                        )}
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF (MAX. 10MB each)</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>

                  {/* Image Preview */}
                  {formData.images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {formData.images.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image}
                            alt={`Product ${index + 1}`}
                            className="w-full h-20 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Pricing & Currency</h3>
              
              {/* Cost Price Section */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-800">Cost Price (What you paid)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost Amount
                    </label>
                    <Input
                      type="number"
                      value={formData.cost === 0 ? "" : formData.cost}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || value === null || value === undefined) {
                          handleInputChange('cost', 0);
                        } else {
                          const parsed = parseFloat(value);
                          handleInputChange('cost', isNaN(parsed) ? 0 : parsed);
                        }
                      }}
                      onBlur={(e) => {
                        // Ensure we have a valid number on blur
                        if (e.target.value === "" || e.target.value === null) {
                          handleInputChange('cost', 0);
                        }
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost Currency
                    </label>
                    <select
                      value={formData.costCurrency}
                      onChange={(e) => handleInputChange('costCurrency', e.target.value)}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="GHS">GHS - Ghana Cedi</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="NGN">NGN - Nigerian Naira</option>
                      <option value="KES">KES - Kenyan Shilling</option>
                      <option value="ZAR">ZAR - South African Rand</option>
                      <option value="EGP">EGP - Egyptian Pound</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Selling Price Section */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-800">Selling Price (What you sell for)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Selling Amount
                      {formData.exchangeRateMode === "automatic" && 
                       formData.costCurrency !== formData.sellingCurrency && 
                       formData.cost > 0 && (
                        <span className="text-xs text-blue-600 ml-2">(Auto-calculated)</span>
                      )}
                    </label>
                    <Input
                      type="number"
                      value={formData.price === 0 ? "" : formData.price}
                      onChange={(e) => {
                        setIsPriceManuallySet(true);
                        const value = e.target.value;
                        if (value === "" || value === null || value === undefined) {
                          handleInputChange('price', 0);
                        } else {
                          const parsed = parseFloat(value);
                          handleInputChange('price', isNaN(parsed) ? 0 : parsed);
                        }
                      }}
                      onBlur={(e) => {
                        // Ensure we have a valid number on blur
                        if (e.target.value === "" || e.target.value === null) {
                          handleInputChange('price', 0);
                        }
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
                    />
                    {formData.exchangeRateMode === "automatic" && 
                     formData.costCurrency !== formData.sellingCurrency && 
                     formData.cost > 0 && 
                     !isPriceManuallySet && (
                      <p className="text-xs text-gray-500 mt-1">
                        Calculated from cost price using current exchange rate. You can edit this value.
                      </p>
                    )}
                    {isPriceManuallySet && (
                      <p className="text-xs text-blue-600 mt-1">
                        ✓ Manually set price
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Selling Currency
                    </label>
                    <select
                      value={formData.sellingCurrency}
                      onChange={(e) => handleInputChange('sellingCurrency', e.target.value)}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="GHS">GHS - Ghana Cedi</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="NGN">NGN - Nigerian Naira</option>
                      <option value="KES">KES - Kenyan Shilling</option>
                      <option value="ZAR">ZAR - South African Rand</option>
                      <option value="EGP">EGP - Egyptian Pound</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Exchange Rate Section */}
              {formData.costCurrency !== formData.sellingCurrency && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-md font-medium text-blue-800">Exchange Rate Settings</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Exchange Rate Mode
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            value="automatic"
                            checked={formData.exchangeRateMode === "automatic"}
                            onChange={(e) => handleInputChange('exchangeRateMode', e.target.value)}
                            className={`text-${theme.primary} focus:ring-${theme.primary}`}
                          />
                          <span className="text-sm">Automatic (Use current market rates)</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            value="manual"
                            checked={formData.exchangeRateMode === "manual"}
                            onChange={(e) => handleInputChange('exchangeRateMode', e.target.value)}
                            className={`text-${theme.primary} focus:ring-${theme.primary}`}
                          />
                          <span className="text-sm">Manual (Set custom rate)</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            value="fixed"
                            checked={formData.exchangeRateMode === "fixed"}
                            onChange={(e) => handleInputChange('exchangeRateMode', e.target.value)}
                            className={`text-${theme.primary} focus:ring-${theme.primary}`}
                          />
                          <span className="text-sm">Fixed (Keep same price regardless of currency)</span>
                        </label>
                      </div>
                    </div>

                    {formData.exchangeRateMode === "manual" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Custom Exchange Rate (1 {formData.costCurrency} = ? {formData.sellingCurrency})
                        </label>
                        <Input
                          type="number"
                          value={getNumberInputValue(formData.customExchangeRate)}
                          onChange={(e) => {
                            const parsed = parseNumberInput(e.target.value);
                            handleInputChange('customExchangeRate', parsed === "" ? 1 : parsed);
                          }}
                          placeholder="1.00"
                          step="0.0001"
                          min="0"
                          className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
                        />
                      </div>
                    )}

                    {formData.exchangeRateMode === "automatic" && currentExchangeRate && (
                      <div className="text-sm text-blue-700 bg-blue-100 p-2 rounded">
                        <strong>Current Rate:</strong> 1 {formData.costCurrency} = {currentExchangeRate.toFixed(4)} {formData.sellingCurrency}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Units of Measure */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Units of Measure</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Unit
                  </label>
                  <select
                    value={formData.uomBase}
                    onChange={(e) => handleInputChange('uomBase', e.target.value)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                  >
                    <option value="">Select base unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.symbol}>
                        {unit.symbol} - {unit.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selling Unit
                  </label>
                  <select
                    value={formData.uomSell}
                    onChange={(e) => handleInputChange('uomSell', e.target.value)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                  >
                    <option value="">Select selling unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.symbol}>
                        {unit.symbol} - {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Inventory Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Inventory Settings</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reorder Point
                </label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={getNumberInputValue(formData.reorderPoint)}
                    onChange={(e) => {
                      const parsed = parseNumberInput(e.target.value);
                      handleInputChange('reorderPoint', parsed === "" ? 0 : parsed);
                    }}
                    placeholder="Enter minimum stock level"
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500">{formData.uomBase}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Alert when stock falls below this level
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Status</h3>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => handleInputChange('active', e.target.checked)}
                  className={`rounded border-gray-300 text-${theme.primary} focus:ring-${theme.primary}`}
                />
                <label htmlFor="active" className="text-sm font-medium text-gray-700">
                  Active (product is available for sale)
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="text-white border-0"
                style={{ backgroundColor: themeColor || '#2563eb' }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Create Product
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <AddBrandModal
        isOpen={isAddBrandModalOpen}
        onClose={() => setIsAddBrandModalOpen(false)}
        onSuccess={() => {
          setIsAddBrandModalOpen(false);
          fetchBrands();
        }}
      />
    </div>
  );
}

export default AddProductModal;
