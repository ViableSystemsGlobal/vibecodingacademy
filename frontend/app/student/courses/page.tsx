'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

interface Course {
  id: string;
  title: string;
  description: string | null;
  level: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
}

export default function StudentCoursesPage() {
  const { data, isLoading, error } = useQuery<Course[]>({
    queryKey: ['student-courses'],
    queryFn: () => apiClient.get<Course[]>('/student/courses'),
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
        <div className="text-red-600">Error loading courses</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Courses</h1>
        <p className="text-muted-foreground">All your enrolled courses</p>
      </div>

      {!data || data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No courses available yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Courses will appear here once you're enrolled.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{course.title}</CardTitle>
                <CardDescription>{course.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
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
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{course.level}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {course.completedLessons} of {course.totalLessons} lessons completed
                  </div>
                </div>
                <Button asChild className="w-full mt-4">
                  <Link href={`/student/courses/${course.id}`}>
                    {course.progress > 0 ? 'Continue Learning' : 'Start Course'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

