'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mail, MessageSquare, CheckCircle, XCircle, RefreshCw, Filter, Search } from 'lucide-react';
import { format } from 'date-fns';

interface NotificationLog {
  id: string;
  type: 'EMAIL' | 'SMS';
  toAddress: string;
  templateKey: string | null;
  payloadJson: any;
  status: 'SUCCESS' | 'FAILED';
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface NotificationLogsResponse {
  logs: NotificationLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Stats {
  total: number;
  success: number;
  failed: number;
  successRate: string;
  byType: {
    EMAIL?: number;
    SMS?: number;
  };
  recentFailures: NotificationLog[];
}

export default function NotificationLogsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    toAddress: '',
    templateKey: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 50,
  });
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const { data: logsData, isLoading } = useQuery<NotificationLogsResponse>({
    queryKey: ['admin-notification-logs', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value.toString());
        }
      });
      return apiClient.get<NotificationLogsResponse>(`/admin/notification-logs?${params.toString()}`);
    },
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin-notification-logs-stats'],
    queryFn: () => apiClient.get<Stats>('/admin/notification-logs/stats/summary'),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/notification-logs/${id}/resend`),
    onSuccess: () => {
      toast.success('Notification resent successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-notification-logs'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resend notification');
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleViewDetails = (log: NotificationLog) => {
    setSelectedLog(log);
    setIsDetailDialogOpen(true);
  };

  const handleResend = (id: string) => {
    if (confirm('Are you sure you want to resend this notification?')) {
      resendMutation.mutate(id);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Logs</h1>
        <p className="text-muted-foreground">
          View and manage email and SMS notification history
        </p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.success}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select 
                value={filters.type || 'all'} 
                onValueChange={(value) => handleFilterChange('type', value === 'all' ? '' : value)}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={filters.status || 'all'} 
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="toAddress">Recipient</Label>
              <Input
                id="toAddress"
                placeholder="Email or phone"
                value={filters.toAddress}
                onChange={(e) => handleFilterChange('toAddress', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateKey">Template</Label>
              <Input
                id="templateKey"
                placeholder="Template key"
                value={filters.templateKey}
                onChange={(e) => handleFilterChange('templateKey', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  type: '',
                  status: '',
                  toAddress: '',
                  templateKey: '',
                  startDate: '',
                  endDate: '',
                  page: 1,
                  limit: 50,
                });
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
          <CardDescription>
            {logsData?.pagination.total || 0} total notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading logs...</div>
          ) : !logsData || logsData.logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notification logs found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsData.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {log.type === 'EMAIL' ? (
                              <Mail className="w-4 h-4 text-blue-500" />
                            ) : (
                              <MessageSquare className="w-4 h-4 text-green-500" />
                            )}
                            <span>{log.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.toAddress}</TableCell>
                        <TableCell>{log.templateKey || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={log.status === 'SUCCESS' ? 'default' : 'destructive'}
                            className={
                              log.status === 'SUCCESS'
                                ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                : ''
                            }
                          >
                            {log.status === 'SUCCESS' ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.sentAt ? format(new Date(log.sentAt), 'MMM dd, yyyy HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(log)}
                            >
                              View
                            </Button>
                            {log.status === 'FAILED' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResend(log.id)}
                                disabled={resendMutation.isPending}
                              >
                                <RefreshCw className="w-4 h-4" />
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
              {logsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {logsData.pagination.page} of {logsData.pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={filters.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={filters.page >= logsData.pagination.totalPages}
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

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>View full notification log information</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <p className="font-medium">{selectedLog.type}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p>
                    <Badge
                      variant={selectedLog.status === 'SUCCESS' ? 'default' : 'destructive'}
                    >
                      {selectedLog.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Recipient</Label>
                  <p className="font-mono text-sm">{selectedLog.toAddress}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Template Key</Label>
                  <p>{selectedLog.templateKey || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created At</Label>
                  <p>{format(new Date(selectedLog.createdAt), 'PPpp')}</p>
                </div>
                {selectedLog.sentAt && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Sent At</Label>
                    <p>{format(new Date(selectedLog.sentAt), 'PPpp')}</p>
                  </div>
                )}
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <Label className="text-xs text-muted-foreground">Error Message</Label>
                  <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{selectedLog.errorMessage}</p>
                  </div>
                </div>
              )}

              {selectedLog.payloadJson && (
                <div>
                  <Label className="text-xs text-muted-foreground">Payload Data</Label>
                  <pre className="mt-1 p-3 bg-gray-50 border rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.payloadJson, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedLog?.status === 'FAILED' && (
              <Button
                onClick={() => {
                  if (selectedLog) {
                    handleResend(selectedLog.id);
                    setIsDetailDialogOpen(false);
                  }
                }}
                disabled={resendMutation.isPending}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Resend
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

