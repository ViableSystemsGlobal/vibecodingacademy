'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface Payment {
  id: string;
  amountCents: number;
  currency: string;
  provider: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  registration: {
    class: {
      title: string;
    };
    student: {
      id: string;
      name: string;
    };
  };
}

interface Student {
  id: string;
  name: string;
}

export default function ParentPaymentsPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  const { data: children } = useQuery<Student[]>({
    queryKey: ['parent-children'],
    queryFn: () => apiClient.get<Student[]>('/parent/children'),
  });

  const { data, isLoading, error } = useQuery<Payment[]>({
    queryKey: ['parent-payments', selectedStudentId],
    queryFn: () => {
      const params = selectedStudentId !== 'all' ? `?studentId=${selectedStudentId}` : '';
      return apiClient.get<Payment[]>(`/parent/payments${params}`);
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-red-600">Error loading payments</div>
      </div>
    );
  }

  const totalPaid = data?.reduce(
    (sum, payment) =>
      sum + (payment.status === 'PAID' ? payment.amountCents : 0),
    0
  ) || 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">View payment history and receipts</p>
        </div>
        {children && children.length > 1 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="student-filter" className="text-sm font-medium">
              Filter by child:
            </Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger id="student-filter" className="w-[180px]">
                <SelectValue placeholder="All children" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All children</SelectItem>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {totalPaid > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">GHS {(totalPaid / 100).toFixed(2)}</div>
          </CardContent>
        </Card>
      )}

      {!data || data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No payments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>All payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid At</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.registration.student.name}
                    </TableCell>
                    <TableCell>{payment.registration.class.title}</TableCell>
                    <TableCell>
                      {payment.currency} {(payment.amountCents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>{payment.provider}</TableCell>
                    <TableCell>
                      <span
                        className={
                          payment.status === 'PAID'
                            ? 'text-green-600 font-semibold'
                            : payment.status === 'FAILED'
                            ? 'text-red-600 font-semibold'
                            : 'text-orange-600 font-semibold'
                        }
                      >
                        {payment.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {payment.paidAt
                        ? format(new Date(payment.paidAt), 'MMM dd, yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

