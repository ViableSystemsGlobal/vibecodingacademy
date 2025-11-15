'use client';

import { useState } from 'react';
import { useToast } from '@/contexts/toast-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Send, Mail } from 'lucide-react';

interface SendCustomerEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  emailAddress: string;
  onSent?: () => void;
}

export default function SendCustomerEmailModal({
  isOpen,
  onClose,
  customerName,
  emailAddress,
  onSent
}: SendCustomerEmailModalProps) {
  const { success, error } = useToast();
  
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      error('Please enter both subject and message');
      return;
    }

    if (!emailAddress || !emailAddress.trim()) {
      error('Email address is required');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/communication/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: [emailAddress.trim()],
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        success('Email sent successfully!');
        setSubject('');
        setMessage('');
        onSent?.();
        onClose();
      } else {
        error(data.error || 'Failed to send email');
      }
    } catch (err) {
      console.error('Error sending email:', err);
      error('An error occurred while sending email');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSubject('');
    setMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Send Email</h2>
              <p className="text-sm text-gray-600">{customerName}</p>
            </div>
          </div>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              value={emailAddress}
              disabled
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="mt-1 min-h-[150px]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

