'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface HeroContent {
  title?: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;
  videoUrl?: string | null;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface TestimonialItem {
  name: string;
  role: string;
  text: string;
  image?: string;
}

interface LandingData {
  hero: HeroContent | null;
  faq: { items: FaqItem[] } | null;
  testimonials: { items: TestimonialItem[] } | null;
  featuredClasses: any[];
}

interface FreeClass {
  id: string;
  title: string;
  startDatetime: string;
  description: string | null;
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

  const { data, isLoading } = useQuery<LandingData>({
    queryKey: ['landing'],
    queryFn: () => apiClient.get<LandingData>('/public/landing'),
  });

  const { data: freeClassesResponse } = useQuery<{ classes: FreeClass[] }>({
    queryKey: ['free-classes'],
    queryFn: () => apiClient.get<{ classes: FreeClass[] }>('/public/classes?type=FREE&limit=10'),
    enabled: registrationType === 'free',
  });

  const freeClassOptions = freeClassesResponse?.classes || [];

  const registrationMutation = useMutation({
    mutationFn: (formData: any) => {
      if (registrationType === 'bootcamp') {
        // For bootcamp, redirect to classes page to select a bootcamp class
        // Store form data in sessionStorage for checkout
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('bootcamp_registration_data', JSON.stringify(formData));
        }
        window.location.href = '/classes?type=BOOTCAMP';
        return Promise.resolve({ success: true });
      } else {
        // For free class, register directly
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

    const submitData: {
      parentName: string;
      parentEmail: string;
      parentPhone: string;
      parentCity: string;
      students: Array<{
        name: string;
        age?: number;
        school?: string;
      }>;
      classId?: string;
    } = {
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
    return childCount * 500; // GHS 500 per child
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600">
        <div className="text-white text-xl">Error loading page data</div>
      </div>
    );
  }

  const hero = data.hero;
  const testimonials = data.testimonials;
  const faq = data.faq;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 relative overflow-hidden">
      {/* Hero Background Image (if available) */}
      <div className="absolute inset-0 z-0 opacity-20">
        {/* Background image would go here if configured */}
      </div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-5xl mx-auto text-center text-white">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Vibe Coding Academy</h1>
          </div>

          {/* Hero Title */}
          <h1 className="text-5xl font-bold mb-6">
            {hero?.title || 'AI Coding Bootcamp for Kids'}
          </h1>
          <p className="text-xl mb-8">
            {hero?.subtitle || 'Transform your child into a confident coder in just 8 weeks. Ages 7-18.'}
          </p>

          {/* Video Section */}
          <div className="bg-white rounded-lg shadow-2xl p-8 mb-8">
            <div className="aspect-video bg-gray-900 rounded-lg mb-6 overflow-hidden">
              {hero?.videoUrl ? (
                hero.videoUrl.includes('youtube.com') || hero.videoUrl.includes('youtu.be') ? (
                  <iframe
                    src={hero.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Vibe Coding Academy Video"
                  />
                ) : (
                  <video controls preload="metadata" className="w-full h-full object-cover">
                    <source src={hero.videoUrl} type="video/mp4" />
                    <p className="text-white text-center p-8">
                      Your browser does not support the video tag.{' '}
                      <a href={hero.videoUrl} target="_blank" className="underline text-blue-300">
                        Click here to download
                      </a>
                    </p>
                  </video>
                )
              ) : (
                <div className="flex items-center justify-center h-full text-white text-2xl">
                  <div className="text-center">
                    <p>No video uploaded yet</p>
                    <p className="text-sm mt-2">Admin: Upload video in CMS</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bootcamp Benefits */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg">
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
        {testimonials?.items && testimonials.items.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-2xl p-8 mb-8 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">What Parents Say</h2>
              <p className="text-lg text-gray-600">Hear from families who love Vibe Coding Academy</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {testimonials.items.map((testimonial: TestimonialItem, index: number) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow-lg">
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className="w-5 h-5 text-yellow-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
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

        {/* FAQ Section */}
        {faq?.items && faq.items.length > 0 && (
          <div className="bg-white rounded-lg shadow-2xl p-8 mb-8 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Frequently Asked Questions</h2>
              <p className="text-lg text-gray-600">Everything you need to know about our programs</p>
            </div>
            <div className="space-y-4">
              {faq.items.map((faqItem: FaqItem, index: number) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg overflow-hidden transition-all hover:shadow-md"
                >
                  <details className="group">
                    <summary className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                      <span className="font-semibold text-gray-800">{faqItem.question}</span>
                      <svg
                        className="w-5 h-5 text-gray-500 transition-transform group-open:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
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

            {/* Registration Type Selector */}
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
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-300 bg-gray-50 text-gray-700'
                }`}
              >
                🧪 Try Free Class First
              </button>
            </div>

            {/* Selected Option Display */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg mb-6">
              {registrationType === 'bootcamp' ? (
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">🚀 Bootcamp Enrollment</h3>
                  <p className="text-sm text-gray-600">
                    Get the complete program with all perks and money-back guarantee
                  </p>
                  <p className="text-lg font-bold text-orange-600 mt-2">
                    GHS {calculatePrice().toLocaleString()} per child
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">🧪 Free Class Registration</h3>
                  <p className="text-sm text-gray-600">
                    Choose from our available free classes to try coding
                  </p>
                  <p className="text-lg font-bold text-green-600 mt-2">
                    100% FREE - No credit card required
                  </p>

                  {/* Free Class Selection */}
                  <div className="mt-4">
                    <Label htmlFor="free_class_select" className="block text-gray-700 font-semibold mb-2">
                      Select Free Class:
                    </Label>
                    <select
                      id="free_class_select"
                      value={selectedFreeClass}
                      onChange={(e) => setSelectedFreeClass(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white"
                    >
                      <option value="">Choose a free class...</option>
                      {freeClassOptions.map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {classItem.title} - {format(new Date(classItem.startDatetime), 'MMM j, yyyy')}
                        </option>
                      ))}
                    </select>

                    {selectedFreeClass && (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-800">
                          {freeClassOptions.find((c) => c.id === selectedFreeClass)?.title}
                        </h4>
                        <p className="text-sm text-green-700 mt-1">
                          {freeClassOptions.find((c) => c.id === selectedFreeClass)?.description}
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          <strong>Date:</strong>{' '}
                          {format(
                            new Date(
                              freeClassOptions.find((c) => c.id === selectedFreeClass)?.startDatetime || ''
                            ),
                            'EEEE, MMMM j, yyyy'
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Parent Information */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parent_name" className="block text-gray-700 font-semibold mb-2">
                    Parent Name *
                  </Label>
                  <Input
                    id="parent_name"
                    value={formData.parentName}
                    onChange={(e) => handleInputChange('parentName', e.target.value)}
                    required
                    className="text-gray-900"
                  />
                </div>
                <div>
                  <Label htmlFor="parent_email" className="block text-gray-700 font-semibold mb-2">
                    Email *
                  </Label>
                  <Input
                    id="parent_email"
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                    required
                    className="text-gray-900"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parent_phone" className="block text-gray-700 font-semibold mb-2">
                    Phone *
                  </Label>
                  <Input
                    id="parent_phone"
                    type="tel"
                    value={formData.parentPhone}
                    onChange={(e) => handleInputChange('parentPhone', e.target.value)}
                    required
                    className="text-gray-900"
                  />
                </div>
                <div>
                  <Label htmlFor="parent_city" className="block text-gray-700 font-semibold mb-2">
                    City
                  </Label>
                  <Input
                    id="parent_city"
                    value={formData.parentCity}
                    onChange={(e) => handleInputChange('parentCity', e.target.value)}
                    className="text-gray-900"
                  />
                </div>
              </div>

              {/* Children Information */}
              <div className="space-y-4">
                {formData.children.map((child, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-3">Child {index + 1}</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label
                          htmlFor={`child_name_${index}`}
                          className="block text-gray-700 font-semibold mb-2"
                        >
                          Name *
                        </Label>
                        <Input
                          id={`child_name_${index}`}
                          value={child.name}
                          onChange={(e) => handleInputChange('name', e.target.value, index)}
                          required
                          className="text-gray-900"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor={`child_age_${index}`}
                          className="block text-gray-700 font-semibold mb-2"
                        >
                          Age *
                        </Label>
                        <Input
                          id={`child_age_${index}`}
                          type="number"
                          min="7"
                          max="18"
                          value={child.age}
                          onChange={(e) => handleInputChange('age', e.target.value, index)}
                          required
                          className="text-gray-900"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor={`child_school_${index}`}
                          className="block text-gray-700 font-semibold mb-2"
                        >
                          School
                        </Label>
                        <Input
                          id={`child_school_${index}`}
                          value={child.school}
                          onChange={(e) => handleInputChange('school', e.target.value, index)}
                          className="text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {childCount < 5 && (
                <button
                  type="button"
                  onClick={addChild}
                  className="text-orange-600 hover:text-orange-700 font-semibold"
                >
                  + Add Another Child
                </button>
              )}

              {/* Price Display (Bootcamp only) */}
              {registrationType === 'bootcamp' && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Total Price</p>
                    <p className="text-2xl font-bold text-green-600">
                      GHS {calculatePrice().toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {childCount} child{childCount > 1 ? 'ren' : ''} × GHS 500
                    </p>
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
        </div>
      </div>
    </div>
  );
}
