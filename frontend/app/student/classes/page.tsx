'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface UpcomingClass {
  id: string;
  title: string;
  description: string | null;
  startDatetime: string;
  endDatetime: string | null;
  meetingLink: string | null;
  studentName: string;
}

export default function StudentClassesPage() {
  const { data, isLoading, error } = useQuery<{ upcomingClasses: UpcomingClass[] }>({
    queryKey: ['student-dashboard'],
    queryFn: () => apiClient.get('/student/dashboard'),
    select: (data) => ({ upcomingClasses: data.upcomingClasses }),
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
        <div className="text-red-600">Error loading classes</div>
      </div>
    );
  }

  const upcomingClasses = data?.upcomingClasses || [];
  const pastClasses = upcomingClasses.filter(
    (classItem) => new Date(classItem.startDatetime) < new Date()
  );
  const futureClasses = upcomingClasses.filter(
    (classItem) => new Date(classItem.startDatetime) >= new Date()
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Live Classes</h1>
        <p className="text-muted-foreground">Your scheduled live coding sessions</p>
      </div>

      {/* Upcoming Classes */}
      {futureClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
            <CardDescription>Your scheduled live sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {futureClasses.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{classItem.title}</h3>
                    {classItem.description && (
                      <p className="text-sm text-muted-foreground mt-1">{classItem.description}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      <p className="text-sm">
                        <strong>Date & Time:</strong>{' '}
                        {format(new Date(classItem.startDatetime), 'MMMM dd, yyyy HH:mm')}
                      </p>
                      {classItem.endDatetime && (
                        <p className="text-sm">
                          <strong>Ends:</strong>{' '}
                          {format(new Date(classItem.endDatetime), 'MMMM dd, yyyy HH:mm')}
                        </p>
                      )}
                      <p className="text-sm">
                        <strong>Student:</strong> {classItem.studentName}
                      </p>
                    </div>
                  </div>
                  {classItem.meetingLink && (
                    <Button asChild className="ml-4">
                      <a
                        href={classItem.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Join Class
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Classes */}
      {pastClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Classes</CardTitle>
            <CardDescription>Your completed live sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pastClasses.map((classItem) => (
                <div
                  key={classItem.id}
                  className="p-4 border rounded-lg bg-gray-50"
                >
                  <h3 className="font-semibold">{classItem.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(classItem.startDatetime), 'MMMM dd, yyyy HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {upcomingClasses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No classes scheduled yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Classes will appear here once you're registered.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

