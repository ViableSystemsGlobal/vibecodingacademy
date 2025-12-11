'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
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

const classSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['FREE', 'BOOTCAMP']),
  ageGroup: z.string().optional(),
  startDatetime: z.string().min(1, 'Start date is required'),
  endDatetime: z.string().optional(),
  durationMinutes: z.number().optional(),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  priceCents: z.number().min(0),
  currency: z.string().default('GHS'),
  meetingLink: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});

type ClassFormData = z.infer<typeof classSchema>;

interface ClassData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  ageGroup: string | null;
  startDatetime: string;
  endDatetime: string | null;
  durationMinutes: number | null;
  capacity: number;
  priceCents: number;
  currency: string;
  meetingLink: string | null;
  status: string;
}

export default function EditClassPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const { data: classData, isLoading } = useQuery<ClassData>({
    queryKey: ['class', classId],
    queryFn: () => apiClient.get<ClassData>(`/admin/classes/${classId}`),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
  });

  // Populate form when data loads
  useEffect(() => {
    if (classData) {
      const startDate = classData.startDatetime
        ? new Date(classData.startDatetime).toISOString().slice(0, 16)
        : '';
      const endDate = classData.endDatetime
        ? new Date(classData.endDatetime).toISOString().slice(0, 16)
        : '';

      reset({
        title: classData.title,
        description: classData.description || '',
        type: classData.type as 'FREE' | 'BOOTCAMP',
        ageGroup: classData.ageGroup || '',
        startDatetime: startDate,
        endDatetime: endDate || '',
        durationMinutes: classData.durationMinutes || undefined,
        capacity: classData.capacity,
        priceCents: classData.priceCents,
        currency: classData.currency,
        meetingLink: classData.meetingLink || '',
        status: classData.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
      });
    }
  }, [classData, reset]);

  const type = watch('type');

  const updateMutation = useMutation({
    mutationFn: (data: ClassFormData) => apiClient.put(`/admin/classes/${classId}`, data),
    onSuccess: () => {
      toast.success('Class updated successfully!');
      router.push(`/admin/classes/${classId}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update class');
    },
  });

  const onSubmit = (data: ClassFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div>Loading class data...</div>
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
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit Class</CardTitle>
          <CardDescription>Update class information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Class Type *</Label>
                <Select
                  value={watch('type')}
                  onValueChange={(value) => setValue('type', value as 'FREE' | 'BOOTCAMP')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free Class</SelectItem>
                    <SelectItem value="BOOTCAMP">Bootcamp</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-red-600">{errors.type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value) =>
                    setValue('status', value as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Class Title *</Label>
              <Input id="title" {...register('title')} placeholder="Introduction to Python" />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Class description..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ageGroup">Age Group</Label>
                <Input
                  id="ageGroup"
                  {...register('ageGroup')}
                  placeholder="9-12, 13-16, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  {...register('capacity', { valueAsNumber: true })}
                  min={1}
                />
                {errors.capacity && (
                  <p className="text-sm text-red-600">{errors.capacity.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDatetime">Start Date & Time *</Label>
                <Input
                  id="startDatetime"
                  type="datetime-local"
                  {...register('startDatetime')}
                />
                {errors.startDatetime && (
                  <p className="text-sm text-red-600">{errors.startDatetime.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDatetime">End Date & Time</Label>
                <Input
                  id="endDatetime"
                  type="datetime-local"
                  {...register('endDatetime')}
                />
              </div>
            </div>

            {type === 'BOOTCAMP' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priceCents">Price (in cents) *</Label>
                  <Input
                    id="priceCents"
                    type="number"
                    {...register('priceCents', { valueAsNumber: true })}
                    min={0}
                    placeholder="50000 for GHS 500.00"
                  />
                  {errors.priceCents && (
                    <p className="text-sm text-red-600">{errors.priceCents.message}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Enter amount in cents (e.g., 50000 = GHS 500.00)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" {...register('currency')} defaultValue="GHS" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="meetingLink">Meeting Link</Label>
              <Input
                id="meetingLink"
                {...register('meetingLink')}
                placeholder="https://meet.google.com/..."
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Class'}
              </Button>
            </div>

            {updateMutation.isError && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'Failed to update class'}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
