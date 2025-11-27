"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/contexts/toast-context";
import {
  ShoppingCart,
  Search,
  Mail,
  User,
  Calendar,
  DollarSign,
  RefreshCw,
  Clock,
  Send,
  Eye,
  Package,
} from "lucide-react";

interface AbandonedCart {
  id: string;
  cartSessionId: string;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  lastActivityAt: string;
  reminderSentAt: string | null;
  reminderCount: number;
  convertedToOrder: boolean;
  convertedOrderId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CartItem {
  id?: string;
  productId: string;
  quantity: number;
  name?: string;
  price?: number;
}

export default function AbandonedCartsClient() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "converted">("active");
  const [hasEmailFilter, setHasEmailFilter] = useState<"all" | "true" | "false">("all");
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { success, error: showError } = useToast();

  const fetchCarts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: page.toString(),
        limit: "20",
      });
      
      if (searchTerm) {
        params.append("search", searchTerm);
      }
      
      if (hasEmailFilter !== "all") {
        params.append("hasEmail", hasEmailFilter);
      }

      const response = await fetch(`/api/ecommerce/abandoned-carts?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setCarts(data.data);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        showError(data.error || "Failed to fetch abandoned carts");
      }
    } catch (error) {
      showError("Failed to fetch abandoned carts");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, hasEmailFilter, page, showError]);

  useEffect(() => {
    fetchCarts();
  }, [fetchCarts]);

  const fetchCartItems = async (cart: AbandonedCart) => {
    setLoadingItems(true);
    try {
      const items = cart.items || [];
      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          try {
            const response = await fetch(`/api/products/${item.productId}`);
            if (response.ok) {
              const product = await response.json();
              return {
                ...item,
                name: product.name || "Unknown Product",
                price: product.price || 0,
              };
            }
          } catch (error) {
            console.error(`Error fetching product ${item.productId}:`, error);
          }
          return {
            ...item,
            name: "Unknown Product",
            price: 0,
          };
        })
      );
      setCartItems(itemsWithDetails);
    } catch (error) {
      console.error("Error fetching cart items:", error);
      setCartItems(cart.items || []);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleViewDetails = async (cart: AbandonedCart) => {
    setSelectedCart(cart);
    setIsDetailsOpen(true);
    await fetchCartItems(cart);
  };

  const handleSendReminder = async (cartId: string) => {
    if (!selectedCart?.customerEmail) {
      showError("No email address available for this cart");
      return;
    }

    setSendingReminder(cartId);
    try {
      const response = await fetch(`/api/ecommerce/abandoned-carts/${cartId}/send-reminder`, {
        method: "POST",
      });
      const data = await response.json();
      
      if (data.success) {
        success("Reminder email sent successfully");
        fetchCarts();
        if (selectedCart?.id === cartId) {
          setSelectedCart({ 
            ...selectedCart, 
            reminderCount: (selectedCart.reminderCount || 0) + 1, 
            reminderSentAt: new Date().toISOString() 
          });
        }
      } else {
        showError(data.error || "Failed to send reminder");
      }
    } catch (error) {
      showError("Failed to send reminder");
    } finally {
      setSendingReminder(null);
    }
  };

  const formatCurrency = (amount: number, currency: string = "GHS") => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Abandoned Carts</h1>
          <p className="text-gray-500 mt-1">View and manage abandoned shopping carts</p>
        </div>
        <Button onClick={fetchCarts} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by email, name, or cart ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPage(1);
                      fetchCarts();
                    }
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "all" | "active" | "converted");
                setPage(1);
              }}
              className="px-4 py-2 border rounded-md"
            >
              <option value="active">Active Only</option>
              <option value="converted">Converted</option>
              <option value="all">All</option>
            </select>
            <select
              value={hasEmailFilter}
              onChange={(e) => {
                setHasEmailFilter(e.target.value as "all" | "true" | "false");
                setPage(1);
              }}
              className="px-4 py-2 border rounded-md"
            >
              <option value="all">All Carts</option>
              <option value="true">With Email</option>
              <option value="false">Without Email</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Carts List */}
      {loading ? (
        <div className="text-center py-12">
          <Clock className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-2 text-gray-500">Loading abandoned carts...</p>
        </div>
      ) : carts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-4 text-gray-500">No abandoned carts found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {carts.map((cart) => (
              <Card key={cart.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="h-5 w-5 text-gray-400" />
                        <span className="font-mono text-sm text-gray-500">
                          {cart.cartSessionId.slice(0, 8)}...
                        </span>
                        <Badge
                          variant={cart.convertedToOrder ? "default" : "secondary"}
                          className={
                            cart.convertedToOrder
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {cart.convertedToOrder ? "Converted" : "Active"}
                        </Badge>
                        {cart.reminderCount > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {cart.reminderCount} reminder{cart.reminderCount > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {cart.customerEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span>{cart.customerEmail}</span>
                          </div>
                        )}
                        {cart.customerName && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span>{cart.customerName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold">
                            {formatCurrency(cart.total, cart.currency)}
                          </span>
                          <span className="text-gray-500">
                            ({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-500">
                            {getTimeAgo(cart.lastActivityAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(cart)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      {!cart.convertedToOrder && cart.customerEmail && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendReminder(cart.id)}
                          disabled={sendingReminder === cart.id}
                        >
                          {sendingReminder === cart.id ? (
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Remind
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Cart Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cart Details</DialogTitle>
            <DialogDescription>
              Cart Session: {selectedCart?.cartSessionId}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCart && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="font-semibold mb-2">Customer Information</h3>
                <div className="space-y-2 text-sm">
                  {selectedCart.customerEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{selectedCart.customerEmail}</span>
                    </div>
                  )}
                  {selectedCart.customerName && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{selectedCart.customerName}</span>
                    </div>
                  )}
                  {!selectedCart.customerEmail && !selectedCart.customerName && (
                    <p className="text-gray-500">Guest customer</p>
                  )}
                </div>
              </div>

              {/* Cart Items */}
              <div>
                <h3 className="font-semibold mb-2">Cart Items</h3>
                {loadingItems ? (
                  <div className="text-center py-4">
                    <Clock className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : cartItems.length > 0 ? (
                  <div className="space-y-2">
                    {cartItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-medium">{item.name || "Unknown Product"}</p>
                            <p className="text-sm text-gray-500">
                              Quantity: {item.quantity}
                            </p>
                          </div>
                        </div>
                        {item.price !== undefined && (
                          <p className="font-semibold">
                            {formatCurrency(item.price * item.quantity, selectedCart.currency)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No items in cart</p>
                )}
              </div>

              {/* Cart Summary */}
              <div className="border-t pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span>{formatCurrency(selectedCart.subtotal, selectedCart.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax:</span>
                    <span>{formatCurrency(selectedCart.tax, selectedCart.currency)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedCart.total, selectedCart.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Cart Metadata */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Metadata</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Last Activity:</span>
                    <span>{formatDate(selectedCart.lastActivityAt)}</span>
                  </div>
                  {selectedCart.reminderSentAt && (
                    <div className="flex justify-between">
                      <span>Last Reminder:</span>
                      <span>{formatDate(selectedCart.reminderSentAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Reminder Count:</span>
                    <span>{selectedCart.reminderCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge
                      variant={selectedCart.convertedToOrder ? "default" : "secondary"}
                      className={
                        selectedCart.convertedToOrder
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {selectedCart.convertedToOrder ? "Converted to Order" : "Abandoned"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t pt-4">
                {!selectedCart.convertedToOrder && selectedCart.customerEmail && (
                  <Button
                    onClick={() => handleSendReminder(selectedCart.id)}
                    disabled={sendingReminder === selectedCart.id}
                    className="flex-1"
                  >
                    {sendingReminder === selectedCart.id ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Reminder Email
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

