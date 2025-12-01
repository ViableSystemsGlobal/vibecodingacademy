"use client";

import React, { useState, useEffect } from "react";
import { Mail, MessageSquare, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { useCompany } from "@/contexts/company-context";

interface Invoice {
  id: string;
  number: string;
  subject: string;
  total: number;
  amountDue: number;
  dueDate: string;
  account?: {
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
  };
}

interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
}

export const SendInvoiceModal: React.FC<SendInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
}) => {
  const [email, setEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { success, error: showError } = useToast();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const themeColorValue = getThemeColor();
  const { companyName } = useCompany();

  // Get customer info
  const customerName = invoice.account?.name || 
                      invoice.distributor?.businessName || 
                      (invoice.lead ? `${invoice.lead.firstName} ${invoice.lead.lastName}`.trim() : '') ||
                      'Customer';
  
  const customerEmail = invoice.account?.email || invoice.distributor?.email || invoice.lead?.email || '';
  const customerPhone = invoice.account?.phone || invoice.distributor?.phone || invoice.lead?.phone || '';

  // Generate PDF link
  const pdfUrl = `${window.location.origin}/invoices/${invoice.id}/pdf`;

  useEffect(() => {
    if (isOpen) {
      setEmail(customerEmail);
      setCcEmail('');
      setPhone(customerPhone);
      setMessage(`Dear ${customerName},\n\nPlease find your invoice ${invoice.number} attached. The total amount is GH₵${invoice.total.toFixed(2)} and is due on ${new Date(invoice.dueDate).toLocaleDateString()}.\n\nAmount Due: GH₵${invoice.amountDue.toFixed(2)}\n\nView your invoice here: ${pdfUrl}\n\nBest regards,\n${companyName || 'Team'}`);
    }
  }, [isOpen, customerName, customerEmail, customerPhone, invoice, pdfUrl]);

  const handleSendEmail = async () => {
    if (!email.trim()) {
      showError("Please enter an email address");
      return;
    }

    setIsLoading(true);
    try {
      // Prepare recipients array
      const recipients = [email];
      if (ccEmail.trim()) {
        recipients.push(ccEmail.trim());
      }

      const response = await fetch('/api/communication/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: recipients,
          subject: `Invoice ${invoice.number} - ${invoice.subject}`,
          message: message,
          isBulk: false,
          attachments: [
            {
              filename: `Invoice-${invoice.number}.pdf`,
              url: pdfUrl,
              contentType: 'application/pdf'
            }
          ]
        }),
      });

      if (response.ok) {
        const recipientText = ccEmail.trim() ? `${email} and ${ccEmail}` : email;
        success(`Invoice sent via email to ${recipientText}`);
        onClose();
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to send email. Please try again.");
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showError("Failed to send email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!phone.trim()) {
      showError("Please enter a phone number");
      return;
    }

    setIsLoading(true);
    try {
      // Create SMS message with PDF link (use GHS instead of GH₵ for SMS)
      const smsMessage = `Dear ${customerName}, your invoice ${invoice.number} is due on ${new Date(invoice.dueDate).toLocaleDateString()}. Amount due: GHS ${invoice.amountDue.toFixed(2)}. View invoice: ${pdfUrl}`;

      const response = await fetch('/api/communication/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [phone],
          message: smsMessage,
          isBulk: false
        }),
      });

      if (response.ok) {
        success(`Invoice sent via SMS to ${phone}`);
        onClose();
      } else {
        const errorData = await response.json();
        showError(errorData.error || "Failed to send SMS. Please try again.");
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      showError("Failed to send SMS. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Invoice {invoice.number}</DialogTitle>
          <button onClick={onClose} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="ccEmail" className="text-right">
              CC
            </Label>
            <Input
              id="ccEmail"
              type="email"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              placeholder="Optional CC email"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="message" className="text-right pt-2">
              Message
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="col-span-3 h-24"
            />
          </div>
        </div>
        <DialogFooter>
          <button 
            onClick={handleSendEmail} 
            disabled={isLoading}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 text-white hover:opacity-90 transition-opacity border-0 shadow-sm hover:shadow-md gap-2"
            style={{ 
              backgroundColor: themeColorValue || '#dc2626', 
              color: '#ffffff',
              borderColor: themeColorValue || '#dc2626'
            }}
          >
            {isLoading ? 'Sending...' : <><Mail className="h-4 w-4" /> Send Email</>}
          </button>
          <button 
            onClick={handleSendSMS} 
            disabled={isLoading}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 text-white hover:opacity-90 transition-opacity border-0 shadow-sm hover:shadow-md gap-2"
            style={{ 
              backgroundColor: themeColorValue || '#dc2626', 
              color: '#ffffff',
              borderColor: themeColorValue || '#dc2626'
            }}
          >
            {isLoading ? 'Sending...' : <><MessageSquare className="h-4 w-4" /> Send SMS</>}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
