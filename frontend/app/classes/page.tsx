'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

interface Class {
  id: string;
  title: string;
  description: string | null;
  type: 'FREE' | 'BOOTCAMP';
  ageGroup: string | null;
  startDatetime: string;
  capacity: number;
  priceCents: number;
  _count: {
    registrations: number;
  };
}

interface ClassesResponse {
  classes: Class[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function ClassesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>(
    searchParams.get('type') || 'all'
  );
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery<ClassesResponse>({
    queryKey: ['public-classes', typeFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
      });
      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }
      return apiClient.get<ClassesResponse>(`/public/classes?${params.toString()}`);
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Available Classes</h1>
          <p className="text-gray-600 text-sm sm:text-base">Browse and register for our coding classes</p>
        </div>

        <div className="mb-6 flex gap-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              <SelectItem value="FREE">Free Classes</SelectItem>
              <SelectItem value="BOOTCAMP">Bootcamps</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <div>Loading classes...</div>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <div className="text-red-600">Error loading classes</div>
          </div>
        )}

        {data && (
          <>
            {data.classes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No classes available at the moment.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {data.classes.map((classItem) => (
                  <Card key={classItem.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-xl">{classItem.title}</CardTitle>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            classItem.type === 'FREE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {classItem.type}
                        </span>
                      </div>
                      <CardDescription>
                        {classItem.description || 'No description available'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                      <div className="space-y-2 mb-4">
                        <div className="text-sm text-gray-600">
                          <strong>Start:</strong>{' '}
                          {format(new Date(classItem.startDatetime), 'MMM dd, yyyy HH:mm')}
                        </div>
                        {classItem.ageGroup && (
                          <div className="text-sm text-gray-600">
                            <strong>Age Group:</strong> {classItem.ageGroup}
                          </div>
                        )}
                        <div className="text-sm text-gray-600">
                          <strong>Capacity:</strong> {classItem._count.registrations} /{' '}
                          {classItem.capacity}
                        </div>
                        <div className="text-lg font-semibold">
                          {classItem.priceCents === 0 ? (
                            <span className="text-green-600">Free</span>
                          ) : (
                            <span>GHS {(classItem.priceCents / 100).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => router.push(`/classes/${classItem.id}`)}
                          variant="outline"
                          className="flex-1"
                        >
                          View Details
                        </Button>
                        <Button
                          onClick={() => {
                            // Check if we have bootcamp registration data from homepage
                            if (typeof window !== 'undefined') {
                              const bootcampData = sessionStorage.getItem('bootcamp_registration_data');
                              if (bootcampData && classItem.type === 'BOOTCAMP') {
                                router.push(`/checkout?classId=${classItem.id}`);
                              } else {
                                router.push(`/register/${classItem.id}`);
                              }
                            } else {
                              router.push(`/register/${classItem.id}`);
                            }
                          }}
                          className="flex-1"
                          disabled={
                            classItem._count.registrations >= classItem.capacity
                          }
                        >
                          {classItem._count.registrations >= classItem.capacity
                            ? 'Class Full'
                            : 'Register Now'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {data.pagination.totalPages > 1 && (
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center text-sm text-gray-600">
                  Page {page} of {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

