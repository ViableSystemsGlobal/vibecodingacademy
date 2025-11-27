'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { downloadQuotationAsPDF } from '@/lib/quotation-download';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SendQuoteModal } from '@/components/modals/send-quote-modal';
import { 
  ArrowLeft, 
  FileText, 
  Building2, 
  User, 
  Calendar,
  Package,
  Edit,
  Download,
  Mail,
  DollarSign,
  Clock,
  Receipt,
  QrCode,
  Bell
} from 'lucide-react';

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
const ProductImage = ({ images, name, size = 'sm' }: { images?: string | null; name: string; size?: 'xs' | 'sm' | 'md' }) => {
  const imageArray = parseProductImages(images);
  const sizeClasses = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8', 
    md: 'h-10 w-10'
  };
  
  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {imageArray.length > 0 ? (
        <>
          <img
            src={imageArray[0]}
            alt={name}
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

interface LineItem {
  id: string;
  productId?: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxes: any[];
  lineTotal: number;
  sku?: string;
  images?: string | null;
}

interface Quotation {
  id: string;
  number: string;
  status: string;
  subject: string;
  validUntil: string;
  notes: string;
  currency?: string;
  subtotal: number;
  tax: number;
  total: number;
  accountId?: string;
  distributorId?: string;
  customerType: string;
  qrCodeData?: string;
  qrCodeGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
  account?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  distributor?: {
    id: string;
    businessName: string;
    email: string;
    phone: string;
  };
  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company?: string;
  };
  owner: {
    id: string;
    name: string;
    email: string;
  };
  lines: LineItem[];
  invoices?: Array<{
    id: string;
    number: string;
    createdAt: string;
    status: string;
  }>;
}

export default function ViewQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const { getThemeClasses, getThemeColor, customLogo } = useTheme();
  const { error: showError, success } = useToast();
  const theme = getThemeClasses();
  
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [convertingToInvoice, setConvertingToInvoice] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Currency helper function
  const getCurrencySymbol = (code: string = 'GHS'): string => {
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'NGN': '₦',
      'KES': 'KSh',
      'ZAR': 'R',
      'GHS': 'GH₵'
    };
    return symbols[code] || code + ' ';
  };

  useEffect(() => {
    if (params.id) {
      loadQuotation(params.id as string);
    }
  }, [params.id]);

  const loadQuotation = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quotations/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to load quotation');
      }
      
      const data = await response.json();
      
      // Map line items to include productName from product.name
      const mappedData = {
        ...data,
        lines: data.lines.map((line: any) => ({
          ...line,
          productName: line.product?.name || `Product ${line.productId}`,
          description: line.product?.description || '',
          sku: line.product?.sku || '',
          images: line.product?.images || null
        }))
      };
      
      setQuotation(mappedData);
      
    } catch (err) {
      console.error('Error loading quotation:', err);
      router.push('/quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!quotation) return;
    
    setConvertingToInvoice(true);
    
    try {
      const response = await fetch(`/api/quotations/${quotation.id}/convert-to-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // If invoice already exists, show a confirmation modal to navigate to it
        if (errorData.error?.includes('already exists')) {
          const invoiceId = errorData.invoiceId;
          const invoiceNumber = errorData.invoiceNumber;
          
          if (invoiceId) {
            // Show confirmation modal with navigation option
            if (window.confirm(
              `This quotation has already been converted to Invoice ${invoiceNumber}.\n\n` +
              `Would you like to view the invoice now?`
            )) {
              router.push(`/invoices/${invoiceId}`);
            }
          } else {
            showError(
              'Already Converted',
              'This quotation has already been converted to an invoice. Please check your invoices list.'
            );
          }
          return;
        }
        
        throw new Error(errorData.error || 'Failed to convert to invoice');
      }

      const result = await response.json();
      
      success('Quotation successfully converted to invoice!');
      
      // Refresh the quotation data
      await loadQuotation(quotation.id);
      
      // Optionally redirect to the invoice
      if (result.invoice) {
        // You can add navigation to invoice details page here
        console.log('Invoice created:', result.invoice);
      }
      
    } catch (err) {
      console.error('Error converting to invoice:', err);
      showError(err instanceof Error ? err.message : 'Failed to convert to invoice');
    } finally {
      setConvertingToInvoice(false);
    }
  };

  const handleQuotationReminder = async () => {
    if (!quotation) return;

    // Get customer contact info
    const customerEmail = quotation.account?.email || quotation.distributor?.email || quotation.lead?.email;
    const customerPhone = quotation.account?.phone || quotation.distributor?.phone || quotation.lead?.phone;
    const customerName = quotation.account?.name || 
                         quotation.distributor?.businessName || 
                         (quotation.lead ? `${quotation.lead.firstName} ${quotation.lead.lastName}`.trim() : '') ||
                         'Valued Customer';

    if (!customerEmail && !customerPhone) {
      showError('No email or phone number found for customer');
      return;
    }

    try {
      setSendingReminder(true);

      const response = await fetch('/api/quotations/quotation-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotationId: quotation.id,
          customerEmail,
          customerPhone,
          customerName,
          quotationNumber: quotation.number,
          quotationSubject: quotation.subject,
          quotationTotal: quotation.total,
          validUntil: quotation.validUntil,
          currency: quotation.currency || 'GHS'
        })
      });

      if (response.ok) {
        const data = await response.json();
        success(data.message || 'Quotation reminder sent successfully');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to send quotation reminder');
      }
    } catch (error) {
      console.error('Error sending quotation reminder:', error);
      showError('Failed to send quotation reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SENT: 'bg-blue-100 text-blue-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-orange-100 text-orange-800',
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}>
        {status.toLowerCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading quotation...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!quotation) {
    return (
      <>
        <div className="p-6">
          <div className="text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Quotation Not Found</h2>
            <p className="text-gray-600 mb-4">The quotation you're looking for doesn't exist.</p>
            <Button onClick={() => router.push('/quotations')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotations
            </Button>
          </div>
        </div>
      </>
    );
  }

  const customer = quotation.account || quotation.distributor;

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/quotations')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotations
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quotation Details</h1>
              <p className="text-gray-600">{quotation.number}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/quotations/${quotation.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button 
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Open window immediately (synchronously) in direct response to user click
                const timestamp = Date.now();
                const pdfUrl = `/api/quotations/${quotation.id}/pdf?t=${timestamp}`;
                const newWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
                
                if (!newWindow) {
                  showError('Please allow popups to view the PDF, or try clicking the download button again.');
                  return;
                }
                
                success("Quotation PDF opened in new tab. You can print it from there.");
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowSendModal(true)}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button 
              variant="outline"
              onClick={handleQuotationReminder}
              disabled={sendingReminder || !quotation}
            >
              <Bell className="h-4 w-4 mr-2" />
              {sendingReminder ? 'Sending...' : 'Quotation Reminder'}
            </Button>
            {quotation.status === 'ACCEPTED' && (
              <>
                {quotation.invoices && quotation.invoices.length > 0 ? (
                  <Button 
                    onClick={() => router.push(`/invoices/${quotation.invoices![0].id}`)}
                    className="text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: getThemeColor() }}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    View Invoice {quotation.invoices[0].number}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleConvertToInvoice}
                    disabled={convertingToInvoice}
                    className="text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: getThemeColor() }}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    {convertingToInvoice ? 'Converting...' : 'Convert to Invoice'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quotation Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Quotation Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Company Header */}
                <div className="text-center mb-8">
                  {customLogo ? (
                    <img 
                      src={customLogo} 
                      alt="Company Logo" 
                      className="h-16 w-auto mx-auto mb-4"
                    />
                  ) : (
                    <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  )}
                  <h2 className="text-2xl font-bold text-gray-900">{quotation.subject}</h2>
                  <p className="text-sm text-gray-600">{quotation.number}</p>
                </div>

                {/* Document Info */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">QUOTATION</div>
                    <div className="font-semibold">{quotation.number}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Valid Until</div>
                      <div>{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'No expiry'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</div>
                    <div className="font-semibold">{new Date(quotation.createdAt).toLocaleDateString()}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</div>
                      <div>{getStatusBadge(quotation.status)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bill To</div>
                    <div className="font-semibold">{(customer as any)?.name || (customer as any)?.businessName || 'No customer'}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      <div>{customer?.email || ''}</div>
                      <div>{customer?.phone || ''}</div>
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div className="mb-8">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-gray-900">Description</th>
                        <th className="text-center py-2 font-medium text-gray-900">Qty</th>
                        <th className="text-right py-2 font-medium text-gray-900">Unit Price</th>
                        <th className="text-right py-2 font-medium text-gray-900">Discount</th>
                        <th className="text-right py-2 font-medium text-gray-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotation.lines.map((line, index) => (
                        <tr key={line.id} className="border-b">
                          <td className="py-3">
                            <div className="flex items-center space-x-3">
                              <ProductImage images={line.images} name={line.productName || `Item ${index + 1}`} size="sm" />
                              <div>
                                <div className="font-medium">{line.productName || `Item ${index + 1}`}</div>
                                {line.sku && (
                                  <div className="text-sm text-gray-500">SKU: {line.sku}</div>
                                )}
                                {line.description && (
                                  <div className="text-sm text-gray-600">{line.description}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="text-center py-3">{line.quantity}</td>
                          <td className="text-right py-3">{getCurrencySymbol(quotation.currency)}{line.unitPrice.toFixed(2)}</td>
                          <td className="text-right py-3">{line.discount}%</td>
                          <td className="text-right py-3 font-medium">{getCurrencySymbol(quotation.currency)}{(() => {
                            // AMOUNT column should always show base amount (quantity × unit price × (1 - discount))
                            // Taxes are shown separately in the totals section below
                            const baseAmount = line.quantity * line.unitPrice * (1 - line.discount / 100);
                            return baseAmount.toFixed(2);
                          })()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{getCurrencySymbol(quotation.currency)}{quotation.subtotal.toFixed(2)}</span>
                  </div>
                  {(() => {
                    const totalDiscount = quotation.lines.reduce((sum, line) => {
                      const discountAmount = (line.unitPrice * line.quantity * line.discount) / 100;
                      return sum + discountAmount;
                    }, 0);
                    return totalDiscount > 0 ? (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-medium text-green-600">-{getCurrencySymbol(quotation.currency)}{totalDiscount.toFixed(2)}</span>
                      </div>
                    ) : null;
                  })()}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">{getCurrencySymbol(quotation.currency)}{quotation.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 text-lg font-bold border-t">
                    <span>Total:</span>
                    <span>{getCurrencySymbol(quotation.currency)}{quotation.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Notes */}
                {quotation.notes && (
                  <div className="mt-8 pt-6 border-t">
                    <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                    <p className="text-gray-600 whitespace-pre-wrap">{quotation.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Status & Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">{getStatusBadge(quotation.status)}</div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Created</label>
                  <div className="mt-1 text-sm text-gray-600">
                    {new Date(quotation.createdAt).toLocaleString()}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Last Updated</label>
                  <div className="mt-1 text-sm text-gray-600">
                    {new Date(quotation.updatedAt).toLocaleString()}
                  </div>
                </div>
                
                {quotation.validUntil && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Valid Until</label>
                    <div className="mt-1 text-sm text-gray-600">
                      {new Date(quotation.validUntil).toLocaleDateString()}
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t space-y-2">
                  <Button 
                    className="w-full text-white border-0 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: getThemeColor() }}
                    onClick={() => router.push(`/quotations/${quotation.id}/edit`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Quotation
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Open window immediately (synchronously) in direct response to user click
                      const timestamp = Date.now();
                      const pdfUrl = `/api/quotations/${quotation.id}/pdf?t=${timestamp}`;
                      const newWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
                      
                      if (!newWindow) {
                        showError('Please allow popups to view the PDF, or try clicking the download button again.');
                        return;
                      }
                      
                      success("Quotation PDF opened in new tab. You can print it from there.");
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowSendModal(true)}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleQuotationReminder}
                    disabled={sendingReminder || !quotation}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    {sendingReminder ? 'Sending...' : 'Quotation Reminder'}
                  </Button>
                  {quotation.status === 'ACCEPTED' && (
                    <>
                      {quotation.invoices && quotation.invoices.length > 0 ? (
                        <Button 
                          onClick={() => router.push(`/invoices/${quotation.invoices![0].id}`)}
                          className="w-full text-white border-0 hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: getThemeColor() }}
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          View Invoice {quotation.invoices[0].number}
                        </Button>
                      ) : (
                        <Button 
                          onClick={handleConvertToInvoice}
                          disabled={convertingToInvoice}
                          className="w-full text-white border-0 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: getThemeColor() }}
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          {convertingToInvoice ? 'Converting...' : 'Convert to Invoice'}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customer Info */}
            {customer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Name</label>
                      <div className="mt-1 text-sm text-gray-900">{(customer as any)?.name || (customer as any)?.businessName}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <div className="mt-1 text-sm text-gray-900">{customer.email}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Phone</label>
                      <div className="mt-1 text-sm text-gray-900">{customer.phone}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Type</label>
                      <div className="mt-1 text-sm text-gray-900 capitalize">
                        {quotation.account ? 'Account' : 'Distributor'} • {quotation.customerType?.toLowerCase() || 'standard'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* QR Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <QrCode className="h-5 w-5 mr-2" />
                  QR Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  {quotation.qrCodeData ? (
                    <div className="w-32 h-32 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center mx-auto p-2">
                      <img 
                        src={quotation.qrCodeData} 
                        alt="QR Code" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                      <QrCode className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Scan to view quotation details
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Progress Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Progress Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Created Event */}
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-green-500"></div>
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-medium text-gray-900">Created</div>
                      <div className="text-xs text-gray-500">{new Date(quotation.createdAt).toLocaleString()}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        Quotation {quotation.number} was created by {quotation.owner?.name || 'Unknown User'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Last Updated Event - Always show if updatedAt exists and is different from createdAt */}
                  {quotation.updatedAt && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-gray-900">Last Updated</div>
                        <div className="text-xs text-gray-500">
                          {new Date(quotation.updatedAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Quotation was modified by {quotation.owner?.name || 'Unknown User'}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Status Events */}
                  {quotation.status === 'SENT' && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-gray-900">Sent to Customer</div>
                        <div className="text-xs text-gray-500">
                          {quotation.updatedAt ? new Date(quotation.updatedAt).toLocaleString() : 'Unknown time'}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Quotation was sent by {quotation.owner?.name || 'Unknown User'}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {quotation.status === 'ACCEPTED' && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-green-500"></div>
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-gray-900">Accepted</div>
                        <div className="text-xs text-gray-500">
                          {quotation.updatedAt ? new Date(quotation.updatedAt).toLocaleString() : 'Unknown time'}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Customer accepted the quotation</div>
                      </div>
                    </div>
                  )}
                  
                  {quotation.status === 'REJECTED' && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-red-500"></div>
                      <div className="ml-3 flex-1">
                        <div className="text-sm font-medium text-gray-900">Rejected</div>
                        <div className="text-xs text-gray-500">
                          {quotation.updatedAt ? new Date(quotation.updatedAt).toLocaleString() : 'Unknown time'}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Customer rejected the quotation</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Owner Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Owner
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Name</label>
                    <div className="mt-1 text-sm text-gray-900">{quotation.owner.name}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <div className="mt-1 text-sm text-gray-900">{quotation.owner.email}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Send Quote Modal */}
      {quotation && (
        <SendQuoteModal
          isOpen={showSendModal}
          onClose={() => setShowSendModal(false)}
          quotation={{
            id: quotation.id,
            number: quotation.number,
            subject: quotation.subject,
            account: quotation.account,
            distributor: quotation.distributor,
            lead: quotation.lead,
            total: quotation.total
          }}
        />
      )}
    </>
  );
}
