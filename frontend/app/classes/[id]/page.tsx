'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, DollarSign, ArrowLeft, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface ClassDetail {
  id: string;
  title: string;
  description: string | null;
  type: 'FREE' | 'BOOTCAMP';
  ageGroup: string | null;
  startDatetime: string;
  endDatetime: string | null;
  durationMinutes: number | null;
  capacity: number;
  priceCents: number;
  currency: string;
  meetingLink: string | null;
  status: string;
  _count: {
    registrations: number;
  };
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const { data: classData, isLoading, error } = useQuery<ClassDetail>({
    queryKey: ['public-class', classId],
    queryFn: () => apiClient.get<ClassDetail>(`/public/classes/${classId}`),
    enabled: !!classId,
  });

  const handleRegister = () => {
    if (typeof window !== 'undefined') {
      const bootcampData = sessionStorage.getItem('bootcamp_registration_data');
      if (bootcampData && classData?.type === 'BOOTCAMP') {
        router.push(`/checkout?classId=${classId}`);
      } else {
        router.push(`/register/${classId}`);
      }
    } else {
      router.push(`/register/${classId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl">Loading class details...</div>
        </div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Class Not Found</h1>
          <p className="text-gray-600 mb-6">The class you're looking for doesn't exist or is no longer available.</p>
          <Link href="/classes">
            <Button>Browse All Classes</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isFull = classData._count.registrations >= classData.capacity;
  const spotsLeft = classData.capacity - classData._count.registrations;
  const price = classData.priceCents / 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link href="/classes">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Classes
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">{classData.title}</h1>
                    <Badge
                      variant={classData.type === 'FREE' ? 'default' : 'secondary'}
                      className={
                        classData.type === 'FREE'
                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                      }
                    >
                      {classData.type}
                    </Badge>
                  </div>
                  {classData.description && (
                    <p className="text-gray-600 text-lg mt-4">{classData.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Class Details */}
            <Card>
              <CardHeader>
                <CardTitle>Class Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Start Date & Time</p>
                      <p className="font-medium">
                        {format(new Date(classData.startDatetime), 'EEEE, MMMM dd, yyyy')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(classData.startDatetime), 'h:mm a')}
                      </p>
                    </div>
                  </div>

                  {classData.endDatetime && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">End Date & Time</p>
                        <p className="font-medium">
                          {format(new Date(classData.endDatetime), 'EEEE, MMMM dd, yyyy')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {format(new Date(classData.endDatetime), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  )}

                  {classData.durationMinutes && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Duration</p>
                        <p className="font-medium">
                          {classData.durationMinutes >= 60
                            ? `${Math.floor(classData.durationMinutes / 60)} hour${Math.floor(classData.durationMinutes / 60) > 1 ? 's' : ''}`
                            : ''}
                          {classData.durationMinutes % 60 > 0
                            ? ` ${classData.durationMinutes % 60} minute${classData.durationMinutes % 60 > 1 ? 's' : ''}`
                            : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {classData.ageGroup && (
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Age Group</p>
                        <p className="font-medium">{classData.ageGroup}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Meeting Link */}
            {classData.meetingLink && (
              <Card>
                <CardHeader>
                  <CardTitle>Meeting Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">
                    This class will be conducted online. You'll receive the meeting link after registration.
                  </p>
                  <a
                    href={classData.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
                  >
                    Preview Meeting Link
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Registration Card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Registration</CardTitle>
                <CardDescription>Join this class today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Price</span>
                    <span className="text-2xl font-bold">
                      {classData.priceCents === 0 ? (
                        <span className="text-green-600">Free</span>
                      ) : (
                        <span>
                          {classData.currency} {price.toFixed(2)}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Capacity</span>
                    <span className="font-medium">
                      {classData._count.registrations} / {classData.capacity} registered
                    </span>
                  </div>

                  {!isFull && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Spots Available</span>
                      <span className="font-medium text-green-600">
                        {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
                      </span>
                    </div>
                  )}

                  {isFull && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-800 font-medium">This class is full</p>
                      <p className="text-xs text-red-600 mt-1">
                        Contact us to be added to the waitlist
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={handleRegister}
                    disabled={isFull}
                    className="w-full"
                    size="lg"
                  >
                    {isFull ? 'Class Full' : classData.type === 'BOOTCAMP' ? 'Register & Pay' : 'Register Now'}
                  </Button>
                </div>

                {classData.type === 'FREE' && (
                  <p className="text-xs text-center text-gray-500">
                    Free classes require no payment. Just register and join!
                  </p>
                )}

                {classData.type === 'BOOTCAMP' && (
                  <p className="text-xs text-center text-gray-500">
                    Payment required to confirm your registration
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

