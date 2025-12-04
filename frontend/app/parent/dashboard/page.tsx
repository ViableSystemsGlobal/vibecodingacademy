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

interface ParentDashboard {
  parent: {
    id: string;
    phone: string | null;
    whatsappNumber: string | null;
    city: string | null;
    country: string | null;
  };
  children: Array<{
    id: string;
    name: string;
    age: number | null;
    school: string | null;
    registrations: Array<{
      id: string;
      class: {
        id: string;
        title: string;
        type: string;
        startDatetime: string;
        meetingLink: string | null;
      };
      paymentStatus: string;
      attendanceStatus: string;
      payments: Array<{
        id: string;
        amountCents: number;
        status: string;
      }>;
    }>;
  }>;
}

export default function ParentDashboardPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  const { data, isLoading, error } = useQuery<ParentDashboard>({
    queryKey: ['parent-dashboard'],
    queryFn: () => apiClient.get<ParentDashboard>('/parent/dashboard'),
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
        <div className="text-red-600">Error loading dashboard</div>
      </div>
    );
  }

  if (!data) return null;

  // Filter children if a specific child is selected
  const filteredChildren = selectedStudentId === 'all'
    ? data.children
    : data.children.filter((child) => child.id === selectedStudentId);

  const upcomingClasses = filteredChildren.flatMap((child) =>
    child.registrations
      .filter((reg) => new Date(reg.class.startDatetime) > new Date())
      .map((reg) => ({ ...reg, childName: child.name }))
  );

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm lg:text-base">Welcome back! Here's an overview of your children's classes.</p>
        </div>
        {data.children.length > 1 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Label htmlFor="student-filter" className="text-sm font-medium">
              Filter by child:
            </Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger id="student-filter" className="w-full sm:w-[180px]">
                <SelectValue placeholder="All children" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All children</SelectItem>
                {data.children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Children Summary */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>My Children</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredChildren.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {filteredChildren.reduce((sum, child) => sum + child.registrations.length, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{upcomingClasses.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Children List */}
      <Card>
        <CardHeader>
          <CardTitle>My Children</CardTitle>
          <CardDescription>Overview of your registered children</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredChildren.length === 0 ? (
            <p className="text-muted-foreground">No children registered yet.</p>
          ) : (
            <div className="space-y-4">
              {filteredChildren.map((child) => (
                <div key={child.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{child.name}</h3>
                      {child.age && <p className="text-sm text-muted-foreground">Age: {child.age}</p>}
                      {child.school && (
                        <p className="text-sm text-muted-foreground">School: {child.school}</p>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {child.registrations.length} registration(s)
                    </div>
                  </div>
                  {child.registrations.length > 0 && (
                    <div className="space-y-2">
                      {child.registrations.map((reg) => (
                        <div
                          key={reg.id}
                          className="flex justify-between items-center p-2 bg-gray-50 rounded"
                        >
                          <div>
                            <p className="font-medium">{reg.class.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(reg.class.startDatetime), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={
                                reg.paymentStatus === 'PAID'
                                  ? 'text-green-600 font-semibold'
                                  : reg.paymentStatus === 'PENDING'
                                  ? 'text-orange-600 font-semibold'
                                  : 'text-gray-600'
                              }
                            >
                              {reg.paymentStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Classes */}
      {upcomingClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
            <CardDescription>Classes starting soon</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Meeting Link</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingClasses.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{reg.childName}</TableCell>
                    <TableCell>{reg.class.title}</TableCell>
                    <TableCell>
                      {format(new Date(reg.class.startDatetime), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      {reg.class.meetingLink ? (
                        <a
                          href={reg.class.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Join Class
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not available</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          reg.paymentStatus === 'PAID'
                            ? 'text-green-600 font-semibold'
                            : reg.paymentStatus === 'PENDING'
                            ? 'text-orange-600 font-semibold'
                            : 'text-gray-600'
                        }
                      >
                        {reg.paymentStatus}
                      </span>
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

