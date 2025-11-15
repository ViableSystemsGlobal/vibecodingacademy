"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShoppingCart,
  Calendar,
  Search,
  Plus,
  Loader2,
  Trash2,
  Eye,
  Edit,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Building,
  User,
  FileText,
  CreditCard,
  Banknote,
  Smartphone,
  ReceiptText,
  CheckSquare,
  Square
} from "lucide-react";
import Link from "next/link";
import { AddOrderModal } from "@/components/modals/add-order-modal";
import { EditOrderModal } from "@/components/modals/edit-order-modal";
import { ConfirmationModal } from "@/components/modals/confirmation-modal";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";

// Define OrderStatus type and values
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'READY_TO_SHIP' | 'COMPLETED';

const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'READY_TO_SHIP', 'COMPLETED'];

interface Order {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentStatus?: string | null;
  amountPaid?: number;
  amountDue?: number;
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

export default function OrdersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { success, error } = useToast();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();

  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [thisMonthOrders, setThisMonthOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [itemsPerPage] = useState(10);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const fetchOrders = useCallback(async (page: number = currentPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', itemsPerPage.toString());
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus) params.append('status', filterStatus);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const response = await fetch(`/api/orders?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.data.orders);
        setTotalOrders(data.data.pagination.total);
        setTotalPages(data.data.pagination.pages);
        setCurrentPage(page);

        // Calculate metrics (fetch all for accurate metrics)
        const allOrdersResponse = await fetch(`/api/orders?limit=9999`, { credentials: 'include' });
        const allOrdersData = await allOrdersResponse.json();
        const allOrders: Order[] = allOrdersData.success ? allOrdersData.data.orders : [];

        let totalValue = 0;
        let pendingCount = 0;
        let monthValue = 0;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        allOrders.forEach(order => {
          totalValue += order.totalAmount;
          if (order.status === 'PENDING') pendingCount++;
          
          const orderDate = new Date(order.createdAt);
          if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
            monthValue += order.totalAmount;
          }
        });

        setTotalValue(totalValue);
        setPendingOrders(pendingCount);
        setThisMonthOrders(monthValue);

      } else {
        throw new Error(data.error || 'Failed to fetch orders');
      }

    } catch (err) {
      console.error('Error fetching orders:', err);
      error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, filterStatus, sortBy, sortOrder, error]);

  // Initial load on mount
  useEffect(() => {
    fetchOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Effect for sorting and filters
  useEffect(() => {
    // Don't run on initial mount (handled above)
    const isInitialMount = currentPage === 1 && !searchTerm && !filterStatus && !sortBy;
    if (isInitialMount) {
      return;
    }
    fetchOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, sortBy, sortOrder]);

  // Debounced search effect (including when cleared)
  const isMountedRef = useRef(false);
  useEffect(() => {
    // Skip initial mount (handled by initial load effect)
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchOrders(1);
    }, searchTerm ? 500 : 0); // No debounce when clearing (empty search)

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Handle sorting change
  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  };
  
  // Handle search change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    fetchOrders(page);
  };
  
  // Handle selection change
  const handleSelectionChange = (selectedIds: string[]) => {
    setSelectedOrders(selectedIds);
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;

    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete order');
      }

      success('Order deleted successfully!');
      fetchOrders();
      setShowDeleteConfirmation(false);
      setSelectedOrder(null);
    } catch (err) {
      console.error('Error deleting order:', err);
      error(err instanceof Error ? err.message : 'Failed to delete order');
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'CONFIRMED': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'PROCESSING': return <Package className="h-4 w-4 text-orange-500" />;
      case 'SHIPPED': return <Truck className="h-4 w-4 text-purple-500" />;
      case 'DELIVERED': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'RETURNED': return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'PROCESSING': return 'bg-orange-100 text-orange-800';
      case 'SHIPPED': return 'bg-purple-100 text-purple-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'RETURNED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCustomerName = (order: Order) => {
    if (order.customerType === 'account' && order.account) {
      return order.account.name;
    } else if (order.customerType === 'contact' && order.contact) {
      return `${order.contact.firstName} ${order.contact.lastName}`;
    } else if (order.distributor) {
      return order.distributor.businessName;
    }
    return 'Unknown Customer';
  };

  const getCustomerLink = (order: Order) => {
    if (order.customerType === 'account' && order.account) {
      return `/crm/accounts/${order.account.id}`;
    } else if (order.customerType === 'contact' && order.contact) {
      return `/crm/contacts/${order.contact.id}`;
    } else if (order.distributor) {
      return `/drm/distributors/${order.distributor.id}`;
    }
    return '#';
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'credit': return <CreditCard className="h-4 w-4" />;
      case 'bank_transfer': return <Building className="h-4 w-4" />;
      case 'mobile_money': return <Smartphone className="h-4 w-4" />;
      default: return <ReceiptText className="h-4 w-4" />;
    }
  };

  const availableStatuses = ORDER_STATUSES;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm font-medium rounded-md text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: getThemeColor() }}
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Create Order
        </button>
      </div>

      {/* AI Card + Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* AI Recommendation Card - Left Side (2/3) */}
        <div className="lg:col-span-2">
          <AIRecommendationCard
            title="Order Management AI"
            subtitle="Your intelligent assistant for order fulfillment"
            page="orders"
            enableAI={true}
            onRecommendationComplete={(id) => {
              console.log('Recommendation completed:', id);
            }}
          />
        </div>

        {/* Metrics Cards - Right Side (1/3, 2x2 Grid) */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className={`text-2xl font-bold text-${theme.primary}`}>{formatCurrency(totalValue, 'GHS')}</p>
              </div>
              <DollarSign className={`h-8 w-8 text-${theme.primary}`} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingOrders}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(thisMonthOrders, 'GHS')}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-400" />
            </div>
          </Card>
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={orders}
            enableSelection={true}
            selectedItems={selectedOrders}
            onSelectionChange={handleSelectionChange}
            onRowClick={(order) => router.push(`/orders/${order.id}`)}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalOrders}
            onPageChange={handlePageChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            searchValue={searchTerm}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search orders by order number or customer..."
            enableExport={true}
            exportFilename="orders"
            isLoading={loading}
            customFilters={
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as OrderStatus | '');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {availableStatuses.map((status: OrderStatus) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            }
            bulkActions={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => success(`Selected ${selectedOrders.length} order(s)`)}
                  disabled={selectedOrders.length === 0}
                >
                  Bulk Actions
                </Button>
              </div>
            }
            columns={[
              {
                key: 'orderNumber',
                label: 'Order #',
                sortable: true,
                render: (order) => (
                  <span className="text-sm font-medium text-gray-900">{order.orderNumber}</span>
                )
              },
              {
                key: 'customer',
                label: 'Customer',
                sortable: true,
                render: (order) => (
                  <div>
                    <Link href={getCustomerLink(order)} className={`text-${theme.primary} hover:underline`}>
                      {getCustomerName(order)}
                    </Link>
                    <p className="text-xs text-gray-400 capitalize">{order.customerType || 'distributor'}</p>
                  </div>
                )
              },
              {
                key: 'status',
                label: 'Status',
                sortable: true,
                render: (order) => (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    <span className="ml-1">{order.status.replace(/_/g, ' ')}</span>
                  </span>
                )
              },
              {
                key: 'totalAmount',
                label: 'Amount',
                sortable: true,
                render: (order) => (
                  <span className="text-sm text-gray-500">{formatCurrency(order.totalAmount, 'GHS')}</span>
                )
              },
              {
                key: 'paymentStatus',
                label: 'Payment',
                sortable: true,
                render: (order) => {
                  const paymentStatus = order.paymentStatus || 'UNPAID';
                  const paymentMethod = order.paymentMethod;
                  const statusColors: Record<string, string> = {
                    'PAID': 'bg-green-100 text-green-800',
                    'PARTIALLY_PAID': 'bg-yellow-100 text-yellow-800',
                    'UNPAID': 'bg-red-100 text-red-800',
                    'PENDING': 'bg-gray-100 text-gray-800',
                  };
                  return (
                    <div className="flex flex-col">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[paymentStatus] || statusColors['UNPAID']}`}>
                        {paymentStatus.replace(/_/g, ' ')}
                      </span>
                      {paymentMethod && (
                        <span className="text-xs text-gray-500 mt-1">{paymentMethod.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                  );
                }
              },
              {
                key: 'amountDue',
                label: 'Outstanding',
                sortable: true,
                render: (order) => {
                  const outstanding = order.amountDue || 0;
                  return (
                    <span className={`text-sm font-medium ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(outstanding, 'GHS')}
                    </span>
                  );
                }
              },
              {
                key: 'items',
                label: 'Items',
                render: (order) => (
                  <span className="text-sm text-gray-500">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </span>
                )
              },
              {
                key: 'createdAt',
                label: 'Created',
                sortable: true,
                render: (order) => (
                  <span className="text-sm text-gray-500">{formatDate(order.createdAt)}</span>
                )
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (order) => (
                  <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/orders/${order.id}`);
                      }}
                      className="text-green-600 hover:text-green-900"
                      title="View order details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                        setShowEditModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit order"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                        setShowDeleteConfirmation(true);
                      }}
                      className="text-red-600 hover:text-red-900"
                      title="Delete order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              }
            ]}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      <AddOrderModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchOrders();
          setShowAddModal(false);
        }}
      />

      {selectedOrder && (
        <EditOrderModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            fetchOrders();
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder as any}
        />
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleDeleteOrder}
        title="Delete Order"
        message={`Are you sure you want to delete order ${selectedOrder?.orderNumber}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}

