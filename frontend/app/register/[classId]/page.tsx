'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

const registrationSchema = z.object({
  parentName: z.string().min(1, 'Parent name is required'),
  parentEmail: z.string().email('Invalid email address'),
  parentPhone: z.string().optional(),
  parentWhatsapp: z.string().optional(),
  parentCity: z.string().optional(),
  parentCountry: z.string().optional(),
  howHeard: z.string().optional(),
  students: z
    .array(
      z.object({
        name: z.string().min(1, 'Student name is required'),
        age: z.number().min(5).max(18).optional(),
        school: z.string().optional(),
      })
    )
    .min(1, 'At least one student is required')
    .max(3, 'Maximum 3 students per registration'),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface Class {
  id: string;
  title: string;
  description: string | null;
  type: 'FREE' | 'BOOTCAMP';
  startDatetime: string;
  capacity: number;
  priceCents: number;
  meetingLink: string | null;
}

export default function RegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  const [currentStep, setCurrentStep] = useState(1);

  const { data: classData, isLoading: classLoading } = useQuery<Class>({
    queryKey: ['class', classId],
    queryFn: () => apiClient.get<Class>(`/public/classes/${classId}`),
    enabled: !!classId,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      students: [{ name: '', age: undefined, school: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'students',
  });

  const registrationMutation = useMutation({
    mutationFn: (data: RegistrationFormData) =>
      apiClient.post('/public/register', {
        classId,
        ...data,
      }),
    onSuccess: () => {
      router.push('/registration-success');
    },
  });

  const onSubmit = (data: RegistrationFormData) => {
    registrationMutation.mutate(data);
  };

  if (classLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading class information...</div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Class Not Found</h1>
          <p className="text-gray-600 mb-4">The class you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Register for {classData.title}</CardTitle>
            <CardDescription>
              {classData.type === 'FREE' ? 'Free Class' : 'Bootcamp'} •{' '}
              {format(new Date(classData.startDatetime), 'MMMM dd, yyyy HH:mm')}
              {classData.priceCents > 0 && (
                <> • GHS {(classData.priceCents / 100).toFixed(2)}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 1: Parent Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Parent Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="parentName">Full Name *</Label>
                    <Input
                      id="parentName"
                      {...register('parentName')}
                      placeholder="John Doe"
                    />
                    {errors.parentName && (
                      <p className="text-sm text-red-600">{errors.parentName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parentEmail">Email *</Label>
                    <Input
                      id="parentEmail"
                      type="email"
                      {...register('parentEmail')}
                      placeholder="john@example.com"
                    />
                    {errors.parentEmail && (
                      <p className="text-sm text-red-600">{errors.parentEmail.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parentPhone">Phone Number</Label>
                    <Input
                      id="parentPhone"
                      {...register('parentPhone')}
                      placeholder="+233241234567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parentWhatsapp">WhatsApp Number</Label>
                    <Input
                      id="parentWhatsapp"
                      {...register('parentWhatsapp')}
                      placeholder="+233241234567"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parentCity">City</Label>
                      <Input id="parentCity" {...register('parentCity')} placeholder="Accra" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentCountry">Country</Label>
                      <Input
                        id="parentCountry"
                        {...register('parentCountry')}
                        placeholder="Ghana"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="howHeard">How did you hear about us?</Label>
                    <Textarea
                      id="howHeard"
                      {...register('howHeard')}
                      placeholder="Social media, friend, etc."
                      rows={2}
                    />
                  </div>

                  <Button type="button" onClick={() => setCurrentStep(2)} className="w-full">
                    Next: Add Students
                  </Button>
                </div>
              )}

              {/* Step 2: Student Information */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Student Information</h3>

                  {fields.map((field, index) => (
                    <div key={field.id} className="border p-4 rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Student {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`students.${index}.name`}>Student Name *</Label>
                        <Input
                          {...register(`students.${index}.name`)}
                          placeholder="Student name"
                        />
                        {errors.students?.[index]?.name && (
                          <p className="text-sm text-red-600">
                            {errors.students[index]?.name?.message}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`students.${index}.age`}>Age</Label>
                          <Input
                            type="number"
                            {...register(`students.${index}.age`, { valueAsNumber: true })}
                            placeholder="12"
                            min={5}
                            max={18}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`students.${index}.school`}>School</Label>
                          <Input
                            {...register(`students.${index}.school`)}
                            placeholder="School name"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {fields.length < 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => append({ name: '', age: undefined, school: '' })}
                    >
                      Add Another Student
                    </Button>
                  )}

                  <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                      Back
                    </Button>
                    <Button type="submit" disabled={registrationMutation.isPending} className="flex-1">
                      {registrationMutation.isPending ? 'Registering...' : 'Complete Registration'}
                    </Button>
                  </div>
                </div>
              )}

              {registrationMutation.isError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {registrationMutation.error instanceof Error
                    ? registrationMutation.error.message
                    : 'Registration failed. Please try again.'}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

