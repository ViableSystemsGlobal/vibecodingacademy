"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Edit, 
  Download, 
  Mail, 
  Calendar, 
  DollarSign, 
  FileText,
  User,
  Phone,
  Mail as MailIcon,
  MapPin,
  Plus,
  Send,
  CreditCard,
  Receipt,
  Paperclip,
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import SendCustomerEmailModal from "@/components/modals/send-customer-email-modal";

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  customerType?: string;
  notes?: string;
  deliveryAddress?: string;
  deliveryDate?: string;
  createdAt: string;
  updatedAt: string;
  distributor?: {
    id: string;
    businessName: string;
    email?: string;
    phone?: string;
  };
  account?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    product: {
      id: string;
      name: string;
      sku: string;
    };
  }>;
  createdByUser: {
    id: string;
    name: string;
  };
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { getThemeClasses, getThemeColor } = useTheme();
  const { success, error: showError } = useToast();
  const theme = getThemeClasses();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const orderId = params.id as string;

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      console.log('Loading order with ID:', orderId);
      
      const response = await fetch(`/api/orders/${orderId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorData: any = {};
        const contentType = response.headers.get('content-type');
        
        try {
          // Read response body once
          if (contentType && contentType.includes('application/json')) {
            try {
              errorData = await response.json();
              console.log('Parsed JSON error:', errorData);
            } catch (jsonError) {
              console.error('Failed to parse JSON:', jsonError);
              // If JSON parsing fails, try to read as text
              const text = await response.text();
              console.error('Response as text:', text);
              errorData = { error: text || response.statusText || 'Failed to parse error response' };
            }
          } else {
            // If not JSON, read as text
            const text = await response.text();
            console.error('Non-JSON error response:', text);
            errorData = { error: text || response.statusText || 'Unknown error' };
          }
        } catch (e) {
          console.error('Error reading error response:', e);
          errorData = { 
            error: response.statusText || 'Unknown error',
            status: response.status,
            statusText: response.statusText
          };
        }
        
        console.error('API Error Response Details:', {
          status: response.status,
          statusText: response.statusText,
          contentType,
          url: response.url,
          errorData,
          errorDataKeys: errorData ? Object.keys(errorData) : [],
          errorDataString: JSON.stringify(errorData)
        });
        
        // Build error message from available data
        const errorMessage = errorData?.error || 
                            errorData?.details || 
                            errorData?.message ||
                            (response.status === 404 ? 'Order not found' : 
                             response.status === 401 ? 'Unauthorized' :
                             response.status === 500 ? 'Server error' :
                             `Failed to fetch order: ${response.status} ${response.statusText || 'Unknown error'}`);
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Order data received:', data);
      
      if (data.success) {
        setOrder(data.data);
      } else {
        throw new Error(data.error || 'Failed to load order');
      }
    } catch (err) {
      console.error('Error loading order:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load order';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;

    try {
      const updateData: any = {
        status: newStatus
      };

      // Only include paymentMethod if it exists (for Order model, not SalesOrder)
      if (order.paymentMethod) {
        updateData.paymentMethod = order.paymentMethod;
      }

      // Include optional fields if they exist
      if (order.notes !== undefined) {
        updateData.notes = order.notes;
      }
      if (order.deliveryAddress !== undefined) {
        updateData.deliveryAddress = order.deliveryAddress;
      }
      if (order.deliveryDate !== undefined) {
        updateData.deliveryDate = order.deliveryDate;
      }

      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const data = await response.json();
        success("Status Updated", `Order ${order.orderNumber} status updated to ${newStatus}`);
        // Update local state with the response data
        if (data.success && data.data) {
          setOrder(data.data);
        } else {
          loadOrder(); // Reload order to get updated data
        }
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to update status");
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showError("Failed to update status");
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      PROCESSING: 'bg-purple-100 text-purple-800',
      SHIPPED: 'bg-indigo-100 text-indigo-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      RETURNED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'CONFIRMED':
        return <CheckCircle className="h-4 w-4" />;
      case 'PROCESSING':
        return <Package className="h-4 w-4" />;
      case 'SHIPPED':
        return <Truck className="h-4 w-4" />;
      case 'DELIVERED':
        return <CheckCircle className="h-4 w-4" />;
      case 'CANCELLED':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'CASH':
        return <DollarSign className="h-4 w-4" />;
      case 'BANK_TRANSFER':
      case 'BANKTRANSFER':
        return <CreditCard className="h-4 w-4" />;
      case 'MOBILE_MONEY':
      case 'MOBILEMONEY':
        return <Phone className="h-4 w-4" />;
      case 'CARD':
        return <CreditCard className="h-4 w-4" />;
      case 'CHECK':
        return <FileText className="h-4 w-4" />;
      case 'CREDIT':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      'CASH': 'Cash',
      'BANK_TRANSFER': 'Bank Transfer',
      'BANKTRANSFER': 'Bank Transfer',
      'MOBILE_MONEY': 'Mobile Money',
      'MOBILEMONEY': 'Mobile Money',
      'CHECK': 'Check',
      'CARD': 'Card',
      'CREDIT': 'Credit',
      'OTHER': 'Other'
    };
    return methods[method?.toUpperCase()] || method || 'Credit';
  };

  const getCustomerName = () => {
    if (order?.account) {
      return order.account.name;
    }
    if (order?.distributor) {
      return order.distributor.businessName;
    }
    if (order?.contact) {
      return `${order.contact.firstName} ${order.contact.lastName}`;
    }
    return 'Unknown';
  };

  const getCustomerEmail = () => {
    if (order?.account) {
      return order.account.email;
    }
    if (order?.distributor) {
      return order.distributor.email;
    }
    if (order?.contact) {
      return order.contact.email;
    }
    return null;
  };

  const getCustomerPhone = () => {
    if (order?.account) {
      return order.account.phone;
    }
    if (order?.distributor) {
      return order.distributor.phone;
    }
    if (order?.contact) {
      return order.contact.phone;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-xl font-medium">Order not found</p>
          <Button
            onClick={() => router.push('/orders')}
            className="mt-4"
            style={{ backgroundColor: getThemeColor() }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/orders')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order {order.orderNumber}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Created on {formatDate(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/orders?edit=${order.id}`)}
            style={{ borderColor: getThemeColor() }}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`mb-6 p-4 rounded-lg ${getStatusColor(order.status)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-2 focus:outline-none hover:opacity-80 transition-opacity cursor-pointer">
                  {getStatusIcon(order.status)}
                  <span className="font-medium">{order.status.replace(/_/g, ' ')}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleStatusUpdate('PENDING')}>
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('CONFIRMED')}>
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  Confirmed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('PROCESSING')}>
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  Processing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('SHIPPED')}>
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                  Shipped
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('DELIVERED')}>
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Delivered
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('CANCELLED')}>
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                  Cancelled
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('RETURNED')}>
                  <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                  Returned
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ backgroundColor: getThemeColor() || '#2563eb', color: 'white' }}>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase">SKU</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase">Quantity</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.product.name}</div>
                          {item.notes && (
                            <div className="text-sm text-gray-500">{item.notes}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.product.sku}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          {formatCurrency(item.unitPrice, 'GHS')}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(item.totalPrice, 'GHS')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td colSpan={4} className="px-4 py-3 text-right">Total</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(order.totalAmount, 'GHS')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Information */}
          {order.deliveryAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Delivery Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium">Delivery Address</p>
                      <p className="text-sm text-gray-600">{order.deliveryAddress}</p>
                    </div>
                  </div>
                  {order.deliveryDate && (
                    <div className="flex items-start space-x-2">
                      <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium">Delivery Date</p>
                        <p className="text-sm text-gray-600">{formatDate(order.deliveryDate)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Customer</p>
                  <p className="text-base font-semibold text-gray-900">{getCustomerName()}</p>
                  <p className="text-xs text-gray-400 capitalize mt-1">{order.customerType || 'distributor'}</p>
                </div>
                {getCustomerEmail() && (
                  <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MailIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{getCustomerEmail()}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEmailModalOpen(true)}
                      className="text-xs"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Email
                    </Button>
                  </div>
                )}
                {getCustomerPhone() && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a href={`tel:${getCustomerPhone()}`} className="text-sm text-blue-600 hover:underline">
                      {getCustomerPhone()}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Order Number</span>
                  <span className="text-sm font-medium text-gray-900">{order.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="focus:outline-none">
                        <span className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleStatusUpdate('PENDING')}>
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                        Pending
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusUpdate('CONFIRMED')}>
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Confirmed
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusUpdate('PROCESSING')}>
                        <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                        Processing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusUpdate('SHIPPED')}>
                        <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                        Shipped
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusUpdate('DELIVERED')}>
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        Delivered
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusUpdate('CANCELLED')}>
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                        Cancelled
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusUpdate('RETURNED')}>
                        <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                        Returned
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Payment Method</span>
                  <div className="flex items-center space-x-1">
                    {getPaymentMethodIcon(order.paymentMethod)}
                    <span className="text-sm font-medium text-gray-900">
                      {getPaymentMethodLabel(order.paymentMethod)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Amount</span>
                  <span className="text-lg font-bold" style={{ color: getThemeColor() }}>
                    {formatCurrency(order.totalAmount, 'GHS')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Created By</span>
                  <span className="text-sm font-medium text-gray-900">{order.createdByUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Created On</span>
                  <span className="text-sm text-gray-900">{formatDate(order.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Modal */}
      {getCustomerEmail() && (
        <SendCustomerEmailModal
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          customerName={getCustomerName()}
          emailAddress={getCustomerEmail() || ''}
        />
      )}
    </div>
  );
}

