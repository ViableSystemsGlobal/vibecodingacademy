'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import Link from 'next/link';

interface Class {
  id: string;
  title: string;
  description: string | null;
  type: 'FREE' | 'BOOTCAMP';
  startDatetime: string;
  priceCents: number;
  capacity: number;
  _count: {
    registrations: number;
  };
}

interface RegistrationData {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  parentCity: string;
  students: Array<{
    name: string;
    age?: number;
    school?: string;
  }>;
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);

  useEffect(() => {
    // Get registration data from sessionStorage (set from homepage)
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('bootcamp_registration_data');
      if (stored) {
        try {
          setRegistrationData(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse registration data', e);
        }
      }
    }
  }, []);

  const { data: classData, isLoading: classLoading } = useQuery<Class>({
    queryKey: ['class', classId],
    queryFn: () => apiClient.get<Class>(`/public/classes/${classId}`),
    enabled: !!classId,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: { classId: string; registrationData: RegistrationData }) => {
      // Calculate total amount (price per child)
      const totalAmount = data.registrationData.students.length * (classData?.priceCents || 50000);

      // Step 1: Create payment attempt (no registration yet)
      const attemptResponse = await apiClient.post('/public/payment-attempts/create', {
        classId: data.classId,
        parentName: data.registrationData.parentName,
        parentEmail: data.registrationData.parentEmail,
        parentPhone: data.registrationData.parentPhone,
        parentCity: data.registrationData.parentCity,
        students: data.registrationData.students,
        amountCents: totalAmount,
        currency: 'GHS',
      });

      // apiClient.post already unwraps the response
      const attemptId = attemptResponse.id;

      if (!attemptId) {
        console.error('Payment attempt response:', attemptResponse);
        throw new Error('Payment attempt ID not found in response.');
      }

      // Step 2: Create payment from attempt
      const paymentResponse = await apiClient.post('/public/payments/create', {
        paymentAttemptId: attemptId,
      });

      return paymentResponse;
    },
    onSuccess: (data) => {
      // Clear session storage
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('bootcamp_registration_data');
      }

      // apiClient.post already unwraps the response, so data is the response object
      // Response format: { payment: {...}, authorizationUrl: "..." }
      const authorizationUrl = data.authorizationUrl;
      
      if (authorizationUrl) {
        toast.success('Redirecting to payment...');
        // Redirect to Paystack payment page
        window.location.href = authorizationUrl;
      } else {
        console.error('No authorization URL in response:', data);
        toast.error('Payment initialization failed - No authorization URL received');
        router.push('/payment-failed?error=Payment initialization failed - No authorization URL received');
      }
    },
    onError: (error: any) => {
      console.error('Registration/Payment error:', error);
      toast.error(error.message || 'Payment initialization failed');
      router.push(`/payment-failed?error=${encodeURIComponent(error.message || 'Payment initialization failed')}`);
    },
  });

  const handleCheckout = () => {
    if (!classId || !registrationData) {
      alert('Missing class or registration information');
      return;
    }

    checkoutMutation.mutate({
      classId,
      registrationData,
    });
  };

  if (classLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl mb-4">Loading checkout...</div>
        </div>
      </div>
    );
  }

  if (!classData || !registrationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Checkout Information Missing</h1>
          <p className="text-gray-600 mb-6">
            {!classData ? 'Class information not found.' : 'Registration information not found.'}
          </p>
          <Link href="/classes?type=BOOTCAMP">
            <Button>Browse Bootcamp Classes</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalAmount = registrationData.students.length * classData.priceCents;
  const totalGHS = (totalAmount / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Complete Your Registration</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{classData.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{classData.description || 'Bootcamp class'}</p>
                <div className="space-y-1 text-sm">
                  <div>
                    <strong>Start Date:</strong>{' '}
                    {format(new Date(classData.startDatetime), 'MMM dd, yyyy HH:mm')}
                  </div>
                  <div>
                    <strong>Type:</strong> {classData.type}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Students ({registrationData.students.length})</h4>
                <div className="space-y-2">
                  {registrationData.students.map((student, index) => (
                    <div key={index} className="text-sm">
                      {index + 1}. {student.name}
                      {student.age && ` (Age: ${student.age})`}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Price per child:</span>
                  <span>GHS {(classData.priceCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Number of children:</span>
                  <span>{registrationData.students.length}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-orange-600">GHS {totalGHS}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registration Details */}
          <Card>
            <CardHeader>
              <CardTitle>Registration Details</CardTitle>
              <CardDescription>Review your information before proceeding to payment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Parent Name</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">{registrationData.parentName}</div>
              </div>
              <div>
                <Label>Email</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">{registrationData.parentEmail}</div>
              </div>
              <div>
                <Label>Phone</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">{registrationData.parentPhone}</div>
              </div>
              <div>
                <Label>City</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">{registrationData.parentCity}</div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={handleCheckout}
                  disabled={checkoutMutation.isPending}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white py-6 text-lg font-bold"
                >
                  {checkoutMutation.isPending ? 'Processing...' : `Pay GHS ${totalGHS}`}
                </Button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  You will be redirected to Paystack to complete payment
                </p>
              </div>

              <Link href="/classes?type=BOOTCAMP" className="block text-center text-sm text-gray-600 hover:text-gray-800">
                ← Back to Classes
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

