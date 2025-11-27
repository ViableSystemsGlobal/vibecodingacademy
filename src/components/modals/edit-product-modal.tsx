"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Package, Upload, Trash2 } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";

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
  originalPrice?: number;
  originalCost?: number;
  originalPriceCurrency?: string;
  originalCostCurrency?: string;
  exchangeRateAtImport?: number;
  baseCurrency?: string;
  importCurrency: string;
  active: boolean;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
    description?: string;
  };
  stockItem?: {
    id: string;
    productId: string;
    quantity: number;
    reserved: number;
    available: number;
  };
}

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | null;
}

export function EditProductModal({ isOpen, onClose, onSuccess, product }: EditProductModalProps) {
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    categoryId: "",
    price: 0,
    cost: 0,
    costCurrency: "USD",
    sellingCurrency: "USD",
    exchangeRateMode: "automatic" as "automatic" | "manual" | "fixed",
    customExchangeRate: 1,
    uomBase: "pcs",
    uomSell: "pcs",
    active: true,
  });
  const [images, setImages] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState<number | null>(null);

  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const { success, error: showError } = useToast();

  // Initialize form data when product changes
  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku ?? "",
        name: product.name ?? "",
        description: product.description ?? "",
        categoryId: product.categoryId ?? "",
        price: product.price || 0,
        cost: product.cost || 0,
        costCurrency: product.originalCostCurrency || product.importCurrency || "USD",
        sellingCurrency: product.originalPriceCurrency || product.baseCurrency || product.importCurrency || "USD",
        exchangeRateMode: product.exchangeRateAtImport ? "manual" : "automatic",
        customExchangeRate: product.exchangeRateAtImport || 1,
        uomBase: product.uomBase ?? "",
        uomSell: product.uomSell ?? "",
        active: product.active,
      });

      // Parse existing images
      let existingImages: string[] = [];
      if (product.images) {
        if (typeof product.images === 'string') {
          try {
            existingImages = JSON.parse(product.images);
          } catch (e) {
            existingImages = [];
          }
        } else if (Array.isArray(product.images)) {
          existingImages = product.images;
        }
      }
      setImages(existingImages);
    }
  }, [product]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
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


    if (isOpen) {
      fetchCategories();
      fetchUnits();
    }
  }, [isOpen]);

  // Listen for category refresh events
  useEffect(() => {
    const handleCategoryRefresh = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    window.addEventListener('categoryAdded', handleCategoryRefresh);
    
    return () => {
      window.removeEventListener('categoryAdded', handleCategoryRefresh);
    };
  }, []);

  // Fetch exchange rate when currencies change
  useEffect(() => {
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

    if (formData.costCurrency && formData.sellingCurrency) {
      fetchExchangeRate(formData.costCurrency, formData.sellingCurrency);
    }
  }, [formData.costCurrency, formData.sellingCurrency]);

  // Auto-calculate selling price when in automatic mode
  useEffect(() => {
    if (formData.exchangeRateMode === "automatic" && 
        formData.cost > 0 && 
        currentExchangeRate && 
        formData.costCurrency !== formData.sellingCurrency) {
      const calculatedPrice = formData.cost * currentExchangeRate;
      setFormData(prev => ({
        ...prev,
        price: Math.round(calculatedPrice * 100) / 100 // Round to 2 decimal places
      }));
    }
  }, [formData.cost, currentExchangeRate, formData.exchangeRateMode, formData.costCurrency, formData.sellingCurrency]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
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

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }

        const result = await response.json();
        return result.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setImages(prev => [...prev, ...uploadedUrls]);
    } catch (error) {
      console.error('Error uploading images:', error);
      setError('Failed to upload images');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const generateSKU = () => {
    const categoryPrefix = formData.categoryId ?
      categories.find(c => c.id === formData.categoryId)?.name.substring(0, 3).toUpperCase() || 'PROD' :
      'PROD';

    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();

    const generatedSKU = `${categoryPrefix}-${timestamp}-${randomSuffix}`;

    setFormData(prev => ({
      ...prev,
      sku: generatedSKU
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert images array to JSON string for database storage
      const dataToSend = {
        ...formData,
        images: JSON.stringify(images),
        // Map new fields to database schema
        originalPrice: formData.price,
        originalCost: formData.cost,
        originalPriceCurrency: formData.sellingCurrency,
        originalCostCurrency: formData.costCurrency,
        exchangeRateAtImport: formData.exchangeRateMode === "manual" ? formData.customExchangeRate : currentExchangeRate,
        baseCurrency: formData.sellingCurrency
      };

      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        success("Product Updated", `"${formData.name}" has been successfully updated.`);
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update product');
        showError("Error", errorData.error || 'Failed to update product');
      }
    } catch (error) {
      console.error('Network error updating product:', error);
      setError('Network error. Please try again.');
      showError("Network Error", 'Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Edit Product</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU *
                </label>
                <div className="flex gap-2">
                  <Input
                    value={formData.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    placeholder="e.g., PROD-001"
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
                  placeholder="Enter product name"
                  required
                  className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter product description"
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => handleInputChange('categoryId', e.target.value)}
                required
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
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

          {/* Pricing Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Pricing & Currency</h3>
            
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
                    value={formData.cost}
                    onChange={(e) => handleInputChange('cost', parseFloat(e.target.value) || 0)}
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
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      disabled={formData.exchangeRateMode === "automatic" && 
                               formData.costCurrency !== formData.sellingCurrency && 
                               formData.cost > 0}
                      className={`focus:ring-${theme.primary} focus:border-${theme.primary} ${
                        formData.exchangeRateMode === "automatic" && 
                        formData.costCurrency !== formData.sellingCurrency && 
                        formData.cost > 0 ? 'bg-gray-50' : ''
                      }`}
                    />
                    {formData.exchangeRateMode === "automatic" && 
                     formData.costCurrency !== formData.sellingCurrency && 
                     formData.cost > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Calculated from cost price using current exchange rate
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
                        value={formData.customExchangeRate}
                        onChange={(e) => handleInputChange('customExchangeRate', parseFloat(e.target.value) || 1)}
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

          {/* Units */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Units</h3>
            
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

          {/* Images */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Product Images</h3>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Click to upload images or drag and drop
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each</p>
              </label>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={image}
                      alt={`Product ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
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

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
            >
              {isLoading ? 'Updating...' : 'Update Product'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
