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

interface Registration {
  id: string;
  class: {
    id: string;
    title: string;
    type: string;
    startDatetime: string;
    meetingLink: string | null;
  };
  student: {
    id: string;
    name: string;
  };
  paymentStatus: string;
  attendanceStatus: string;
  payments: Array<{
    id: string;
    amountCents: number;
    status: string;
  }>;
}

interface Student {
  id: string;
  name: string;
}

export default function ParentRegistrationsPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  const { data: children } = useQuery<Student[]>({
    queryKey: ['parent-children'],
    queryFn: () => apiClient.get<Student[]>('/parent/children'),
  });

  const { data, isLoading, error } = useQuery<Registration[]>({
    queryKey: ['parent-registrations', selectedStudentId],
    queryFn: () => {
      const params = selectedStudentId !== 'all' ? `?studentId=${selectedStudentId}` : '';
      return apiClient.get<Registration[]>(`/parent/registrations${params}`);
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
        <div className="text-red-600">Error loading registrations</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Class Registrations</h1>
          <p className="text-muted-foreground">All your children's class registrations</p>
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

      {!data || data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No registrations yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Registrations</CardTitle>
            <CardDescription>View details of all class registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Meeting Link</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((registration) => (
                  <TableRow key={registration.id}>
                    <TableCell className="font-medium">
                      {registration.student.name}
                    </TableCell>
                    <TableCell>{registration.class.title}</TableCell>
                    <TableCell>{registration.class.type}</TableCell>
                    <TableCell>
                      {format(new Date(registration.class.startDatetime), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      {registration.class.meetingLink ? (
                        <a
                          href={registration.class.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Join
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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

