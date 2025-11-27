"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X, Loader2, Package, Mail, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  originalPrice: number | null;
  bestDealPrice?: number | null;
  originalPriceCurrency?: string | null;
  baseCurrency?: string | null;
  images: string | null;
  category: {
    id: string;
    name: string;
  };
  isBestDeal: boolean;
  active: boolean;
}

export default function BestDealsClient() {
  const { success, error: showError } = useToast();
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const [products, setProducts] = useState<Product[]>([]);
  const [bestDealProducts, setBestDealProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [customers, setCustomers] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [sendToAll, setSendToAll] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [manualEmails, setManualEmails] = useState<string>("");
  const [manualEmailList, setManualEmailList] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchBestDeals();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Fetch all products, then filter active ones on the client side
      const response = await fetch("/api/products?limit=1000");
      if (response.ok) {
        const data = await response.json();
        console.log("Products API response:", data); // Debug log
        const allProducts = data.products || data.data || [];
        // Filter to only show active products
        const activeProducts = allProducts.filter((p: Product) => p.active !== false);
        
        // Convert prices to GHS for display
        // Group products by currency to batch conversions
        const productsByCurrency = new Map<string, Product[]>();
        activeProducts.forEach((product: Product) => {
          const currency = product.originalPriceCurrency || product.baseCurrency || "GHS";
          if (!productsByCurrency.has(currency)) {
            productsByCurrency.set(currency, []);
          }
          productsByCurrency.get(currency)!.push(product);
        });
        
        // Get exchange rates for each currency (we'll use a sample price to get the rate)
        const currencyRates = new Map<string, number>();
        for (const [currency, products] of productsByCurrency.entries()) {
          if (currency === "GHS") {
            currencyRates.set(currency, 1);
            continue;
          }
          
          // Get rate using first product's price as sample
          const sampleProduct = products.find(p => p.price) || products[0];
          if (sampleProduct?.price) {
            try {
              const rateResponse = await fetch("/api/currency/convert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fromCurrency: currency,
                  toCurrency: "GHS",
                  amount: 1, // Get rate by converting 1 unit
                }),
              });
              
              if (rateResponse.ok) {
                const rateData = await rateResponse.json();
                currencyRates.set(currency, rateData.convertedAmount || 1);
              } else {
                currencyRates.set(currency, 1); // Fallback to 1 if conversion fails
              }
            } catch (error) {
              console.error(`Error getting exchange rate for ${currency}:`, error);
              currencyRates.set(currency, 1); // Fallback to 1
            }
          } else {
            currencyRates.set(currency, 1);
          }
        }
        
        // Apply conversions using the rates
        const productsWithConvertedPrices = activeProducts.map((product: Product) => {
          const currency = product.originalPriceCurrency || product.baseCurrency || "GHS";
          const rate = currencyRates.get(currency) || 1;
          
          return {
            ...product,
            price: product.price ? Math.round(product.price * rate * 100) / 100 : product.price,
            originalPrice: product.originalPrice ? Math.round(product.originalPrice * rate * 100) / 100 : product.originalPrice,
          };
        });
        
        setProducts(productsWithConvertedPrices);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Products API error:", response.status, errorData);
        showError(`Failed to load products: ${errorData.error || response.statusText}`);
      }
    } catch (err) {
      console.error("Error loading products:", err);
      showError("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchBestDeals = async () => {
    try {
      const response = await fetch("/api/ecommerce/best-deals");
      if (response.ok) {
        const data = await response.json();
        setBestDealProducts(data.products || []);
      }
    } catch (err) {
      console.error("Error loading best deals:", err);
    }
  };

  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState<string>("");

  const handleUpdateBestDealPrice = async (productId: string, price: number | null) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/ecommerce/best-deals/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestDealPrice: price }),
      });

      if (response.ok) {
        success("Best deals price updated");
        setEditingPrice(null);
        setPriceValue("");
        await Promise.all([fetchProducts(), fetchBestDeals()]);
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to update price");
      }
    } catch (err) {
      console.error("Error updating best deal price:", err);
      showError(err instanceof Error ? err.message : "Failed to update price");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBestDeal = async (productId: string, currentStatus: boolean) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/ecommerce/best-deals/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBestDeal: !currentStatus }),
      });

      if (response.ok) {
        success(`Product ${!currentStatus ? "added to" : "removed from"} Best Deals`);
        await Promise.all([fetchProducts(), fetchBestDeals()]);
      } else {
        const data = await response.json();
        throw new Error(data.error || "Failed to update product");
      }
    } catch (err) {
      console.error("Error updating best deal status:", err);
      showError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const response = await fetch("/api/ecommerce/best-deals/send-email");
      const data = await response.json();
      
      if (response.ok) {
        console.log("Fetched customers response:", data); // Debug log
        const customerList = data.customers || [];
        console.log(`Found ${customerList.length} customers`);
        setCustomers(customerList);
        
        if (customerList.length === 0) {
          console.warn("No customers found. This could mean:");
          console.warn("1. No customers in the database with emails");
          console.warn("2. No ecommerce orders with customer emails");
          console.warn("3. All customers are inactive");
        }
      } else {
        console.error("Failed to load customers:", data);
        showError(data.error || "Failed to load customers");
      }
    } catch (err) {
      console.error("Error loading customers:", err);
      showError("Failed to load customers. Check console for details.");
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleOpenEmailModal = () => {
    setShowEmailModal(true);
    setSelectedCustomers(new Set());
    setSendToAll(false);
    setManualEmails("");
    setManualEmailList([]);
    fetchCustomers();
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleAddManualEmails = () => {
    if (!manualEmails.trim()) {
      showError("Please enter at least one email address");
      return;
    }

    // Split by comma, semicolon, or newline
    const emails = manualEmails
      .split(/[,\n;]/)
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    const validEmails: string[] = [];
    const invalidEmails: string[] = [];

    emails.forEach((email) => {
      if (validateEmail(email)) {
        // Check if email is already in the list
        if (!manualEmailList.includes(email.toLowerCase()) && 
            !customers.some(c => c.email.toLowerCase() === email.toLowerCase())) {
          validEmails.push(email.toLowerCase());
        }
      } else {
        invalidEmails.push(email);
      }
    });

    if (invalidEmails.length > 0) {
      showError(`Invalid email addresses: ${invalidEmails.join(", ")}`);
    }

    if (validEmails.length > 0) {
      setManualEmailList([...manualEmailList, ...validEmails]);
      setManualEmails("");
      success(`Added ${validEmails.length} email${validEmails.length !== 1 ? "s" : ""}`);
    } else if (invalidEmails.length === 0) {
      showError("All emails are already added or invalid");
    }
  };

  const handleRemoveManualEmail = (email: string) => {
    setManualEmailList(manualEmailList.filter((e) => e !== email));
  };

  const handleSendEmail = async () => {
    const hasSelectedCustomers = selectedCustomers.size > 0;
    const hasManualEmails = manualEmailList.length > 0;
    
    if (!sendToAll && !hasSelectedCustomers && !hasManualEmails) {
      showError("Please select at least one customer, add manual emails, or choose 'Send to All'");
      return;
    }

    try {
      setSendingEmail(true);
      const response = await fetch("/api/ecommerce/best-deals/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendToAll,
          customerIds: sendToAll ? [] : Array.from(selectedCustomers),
          manualEmails: manualEmailList,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        success(data.message || "Emails sent successfully!");
        setShowEmailModal(false);
        setSelectedCustomers(new Set());
        setSendToAll(false);
        setManualEmails("");
        setManualEmailList([]);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send emails");
      }
    } catch (err) {
      console.error("Error sending emails:", err);
      showError(err instanceof Error ? err.message : "Failed to send emails");
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const bestDealIds = new Set(bestDealProducts.map((p) => p.id));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Best Deals Management</h1>
          <p className="text-gray-600 mt-1">
            Select products to feature in the "Best Deals" section on the homepage
          </p>
        </div>
        <Button
          onClick={handleOpenEmailModal}
          className={`flex items-center gap-2 bg-[#23185c] hover:bg-[#1c1448] text-white font-semibold shadow-sm hover:shadow-md transition-all`}
          disabled={bestDealProducts.length === 0}
        >
          <Mail className="h-4 w-4" />
          Send Best Deals Email
        </Button>
      </div>

      {/* Current Best Deals */}
      {bestDealProducts.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Best Deals ({bestDealProducts.length})</CardTitle>
            <CardDescription>
              These products are currently featured in the Best Deals section
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bestDealProducts.map((product) => {
                const images = product.images
                  ? (() => {
                      try {
                        const parsed = JSON.parse(product.images);
                        return Array.isArray(parsed) ? parsed : [product.images];
                      } catch {
                        return [product.images];
                      }
                    })()
                  : [];

                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50"
                  >
                    {images[0] ? (
                      <img
                        src={images[0]}
                        alt={product.name}
                        className="h-16 w-16 object-cover rounded"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-gray-100 rounded flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.sku}</p>
                      {product.bestDealPrice ? (
                        <>
                          <p className="text-sm font-semibold text-red-600">
                            GH₵{product.bestDealPrice.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 line-through">
                            GH₵{product.price?.toFixed(2) || "0.00"}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-gray-900">
                          GH₵{product.price?.toFixed(2) || "0.00"}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleBestDeal(product.id, true)}
                      disabled={saving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Product List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Products</CardTitle>
              <CardDescription>
                Search and select products to add to Best Deals
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No products found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const images = product.images
                  ? (() => {
                      try {
                        const parsed = JSON.parse(product.images);
                        return Array.isArray(parsed) ? parsed : [product.images];
                      } catch {
                        return [product.images];
                      }
                    })()
                  : [];
                const isBestDeal = bestDealIds.has(product.id);

                return (
                  <div
                    key={product.id}
                    className={`p-4 border rounded-lg hover:bg-gray-50 ${
                      isBestDeal ? "border-green-500 bg-green-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {images[0] ? (
                        <img
                          src={images[0]}
                          alt={product.name}
                          className="h-20 w-20 object-cover rounded"
                        />
                      ) : (
                        <div className="h-20 w-20 bg-gray-100 rounded flex items-center justify-center">
                          <Package className="h-10 w-10 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.sku}</p>
                            
                            {/* Price Display */}
                            {isBestDeal && editingPrice === product.id ? (
                              <div className="mt-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">GH₵</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={priceValue}
                                      onChange={(e) => setPriceValue(e.target.value)}
                                      placeholder={product.price?.toFixed(2) || "0.00"}
                                      className="h-7 w-28 pl-10 text-xs"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          const numValue = priceValue ? parseFloat(priceValue) : null;
                                          handleUpdateBestDealPrice(product.id, numValue);
                                        } else if (e.key === "Escape") {
                                          setEditingPrice(null);
                                          setPriceValue("");
                                        }
                                      }}
                                    />
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={() => {
                                      const numValue = priceValue ? parseFloat(priceValue) : null;
                                      handleUpdateBestDealPrice(product.id, numValue);
                                    }}
                                    disabled={saving}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={() => {
                                      setEditingPrice(null);
                                      setPriceValue("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Regular: GH₵{product.price?.toFixed(2) || "0.00"}
                                </p>
                                <p className="text-xs text-blue-600 italic">
                                  Enter price in GHS (Ghanaian Cedis)
                                </p>
                              </div>
                            ) : (
                              <div className="mt-1">
                                {isBestDeal && product.bestDealPrice ? (
                                  <>
                                    <p className="text-sm font-semibold text-red-600">
                                      GH₵{product.bestDealPrice.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-500 line-through">
                                      GH₵{product.price?.toFixed(2) || "0.00"}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm font-semibold text-gray-900">
                                      GH₵{product.price?.toFixed(2) || "0.00"}
                                    </p>
                                    {product.originalPrice && product.originalPrice > (product.price || 0) && (
                                      <p className="text-xs text-gray-500 line-through">
                                        GH₵{product.originalPrice.toFixed(2)}
                                      </p>
                                    )}
                                  </>
                                )}
                                {isBestDeal && (
                                  <button
                                    onClick={() => {
                                      setEditingPrice(product.id);
                                      setPriceValue(product.bestDealPrice?.toString() || "");
                                    }}
                                    className="mt-1 text-xs text-blue-600 hover:text-blue-700 underline"
                                  >
                                    {product.bestDealPrice ? "Edit Best Deal Price" : "Set Best Deal Price"}
                                  </button>
                                )}
                              </div>
                            )}
                            
                            <Badge variant="outline" className="mt-1 text-xs">
                              {product.category.name}
                            </Badge>
                          </div>
                          {isBestDeal && (
                            <Badge className="bg-green-500">Best Deal</Badge>
                          )}
                        </div>
                        <Button
                          variant={isBestDeal ? "destructive" : "default"}
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => handleToggleBestDeal(product.id, isBestDeal)}
                          disabled={saving}
                        >
                          {isBestDeal ? (
                            <>
                              <X className="h-4 w-4 mr-2" />
                              Remove from Best Deals
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add to Best Deals
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Best Deals Email</DialogTitle>
            <DialogDescription>
              Send promotional emails featuring your best deal products to customers.
              {bestDealProducts.length > 0 && (
                <span className="block mt-2 text-sm font-medium text-blue-600">
                  {bestDealProducts.length} product{bestDealProducts.length !== 1 ? 's' : ''} will be featured
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={sendToAll}
                onCheckedChange={(checked) => {
                  setSendToAll(checked === true);
                  if (checked) {
                    setSelectedCustomers(new Set());
                  }
                }}
              />
              <Label className="text-sm font-medium cursor-pointer" onClick={() => setSendToAll(!sendToAll)}>
                Send to all customers ({customers.length} total)
              </Label>
            </div>

            {!sendToAll && (
              <div className="space-y-4">
                {/* Manual Email Input */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Add Email Addresses Manually:</Label>
                  <div className="flex gap-2">
                    <textarea
                      value={manualEmails}
                      onChange={(e) => setManualEmails(e.target.value)}
                      placeholder="Enter email addresses (one per line or comma-separated)&#10;Example:&#10;customer1@example.com&#10;customer2@example.com"
                      className="flex-1 min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#23185c] focus:border-transparent resize-y"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleAddManualEmails();
                        }
                      }}
                    />
                    <Button
                      onClick={handleAddManualEmails}
                      className="bg-[#23185c] hover:bg-[#1c1448] text-white"
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {manualEmailList.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {manualEmailList.map((email) => (
                        <Badge
                          key={email}
                          variant="secondary"
                          className="flex items-center gap-1 px-2 py-1"
                        >
                          {email}
                          <button
                            onClick={() => handleRemoveManualEmail(email)}
                            className="ml-1 hover:text-red-600"
                            type="button"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Customer Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Select Customers:</Label>
                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                    {loadingCustomers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">Loading customers...</span>
                      </div>
                    ) : customers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No customers found. Use the manual email input above to add email addresses.</p>
                    ) : (
                      <div className="space-y-2">
                        {customers.map((customer) => (
                          <div key={customer.id} className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectedCustomers.has(customer.id)}
                              onCheckedChange={(checked) => {
                                const newSet = new Set(selectedCustomers);
                                if (checked) {
                                  newSet.add(customer.id);
                                } else {
                                  newSet.delete(customer.id);
                                }
                                setSelectedCustomers(newSet);
                              }}
                            />
                            <Label
                              className="text-sm cursor-pointer flex-1"
                              onClick={() => {
                                const newSet = new Set(selectedCustomers);
                                if (selectedCustomers.has(customer.id)) {
                                  newSet.delete(customer.id);
                                } else {
                                  newSet.add(customer.id);
                                }
                                setSelectedCustomers(newSet);
                              }}
                            >
                              <span className="font-medium">{customer.name}</span>
                              <span className="text-gray-500 ml-2">({customer.email})</span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {(selectedCustomers.size > 0 || manualEmailList.length > 0) && (
                    <p className="text-sm text-gray-600">
                      {selectedCustomers.size} customer{selectedCustomers.size !== 1 ? 's' : ''} selected
                      {manualEmailList.length > 0 && `, ${manualEmailList.length} manual email${manualEmailList.length !== 1 ? 's' : ''} added`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowEmailModal(false);
                setSelectedCustomers(new Set());
                setSendToAll(false);
              }}
              disabled={sendingEmail}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendingEmail || (!sendToAll && selectedCustomers.size === 0 && manualEmailList.length === 0) || bestDealProducts.length === 0}
              className={`flex items-center gap-2 min-w-[150px] bg-[#23185c] hover:bg-[#1c1448] text-white font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Email{sendToAll 
                    ? ` to All (${customers.length})` 
                    : ` (${selectedCustomers.size + manualEmailList.length})`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

