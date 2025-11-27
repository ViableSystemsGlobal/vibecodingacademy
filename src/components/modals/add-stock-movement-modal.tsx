"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { 
  X, 
  Package, 
  TrendingUp, 
  TrendingDown,
  RotateCcw,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  FileText,
  Search
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  uomBase: string;
  stockItems?: {
    id: string;
    quantity: number;
    available: number;
    warehouse: {
      id: string;
      name: string;
      code: string;
    };
  }[];
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface AddStockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface MovementType {
  value: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

export function AddStockMovementModal({ isOpen, onClose, onSuccess }: AddStockMovementModalProps) {
  const [formData, setFormData] = useState({
    productId: "",
    type: "RECEIPT",
    quantity: 0,
    unitCost: 0,
    reference: "",
    reason: "",
    notes: "",
    warehouseId: "",
    supplierId: "",
    transferDirection: "OUT" as "IN" | "OUT",
    transferFromWarehouse: "",
    transferToWarehouse: "",
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [grnFile, setGrnFile] = useState<File | null>(null);
  const [poFile, setPoFile] = useState<File | null>(null);
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const themeColor = getThemeColor();
  const { success, error: showError } = useToast();

  const handleGrnFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setGrnFile(file);
    }
  };

  const handlePoFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPoFile(file);
    }
  };

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      fetchWarehouses();
      fetchSuppliers();
    }
  }, [isOpen]);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers?limit=1000');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]); // Set to empty array on error
    }
  };

  // Filter products based on search
  useEffect(() => {
    if (productSearch.length > 0) {
      setShowProductDropdown(true);
    } else {
      setShowProductDropdown(false);
    }
  }, [productSearch]);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses');
      if (response.ok) {
        const data = await response.json();
        setWarehouses(data.warehouses || []);
        // Set default warehouse if available
        if (data.warehouses && data.warehouses.length > 0 && !formData.warehouseId) {
          setFormData(prev => ({ ...prev, warehouseId: data.warehouses[0].id }));
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const handleBarcodeScan = (barcode: string, product: any) => {
    if (product) {
      // Product found - auto-fill form
      setSelectedProduct(product);
      setProductSearch(product.name);
      setFormData(prev => ({
        ...prev,
        productId: product.id,
        // Auto-select warehouse if product has stock in a specific warehouse
        warehouseId: product.stockItems?.[0]?.warehouseId || prev.warehouseId
      }));
      setShowProductDropdown(false);
      success(`✓ Product selected: ${product.name}`);
    } else {
      // Product not found
      showError(`Barcode not found in system: ${barcode}`);
    }
  };

  const movementTypes: MovementType[] = [
    {
      value: "RECEIPT",
      label: "Receipt",
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-green-600",
      description: "Stock received from supplier"
    },
    {
      value: "ADJUSTMENT",
      label: "Adjustment",
      icon: <RotateCcw className="h-4 w-4" />,
      color: "text-blue-600",
      description: "Manual stock adjustment"
    },
    {
      value: "TRANSFER",
      label: "Transfer",
      icon: <ArrowRightLeft className="h-4 w-4" />,
      color: "text-purple-600",
      description: "Stock transferred between warehouses"
    },
    {
      value: "SALE",
      label: "Sale",
      icon: <TrendingDown className="h-4 w-4" />,
      color: "text-emerald-600",
      description: "Stock sold to customer"
    },
    {
      value: "RETURN",
      label: "Return",
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-cyan-600",
      description: "Stock returned from customer"
    },
    {
      value: "DAMAGE",
      label: "Damage",
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "text-red-600",
      description: "Stock damaged or lost"
    },
    {
      value: "THEFT",
      label: "Theft",
      icon: <XCircle className="h-4 w-4" />,
      color: "text-red-700",
      description: "Stock stolen"
    },
    {
      value: "EXPIRY",
      label: "Expiry",
      icon: <Calendar className="h-4 w-4" />,
      color: "text-yellow-600",
      description: "Stock expired"
    },
    {
      value: "OTHER",
      label: "Other",
      icon: <FileText className="h-4 w-4" />,
      color: "text-gray-600",
      description: "Other reasons"
    }
  ];

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Helper function to get total available stock for a product
  const getTotalAvailableStock = (product: Product) => {
    return product.stockItems?.reduce((sum, item) => sum + item.available, 0) || 0;
  };

  // Helper function to get stock for a specific warehouse
  const getWarehouseStock = (product: Product | null, warehouseId: string) => {
    if (!product || !warehouseId) return { available: 0, quantity: 0 };
    const stockItem = product.stockItems?.find(item => item.warehouse.id === warehouseId);
    return {
      available: stockItem?.available || 0,
      quantity: stockItem?.quantity || 0
    };
  };

  // Helper function to get all warehouses with stock for a product
  const getWarehousesWithStock = (product: Product | null) => {
    if (!product || !product.stockItems) return [];
    return product.stockItems
      .filter(item => item.available > 0)
      .map(item => ({
        warehouse: item.warehouse,
        available: item.available,
        quantity: item.quantity
      }))
      .sort((a, b) => b.available - a.available); // Sort by available stock descending
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setFormData(prev => ({ ...prev, productId: product.id }));
    setProductSearch(`${product.name} (${product.sku})`);
    setShowProductDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validation
    if (!formData.productId) {
      showError("Validation Error", "Please select a product");
      setIsSubmitting(false);
      return;
    }

    if (formData.quantity === 0) {
      showError("Validation Error", "Quantity cannot be zero");
      setIsSubmitting(false);
      return;
    }

    if (!formData.warehouseId) {
      showError("Validation Error", "Please select a warehouse");
      setIsSubmitting(false);
      return;
    }

    // GRN is required for RECEIPT type movements
    if (formData.type === 'RECEIPT' && !grnFile) {
      showError("Validation Error", "GRN Document is required for stock receipts");
      setIsSubmitting(false);
      return;
    }

    // Validate transfer fields for TRANSFER type
    if (formData.type === "TRANSFER") {
      if (formData.transferDirection === "OUT" && !formData.transferToWarehouse) {
        showError("Validation Error", "Please select a destination warehouse for transfer out");
        setIsSubmitting(false);
        return;
      }
      if (formData.transferDirection === "IN" && !formData.transferFromWarehouse) {
        showError("Validation Error", "Please select a source warehouse for transfer in");
        setIsSubmitting(false);
        return;
      }
    }

    // Check if trying to remove more stock than available
    const isStockOutMovement = ["SALE", "DAMAGE", "THEFT", "EXPIRY"].includes(formData.type) || 
                              (formData.type === "TRANSFER" && formData.transferDirection === "OUT");
    const isAdjustmentOut = formData.type === "ADJUSTMENT" && formData.quantity < 0;
    
    if ((isStockOutMovement || isAdjustmentOut) && selectedProduct && formData.warehouseId) {
      const warehouseStock = getWarehouseStock(selectedProduct, formData.warehouseId);
      if (formData.quantity > warehouseStock.available) {
        showError("Validation Error", `Cannot remove more stock than available in this warehouse. Available: ${warehouseStock.available} ${selectedProduct.uomBase}`);
        setIsSubmitting(false);
        return;
      }
    }

    // For transfer IN, check source warehouse has enough stock
    if (formData.type === "TRANSFER" && formData.transferDirection === "IN" && selectedProduct && formData.transferFromWarehouse) {
      const sourceStock = getWarehouseStock(selectedProduct, formData.transferFromWarehouse);
      if (formData.quantity > sourceStock.available) {
        showError("Validation Error", `Source warehouse doesn't have enough stock. Available: ${sourceStock.available} ${selectedProduct.uomBase}`);
        setIsSubmitting(false);
        return;
      }
    }

    // Validate unit cost for stock-in movements
    const isStockInMovement = ["RECEIPT", "RETURN"].includes(formData.type) || 
                             (formData.type === "TRANSFER" && formData.transferDirection === "IN");
    if (isStockInMovement && formData.unitCost <= 0) {
      showError("Validation Error", "Unit cost is required for stock-in movements");
      setIsSubmitting(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('productId', formData.productId);
      formDataToSend.append('type', formData.type);
      const isStockOutMovement = ["SALE", "DAMAGE", "THEFT", "EXPIRY"].includes(formData.type) || 
                                (formData.type === "TRANSFER" && formData.transferDirection === "OUT");
      // For stock-out movements, send negative quantity; for stock-in, send positive
      formDataToSend.append('quantity', String(isStockOutMovement 
        ? -formData.quantity 
        : formData.quantity));
      if (formData.unitCost > 0) {
        formDataToSend.append('unitCost', String(formData.unitCost));
      }
      formDataToSend.append('reference', formData.reference);
      formDataToSend.append('reason', formData.reason);
      formDataToSend.append('notes', formData.notes);
      formDataToSend.append('warehouseId', formData.warehouseId);
      if (formData.supplierId) {
        formDataToSend.append('supplierId', formData.supplierId);
      }
      
      // Add transfer-specific fields
      if (formData.type === "TRANSFER") {
        formDataToSend.append('transferDirection', formData.transferDirection);
        formDataToSend.append('transferFromWarehouse', formData.transferFromWarehouse);
        formDataToSend.append('transferToWarehouse', formData.transferToWarehouse);
      }
      
      // Add GRN file if it exists
      if (grnFile) {
        formDataToSend.append('grnFile', grnFile);
      }
      
      // Add PO file if it exists
      if (poFile) {
        formDataToSend.append('poFile', poFile);
      }

      const response = await fetch('/api/stock-movements', {
        method: 'POST',
        body: formDataToSend,
      });

      if (response.ok) {
        success("Stock Movement Added", `Stock movement has been recorded successfully.`);
        onSuccess();
        onClose();
        
        // Reset form
        setFormData({
          productId: "",
          type: "RECEIPT",
          quantity: 0,
          unitCost: 0,
          reference: "",
          reason: "",
          notes: "",
          warehouseId: warehouses.length > 0 ? warehouses[0].id : "",
          supplierId: "",
          transferDirection: "OUT",
          transferFromWarehouse: "",
          transferToWarehouse: "",
        });
        setSelectedProduct(null);
        setProductSearch("");
        setGrnFile(null);
        setPoFile(null);
      } else {
        const errorData = await response.json();
        showError("Error", errorData.error || 'Failed to add stock movement');
      }
    } catch (error) {
      console.error('Error adding stock movement:', error);
      showError("Network Error", 'Unable to connect to server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMovementTypeInfo = (type: string) => {
    return movementTypes.find(t => t.value === type) || movementTypes[0];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Add Stock Movement</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product *
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      if (!e.target.value) {
                        setSelectedProduct(null);
                        setFormData(prev => ({ ...prev, productId: "" }));
                      }
                    }}
                    placeholder="Search for a product by name or SKU..."
                    className="pl-10"
                    required
                  />
              </div>
              
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                      {product.stockItems && product.stockItems.length > 0 && (
                        <div className="text-xs text-gray-400">
                          <div>Total Available: {getTotalAvailableStock(product)} {product.uomBase}</div>
                          {product.stockItems.length > 1 && (
                            <div className="mt-1 text-gray-500">
                              {product.stockItems
                                .filter(item => item.available > 0)
                                .slice(0, 3)
                                .map(item => `${item.warehouse.name}: ${item.available}`)
                                .join(', ')}
                              {product.stockItems.filter(item => item.available > 0).length > 3 && '...'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
              
              {/* Barcode Scanner Button */}
              <BarcodeScanner
                onScan={handleBarcodeScan}
                autoLookup={true}
                title="Scan Product Barcode"
                description="Scan the product barcode to auto-fill details"
              />
            </div>
          </div>

          {/* Movement Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Movement Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {movementTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity and Unit Cost */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {["SALE", "DAMAGE", "THEFT", "EXPIRY"].includes(formData.type) || 
                 (formData.type === "TRANSFER" && formData.transferDirection === "OUT") ? 
                 "Quantity to Remove *" : "Quantity *"}
              </label>
              <Input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                placeholder="Enter quantity"
                required
                className="flex-1"
                min={["SALE", "DAMAGE", "THEFT", "EXPIRY"].includes(formData.type) || 
                     (formData.type === "TRANSFER" && formData.transferDirection === "OUT") ? 1 : 
                     (formData.type === "ADJUSTMENT" ? undefined : 1)}
                 max={["SALE", "DAMAGE", "THEFT", "EXPIRY"].includes(formData.type) || 
                      (formData.type === "TRANSFER" && formData.transferDirection === "OUT") ? 
                      (selectedProduct && formData.warehouseId ? getWarehouseStock(selectedProduct, formData.warehouseId).available : (selectedProduct ? getTotalAvailableStock(selectedProduct) : 0)) : undefined}
              />
              <p className="text-xs text-gray-500 mt-1">
                {["SALE", "DAMAGE", "THEFT", "EXPIRY"].includes(formData.type) || 
                 (formData.type === "TRANSFER" && formData.transferDirection === "OUT") ? (
                  formData.warehouseId && selectedProduct ? (
                    <span className={getWarehouseStock(selectedProduct, formData.warehouseId).available === 0 ? 'text-red-600 font-medium' : ''}>
                      Available in selected warehouse: {getWarehouseStock(selectedProduct, formData.warehouseId).available} {selectedProduct.uomBase}
                      {getTotalAvailableStock(selectedProduct) !== getWarehouseStock(selectedProduct, formData.warehouseId).available && (
                        <span className="text-gray-400"> (Total across all warehouses: {getTotalAvailableStock(selectedProduct)})</span>
                      )}
                    </span>
                  ) : (
                    `Total available stock: ${selectedProduct ? getTotalAvailableStock(selectedProduct) : 0} ${selectedProduct?.uomBase || 'units'}`
                  )
                ) : (
                  formData.quantity > 0 ? "Positive for stock in" : "Negative for stock out"
                )}
              </p>
            </div>

            {/* Only show Unit Cost for stock-in movements */}
            {["RECEIPT", "RETURN"].includes(formData.type) || 
             (formData.type === "TRANSFER" && formData.transferDirection === "IN") || 
             (formData.type === "ADJUSTMENT" && formData.quantity > 0) ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Cost {["RECEIPT", "RETURN"].includes(formData.type) ? "*" : ""}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unitCost}
                  onChange={(e) => setFormData({ ...formData, unitCost: Number(e.target.value) })}
                  placeholder="Enter unit cost"
                  min="0"
                  required={["RECEIPT", "RETURN"].includes(formData.type)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {["RECEIPT", "RETURN"].includes(formData.type) ? 
                   "Required for stock in movements" : 
                   "Optional for adjustments"}
                </p>
              </div>
            ) : null}
          </div>

          {/* Warehouse Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warehouse *
            </label>
            <select
              value={formData.warehouseId}
              onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a warehouse</option>
              {warehouses.map((warehouse) => {
                const stock = selectedProduct ? getWarehouseStock(selectedProduct, warehouse.id) : null;
                return (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                    {stock && ` - Available: ${stock.available} ${selectedProduct?.uomBase || 'units'}`}
                </option>
                );
              })}
            </select>
            {selectedProduct && formData.warehouseId && (
              <p className="text-xs mt-1">
                <span className={`font-medium ${
                  getWarehouseStock(selectedProduct, formData.warehouseId).available === 0 
                    ? 'text-red-600' 
                    : getWarehouseStock(selectedProduct, formData.warehouseId).available < 10
                    ? 'text-amber-600'
                    : 'text-green-600'
                }`}>
                  Available in this warehouse: {getWarehouseStock(selectedProduct, formData.warehouseId).available} {selectedProduct.uomBase}
                </span>
              </p>
            )}
            {selectedProduct && !formData.warehouseId && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                <p className="font-medium text-blue-800 mb-1">Stock by Warehouse:</p>
                {getWarehousesWithStock(selectedProduct).length > 0 ? (
                  <ul className="space-y-1">
                    {getWarehousesWithStock(selectedProduct).map((item) => (
                      <li key={item.warehouse.id} className="text-blue-700">
                        {item.warehouse.name} ({item.warehouse.code}): <strong>{item.available} {selectedProduct.uomBase}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-blue-600">No stock available in any warehouse</p>
                )}
              </div>
            )}
          </div>

          {/* Supplier Selection - Only show for RECEIPT type */}
          {formData.type === "RECEIPT" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier
              </label>
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a supplier (optional)</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the supplier this stock was received from
              </p>
            </div>
          )}

          {/* Transfer Fields - Only show for TRANSFER type */}
          {formData.type === "TRANSFER" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transfer Direction *
                </label>
                <select
                  value={formData.transferDirection}
                  onChange={(e) => setFormData({ ...formData, transferDirection: e.target.value as "IN" | "OUT" })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="OUT">Transfer Out</option>
                  <option value="IN">Transfer In</option>
                </select>
              </div>

              {formData.transferDirection === "OUT" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination Warehouse *
                  </label>
                  <select
                    value={formData.transferToWarehouse}
                    onChange={(e) => setFormData({ ...formData, transferToWarehouse: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select destination warehouse</option>
                    {warehouses.filter(w => w.id !== formData.warehouseId).map((warehouse) => {
                      const stock = selectedProduct ? getWarehouseStock(selectedProduct, warehouse.id) : null;
                      return (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                          {stock && ` - Current: ${stock.available} ${selectedProduct?.uomBase || 'units'}`}
                      </option>
                      );
                    })}
                  </select>
                  {selectedProduct && formData.warehouseId && (
                    <p className="text-xs mt-1 text-gray-600">
                      Available to transfer from {warehouses.find(w => w.id === formData.warehouseId)?.name}: <strong>{getWarehouseStock(selectedProduct, formData.warehouseId).available} {selectedProduct.uomBase}</strong>
                    </p>
                  )}
                </div>
              )}

              {formData.transferDirection === "IN" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Warehouse *
                  </label>
                  <select
                    value={formData.transferFromWarehouse}
                    onChange={(e) => setFormData({ ...formData, transferFromWarehouse: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select source warehouse</option>
                    {warehouses.filter(w => w.id !== formData.warehouseId).map((warehouse) => {
                      const stock = selectedProduct ? getWarehouseStock(selectedProduct, warehouse.id) : null;
                      const hasStock = stock && stock.available > 0;
                      return (
                        <option 
                          key={warehouse.id} 
                          value={warehouse.id}
                          disabled={!hasStock}
                        >
                        {warehouse.name} ({warehouse.code})
                          {stock ? ` - Available: ${stock.available} ${selectedProduct?.uomBase || 'units'}` : ' - No stock'}
                      </option>
                      );
                    })}
                  </select>
                  {selectedProduct && formData.transferFromWarehouse && (
                    <p className="text-xs mt-1">
                      <span className={`font-medium ${
                        getWarehouseStock(selectedProduct, formData.transferFromWarehouse).available === 0 
                          ? 'text-red-600' 
                          : getWarehouseStock(selectedProduct, formData.transferFromWarehouse).available < formData.quantity
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}>
                        Available in source warehouse: {getWarehouseStock(selectedProduct, formData.transferFromWarehouse).available} {selectedProduct.uomBase}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reference and Reason */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference
              </label>
              <Input
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="e.g., PO-12345, SO-67890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason
              </label>
              <Input
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Reason for this movement"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Document Uploads - Required for RECEIPT type */}
          {formData.type === 'RECEIPT' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* GRN Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GRN Document <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleGrnFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {grnFile && (
                  <p className="text-sm text-green-600 mt-1">✓ {grnFile.name}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Goods Receipt Note
                </p>
              </div>

              {/* PO Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purchase Order Document
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handlePoFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                {poFile && (
                  <p className="text-sm text-green-600 mt-1">✓ {poFile.name}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Purchase Order (optional)
                </p>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting || formData.quantity === 0 || !formData.productId || !formData.warehouseId}
              className="text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: getThemeColor() || '#dc2626' }}
            >
              {isSubmitting ? "Adding..." : "Add Movement"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
