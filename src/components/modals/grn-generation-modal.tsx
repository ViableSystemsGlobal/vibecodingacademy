'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/toast-context';
import { useTheme } from '@/contexts/theme-context';

interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string;
  price?: number;
  cost?: number;
  category?: {
    name: string;
  };
}

interface GRNGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export function GRNGenerationModal({ isOpen, onClose, products }: GRNGenerationModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [suppliers, setSuppliers] = useState<Array<{id: string, name: string}>>([]);
  const [formData, setFormData] = useState({
    grnNumber: `GRN-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format
    supplierId: '',
    supplierName: '',
    supplierAddress: '',
    poNumber: '',
    deliveryNote: '',
    receivedBy: '',
    checkedBy: '',
    approvedBy: '',
    remarks: ''
  });

  const { success, error } = useToast();
  const { customLogo, getThemeClasses } = useTheme();
  const theme = getThemeClasses();

  useEffect(() => {
    if (isOpen) {
      fetch('/api/suppliers').then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          // Ensure data is always an array
          setSuppliers(Array.isArray(data) ? data : []);
        } else {
          setSuppliers([]);
        }
      }).catch(() => {
        setSuppliers([]);
      });
    }
  }, [isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateGRN = async () => {
    if (products.length === 0) {
      error('No products selected for GRN generation');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Import jsPDF dynamically to avoid chunk loading issues
      const jsPDF = (await import('jspdf')).default;

      // Create a new PDF document
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Set Nunito Sans as the default font (fallback to helvetica if not available)
      try {
        // Try to use Nunito Sans, fallback to helvetica
        pdf.setFont('helvetica');
      } catch (error) {
        console.log('Using default font');
      }
      
      // Set up the document
      const pageWidth = 210;
      const pageHeight = 297;
      let yPosition = 20;

      // Helper function to add text with word wrap
      const addText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, maxWidth);
        pdf.text(lines, x, y);
        return y + (lines.length * fontSize * 0.4);
      };

      // Add logo if available (top right corner)
      if (customLogo) {
        try {
          // Convert logo to base64 and add to PDF
          const logoResponse = await fetch(customLogo);
          const logoBlob = await logoResponse.blob();
          const logoBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(logoBlob);
          });
          
          pdf.addImage(logoBase64 as string, 'PNG', 150, 15, 20, 20);
        } catch (error) {
          console.log('Could not load logo:', error);
        }
      }

      // Header - Title (top left)
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GOODS RECEIPT NOTE (GRN)', 20, yPosition);
      yPosition += 20;

      // Supplier and Order Details Section
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      // Left side details
      pdf.text('SUPPLIER :', 20, yPosition);
      pdf.text(formData.supplierName || '_________________', 50, yPosition);
      yPosition += 8;
      
      pdf.text('P.O. NO. :', 20, yPosition);
      pdf.text(formData.poNumber || '_________________', 50, yPosition);
      yPosition += 8;
      
      pdf.text('WAYBILL NO. :', 20, yPosition);
      pdf.text(formData.deliveryNote || '_________________', 50, yPosition);
      yPosition += 15;

      // Right side details
      yPosition = 40; // Reset to align with left side
      pdf.text('GRN NO. :', 120, yPosition);
      pdf.text(formData.grnNumber, 150, yPosition);
      yPosition += 8;
      
      pdf.text('DATE :', 120, yPosition);
      pdf.text(formData.date, 150, yPosition);
      yPosition += 20;

      // Item Details Table Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('ITEM NO.', 20, yPosition);
      pdf.text('ITEM', 50, yPosition);
      pdf.text('QTY RECEIVED', 120, yPosition);
      pdf.text('REMARKS', 160, yPosition);
      yPosition += 10;

      // Draw line under header
      pdf.line(20, yPosition, 190, yPosition);
      yPosition += 8;

      // Products
      pdf.setFont('helvetica', 'normal');
      
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = 20;
        }

        // Handle undefined product name and sku
        const productName = product.name || 'Unknown Product';
        const productSku = product.sku || 'N/A';

        // Item number
        pdf.text(`${i + 1}.`, 20, yPosition);
        
        // Item name and SKU
        pdf.text(productName, 50, yPosition);
        pdf.setFontSize(8);
        pdf.text(`(SKU: ${productSku})`, 50, yPosition + 4);
        pdf.setFontSize(10);
        
        // Empty quantity brackets for manual inspection
        pdf.text('[ ]', 120, yPosition);
        
        // Empty remarks
        pdf.text('', 160, yPosition);
        
        yPosition += 12;
      }

      yPosition += 20;

      // Signatures Section
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      // First line: DELIVERED BY and SIGNATURE on same line
      pdf.text('DELIVERED BY :', 20, yPosition);
      pdf.text(formData.receivedBy || '_________________', 50, yPosition);
      pdf.text('SIGNATURE :', 120, yPosition);
      pdf.line(150, yPosition - 2, 190, yPosition - 2);
      yPosition += 12;
      
      // Second line: RECEIVED BY and SIGNATURE on same line
      pdf.text('RECEIVED BY :', 20, yPosition);
      pdf.text(formData.checkedBy || '_________________', 50, yPosition);
      pdf.text('SIGNATURE :', 120, yPosition);
      pdf.line(150, yPosition - 2, 190, yPosition - 2);
      yPosition += 12;
      
      // Third line: APPROVED BY and SIGNATURE on same line
      pdf.text('APPROVED BY :', 20, yPosition);
      pdf.text(formData.approvedBy || '_________________', 50, yPosition);
      pdf.text('SIGNATURE :', 120, yPosition);
      pdf.line(150, yPosition - 2, 190, yPosition - 2);
      yPosition += 15;

      // Remarks Section
      pdf.text('REMARKS :', 20, yPosition);
      yPosition += 8;
      
      // Draw lines for remarks
      for (let i = 0; i < 3; i++) {
        pdf.line(20, yPosition, 190, yPosition);
        yPosition += 6;
      }

      // Download the PDF
      const filename = `GRN_${formData.grnNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);

      success(`GRN generated successfully: ${filename}`);
      onClose();

    } catch (err: unknown) {
      console.error('Error generating GRN:', err);
      error('Failed to generate GRN. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Goods Receipt Note (GRN)
          </DialogTitle>
          <DialogDescription>
            Generate a GRN document for {products.length} selected product{products.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="grnNumber">GRN Number</Label>
              <Input
                id="grnNumber"
                value={formData.grnNumber}
                onChange={(e) => handleInputChange('grnNumber', e.target.value)}
                placeholder="GRN-2024-001"
              />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
              />
            </div>
          </div>

          {/* Supplier Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Supplier</Label>
              <select
                value={formData.supplierId}
                onChange={(e) => {
                  const id = e.target.value;
                  const name = (Array.isArray(suppliers) ? suppliers.find(s => s.id === id)?.name : '') || '';
                  setFormData(prev => ({ ...prev, supplierId: id, supplierName: name }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select supplier</option>
                {Array.isArray(suppliers) && suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="supplierName">Supplier Name (override)</Label>
              <Input
                id="supplierName"
                value={formData.supplierName}
                onChange={(e) => handleInputChange('supplierName', e.target.value)}
                placeholder="Enter supplier name"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="supplierAddress">Supplier Address</Label>
            <Textarea
              id="supplierAddress"
              value={formData.supplierAddress}
              onChange={(e) => handleInputChange('supplierAddress', e.target.value)}
              placeholder="Enter supplier address"
              rows={3}
            />
          </div>

          {/* Reference Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="poNumber">Purchase Order No.</Label>
              <Input
                id="poNumber"
                value={formData.poNumber}
                onChange={(e) => handleInputChange('poNumber', e.target.value)}
                placeholder="PO-2024-001"
              />
            </div>
            <div>
              <Label htmlFor="deliveryNote">Delivery Note / Waybill No.</Label>
              <Input
                id="deliveryNote"
                value={formData.deliveryNote}
                onChange={(e) => handleInputChange('deliveryNote', e.target.value)}
                placeholder="DN-2024-001"
              />
            </div>
          </div>

          {/* Personnel Information */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="receivedBy">Delivered By</Label>
              <Input
                id="receivedBy"
                value={formData.receivedBy}
                onChange={(e) => handleInputChange('receivedBy', e.target.value)}
                placeholder="Name"
              />
            </div>
            <div>
              <Label htmlFor="checkedBy">Received By</Label>
              <Input
                id="checkedBy"
                value={formData.checkedBy}
                onChange={(e) => handleInputChange('checkedBy', e.target.value)}
                placeholder="Name"
              />
            </div>
            <div>
              <Label htmlFor="approvedBy">Approved By</Label>
              <Input
                id="approvedBy"
                value={formData.approvedBy}
                onChange={(e) => handleInputChange('approvedBy', e.target.value)}
                placeholder="Name"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <Label htmlFor="remarks">Remarks/Comments</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => handleInputChange('remarks', e.target.value)}
              placeholder="Additional notes or comments"
              rows={3}
            />
          </div>

          {/* Products Preview */}
          <div>
            <Label>Selected Products ({products.length})</Label>
            <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-3">
              {products.map((product, index) => (
                <div key={product.id} className="text-sm text-gray-600 py-1">
                  {index + 1}. {product.name} (SKU: {product.sku})
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button 
            onClick={generateGRN} 
            disabled={isGenerating}
            className={`bg-${theme.primary} hover:bg-${theme.primaryDark} text-white`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate & Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
