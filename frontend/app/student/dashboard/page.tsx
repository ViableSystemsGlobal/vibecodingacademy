'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { format } from 'date-fns';

interface StudentDashboard {
  upcomingClasses: Array<{
    id: string;
    title: string;
    startDatetime: string;
    meetingLink: string | null;
    studentName: string;
  }>;
  courses: Array<{
    id: string;
    title: string;
    description: string | null;
    level: string;
    progress: number;
    totalLessons: number;
    completedLessons: number;
  }>;
  students: Array<{
    id: string;
    name: string;
  }>;
}

export default function StudentDashboardPage() {
  const { data, isLoading, error } = useQuery<StudentDashboard>({
    queryKey: ['student-dashboard'],
    queryFn: () => apiClient.get<StudentDashboard>('/student/dashboard'),
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

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground">Welcome! Here's your learning overview.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>My Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.courses.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.upcomingClasses.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.courses.length > 0
                ? Math.round(
                    data.courses.reduce((sum, c) => sum + c.progress, 0) / data.courses.length
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Classes */}
      {data.upcomingClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Live Classes</CardTitle>
            <CardDescription>Your scheduled live coding sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.upcomingClasses.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-semibold">{classItem.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(classItem.startDatetime), 'MMMM dd, yyyy HH:mm')}
                    </p>
                    <p className="text-sm text-muted-foreground">Student: {classItem.studentName}</p>
                  </div>
                  {classItem.meetingLink && (
                    <Button asChild>
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

      {/* My Courses */}
      <Card>
        <CardHeader>
          <CardTitle>My Courses</CardTitle>
          <CardDescription>Continue your learning journey</CardDescription>
        </CardHeader>
        <CardContent>
          {data.courses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No courses available yet. Courses will appear here once you're enrolled.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {data.courses.map((course) => (
                <Card key={course.id}>
                  <CardHeader>
                    <CardTitle>{course.title}</CardTitle>
                    <CardDescription>{course.description || 'No description'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Progress</span>
                          <span>{course.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {course.completedLessons} of {course.totalLessons} lessons completed
                      </div>
                      <Button asChild className="w-full">
                        <Link href={`/student/courses/${course.id}`}>Continue Learning</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

