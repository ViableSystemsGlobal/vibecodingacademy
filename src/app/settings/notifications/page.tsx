'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { useSession } from 'next-auth/react';
import { useCompany } from '@/contexts/company-context';
import { 
  Mail, 
  MessageSquare, 
  Save,
  RefreshCw,
  TestTube,
  Settings,
  Bell,
  Send,
  AlertTriangle,
  ShoppingCart,
  Users,
  DollarSign,
  FileText,
  MessageCircle,
  UserPlus,
  UserCheck,
  User,
  FolderKanban,
  CheckSquare,
  Receipt,
  FileCheck,
  CreditCard,
  Package,
  Building,
  TrendingUp,
  Calendar,
  MessageSquareMore,
  ClipboardList,
  Warehouse,
  BarChart3,
  Globe,
  Server,
  Activity,
  Zap
} from 'lucide-react';

// Template interfaces
interface NotificationTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  variables: string[];
}

// Default email templates
const DEFAULT_EMAIL_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'stock_low',
    name: 'Low Stock Alert',
    subject: 'Low Stock Alert: {{productName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e67e22;">Low Stock Alert</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>The following product is running low on stock:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Product:</strong> {{productName}}<br>
    <strong>SKU:</strong> {{productSku}}<br>
    <strong>Current Stock:</strong> {{currentStock}} units<br>
    <strong>Reorder Point:</strong> {{reorderPoint}} units<br>
    <strong>Warehouse:</strong> {{warehouseName}}
  </div>
  
  <p>Please consider placing a new order to avoid stockouts.</p>
  
  <p>Best regards,<br>
  {{companyName}} Inventory System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'productName', 'productSku', 'currentStock', 'reorderPoint', 'warehouseName', 'companyName']
  },
  {
    id: 'stock_out',
    name: 'Out of Stock Alert',
    subject: 'Out of Stock: {{productName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e74c3c;">Out of Stock Alert</h2>
  <p>Hello {{recipientName}},</p>
  
  <p><strong>URGENT:</strong> The following product is now out of stock:</p>
  
  <div style="background: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
    <strong>Product:</strong> {{productName}}<br>
    <strong>SKU:</strong> {{productSku}}<br>
    <strong>Current Stock:</strong> 0 units<br>
    <strong>Warehouse:</strong> {{warehouseName}}
  </div>
  
  <p>Please place an urgent order to restock this item.</p>
  
  <p>Best regards,<br>
  {{companyName}} Inventory System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'productName', 'productSku', 'warehouseName', 'companyName']
  },
  {
    id: 'new_order',
    name: 'New Order Notification',
    subject: 'New Order Received: #{{orderNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">New Order Received</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new order has been received:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Order Number:</strong> #{{orderNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> {{currency}}{{totalAmount}}<br>
    <strong>Items:</strong> {{itemCount}} items<br>
    <strong>Date:</strong> {{orderDate}}
  </div>
  
  <p>Please process this order as soon as possible.</p>
  
  <p>Best regards,<br>
  {{companyName}} Order System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'orderNumber', 'customerName', 'totalAmount', 'currency', 'itemCount', 'orderDate', 'companyName']
  },
  {
    id: 'lead_created',
    name: 'Lead Created Notification',
    subject: 'New Lead Created: {{leadName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New Lead Created</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new lead has been created by {{creatorName}}:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Lead Name:</strong> {{leadName}}<br>
    <strong>Email:</strong> {{leadEmail}}<br>
    <strong>Phone:</strong> {{leadPhone}}<br>
    <strong>Company:</strong> {{leadCompany}}<br>
    <strong>Source:</strong> {{leadSource}}<br>
    <strong>Status:</strong> {{leadStatus}}<br>
    <strong>Created By:</strong> {{creatorName}}
  </div>
  
  <p>Please review and follow up with this lead as soon as possible.</p>
  
  <p>Best regards,<br>
  {{companyName}} CRM System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'leadName', 'leadEmail', 'leadPhone', 'leadCompany', 'leadSource', 'leadStatus', 'creatorName']
  },
  {
    id: 'lead_assigned',
    name: 'Lead Assigned Notification',
    subject: 'Lead Assigned to You: {{leadName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e67e22;">Lead Assigned to You</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>You have been assigned to a new lead by {{assignedByName}}:</p>
  
  <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e67e22;">
    <strong>Lead Name:</strong> {{leadName}}<br>
    <strong>Email:</strong> {{leadEmail}}<br>
    <strong>Phone:</strong> {{leadPhone}}<br>
    <strong>Company:</strong> {{leadCompany}}<br>
    <strong>Source:</strong> {{leadSource}}<br>
    <strong>Assigned By:</strong> {{assignedByName}}
  </div>
  
  <p>Please contact this lead promptly to begin the sales process.</p>
  
  <p>Best regards,<br>
  {{companyName}} CRM System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'leadName', 'leadEmail', 'leadPhone', 'leadCompany', 'leadSource', 'assignedByName', 'companyName']
  },
  {
    id: 'lead_owner_notification',
    name: 'Lead Owner Notification',
    subject: 'Lead Added to Your Account: {{leadName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #9b59b6;">Lead Added to Your Account</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new lead has been added to your account by {{creatorName}}:</p>
  
  <div style="background: #f4f0f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Lead Name:</strong> {{leadName}}<br>
    <strong>Email:</strong> {{leadEmail}}<br>
    <strong>Phone:</strong> {{leadPhone}}<br>
    <strong>Company:</strong> {{leadCompany}}<br>
    <strong>Source:</strong> {{leadSource}}<br>
    <strong>Status:</strong> {{leadStatus}}<br>
    <strong>Added By:</strong> {{creatorName}}
  </div>
  
  <p>This lead is now part of your account and you can manage it from your CRM dashboard.</p>
  
  <p>Best regards,<br>
  {{companyName}} CRM System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'leadName', 'leadEmail', 'leadPhone', 'leadCompany', 'leadSource', 'leadStatus', 'creatorName']
  },
  {
    id: 'lead_welcome',
    name: 'Lead Welcome Email',
    subject: 'Welcome to {{companyName}} - Thank You for Your Interest!',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Welcome to {{companyName}}!</h2>
  <p>Hello {{leadName}},</p>
  
  <p>Thank you for your interest in our products and services. We're excited to have you as a potential customer!</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p><strong>What happens next?</strong></p>
    <ul style="margin: 10px 0; padding-left: 20px;">
      <li>Our team will review your inquiry</li>
      <li>We'll contact you within 24 hours</li>
      <li>We'll provide you with detailed information about our products</li>
      <li>We'll answer any questions you may have</li>
    </ul>
  </div>
  
  <p>If you have any immediate questions, please don't hesitate to contact us.</p>
  
  <p>We look forward to working with you!</p>
  
  <p>Best regards,<br>
  <strong>{{companyName}} Team</strong></p>
</div>
    `.trim(),
    variables: ['leadName', 'assignedUserName', 'companyName']
  },
  // Inventory - Additional
  {
    id: 'stock_movement',
    name: 'Stock Movement',
    subject: 'Stock Movement: {{productName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">Stock Movement</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A stock movement has been recorded:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Product:</strong> {{productName}}<br>
    <strong>SKU:</strong> {{productSku}}<br>
    <strong>From Warehouse:</strong> {{fromWarehouse}}<br>
    <strong>To Warehouse:</strong> {{toWarehouse}}<br>
    <strong>Quantity:</strong> {{quantity}} units<br>
    <strong>Date:</strong> {{movementDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Inventory System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'productName', 'productSku', 'fromWarehouse', 'toWarehouse', 'quantity', 'movementDate', 'companyName']
  },
  {
    id: 'warehouse_update',
    name: 'Warehouse Update',
    subject: 'Warehouse Updated: {{warehouseName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #9b59b6;">Warehouse Information Updated</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>The following warehouse information has been updated:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Warehouse:</strong> {{warehouseName}}<br>
    <strong>Location:</strong> {{warehouseLocation}}<br>
    <strong>Updated By:</strong> {{updatedByName}}<br>
    <strong>Date:</strong> {{updateDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Inventory System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'warehouseName', 'warehouseLocation', 'updatedByName', 'updateDate', 'companyName']
  },
  // Orders - Additional
  {
    id: 'order_status',
    name: 'Order Status Change',
    subject: 'Order Status Updated: #{{orderNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">Order Status Updated</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>The status of order #{{orderNumber}} has been updated:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Order Number:</strong> #{{orderNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Previous Status:</strong> {{oldStatus}}<br>
    <strong>New Status:</strong> {{newStatus}}<br>
    <strong>Updated By:</strong> {{updatedByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Order System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'orderNumber', 'customerName', 'oldStatus', 'newStatus', 'updatedByName', 'companyName']
  },
  {
    id: 'order_cancelled',
    name: 'Order Cancelled',
    subject: 'Order Cancelled: #{{orderNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e74c3c;">Order Cancelled</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Order #{{orderNumber}} has been cancelled:</p>
  
  <div style="background: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
    <strong>Order Number:</strong> #{{orderNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Cancellation Reason:</strong> {{cancellationReason}}<br>
    <strong>Cancelled By:</strong> {{cancelledByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Order System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'orderNumber', 'customerName', 'totalAmount', 'cancellationReason', 'cancelledByName', 'companyName']
  },
  {
    id: 'backorder_created',
    name: 'Backorder Created',
    subject: 'Backorder Created: #{{orderNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e67e22;">Backorder Created</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A backorder has been created for order #{{orderNumber}}:</p>
  
  <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e67e22;">
    <strong>Order Number:</strong> #{{orderNumber}}<br>
    <strong>Product:</strong> {{productName}}<br>
    <strong>SKU:</strong> {{productSku}}<br>
    <strong>Quantity:</strong> {{quantity}} units<br>
    <strong>Reason:</strong> {{reason}}
  </div>
  
  <p>Please restock this item as soon as possible.</p>
  
  <p>Best regards,<br>
  {{companyName}} Order System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'orderNumber', 'productName', 'productSku', 'quantity', 'reason', 'companyName']
  },
  // Payments - Additional
  {
    id: 'payment_received',
    name: 'Payment Received',
    subject: 'Payment Received: GHS {{paymentAmount}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Payment Received</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A payment has been received:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Payment Amount:</strong> GHS {{paymentAmount}}<br>
    <strong>Invoice Number:</strong> #{{invoiceNumber}}<br>
    <strong>Payment Method:</strong> {{paymentMethod}}<br>
    <strong>Remaining Balance:</strong> GHS {{balance}}<br>
    <strong>Date:</strong> {{paymentDate}}
  </div>
  
  <p>Thank you for your payment!</p>
  
  <p>Best regards,<br>
  {{companyName}} Finance Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'paymentAmount', 'invoiceNumber', 'paymentMethod', 'balance', 'paymentDate', 'companyName']
  },
  {
    id: 'payment_failed',
    name: 'Payment Failed',
    subject: 'Payment Failed: Invoice #{{invoiceNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e74c3c;">Payment Failed</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A payment attempt has failed:</p>
  
  <div style="background: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
    <strong>Invoice Number:</strong> #{{invoiceNumber}}<br>
    <strong>Amount:</strong> GHS {{amount}}<br>
    <strong>Payment Method:</strong> {{paymentMethod}}<br>
    <strong>Error:</strong> {{errorMessage}}
  </div>
  
  <p>Please try again or contact support if the issue persists.</p>
  
  <p>Best regards,<br>
  {{companyName}} Finance Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'invoiceNumber', 'amount', 'paymentMethod', 'errorMessage', 'companyName']
  },
  {
    id: 'payment_refunded',
    name: 'Payment Refunded',
    subject: 'Payment Refunded: GHS {{refundAmount}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">Payment Refunded</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A refund has been processed:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Refund Amount:</strong> GHS {{refundAmount}}<br>
    <strong>Payment Number:</strong> #{{paymentNumber}}<br>
    <strong>Refund Reason:</strong> {{refundReason}}<br>
    <strong>Date:</strong> {{refundDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Finance Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'refundAmount', 'paymentNumber', 'refundReason', 'refundDate', 'companyName']
  },
  // Invoices
  {
    id: 'invoice_created',
    name: 'Invoice Created',
    subject: 'Invoice Created: #{{invoiceNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">Invoice Created</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new invoice has been created:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Invoice Number:</strong> #{{invoiceNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Due Date:</strong> {{dueDate}}<br>
    <strong>Created By:</strong> {{createdByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Finance Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'invoiceNumber', 'customerName', 'totalAmount', 'dueDate', 'createdByName', 'companyName']
  },
  {
    id: 'invoice_sent',
    name: 'Invoice Sent',
    subject: 'Invoice Sent: #{{invoiceNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Invoice Sent</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Invoice #{{invoiceNumber}} has been sent to {{customerName}}:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Invoice Number:</strong> #{{invoiceNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Due Date:</strong> {{dueDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Finance Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'invoiceNumber', 'customerName', 'totalAmount', 'dueDate', 'companyName']
  },
  {
    id: 'invoice_overdue',
    name: 'Invoice Overdue',
    subject: 'URGENT: Invoice Overdue - #{{invoiceNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e74c3c;">Invoice Overdue</h2>
  <p>Hello {{recipientName}},</p>
  
  <p><strong>URGENT:</strong> The following invoice is now overdue:</p>
  
  <div style="background: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
    <strong>Invoice Number:</strong> #{{invoiceNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Due Date:</strong> {{dueDate}}<br>
    <strong>Days Overdue:</strong> {{daysOverdue}} days
  </div>
  
  <p>Please follow up with the customer immediately.</p>
  
  <p>Best regards,<br>
  {{companyName}} Finance Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'invoiceNumber', 'customerName', 'totalAmount', 'dueDate', 'daysOverdue', 'companyName']
  },
  {
    id: 'invoice_paid',
    name: 'Invoice Paid',
    subject: 'Invoice Paid: #{{invoiceNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Invoice Paid</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Invoice #{{invoiceNumber}} has been fully paid:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Invoice Number:</strong> #{{invoiceNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Payment Date:</strong> {{paymentDate}}
  </div>
  
  <p>Thank you!</p>
  
  <p>Best regards,<br>
  {{companyName}} Finance Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'invoiceNumber', 'customerName', 'totalAmount', 'paymentDate', 'companyName']
  },
  // Quotations
  {
    id: 'quotation_created',
    name: 'Quotation Created',
    subject: 'Quotation Created: #{{quotationNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">Quotation Created</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new quotation has been created:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Quotation Number:</strong> #{{quotationNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Valid Until:</strong> {{expiryDate}}<br>
    <strong>Created By:</strong> {{createdByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Sales Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'quotationNumber', 'customerName', 'totalAmount', 'expiryDate', 'createdByName', 'companyName']
  },
  {
    id: 'quotation_sent',
    name: 'Quotation Sent',
    subject: 'Quotation Sent: #{{quotationNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Quotation Sent</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Quotation #{{quotationNumber}} has been sent to {{customerName}}:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Quotation Number:</strong> #{{quotationNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Valid Until:</strong> {{expiryDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Sales Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'quotationNumber', 'customerName', 'totalAmount', 'expiryDate', 'companyName']
  },
  {
    id: 'quotation_accepted',
    name: 'Quotation Accepted',
    subject: 'Quotation Accepted: #{{quotationNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Quotation Accepted!</h2>
  <p>Hello {{recipientName}},</p>
  
  <p><strong>Great news!</strong> Quotation #{{quotationNumber}} has been accepted by {{customerName}}:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Quotation Number:</strong> #{{quotationNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Accepted Date:</strong> {{acceptedDate}}
  </div>
  
  <p>Please proceed with order processing.</p>
  
  <p>Best regards,<br>
  {{companyName}} Sales Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'quotationNumber', 'customerName', 'totalAmount', 'acceptedDate', 'companyName']
  },
  {
    id: 'quotation_expired',
    name: 'Quotation Expired',
    subject: 'Quotation Expired: #{{quotationNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e67e22;">Quotation Expired</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Quotation #{{quotationNumber}} has expired:</p>
  
  <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e67e22;">
    <strong>Quotation Number:</strong> #{{quotationNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Expiry Date:</strong> {{expiryDate}}
  </div>
  
  <p>Please create a new quotation if the customer is still interested.</p>
  
  <p>Best regards,<br>
  {{companyName}} Sales Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'quotationNumber', 'customerName', 'totalAmount', 'expiryDate', 'companyName']
  },
  // Projects
  {
    id: 'project_created',
    name: 'Project Created',
    subject: 'New Project: {{projectName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New Project Created</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new project has been created and you have been assigned:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Project Name:</strong> {{projectName}}<br>
    <strong>Your Role:</strong> {{role}}<br>
    <strong>Start Date:</strong> {{startDate}}<br>
    <strong>End Date:</strong> {{endDate}}<br>
    <strong>Created By:</strong> {{createdByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'projectName', 'role', 'startDate', 'endDate', 'createdByName', 'companyName']
  },
  {
    id: 'project_updated',
    name: 'Project Updated',
    subject: 'Project Updated: {{projectName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">Project Updated</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Project "{{projectName}}" has been updated:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Project Name:</strong> {{projectName}}<br>
    <strong>Changes:</strong> {{changes}}<br>
    <strong>Updated By:</strong> {{updatedByName}}<br>
    <strong>Date:</strong> {{updateDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'projectName', 'changes', 'updatedByName', 'updateDate', 'companyName']
  },
  {
    id: 'project_completed',
    name: 'Project Completed',
    subject: 'Project Completed: {{projectName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Project Completed!</h2>
  <p>Hello {{recipientName}},</p>
  
  <p><strong>Congratulations!</strong> Project "{{projectName}}" has been completed successfully:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Project Name:</strong> {{projectName}}<br>
    <strong>Completion Date:</strong> {{completionDate}}<br>
    <strong>Duration:</strong> {{duration}}
  </div>
  
  <p>Great work on completing this project!</p>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'projectName', 'completionDate', 'duration', 'companyName']
  },
  {
    id: 'project_member_added',
    name: 'Project Member Added',
    subject: 'Added to Project: {{projectName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #9b59b6;">Added to Project</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>You have been added to project "{{projectName}}":</p>
  
  <div style="background: #f4f0f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Project Name:</strong> {{projectName}}<br>
    <strong>Your Role:</strong> {{role}}<br>
    <strong>Added By:</strong> {{addedByName}}<br>
    <strong>Date:</strong> {{addedDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'projectName', 'role', 'addedByName', 'addedDate', 'companyName']
  },
  // Tasks
  {
    id: 'task_created',
    name: 'Task Created',
    subject: 'New Task: {{taskTitle}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New Task Created</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new task has been created:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Task:</strong> {{taskTitle}}<br>
    <strong>Project:</strong> {{projectName}}<br>
    <strong>Due Date:</strong> {{dueDate}}<br>
    <strong>Priority:</strong> {{priority}}<br>
    <strong>Created By:</strong> {{createdByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'taskTitle', 'projectName', 'dueDate', 'priority', 'createdByName', 'companyName']
  },
  {
    id: 'task_assigned',
    name: 'Task Assigned',
    subject: 'Task Assigned to You: {{taskTitle}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e67e22;">Task Assigned to You</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>You have been assigned a new task:</p>
  
  <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e67e22;">
    <strong>Task:</strong> {{taskTitle}}<br>
    <strong>Project:</strong> {{projectName}}<br>
    <strong>Due Date:</strong> {{dueDate}}<br>
    <strong>Priority:</strong> {{priority}}<br>
    <strong>Assigned By:</strong> {{assignedByName}}
  </div>
  
  <p>Please review and start working on this task.</p>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'taskTitle', 'projectName', 'dueDate', 'priority', 'assignedByName', 'companyName']
  },
  {
    id: 'task_due_soon',
    name: 'Task Due Soon',
    subject: 'REMINDER: Task Due Soon - {{taskTitle}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e67e22;">Task Due Soon</h2>
  <p>Hello {{recipientName}},</p>
  
  <p><strong>REMINDER:</strong> The following task is due soon:</p>
  
  <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e67e22;">
    <strong>Task:</strong> {{taskTitle}}<br>
    <strong>Project:</strong> {{projectName}}<br>
    <strong>Due Date:</strong> {{dueDate}}<br>
    <strong>Priority:</strong> {{priority}}
  </div>
  
  <p>Please complete this task before the due date.</p>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'taskTitle', 'projectName', 'dueDate', 'priority', 'companyName']
  },
  {
    id: 'task_overdue',
    name: 'Task Overdue',
    subject: 'URGENT: Task Overdue - {{taskTitle}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e74c3c;">Task Overdue</h2>
  <p>Hello {{recipientName}},</p>
  
  <p><strong>URGENT:</strong> The following task is overdue:</p>
  
  <div style="background: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
    <strong>Task:</strong> {{taskTitle}}<br>
    <strong>Project:</strong> {{projectName}}<br>
    <strong>Due Date:</strong> {{dueDate}}<br>
    <strong>Days Overdue:</strong> {{daysOverdue}} days<br>
    <strong>Priority:</strong> {{priority}}
  </div>
  
  <p>Please complete this task immediately.</p>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'taskTitle', 'projectName', 'dueDate', 'daysOverdue', 'priority', 'companyName']
  },
  {
    id: 'task_completed',
    name: 'Task Completed',
    subject: 'Task Completed: {{taskTitle}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Task Completed</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Task "{{taskTitle}}" has been marked as completed:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Task:</strong> {{taskTitle}}<br>
    <strong>Project:</strong> {{projectName}}<br>
    <strong>Completed By:</strong> {{completedByName}}<br>
    <strong>Completion Date:</strong> {{completionDate}}
  </div>
  
  <p>Great work!</p>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'taskTitle', 'projectName', 'completedByName', 'completionDate', 'companyName']
  },
  {
    id: 'task_comment',
    name: 'Task Comment',
    subject: 'New Comment on Task: {{taskTitle}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New Task Comment</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>{{commenterName}} commented on task "{{taskTitle}}":</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Task:</strong> {{taskTitle}}<br>
    <strong>Project:</strong> {{projectName}}<br>
    <strong>Comment:</strong> {{commentPreview}}<br>
    <strong>Commented By:</strong> {{commenterName}}<br>
    <strong>Date:</strong> {{commentDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Project Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'taskTitle', 'projectName', 'commentPreview', 'commenterName', 'commentDate', 'companyName']
  },
  // Leads - Additional
  {
    id: 'lead_converted',
    name: 'Lead Converted',
    subject: 'Lead Converted: {{leadName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Lead Converted</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Lead "{{leadName}}" has been converted to an opportunity:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Lead Name:</strong> {{leadName}}<br>
    <strong>Opportunity Value:</strong> GHS {{opportunityValue}}<br>
    <strong>Stage:</strong> {{stage}}<br>
    <strong>Converted By:</strong> {{convertedByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} CRM System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'leadName', 'opportunityValue', 'stage', 'convertedByName', 'companyName']
  },
  // Opportunities
  {
    id: 'opportunity_created',
    name: 'Opportunity Created',
    subject: 'New Opportunity: {{opportunityName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New Opportunity Created</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new opportunity has been created:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Opportunity:</strong> {{opportunityName}}<br>
    <strong>Value:</strong> GHS {{value}}<br>
    <strong>Stage:</strong> {{stage}}<br>
    <strong>Account:</strong> {{accountName}}<br>
    <strong>Created By:</strong> {{createdByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} CRM System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'opportunityName', 'value', 'stage', 'accountName', 'createdByName', 'companyName']
  },
  {
    id: 'opportunity_won',
    name: 'Opportunity Won',
    subject: 'Opportunity Won: {{opportunityName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Opportunity Won!</h2>
  <p>Hello {{recipientName}},</p>
  
  <p><strong>Congratulations!</strong> Opportunity "{{opportunityName}}" has been won:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Opportunity:</strong> {{opportunityName}}<br>
    <strong>Value:</strong> GHS {{value}}<br>
    <strong>Account:</strong> {{accountName}}<br>
    <strong>Won Date:</strong> {{wonDate}}
  </div>
  
  <p>Excellent work!</p>
  
  <p>Best regards,<br>
  {{companyName}} CRM System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'opportunityName', 'value', 'accountName', 'wonDate', 'companyName']
  },
  {
    id: 'opportunity_lost',
    name: 'Opportunity Lost',
    subject: 'Opportunity Lost: {{opportunityName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e74c3c;">Opportunity Lost</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Opportunity "{{opportunityName}}" has been marked as lost:</p>
  
  <div style="background: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
    <strong>Opportunity:</strong> {{opportunityName}}<br>
    <strong>Value:</strong> GHS {{value}}<br>
    <strong>Reason:</strong> {{reason}}<br>
    <strong>Lost Date:</strong> {{lostDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} CRM System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'opportunityName', 'value', 'reason', 'lostDate', 'companyName']
  },
  // Accounts & Contacts
  {
    id: 'account_created',
    name: 'Account Created',
    subject: 'New Account: {{accountName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New Account Created</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new account has been created and assigned to you:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Account Name:</strong> {{accountName}}<br>
    <strong>Industry:</strong> {{industry}}<br>
    <strong>Created By:</strong> {{createdByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} CRM System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'accountName', 'industry', 'createdByName', 'companyName']
  },
  {
    id: 'contact_created',
    name: 'Contact Created',
    subject: 'New Contact: {{contactName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New Contact Created</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new contact has been added:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Contact Name:</strong> {{contactName}}<br>
    <strong>Email:</strong> {{contactEmail}}<br>
    <strong>Phone:</strong> {{contactPhone}}<br>
    <strong>Account:</strong> {{accountName}}<br>
    <strong>Created By:</strong> {{createdByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} CRM System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'contactName', 'contactEmail', 'contactPhone', 'accountName', 'createdByName', 'companyName']
  },
  // Ecommerce
  {
    id: 'ecommerce_order_placed',
    name: 'Ecommerce Order Placed',
    subject: 'New Ecommerce Order: #{{orderNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">New Ecommerce Order</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new order has been placed on the storefront:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Order Number:</strong> #{{orderNumber}}<br>
    <strong>Customer:</strong> {{customerName}}<br>
    <strong>Email:</strong> {{customerEmail}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Items:</strong> {{itemCount}} items<br>
    <strong>Date:</strong> {{orderDate}}
  </div>
  
  <p>Please process this order as soon as possible.</p>
  
  <p>Best regards,<br>
  {{companyName}} Ecommerce Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'orderNumber', 'customerName', 'customerEmail', 'totalAmount', 'itemCount', 'orderDate', 'companyName']
  },
  {
    id: 'ecommerce_order_status',
    name: 'Ecommerce Order Status',
    subject: 'Your Order Status: #{{orderNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">Order Status Update</h2>
  <p>Hello {{customerName}},</p>
  
  <p>Your order status has been updated:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Order Number:</strong> #{{orderNumber}}<br>
    <strong>Status:</strong> {{status}}<br>
    <strong>Delivery Info:</strong> {{deliveryInfo}}
  </div>
  
  <p>Thank you for shopping with us!</p>
  
  <p>Best regards,<br>
  {{companyName}} Team</p>
</div>
    `.trim(),
    variables: ['customerName', 'orderNumber', 'status', 'deliveryInfo', 'companyName']
  },
  {
    id: 'ecommerce_customer_registered',
    name: 'Customer Registered',
    subject: 'New Customer Registration',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New Customer Registered</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new customer has registered on the storefront:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Customer Name:</strong> {{customerName}}<br>
    <strong>Email:</strong> {{customerEmail}}<br>
    <strong>Phone:</strong> {{customerPhone}}<br>
    <strong>Registration Date:</strong> {{registrationDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Ecommerce Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'customerName', 'customerEmail', 'customerPhone', 'registrationDate', 'companyName']
  },
  {
    id: 'ecommerce_product_low_stock',
    name: 'Ecommerce Product Low Stock',
    subject: 'Ecommerce Product Low Stock: {{productName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e67e22;">Ecommerce Product Low Stock</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>An ecommerce product is running low on stock:</p>
  
  <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e67e22;">
    <strong>Product:</strong> {{productName}}<br>
    <strong>SKU:</strong> {{productSku}}<br>
    <strong>Current Stock:</strong> {{currentStock}} units<br>
    <strong>Reorder Point:</strong> {{reorderPoint}} units
  </div>
  
  <p>Please restock this item to avoid out-of-stock situations on the storefront.</p>
  
  <p>Best regards,<br>
  {{companyName}} Ecommerce Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'productName', 'productSku', 'currentStock', 'reorderPoint', 'companyName']
  },
  // DRM
  {
    id: 'distributor_lead_created',
    name: 'Distributor Lead Created',
    subject: 'New Distributor Lead: {{leadName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New Distributor Lead</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new distributor lead has been created:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Lead Name:</strong> {{leadName}}<br>
    <strong>Email:</strong> {{leadEmail}}<br>
    <strong>Phone:</strong> {{leadPhone}}<br>
    <strong>Company:</strong> {{leadCompany}}<br>
    <strong>Created By:</strong> {{createdByName}}
  </div>
  
  <p>Please review and follow up with this distributor lead.</p>
  
  <p>Best regards,<br>
  {{companyName}} DRM Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'leadName', 'leadEmail', 'leadPhone', 'leadCompany', 'createdByName', 'companyName']
  },
  {
    id: 'distributor_approved',
    name: 'Distributor Approved',
    subject: 'Distributor Approved: {{distributorName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Distributor Approved</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Distributor "{{distributorName}}" has been approved:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Distributor:</strong> {{distributorName}}<br>
    <strong>Email:</strong> {{distributorEmail}}<br>
    <strong>Approved By:</strong> {{approvedByName}}<br>
    <strong>Approval Date:</strong> {{approvalDate}}
  </div>
  
  <p>They can now place orders through the DRM system.</p>
  
  <p>Best regards,<br>
  {{companyName}} DRM Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'distributorName', 'distributorEmail', 'approvedByName', 'approvalDate', 'companyName']
  },
  {
    id: 'drm_order_created',
    name: 'DRM Order Created',
    subject: 'New DRM Order: #{{orderNumber}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">New DRM Order</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new order has been placed by a distributor:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Order Number:</strong> #{{orderNumber}}<br>
    <strong>Distributor:</strong> {{distributorName}}<br>
    <strong>Total Amount:</strong> GHS {{totalAmount}}<br>
    <strong>Items:</strong> {{itemCount}} items<br>
    <strong>Date:</strong> {{orderDate}}
  </div>
  
  <p>Please process this order as soon as possible.</p>
  
  <p>Best regards,<br>
  {{companyName}} DRM Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'orderNumber', 'distributorName', 'totalAmount', 'itemCount', 'orderDate', 'companyName']
  },
  // Commissions
  {
    id: 'commission_calculated',
    name: 'Commission Calculated',
    subject: 'Commission Calculated: GHS {{commissionAmount}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Commission Calculated</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Your commission has been calculated:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Commission Amount:</strong> GHS {{commissionAmount}}<br>
    <strong>Period:</strong> {{period}}<br>
    <strong>Calculated Date:</strong> {{calculatedDate}}
  </div>
  
  <p>View details in your commissions dashboard.</p>
  
  <p>Best regards,<br>
  {{companyName}} Finance Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'commissionAmount', 'period', 'calculatedDate', 'companyName']
  },
  {
    id: 'commission_paid',
    name: 'Commission Paid',
    subject: 'Commission Paid: GHS {{commissionAmount}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">Commission Paid</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Your commission has been paid:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Commission Amount:</strong> GHS {{commissionAmount}}<br>
    <strong>Period:</strong> {{period}}<br>
    <strong>Payment Date:</strong> {{paymentDate}}<br>
    <strong>Payment Method:</strong> {{paymentMethod}}
  </div>
  
  <p>Thank you for your hard work!</p>
  
  <p>Best regards,<br>
  {{companyName}} Finance Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'commissionAmount', 'period', 'paymentDate', 'paymentMethod', 'companyName']
  },
  // Users & System
  {
    id: 'user_created',
    name: 'New User Created',
    subject: 'New User Account Created',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">New User Account</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>A new user account has been created:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Name:</strong> {{userName}}<br>
    <strong>Email:</strong> {{userEmail}}<br>
    <strong>Role:</strong> {{userRole}}<br>
    <strong>Created By:</strong> {{createdByName}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Admin Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'userName', 'userEmail', 'userRole', 'createdByName', 'companyName']
  },
  {
    id: 'user_login',
    name: 'User Login',
    subject: 'User Login Notification',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">User Login</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>User {{userName}} logged into the system:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>User:</strong> {{userName}}<br>
    <strong>Email:</strong> {{userEmail}}<br>
    <strong>Login Time:</strong> {{loginTime}}<br>
    <strong>IP Address:</strong> {{ipAddress}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'userName', 'userEmail', 'loginTime', 'ipAddress', 'companyName']
  },
  {
    id: 'user_role_changed',
    name: 'User Role Changed',
    subject: 'Your Role Has Been Changed',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #9b59b6;">Role Changed</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Your role has been changed:</p>
  
  <div style="background: #f4f0f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Previous Role:</strong> {{oldRole}}<br>
    <strong>New Role:</strong> {{newRole}}<br>
    <strong>Changed By:</strong> {{changedByName}}<br>
    <strong>Date:</strong> {{changeDate}}
  </div>
  
  <p>Please log out and log back in for changes to take effect.</p>
  
  <p>Best regards,<br>
  {{companyName}} Admin Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'oldRole', 'newRole', 'changedByName', 'changeDate', 'companyName']
  },
  {
    id: 'system_backup',
    name: 'System Backup',
    subject: 'System Backup Completed',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #27ae60;">System Backup Completed</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>System backup has been completed successfully:</p>
  
  <div style="background: #f0fff4; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Backup Size:</strong> {{backupSize}}<br>
    <strong>Backup Date:</strong> {{backupDate}}<br>
    <strong>Files Included:</strong> {{fileCount}} files
  </div>
  
  <p>Best regards,<br>
  {{companyName}} System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'backupSize', 'backupDate', 'fileCount', 'companyName']
  },
  {
    id: 'system_error',
    name: 'System Error',
    subject: 'URGENT: System Error Detected',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e74c3c;">System Error</h2>
  <p>Hello {{recipientName}},</p>
  
  <p><strong>URGENT:</strong> A system error has been detected:</p>
  
  <div style="background: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
    <strong>Error:</strong> {{errorMessage}}<br>
    <strong>Error Type:</strong> {{errorType}}<br>
    <strong>Time:</strong> {{errorTime}}
  </div>
  
  <p>Please check system logs immediately.</p>
  
  <p>Best regards,<br>
  {{companyName}} System</p>
</div>
    `.trim(),
    variables: ['recipientName', 'errorMessage', 'errorType', 'errorTime', 'companyName']
  },
  // Communication
  {
    id: 'email_campaign_sent',
    name: 'Email Campaign Sent',
    subject: 'Email Campaign Sent: {{campaignName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">Email Campaign Sent</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Email campaign has been sent successfully:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Campaign Name:</strong> {{campaignName}}<br>
    <strong>Recipients:</strong> {{recipientCount}} recipients<br>
    <strong>Sent Date:</strong> {{sentDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Marketing Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'campaignName', 'recipientCount', 'sentDate', 'companyName']
  },
  {
    id: 'sms_campaign_sent',
    name: 'SMS Campaign Sent',
    subject: 'SMS Campaign Sent: {{campaignName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">SMS Campaign Sent</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>SMS campaign has been sent successfully:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Campaign Name:</strong> {{campaignName}}<br>
    <strong>Recipients:</strong> {{recipientCount}} recipients<br>
    <strong>Sent Date:</strong> {{sentDate}}
  </div>
  
  <p>Best regards,<br>
  {{companyName}} Marketing Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'campaignName', 'recipientCount', 'sentDate', 'companyName']
  },
  // Reports
  {
    id: 'report_generated',
    name: 'Report Generated',
    subject: 'Report Generated: {{reportName}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #3498db;">Report Generated</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>Your scheduled report has been generated:</p>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <strong>Report Name:</strong> {{reportName}}<br>
    <strong>Generated Date:</strong> {{generatedDate}}<br>
    <strong>Format:</strong> {{reportFormat}}
  </div>
  
  <p>You can download the report from your reports dashboard.</p>
  
  <p>Best regards,<br>
  {{companyName}} Reports Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'reportName', 'generatedDate', 'reportFormat', 'companyName']
  },
  {
    id: 'analytics_alert',
    name: 'Analytics Alert',
    subject: 'Analytics Alert: {{alertMessage}}',
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #e67e22;">Analytics Alert</h2>
  <p>Hello {{recipientName}},</p>
  
  <p>An analytics threshold has been reached:</p>
  
  <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e67e22;">
    <strong>Alert:</strong> {{alertMessage}}<br>
    <strong>Threshold:</strong> {{threshold}}<br>
    <strong>Current Value:</strong> {{currentValue}}<br>
    <strong>Metric:</strong> {{metric}}
  </div>
  
  <p>Please review the analytics dashboard for more details.</p>
  
  <p>Best regards,<br>
  {{companyName}} Analytics Team</p>
</div>
    `.trim(),
    variables: ['recipientName', 'alertMessage', 'threshold', 'currentValue', 'metric', 'companyName']
  }
];

// Default SMS templates
const DEFAULT_SMS_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'stock_low',
    name: 'Low Stock Alert',
    body: 'ALERT: {{productName}} ({{productSku}}) is running low. Current stock: {{currentStock}} units. Reorder point: {{reorderPoint}} units.',
    variables: ['productName', 'productSku', 'currentStock', 'reorderPoint']
  },
  {
    id: 'stock_out',
    name: 'Out of Stock Alert',
    body: 'URGENT: {{productName}} ({{productSku}}) is OUT OF STOCK! Please place an urgent order.',
    variables: ['productName', 'productSku']
  },
  {
    id: 'new_order',
    name: 'New Order Notification',
    body: 'New Order #{{orderNumber}} received from {{customerName}} for GHS {{totalAmount}}. {{itemCount}} items.',
    variables: ['orderNumber', 'customerName', 'totalAmount', 'itemCount']
  },
  {
    id: 'lead_created',
    name: 'Lead Created Notification',
    body: 'New lead created: {{leadName}} ({{leadEmail}}) by {{creatorName}}. Company: {{leadCompany}}. Source: {{leadSource}}.',
    variables: ['leadName', 'leadEmail', 'creatorName', 'leadCompany', 'leadSource']
  },
  {
    id: 'lead_assigned',
    name: 'Lead Assigned Notification',
    body: 'Lead assigned to you: {{leadName}} ({{leadEmail}}) by {{assignedByName}}. Company: {{leadCompany}}. Source: {{leadSource}}. Please contact promptly.',
    variables: ['leadName', 'leadEmail', 'assignedByName', 'leadCompany', 'leadSource']
  },
  {
    id: 'lead_owner_notification',
    name: 'Lead Owner Notification',
    body: 'New lead added to your account: {{leadName}} ({{leadEmail}}) by {{creatorName}}. Company: {{leadCompany}}. Status: {{leadStatus}}.',
    variables: ['leadName', 'leadEmail', 'creatorName', 'leadCompany', 'leadStatus']
  },
  {
    id: 'lead_welcome',
    name: 'Lead Welcome SMS',
    body: 'Welcome to {{companyName}}! Thank you for your interest. We will contact you within 24 hours.',
    variables: ['assignedUserName', 'companyName']
  },
  // Inventory - Additional
  {
    id: 'stock_movement',
    name: 'Stock Movement',
    body: 'Stock movement: {{productName}} moved from {{fromWarehouse}} to {{toWarehouse}}. Quantity: {{quantity}} units.',
    variables: ['productName', 'fromWarehouse', 'toWarehouse', 'quantity']
  },
  {
    id: 'warehouse_update',
    name: 'Warehouse Update',
    body: 'Warehouse {{warehouseName}} information has been updated.',
    variables: ['warehouseName']
  },
  // Orders - Additional
  {
    id: 'order_status',
    name: 'Order Status Change',
    body: 'Order #{{orderNumber}} status changed: {{oldStatus}} → {{newStatus}}.',
    variables: ['orderNumber', 'oldStatus', 'newStatus']
  },
  {
    id: 'order_cancelled',
    name: 'Order Cancelled',
    body: 'Order #{{orderNumber}} has been cancelled. Reason: {{cancellationReason}}.',
    variables: ['orderNumber', 'cancellationReason']
  },
  {
    id: 'backorder_created',
    name: 'Backorder Created',
    body: 'Backorder created for Order #{{orderNumber}}. Product: {{productName}}. Quantity: {{quantity}}.',
    variables: ['orderNumber', 'productName', 'quantity']
  },
  // Payments - Additional
  {
    id: 'payment_received',
    name: 'Payment Received',
    body: 'Payment of GHS {{paymentAmount}} received for Invoice #{{invoiceNumber}}. Balance: GHS {{balance}}.',
    variables: ['paymentAmount', 'invoiceNumber', 'balance']
  },
  {
    id: 'payment_failed',
    name: 'Payment Failed',
    body: 'Payment failed for Invoice #{{invoiceNumber}}. Amount: GHS {{amount}}. Please try again.',
    variables: ['invoiceNumber', 'amount']
  },
  {
    id: 'payment_refunded',
    name: 'Payment Refunded',
    body: 'Refund of GHS {{refundAmount}} processed for Payment #{{paymentNumber}}.',
    variables: ['refundAmount', 'paymentNumber']
  },
  // Invoices
  {
    id: 'invoice_created',
    name: 'Invoice Created',
    body: 'Invoice #{{invoiceNumber}} created for {{customerName}}. Amount: GHS {{totalAmount}}. Due: {{dueDate}}.',
    variables: ['invoiceNumber', 'customerName', 'totalAmount', 'dueDate']
  },
  {
    id: 'invoice_sent',
    name: 'Invoice Sent',
    body: 'Invoice #{{invoiceNumber}} has been sent to {{customerName}}. Amount: GHS {{totalAmount}}.',
    variables: ['invoiceNumber', 'customerName', 'totalAmount']
  },
  {
    id: 'invoice_overdue',
    name: 'Invoice Overdue',
    body: 'URGENT: Invoice #{{invoiceNumber}} is overdue. Amount: GHS {{totalAmount}}. Please pay immediately.',
    variables: ['invoiceNumber', 'totalAmount']
  },
  {
    id: 'invoice_paid',
    name: 'Invoice Paid',
    body: 'Invoice #{{invoiceNumber}} has been fully paid. Amount: GHS {{totalAmount}}. Thank you!',
    variables: ['invoiceNumber', 'totalAmount']
  },
  // Quotations
  {
    id: 'quotation_created',
    name: 'Quotation Created',
    body: 'Quotation #{{quotationNumber}} created for {{customerName}}. Amount: GHS {{totalAmount}}.',
    variables: ['quotationNumber', 'customerName', 'totalAmount']
  },
  {
    id: 'quotation_sent',
    name: 'Quotation Sent',
    body: 'Quotation #{{quotationNumber}} sent to {{customerName}}. Valid until {{expiryDate}}.',
    variables: ['quotationNumber', 'customerName', 'expiryDate']
  },
  {
    id: 'quotation_accepted',
    name: 'Quotation Accepted',
    body: 'Great news! Quotation #{{quotationNumber}} has been accepted by {{customerName}}. Amount: GHS {{totalAmount}}.',
    variables: ['quotationNumber', 'customerName', 'totalAmount']
  },
  {
    id: 'quotation_expired',
    name: 'Quotation Expired',
    body: 'Quotation #{{quotationNumber}} has expired. Please create a new quotation if needed.',
    variables: ['quotationNumber']
  },
  // Projects
  {
    id: 'project_created',
    name: 'Project Created',
    body: 'New project "{{projectName}}" has been created. You have been assigned as {{role}}.',
    variables: ['projectName', 'role']
  },
  {
    id: 'project_updated',
    name: 'Project Updated',
    body: 'Project "{{projectName}}" has been updated. Changes: {{changes}}.',
    variables: ['projectName', 'changes']
  },
  {
    id: 'project_completed',
    name: 'Project Completed',
    body: 'Congratulations! Project "{{projectName}}" has been completed successfully.',
    variables: ['projectName']
  },
  {
    id: 'project_member_added',
    name: 'Project Member Added',
    body: 'You have been added to project "{{projectName}}" as {{role}}.',
    variables: ['projectName', 'role']
  },
  // Tasks
  {
    id: 'task_created',
    name: 'Task Created',
    body: 'New task "{{taskTitle}}" created in project "{{projectName}}". Due: {{dueDate}}.',
    variables: ['taskTitle', 'projectName', 'dueDate']
  },
  {
    id: 'task_assigned',
    name: 'Task Assigned',
    body: 'Task "{{taskTitle}}" assigned to you. Due: {{dueDate}}. Priority: {{priority}}.',
    variables: ['taskTitle', 'dueDate', 'priority']
  },
  {
    id: 'task_due_soon',
    name: 'Task Due Soon',
    body: 'REMINDER: Task "{{taskTitle}}" is due soon ({{dueDate}}). Please complete it.',
    variables: ['taskTitle', 'dueDate']
  },
  {
    id: 'task_overdue',
    name: 'Task Overdue',
    body: 'URGENT: Task "{{taskTitle}}" is overdue. Please complete it immediately.',
    variables: ['taskTitle']
  },
  {
    id: 'task_completed',
    name: 'Task Completed',
    body: 'Task "{{taskTitle}}" has been marked as completed. Great work!',
    variables: ['taskTitle']
  },
  {
    id: 'task_comment',
    name: 'Task Comment',
    body: 'New comment on task "{{taskTitle}}" by {{commenterName}}: {{commentPreview}}.',
    variables: ['taskTitle', 'commenterName', 'commentPreview']
  },
  // Leads - Additional
  {
    id: 'lead_converted',
    name: 'Lead Converted',
    body: 'Lead "{{leadName}}" has been converted to opportunity. Value: GHS {{opportunityValue}}.',
    variables: ['leadName', 'opportunityValue']
  },
  // Opportunities
  {
    id: 'opportunity_created',
    name: 'Opportunity Created',
    body: 'New opportunity "{{opportunityName}}" created. Value: GHS {{value}}. Stage: {{stage}}.',
    variables: ['opportunityName', 'value', 'stage']
  },
  {
    id: 'opportunity_won',
    name: 'Opportunity Won',
    body: 'Congratulations! Opportunity "{{opportunityName}}" has been won. Value: GHS {{value}}.',
    variables: ['opportunityName', 'value']
  },
  {
    id: 'opportunity_lost',
    name: 'Opportunity Lost',
    body: 'Opportunity "{{opportunityName}}" has been marked as lost. Reason: {{reason}}.',
    variables: ['opportunityName', 'reason']
  },
  // Accounts & Contacts
  {
    id: 'account_created',
    name: 'Account Created',
    body: 'New account "{{accountName}}" has been created and assigned to you.',
    variables: ['accountName']
  },
  {
    id: 'contact_created',
    name: 'Contact Created',
    body: 'New contact "{{contactName}}" has been added to account "{{accountName}}".',
    variables: ['contactName', 'accountName']
  },
  // Ecommerce
  {
    id: 'ecommerce_order_placed',
    name: 'Ecommerce Order Placed',
    body: 'New ecommerce order #{{orderNumber}} placed by {{customerName}}. Total: GHS {{totalAmount}}.',
    variables: ['orderNumber', 'customerName', 'totalAmount']
  },
  {
    id: 'ecommerce_order_status',
    name: 'Ecommerce Order Status',
    body: 'Your order #{{orderNumber}} status: {{status}}. {{deliveryInfo}}',
    variables: ['orderNumber', 'status', 'deliveryInfo']
  },
  {
    id: 'ecommerce_customer_registered',
    name: 'Customer Registered',
    body: 'New customer registered: {{customerName}} ({{customerEmail}}).',
    variables: ['customerName', 'customerEmail']
  },
  {
    id: 'ecommerce_product_low_stock',
    name: 'Ecommerce Product Low Stock',
    body: 'Ecommerce product "{{productName}}" is running low. Current stock: {{currentStock}} units.',
    variables: ['productName', 'currentStock']
  },
  // DRM
  {
    id: 'distributor_lead_created',
    name: 'Distributor Lead Created',
    body: 'New distributor lead created: {{leadName}} ({{leadEmail}}). Company: {{leadCompany}}.',
    variables: ['leadName', 'leadEmail', 'leadCompany']
  },
  {
    id: 'distributor_approved',
    name: 'Distributor Approved',
    body: 'Distributor "{{distributorName}}" has been approved. They can now place orders.',
    variables: ['distributorName']
  },
  {
    id: 'drm_order_created',
    name: 'DRM Order Created',
    body: 'New DRM order #{{orderNumber}} from distributor {{distributorName}}. Total: GHS {{totalAmount}}.',
    variables: ['orderNumber', 'distributorName', 'totalAmount']
  },
  // Commissions
  {
    id: 'commission_calculated',
    name: 'Commission Calculated',
    body: 'Commission calculated: GHS {{commissionAmount}} for {{period}}. View details in commissions.',
    variables: ['commissionAmount', 'period']
  },
  {
    id: 'commission_paid',
    name: 'Commission Paid',
    body: 'Commission of GHS {{commissionAmount}} has been paid for {{period}}. Payment date: {{paymentDate}}.',
    variables: ['commissionAmount', 'period', 'paymentDate']
  },
  // Users & System
  {
    id: 'user_created',
    name: 'New User Created',
    body: 'New user account created: {{userName}} ({{userEmail}}) with role {{userRole}}.',
    variables: ['userName', 'userEmail', 'userRole']
  },
  {
    id: 'user_login',
    name: 'User Login',
    body: 'User {{userName}} logged into the system at {{loginTime}}.',
    variables: ['userName', 'loginTime']
  },
  {
    id: 'user_role_changed',
    name: 'User Role Changed',
    body: 'Your role has been changed from {{oldRole}} to {{newRole}}.',
    variables: ['oldRole', 'newRole']
  },
  {
    id: 'system_backup',
    name: 'System Backup',
    body: 'System backup completed successfully. Backup size: {{backupSize}}. Date: {{backupDate}}.',
    variables: ['backupSize', 'backupDate']
  },
  {
    id: 'system_error',
    name: 'System Error',
    body: 'URGENT: System error detected. Error: {{errorMessage}}. Please check system logs.',
    variables: ['errorMessage']
  },
  // Communication
  {
    id: 'email_campaign_sent',
    name: 'Email Campaign Sent',
    body: 'Email campaign "{{campaignName}}" has been sent to {{recipientCount}} recipients.',
    variables: ['campaignName', 'recipientCount']
  },
  {
    id: 'sms_campaign_sent',
    name: 'SMS Campaign Sent',
    body: 'SMS campaign "{{campaignName}}" has been sent to {{recipientCount}} recipients.',
    variables: ['campaignName', 'recipientCount']
  },
  // Reports
  {
    id: 'report_generated',
    name: 'Report Generated',
    body: 'Report "{{reportName}}" has been generated and is ready for download.',
    variables: ['reportName']
  },
  {
    id: 'analytics_alert',
    name: 'Analytics Alert',
    body: 'Analytics alert: {{alertMessage}}. Threshold: {{threshold}}. Current value: {{currentValue}}.',
    variables: ['alertMessage', 'threshold', 'currentValue']
  }
];

// System notification types - Comprehensive list covering all modules
const NOTIFICATION_TYPES = [
  // Inventory
  {
    id: 'stock_low',
    name: 'Low Stock Alert',
    description: 'When product stock falls below reorder point',
    icon: AlertTriangle,
    category: 'Inventory'
  },
  {
    id: 'stock_out',
    name: 'Out of Stock Alert',
    description: 'When product is completely out of stock',
    icon: AlertTriangle,
    category: 'Inventory'
  },
  {
    id: 'stock_movement',
    name: 'Stock Movement',
    description: 'When stock is moved between warehouses',
    icon: Package,
    category: 'Inventory'
  },
  {
    id: 'warehouse_update',
    name: 'Warehouse Update',
    description: 'When warehouse information is updated',
    icon: Warehouse,
    category: 'Inventory'
  },
  // Orders
  {
    id: 'new_order',
    name: 'New Order',
    description: 'When a new order is placed',
    icon: ShoppingCart,
    category: 'Orders'
  },
  {
    id: 'order_status',
    name: 'Order Status Change',
    description: 'When order status is updated',
    icon: ShoppingCart,
    category: 'Orders'
  },
  {
    id: 'order_cancelled',
    name: 'Order Cancelled',
    description: 'When an order is cancelled',
    icon: ShoppingCart,
    category: 'Orders'
  },
  {
    id: 'backorder_created',
    name: 'Backorder Created',
    description: 'When a backorder is created',
    icon: ClipboardList,
    category: 'Orders'
  },
  // Payments
  {
    id: 'payment_received',
    name: 'Payment Received',
    description: 'When payment is received for an order',
    icon: DollarSign,
    category: 'Payments'
  },
  {
    id: 'payment_failed',
    name: 'Payment Failed',
    description: 'When a payment transaction fails',
    icon: CreditCard,
    category: 'Payments'
  },
  {
    id: 'payment_refunded',
    name: 'Payment Refunded',
    description: 'When a payment is refunded',
    icon: DollarSign,
    category: 'Payments'
  },
  // Invoices
  {
    id: 'invoice_created',
    name: 'Invoice Created',
    description: 'When a new invoice is created',
    icon: Receipt,
    category: 'Invoices'
  },
  {
    id: 'invoice_sent',
    name: 'Invoice Sent',
    description: 'When an invoice is sent to customer',
    icon: Receipt,
    category: 'Invoices'
  },
  {
    id: 'invoice_overdue',
    name: 'Invoice Overdue',
    description: 'When an invoice becomes overdue',
    icon: AlertTriangle,
    category: 'Invoices'
  },
  {
    id: 'invoice_paid',
    name: 'Invoice Paid',
    description: 'When an invoice is fully paid',
    icon: Receipt,
    category: 'Invoices'
  },
  // Quotations
  {
    id: 'quotation_created',
    name: 'Quotation Created',
    description: 'When a new quotation is created',
    icon: FileCheck,
    category: 'Quotations'
  },
  {
    id: 'quotation_sent',
    name: 'Quotation Sent',
    description: 'When a quotation is sent to customer',
    icon: FileCheck,
    category: 'Quotations'
  },
  {
    id: 'quotation_accepted',
    name: 'Quotation Accepted',
    description: 'When a quotation is accepted by customer',
    icon: FileCheck,
    category: 'Quotations'
  },
  {
    id: 'quotation_expired',
    name: 'Quotation Expired',
    description: 'When a quotation expires',
    icon: FileCheck,
    category: 'Quotations'
  },
  // Projects
  {
    id: 'project_created',
    name: 'Project Created',
    description: 'When a new project is created',
    icon: FolderKanban,
    category: 'Projects'
  },
  {
    id: 'project_updated',
    name: 'Project Updated',
    description: 'When project details are updated',
    icon: FolderKanban,
    category: 'Projects'
  },
  {
    id: 'project_completed',
    name: 'Project Completed',
    description: 'When a project is marked as completed',
    icon: FolderKanban,
    category: 'Projects'
  },
  {
    id: 'project_member_added',
    name: 'Project Member Added',
    description: 'When a member is added to a project',
    icon: UserPlus,
    category: 'Projects'
  },
  // Tasks
  {
    id: 'task_created',
    name: 'Task Created',
    description: 'When a new task is created',
    icon: CheckSquare,
    category: 'Tasks'
  },
  {
    id: 'task_assigned',
    name: 'Task Assigned',
    description: 'When a task is assigned to you',
    icon: CheckSquare,
    category: 'Tasks'
  },
  {
    id: 'task_due_soon',
    name: 'Task Due Soon',
    description: 'When a task is approaching its due date',
    icon: Calendar,
    category: 'Tasks'
  },
  {
    id: 'task_overdue',
    name: 'Task Overdue',
    description: 'When a task becomes overdue',
    icon: AlertTriangle,
    category: 'Tasks'
  },
  {
    id: 'task_completed',
    name: 'Task Completed',
    description: 'When a task is marked as completed',
    icon: CheckSquare,
    category: 'Tasks'
  },
  {
    id: 'task_comment',
    name: 'Task Comment',
    description: 'When someone comments on a task',
    icon: MessageSquareMore,
    category: 'Tasks'
  },
  // CRM - Leads
  {
    id: 'lead_created',
    name: 'Lead Created',
    description: 'When a new lead is created',
    icon: UserPlus,
    category: 'Leads'
  },
  {
    id: 'lead_assigned',
    name: 'Lead Assigned',
    description: 'When a lead is assigned to you',
    icon: UserCheck,
    category: 'Leads'
  },
  {
    id: 'lead_owner_notification',
    name: 'Lead Owner Notification',
    description: 'When a lead is added to your account',
    icon: User,
    category: 'Leads'
  },
  {
    id: 'lead_welcome',
    name: 'Lead Welcome Email',
    description: 'Welcome email sent to new leads',
    icon: Mail,
    category: 'Leads'
  },
  {
    id: 'lead_converted',
    name: 'Lead Converted',
    description: 'When a lead is converted to an opportunity',
    icon: TrendingUp,
    category: 'Leads'
  },
  // CRM - Opportunities
  {
    id: 'opportunity_created',
    name: 'Opportunity Created',
    description: 'When a new opportunity is created',
    icon: TrendingUp,
    category: 'Opportunities'
  },
  {
    id: 'opportunity_won',
    name: 'Opportunity Won',
    description: 'When an opportunity is marked as won',
    icon: TrendingUp,
    category: 'Opportunities'
  },
  {
    id: 'opportunity_lost',
    name: 'Opportunity Lost',
    description: 'When an opportunity is marked as lost',
    icon: TrendingUp,
    category: 'Opportunities'
  },
  // CRM - Accounts & Contacts
  {
    id: 'account_created',
    name: 'Account Created',
    description: 'When a new account is created',
    icon: Building,
    category: 'Accounts'
  },
  {
    id: 'contact_created',
    name: 'Contact Created',
    description: 'When a new contact is created',
    icon: User,
    category: 'Contacts'
  },
  // Ecommerce
  {
    id: 'ecommerce_order_placed',
    name: 'Ecommerce Order Placed',
    description: 'When a customer places an order on the storefront',
    icon: ShoppingCart,
    category: 'Ecommerce'
  },
  {
    id: 'ecommerce_order_status',
    name: 'Ecommerce Order Status',
    description: 'When an ecommerce order status changes',
    icon: ShoppingCart,
    category: 'Ecommerce'
  },
  {
    id: 'ecommerce_customer_registered',
    name: 'Customer Registered',
    description: 'When a new customer registers on the storefront',
    icon: UserPlus,
    category: 'Ecommerce'
  },
  {
    id: 'ecommerce_product_low_stock',
    name: 'Ecommerce Product Low Stock',
    description: 'When an ecommerce product is low in stock',
    icon: Package,
    category: 'Ecommerce'
  },
  // DRM
  {
    id: 'distributor_lead_created',
    name: 'Distributor Lead Created',
    description: 'When a new distributor lead is created',
    icon: UserPlus,
    category: 'DRM'
  },
  {
    id: 'distributor_approved',
    name: 'Distributor Approved',
    description: 'When a distributor is approved',
    icon: UserCheck,
    category: 'DRM'
  },
  {
    id: 'drm_order_created',
    name: 'DRM Order Created',
    description: 'When a new DRM order is created',
    icon: ShoppingCart,
    category: 'DRM'
  },
  // Commissions
  {
    id: 'commission_calculated',
    name: 'Commission Calculated',
    description: 'When a commission is calculated',
    icon: DollarSign,
    category: 'Commissions'
  },
  {
    id: 'commission_paid',
    name: 'Commission Paid',
    description: 'When a commission is paid',
    icon: DollarSign,
    category: 'Commissions'
  },
  // Users & System
  {
    id: 'user_created',
    name: 'New User Created',
    description: 'When a new user account is created',
    icon: Users,
    category: 'Users'
  },
  {
    id: 'user_login',
    name: 'User Login',
    description: 'When a user logs into the system',
    icon: Users,
    category: 'Users'
  },
  {
    id: 'user_role_changed',
    name: 'User Role Changed',
    description: 'When a user role is changed',
    icon: Users,
    category: 'Users'
  },
  {
    id: 'system_backup',
    name: 'System Backup',
    description: 'System backup completion notifications',
    icon: Settings,
    category: 'System'
  },
  {
    id: 'system_error',
    name: 'System Error',
    description: 'Critical system error notifications',
    icon: AlertTriangle,
    category: 'System'
  },
  // Communication
  {
    id: 'email_campaign_sent',
    name: 'Email Campaign Sent',
    description: 'When an email campaign is sent',
    icon: Mail,
    category: 'Communication'
  },
  {
    id: 'sms_campaign_sent',
    name: 'SMS Campaign Sent',
    description: 'When an SMS campaign is sent',
    icon: MessageSquare,
    category: 'Communication'
  },
  // Analytics & Reports
  {
    id: 'report_generated',
    name: 'Report Generated',
    description: 'When a scheduled report is generated',
    icon: BarChart3,
    category: 'Reports'
  },
  {
    id: 'analytics_alert',
    name: 'Analytics Alert',
    description: 'When analytics thresholds are reached',
    icon: BarChart3,
    category: 'Reports'
  }
];

interface NotificationSettings {
  email: {
    enabled: boolean;
    smtp: {
      host: string;
      port: string;
      username: string;
      password: string;
      encryption: string;
      fromAddress: string;
      fromName: string;
    };
    notifications: { [key: string]: boolean };
  };
  sms: {
    enabled: boolean;
    provider: {
      name: string;
      username: string;
      password: string;
      senderId: string;
      baseUrl: string;
    };
    notifications: { [key: string]: boolean };
  };
  taskNotifications: {
    enabled: boolean;
    minutesBeforeDue: number;
    sendDueSoon: boolean;
    sendOverdue: boolean;
    sendEscalation: boolean;
    escalationInterval: number; // hours
  };
  queue: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    redisUrl: string;
    emailBatchSize: number;
    emailDelayMs: number;
    smsBatchSize: number;
    smsDelayMs: number;
  };
}

const defaultSettings: NotificationSettings = {
  email: {
    enabled: false,
    smtp: {
      host: '',
      port: '587',
      username: '',
      password: '',
      encryption: 'tls',
      fromAddress: '',
      fromName: '{{companyName}}'
    },
    notifications: {}
  },
  sms: {
    enabled: false,
    provider: {
      name: 'deywuro',
      username: '',
      password: '',
      senderId: '',
      baseUrl: 'https://deywuro.com/api'
    },
    notifications: {}
  },
  taskNotifications: {
    enabled: true,
    minutesBeforeDue: 10,
    sendDueSoon: true,
    sendOverdue: true,
    sendEscalation: true,
    escalationInterval: 1 // hours
  },
  queue: {
    emailEnabled: true,
    smsEnabled: true,
    redisUrl: '',
    emailBatchSize: 10,
    emailDelayMs: 1000,
    smsBatchSize: 10,
    smsDelayMs: 2000
  }
};

const normalizeSettings = (incoming?: Partial<NotificationSettings>): NotificationSettings => {
  const emailSettings = incoming?.email || {};
  const smsSettings = incoming?.sms || {};
  const taskSettings = incoming?.taskNotifications || {};
  const queueSettings = incoming?.queue || {};

  return {
    email: {
      ...defaultSettings.email,
      ...emailSettings,
      smtp: {
        ...defaultSettings.email.smtp,
        ...(emailSettings as any)?.smtp,
      },
      notifications: {
        ...defaultSettings.email.notifications,
        ...(emailSettings as any)?.notifications,
      },
    },
    sms: {
      ...defaultSettings.sms,
      ...smsSettings,
      provider: {
        ...defaultSettings.sms.provider,
        ...(smsSettings as any)?.provider,
      },
      notifications: {
        ...defaultSettings.sms.notifications,
        ...(smsSettings as any)?.notifications,
      },
    },
    taskNotifications: {
      ...defaultSettings.taskNotifications,
      ...taskSettings,
    },
    queue: {
      ...defaultSettings.queue,
      ...queueSettings,
    },
  };
};

export default function NotificationSettingsPage() {
  const { themeColor, getThemeClasses, getThemeColor } = useTheme();
  const themeClasses = getThemeClasses();
  const { data: session } = useSession();
  const { success: showSuccess, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState<'email' | 'sms' | 'routing' | 'email-templates' | 'sms-templates' | 'task-notifications' | 'queue'>('email');
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [showSMSPopup, setShowSMSPopup] = useState(false);
  const [testNotificationType, setTestNotificationType] = useState<string | null>(null);
  const [testNotificationChannel, setTestNotificationChannel] = useState<'email' | 'sms' | null>(null);
  const [showTestNotificationPopup, setShowTestNotificationPopup] = useState(false);
  const [savingTimeout, setSavingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<NotificationTemplate[]>(DEFAULT_EMAIL_TEMPLATES);
  const [smsTemplates, setSmsTemplates] = useState<NotificationTemplate[]>(DEFAULT_SMS_TEMPLATES);
  const [runnerStatus, setRunnerStatus] = useState<'running' | 'stopped' | 'loading'>('loading');
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [queueHealth, setQueueHealth] = useState<{ status: 'unknown' | 'healthy' | 'unreachable'; latency?: number; message?: string }>({ status: 'unknown' });
  const [checkingQueueHealth, setCheckingQueueHealth] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<{ email: boolean; sms: boolean }>({ email: false, sms: false });
  const [checkingWorkerStatus, setCheckingWorkerStatus] = useState(false);

  useEffect(() => {
    loadSettings();
    checkRunnerStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'queue') {
      checkQueueWorkers();
      handleQueueHealthCheck();
    }
  }, [activeTab]);

  useEffect(() => {
    setQueueHealth((prev) => ({
      ...prev,
      status: 'unknown',
      latency: undefined,
      message: undefined,
    }));
  }, [settings.queue.redisUrl]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/notifications');
      
      if (response.ok) {
        const data = await response.json();
        setSettings(normalizeSettings(data.settings));
      } else {
        setSettings(normalizeSettings());
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(normalizeSettings());
    } finally {
      setIsLoading(false);
    }
  };

  const checkRunnerStatus = async () => {
    try {
      const response = await fetch('/api/tasks/notification-runner');
      if (response.ok) {
        const data = await response.json();
        setRunnerStatus(data.isActive ? 'running' : 'stopped');
      } else {
        setRunnerStatus('stopped');
      }
    } catch (error) {
      console.error('Error checking runner status:', error);
      setRunnerStatus('stopped');
    }
  };

  const toggleRunner = async (action: 'start' | 'stop') => {
    try {
      const response = await fetch('/api/tasks/notification-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        const data = await response.json();
        setRunnerStatus(data.status);
        showSuccess(`Task notification runner ${action}ed successfully`);
      } else {
        showError(`Failed to ${action} notification runner`);
      }
    } catch (error) {
      console.error(`Error ${action}ing runner:`, error);
      showError(`Error ${action}ing notification runner`);
    }
  };

  const handleSaveSettings = async (settingsToSave?: NotificationSettings, showMessage: boolean = true) => {
    const settingsToUse = settingsToSave || settings;
    try {
      setIsSaving(true);
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToUse }),
      });

      if (response.ok) {
        if (showMessage) {
        showSuccess('Notification settings saved successfully');
        }
      } else {
        const errorData = await response.json();
        if (showMessage) {
        showError(errorData.error || 'Failed to save notification settings');
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      if (showMessage) {
      showError('Failed to save notification settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    await handleSaveSettings();
  };

  const handleTestClick = (type: 'email' | 'sms') => {
    if (type === 'email') {
      setTestEmail(session?.user?.email || '');
      setShowEmailPopup(true);
    } else if (type === 'sms') {
      setTestPhone('');
      setShowSMSPopup(true);
    } else {
      handleTest(type);
    }
  };

  const handleTest = async (type: 'email' | 'sms', email?: string, phone?: string) => {
    try {
      setIsTesting(type);
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          channel: type, 
          settings,
          testRecipient: type === 'email' ? (email || testEmail) : (phone || testPhone)
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Test response data:', data);
        if (data.success) {
          showSuccess(`${type.toUpperCase()} test successful!`);
          if (type === 'email') {
            setShowEmailPopup(false);
          } else if (type === 'sms') {
            setShowSMSPopup(false);
          }
        } else {
          showError(`${type.toUpperCase()} test failed: ${data.message}`);
        }
      } else {
        const errorText = await response.text();
        console.log('Test error response:', errorText);
        showError(`Failed to test ${type}`);
      }
    } catch (error) {
      console.error(`Error testing ${type}:`, error);
      showError(`Failed to test ${type}`);
    } finally {
      setIsTesting(null);
    }
  };

  const handleTestNotificationClick = (notificationType: string, channel: 'email' | 'sms') => {
    setTestNotificationType(notificationType);
    setTestNotificationChannel(channel);
    if (channel === 'email') {
      setTestEmail(session?.user?.email || '');
    } else {
      setTestPhone('');
    }
    setShowTestNotificationPopup(true);
  };

  const sendTestNotification = async () => {
    if (!testNotificationType || !testNotificationChannel) return;
    
    const contact = testNotificationChannel === 'email' ? testEmail : testPhone;
    if (!contact) {
      showError(`Please enter a ${testNotificationChannel === 'email' ? 'email address' : 'phone number'}`);
      return;
    }

    try {
      setIsTesting(testNotificationType);
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: testNotificationType,
          test: true,
          channel: testNotificationChannel,
          contact: contact,
          data: { message: 'This is a test notification' }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showSuccess(`Test ${testNotificationType} ${testNotificationChannel.toUpperCase()} notification sent successfully`);
          setShowTestNotificationPopup(false);
          setTestNotificationType(null);
          setTestNotificationChannel(null);
      } else {
          showError(result.message || `Failed to send test ${testNotificationChannel.toUpperCase()} notification`);
        }
      } else {
        const errorData = await response.json();
        showError(errorData.error || errorData.message || `Failed to send test ${testNotificationChannel.toUpperCase()} notification`);
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      showError(`Failed to send test ${testNotificationChannel.toUpperCase()} notification`);
    } finally {
      setIsTesting(null);
    }
  };

  const updateEmailSetting = (key: string, value: string | boolean, autoSave: boolean = false) => {
    if (key.startsWith('notifications.')) {
      const notificationKey = key.replace('notifications.', '');
      setSettings(prev => {
        const newSettings = {
        ...prev,
        email: {
          ...prev.email,
          notifications: {
            ...prev.email.notifications,
            [notificationKey]: value as boolean
          }
        }
        };
        
        // Auto-save notification settings after state update (debounced)
        if (autoSave) {
          // Clear existing timeout
          if (savingTimeout) {
            clearTimeout(savingTimeout);
          }
          // Set new timeout
          const timeout = setTimeout(() => {
            handleSaveSettings(newSettings, false); // Don't show message for auto-save
            setSavingTimeout(null);
          }, 500);
          setSavingTimeout(timeout);
        }
        
        return newSettings;
      });
    } else if (key.startsWith('smtp.')) {
      const smtpKey = key.replace('smtp.', '');
      setSettings(prev => ({
        ...prev,
        email: {
          ...prev.email,
          smtp: {
            ...prev.email.smtp,
            [smtpKey]: value as string
          }
        }
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        email: {
          ...prev.email,
          [key]: value
        }
      }));
    }
  };

  const updateQueueSetting = (key: keyof NotificationSettings['queue'], value: string | number | boolean) => {
    setSettings((prev) => ({
      ...prev,
      queue: {
        ...prev.queue,
        [key]: value,
      },
    }));
  };

  const handleQueueHealthCheck = async () => {
    try {
      setCheckingQueueHealth(true);
      const response = await fetch('/api/queue/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redisUrl: settings.queue.redisUrl || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQueueHealth({
          status: 'healthy',
          latency: data.latency,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        setQueueHealth({
          status: 'unreachable',
          message: errorData.error || errorData.message || 'Unable to connect to Redis',
        });
      }
    } catch (error) {
      console.error('Queue health check failed:', error);
      setQueueHealth({
        status: 'unreachable',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setCheckingQueueHealth(false);
    }
  };

  const checkQueueWorkers = async () => {
    try {
      setCheckingWorkerStatus(true);
      const response = await fetch('/api/queue/workers/init');
      if (response.ok) {
        const data = await response.json();
        setWorkerStatus(data.workers || { email: false, sms: false });
      } else {
        setWorkerStatus({ email: false, sms: false });
      }
    } catch (error) {
      console.error('Failed to check queue workers:', error);
      setWorkerStatus({ email: false, sms: false });
    } finally {
      setCheckingWorkerStatus(false);
    }
  };

  const updateSMSSetting = (key: string, value: string | boolean, autoSave: boolean = false) => {
    if (key.startsWith('notifications.')) {
      const notificationKey = key.replace('notifications.', '');
      setSettings(prev => {
        const newSettings = {
        ...prev,
        sms: {
          ...prev.sms,
          notifications: {
            ...prev.sms.notifications,
            [notificationKey]: value as boolean
          }
        }
        };
        
        // Auto-save notification settings after state update (debounced)
        if (autoSave) {
          // Clear existing timeout
          if (savingTimeout) {
            clearTimeout(savingTimeout);
          }
          // Set new timeout
          const timeout = setTimeout(() => {
            handleSaveSettings(newSettings, false); // Don't show message for auto-save
            setSavingTimeout(null);
          }, 500);
          setSavingTimeout(timeout);
        }
        
        return newSettings;
      });
    } else if (key.startsWith('provider.')) {
      const providerKey = key.replace('provider.', '');
      setSettings(prev => ({
        ...prev,
        sms: {
          ...prev.sms,
          provider: {
            ...prev.sms.provider,
            [providerKey]: value as string
          }
        }
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        sms: {
          ...prev.sms,
          [key]: value
        }
      }));
    }
  };

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-500" />
            <p className="text-gray-500">Loading notification settings...</p>
          </div>
        </div>
      </>
    );
  }

  const queueStatusColor =
    queueHealth.status === 'healthy'
      ? 'text-green-600'
      : queueHealth.status === 'unreachable'
      ? 'text-red-500'
      : 'text-gray-500';

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
            <p className="text-gray-600 mt-1">
              Configure system notifications, email and SMS settings
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              style={{ backgroundColor: getThemeColor(), color: 'white' }}
              className="hover:opacity-90 flex items-center gap-2"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save All Settings
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('email')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'email'
                  ? `border-${themeClasses.primary} text-${themeClasses.primary}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-2" />
              Email Configuration
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'queue'
                  ? `border-${themeClasses.primary} text-${themeClasses.primary}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Server className="h-4 w-4 inline mr-2" />
              Queue & Bulk Sending
            </button>
            <button
              onClick={() => setActiveTab('sms')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sms'
                  ? `border-${themeClasses.primary} text-${themeClasses.primary}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MessageSquare className="h-4 w-4 inline mr-2" />
              SMS Configuration
            </button>
            <button
              onClick={() => setActiveTab('routing')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'routing'
                  ? `border-${themeClasses.primary} text-${themeClasses.primary}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Bell className="h-4 w-4 inline mr-2" />
              Notification Routing
            </button>
            <button
              onClick={() => setActiveTab('email-templates')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'email-templates'
                  ? `border-${themeClasses.primary} text-${themeClasses.primary}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Email Templates
            </button>
            <button
              onClick={() => setActiveTab('sms-templates')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sms-templates'
                  ? `border-${themeClasses.primary} text-${themeClasses.primary}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MessageCircle className="h-4 w-4 inline mr-2" />
              SMS Templates
            </button>
            <button
              onClick={() => setActiveTab('task-notifications')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'task-notifications'
                  ? `border-${themeClasses.primary} text-${themeClasses.primary}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              Task Notifications
            </button>
          </nav>
        </div>


        {/* Content */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            {/* Email Enable/Disable */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Email Notifications</h3>
                  <p className="text-sm text-gray-500">Enable or disable email notifications</p>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => handleTestClick('email')}
                    disabled={isTesting === 'email' || !settings.email.enabled}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {isTesting === 'email' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    Test Email
                  </Button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={settings.email.enabled}
                      onCheckedChange={(checked) => updateEmailSetting('enabled', checked as boolean)}
                    />
                    <span className="text-sm font-medium">Enable Email</span>
                  </label>
                </div>
              </div>
            </Card>

            {/* SMTP Configuration */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">SMTP Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    placeholder="smtp.gmail.com"
                    value={settings.email.smtp.host}
                    onChange={(e) => updateEmailSetting('smtp.host', e.target.value)}
                    disabled={!settings.email.enabled}
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    placeholder="587"
                    value={settings.email.smtp.port}
                    onChange={(e) => updateEmailSetting('smtp.port', e.target.value)}
                    disabled={!settings.email.enabled}
                  />
                </div>
                <div>
                  <Label htmlFor="smtpEncryption">Encryption</Label>
                  <select
                    id="smtpEncryption"
                    value={settings.email.smtp.encryption}
                    onChange={(e) => updateEmailSetting('smtp.encryption', e.target.value)}
                    disabled={!settings.email.enabled}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="tls">TLS</option>
                    <option value="ssl">SSL</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="smtpUsername">Username</Label>
                  <Input
                    id="smtpUsername"
                    name="smtpUsername"
                    type="text"
                    autoComplete="email"
                    placeholder="your-email@gmail.com"
                    value={settings.email.smtp.username}
                    onChange={(e) => updateEmailSetting('smtp.username', e.target.value)}
                    disabled={!settings.email.enabled}
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPassword">Password</Label>
                  <Input
                    id="smtpPassword"
                    name="smtpPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder={settings.email.smtp.password === '***' ? 'Password is saved (enter new to change)' : 'Your password or app password'}
                    value={settings.email.smtp.password === '***' ? '' : settings.email.smtp.password}
                    onChange={(e) => updateEmailSetting('smtp.password', e.target.value)}
                    disabled={!settings.email.enabled}
                  />
                  {settings.email.smtp.password === '***' && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Password is saved. Enter a new password to change it.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    placeholder="{{companyName}}"
                    value={settings.email.smtp.fromName}
                    onChange={(e) => updateEmailSetting('smtp.fromName', e.target.value)}
                    disabled={!settings.email.enabled}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="fromAddress">From Email Address</Label>
                  <Input
                    id="fromAddress"
                    placeholder="noreply@adpoolsgroup.com"
                    value={settings.email.smtp.fromAddress}
                    onChange={(e) => updateEmailSetting('smtp.fromAddress', e.target.value)}
                    disabled={!settings.email.enabled}
                  />
                </div>
              </div>
            </Card>

            {/* Email Notifications */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">Email Notification Types</h3>
              <p className="text-sm text-gray-500 mb-4">Select which notifications should be sent via email</p>
              <div className="space-y-4">
                {Object.entries(
                  NOTIFICATION_TYPES.reduce((acc, type) => {
                    if (!acc[type.category]) acc[type.category] = [];
                    acc[type.category].push(type);
                    return acc;
                  }, {} as { [key: string]: typeof NOTIFICATION_TYPES })
                ).map(([category, types]) => (
                  <div key={category}>
                    <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {types.map((type) => (
                        <label key={type.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                          <Checkbox
                            checked={settings.email.notifications[type.id] || false}
                            onCheckedChange={(checked) => updateEmailSetting(`notifications.${type.id}`, checked as boolean, true)}
                            disabled={!settings.email.enabled}
                          />
                          <div className="flex items-start gap-2 flex-1">
                            <type.icon className="h-4 w-4 text-gray-500 mt-0.5" />
                            <div>
                              <div className="font-medium text-sm">{type.name}</div>
                              <div className="text-xs text-gray-500">{type.description}</div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault();
                              handleTestNotificationClick(type.id, 'email');
                            }}
                            disabled={!settings.email.enabled || !settings.email.notifications[type.id]}
                            className="text-xs"
                          >
                            Test
                          </Button>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'sms' && (
          <div className="space-y-6">
            {/* SMS Enable/Disable */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">SMS Notifications</h3>
                  <p className="text-sm text-gray-500">Enable or disable SMS notifications</p>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => handleTestClick('sms')}
                    disabled={isTesting === 'sms' || !settings.sms.enabled}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {isTesting === 'sms' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    Test SMS
                  </Button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={settings.sms.enabled}
                      onCheckedChange={(checked) => updateSMSSetting('enabled', checked as boolean)}
                    />
                    <span className="text-sm font-medium">Enable SMS</span>
                  </label>
                </div>
              </div>
            </Card>

            {/* SMS Provider Configuration */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">SMS Provider Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smsProvider">SMS Provider</Label>
                  <select
                    id="smsProvider"
                    value={settings.sms.provider.name}
                    onChange={(e) => updateSMSSetting('provider.name', e.target.value)}
                    disabled={!settings.sms.enabled}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="deywuro">Deywuro</option>
                    <option value="twilio">Twilio</option>
                    <option value="aws">AWS SNS</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="senderId">Sender ID</Label>
                  <Input
                    id="senderId"
                    placeholder="AdPools"
                    value={settings.sms.provider.senderId}
                    onChange={(e) => updateSMSSetting('provider.senderId', e.target.value)}
                    disabled={!settings.sms.enabled}
                  />
                </div>
                <div>
                  <Label htmlFor="smsUsername">Username</Label>
                  <Input
                    id="smsUsername"
                    name="smsUsername"
                    type="text"
                    autoComplete="username"
                    placeholder="Deywuro username"
                    value={settings.sms.provider.username}
                    onChange={(e) => updateSMSSetting('provider.username', e.target.value)}
                    disabled={!settings.sms.enabled}
                  />
                </div>
                <div>
                  <Label htmlFor="smsPassword">Password</Label>
                  <Input
                    id="smsPassword"
                    name="smsPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder={settings.sms.provider.password === '***' ? 'Password is saved (enter new to change)' : 'Deywuro password'}
                    value={settings.sms.provider.password === '***' ? '' : settings.sms.provider.password}
                    onChange={(e) => updateSMSSetting('provider.password', e.target.value)}
                    disabled={!settings.sms.enabled}
                  />
                  {settings.sms.provider.password === '***' && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Password is saved. Enter a new password to change it.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://api.deywuro.com"
                    value={settings.sms.provider.baseUrl}
                    onChange={(e) => updateSMSSetting('provider.baseUrl', e.target.value)}
                    disabled={!settings.sms.enabled}
                  />
                </div>
              </div>
            </Card>

            {/* SMS Notifications */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">SMS Notification Types</h3>
              <p className="text-sm text-gray-500 mb-4">Select which notifications should be sent via SMS</p>
              <div className="space-y-4">
                {Object.entries(
                  NOTIFICATION_TYPES.reduce((acc, type) => {
                    if (!acc[type.category]) acc[type.category] = [];
                    acc[type.category].push(type);
                    return acc;
                  }, {} as { [key: string]: typeof NOTIFICATION_TYPES })
                ).map(([category, types]) => (
                  <div key={category}>
                    <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {types.map((type) => (
                        <label key={type.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                          <Checkbox
                            checked={settings.sms.notifications[type.id] || false}
                            onCheckedChange={(checked) => updateSMSSetting(`notifications.${type.id}`, checked as boolean, true)}
                            disabled={!settings.sms.enabled}
                          />
                          <div className="flex items-start gap-2 flex-1">
                            <type.icon className="h-4 w-4 text-gray-500 mt-0.5" />
                            <div>
                              <div className="font-medium text-sm">{type.name}</div>
                              <div className="text-xs text-gray-500">{type.description}</div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault();
                              handleTestNotificationClick(type.id, 'sms');
                            }}
                            disabled={!settings.sms.enabled || !settings.sms.notifications[type.id]}
                            className="text-xs"
                          >
                            Test
                          </Button>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-medium">Queue Usage</h3>
                  <p className="text-sm text-gray-500">
                    Run large email and SMS batches through the background queue to avoid timeouts.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div>
                      <p className="font-medium">Use queue for Email</p>
                      <p className="text-sm text-gray-500">
                        Recommended for Best Deals and Communication campaigns.
                      </p>
                    </div>
                    <Switch
                      checked={settings.queue.emailEnabled}
                      onCheckedChange={(checked) => updateQueueSetting('emailEnabled', Boolean(checked))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                    <div>
                      <p className="font-medium">Use queue for SMS</p>
                      <p className="text-sm text-gray-500">
                        Keeps the Deywuro gateway within safe limits.
                      </p>
                    </div>
                    <Switch
                      checked={settings.queue.smsEnabled}
                      onCheckedChange={(checked) => updateQueueSetting('smsEnabled', Boolean(checked))}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Batches with {settings.queue.emailBatchSize} + email recipients or {settings.queue.smsBatchSize} + SMS recipients will use the queue automatically.
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="h-5 w-5 text-gray-500" />
                <div>
                  <h3 className="text-lg font-medium">Redis Connection</h3>
                  <p className="text-sm text-gray-500">
                    Provide the Redis connection string used by the queue workers.
                  </p>
                </div>
              </div>
              <Label htmlFor="redisUrl">Redis URL</Label>
              <Input
                id="redisUrl"
                placeholder="redis://localhost:6379"
                value={settings.queue.redisUrl}
                onChange={(e) => updateQueueSetting('redisUrl', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-2">
                Leave blank to use the <code>REDIS_URL</code> environment variable. Changes take effect after the next restart.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-medium">Batch Configuration</h3>
              <p className="text-sm text-gray-500 mb-4">
                Adjust batch size and delay between batches. Lower values reduce provider load; higher values finish faster.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" /> Email Queue
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label>Email batch size</Label>
                      <Input
                        type="number"
                        min={1}
                        value={settings.queue.emailBatchSize}
                        onChange={(e) => updateQueueSetting('emailBatchSize', Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                    <div>
                      <Label>Delay between batches (ms)</Label>
                      <Input
                        type="number"
                        min={100}
                        step={100}
                        value={settings.queue.emailDelayMs}
                        onChange={(e) => updateQueueSetting('emailDelayMs', Math.max(100, Number(e.target.value) || 100))}
                      />
                    </div>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-500" /> SMS Queue
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label>SMS batch size</Label>
                      <Input
                        type="number"
                        min={1}
                        value={settings.queue.smsBatchSize}
                        onChange={(e) => updateQueueSetting('smsBatchSize', Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                    <div>
                      <Label>Delay between batches (ms)</Label>
                      <Input
                        type="number"
                        min={500}
                        step={100}
                        value={settings.queue.smsDelayMs}
                        onChange={(e) => updateQueueSetting('smsDelayMs', Math.max(500, Number(e.target.value) || 500))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium">Queue Health</h3>
                  <p className="text-sm text-gray-500">
                    Validate the Redis connection and worker status.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleQueueHealthCheck}
                    disabled={checkingQueueHealth}
                    className="flex items-center gap-2"
                  >
                    {checkingQueueHealth ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                    Test Redis
                  </Button>
                  <Button
                    variant="outline"
                    onClick={checkQueueWorkers}
                    disabled={checkingWorkerStatus}
                    className="flex items-center gap-2"
                  >
                    {checkingWorkerStatus ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Refresh Workers
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Redis status</p>
                  <p className={`text-lg font-semibold ${queueStatusColor}`}>
                    {queueHealth.status === 'healthy'
                      ? 'Healthy'
                      : queueHealth.status === 'unreachable'
                      ? 'Unreachable'
                      : 'Unknown'}
                  </p>
                  {queueHealth.latency !== undefined && (
                    <p className="text-xs text-gray-500">Latency: {queueHealth.latency} ms</p>
                  )}
                  {queueHealth.message && (
                    <p className="text-xs text-red-500 mt-1">{queueHealth.message}</p>
                  )}
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Workers</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li className={workerStatus.email ? 'text-green-600' : 'text-red-500'}>
                      {workerStatus.email ? '●' : '○'} Email worker {workerStatus.email ? 'ready' : 'not running'}
                    </li>
                    <li className={workerStatus.sms ? 'text-green-600' : 'text-red-500'}>
                      {workerStatus.sms ? '●' : '○'} SMS worker {workerStatus.sms ? 'ready' : 'not running'}
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    Workers initialize automatically when the admin app starts.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'routing' && (
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Notification Routing Overview</h3>
            <p className="text-sm text-gray-500 mb-6">
              This shows which notification types are enabled for each channel. Configure individual channels in their respective tabs.
            </p>
            
            <div className="space-y-4">
              {Object.entries(
                NOTIFICATION_TYPES.reduce((acc, type) => {
                  if (!acc[type.category]) acc[type.category] = [];
                  acc[type.category].push(type);
                  return acc;
                }, {} as { [key: string]: typeof NOTIFICATION_TYPES })
              ).map(([category, types]) => (
                <div key={category}>
                  <h4 className="font-medium text-gray-700 mb-3">{category}</h4>
                  <div className="space-y-2">
                    {types.map((type) => (
                      <div key={type.id} className="flex items-center gap-4 p-3 border rounded-lg">
                        <type.icon className="h-4 w-4 text-gray-500" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{type.name}</div>
                          <div className="text-xs text-gray-500">{type.description}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span className={`text-xs px-2 py-1 rounded ${
                              settings.email.enabled && settings.email.notifications[type.id]
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {settings.email.enabled && settings.email.notifications[type.id] ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-400" />
                            <span className={`text-xs px-2 py-1 rounded ${
                              settings.sms.enabled && settings.sms.notifications[type.id]
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {settings.sms.enabled && settings.sms.notifications[type.id] ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Email Templates Tab */}
        {activeTab === 'email-templates' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium">Email Templates</h3>
                  <p className="text-sm text-gray-500">Customize email message templates for different notification types</p>
                </div>
                <Button
                  onClick={() => {
                    setIsCreatingNew(true);
                    setEditingTemplate({
                      id: '',
                      name: '',
                      subject: '',
                      body: '',
                      variables: []
                    });
                  }}
                  className={`bg-${themeClasses.primary} text-white hover:bg-${themeClasses.primaryDark}`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Add New Template
                </Button>
              </div>
              
              <div className="space-y-4">
                {emailTemplates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-gray-500">Template ID: {template.id}</p>
                      </div>
                      <Button
                        onClick={() => setEditingTemplate(template)}
                        variant="outline"
                        size="sm"
                      >
                        Edit Template
                      </Button>
                    </div>
                    
                    {template.subject && (
                      <div className="mb-3">
                        <Label className="text-sm font-medium">Subject</Label>
                        <div className="mt-1 p-2 bg-gray-50 rounded text-sm">
                          {template.subject}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-sm font-medium">Body Preview</Label>
                      <div className="mt-1 p-3 bg-gray-50 rounded text-sm max-h-32 overflow-y-auto">
                        <div dangerouslySetInnerHTML={{ __html: template.body.substring(0, 200) + '...' }} />
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <Label className="text-sm font-medium">Available Variables</Label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {template.variables.map((variable) => (
                          <span key={variable} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {`{{${variable}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* SMS Templates Tab */}
        {activeTab === 'sms-templates' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium">SMS Templates</h3>
                  <p className="text-sm text-gray-500">Customize SMS message templates for different notification types</p>
                </div>
                <Button
                  onClick={() => {
                    setIsCreatingNew(true);
                    setEditingTemplate({
                      id: '',
                      name: '',
                      body: '',
                      variables: []
                    });
                  }}
                  className={`bg-${themeClasses.primary} text-white hover:bg-${themeClasses.primaryDark}`}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Add New Template
                </Button>
              </div>
              
              <div className="space-y-4">
                {smsTemplates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-gray-500">Template ID: {template.id}</p>
                      </div>
                      <Button
                        onClick={() => setEditingTemplate(template)}
                        variant="outline"
                        size="sm"
                      >
                        Edit Template
                      </Button>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Message</Label>
                      <div className="mt-1 p-3 bg-gray-50 rounded text-sm">
                        {template.body}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Characters: {template.body.length}/160
                      </p>
                    </div>
                    
                    <div className="mt-2">
                      <Label className="text-sm font-medium">Available Variables</Label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {template.variables.map((variable) => (
                          <span key={variable} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {`{{${variable}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Template Editor Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {isCreatingNew ? 'Create New Template' : `Edit Template: ${editingTemplate.name}`}
              </h3>
              <Button
                onClick={() => {
                  setEditingTemplate(null);
                  setIsCreatingNew(false);
                }}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Template ID and Name fields for new templates */}
              {isCreatingNew && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="templateId">Template ID</Label>
                      <Input
                        id="templateId"
                        value={editingTemplate.id}
                        onChange={(e) => setEditingTemplate({
                          ...editingTemplate,
                          id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                        })}
                        placeholder="e.g., custom_alert"
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use lowercase letters, numbers, and underscores only
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="templateName">Template Name</Label>
                      <Input
                        id="templateName"
                        value={editingTemplate.name}
                        onChange={(e) => setEditingTemplate({
                          ...editingTemplate,
                          name: e.target.value
                        })}
                        placeholder="e.g., Custom Alert"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </>
              )}
              
              {editingTemplate.subject !== undefined && (
                <div>
                  <Label htmlFor="templateSubject">Subject</Label>
                  <Input
                    id="templateSubject"
                    value={editingTemplate.subject}
                    onChange={(e) => setEditingTemplate({
                      ...editingTemplate,
                      subject: e.target.value
                    })}
                    placeholder="Enter email subject"
                    className="mt-1"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="templateBody">Message Body</Label>
                <textarea
                  id="templateBody"
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    body: e.target.value
                  })}
                  placeholder="Enter message body"
                  className="mt-1 w-full h-64 p-3 border border-gray-300 rounded-md resize-none"
                  rows={10}
                />
                {activeTab === 'sms-templates' && (
                  <p className="mt-1 text-sm text-gray-500">
                    Characters: {editingTemplate.body.length}/160
                  </p>
                )}
              </div>
              
              {/* Variables section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Available Variables</Label>
                  {isCreatingNew && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add variable (e.g., customerName)"
                          className="text-sm w-48"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              const newVariable = input.value.trim();
                              if (newVariable && !editingTemplate.variables.includes(newVariable)) {
                                setEditingTemplate({
                                  ...editingTemplate,
                                  variables: [...editingTemplate.variables, newVariable]
                                });
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <Button
                          onClick={() => {
                            const input = document.querySelector('input[placeholder="Add variable (e.g., customerName)"]') as HTMLInputElement;
                            const newVariable = input.value.trim();
                            if (newVariable && !editingTemplate.variables.includes(newVariable)) {
                              setEditingTemplate({
                                ...editingTemplate,
                                variables: [...editingTemplate.variables, newVariable]
                              });
                              input.value = '';
                            }
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-gray-500">Common variables:</span>
                        {['recipientName', 'productName', 'productSku', 'currentStock', 'reorderPoint', 'warehouseName', 'orderNumber', 'customerName', 'totalAmount', 'currency', 'itemCount', 'orderDate'].map(variable => (
                          <button
                            key={variable}
                            onClick={() => {
                              if (!editingTemplate.variables.includes(variable)) {
                                setEditingTemplate({
                                  ...editingTemplate,
                                  variables: [...editingTemplate.variables, variable]
                                });
                              }
                            }}
                            disabled={editingTemplate.variables.includes(variable)}
                            className={`text-xs px-2 py-1 rounded ${
                              editingTemplate.variables.includes(variable)
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer'
                            }`}
                          >
                            {variable}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-1 flex flex-wrap gap-2">
                  {editingTemplate.variables.map((variable) => (
                    <div key={variable} className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const textarea = document.getElementById('templateBody') as HTMLTextAreaElement;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const text = textarea.value;
                          const before = text.substring(0, start);
                          const after = text.substring(end, text.length);
                          const variableText = `{{${variable}}}`;
                          
                          setEditingTemplate({
                            ...editingTemplate,
                            body: before + variableText + after
                          });
                          
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + variableText.length, start + variableText.length);
                          }, 0);
                        }}
                        className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200 cursor-pointer"
                      >
                        {`{{${variable}}}`}
                      </button>
                      {isCreatingNew && (
                        <button
                          onClick={() => {
                            setEditingTemplate({
                              ...editingTemplate,
                              variables: editingTemplate.variables.filter(v => v !== variable)
                            });
                          }}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <p className="mt-1 text-xs text-gray-500">
                  Click on a variable to insert it into the message
                  {isCreatingNew && ' • Click × to remove a variable'}
                </p>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setEditingTemplate(null);
                    setIsCreatingNew(false);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // Validate required fields for new templates
                    if (isCreatingNew) {
                      if (!editingTemplate.id || !editingTemplate.name || !editingTemplate.body) {
                        showError('Please fill in all required fields (ID, Name, and Body)');
                        return;
                      }
                      
                      // Check if ID already exists
                      const existingTemplates = activeTab === 'email-templates' ? emailTemplates : smsTemplates;
                      if (existingTemplates.some(t => t.id === editingTemplate.id)) {
                        showError('Template ID already exists. Please choose a different ID.');
                        return;
                      }
                    }
                    
                    // Update or create the template in the appropriate state
                    if (activeTab === 'email-templates') {
                      if (isCreatingNew) {
                        setEmailTemplates(prev => [...prev, editingTemplate]);
                        showSuccess('Email template created successfully');
                      } else {
                        setEmailTemplates(prev => 
                          prev.map(t => t.id === editingTemplate.id ? editingTemplate : t)
                        );
                        showSuccess('Email template updated successfully');
                      }
                    } else {
                      if (isCreatingNew) {
                        setSmsTemplates(prev => [...prev, editingTemplate]);
                        showSuccess('SMS template created successfully');
                      } else {
                        setSmsTemplates(prev => 
                          prev.map(t => t.id === editingTemplate.id ? editingTemplate : t)
                        );
                        showSuccess('SMS template updated successfully');
                      }
                    }
                    
                    setEditingTemplate(null);
                    setIsCreatingNew(false);
                  }}
                  className={`bg-${themeClasses.primary} text-white hover:bg-${themeClasses.primaryDark}`}
                >
                  {isCreatingNew ? 'Create Template' : 'Save Template'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Test Popup */}
      {showEmailPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Send Test Email</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter your email address to receive a test email notification:
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="testEmailInput">Email Address</Label>
                <Input
                  id="testEmailInput"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowEmailPopup(false)}
                  disabled={isTesting === 'email'}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleTest('email')}
                  disabled={isTesting === 'email' || !testEmail}
                  style={{ backgroundColor: getThemeColor(), color: 'white' }}
                  className="hover:opacity-90"
                >
                  {isTesting === 'email' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Notification Popup */}
      {showTestNotificationPopup && testNotificationType && testNotificationChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">
              Send Test {testNotificationChannel === 'email' ? 'Email' : 'SMS'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {testNotificationChannel === 'email' 
                ? `Enter an email address to receive a test ${testNotificationType} notification:`
                : `Enter a phone number to receive a test ${testNotificationType} notification:`
              }
            </p>
            <div className="space-y-4">
              {testNotificationChannel === 'email' ? (
                <div>
                  <Label htmlFor="testNotificationEmailInput">Email Address</Label>
                  <Input
                    id="testNotificationEmailInput"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="testNotificationPhoneInput">Phone Number</Label>
                  <Input
                    id="testNotificationPhoneInput"
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="e.g., +233244000000 or 0244000000"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Include country code (e.g., +233 for Ghana) or start with 0
                  </p>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTestNotificationPopup(false);
                    setTestNotificationType(null);
                    setTestNotificationChannel(null);
                  }}
                  disabled={isTesting === testNotificationType}
                >
                  Cancel
                </Button>
                <Button
                  onClick={sendTestNotification}
                  disabled={isTesting === testNotificationType || (testNotificationChannel === 'email' ? !testEmail : !testPhone)}
                  style={{ backgroundColor: getThemeColor(), color: 'white' }}
                  className="hover:opacity-90"
                >
                  {isTesting === testNotificationType ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Send Test {testNotificationChannel === 'email' ? 'Email' : 'SMS'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMS Test Popup */}
      {showSMSPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Send Test SMS</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter a phone number to receive a test SMS notification:
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="testPhoneInput">Phone Number</Label>
                <Input
                  id="testPhoneInput"
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="e.g., +233244000000 or 0244000000"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include country code (e.g., +233 for Ghana) or start with 0
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => {
                    setTestPhone('');
                    setShowSMSPopup(false);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleTest('sms', undefined, testPhone)}
                  disabled={!testPhone || isTesting === 'sms'}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isTesting === 'sms' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test SMS
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Task Notifications Tab */}
        {activeTab === 'task-notifications' && (
          <div className="space-y-6">
            {/* Automatic Runner Status */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Automatic Notification Runner</h3>
                  <p className="text-sm text-gray-500">
                    Automatically processes task notifications every minute
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      runnerStatus === 'running' ? 'bg-green-500' : 
                      runnerStatus === 'stopped' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-sm font-medium">
                      {runnerStatus === 'loading' ? 'Checking...' : 
                       runnerStatus === 'running' ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                  {runnerStatus !== 'loading' && (
                    <Button
                      onClick={() => toggleRunner(runnerStatus === 'running' ? 'stop' : 'start')}
                      size="sm"
                      className={runnerStatus === 'running' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                    >
                      {runnerStatus === 'running' ? 'Stop' : 'Start'} Runner
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Task Notifications Enable/Disable */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Task Due Date Notifications</h3>
                  <p className="text-sm text-gray-500">
                    Configure automatic notifications for task due dates and overdue tasks
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={settings.taskNotifications.enabled}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({
                        ...prev,
                        taskNotifications: {
                          ...prev.taskNotifications,
                          enabled: !!checked
                        }
                      }))
                    }
                  />
                  <Label htmlFor="task-notifications-enabled">
                    {settings.taskNotifications.enabled ? 'Enabled' : 'Disabled'}
                  </Label>
                </div>
              </div>
            </Card>

            {/* Task Notification Settings */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-6">Notification Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Minutes Before Due */}
                <div>
                  <Label htmlFor="minutes-before-due">Minutes Before Due Date</Label>
                  <Input
                    id="minutes-before-due"
                    type="number"
                    min="1"
                    max="1440"
                    value={settings.taskNotifications.minutesBeforeDue}
                    onChange={(e) =>
                      setSettings(prev => ({
                        ...prev,
                        taskNotifications: {
                          ...prev.taskNotifications,
                          minutesBeforeDue: parseInt(e.target.value) || 10
                        }
                      }))
                    }
                    className="mt-1"
                    disabled={!settings.taskNotifications.enabled}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Send reminder notification this many minutes before task is due (1-1440 minutes)
                  </p>
                </div>

                {/* Escalation Interval */}
                <div>
                  <Label htmlFor="escalation-interval">Escalation Interval (Hours)</Label>
                  <Input
                    id="escalation-interval"
                    type="number"
                    min="1"
                    max="24"
                    value={settings.taskNotifications.escalationInterval}
                    onChange={(e) =>
                      setSettings(prev => ({
                        ...prev,
                        taskNotifications: {
                          ...prev.taskNotifications,
                          escalationInterval: parseInt(e.target.value) || 1
                        }
                      }))
                    }
                    className="mt-1"
                    disabled={!settings.taskNotifications.enabled}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Send escalation notification every X hours for overdue tasks (1-24 hours)
                  </p>
                </div>
              </div>

              {/* Notification Types */}
              <div className="mt-6">
                <h4 className="text-md font-medium mb-4">Notification Types</h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={settings.taskNotifications.sendDueSoon}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          taskNotifications: {
                            ...prev.taskNotifications,
                            sendDueSoon: !!checked
                          }
                        }))
                      }
                      disabled={!settings.taskNotifications.enabled}
                    />
                    <Label htmlFor="send-due-soon">
                      Send "Due Soon" notifications
                    </Label>
                    <span className="text-sm text-gray-500">
                      (X minutes before due date)
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={settings.taskNotifications.sendOverdue}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          taskNotifications: {
                            ...prev.taskNotifications,
                            sendOverdue: !!checked
                          }
                        }))
                      }
                      disabled={!settings.taskNotifications.enabled}
                    />
                    <Label htmlFor="send-overdue">
                      Send "Overdue" notifications
                    </Label>
                    <span className="text-sm text-gray-500">
                      (When task becomes overdue)
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={settings.taskNotifications.sendEscalation}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({
                          ...prev,
                          taskNotifications: {
                            ...prev.taskNotifications,
                            sendEscalation: !!checked
                          }
                        }))
                      }
                      disabled={!settings.taskNotifications.enabled}
                    />
                    <Label htmlFor="send-escalation">
                      Send "Escalation" notifications
                    </Label>
                    <span className="text-sm text-gray-500">
                      (Every X hours for overdue tasks)
                    </span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`${themeClasses.primary} ${themeClasses.primaryDark}`}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Task Notification Settings
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Test Task Notifications */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-6">Test Task Notifications</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">How Task Notifications Work</h4>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li>• <strong>Due Soon:</strong> Sent X minutes before task is due</li>
                      <li>• <strong>Overdue:</strong> Sent immediately when task becomes overdue</li>
                      <li>• <strong>Escalation:</strong> Sent every X hours for tasks that remain overdue</li>
                      <li>• Notifications are sent to both email and SMS (if configured)</li>
                      <li>• Only active tasks with assigned users receive notifications</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <Button
                  onClick={async () => {
                    setIsTesting('task-notifications');
                    try {
                      const response = await fetch('/api/tasks/process-notifications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        showSuccess(`Task notifications processed successfully! Found ${result.stats.tasksDueSoon} tasks due soon and ${result.stats.overdueTasks} overdue tasks.`);
                      } else {
                        showError('Failed to process task notifications');
                      }
                    } catch (error) {
                      showError('Error testing task notifications');
                    } finally {
                      setIsTesting(null);
                    }
                  }}
                  disabled={isTesting === 'task-notifications'}
                  style={{ backgroundColor: getThemeColor(), color: 'white' }}
                  className="hover:opacity-90"
                >
                  {isTesting === 'task-notifications' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Process Task Notifications Now
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/tasks/stats-simple');
                      if (response.ok) {
                        const result = await response.json();
                        showSuccess(`SIMPLE STATS: ${result.stats.tasksDueSoon} tasks due soon, ${result.stats.overdueTasks} overdue tasks`);
                      } else {
                        const errorData = await response.json();
                        showError(`Failed: ${errorData.error}`);
                      }
                    } catch (error) {
                      showError(`Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
                    }
                  }}
                  variant="outline"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Check Notification Stats
                </Button>
                
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/debug/task-notifications');
                      if (response.ok) {
                        const result = await response.json();
                        console.log('Debug info:', result);
                        const analysis = result.analysis;
                        showSuccess(`Debug complete - Found ${analysis.totalTasksWithDueDates} tasks with due dates. Due soon: ${analysis.tasksDueSoon}, Overdue: ${analysis.overdueTasks}. Check console for full details.`);
                      } else {
                        showError('Failed to get debug info');
                      }
                    } catch (error) {
                      showError('Error getting debug info');
                    }
                  }}
                  variant="outline"
                  className="bg-yellow-100 hover:bg-yellow-200"
                >
                  🔍 Debug Tasks
                </Button>
                
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/debug/tasks-direct');
                      if (response.ok) {
                        const result = await response.json();
                        console.log('Direct debug info:', result);
                        showSuccess(`Direct debug - Found ${result.totalTasks} total tasks. Check console for query results.`);
                      } else {
                        showError('Failed to get direct debug info');
                      }
                    } catch (error) {
                      showError('Error getting direct debug info');
                    }
                  }}
                  variant="outline"
                  className="bg-red-100 hover:bg-red-200"
                >
                  🔬 Direct DB Query
                </Button>
              </div>
            </Card>
          </div>
        )}
    </>
  );
}