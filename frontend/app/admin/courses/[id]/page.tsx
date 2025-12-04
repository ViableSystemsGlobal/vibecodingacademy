'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Edit, Trash2, ArrowLeft, BookOpen, FileText, Link as LinkIcon } from 'lucide-react';

interface LessonResource {
  id: string;
  type: 'LINK' | 'FILE';
  label: string;
  urlOrPath: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  orderIndex: number;
  resources: LessonResource[];
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
  slug: string;
  description: string | null;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  status: 'DRAFT' | 'PUBLISHED';
  recommendedAgeMin: number | null;
  recommendedAgeMax: number | null;
  modules: Module[];
  accessRules: Array<{
    id: string;
    requiredType: string;
    requiredClassId: string | null;
  }>;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const courseId = params.id as string;

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [isLessonDialogOpen, setIsLessonDialogOpen] = useState(false);
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ lesson: Lesson | null; moduleId: string } | null>(null);
  const [selectedLessonForResource, setSelectedLessonForResource] = useState<string | null>(null);

  const { data: course, isLoading } = useQuery<Course>({
    queryKey: ['admin-course', courseId],
    queryFn: () => apiClient.get<Course>(`/admin/courses/${courseId}`),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Course>) =>
      apiClient.put(`/admin/courses/${courseId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      setIsEditDialogOpen(false);
      toast.success('Course updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update course');
    },
  });

  const deleteModuleMutation = useMutation({
    mutationFn: (moduleId: string) =>
      apiClient.delete(`/admin/courses/${courseId}/modules/${moduleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast.success('Module deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete module');
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: (lessonId: string) =>
      apiClient.delete(`/admin/courses/lessons/${lessonId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
      toast.success('Lesson deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete lesson');
    },
  });

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

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/admin/courses')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground">
              {course.level} • {course.status}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsEditDialogOpen(true)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Course
        </Button>
      </div>

      {/* Course Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Course Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>Description:</strong>{' '}
            {course.description || <span className="text-muted-foreground">No description</span>}
          </div>
          <div>
            <strong>Slug:</strong> {course.slug}
          </div>
          {course.recommendedAgeMin || course.recommendedAgeMax ? (
            <div>
              <strong>Age Range:</strong>{' '}
              {course.recommendedAgeMin || '?'} - {course.recommendedAgeMax || '?'} years
            </div>
          ) : null}
          <div>
            <strong>Modules:</strong> {course.modules.length}
          </div>
          <div>
            <strong>Total Lessons:</strong>{' '}
            {course.modules.reduce((sum, m) => sum + m.lessons.length, 0)}
          </div>
        </CardContent>
      </Card>

      {/* Modules and Lessons */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Modules & Lessons</CardTitle>
            <Button onClick={() => setIsModuleDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Module
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {course.modules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No modules yet. Create your first module to get started.
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {course.modules
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((module) => (
                  <AccordionItem key={module.id} value={module.id}>
                    <AccordionTrigger>
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          <span className="font-semibold">{module.title}</span>
                          <span className="text-sm text-muted-foreground">
                            ({module.lessons.length} lessons)
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingModule(module);
                              setIsModuleDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit Module
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingLesson({ lesson: null, moduleId: module.id });
                              setIsLessonDialogOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Lesson
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm('Delete this module and all its lessons?')) {
                                deleteModuleMutation.mutate(module.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete Module
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {module.lessons
                            .sort((a, b) => a.orderIndex - b.orderIndex)
                            .map((lesson) => (
                              <div
                                key={lesson.id}
                                className="border rounded-lg p-4 flex items-start justify-between"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                    <h4 className="font-medium">{lesson.title}</h4>
                                  </div>
                                  {lesson.description && (
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {lesson.description}
                                    </p>
                                  )}
                                  {lesson.videoUrl && (
                                    <div className="text-sm text-blue-600 mb-2">
                                      <LinkIcon className="w-3 h-3 inline mr-1" />
                                      Video: {lesson.videoUrl.substring(0, 50)}...
                                    </div>
                                  )}
                                  {lesson.resources.length > 0 && (
                                    <div className="text-sm text-muted-foreground">
                                      {lesson.resources.length} resource(s)
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingLesson({ lesson: lesson, moduleId: module.id });
                                      setIsLessonDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedLessonForResource(lesson.id);
                                      setIsResourceDialogOpen(true);
                                    }}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm('Delete this lesson?')) {
                                        deleteLessonMutation.mutate(lesson.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Edit Course Dialog */}
      <EditCourseDialog
        course={course}
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={(data) => updateMutation.mutate(data)}
        isLoading={updateMutation.isPending}
        error={updateMutation.error}
      />

      {/* Module Dialog */}
      <ModuleDialog
        courseId={courseId}
        module={editingModule}
        open={isModuleDialogOpen}
        onClose={() => {
          setIsModuleDialogOpen(false);
          setEditingModule(null);
        }}
      />

      {/* Lesson Dialog */}
      {course.modules.length > 0 && editingLesson && (
        <LessonDialog
          courseId={courseId}
          moduleId={editingLesson.moduleId}
          lesson={editingLesson.lesson}
          open={isLessonDialogOpen}
          onClose={() => {
            setIsLessonDialogOpen(false);
            setEditingLesson(null);
          }}
        />
      )}

      {/* Resource Dialog */}
      <ResourceDialog
        lessonId={selectedLessonForResource || ''}
        open={isResourceDialogOpen}
        onClose={() => {
          setIsResourceDialogOpen(false);
          setSelectedLessonForResource(null);
        }}
      />
    </div>
  );
}

// Edit Course Dialog Component
function EditCourseDialog({
  course,
  open,
  onClose,
  onSave,
  isLoading,
  error,
}: {
  course: Course;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Course>) => void;
  isLoading: boolean;
  error: any;
}) {
  const [formData, setFormData] = useState({
    title: course.title,
    slug: course.slug,
    description: course.description || '',
    level: course.level,
    status: course.status,
    recommendedAgeMin: course.recommendedAgeMin?.toString() || '',
    recommendedAgeMax: course.recommendedAgeMax?.toString() || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      recommendedAgeMin: formData.recommendedAgeMin
        ? parseInt(formData.recommendedAgeMin)
        : null,
      recommendedAgeMax: formData.recommendedAgeMax
        ? parseInt(formData.recommendedAgeMax)
        : null,
      description: formData.description || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
          <DialogDescription>Update course information</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Course Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="level">Level *</Label>
              <Select
                value={formData.level}
                onValueChange={(value: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED') =>
                  setFormData({ ...formData, level: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEGINNER">Beginner</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'DRAFT' | 'PUBLISHED') =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recommendedAgeMin">Min Age (years)</Label>
              <Input
                id="recommendedAgeMin"
                type="number"
                value={formData.recommendedAgeMin}
                onChange={(e) => setFormData({ ...formData, recommendedAgeMin: e.target.value })}
                min={5}
                max={18}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendedAgeMax">Max Age (years)</Label>
              <Input
                id="recommendedAgeMax"
                type="number"
                value={formData.recommendedAgeMax}
                onChange={(e) => setFormData({ ...formData, recommendedAgeMax: e.target.value })}
                min={5}
                max={18}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error instanceof Error ? error.message : 'Failed to update course'}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Module Dialog Component
function ModuleDialog({
  courseId,
  module,
  open,
  onClose,
}: {
  courseId: string;
  module: Module | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: module?.title || '',
    orderIndex: module?.orderIndex.toString() || '0',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.post(`/admin/courses/${courseId}/modules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
      toast.success('Module created successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create module');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.put(`/admin/courses/modules/${module?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
      toast.success('Module updated successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update module');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (module) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{module ? 'Edit Module' : 'Create Module'}</DialogTitle>
          <DialogDescription>
            {module ? 'Update module information' : 'Add a new module to this course'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="moduleTitle">Module Title *</Label>
            <Input
              id="moduleTitle"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Module 1: Introduction"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="orderIndex">Order Index</Label>
            <Input
              id="orderIndex"
              type="number"
              value={formData.orderIndex}
              onChange={(e) => setFormData({ ...formData, orderIndex: e.target.value })}
              min={0}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : module
                ? 'Update Module'
                : 'Create Module'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Lesson Dialog Component
function LessonDialog({
  courseId,
  moduleId,
  lesson,
  open,
  onClose,
}: {
  courseId: string;
  moduleId: string;
  lesson: Lesson | null | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: lesson?.title || '',
    description: lesson?.description || '',
    videoUrl: lesson?.videoUrl || '',
    orderIndex: lesson?.orderIndex.toString() || '0',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.post(`/admin/courses/modules/${moduleId}/lessons`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
      toast.success('Lesson created successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create lesson');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.put(`/admin/courses/lessons/${lesson?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
      toast.success('Lesson updated successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update lesson');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lesson) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lesson ? 'Edit Lesson' : 'Create Lesson'}</DialogTitle>
          <DialogDescription>
            {lesson ? 'Update lesson information' : 'Add a new lesson to this module'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lessonTitle">Lesson Title *</Label>
            <Input
              id="lessonTitle"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Lesson 1: Getting Started"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lessonDescription">Description</Label>
            <Textarea
              id="lessonDescription"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What students will learn in this lesson..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoUrl">Video URL</Label>
            <Input
              id="videoUrl"
              value={formData.videoUrl}
              onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
            />
            <p className="text-xs text-muted-foreground">
              YouTube embed URL or direct video link
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lessonOrderIndex">Order Index</Label>
            <Input
              id="lessonOrderIndex"
              type="number"
              value={formData.orderIndex}
              onChange={(e) => setFormData({ ...formData, orderIndex: e.target.value })}
              min={0}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : lesson
                ? 'Update Lesson'
                : 'Create Lesson'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Resource Dialog Component
function ResourceDialog({
  lessonId,
  open,
  onClose,
}: {
  lessonId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    type: 'LINK' as 'LINK' | 'FILE',
    label: '',
    urlOrPath: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.post(`/admin/courses/lessons/${lessonId}/resources`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course'] });
      toast.success('Resource added successfully');
      onClose();
      setFormData({ type: 'LINK', label: '', urlOrPath: '' });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add resource');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Resource</DialogTitle>
          <DialogDescription>Add a resource link or file to this lesson</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resourceType">Resource Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'LINK' | 'FILE') =>
                setFormData({ ...formData, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LINK">Link</SelectItem>
                <SelectItem value="FILE">File</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resourceLabel">Label *</Label>
            <Input
              id="resourceLabel"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Download PDF"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resourceUrl">URL or Path *</Label>
            <Input
              id="resourceUrl"
              value={formData.urlOrPath}
              onChange={(e) => setFormData({ ...formData, urlOrPath: e.target.value })}
              placeholder="https://example.com/file.pdf"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add Resource'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

