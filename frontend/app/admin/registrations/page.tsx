'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

interface Registration {
  id: string;
  class: {
    title: string;
    type: string;
    startDatetime: string;
  };
  student: {
    name: string;
    parent: {
      user: {
        name: string;
        email: string;
      };
    };
  };
  paymentStatus: string;
  attendanceStatus: string;
  createdAt: string;
}

interface RegistrationsResponse {
  registrations: Registration[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function RegistrationsPage() {
  const [page, setPage] = useState(1);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, error } = useQuery<RegistrationsResponse>({
    queryKey: ['registrations', page, paymentStatusFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (paymentStatusFilter !== 'all') {
        params.append('paymentStatus', paymentStatusFilter);
      }
      return apiClient.get<RegistrationsResponse>(`/admin/registrations?${params.toString()}`);
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (paymentStatusFilter !== 'all') {
        params.append('paymentStatus', paymentStatusFilter);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}/admin/registrations/export/csv?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registrations-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Export error:', error);
      alert('Failed to export registrations. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registrations</CardTitle>
              <CardDescription>View and manage all class registrations</CardDescription>
            </div>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Select value={paymentStatusFilter || 'all'} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by payment status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="NA">N/A (Free)</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading && <div>Loading...</div>}
          {error && <div className="text-red-600">Error loading registrations</div>}

          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Class Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.registrations.map((registration) => (
                    <TableRow key={registration.id}>
                      <TableCell className="font-medium">
                        {registration.student.name}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{registration.student.parent.user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {registration.student.parent.user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{registration.class.title}</TableCell>
                      <TableCell>{registration.class.type}</TableCell>
                      <TableCell>
                        {format(new Date(registration.class.startDatetime), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            registration.paymentStatus === 'PAID'
                              ? 'text-green-600 font-semibold'
                              : registration.paymentStatus === 'PENDING'
                              ? 'text-orange-600 font-semibold'
                              : 'text-gray-600'
                          }
                        >
                          {registration.paymentStatus}
                        </span>
                      </TableCell>
                      <TableCell>{registration.attendanceStatus}</TableCell>
                      <TableCell>
                        {format(new Date(registration.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Showing {data.registrations.length} of {data.pagination.total} registrations
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= data.pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

