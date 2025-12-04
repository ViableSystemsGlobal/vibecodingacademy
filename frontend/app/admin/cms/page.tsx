'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, Eye, Save, Upload, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

interface CmsBlock {
  id: string;
  slug: string;
  content: any;
  updatedAt: string;
}

export default function CmsPage() {
  const queryClient = useQueryClient();
  const [selectedSection, setSelectedSection] = useState<string>('hero');
  const [previewData, setPreviewData] = useState<any>({});

  const { data: blocks, isLoading, refetch, error } = useQuery<CmsBlock[]>({
    queryKey: ['admin-cms'],
    queryFn: async () => {
      try {
        const data = await apiClient.get<CmsBlock[]>('/admin/cms');
        return Array.isArray(data) ? data : [];
      } catch (err: any) {
        console.error('Error fetching CMS blocks:', err);
        // Return empty array on error so page can still render
        return [];
      }
    },
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 1, // Only retry once
    retryDelay: 1000, // Wait 1 second before retry
  });

  const blocksArray = blocks || [];
  const heroBlock = blocksArray.find(b => b.slug === 'hero');
  const testimonialsBlock = blocksArray.find(b => b.slug === 'testimonials');
  const expertsBlock = blocksArray.find(b => b.slug === 'experts');

  // Initialize preview data from saved blocks - update when blocks are loaded or change
  useEffect(() => {
    if (!isLoading) {
      const newData = {
        hero: heroBlock?.content || { title: '', subtitle: '', videoUrl: '' },
        testimonials: testimonialsBlock?.content || { items: [] },
        experts: expertsBlock?.content || { items: [] },
      };
      
      // Always update to ensure we have the latest data from server
      setPreviewData(newData);
    }
  }, [isLoading, heroBlock, testimonialsBlock, expertsBlock]);

  const updateMutation = useMutation({
    mutationFn: ({ slug, content }: { slug: string; content: any }) =>
      apiClient.put(`/admin/cms/${slug}`, { content }),
    onSuccess: async (savedBlock, variables) => {
      // Update preview data immediately with saved content
      setPreviewData((prev: any) => ({ 
        ...prev, 
        [variables.slug]: savedBlock?.content || variables.content
      }));
      
      // Invalidate and refetch to ensure we have the latest from server
      await queryClient.invalidateQueries({ queryKey: ['admin-cms'] });
      await refetch();
      
      toast.success(`${variables.slug} section updated successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update section');
    },
  });

  const handleSave = (slug: string, content: any) => {
    updateMutation.mutate({ slug, content });
  };

  // Show error but don't block the UI - allow editing even if initial load fails
  if (error && !blocks) {
    return (
      <div className="space-y-4 lg:space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-semibold mb-2">
            Error loading CMS data
          </div>
          <div className="text-red-600 text-sm mb-4">
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Show loading only on initial load, not when refetching
  if (isLoading && !blocks) {
    return (
      <div className="space-y-4 lg:space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">Loading CMS...</div>
            <div className="text-sm text-muted-foreground">Fetching your content</div>
          </div>
        </div>
      </div>
    );
  }

  // Debug info (remove in production)
  const debugInfo = (
    <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-100 rounded">
      <p>Blocks loaded: {blocksArray.length}</p>
      <p>Hero block: {heroBlock ? 'Found' : 'Not found'}</p>
      <p>Testimonials block: {testimonialsBlock ? 'Found' : 'Not found'}</p>
      <p>Experts block: {expertsBlock ? 'Found' : 'Not found'}</p>
    </div>
  );

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Landing Page CMS</h1>
        <p className="text-muted-foreground text-sm lg:text-base">
          Edit your landing page content with live preview. Changes update instantly!
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Edit Content</CardTitle>
              <CardDescription>Make changes and see them in the preview</CardDescription>
            </CardHeader>
            <CardContent>
              {debugInfo}
              <Tabs value={selectedSection} onValueChange={setSelectedSection}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="hero">Hero</TabsTrigger>
                  <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
                  <TabsTrigger value="experts">Experts</TabsTrigger>
                </TabsList>

                <TabsContent value="hero" className="space-y-4 mt-4">
                  <HeroEditor
                    key={`hero-${heroBlock?.updatedAt || Date.now()}`}
                    content={previewData.hero || {}}
                    onChange={(content) => {
                      setPreviewData((prev: any) => ({ ...prev, hero: content }));
                    }}
                    onSave={() => handleSave('hero', previewData.hero)}
                    isSaving={updateMutation.isPending}
                  />
                </TabsContent>

                <TabsContent value="testimonials" className="space-y-4 mt-4">
                  <TestimonialsEditor
                    key={`testimonials-${testimonialsBlock?.updatedAt || Date.now()}`}
                    content={previewData.testimonials || { items: [] }}
                    onChange={(content) => {
                      setPreviewData((prev: any) => ({ ...prev, testimonials: content }));
                    }}
                    onSave={() => handleSave('testimonials', previewData.testimonials)}
                    isSaving={updateMutation.isPending}
                  />
                </TabsContent>

                <TabsContent value="experts" className="space-y-4 mt-4">
                  <ExpertsEditor
                    key={`experts-${expertsBlock?.updatedAt || Date.now()}`}
                    content={previewData.experts || { items: [] }}
                    onChange={(content) => {
                      setPreviewData((prev: any) => ({ ...prev, experts: content }));
                    }}
                    onSave={() => handleSave('experts', previewData.experts)}
                    isSaving={updateMutation.isPending}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Live Preview
                  </CardTitle>
                  <CardDescription>See your changes in real-time</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/', '_blank')}
                >
                  View Live Site
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 max-h-[80vh] overflow-y-auto border">
                <LandingPreview data={previewData} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Hero Editor Component
function HeroEditor({
  content,
  onChange,
  onSave,
  isSaving,
}: {
  content: any;
  onChange: (content: any) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  // Sync local state with prop changes (when data is reloaded from server)
  const [localContent, setLocalContent] = useState(() => content || { title: '', subtitle: '', videoUrl: '' });
  
  useEffect(() => {
    // Update local state when content prop changes (after save/refresh)
    if (content) {
      setLocalContent(content);
    }
  }, [content]);

  const handleChange = (field: string, value: string) => {
    const newContent = { ...localContent, [field]: value };
    setLocalContent(newContent);
    onChange(newContent);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hero-title">Main Title *</Label>
        <Input
          id="hero-title"
          value={localContent.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="AI Coding Bootcamp for Kids"
        />
        <p className="text-xs text-muted-foreground">
          The main headline that appears at the top of your page
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hero-subtitle">Subtitle *</Label>
        <Textarea
          id="hero-subtitle"
          value={localContent.subtitle || ''}
          onChange={(e) => handleChange('subtitle', e.target.value)}
          placeholder="Transform your child into a confident coder in just 8 weeks. Ages 7-18."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          A brief description that appears below the title
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hero-video">Video URL (YouTube)</Label>
        <Input
          id="hero-video"
          value={localContent.videoUrl || ''}
          onChange={(e) => handleChange('videoUrl', e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
        />
        <p className="text-xs text-muted-foreground">
          Paste a YouTube video URL. It will be embedded automatically.
        </p>
      </div>

      <Button onClick={() => onSave()} disabled={isSaving} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? 'Saving...' : 'Save Hero Section'}
      </Button>
    </div>
  );
}

// Testimonials Editor Component
function TestimonialsEditor({
  content,
  onChange,
  onSave,
  isSaving,
}: {
  content: any;
  onChange: (content: any) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const items = content.items || [];

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange({ items: newItems });
  };

  const addItem = () => {
    onChange({ items: [...items, { name: '', role: '', text: '' }] });
  };

  const removeItem = (index: number) => {
    onChange({ items: items.filter((_: any, i: number) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Testimonials</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="w-4 h-4 mr-1" />
          Add Testimonial
        </Button>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {items.map((item: any, index: number) => (
          <div key={index} className="border rounded-lg p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Testimonial {index + 1}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={item.name || ''}
                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                placeholder="Sarah M."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Role/Title</Label>
              <Input
                value={item.role || ''}
                onChange={(e) => handleItemChange(index, 'role', e.target.value)}
                placeholder="Parent"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Testimonial Text</Label>
              <Textarea
                value={item.text || ''}
                onChange={(e) => handleItemChange(index, 'text', e.target.value)}
                rows={3}
                placeholder="My daughter loves the classes!..."
              />
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No testimonials yet. Click "Add Testimonial" to get started.
          </div>
        )}
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? 'Saving...' : 'Save Testimonials'}
      </Button>
    </div>
  );
}

// Experts Editor Component
function ExpertsEditor({
  content,
  onChange,
  onSave,
  isSaving,
}: {
  content: any;
  onChange: (content: any) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const items = content.items || [];

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange({ items: newItems });
  };

  const addItem = () => {
    onChange({ items: [...items, { name: '', title: '', quote: '', imageUrl: '' }] });
  };

  const removeItem = (index: number) => {
    onChange({ items: items.filter((_: any, i: number) => i !== index) });
  };

  const handleImageUpload = async (index: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}/admin/settings/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      handleItemChange(index, 'imageUrl', data.data.url);
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload image');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Experts & Billionaires</Label>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="w-4 h-4 mr-1" />
          Add Expert
        </Button>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {items.map((item: any, index: number) => (
          <div key={index} className="border rounded-lg p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Expert {index + 1}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={item.name || ''}
                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                placeholder="Elon Musk"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Title/Position</Label>
              <Input
                value={item.title || ''}
                onChange={(e) => handleItemChange(index, 'title', e.target.value)}
                placeholder="CEO, Tesla & SpaceX"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Quote/Statement</Label>
              <Textarea
                value={item.quote || ''}
                onChange={(e) => handleItemChange(index, 'quote', e.target.value)}
                rows={3}
                placeholder="Coding is the language of the future..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  value={item.imageUrl || ''}
                  onChange={(e) => handleItemChange(index, 'imageUrl', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(index, file);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-1" />
                      Upload
                    </span>
                  </Button>
                </label>
              </div>
              {item.imageUrl && (
                <div className="mt-2">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No experts yet. Click "Add Expert" to get started.
          </div>
        )}
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? 'Saving...' : 'Save Experts Section'}
      </Button>
    </div>
  );
}

// Landing Preview Component
function LandingPreview({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-lg p-6 space-y-6">
      {/* Hero Section Preview */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">
          {data.hero?.title || 'Your Title Here'}
        </h1>
        <p className="text-lg text-gray-600">
          {data.hero?.subtitle || 'Your subtitle here'}
        </p>
        {data.hero?.videoUrl && (
          <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
            <p className="text-sm text-gray-500">Video Preview</p>
          </div>
        )}
      </div>

      {/* Testimonials Preview */}
      {data.testimonials?.items && data.testimonials.items.length > 0 && (
        <div className="border-t pt-6">
          <h2 className="text-2xl font-bold mb-4">What Parents Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.testimonials.items.map((testimonial: any, index: number) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm italic mb-2">"{testimonial.text || 'Testimonial text...'}"</p>
                <p className="font-semibold text-sm">{testimonial.name || 'Name'}</p>
                <p className="text-xs text-gray-600">{testimonial.role || 'Role'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experts Preview */}
      {data.experts?.items && data.experts.items.length > 0 && (
        <div className="border-t pt-6">
          <h2 className="text-2xl font-bold mb-4">What Some Billionaires and Experts are Saying</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.experts.items.map((expert: any, index: number) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg flex gap-4">
                {expert.imageUrl && (
                  <img
                    src={expert.imageUrl}
                    alt={expert.name}
                    className="w-16 h-16 object-cover rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm italic mb-2">"{expert.quote || 'Expert quote...'}"</p>
                  <p className="font-semibold text-sm">{expert.name || 'Expert Name'}</p>
                  <p className="text-xs text-gray-600">{expert.title || 'Title'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
