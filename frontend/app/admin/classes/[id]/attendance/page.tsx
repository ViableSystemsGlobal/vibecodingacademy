'use client';

import { useParams, useRouter } from 'next/navigation';
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
import { CheckCircle2, XCircle, HelpCircle, Save } from 'lucide-react';
import { format } from 'date-fns';

interface ClassInfo {
  id: string;
  title: string;
  startDatetime: string;
  endDatetime: string | null;
}

interface Registration {
  id: string;
  attendanceStatus: string;
  paymentStatus: string;
  student: {
    id: string;
    name: string;
    age: number | null;
    parent: {
      user: {
        name: string;
        email: string;
      };
    };
  };
}

export default function AttendancePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const classId = params.id as string;

  const [attendanceUpdates, setAttendanceUpdates] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch class info
  const { data: classData } = useQuery<ClassInfo>({
    queryKey: ['class', classId],
    queryFn: () => apiClient.get<ClassInfo>(`/admin/classes/${classId}`),
  });

  // Fetch registrations for this class
  const { data: registrations, isLoading } = useQuery<Registration[]>({
    queryKey: ['class-registrations', classId],
    queryFn: () => apiClient.get<Registration[]>(`/admin/registrations/class/${classId}`),
  });

  // Bulk update attendance
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; attendanceStatus: string }>) => {
      return apiClient.put('/admin/registrations/attendance/bulk', { updates });
    },
    onSuccess: () => {
      toast.success('Attendance updated successfully');
      setAttendanceUpdates({});
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['class-registrations', classId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update attendance');
    },
  });

  const handleAttendanceChange = (registrationId: string, status: string) => {
    setAttendanceUpdates((prev) => ({
      ...prev,
      [registrationId]: status,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates = Object.entries(attendanceUpdates).map(([id, attendanceStatus]) => ({
      id,
      attendanceStatus,
    }));

    if (updates.length === 0) {
      toast.info('No changes to save');
      return;
    }

    bulkUpdateMutation.mutate(updates);
  };

  const handleBulkMark = (status: string) => {
    if (!registrations) return;

    const newUpdates: Record<string, string> = {};
    registrations.forEach((reg) => {
      newUpdates[reg.id] = status;
    });
    setAttendanceUpdates(newUpdates);
    setHasChanges(true);
  };

  const getAttendanceStatus = (registration: Registration) => {
    return attendanceUpdates[registration.id] || registration.attendanceStatus;
  };

  const getAttendanceStats = () => {
    if (!registrations) return { total: 0, attended: 0, absent: 0, unknown: 0 };

    const stats = registrations.reduce(
      (acc, reg) => {
        const status = getAttendanceStatus(reg);
        acc.total++;
        if (status === 'ATTENDED') acc.attended++;
        else if (status === 'ABSENT') acc.absent++;
        else acc.unknown++;
        return acc;
      },
      { total: 0, attended: 0, absent: 0, unknown: 0 }
    );

    return stats;
  };

  const stats = getAttendanceStats();

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div>Loading attendance data...</div>
      </div>
    );
  }

  if (!registrations || !classData) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-red-600">Class or registrations not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Mark Attendance</h1>
          <p className="text-muted-foreground text-sm lg:text-base">
            {classData.title} • {format(new Date(classData.startDatetime), 'MMMM dd, yyyy HH:mm')}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
          Back
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Attended</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.attended}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Absent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Not Marked</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.unknown}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.unknown / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
          <CardDescription>Mark all students at once</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => handleBulkMark('ATTENDED')}
              className="text-green-600"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark All Attended
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBulkMark('ABSENT')}
              className="text-red-600"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Mark All Absent
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBulkMark('UNKNOWN')}
              className="text-gray-600"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Reset All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Student Attendance</CardTitle>
              <CardDescription>
                {registrations.length} student{registrations.length !== 1 ? 's' : ''} registered
              </CardDescription>
            </div>
            {hasChanges && (
              <Button onClick={handleSave} disabled={bulkUpdateMutation.isPending} className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2" />
                {bulkUpdateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No registrations for this class</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Attendance Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((registration) => {
                  const currentStatus = getAttendanceStatus(registration);
                  return (
                    <TableRow key={registration.id}>
                      <TableCell className="font-medium">
                        {registration.student.name}
                      </TableCell>
                      <TableCell>{registration.student.age || '-'}</TableCell>
                      <TableCell>
                        <div>
                          <div>{registration.student.parent.user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {registration.student.parent.user.email}
                          </div>
                        </div>
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
                      <TableCell>
                        <Select
                          value={currentStatus}
                          onValueChange={(value) => handleAttendanceChange(registration.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UNKNOWN">
                              <div className="flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-gray-500" />
                                <span>Unknown</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="ATTENDED">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <span>Attended</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="ABSENT">
                              <div className="flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-600" />
                                <span>Absent</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

