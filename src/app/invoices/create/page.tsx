"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomerSearch } from "@/components/ui/customer-search";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { 
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  Loader2,
  Search,
  Building,
  Package,
  Calendar,
  FileText
} from "lucide-react";
import Link from "next/link";

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxes: TaxItem[];
  lineTotal: number;
}

interface TaxItem {
  id: string;
  name: string;
  rate: number;
  amount: number;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  type: 'account' | 'distributor' | 'lead';
  customerType?: 'STANDARD' | 'CREDIT';
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  originalPrice?: number | null;
  originalPriceCurrency?: string | null;
  baseCurrency?: string | null;
  images?: string | null; // JSON string in database, will be parsed to string[]
}

// Default tax types
const DEFAULT_TAXES: TaxItem[] = [
  { id: 'vat', name: 'VAT', rate: 15, amount: 0 },
  { id: 'nhil', name: 'NHIL', rate: 2.5, amount: 0 },
  { id: 'getfund', name: 'GETFund', rate: 2.5, amount: 0 },
  { id: 'covid', name: 'COVID-19', rate: 1, amount: 0 },
];

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

// Product Price Display Component - converts and displays price in target currency (GHS for invoices)
const ProductPriceDisplay = ({ 
  product 
}: { 
  product: Product;
}) => {
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const targetCurrency = 'GHS'; // Invoices are always in GHS

  useEffect(() => {
    const convertPrice = async () => {
      setIsLoading(true);
      try {
        const baseCurrency = product.baseCurrency || 'USD';
        const originalCurrency = product.originalPriceCurrency || baseCurrency;
        const hasOriginal = typeof product.originalPrice === 'number' && !Number.isNaN(product.originalPrice as number);

        // Prefer originalPrice if available (it's the source of truth)
        if (hasOriginal && originalCurrency) {
          if (originalCurrency === targetCurrency) {
            // Already in target currency, use directly
            setDisplayPrice(Number(product.originalPrice));
            setIsLoading(false);
            return;
          } else {
            // Need to convert from original currency to target currency
            try {
              const res = await fetch('/api/currency/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  fromCurrency: originalCurrency, 
                  toCurrency: targetCurrency, 
                  amount: Number(product.originalPrice)
                })
              });
              if (res.ok) {
                const data = await res.json();
                setDisplayPrice(Number(data.convertedAmount ?? product.originalPrice));
                setIsLoading(false);
                return;
              }
            } catch (error) {
              console.error('Error converting price:', error);
            }
          }
        }

        // Fallback: if no originalPrice, use product.price
        if (baseCurrency === targetCurrency && typeof product.price === 'number') {
          setDisplayPrice(product.price);
          setIsLoading(false);
          return;
        }

        // Last resort: convert product.price from baseCurrency to target currency
        if (product.price) {
          try {
            const res = await fetch('/api/currency/convert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                fromCurrency: baseCurrency, 
                toCurrency: targetCurrency, 
                amount: product.price
              })
            });
            if (res.ok) {
              const data = await res.json();
              setDisplayPrice(Number(data.convertedAmount ?? product.price));
            } else {
              setDisplayPrice(product.price);
            }
          } catch (error) {
            console.error('Error converting price:', error);
            setDisplayPrice(product.price);
          }
        } else {
          setDisplayPrice(0);
        }
      } catch (error) {
        console.error('Error in price conversion:', error);
        setDisplayPrice(product.price || 0);
      } finally {
        setIsLoading(false);
      }
    };

    convertPrice();
  }, [product]);

  if (isLoading) {
    return (
      <div className="text-sm font-medium text-gray-400">
        GH₵...
      </div>
    );
  }

  return (
    <div className="text-sm font-medium text-gray-900">
      GH₵{(displayPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  );
};

export default function CreateInvoicePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { success, error: showError } = useToast();
  const { getThemeClasses, customLogo } = useTheme();
  const theme = getThemeClasses();
  
  // Form state
  const [subject, setSubject] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerType, setCustomerType] = useState<'account' | 'distributor' | 'lead'>('account');
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [globalTaxes, setGlobalTaxes] = useState<TaxItem[]>(DEFAULT_TAXES);
  const [taxInclusive, setTaxInclusive] = useState(false);
  
  // Data loading
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Address selection state
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedBillingAddressId, setSelectedBillingAddressId] = useState("");
  const [selectedShippingAddressId, setSelectedShippingAddressId] = useState("");
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  
  // Product search
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadProducts();
    
    // Set default due date (30 days from now)
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    setDueDate(defaultDate.toISOString().split('T')[0]);
  }, []);

  const loadCustomers = async () => {
    try {
      setIsLoadingCustomers(true);
      
      // Load both accounts and distributors
      const [accountsRes, distributorsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/drm/distributors')
      ]);
      
      const allCustomers: Customer[] = [];
      
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const accounts = (Array.isArray(accountsData) ? accountsData : []).map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          email: acc.email,
          phone: acc.phone,
          address: acc.address,
          type: 'account' as const,
          customerType: 'STANDARD' as const
        }));
        allCustomers.push(...accounts);
      }
      
      if (distributorsRes.ok) {
        const distributorsData = await distributorsRes.json();
        const distributors = (distributorsData.data || []).map((dist: any) => ({
          id: dist.id,
          name: dist.businessName || `${dist.firstName} ${dist.lastName}`,
          email: dist.email,
          phone: dist.phone,
          address: dist.address,
          type: 'distributor' as const,
          customerType: 'CREDIT' as const
        }));
        allCustomers.push(...distributors);
      }
      
      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true);
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const loadAddresses = async (accountId: string) => {
    try {
      console.log('📍 Loading addresses for account:', accountId);
      setIsLoadingAddresses(true);
      const response = await fetch(`/api/addresses?accountId=${accountId}`, {
        credentials: 'include',
      });
      
      console.log('📍 Address API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📍 Addresses loaded:', data.addresses);
        setAddresses(data.addresses || []);
        
        // Auto-select default addresses
        const defaultBilling = data.addresses?.find((addr: any) => 
          (addr.type === 'BILLING' || addr.type === 'BOTH') && addr.isDefault
        );
        const defaultShipping = data.addresses?.find((addr: any) => 
          (addr.type === 'SHIPPING' || addr.type === 'BOTH') && addr.isDefault
        );
        
        if (defaultBilling) {
          console.log('📍 Auto-selected default billing address:', defaultBilling.id);
          setSelectedBillingAddressId(defaultBilling.id);
        }
        if (defaultShipping) {
          console.log('📍 Auto-selected default shipping address:', defaultShipping.id);
          setSelectedShippingAddressId(defaultShipping.id);
        }
        
        console.log('✅ Loaded addresses:', data.addresses?.length || 0);
      } else {
        console.error('❌ Failed to load addresses, status:', response.status);
        setAddresses([]);
      }
    } catch (error) {
      console.error('❌ Error loading addresses:', error);
      setAddresses([]);
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const handleCustomerChange = (custId: string) => {
    setCustomerId(custId);
    const customer = customers.find(c => c.id === custId);
    setSelectedCustomer(customer || null);
    
    // Load addresses if customer is an account
    if (customer?.type === 'account') {
      loadAddresses(customer.id);
    } else {
      // Clear addresses for non-account customers
      setAddresses([]);
      setSelectedBillingAddressId("");
      setSelectedShippingAddressId("");
    }
    
    if (customer) {
      setCustomerType(customer.type);
    }
  };

  const addLineItem = async (product: Product) => {
    try {
      const targetCurrency = 'GHS'; // Invoices are always in GHS
      const baseCurrency = product.baseCurrency || 'USD';
      const originalCurrency = product.originalPriceCurrency || baseCurrency;
      const hasOriginal = typeof product.originalPrice === 'number' && !Number.isNaN(product.originalPrice as number);

      let unitPrice = product.price || 0;

      // Prefer originalPrice if available (it's the source of truth)
      if (hasOriginal && originalCurrency) {
        if (originalCurrency === targetCurrency) {
          // Already in target currency, use directly
          unitPrice = Number(product.originalPrice);
        } else {
          // Need to convert from original currency to target currency
          try {
            const res = await fetch('/api/currency/convert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                fromCurrency: originalCurrency, 
                toCurrency: targetCurrency, 
                amount: Number(product.originalPrice)
              })
            });
            if (res.ok) {
              const data = await res.json();
              unitPrice = Number(data.convertedAmount ?? product.originalPrice);
            }
          } catch (error) {
            console.error('Error converting price:', error);
          }
        }
      } else if (baseCurrency !== targetCurrency && product.price) {
        // Convert product.price from baseCurrency to target currency
        try {
          const res = await fetch('/api/currency/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              fromCurrency: baseCurrency, 
              toCurrency: targetCurrency, 
              amount: product.price
            })
          });
          if (res.ok) {
            const data = await res.json();
            unitPrice = Number(data.convertedAmount ?? product.price);
          }
        } catch (error) {
          console.error('Error converting price:', error);
        }
      }

      const baseAmount = unitPrice;
      
      // Calculate taxes immediately
      const taxes = globalTaxes.map(tax => {
        const taxAmount = baseAmount * (tax.rate / 100);
        return { ...tax, amount: taxAmount };
      });
      
      const totalTaxAmount = taxes.reduce((sum, tax) => sum + tax.amount, 0);
      
      const newLine: LineItem = {
        id: Math.random().toString(36).substr(2, 9),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: unitPrice,
        discount: 0,
        taxes: taxes,
        lineTotal: taxInclusive ? baseAmount + totalTaxAmount : baseAmount,
      };
      setLines([...lines, newLine]);
      setShowProductSearch(false);
      setProductSearchTerm("");
    } catch (error) {
      console.error('Error adding line item:', error);
      showError('Error', 'Failed to add product. Please try again.');
    }
  };

  const handleBarcodeScan = (barcode: string, product: any) => {
    if (product) {
      addLineItem(product);
      setShowProductSearch(false);
    } else {
      showError(`Product not found: ${barcode}`);
    }
  };

  const updateLineItem = (id: string, field: string, value: any) => {
    setLines(lines.map(line => {
      if (line.id === id) {
        const updated = { ...line, [field]: value };
        
        // Recalculate line total
        const subtotal = updated.quantity * updated.unitPrice;
        const discountAmount = subtotal * (updated.discount / 100);
        const afterDiscount = subtotal - discountAmount;
        
        // Calculate taxes
        let totalTaxAmount = 0;
        updated.taxes = updated.taxes.map(tax => {
          const taxAmount = afterDiscount * (tax.rate / 100);
          totalTaxAmount += taxAmount;
          return { ...tax, amount: taxAmount };
        });
        
        // Line total should only include taxes if taxInclusive is true
        updated.lineTotal = taxInclusive ? afterDiscount + totalTaxAmount : afterDiscount;
        return updated;
      }
      return line;
    }));
  };

  const updateTaxRate = (taxId: string, rate: number) => {
    setGlobalTaxes(globalTaxes.map(tax => 
      tax.id === taxId ? { ...tax, rate } : tax
    ));
    
    // Update all line items with new tax rates
    setLines(lines.map(line => {
      const updated = { ...line };
      updated.taxes = updated.taxes.map(tax => 
        tax.id === taxId ? { ...tax, rate } : tax
      );
      
      // Recalculate line total
      const subtotal = updated.quantity * updated.unitPrice;
      const discountAmount = subtotal * (updated.discount / 100);
      const afterDiscount = subtotal - discountAmount;
      
      let totalTaxAmount = 0;
      updated.taxes = updated.taxes.map(tax => {
        const taxAmount = afterDiscount * (tax.rate / 100);
        totalTaxAmount += taxAmount;
        return { ...tax, amount: taxAmount };
      });
      
      updated.lineTotal = taxInclusive ? afterDiscount + totalTaxAmount : afterDiscount;
      return updated;
    }));
  };

  const addTax = () => {
    const newTax: TaxItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Tax',
      rate: 0,
      amount: 0
    };
    
    setGlobalTaxes([...globalTaxes, newTax]);
    
    // Add the new tax to all existing line items
    setLines(lines.map(line => ({
      ...line,
      taxes: [...line.taxes, { ...newTax, amount: 0 }]
    })));
  };

  const removeTax = (taxId: string) => {
    if (globalTaxes.length <= 1) {
      showError("Error", "At least one tax is required");
      return;
    }
    
    setGlobalTaxes(globalTaxes.filter(tax => tax.id !== taxId));
    
    // Remove the tax from all existing line items
    setLines(lines.map(line => {
      const updated = { ...line };
      updated.taxes = updated.taxes.filter(tax => tax.id !== taxId);
      
      // Recalculate line total
      const subtotal = updated.quantity * updated.unitPrice;
      const discountAmount = subtotal * (updated.discount / 100);
      const afterDiscount = subtotal - discountAmount;
      
      let totalTaxAmount = 0;
      updated.taxes = updated.taxes.map(tax => {
        const taxAmount = afterDiscount * (tax.rate / 100);
        totalTaxAmount += taxAmount;
        return { ...tax, amount: taxAmount };
      });
      
      updated.lineTotal = taxInclusive ? afterDiscount + totalTaxAmount : afterDiscount;
      return updated;
    }));
  };

  const removeLineItem = (id: string) => {
    setLines(lines.filter(line => line.id !== id));
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, line) => {
      return sum + (line.quantity * line.unitPrice * (1 - line.discount / 100));
    }, 0);
    
    const totalDiscount = lines.reduce((sum, line) => {
      return sum + (line.quantity * line.unitPrice * (line.discount / 100));
    }, 0);
    
    // Calculate taxes by type
    const taxesByType: { [key: string]: number } = {};
    let totalTax = 0;
    
    lines.forEach(line => {
      line.taxes.forEach(tax => {
        if (!taxesByType[tax.id]) {
          taxesByType[tax.id] = 0;
        }
        taxesByType[tax.id] += tax.amount;
        totalTax += tax.amount;
      });
    });
    
    const total = subtotal + totalTax;
    
    return { subtotal, totalDiscount, taxesByType, totalTax, total };
  };

  const totals = calculateTotals();

  const handleSave = async (sendToCustomer: boolean = false) => {
    if (!subject.trim()) {
      showError("Validation Error", "Subject is required");
      return;
    }
    
    if (!customerId) {
      showError("Validation Error", "Please select a customer");
      return;
    }
    
    if (lines.length === 0) {
      showError("Validation Error", "Add at least one product");
      return;
    }

    if (!dueDate) {
      showError("Validation Error", "Due date is required");
      return;
    }

    try {
      setIsSaving(true);
      
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          accountId: selectedCustomer?.type === 'account' ? customerId : null,
          distributorId: selectedCustomer?.type === 'distributor' ? customerId : null,
          leadId: selectedCustomer?.type === 'lead' ? customerId : null,
          customerType: selectedCustomer?.customerType || 'STANDARD',
          billingAddressId: selectedBillingAddressId || null,
          shippingAddressId: selectedShippingAddressId || null,
          dueDate,
          paymentTerms,
          notes,
          taxInclusive,
          lines: lines.map(line => ({
            productId: line.productId,
            productName: line.productName,
            sku: line.sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount,
            taxes: line.taxes.map(tax => ({
              name: tax.name,
              rate: tax.rate,
              amount: tax.amount,
            })),
            lineTotal: line.lineTotal,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        success("Invoice Created", `Invoice ${data.invoice.number} has been created successfully`);
        
        if (sendToCustomer) {
          // TODO: Send email
          success("Email Sent", "Invoice sent to customer");
        }
        
        router.push('/invoices');
      } else {
        const error = await response.json();
        showError("Error", error.error || "Failed to create invoice");
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      showError("Error", "Failed to create invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p => {
    // Filter by search term
    const matchesSearch = p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearchTerm.toLowerCase());
    
    // Check if product is already added to lines
    const isAlreadyAdded = lines.some(line => line.productId === p.id);
    
    return matchesSearch && !isAlreadyAdded;
  });

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
            <Link href="/invoices">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Invoice</h1>
              <p className="text-sm sm:text-base text-gray-600">Create a new invoice for your customer</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:space-x-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Save & Send</>
              )}
            </Button>
          </div>
        </div>

        {/* STRIPE-STYLE SPLIT VIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          
          {/* LEFT PANEL - FORM */}
          <div className="space-y-6">
            
            {/* Customer Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building className="h-5 w-5" />
                  <span>Customer Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CustomerSearch
                  value={customerId}
                  onChange={(id, customer) => {
                    console.log('👤 Customer selected in invoice:', { id, customer });
                    if (customer) {
                    setCustomerId(id);
                    setSelectedCustomer(customer);
                      setCustomerType(customer.type);
                      
                      // Load addresses if customer is an account
                      if (customer.type === 'account') {
                        console.log('📍 Loading addresses for account:', customer.id);
                        loadAddresses(customer.id);
                      } else {
                        // Clear addresses for non-account customers
                        console.log('🔄 Clearing addresses for non-account customer');
                        setAddresses([]);
                        setSelectedBillingAddressId("");
                        setSelectedShippingAddressId("");
                      }
                    } else {
                      // Customer cleared
                      console.log('❌ Customer cleared in invoice');
                      setCustomerId("");
                      setSelectedCustomer(null);
                      setAddresses([]);
                      setSelectedBillingAddressId("");
                      setSelectedShippingAddressId("");
                    }
                  }}
                  placeholder="Search customers, distributors, or leads..."
                  label="Customer"
                  required
                />
                
                {selectedCustomer && (
                  <div className={`p-3 bg-${theme.primaryBg} rounded-lg text-sm space-y-1 border border-${theme.primary} border-opacity-20`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {selectedCustomer.type === 'account' ? '📊 CRM Customer' : selectedCustomer.type === 'distributor' ? '🤝 Distributor' : '👤 Lead'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        selectedCustomer.customerType === 'CREDIT' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedCustomer.customerType === 'CREDIT' ? 'Credit Terms' : 'Prepay Required'}
                      </span>
                    </div>
                    {selectedCustomer.email && (
                      <div className="text-gray-600">✉️ {selectedCustomer.email}</div>
                    )}
                    {selectedCustomer.phone && (
                      <div className="text-gray-600">📞 {selectedCustomer.phone}</div>
                    )}
                    {selectedCustomer.address && (
                      <div className="text-gray-600">📍 {selectedCustomer.address}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Address Selection - Only show for accounts */}
            {selectedCustomer?.type === 'account' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building className="h-5 w-5" />
                    <span>Billing & Shipping Addresses</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingAddresses ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-500">Loading addresses...</span>
                    </div>
                  ) : addresses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Billing Address Selection */}
                      <div>
                        <Label htmlFor="billingAddress">Billing Address</Label>
                        <select
                          id="billingAddress"
                          value={selectedBillingAddressId}
                          onChange={(e) => setSelectedBillingAddressId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select billing address...</option>
                          {addresses
                            .filter(addr => addr.type === 'BILLING' || addr.type === 'BOTH')
                            .map(address => (
                              <option key={address.id} value={address.id}>
                                {address.label} - {address.street}, {address.city}
                                {address.isDefault ? ' (Default)' : ''}
                              </option>
                            ))}
                        </select>
                        
                        {/* Display selected billing address details */}
                        {selectedBillingAddressId && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            {(() => {
                              const addr = addresses.find(a => a.id === selectedBillingAddressId);
                              return addr ? (
                                <div>
                                  <div className="font-medium">{addr.label}</div>
                                  <div>{addr.street}</div>
                                  <div>{addr.city}, {addr.region}</div>
                                  <div>{addr.country} {addr.postalCode}</div>
                                  {addr.contactPerson && <div>Contact: {addr.contactPerson}</div>}
                                  {addr.phone && <div>Phone: {addr.phone}</div>}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Shipping Address Selection */}
                      <div>
                        <Label htmlFor="shippingAddress">Shipping Address</Label>
                        <select
                          id="shippingAddress"
                          value={selectedShippingAddressId}
                          onChange={(e) => setSelectedShippingAddressId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select shipping address...</option>
                          {addresses
                            .filter(addr => addr.type === 'SHIPPING' || addr.type === 'BOTH')
                            .map(address => (
                              <option key={address.id} value={address.id}>
                                {address.label} - {address.street}, {address.city}
                                {address.isDefault ? ' (Default)' : ''}
                              </option>
                            ))}
                        </select>
                        
                        {/* Display selected shipping address details */}
                        {selectedShippingAddressId && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            {(() => {
                              const addr = addresses.find(a => a.id === selectedShippingAddressId);
                              return addr ? (
                                <div>
                                  <div className="font-medium">{addr.label}</div>
                                  <div>{addr.street}</div>
                                  <div>{addr.city}, {addr.region}</div>
                                  <div>{addr.country} {addr.postalCode}</div>
                                  {addr.contactPerson && <div>Contact: {addr.contactPerson}</div>}
                                  {addr.phone && <div>Phone: {addr.phone}</div>}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <Building className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>No addresses found for this account.</p>
                      <p className="text-sm">Addresses can be added from the account details page.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Invoice Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Invoice Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Pool Equipment Invoice"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dueDate">Due Date *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="paymentTerms">Payment Terms</Label>
                    <Input
                      id="paymentTerms"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder="e.g., Net 30, Net 60"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Tax Configuration</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addTax}
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Tax
                    </Button>
                  </div>
                  
                  {/* Tax Inclusive Toggle */}
                  <div className="flex items-center space-x-2 mb-3">
                    <input
                      type="checkbox"
                      id="taxInclusive"
                      checked={taxInclusive}
                      onChange={(e) => setTaxInclusive(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="taxInclusive" className="text-sm">
                      Tax Inclusive (hide tax breakdown)
                    </Label>
                  </div>
                  <div className="space-y-2">
                    {globalTaxes.map(tax => (
                      <div key={tax.id} className="flex items-center space-x-2">
                        <Input
                          type="text"
                          value={tax.name}
                          onChange={(e) => {
                            const newTaxes = globalTaxes.map(t => 
                              t.id === tax.id ? { ...t, name: e.target.value } : t
                            );
                            setGlobalTaxes(newTaxes);
                          }}
                          className="flex-1 text-sm"
                          placeholder="Tax Name"
                        />
                        <Input
                          type="number"
                          value={tax.rate}
                          onChange={(e) => updateTaxRate(tax.id, parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-20 text-sm"
                        />
                        <span className="text-sm text-gray-500">%</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeTax(tax.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                          disabled={globalTaxes.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional terms, conditions, or notes..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Products */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Products</span>
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowProductSearch(!showProductSearch)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Product Search */}
                {showProductSearch && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex gap-2 mb-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search products..."
                          value={productSearchTerm}
                          onChange={(e) => setProductSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <BarcodeScanner
                        onScan={handleBarcodeScan}
                        autoLookup={true}
                        title="Scan Product"
                        description="Scan product barcode to add to invoice"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {filteredProducts.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          {productSearchTerm ? (
                            <>
                              <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                              <div>No available products found</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {lines.length > 0 ? "All matching products have been added" : "Try a different search term"}
                              </div>
                            </>
                          ) : (
                            <>
                              <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                              <div>Search for products to add</div>
                            </>
                          )}
                        </div>
                      ) : (
                        filteredProducts.map(product => (
                          <button
                            key={product.id}
                            onClick={() => addLineItem(product)}
                            className="w-full text-left px-3 py-2 hover:bg-white rounded-lg transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <ProductImage product={product} size="sm" />
                                <div>
                                  <div className="font-medium text-sm text-gray-900">{product.name}</div>
                                  <div className="text-xs text-gray-500">{product.sku}</div>
                                </div>
                              </div>
                              <ProductPriceDisplay product={product} />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Line Items */}
                {lines.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    No products added yet. Click "Add Product" above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lines.map((line, index) => (
                      <div key={line.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3 flex-1">
                            <ProductImage product={{ id: line.productId, name: line.productName, sku: line.sku, price: line.unitPrice, images: products.find(p => p.id === line.productId)?.images }} size="md" />
                            <div>
                              <div className="font-medium text-sm text-gray-900">{line.productName}</div>
                              <div className="text-xs text-gray-500">{line.sku}</div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeLineItem(line.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">Qty</Label>
                            <Input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLineItem(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="1"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Price</Label>
                            <Input
                              type="number"
                              value={line.unitPrice}
                              onChange={(e) => updateLineItem(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Disc %</Label>
                            <Input
                              type="number"
                              value={line.discount}
                              onChange={(e) => updateLineItem(line.id, 'discount', parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              step="0.1"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Total</Label>
                            <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-900">
                              GH₵{(() => {
                                const baseAmount = line.quantity * line.unitPrice * (1 - line.discount / 100);
                                if (taxInclusive) {
                                  const totalTaxAmount = line.taxes.reduce((sum, tax) => sum + tax.amount, 0);
                                  return (baseAmount + totalTaxAmount).toFixed(2);
                                } else {
                                  return baseAmount.toFixed(2);
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL - PREVIEW */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card className={`border-2 border-${theme.primary} border-opacity-30 shadow-xl`}>
              <CardHeader className={`bg-gradient-to-r from-${theme.primaryBg} to-${theme.primaryHover} border-b border-${theme.primary} border-opacity-20`}>
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-${theme.primaryText}`}>Invoice Preview</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="ghost">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                {/* Company Header */}
                <div className="text-center mb-8">
                  {customLogo ? (
                    <img 
                      src={customLogo} 
                      alt="Company Logo" 
                      className="h-16 w-auto mx-auto mb-4"
                    />
                  ) : (
                    <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  )}
                  <h2 className="text-2xl font-bold text-gray-900">{subject || 'Untitled Invoice'}</h2>
                  <p className="text-sm text-gray-600">INV-######</p>
                </div>

                {/* Document Info */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">INVOICE</div>
                    <div className="font-semibold">INV-######</div>
                    <div className="text-sm text-gray-600 mt-2">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Due Date</div>
                      <div>{dueDate ? new Date(dueDate).toLocaleDateString() : 'Not set'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</div>
                    <div className="font-semibold">{new Date().toLocaleDateString()}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</div>
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Draft
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bill To</div>
                    <div className="font-semibold">{selectedCustomer?.name || 'No customer'}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      <div>{selectedCustomer?.email || ''}</div>
                      <div>{selectedCustomer?.phone || ''}</div>
                    </div>
                  </div>
                </div>

                {/* Subject */}
                {subject && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase mb-2">Subject</div>
                    <div className="text-sm text-gray-900">{subject}</div>
                  </div>
                )}

                {/* Line Items */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-3">Items</div>
                  {lines.length === 0 ? (
                    <div className="text-sm text-gray-400 italic text-center py-4">
                      No items added
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Table Header */}
                      <div className="bg-gray-50 grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-700 uppercase">
                        <div className="col-span-1">#</div>
                        <div className="col-span-4">Description</div>
                        <div className="col-span-1">Qty</div>
                        <div className="col-span-2">Unit Price</div>
                        {lines.some(line => line.discount > 0) && (
                          <div className="col-span-2">Discount</div>
                        )}
                        <div className="col-span-2">Amount</div>
                      </div>
                      
                      {/* Table Body */}
                      <div className="max-h-48 overflow-y-auto">
                        {lines.map((line, index) => (
                          <div key={line.id} className={`grid grid-cols-12 gap-2 px-3 py-2 text-xs border-b border-gray-100 last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <div className="col-span-1 text-gray-600">{index + 1}</div>
                            <div className="col-span-4">
                              <div className="flex items-center space-x-2">
                                <ProductImage product={{ id: line.productId, name: line.productName, sku: line.sku, price: line.unitPrice, images: products.find(p => p.id === line.productId)?.images }} size="xs" />
                                <div>
                                  <div className="font-medium text-gray-900">{line.productName}</div>
                                  {line.sku && (
                                    <div className="text-xs text-gray-500">SKU: {line.sku}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="col-span-1 text-gray-600">{line.quantity}</div>
                            <div className="col-span-2 text-gray-600">GH₵{line.unitPrice.toFixed(2)}</div>
                            {lines.some(l => l.discount > 0) && (
                              <div className="col-span-2">
                                {line.discount > 0 ? (
                                  <span className="text-green-600 font-medium">{line.discount}%</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </div>
                            )}
                            <div className="col-span-2 font-medium text-gray-900">GH₵{line.lineTotal.toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="border-t pt-4 text-sm">
                  {!taxInclusive && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">GH₵{totals.subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-600">Discount:</span>
                      <span className="font-medium text-green-600">-GH₵{totals.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {/* Individual Taxes - Only show when not tax inclusive */}
                  {!taxInclusive && Object.entries(totals.taxesByType).map(([taxId, amount]) => {
                    const tax = globalTaxes.find(t => t.id === taxId);
                    return (
                      <div key={taxId} className="flex justify-between items-center py-1">
                        <span className="text-gray-600">{tax?.name || 'Tax'} ({tax?.rate}%):</span>
                        <span className="font-medium">GH₵{amount.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  
                  <div className="flex justify-between items-center py-1 text-base font-bold border-t">
                    <span>{taxInclusive ? 'Total (Tax Inclusive):' : 'Total:'}</span>
                    <span className={`text-${theme.primary}`}>GH₵{totals.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Notes */}
                {notes && (
                  <div className="mt-8 pt-6 border-t">
                    <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
