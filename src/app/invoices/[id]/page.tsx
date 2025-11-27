"use client";

import { useState, useEffect, useMemo } from "react";
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
  QrCode,
  ArrowLeft,
  KanbanSquare
} from "lucide-react";
import Link from "next/link";
import { AddPaymentModal } from "@/components/modals/add-payment-modal";
import { CreditNoteModal } from "@/components/modals/credit-note-modal";
import { Package, FileDown, Eye, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { AddProjectModal } from "@/components/modals/add-project-modal";
import { useAbilities } from "@/hooks/use-abilities";

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

interface Invoice {
  id: string;
  number: string;
  subject: string;
  status: string;
  paymentStatus: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  taxInclusive: boolean;
  notes?: string;
  paymentTerms?: string;
  qrCodeData?: string;
  currency?: string;
  accountId?: string;
  account?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  distributor?: {
    businessName: string;
    email?: string;
    phone?: string;
  };
  lead?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  lines: Array<{
    id: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    images?: string | null;
  }>;
  quotation?: {
    id: string;
    number: string;
    subject: string;
  };
  creditNotes?: Array<{
    id: string;
    number: string;
    amount: number;
    appliedAmount: number;
    remainingAmount: number;
    reason: string;
    status: string;
    issueDate: string;
    appliedDate?: string;
    voidedDate?: string;
    applications: Array<{
      id: string;
      amount: number;
      appliedAt: string;
      notes?: string;
    }>;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    notes?: string;
    createdAt: string;
    payment: {
      id: string;
      number: string;
      amount: number;
      method: string;
      reference?: string;
      receivedAt: string;
      receiptUrl?: string;
      notes?: string;
      receiver?: {
        id: string;
        name: string;
        email: string;
      };
    };
  }>;
}

export default function ViewInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const { canAccess, loading: abilitiesLoading } = useAbilities();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('invoice');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [sendingReceiptReminder, setSendingReceiptReminder] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadInvoice();
    }
  }, [params.id]);
  const canUseProjectsModule = !abilitiesLoading && canAccess("projects");

  const projectInitialData = useMemo(() => {
    if (!invoice) return undefined;
    return {
      name: invoice.subject
        ? `${invoice.subject} Project`
        : invoice.number
        ? `Project for ${invoice.number}`
        : "",
      code: invoice.number ? `INV-${invoice.number}` : "",
      description:
        invoice.notes ||
        `Implementation project generated from invoice ${invoice.number}`,
      startDate: invoice.issueDate ? invoice.issueDate.slice(0, 10) : "",
      dueDate: invoice.dueDate ? invoice.dueDate.slice(0, 10) : "",
      budget: invoice.total ? String(invoice.total) : "",
      budgetCurrency: invoice.currency || "USD",
    };
  }, [invoice]);

  // Helper function to get currency symbol
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

  const loadInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        // Map line items to include images from product
        const mappedInvoice = {
          ...data.invoice,
          lines: data.invoice.lines.map((line: any) => ({
            ...line,
            productName: line.product?.name || 'Product',
            sku: line.product?.sku || '',
            images: line.product?.images || null
          }))
        };
        setInvoice(mappedInvoice);
      } else {
        showError("Failed to load invoice");
        router.push('/invoices');
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      showError("Failed to load invoice");
      router.push('/invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!invoice) return;

    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showError("Unable to open print window. Please check your popup blocker.");
        return;
      }

      const response = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (response.ok) {
        const htmlContent = await response.text();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        printWindow.onload = () => {
          printWindow.print();
          printWindow.close();
        };
        
        success("Invoice ready for download/printing");
      } else {
        showError("Failed to generate invoice PDF");
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      showError("Failed to download invoice");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
      SENT: { label: 'Sent', className: 'bg-blue-100 text-blue-800' },
      OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-800' },
      VOID: { label: 'Void', className: 'bg-gray-100 text-gray-500' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    const statusConfig = {
      UNPAID: { label: 'Unpaid', className: 'bg-red-100 text-red-800' },
      PARTIALLY_PAID: { label: 'Partially Paid', className: 'bg-yellow-100 text-yellow-800' },
      PAID: { label: 'Paid', className: 'bg-green-100 text-green-800' },
    };

    const config = statusConfig[paymentStatus as keyof typeof statusConfig] || statusConfig.UNPAID;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getCreditNoteStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PARTIALLY_APPLIED: 'bg-blue-100 text-blue-800',
      FULLY_APPLIED: 'bg-green-100 text-green-800',
      VOID: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.PENDING}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getCreditNoteStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'PARTIALLY_APPLIED':
        return <AlertCircle className="h-4 w-4" />;
      case 'FULLY_APPLIED':
        return <CheckCircle className="h-4 w-4" />;
      case 'VOID':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingPaymentId(paymentId);
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        success('Payment deleted successfully');
        loadInvoice(); // Reload invoice to update payment status
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to delete payment');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      showError('Failed to delete payment');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleReceiptReminder = async () => {
    if (!invoice) return;

    // Check if there are payments
    const payments = invoice.payments || [];
    if (payments.length === 0) {
      showError('No payments found on this invoice');
      return;
    }

    // Get customer contact info
    const customerEmail = invoice.account?.email || invoice.distributor?.email || invoice.lead?.email;
    const customerPhone = invoice.account?.phone || invoice.distributor?.phone || invoice.lead?.phone;
    const customerName = invoice.account?.name || 
                         invoice.distributor?.businessName || 
                         (invoice.lead ? `${invoice.lead.firstName} ${invoice.lead.lastName}`.trim() : '') ||
                         'Valued Customer';

    if (!customerEmail && !customerPhone) {
      showError('No email or phone number found for customer');
      return;
    }

    try {
      setSendingReceiptReminder(true);

      const response = await fetch('/api/invoices/receipt-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          customerEmail,
          customerPhone,
          customerName,
          invoiceNumber: invoice.number,
          invoiceTotal: invoice.total,
          amountPaid: invoice.amountPaid,
          amountDue: invoice.amountDue,
          currency: invoice.currency || 'GHS'
        })
      });

      if (response.ok) {
        const data = await response.json();
        success(data.message || 'Receipt reminder sent successfully');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to send receipt reminder');
      }
    } catch (error) {
      console.error('Error sending receipt reminder:', error);
      showError('Failed to send receipt reminder');
    } finally {
      setSendingReceiptReminder(false);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      'CASH': 'Cash',
      'BANK_TRANSFER': 'Bank Transfer',
      'MOBILE_MONEY': 'Mobile Money',
      'CHECK': 'Check',
      'CARD': 'Card',
      'OTHER': 'Other'
    };
    return methods[method] || method;
  };

  const REASON_LABELS: Record<string, string> = {
    RETURN: 'Product Return',
    DAMAGED_GOODS: 'Damaged Goods',
    PRICING_ERROR: 'Pricing Error',
    BILLING_ERROR: 'Billing Error',
    GOODWILL_GESTURE: 'Goodwill Gesture',
    DISCOUNT_ADJUSTMENT: 'Discount Adjustment',
    DUPLICATE_INVOICE: 'Duplicate Invoice',
    PARTIAL_DELIVERY: 'Partial Delivery',
    QUALITY_ISSUE: 'Quality Issue',
    OTHER: 'Other',
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading invoice...</div>
        </div>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Invoice not found</div>
        </div>
      </>
    );
  }

  const customerName = invoice.account?.name || 
                      invoice.distributor?.businessName || 
                      (invoice.lead ? `${invoice.lead.firstName} ${invoice.lead.lastName}`.trim() : '') ||
                      'Unknown Customer';

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/invoices')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice Detail</h1>
              <p className="text-gray-600">Dashboard &gt; Invoice Detail</p>
            </div>
          </div>
        </div>

        {/* Progress Tracker */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {/* Create Invoice Step */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Plus className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Create Invoice</h3>
                    <p className="text-sm text-gray-500">Created on {new Date(invoice.issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>

              {/* Progress Line */}
              <div className="flex-1 h-0.5 bg-green-200 mx-4"></div>

              {/* Send Invoice Step */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Send className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Send Invoice</h3>
                    <p className="text-sm text-gray-500">
                      {invoice.status === 'SENT' ? `Sent on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'Not sent yet'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Line */}
              <div className={`flex-1 h-0.5 mx-4 ${
                invoice.paymentStatus === 'PAID' ? 'bg-green-200' : 'bg-gray-200'
              }`}></div>

              {/* Get Paid Step */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    invoice.paymentStatus === 'PAID' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <DollarSign className={`h-5 w-5 ${
                      invoice.paymentStatus === 'PAID' ? 'text-green-600' : 'text-gray-400'
                    }`} />
                  </div>
          <div>
                    <h3 className="font-medium text-gray-900">Get Paid</h3>
                    <p className="text-sm text-gray-500">Status: {invoice.paymentStatus === 'PAID' ? 'Paid' : 'Pending'}</p>
                  </div>
                </div>
                {invoice.paymentStatus !== 'PAID' && (
                  <button 
                    onClick={() => setShowPaymentModal(true)}
                    className="px-4 py-2 text-sm font-medium rounded-md text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: getThemeColor() }}
                  >
                    <DollarSign className="h-4 w-4 mr-2 inline" />
                    Add Payment
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs and Action Buttons */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('invoice')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'invoice' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Invoice
            </button>
            <button
              onClick={() => setActiveTab('receipt')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'receipt' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Receipt Summary
            </button>
            <button
              onClick={() => setActiveTab('credit')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'credit' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Credit Note Summary
            </button>
            <button
              onClick={() => setActiveTab('attachment')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'attachment' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Attachment
            </button>
          </div>

          <div className="flex space-x-3">
            {canUseProjectsModule && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsProjectModalOpen(true)}
                className="flex items-center gap-2"
              >
                <KanbanSquare className="h-4 w-4" />
                Create Project
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowCreditNoteModal(true)}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Create Credit Note
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleReceiptReminder}
              disabled={sendingReceiptReminder || !invoice || (invoice.payments?.length || 0) === 0}
            >
              <Receipt className="h-4 w-4 mr-2" />
              {sendingReceiptReminder ? 'Sending...' : 'Receipt Reminder'}
            </Button>
            <button 
              className="px-4 py-2 text-sm font-medium rounded-md text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: getThemeColor() }}
            >
              <Send className="h-4 w-4 mr-2 inline" />
              Resend Invoice
            </button>
            <button 
              className="px-4 py-2 text-sm font-medium rounded-md text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: getThemeColor() }}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2 inline" />
              Download
            </button>
          </div>
        </div>

          {/* Main Content */}
        {activeTab === 'invoice' && (
          <div className="space-y-6">
            {/* Invoice Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Invoice</h2>
                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <span>Issue Date: {new Date(invoice.issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      <span>Due Date: {new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </div>
                      </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900 mb-2">#{invoice.number}</div>
                    {getStatusBadge(invoice.status)}
                      </div>
                      </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Billed To */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Billed To :</h3>
                    <div className="text-sm text-gray-900">
                      <div className="font-medium">{customerName}</div>
                      <div className="text-gray-600">
                        {invoice.account?.email || invoice.distributor?.email || invoice.lead?.email}
                      </div>
                      <div className="text-gray-600">
                        {invoice.account?.phone || invoice.distributor?.phone || invoice.lead?.phone}
                      </div>
                      <div className="text-gray-600 mt-2">Tax Number: -</div>
                    </div>
                  </div>

                  {/* Shipped To */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Shipped To :</h3>
                    <div className="text-sm text-gray-900">
                      <div className="font-medium">{customerName}</div>
                      <div className="text-gray-600">
                        {invoice.account?.email || invoice.distributor?.email || invoice.lead?.email}
                      </div>
                      <div className="text-gray-600">
                        {invoice.account?.phone || invoice.distributor?.phone || invoice.lead?.phone}
                        </div>
                    </div>
                  </div>

                  {/* Status and QR Code */}
                  <div className="text-center">
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Status :</h3>
                      {getStatusBadge(invoice.status)}
                    </div>
                    {invoice.qrCodeData ? (
                      <div className="w-32 h-32 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center mx-auto p-2">
                        <img 
                          src={invoice.qrCodeData} 
                          alt="QR Code" 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            // If image fails to load, show placeholder
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center mx-auto"><svg class="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg></div>';
                            }
                          }}
                        />
                </div>
                    ) : (
                      <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                        <QrCode className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Item Summary */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Item Summary</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: getThemeColor() || '#2563eb' }}>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ITEM TYPE</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ITEM</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">QUANTITY</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">RATE</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">DISCOUNT</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">TAX</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">DESCRIPTION</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">PRICE AFTER<br/>DISCOUNT & TAX</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoice.lines.map((line, index) => (
                        <tr key={line.id}>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">Product</td>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            <div className="flex items-center space-x-3">
                              <ProductImage images={line.images} name={line.productName} size="sm" />
                              <span>{line.productName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{line.quantity}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{getCurrencySymbol(invoice.currency)}{line.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{getCurrencySymbol(invoice.currency)}{line.discount.toFixed(2)}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            VAT (15%) {getCurrencySymbol(invoice.currency)}{((line.lineTotal - line.discount) * 0.15).toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                            {line.productName} - Professional service delivery
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {getCurrencySymbol(invoice.currency)}{line.lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Breakdown and Total Section */}
                <div className="mt-6 flex justify-end">
                  <div className="w-full max-w-md space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal:</span>
                      <span className="font-medium text-gray-900">{getCurrencySymbol(invoice.currency)}{invoice.subtotal.toFixed(2)}</span>
                    </div>
                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Discount:</span>
                        <span className="font-medium text-green-600">-{getCurrencySymbol(invoice.currency)}{invoice.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {!invoice.taxInclusive && invoice.tax > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Tax:</span>
                        <span className="font-medium text-gray-900">{getCurrencySymbol(invoice.currency)}{invoice.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between text-lg font-bold text-gray-900">
                        <span>{invoice.taxInclusive ? 'Total (Tax Inclusive):' : 'Total:'}</span>
                        <span>{getCurrencySymbol(invoice.currency)}{invoice.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payments Section */}
            {invoice.payments && invoice.payments.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Payments</h2>
                  <div className="space-y-4">
                    {invoice.payments.map((paymentAllocation) => (
                      <div key={paymentAllocation.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Receipt className="h-5 w-5 text-gray-600" />
                              <div>
                                <h3 className="font-medium text-gray-900">{paymentAllocation.payment.number}</h3>
                                <p className="text-sm text-gray-600">
                                  {getPaymentMethodLabel(paymentAllocation.payment.method)} • 
                                  {new Date(paymentAllocation.payment.receivedAt).toLocaleDateString('en-GB', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric' 
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="ml-8 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Amount:</span>
                                <span className="font-medium text-gray-900">{getCurrencySymbol(invoice.currency)}{paymentAllocation.amount.toFixed(2)}</span>
                              </div>
                              {paymentAllocation.payment.reference && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Reference:</span>
                                  <span className="text-gray-900">{paymentAllocation.payment.reference}</span>
                                </div>
                              )}
                              {paymentAllocation.payment.receiver && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Received by:</span>
                                  <span className="text-gray-900">{paymentAllocation.payment.receiver.name}</span>
                                </div>
                              )}
                              {paymentAllocation.notes && (
                                <div className="text-sm text-gray-600 mt-2">
                                  <span className="font-medium">Notes:</span> {paymentAllocation.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {paymentAllocation.payment.receiptUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(paymentAllocation.payment.receiptUrl, '_blank')}
                              >
                                <FileDown className="h-4 w-4 mr-2" />
                                View Receipt
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePayment(paymentAllocation.payment.id)}
                              disabled={deletingPaymentId === paymentAllocation.payment.id}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              {deletingPaymentId === paymentAllocation.payment.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Receipt Summary Tab */}
        {activeTab === 'receipt' && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Receipt Summary</h2>
              {invoice.payments && invoice.payments.length > 0 ? (
                <div className="space-y-4">
                  {invoice.payments.map((paymentAllocation) => (
                    <div key={paymentAllocation.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <Receipt className="h-5 w-5 text-gray-600" />
                          <div>
                            <h3 className="font-medium text-gray-900">{paymentAllocation.payment.number}</h3>
                            <p className="text-sm text-gray-600">
                              {new Date(paymentAllocation.payment.receivedAt).toLocaleDateString('en-GB', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            {getCurrencySymbol(invoice.currency)}{paymentAllocation.amount.toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {getPaymentMethodLabel(paymentAllocation.payment.method)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {paymentAllocation.payment.reference && (
                          <div>
                            <span className="text-gray-600">Reference:</span>
                            <span className="ml-2 text-gray-900">{paymentAllocation.payment.reference}</span>
                          </div>
                        )}
                        {paymentAllocation.payment.receiver && (
                          <div>
                            <span className="text-gray-600">Received by:</span>
                            <span className="ml-2 text-gray-900">{paymentAllocation.payment.receiver.name}</span>
                          </div>
                        )}
                      </div>
                      {paymentAllocation.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Notes:</span> {paymentAllocation.notes}
                          </p>
                        </div>
                      )}
                      {paymentAllocation.payment.receiptUrl && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(paymentAllocation.payment.receiptUrl, '_blank')}
                          >
                            <FileDown className="h-4 w-4 mr-2" />
                            Download Receipt
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No payment receipts recorded for this invoice.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'credit' && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Credit Notes</h2>
                <Button 
                  onClick={() => setShowCreditNoteModal(true)}
                  style={{ backgroundColor: theme.primary, color: 'white' }}
                  className="hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Credit Note
                </Button>
              </div>
              
              {invoice?.creditNotes && invoice.creditNotes.length > 0 ? (
                <div className="space-y-4">
                  {invoice.creditNotes.map((creditNote) => (
                    <div key={creditNote.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <FileDown className="h-5 w-5 text-gray-600" />
                          <div>
                            <h3 className="font-medium text-gray-900">{creditNote.number}</h3>
                            <p className="text-sm text-gray-600">
                              {REASON_LABELS[creditNote.reason] || creditNote.reason}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getCreditNoteStatusIcon(creditNote.status)}
                          {getCreditNoteStatusBadge(creditNote.status)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-gray-600">Credit Amount</p>
                          <p className="font-medium text-gray-900">
                            {getCurrencySymbol(invoice.currency)}{creditNote.amount.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Applied Amount</p>
                          <p className="font-medium text-green-600">
                            {getCurrencySymbol(invoice.currency)}{creditNote.appliedAmount.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Remaining Amount</p>
                          <p className="font-medium text-orange-600">
                            {getCurrencySymbol(invoice.currency)}{creditNote.remainingAmount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Issued: {new Date(creditNote.issueDate).toLocaleDateString()}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/credit-notes/${creditNote.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                      
                      {creditNote.applications.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm font-medium text-gray-700 mb-2">Applications:</p>
                          <div className="space-y-1">
                            {creditNote.applications.map((application) => (
                              <div key={application.id} className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">
                                  Applied {getCurrencySymbol(invoice.currency)}{application.amount.toFixed(2)} on{' '}
                                  {new Date(application.appliedAt).toLocaleDateString()}
                                </span>
                                {application.notes && (
                                  <span className="text-gray-500 italic">"{application.notes}"</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No credit notes have been issued for this invoice.</p>
                  <Button 
                    onClick={() => setShowCreditNoteModal(true)}
                    style={{ backgroundColor: theme.primary, color: 'white' }}
                    className="hover:opacity-90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Credit Note
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'attachment' && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Attachments</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // TODO: Implement attachment upload modal
                    showError('Attachment upload feature coming soon');
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Attachment
                </Button>
              </div>
              <div className="text-center py-8">
                <Paperclip className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No attachments uploaded for this invoice.</p>
                <p className="text-sm text-gray-500 mt-2">Upload receipts, documents, or other files related to this invoice.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Modal */}
      {invoice && (
        <AddPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            loadInvoice(); // Reload invoice to show updated payment status
            setShowPaymentModal(false);
          }}
          accountId={invoice.accountId || invoice.account?.id || ''}
          accountName={invoice.account?.name || 'Unknown Customer'}
          preSelectedInvoice={{
            id: invoice.id,
            number: invoice.number,
            total: invoice.total,
            amountPaid: invoice.amountPaid,
            amountDue: invoice.amountDue
          }}
        />
      )}

      {/* Credit Note Modal */}
      {invoice && (
        <CreditNoteModal
          isOpen={showCreditNoteModal}
          onClose={() => setShowCreditNoteModal(false)}
          onSuccess={() => {
            loadInvoice(); // Reload invoice to show updated credit notes
            setShowCreditNoteModal(false);
          }}
          invoiceId={invoice.id}
        />
      )}

      {invoice && canUseProjectsModule && (
        <AddProjectModal
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
          onProjectCreated={() => setIsProjectModalOpen(false)}
          initialData={projectInitialData}
        />
      )}
    </>
  );
}
