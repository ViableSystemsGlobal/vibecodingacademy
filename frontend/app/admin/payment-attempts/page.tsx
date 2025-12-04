'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface PaymentAttempt {
  id: string;
  classId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string | null;
  parentCity: string | null;
  studentsData: Array<{ name: string; age?: number; school?: string }>;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string | null;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  paymentUrl: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  class: {
    id: string;
    title: string;
    type: string;
    startDatetime: string;
  };
}

interface PaymentAttemptsResponse {
  attempts: PaymentAttempt[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function PaymentAttemptsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedAttempt, setSelectedAttempt] = useState<PaymentAttempt | null>(null);
  const [notes, setNotes] = useState('');
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);

  const { data, isLoading, error } = useQuery<PaymentAttemptsResponse>({
    queryKey: ['payment-attempts', statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      return apiClient.get<PaymentAttemptsResponse>(`/admin/payment-attempts?${params.toString()}`);
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiClient.put(`/admin/payment-attempts/${id}/notes`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-attempts'] });
      toast.success('Notes updated successfully');
      setIsNotesDialogOpen(false);
      setSelectedAttempt(null);
      setNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update notes');
    },
  });

  const cancelAttemptMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/admin/payment-attempts/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-attempts'] });
      toast.success('Payment attempt cancelled');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to cancel attempt');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-attempts'] });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      PENDING: { variant: 'default', icon: Clock },
      COMPLETED: { variant: 'default', icon: CheckCircle },
      EXPIRED: { variant: 'secondary', icon: AlertCircle },
      CANCELLED: { variant: 'destructive', icon: XCircle },
    };

    const config = variants[status] || { variant: 'outline' as const, icon: null };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {status}
      </Badge>
    );
  };

  const handleViewNotes = (attempt: PaymentAttempt) => {
    setSelectedAttempt(attempt);
    setNotes(attempt.notes || '');
    setIsNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    if (selectedAttempt) {
      updateNotesMutation.mutate({ id: selectedAttempt.id, notes });
    }
  };

  const handleCancel = (id: string) => {
    if (confirm('Are you sure you want to cancel this payment attempt?')) {
      cancelAttemptMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div>Loading payment attempts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-red-600">Error loading payment attempts</div>
      </div>
    );
  }

  const attempts = data?.attempts || [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-8 h-8" />
          Payment Attempts (Abandoned Carts)
        </h1>
        <p className="text-muted-foreground">
          Track and manage incomplete checkout sessions and payment attempts
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Attempts</CardDescription>
            <CardTitle className="text-2xl">{pagination?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl">
              {attempts.filter((a) => a.status === 'PENDING').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl">
              {attempts.filter((a) => a.status === 'COMPLETED').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expired/Cancelled</CardDescription>
            <CardTitle className="text-2xl">
              {attempts.filter((a) => a.status === 'EXPIRED' || a.status === 'CANCELLED').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}>
                <SelectTrigger id="status-filter" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Attempts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Attempts</CardTitle>
          <CardDescription>
            {pagination?.total || 0} total attempts found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No payment attempts found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parent</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{attempt.parentName}</div>
                            <div className="text-sm text-muted-foreground">{attempt.parentEmail}</div>
                            {attempt.parentPhone && (
                              <div className="text-sm text-muted-foreground">{attempt.parentPhone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{attempt.class.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(attempt.class.startDatetime), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {(attempt.studentsData as Array<{ name: string; age?: number; school?: string }>).map(
                              (student, idx) => (
                                <div key={idx} className="text-sm">
                                  {student.name}
                                  {student.age && ` (Age: ${student.age})`}
                                </div>
                              )
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {attempt.currency} {(attempt.amountCents / 100).toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(attempt.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(attempt.createdAt), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {attempt.expiresAt ? (
                            <div className="text-sm">
                              {format(new Date(attempt.expiresAt), 'MMM dd, yyyy HH:mm')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewNotes(attempt)}
                            >
                              <MessageSquare className="w-4 h-4 mr-1" />
                              Notes
                            </Button>
                            {attempt.status === 'PENDING' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleCancel(attempt.id)}
                                disabled={cancelAttemptMutation.isPending}
                              >
                                Cancel
                              </Button>
                            )}
                            {attempt.paymentUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(attempt.paymentUrl!, '_blank')}
                              >
                                View Payment
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Attempt Notes</DialogTitle>
            <DialogDescription>
              Add notes for follow-up with {selectedAttempt?.parentName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this payment attempt..."
                rows={6}
              />
            </div>
            {selectedAttempt && (
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <strong>Parent:</strong> {selectedAttempt.parentName} ({selectedAttempt.parentEmail})
                </div>
                <div>
                  <strong>Class:</strong> {selectedAttempt.class.title}
                </div>
                <div>
                  <strong>Amount:</strong> {selectedAttempt.currency} {(selectedAttempt.amountCents / 100).toFixed(2)}
                </div>
                <div>
                  <strong>Status:</strong> {selectedAttempt.status}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsNotesDialogOpen(false);
                  setSelectedAttempt(null);
                  setNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveNotes}
                disabled={updateNotesMutation.isPending}
              >
                {updateNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

