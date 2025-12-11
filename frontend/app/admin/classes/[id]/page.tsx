'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { format } from 'date-fns';

interface ClassDetail {
  id: string;
  title: string;
  description: string | null;
  type: string;
  ageGroup: string | null;
  startDatetime: string;
  endDatetime: string | null;
  capacity: number;
  priceCents: number;
  currency: string;
  meetingLink: string | null;
  status: string;
  registrations: Array<{
    id: string;
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
  }>;
  _count: {
    registrations: number;
  };
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const { data: classData, isLoading } = useQuery<ClassDetail>({
    queryKey: ['class', classId],
    queryFn: () => apiClient.get<ClassDetail>(`/admin/classes/${classId}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/admin/classes/${classId}`),
    onSuccess: () => {
      toast.success('Class deleted successfully');
      router.push('/admin/classes');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete class');
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div>Loading class details...</div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-red-600">Class not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{classData.title}</h1>
          <p className="text-muted-foreground">
            {classData.type} • {classData.status}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/admin/classes/${classId}/attendance`)}>
            Mark Attendance
          </Button>
          <Button variant="outline" onClick={() => router.push(`/admin/classes/${classId}/edit`)}>
            Edit
          </Button>
          {classData.status === 'ARCHIVED' ? (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await apiClient.put(`/admin/classes/${classId}`, { status: 'PUBLISHED' });
                  toast.success('Class unarchived successfully');
                  router.refresh();
                } catch (error: any) {
                  toast.error(error.message || 'Failed to unarchive class');
                }
              }}
            >
              Unarchive
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={async () => {
                if (confirm('Archive this class? It will no longer appear in public registration.')) {
                  try {
                    await apiClient.put(`/admin/classes/${classId}`, { status: 'ARCHIVED' });
                    toast.success('Class archived successfully');
                    router.refresh();
                  } catch (error: any) {
                    toast.error(error.message || 'Failed to archive class');
                  }
                }
              }}
            >
              Archive
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm('Are you sure you want to delete this class?')) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Class Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p>{classData.description || 'No description'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Age Group</p>
              <p>{classData.ageGroup || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Start Date & Time</p>
              <p>{format(new Date(classData.startDatetime), 'MMMM dd, yyyy HH:mm')}</p>
            </div>
            {classData.endDatetime && (
              <div>
                <p className="text-sm text-muted-foreground">End Date & Time</p>
                <p>{format(new Date(classData.endDatetime), 'MMMM dd, yyyy HH:mm')}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Capacity</p>
              <p>
                {classData._count.registrations} / {classData.capacity} registered
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p>
                {classData.priceCents === 0
                  ? 'Free'
                  : `${classData.currency} ${(classData.priceCents / 100).toFixed(2)}`}
              </p>
            </div>
            {classData.meetingLink && (
              <div>
                <p className="text-sm text-muted-foreground">Meeting Link</p>
                <a
                  href={classData.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {classData.meetingLink}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrations ({classData.registrations.length})</CardTitle>
            <CardDescription>Students registered for this class</CardDescription>
          </CardHeader>
          <CardContent>
            {classData.registrations.length === 0 ? (
              <p className="text-muted-foreground">No registrations yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Attendance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classData.registrations.map((registration) => (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

