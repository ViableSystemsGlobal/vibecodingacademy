"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { 
  Store,
  CreditCard,
  ShoppingCart,
  Users,
  Eye,
  Mail,
  FileText,
  Save,
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle,
  Globe,
  Package,
  Bell,
  Info
} from "lucide-react";

interface EcommerceSettings {
  // Store Configuration
  storeName: string;
  storeDescription: string;
  storeTagline: string;
  storeStatus: string;
  storeEmail: string;
  storePhone: string;
  
  // Checkout & Payment
  paymentMethods: string;
  minimumOrderAmount: number;
  freeShippingThreshold: number;
  taxRate: number;
  currency: string;
  
  // Order Management
  autoConfirmOrders: boolean;
  defaultOrderStatus: string;
  inventoryReservationDuration: number;
  lowStockThreshold: number;
  orderNumberPrefix: string;
  
  // Customer Settings
  requireAccountCreation: boolean;
  allowGuestCheckout: boolean;
  requireEmailVerification: boolean;
  
  // Storefront Display
  productsPerPage: number;
  defaultSorting: string;
  showOutOfStock: boolean;
  
  // Email Notifications
  sendOrderConfirmation: boolean;
  sendShippingNotifications: boolean;
  sendOrderStatusUpdates: boolean;
  sendAbandonedCartReminders: boolean;
  abandonedCartDelayHours: number;
  
  // Legal & Policies
  termsAndConditionsUrl: string;
  privacyPolicyUrl: string;
  returnPolicyUrl: string;
  cookieConsentEnabled: boolean;
  
  // Paystack Configuration
  paystackPublicKey: string;
  paystackSecretKey: string;
  paystackMode: string;
}

export default function EcommerceSettingsPage() {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const themeColor = getThemeColor();
  const [settings, setSettings] = useState<EcommerceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("store");

  // Form state
  const [formData, setFormData] = useState<Partial<EcommerceSettings>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/ecommerce/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setFormData(data);
      } else {
        showError("Failed to load settings", "Please try again");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      showError("Failed to load settings", "Please try again");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/ecommerce/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        success("Settings saved successfully", "Your ecommerce settings have been updated");
        await fetchSettings(); // Refresh to get latest values
      } else {
        const errorData = await response.json();
        showError("Failed to save settings", errorData.error || "Please try again");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      showError("Failed to save settings", "Please try again");
    } finally {
      setIsSaving(false);
    }
  };

  const updateFormData = (key: keyof EcommerceSettings, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const sections = [
    { id: "store", label: "Store Configuration", icon: Store },
    { id: "checkout", label: "Checkout & Payment", icon: CreditCard },
    { id: "paystack", label: "Paystack Integration", icon: CreditCard },
    { id: "orders", label: "Order Management", icon: ShoppingCart },
    { id: "customers", label: "Customer Settings", icon: Users },
    { id: "display", label: "Storefront Display", icon: Eye },
    { id: "notifications", label: "Email Notifications", icon: Mail },
    { id: "legal", label: "Legal & Policies", icon: FileText },
  ];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ecommerce Settings</h1>
            <p className="text-gray-600 mt-2">Configure your online store settings and preferences</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            style={{ backgroundColor: themeColor }}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save All Settings
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Settings Sections</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1 p-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                        activeSection === section.id
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                      style={
                        activeSection === section.id
                          ? { backgroundColor: `${themeColor}15`, color: themeColor }
                          : undefined
                      }
                    >
                      <Icon className="h-5 w-5" />
                      <span>{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Store Configuration */}
          {activeSection === "store" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Store Configuration
                </CardTitle>
                <CardDescription>
                  Basic information about your online store
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="storeName">Store Name *</Label>
                  <Input
                    id="storeName"
                    value={formData.storeName || ""}
                    onChange={(e) => updateFormData("storeName", e.target.value)}
                    placeholder="My Online Store"
                  />
                </div>

                <div>
                  <Label htmlFor="storeTagline">Store Tagline</Label>
                  <Input
                    id="storeTagline"
                    value={formData.storeTagline || ""}
                    onChange={(e) => updateFormData("storeTagline", e.target.value)}
                    placeholder="Your tagline here"
                  />
                </div>

                <div>
                  <Label htmlFor="storeDescription">Store Description</Label>
                  <textarea
                    id="storeDescription"
                    value={formData.storeDescription || ""}
                    onChange={(e) => updateFormData("storeDescription", e.target.value)}
                    placeholder="Describe your store..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  />
                </div>

                <div>
                  <Label htmlFor="storeStatus">Store Status</Label>
                  <select
                    id="storeStatus"
                    value={formData.storeStatus || "active"}
                    onChange={(e) => updateFormData("storeStatus", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance Mode</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    When in maintenance mode, customers will see a maintenance message
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="storeEmail">Store Email</Label>
                    <Input
                      id="storeEmail"
                      type="email"
                      value={formData.storeEmail || ""}
                      onChange={(e) => updateFormData("storeEmail", e.target.value)}
                      placeholder="store@example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="storePhone">Store Phone</Label>
                    <Input
                      id="storePhone"
                      type="tel"
                      value={formData.storePhone || ""}
                      onChange={(e) => updateFormData("storePhone", e.target.value)}
                      placeholder="+233 XX XXX XXXX"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checkout & Payment */}
          {activeSection === "checkout" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Checkout & Payment
                </CardTitle>
                <CardDescription>
                  Configure payment methods and checkout settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="paymentMethods">Enabled Payment Methods</Label>
                  <Input
                    id="paymentMethods"
                    value={formData.paymentMethods || ""}
                    onChange={(e) => updateFormData("paymentMethods", e.target.value)}
                    placeholder="ONLINE,CASH,BANK_TRANSFER,MOBILE_MONEY"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Comma-separated list: ONLINE, CASH, BANK_TRANSFER, MOBILE_MONEY
                  </p>
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Used in: Checkout page payment options
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minimumOrderAmount">Minimum Order Amount (GHS)</Label>
                  <Input
                    id="minimumOrderAmount"
                    type="number"
                    step="0.01"
                    value={formData.minimumOrderAmount || 0}
                    onChange={(e) => updateFormData("minimumOrderAmount", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Validated during checkout
                  </p>
                </div>

                  <div>
                    <Label htmlFor="freeShippingThreshold">Free Shipping Threshold (GHS)</Label>
                    <Input
                      id="freeShippingThreshold"
                      type="number"
                      step="0.01"
                      value={formData.freeShippingThreshold || 0}
                      onChange={(e) => updateFormData("freeShippingThreshold", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="taxRate">Tax/VAT Rate (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      step="0.1"
                      value={formData.taxRate || 0}
                      onChange={(e) => updateFormData("taxRate", parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Used in: Cart & Checkout calculations
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={formData.currency || "GHS"}
                      onChange={(e) => updateFormData("currency", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Management */}
          {activeSection === "orders" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order Management
                </CardTitle>
                <CardDescription>
                  Configure how orders are processed and managed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Confirm Orders</Label>
                    <p className="text-sm text-gray-500">Automatically confirm orders when payment is received</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoConfirmOrders || false}
                    onChange={(e) => updateFormData("autoConfirmOrders", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>

                <div>
                  <Label htmlFor="defaultOrderStatus">Default Order Status</Label>
                  <select
                    id="defaultOrderStatus"
                    value={formData.defaultOrderStatus || "PROCESSING"}
                    onChange={(e) => updateFormData("defaultOrderStatus", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="SHIPPED">Shipped</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="inventoryReservationDuration">Inventory Reservation (hours)</Label>
                    <Input
                      id="inventoryReservationDuration"
                      type="number"
                      value={formData.inventoryReservationDuration || 24}
                      onChange={(e) => updateFormData("inventoryReservationDuration", parseInt(e.target.value) || 24)}
                    />
                    <p className="text-sm text-gray-500 mt-1">How long to reserve inventory for unpaid orders</p>
                  </div>

                  <div>
                    <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      value={formData.lowStockThreshold || 5}
                      onChange={(e) => updateFormData("lowStockThreshold", parseInt(e.target.value) || 5)}
                    />
                    <p className="text-sm text-gray-500 mt-1">Alert when stock falls below this number</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="orderNumberPrefix">Order Number Prefix</Label>
                  <Input
                    id="orderNumberPrefix"
                    value={formData.orderNumberPrefix || "ORD"}
                    onChange={(e) => updateFormData("orderNumberPrefix", e.target.value)}
                    placeholder="ORD"
                  />
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Used in: Ecommerce order number generation
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Settings */}
          {activeSection === "customers" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Customer Settings
                </CardTitle>
                <CardDescription>
                  Configure customer account and checkout requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Account Creation</Label>
                    <p className="text-sm text-gray-500">Force customers to create an account before checkout</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.requireAccountCreation || false}
                    onChange={(e) => updateFormData("requireAccountCreation", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Guest Checkout</Label>
                    <p className="text-sm text-gray-500">Allow customers to checkout without creating an account</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.allowGuestCheckout !== false}
                    onChange={(e) => updateFormData("allowGuestCheckout", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Email Verification</Label>
                    <p className="text-sm text-gray-500">Require customers to verify their email address</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.requireEmailVerification || false}
                    onChange={(e) => updateFormData("requireEmailVerification", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Storefront Display */}
          {activeSection === "display" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Storefront Display
                </CardTitle>
                <CardDescription>
                  Configure how products are displayed to customers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="productsPerPage">Products Per Page</Label>
                  <Input
                    id="productsPerPage"
                    type="number"
                    value={formData.productsPerPage || 12}
                    onChange={(e) => updateFormData("productsPerPage", parseInt(e.target.value) || 12)}
                  />
                </div>

                <div>
                  <Label htmlFor="defaultSorting">Default Product Sorting</Label>
                  <select
                    id="defaultSorting"
                    value={formData.defaultSorting || "newest"}
                    onChange={(e) => updateFormData("defaultSorting", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="newest">Newest First</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="name">Name: A to Z</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Out of Stock Products</Label>
                    <p className="text-sm text-gray-500">Display products that are currently out of stock</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.showOutOfStock !== false}
                    onChange={(e) => updateFormData("showOutOfStock", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Email Notifications */}
          {activeSection === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Notifications
                </CardTitle>
                <CardDescription>
                  Configure which emails are sent to customers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Send Order Confirmation</Label>
                    <p className="text-sm text-gray-500">Send email when order is placed</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.sendOrderConfirmation !== false}
                    onChange={(e) => updateFormData("sendOrderConfirmation", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Send Shipping Notifications</Label>
                    <p className="text-sm text-gray-500">Notify customers when order is shipped</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.sendShippingNotifications !== false}
                    onChange={(e) => updateFormData("sendShippingNotifications", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Send Order Status Updates</Label>
                    <p className="text-sm text-gray-500">Notify customers when order status changes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.sendOrderStatusUpdates !== false}
                    onChange={(e) => updateFormData("sendOrderStatusUpdates", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Send Abandoned Cart Reminders</Label>
                    <p className="text-sm text-gray-500">Send reminders for abandoned shopping carts</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.sendAbandonedCartReminders || false}
                    onChange={(e) => updateFormData("sendAbandonedCartReminders", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>

                {formData.sendAbandonedCartReminders && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label>Reminder Delay (Hours)</Label>
                      <p className="text-sm text-gray-500">
                        How many hours after cart abandonment before sending reminder (default: 24 hours)
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      max="168"
                      value={formData.abandonedCartDelayHours ?? 24}
                      onChange={(e) => updateFormData("abandonedCartDelayHours", parseInt(e.target.value) || 24)}
                      className="w-24"
                    />
                  </div>
                )}

                {formData.sendAbandonedCartReminders && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Cron Job Setup Required</p>
                        <p className="text-sm text-blue-700 mt-1">
                          To send abandoned cart reminders, you need to set up a cron job that calls:
                        </p>
                        <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-2 block">
                          POST /api/ecommerce/abandoned-carts/remind
                        </code>
                        <p className="text-sm text-blue-700 mt-2">
                          Recommended schedule: Every 6-12 hours
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Paystack Integration */}
          {activeSection === "paystack" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Paystack Integration
                </CardTitle>
                <CardDescription>
                  Configure your Paystack API keys for payment processing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Indicator */}
                {(formData.paystackPublicKey || formData.paystackSecretKey) && (
                  <div className={`border rounded-lg p-4 ${
                    formData.paystackPublicKey && formData.paystackSecretKey
                      ? "bg-green-50 border-green-200"
                      : "bg-yellow-50 border-yellow-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      {formData.paystackPublicKey && formData.paystackSecretKey ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium text-green-900">Paystack Configured</p>
                            <p className="text-sm text-green-700">
                              {formData.paystackMode === "test" ? "Test mode" : "Live mode"} - Ready to process payments
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                          <div>
                            <p className="font-medium text-yellow-900">Incomplete Configuration</p>
                            <p className="text-sm text-yellow-700">
                              {!formData.paystackPublicKey && !formData.paystackSecretKey
                                ? "Please add both Public and Secret keys"
                                : !formData.paystackPublicKey
                                ? "Please add your Public Key"
                                : "Please add your Secret Key"}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Security Note</p>
                      <p>Your secret key is stored securely in the database. Never share it publicly. Keys from environment variables will be used as fallback if not set here.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="paystackMode">Paystack Mode</Label>
                  <select
                    id="paystackMode"
                    value={formData.paystackMode || "live"}
                    onChange={(e) => updateFormData("paystackMode", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="test">Test Mode</option>
                    <option value="live">Live Mode</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Use test mode for development, live mode for production
                  </p>
                </div>

                <div>
                  <Label htmlFor="paystackPublicKey">Paystack Public Key</Label>
                  <Input
                    id="paystackPublicKey"
                    type="text"
                    value={formData.paystackPublicKey || ""}
                    onChange={(e) => updateFormData("paystackPublicKey", e.target.value)}
                    placeholder="pk_test_... or pk_live_..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Your Paystack public key (starts with pk_test_ or pk_live_)
                  </p>
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Used in: Payment initialization (frontend)
                  </p>
                </div>

                <div>
                  <Label htmlFor="paystackSecretKey">Paystack Secret Key</Label>
                  <Input
                    id="paystackSecretKey"
                    type="password"
                    value={formData.paystackSecretKey || ""}
                    onChange={(e) => updateFormData("paystackSecretKey", e.target.value)}
                    placeholder="sk_test_... or sk_live_..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Your Paystack secret key (starts with sk_test_ or sk_live_)
                  </p>
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Used in: Payment verification, webhook processing (backend only)
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Where to find your keys:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                    <li>Log in to your Paystack Dashboard</li>
                    <li>Go to Settings → API Keys & Webhooks</li>
                    <li>Copy your Public Key and Secret Key</li>
                    <li>Make sure to use test keys for test mode and live keys for live mode</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legal & Policies */}
          {activeSection === "legal" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Legal & Policies
                </CardTitle>
                <CardDescription>
                  Configure legal pages and policy URLs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="termsAndConditionsUrl">Terms & Conditions URL</Label>
                  <Input
                    id="termsAndConditionsUrl"
                    type="url"
                    value={formData.termsAndConditionsUrl || ""}
                    onChange={(e) => updateFormData("termsAndConditionsUrl", e.target.value)}
                    placeholder="https://example.com/terms"
                  />
                </div>

                <div>
                  <Label htmlFor="privacyPolicyUrl">Privacy Policy URL</Label>
                  <Input
                    id="privacyPolicyUrl"
                    type="url"
                    value={formData.privacyPolicyUrl || ""}
                    onChange={(e) => updateFormData("privacyPolicyUrl", e.target.value)}
                    placeholder="https://example.com/privacy"
                  />
                </div>

                <div>
                  <Label htmlFor="returnPolicyUrl">Return Policy URL</Label>
                  <Input
                    id="returnPolicyUrl"
                    type="url"
                    value={formData.returnPolicyUrl || ""}
                    onChange={(e) => updateFormData("returnPolicyUrl", e.target.value)}
                    placeholder="https://example.com/returns"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Cookie Consent</Label>
                    <p className="text-sm text-gray-500">Show cookie consent banner to customers</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.cookieConsentEnabled !== false}
                    onChange={(e) => updateFormData("cookieConsentEnabled", e.target.checked)}
                    className="h-5 w-5"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

