'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/toast-context';

interface GenerateWaybillModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  orderId: string;
  onSuccess: () => void;
}

export function GenerateWaybillModal({ isOpen, onClose, orderNumber, orderId, onSuccess }: GenerateWaybillModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [branding, setBranding] = useState<any>(null);
  const [formData, setFormData] = useState({
    waybillNumber: `WB-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    date: new Date().toLocaleDateString('en-CA'),
    carrier: '',
    trackingNumber: '',
    shippedBy: '',
    receivedBy: '',
    deliveryAddress: '',
    notes: ''
  });

  const { success, error } = useToast();

  // Fetch order items and branding when modal opens
  useEffect(() => {
    if (isOpen && orderId) {
      const fetchData = async () => {
        try {
          // Fetch order details
          const orderResponse = await fetch(`/api/orders/${orderId}`);
          if (orderResponse.ok) {
            const orderData = await orderResponse.json();
            setOrderItems(orderData.items || []);
          }

          // Fetch branding settings
          const brandingResponse = await fetch('/api/settings/branding');
          if (brandingResponse.ok) {
            const brandingData = await brandingResponse.json();
            setBranding(brandingData);
          }
        } catch (err) {
          console.error('Error fetching data:', err);
        }
      };
      fetchData();
    }
  }, [isOpen, orderId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Helper function to convert image URL to base64
  const imageToBase64 = async (url: string): Promise<string | null> => {
    try {
      if (!url || url.startsWith('data:')) return url;
      
      // Convert relative URLs to absolute
      const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      const response = await fetch(absoluteUrl);
      if (!response.ok) return null;
      
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Error converting image to base64:', err);
      return null;
    }
  };

  const generateWaybillPDF = async () => {
    if (!formData.waybillNumber || !formData.carrier) {
      error('Waybill number and carrier are required');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Import jsPDF dynamically
      const jsPDF = (await import('jspdf')).default;

      // Create a new PDF document
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.setFont('helvetica');
      
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      let yPos = 0;
      let headerHeight = 0;
      let footerHeight = 0;

      // Add header image if available
      if (branding?.pdfHeaderImage) {
        try {
          const headerBase64 = await imageToBase64(branding.pdfHeaderImage);
          if (headerBase64) {
            // Get image dimensions to calculate height
            const img = new Image();
            img.src = headerBase64;
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
            
            const headerImgWidth = pageWidth;
            const headerImgHeight = (img.height / img.width) * headerImgWidth;
            const maxHeaderHeight = 50; // Max 50mm for header
            const actualHeaderHeight = Math.min(headerImgHeight, maxHeaderHeight);
            
            pdf.addImage(headerBase64, 'PNG', 0, 0, headerImgWidth, actualHeaderHeight);
            headerHeight = actualHeaderHeight;
            yPos = headerHeight + 10;
          }
        } catch (err) {
          console.error('Error adding header image:', err);
          yPos = margin;
        }
      } else {
        yPos = margin;
      }

      // Add logo if available (top left after header)
      if (branding?.companyLogo && branding.companyLogo !== '/uploads/branding/company_logo_default.svg') {
        try {
          const logoBase64 = await imageToBase64(branding.companyLogo);
          if (logoBase64) {
            pdf.addImage(logoBase64, 'PNG', margin, yPos, 30, 30);
            yPos += 35;
          }
        } catch (err) {
          console.error('Error adding logo:', err);
        }
      }

      // Title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('WAYBILL', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      // Waybill Number and Date
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Waybill Number: ${formData.waybillNumber}`, margin, yPos);
      pdf.text(`Date: ${formData.date}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 10;

      // Order Number
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Order Number: ${orderNumber}`, margin, yPos);
      yPos += 10;

      // Carrier Information
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Carrier: ${formData.carrier}`, margin, yPos);
      if (formData.trackingNumber) {
        pdf.text(`Tracking Number: ${formData.trackingNumber}`, pageWidth - margin, yPos, { align: 'right' });
      }
      yPos += 10;

      // Delivery Address
      if (formData.deliveryAddress) {
        pdf.text(`Delivery Address: ${formData.deliveryAddress}`, margin, yPos);
        yPos += 10;
      }

      // Personnel
      if (formData.shippedBy) {
        pdf.text(`Shipped By: ${formData.shippedBy}`, margin, yPos);
      }
      if (formData.receivedBy) {
        pdf.text(`Received By: ${formData.receivedBy}`, pageWidth - margin, yPos, { align: 'right' });
      }
      yPos += 10;

      // Products/Items Table
      if (orderItems.length > 0) {
        yPos += 5;
        
        // Check if we need a new page
        if (yPos > pageHeight - 80) {
          pdf.addPage();
          yPos = margin;
        }

        // Table Header
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('ITEM NO.', margin, yPos);
        pdf.text('PRODUCT', margin + 30, yPos);
        pdf.text('SKU', margin + 100, yPos);
        pdf.text('QTY', margin + 140, yPos);
        pdf.text('UNIT', margin + 160, yPos);
        
        // Draw line under header
        yPos += 5;
        pdf.setDrawColor(0, 0, 0);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;

        // Table Rows
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        
        for (let i = 0; i < orderItems.length; i++) {
          const item = orderItems[i];
          
          // Check if we need a new page
          if (yPos > pageHeight - 50) {
            pdf.addPage();
            yPos = margin;
          }

          const productName = item.product?.name || 'Unknown Product';
          const productSku = item.product?.sku || 'N/A';
          const quantity = item.quantity || 0;
          const unit = item.unit || 'pcs';

          // Item number
          pdf.text(`${i + 1}.`, margin, yPos);
          
          // Product name (truncate if too long)
          const nameLines = pdf.splitTextToSize(productName, 60);
          pdf.text(nameLines, margin + 30, yPos);
          
          // SKU
          pdf.text(productSku, margin + 100, yPos);
          
          // Quantity
          pdf.text(String(quantity), margin + 140, yPos);
          
          // Unit
          pdf.text(unit, margin + 160, yPos);
          
          // Move to next row (adjust for multi-line product names)
          yPos += Math.max(8, nameLines.length * 4);
        }

        yPos += 10;
      }

      // Notes
      if (formData.notes) {
        // Check if we need a new page
        if (yPos > pageHeight - 50) {
          pdf.addPage();
          yPos = margin;
        }
        
        yPos += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('Notes:', margin, yPos);
        yPos += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        const notesLines = pdf.splitTextToSize(formData.notes, pageWidth - 2 * margin);
        pdf.text(notesLines, margin, yPos);
        yPos += notesLines.length * 4 + 5;
      }

      // Add footer image if available
      if (branding?.pdfFooterImage) {
        try {
          const footerBase64 = await imageToBase64(branding.pdfFooterImage);
          if (footerBase64) {
            // Calculate remaining space on current page
            const remainingSpace = pageHeight - yPos;
            const maxFooterHeight = 50; // Max 50mm for footer
            
            // If not enough space, add new page
            if (remainingSpace < maxFooterHeight) {
              pdf.addPage();
              yPos = 0;
            }
            
            // Get image dimensions
            const img = new Image();
            img.src = footerBase64;
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
            
            const footerImgWidth = pageWidth;
            const footerImgHeight = (img.height / img.width) * footerImgWidth;
            const actualFooterHeight = Math.min(footerImgHeight, maxFooterHeight);
            
            // Position footer at bottom of page
            const footerY = pageHeight - actualFooterHeight;
            pdf.addImage(footerBase64, 'PNG', 0, footerY, footerImgWidth, actualFooterHeight);
            footerHeight = actualFooterHeight;
          }
        } catch (err) {
          console.error('Error adding footer image:', err);
        }
      }

      // Generate PDF blob
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Waybill-${formData.waybillNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Waybill PDF generated successfully');
    } catch (err) {
      console.error('Error generating waybill:', err);
      error('Failed to generate waybill PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveWaybillNumber = async () => {
    if (!formData.waybillNumber) {
      error('Waybill number is required');
      return;
    }

    setIsSaving(true);

    try {
      // First, fetch the current order to get its status
      const orderResponse = await fetch(`/api/orders/${orderId}`, {
        credentials: 'include',
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to fetch order details');
      }

      const orderData = await orderResponse.json();
      const currentStatus = orderData.data?.status;

      if (!currentStatus) {
        throw new Error('Could not determine current order status');
      }

      // Save waybill number to order (preserving current status)
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: currentStatus, // Include current status (required by API)
          waybillNumber: formData.waybillNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save waybill number');
      }

      success('Waybill number saved successfully');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving waybill number:', err);
      error(err instanceof Error ? err.message : 'Failed to save waybill number');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Waybill</DialogTitle>
          <DialogDescription>
            Generate waybill PDF for order {orderNumber}. The waybill can be given to the delivery person.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Waybill Number and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="waybillNumber">Waybill Number *</Label>
              <Input
                id="waybillNumber"
                value={formData.waybillNumber}
                onChange={(e) => handleInputChange('waybillNumber', e.target.value)}
                placeholder="WB-2024-01-001"
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

          {/* Carrier Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="carrier">Carrier *</Label>
              <Input
                id="carrier"
                value={formData.carrier}
                onChange={(e) => handleInputChange('carrier', e.target.value)}
                placeholder="Shipping Company Name"
              />
            </div>
            <div>
              <Label htmlFor="trackingNumber">Tracking Number</Label>
              <Input
                id="trackingNumber"
                value={formData.trackingNumber}
                onChange={(e) => handleInputChange('trackingNumber', e.target.value)}
                placeholder="TRACK123456"
              />
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <Label htmlFor="deliveryAddress">Delivery Address</Label>
            <Textarea
              id="deliveryAddress"
              value={formData.deliveryAddress}
              onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
              placeholder="Full delivery address"
              rows={2}
            />
          </div>

          {/* Personnel Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shippedBy">Shipped By</Label>
              <Input
                id="shippedBy"
                value={formData.shippedBy}
                onChange={(e) => handleInputChange('shippedBy', e.target.value)}
                placeholder="Name"
              />
            </div>
            <div>
              <Label htmlFor="receivedBy">Received By</Label>
              <Input
                id="receivedBy"
                value={formData.receivedBy}
                onChange={(e) => handleInputChange('receivedBy', e.target.value)}
                placeholder="Name"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes/Comments</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes or comments"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating || isSaving}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={generateWaybillPDF}
            disabled={isGenerating || isSaving}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate PDF Only
              </>
            )}
          </Button>
          <Button
            onClick={handleSaveWaybillNumber}
            disabled={isGenerating || isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Waybill Number'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

