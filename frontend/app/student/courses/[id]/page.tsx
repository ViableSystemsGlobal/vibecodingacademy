'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2, Circle, PlayCircle } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  orderIndex: number;
  resources: Array<{
    id: string;
    type: string;
    label: string;
    urlOrPath: string;
  }>;
  progress?: {
    status: string;
  };
}

interface Module {
  id: string;
  title: string;
  orderIndex: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  level: string;
  modules: Module[];
}

export default function CourseViewPage() {
  const params = useParams();
  const courseId = params.id as string;
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const { data: course, isLoading } = useQuery<Course>({
    queryKey: ['student-course', courseId],
    queryFn: () => apiClient.get<Course>(`/student/courses/${courseId}`),
  });

  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: ['student-lesson', selectedLessonId],
    queryFn: () => apiClient.get(`/student/lessons/${selectedLessonId}`),
    enabled: !!selectedLessonId,
  });

  const updateProgressMutation = useMutation({
    mutationFn: ({ lessonId, status }: { lessonId: string; status: string }) =>
      apiClient.post(`/student/lessons/${lessonId}/progress`, { status }),
  });

  // Auto-select first lesson if none selected
  useEffect(() => {
    if (course && !selectedLessonId && course.modules.length > 0) {
      const firstLesson = course.modules[0]?.lessons[0];
      if (firstLesson) {
        setSelectedLessonId(firstLesson.id);
      }
    }
  }, [course, selectedLessonId]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div>Loading course...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-red-600">Course not found</div>
      </div>
    );
  }

  const handleMarkComplete = async (lessonId: string) => {
    await updateProgressMutation.mutateAsync({ lessonId, status: 'completed' });
    // Refresh course data
    window.location.reload();
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/student/courses" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Courses
        </Link>
        <h1 className="text-3xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground">{course.description}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Course Modules & Lessons Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Course Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {course.modules.map((module) => (
                  <div key={module.id}>
                    <h3 className="font-semibold mb-2">{module.title}</h3>
                    <div className="space-y-1 ml-4">
                      {module.lessons.map((lesson) => {
                        const isCompleted = lesson.progress?.status === 'completed';
                        const isSelected = selectedLessonId === lesson.id;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => setSelectedLessonId(lesson.id)}
                            className={`w-full text-left p-2 rounded flex items-center gap-2 ${
                              isSelected
                                ? 'bg-blue-100 text-blue-900'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-sm">{lesson.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lesson Content */}
        <div className="lg:col-span-2">
          {lessonLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div>Loading lesson...</div>
              </CardContent>
            </Card>
          ) : lesson ? (
            <Card>
              <CardHeader>
                <CardTitle>{lesson.title}</CardTitle>
                <CardDescription>{lesson.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {lesson.videoUrl && (
                  <div>
                    <h3 className="font-semibold mb-2">Video Lesson</h3>
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <iframe
                        src={lesson.videoUrl}
                        className="w-full h-full rounded-lg"
                        allowFullScreen
                        title={lesson.title}
                      />
                    </div>
                  </div>
                )}

                {lesson.resources && lesson.resources.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Resources</h3>
                    <div className="space-y-2">
                      {lesson.resources.map((resource: { id: string; type: string; label: string; urlOrPath: string }) => (
                        <a
                          key={resource.id}
                          href={resource.urlOrPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="font-medium">{resource.label}</div>
                          <div className="text-sm text-muted-foreground">{resource.type}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {lesson.progress?.status !== 'completed' && (
                  <Button
                    onClick={() => handleMarkComplete(lesson.id)}
                    disabled={updateProgressMutation.isPending}
                    className="w-full"
                  >
                    {updateProgressMutation.isPending
                      ? 'Marking...'
                      : 'Mark as Complete'}
                  </Button>
                )}

                {lesson.progress?.status === 'completed' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-green-800 font-semibold">Lesson Completed!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Select a lesson to view content</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

