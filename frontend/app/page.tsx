'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface LandingData {
  hero: any;
  faq: any;
  testimonials: any;
  experts: any;
  featuredClasses: any[];
  settings?: {
    logo_url?: string | null;
    site_name?: string | null;
  };
}

export default function Home() {
  const [registrationType, setRegistrationType] = useState<'bootcamp' | 'free'>('bootcamp');
  const [childCount, setChildCount] = useState(1);
  const [selectedFreeClass, setSelectedFreeClass] = useState<string>('');
  const [formData, setFormData] = useState({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    parentCity: '',
    children: [{ name: '', age: '', school: '' }],
  });

  const { data, isLoading, error } = useQuery<LandingData>({
    queryKey: ['landing'],
    queryFn: () => apiClient.get<LandingData>('/public/landing'),
    retry: 2,
    retryDelay: 1000,
  });

  const { data: freeClassesResponse } = useQuery<any>({
    queryKey: ['free-classes'],
    queryFn: () => apiClient.get('/public/classes?type=FREE&limit=10'),
    enabled: registrationType === 'free',
  });

  const freeClassOptions = freeClassesResponse?.classes || [];

  const registrationMutation = useMutation({
    mutationFn: (formData: any) => {
      if (registrationType === 'bootcamp') {
        // Store registration data and redirect to classes page to select a bootcamp
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('bootcamp_registration_data', JSON.stringify(formData));
        }
        window.location.href = '/classes?type=BOOTCAMP';
        return Promise.resolve({ success: true });
      } else {
        // For free classes, register directly
        return apiClient.post('/public/register', formData);
      }
    },
    onSuccess: () => {
      if (registrationType === 'free') {
        window.location.href = '/registration-success';
      }
    },
  });

  const handleInputChange = (field: string, value: string, childIndex?: number) => {
    if (childIndex !== undefined) {
      const newChildren = [...formData.children];
      newChildren[childIndex] = { ...newChildren[childIndex], [field]: value };
      setFormData({ ...formData, children: newChildren });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const addChild = () => {
    if (childCount < 5) {
      setChildCount(childCount + 1);
      setFormData({
        ...formData,
        children: [...formData.children, { name: '', age: '', school: '' }],
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registrationType === 'free' && !selectedFreeClass) {
      alert('Please select a free class');
      return;
    }

    const submitData: any = {
      parentName: formData.parentName,
      parentEmail: formData.parentEmail,
      parentPhone: formData.parentPhone,
      parentCity: formData.parentCity,
      students: formData.children.map((child) => ({
        name: child.name,
        age: child.age ? parseInt(child.age) : undefined,
        school: child.school || undefined,
      })),
    };

    if (registrationType === 'free') {
      submitData.classId = selectedFreeClass;
    }

    registrationMutation.mutate(submitData);
  };

  const calculatePrice = () => {
    return childCount * 500;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load page data';
    const isNetworkError = errorMessage.includes('Network Error') || errorMessage.includes('Failed to fetch') || errorMessage.includes('ECONNREFUSED');
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600">
        <div className="text-white text-center px-4 max-w-2xl">
          <div className="text-2xl font-bold mb-4">Error loading page data</div>
          {isNetworkError && (
            <div className="text-lg mb-4">
              <p className="mb-2">Unable to connect to the API server.</p>
              <p className="text-sm opacity-90">
                API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}
              </p>
              <p className="text-sm opacity-90 mt-2">
                Please ensure the backend API is running and accessible.
              </p>
            </div>
          )}
          {!isNetworkError && (
            <div className="text-lg">
              <p className="text-sm opacity-90">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
        <div className="max-w-5xl mx-auto text-center text-white">
          <div className="mb-8">
            {data.settings?.logo_url ? (
              <img
                src={data.settings.logo_url}
                alt={data.settings.site_name || 'Vibe Coding Academy'}
                className="mx-auto max-h-20 object-contain"
                onError={(e) => {
                  // Fallback to text if image fails to load
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    parent.innerHTML = `<h1 class="text-3xl font-bold">${data.settings?.site_name || 'Vibe Coding Academy'}</h1>`;
                  }
                }}
              />
            ) : (
              <h1 className="text-3xl font-bold">{data.settings?.site_name || 'Vibe Coding Academy'}</h1>
            )}
          </div>

          <h1 className="text-5xl font-bold mb-6">
            {data.hero?.title || 'AI Coding Bootcamp for Kids'}
          </h1>
          <p className="text-xl mb-8">
            {data.hero?.subtitle || 'Transform your child into a confident coder in just 8 weeks. Ages 7-18.'}
          </p>

          {/* Video Section */}
          <div className="bg-white rounded-lg shadow-2xl p-8 mb-8">
            <div className="aspect-video bg-gray-900 rounded-lg mb-6 overflow-hidden">
              {data.hero?.videoUrl ? (
                <iframe
                  src={data.hero.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Vibe Coding Academy Video"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-white text-2xl">
                  <div className="text-center">
                    <p>Video Coming Soon</p>
                    <p className="text-sm mt-2">Check back for our introduction video!</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bootcamp Benefits Value Stack */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg mt-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">
                  🚀 Why Choose the Full Bootcamp?
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-left mb-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-2">✓ 4 Hours of Live Coding Classes</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Small-group, AI-powered sessions where your child learns to code and build real digital projects.
                    </p>
                    <span className="text-green-600 font-bold">Value: ₵600</span>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-2">✓ 1 Week Free Access to Vibe Recurring Program</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Continued weekly learning, challenges, and mentor support beyond the bootcamp.
                    </p>
                    <span className="text-green-600 font-bold">Value: ₵250</span>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-2">✓ Guaranteed Project Build</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Every child leaves with a working project they can proudly show friends and family.
                    </p>
                    <span className="text-green-600 font-bold">Value: ₵500</span>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-2">✓ 1 One-on-One Mentorship Session</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Personalized coaching session to guide their learning path and refine their project.
                    </p>
                    <span className="text-green-600 font-bold">Value: ₵350</span>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-2">✓ 2 Free Recorded Courses</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Lifetime access to foundational recorded lessons on AI, app design, and coding.
                    </p>
                    <span className="text-green-600 font-bold">Value: ₵300</span>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-2">✓ Certificate of Completion</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Recognition of their achievement — perfect for portfolios and parent pride moments.
                    </p>
                    <span className="text-green-600 font-bold">Value: ₵150</span>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-2">✓ Parental Progress Report</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      A tailored summary of what your child built, learned, and where they excelled.
                    </p>
                    <span className="text-green-600 font-bold">Value: ₵150</span>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-2">✓ Digital Starter Kit</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Downloadable AI tools, templates, and cheat sheets to continue learning independently.
                    </p>
                    <span className="text-green-600 font-bold">Value: ₵200</span>
                  </div>
                </div>

                {/* Total Value & Pricing */}
                <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-yellow-300">
                  <div className="text-center">
                    <div className="mb-4">
                      <p className="text-lg text-gray-600">Total Value:</p>
                      <span className="text-3xl font-bold text-gray-500 line-through">₵2,500</span>
                    </div>
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-4 rounded-lg">
                      <p className="text-xl font-bold mb-2">🔥 ACT NOW PRICE</p>
                      <p className="text-4xl font-bold">GH₵500</p>
                      <p className="text-lg">Save ₵2,000 (80% OFF)!</p>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>

        {/* Testimonials Section */}
        {data.testimonials?.items && data.testimonials.items.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-2xl p-8 mb-8 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">What Parents Say</h2>
              <p className="text-lg text-gray-600">Hear from families who love Vibe Coding Academy</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {data.testimonials.items.map((testimonial: any, index: number) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow-lg">
                  <p className="text-gray-700 italic mb-4">"{testimonial.text}"</p>
                  <div>
                    <p className="font-bold text-gray-800">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Experts Section */}
        {data.experts?.items && data.experts.items.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-2xl p-8 mb-8 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">What Some Billionaires and Experts are Saying</h2>
              <p className="text-lg text-gray-600">Insights from industry leaders and visionaries</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {data.experts.items.map((expert: any, index: number) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow-lg flex gap-4">
                  {expert.imageUrl && (
                    <img
                      src={expert.imageUrl}
                      alt={expert.name}
                      className="w-20 h-20 object-cover rounded-full flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-gray-700 italic mb-4">"{expert.quote}"</p>
                    <div>
                      <p className="font-bold text-gray-800">{expert.name}</p>
                      <p className="text-sm text-gray-600">{expert.title}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ Section */}
        {data.faq?.items && data.faq.items.length > 0 && (
          <div className="bg-white rounded-lg shadow-2xl p-8 mb-8 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Frequently Asked Questions</h2>
              <p className="text-lg text-gray-600">Everything you need to know about our programs</p>
            </div>
            <div className="space-y-4">
              {data.faq.items.map((faqItem: any, index: number) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg overflow-hidden transition-all hover:shadow-md"
                >
                  <details className="group">
                    <summary className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                      <span className="font-semibold text-gray-800">{faqItem.question}</span>
                    </summary>
                    <div className="p-4 bg-white border-t border-gray-200">
                      <p className="text-gray-700 leading-relaxed">{faqItem.answer}</p>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registration Form */}
        <div id="register" className="bg-white rounded-lg shadow-2xl p-8 max-w-5xl mx-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Get Started</h2>
            <p className="text-gray-600">Choose your path below</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button
              type="button"
              onClick={() => setRegistrationType('bootcamp')}
              className={`border-2 font-bold py-4 px-6 rounded-lg transition ${
                registrationType === 'bootcamp'
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-300 bg-gray-50 text-gray-700'
              }`}
            >
              🎯 Enroll in Bootcamp
            </button>
            <button
              type="button"
              onClick={() => setRegistrationType('free')}
              className={`border-2 font-bold py-4 px-6 rounded-lg transition ${
                registrationType === 'free'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-gray-50 text-gray-700'
              }`}
            >
              🎁 Try a FREE Class
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parentName">Parent Name *</Label>
                <Input
                  id="parentName"
                  type="text"
                  value={formData.parentName}
                  onChange={(e) => handleInputChange('parentName', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="parentEmail">Email *</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  value={formData.parentEmail}
                  onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parentPhone">Phone Number *</Label>
                <Input
                  id="parentPhone"
                  type="tel"
                  value={formData.parentPhone}
                  onChange={(e) => handleInputChange('parentPhone', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="parentCity">City *</Label>
                <Input
                  id="parentCity"
                  type="text"
                  value={formData.parentCity}
                  onChange={(e) => handleInputChange('parentCity', e.target.value)}
                  required
                />
              </div>
            </div>

            {registrationType === 'free' && (
              <div>
                <Label htmlFor="freeClass">Select Free Class *</Label>
                <select
                  id="freeClass"
                  value={selectedFreeClass}
                  onChange={(e) => setSelectedFreeClass(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Choose a free class...</option>
                  {freeClassOptions.map((classItem: any) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.title} - {format(new Date(classItem.startDatetime), 'MMM dd, yyyy')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-4">
              {formData.children.map((child, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Child {index + 1} Information</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`childName${index}`}>Name *</Label>
                      <Input
                        id={`childName${index}`}
                        type="text"
                        value={child.name}
                        onChange={(e) => handleInputChange('name', e.target.value, index)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`childAge${index}`}>Age</Label>
                      <Input
                        id={`childAge${index}`}
                        type="number"
                        value={child.age}
                        onChange={(e) => handleInputChange('age', e.target.value, index)}
                        min="5"
                        max="18"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`childSchool${index}`}>School</Label>
                      <Input
                        id={`childSchool${index}`}
                        type="text"
                        value={child.school}
                        onChange={(e) => handleInputChange('school', e.target.value, index)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {childCount < 5 && (
              <Button
                type="button"
                variant="outline"
                onClick={addChild}
                className="w-full"
              >
                + Add Another Child
              </Button>
            )}

            {registrationType === 'bootcamp' && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">
                    Total: GHS {calculatePrice().toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {childCount} child{childCount > 1 ? 'ren' : ''} × GHS 500
                  </p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={registrationMutation.isPending}
              className={`w-full font-bold py-4 px-8 text-lg ${
                registrationType === 'bootcamp'
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {registrationMutation.isPending
                ? 'Processing...'
                : registrationType === 'bootcamp'
                ? `Enroll in Bootcamp - GHS ${calculatePrice().toLocaleString()}`
                : 'Register for FREE Class'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <footer className="mt-12 py-8 border-t border-orange-300">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-white text-sm">
                &copy; {new Date().getFullYear()} Viable Systems. All rights reserved.
              </p>
              <div className="flex gap-6">
                <Link 
                  href="/parent/login" 
                  className="text-white hover:text-orange-200 transition text-sm"
                >
                  Parent Login
                </Link>
                <Link 
                  href="/admin/login" 
                  className="text-white hover:text-orange-200 transition text-sm"
                >
                  Admin Login
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}