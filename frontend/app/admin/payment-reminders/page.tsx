'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Mail, Send, DollarSign, Users, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface PendingPayment {
  id: string;
  createdAt: string;
  class: {
    id: string;
    title: string;
    priceCents: number;
    currency: string;
    startDatetime: string;
  };
  student: {
    name: string;
    parent: {
      user: {
        name: string;
        email: string;
      };
      phone: string | null;
    };
  };
}

interface Stats {
  totalPending: number;
  totalAmountCents: number;
  totalAmount: number;
  byClass: number;
}

export default function PaymentRemindersPage() {
  const queryClient = useQueryClient();
  const [selectedRegistrations, setSelectedRegistrations] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState<string>('all');
  const [daysFilter, setDaysFilter] = useState<string>('all');

  // Fetch stats
  const { data: stats } = useQuery<Stats>({
    queryKey: ['payment-reminder-stats'],
    queryFn: () => apiClient.get<Stats>('/admin/payment-reminders/stats'),
  });

  // Fetch pending payments
  const { data: pendingPayments, isLoading } = useQuery<PendingPayment[]>({
    queryKey: ['pending-payments', classFilter, daysFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (classFilter !== 'all') {
        params.append('classId', classFilter);
      }
      if (daysFilter !== 'all') {
        params.append('daysSinceRegistration', daysFilter);
      }
      const queryString = params.toString();
      return apiClient.get<PendingPayment[]>(
        `/admin/payment-reminders/pending${queryString ? `?${queryString}` : ''}`
      );
    },
  });

  // Send single reminder
  const sendReminderMutation = useMutation({
    mutationFn: (registrationId: string) =>
      apiClient.post(`/admin/payment-reminders/send/${registrationId}`),
    onSuccess: () => {
      toast.success('Payment reminder sent successfully');
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send reminder');
    },
  });

  // Send bulk reminders
  const sendBulkMutation = useMutation({
    mutationFn: (registrationIds: string[]) =>
      apiClient.post('/admin/payment-reminders/send-bulk', { registrationIds }),
    onSuccess: (data) => {
      const { success, failed } = data.data;
      if (failed > 0) {
        toast.warning(`Sent ${success} reminders, ${failed} failed`);
      } else {
        toast.success(`Successfully sent ${success} payment reminders`);
      }
      setSelectedRegistrations(new Set());
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send reminders');
    },
  });

  const handleSelectAll = () => {
    if (!pendingPayments) return;
    if (selectedRegistrations.size === pendingPayments.length) {
      setSelectedRegistrations(new Set());
    } else {
      setSelectedRegistrations(new Set(pendingPayments.map((p) => p.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedRegistrations);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRegistrations(newSelected);
  };

  const handleSendBulk = () => {
    if (selectedRegistrations.size === 0) {
      toast.info('Please select at least one registration');
      return;
    }
    sendBulkMutation.mutate(Array.from(selectedRegistrations));
  };

  // Get unique classes for filter
  const uniqueClasses = pendingPayments
    ? Array.from(new Set(pendingPayments.map((p) => p.class.id))).map((id) => {
        const payment = pendingPayments.find((p) => p.class.id === id);
        return { id, title: payment?.class.title || '' };
      })
    : [];

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Payment Reminders</h1>
        <p className="text-muted-foreground text-sm lg:text-base">
          Send reminders to parents with pending payments. Automated reminders are sent at 1, 3, 7, 14, and 30 days after registration.
        </p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Amount Due</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                GHS {stats.totalAmount.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Classes with Pending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byClass}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Selected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {selectedRegistrations.size}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Pending Payments</CardTitle>
              <CardDescription>
                {pendingPayments?.length || 0} registration(s) with pending payment
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {selectedRegistrations.size > 0 && (
                <Button
                  onClick={handleSendBulk}
                  disabled={sendBulkMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Reminders ({selectedRegistrations.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="class-filter">Filter by Class</Label>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger id="class-filter">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {uniqueClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="days-filter">Days Since Registration</Label>
              <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger id="days-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="1">1+ days</SelectItem>
                  <SelectItem value="3">3+ days</SelectItem>
                  <SelectItem value="7">7+ days</SelectItem>
                  <SelectItem value="14">14+ days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-8">Loading pending payments...</div>
          ) : !pendingPayments || pendingPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No pending payments found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        pendingPayments.length > 0 &&
                        selectedRegistrations.size === pendingPayments.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRegistrations.has(payment.id)}
                        onCheckedChange={() => handleSelectOne(payment.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.student.name}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{payment.student.parent.user.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.student.parent.user.email}
                        </div>
                        {payment.student.parent.phone && (
                          <div className="text-sm text-muted-foreground">
                            {payment.student.parent.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.class.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(payment.class.startDatetime), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {payment.class.currency} {(payment.class.priceCents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendReminderMutation.mutate(payment.id)}
                        disabled={sendReminderMutation.isPending}
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Send
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

