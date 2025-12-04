'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Student {
  id: string;
  name: string;
  age: number | null;
  school: string | null;
  notes: string | null;
}

export default function ChildrenPage() {
  const { data, isLoading, error } = useQuery<Student[]>({
    queryKey: ['parent-children'],
    queryFn: () => apiClient.get<Student[]>('/parent/children'),
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
        <div className="text-red-600">Error loading children</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Children</h1>
        <p className="text-muted-foreground">Manage your registered children</p>
      </div>

      {!data || data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No children registered yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Children will be added when you register for classes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {data.map((child) => (
            <Card key={child.id}>
              <CardHeader>
                <CardTitle>{child.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {child.age && (
                  <div>
                    <p className="text-sm text-muted-foreground">Age</p>
                    <p>{child.age} years old</p>
                  </div>
                )}
                {child.school && (
                  <div>
                    <p className="text-sm text-muted-foreground">School</p>
                    <p>{child.school}</p>
                  </div>
                )}
                {child.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p>{child.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

