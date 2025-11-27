'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, ShoppingCart, Package, DollarSign, Calendar, MapPin, FileText, Building, User, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { formatCurrency, formatDate } from '@/lib/utils';
import { OrderStatus } from '@prisma/client';

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  stockQuantity: number;
}

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: string;
  notes?: string;
  deliveryAddress?: string;
  deliveryDate?: string;
  createdAt: string;
  updatedAt: string;
  distributor: {
    id: string;
    businessName: string;
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

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  order: Order;
}

export function EditOrderModal({
  isOpen,
  onClose,
  onSuccess,
  order,
}: EditOrderModalProps) {
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: order.status,
    paymentMethod: order.paymentMethod,
    notes: order.notes || '',
    deliveryAddress: order.deliveryAddress || '',
    deliveryDate: order.deliveryDate ? formatDate(order.deliveryDate, 'YYYY-MM-DDTHH:MM') : '',
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        status: order.status,
        paymentMethod: order.paymentMethod,
        notes: order.notes || '',
        deliveryAddress: order.deliveryAddress || '',
        deliveryDate: order.deliveryDate ? formatDate(order.deliveryDate, 'YYYY-MM-DDTHH:MM') : '',
      });
    }
  }, [isOpen, order]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          deliveryDate: formData.deliveryDate ? new Date(formData.deliveryDate).toISOString() : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update order');
      }

      success('Order updated successfully!');
      onSuccess();
    } catch (err) {
      console.error('Error updating order:', err);
      error(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const availableStatuses = Object.values(OrderStatus);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Edit Order - {order.orderNumber}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Order Information (Read-only) */}
          <div className="bg-gray-50 border rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Order Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Order Number:</span>
                <p className="text-gray-900">{order.orderNumber}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Distributor:</span>
                <p className="text-gray-900">
                  {order.distributor?.businessName || "—"}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Total Amount:</span>
                <p className="text-gray-900">{formatCurrency(order.totalAmount)}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Created:</span>
                <p className="text-gray-900">{formatDate(order.createdAt)}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Created By:</span>
                <p className="text-gray-900">{order.createdByUser.name}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Items:</span>
                <p className="text-gray-900">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="status">Status *</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as OrderStatus)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                required
              >
                {availableStatuses.map(status => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <select
                id="paymentMethod"
                value={formData.paymentMethod}
                onChange={(e) => handleChange('paymentMethod', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:border-transparent`}
                required
              >
                <option value="credit">Credit</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="deliveryAddress">Delivery Address</Label>
            <Textarea
              id="deliveryAddress"
              value={formData.deliveryAddress}
              onChange={(e) => handleChange('deliveryAddress', e.target.value)}
              rows={3}
              placeholder="Enter delivery address..."
              className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
            />
          </div>

          <div>
            <Label htmlFor="deliveryDate">Delivery Date</Label>
            <Input
              id="deliveryDate"
              type="datetime-local"
              value={formData.deliveryDate}
              onChange={(e) => handleChange('deliveryDate', e.target.value)}
              className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              placeholder="Any additional notes for this order..."
              className={`focus:ring-${theme.primary} focus:border-${theme.primary}`}
            />
          </div>

          {/* Order Items (Read-only) */}
          <div>
            <h3 className="text-lg font-medium mb-4">Order Items</h3>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <span className="font-medium text-gray-700">Product:</span>
                      <p className="text-gray-900">{item.product.name}</p>
                      <p className="text-sm text-gray-500">SKU: {item.product.sku}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Quantity:</span>
                      <p className="text-gray-900">{item.quantity}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Unit Price:</span>
                      <p className="text-gray-900">{formatCurrency(item.unitPrice)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Total:</span>
                      <p className="text-gray-900 font-medium">{formatCurrency(item.totalPrice)}</p>
                    </div>
                  </div>
                  {item.notes && (
                    <div className="mt-2">
                      <span className="font-medium text-gray-700">Notes:</span>
                      <p className="text-gray-900 text-sm">{item.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-md text-white hover:opacity-90 transition-opacity bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
