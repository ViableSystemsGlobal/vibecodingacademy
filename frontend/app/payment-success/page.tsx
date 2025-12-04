'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference');

  useEffect(() => {
    // Verify payment if reference is provided
    if (reference) {
      // Payment verification will be handled by webhook, but we can also verify here for immediate feedback
      const verifyPayment = async () => {
        try {
          await apiClient.get(`/public/payments/verify?reference=${reference}`);
        } catch (error) {
          console.error('Payment verification error:', error);
          // Don't show error to user, webhook will handle it
        }
      };
      verifyPayment();
    }
  }, [reference]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your registration has been confirmed and payment processed successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <strong>What's next?</strong>
            </p>
            <ul className="text-sm text-green-700 mt-2 space-y-1 list-disc list-inside">
              <li>You will receive a confirmation email shortly</li>
              <li>Class details and meeting links will be sent before the class starts</li>
              <li>You can view your registrations in the Parent Portal</li>
            </ul>
          </div>

          {reference && (
            <div className="text-xs text-gray-500 text-center">
              Reference: {reference}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4">
            <Link href="/parent/login">
              <Button className="w-full">Go to Parent Portal</Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full">
                Return to Homepage
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

