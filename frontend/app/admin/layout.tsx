'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { UserRole } from '@/types/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Fetch settings for logo
  const { data: settings } = useQuery<{ logo_url?: string | null; site_name?: string | null }>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const result = await apiClient.get<{ logo_url?: string | null; site_name?: string | null }>('/admin/settings');
      return result;
    },
    enabled: !isLoading && !!user && user.role === UserRole.ADMIN,
  });

  const getPageTitle = () => {
    if (pathname?.includes('/dashboard')) return 'Dashboard';
    if (pathname?.includes('/parents')) return 'Parents';
    if (pathname?.includes('/students')) return 'Students';
    if (pathname?.includes('/classes')) {
      if (pathname?.includes('/new')) return 'Create Class';
      if (pathname?.match(/\/classes\/[^/]+$/)) return 'Class Details';
      return 'Classes';
    }
    if (pathname?.includes('/courses')) {
      if (pathname?.match(/\/courses\/[^/]+$/)) return 'Course Details';
      return 'Courses';
    }
    if (pathname?.includes('/cms')) return 'Content Management';
    if (pathname?.includes('/registrations')) return 'Registrations';
    if (pathname?.includes('/payments')) return 'Payments';
    if (pathname?.includes('/payment-attempts')) return 'Abandoned Carts';
    if (pathname?.includes('/settings')) return 'Settings';
    if (pathname?.includes('/notification-logs')) return 'Notification Logs';
    return 'Admin Dashboard';
  };

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (!isLoginPage && !isLoading && (!user || user.role !== UserRole.ADMIN)) {
      router.push('/admin/login');
    }
  }, [user, isLoading, router, isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  // If not authenticated, show nothing (will redirect via useEffect)
  if (!user || user.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Redirecting to login...</div>
      </div>
    );
  }

  const NavigationContent = () => (
    <>
      <div className="p-6 border-b border-gray-200">
        {settings?.logo_url ? (
          <div className="flex flex-col items-center">
            <img
              src={settings.logo_url}
              alt={settings.site_name || 'Vibe Coding Academy'}
              className="max-h-12 object-contain mb-2"
              onError={(e) => {
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <h1 class="text-xl font-bold text-gray-900">${settings.site_name || 'Vibe Coding Academy'}</h1>
                    <p class="text-sm text-gray-500">Admin Portal</p>
                  `;
                }
              }}
            />
            <p className="text-sm text-gray-500">Admin Portal</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900">{settings?.site_name || 'Vibe Coding Academy'}</h1>
            <p className="text-sm text-gray-500">Admin Portal</p>
          </>
        )}
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <Link
          href="/admin/dashboard"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname === '/admin/dashboard'
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Dashboard
        </Link>
        <Link
          href="/admin/parents"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/parents')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Parents
        </Link>
        <Link
          href="/admin/students"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/students')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Students
        </Link>
        <Link
          href="/admin/classes"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/classes')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Classes
        </Link>
        <Link
          href="/admin/courses"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/courses')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Courses
        </Link>
        <Link
          href="/admin/cms"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/cms')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          CMS
        </Link>
        <Link
          href="/admin/registrations"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/registrations')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Registrations
        </Link>
        <Link
          href="/admin/payments"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/payments')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Payments
        </Link>
        <Link
          href="/admin/payment-reminders"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/payment-reminders')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Payment Reminders
        </Link>
        <Link
          href="/admin/payment-attempts"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/payment-attempts')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Abandoned Carts
        </Link>
        <Link
          href="/admin/settings"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/settings')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Settings
        </Link>
        <Link
          href="/admin/notification-logs"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/admin/notification-logs')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Notification Logs
        </Link>
      </nav>
      <div className="p-4 border-t border-gray-200">
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <Button onClick={logout} variant="outline" className="w-full">
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:fixed md:inset-y-0 md:left-0 md:w-64 md:bg-white md:border-r md:border-gray-200">
        <div className="flex flex-col h-full">
          <NavigationContent />
        </div>
      </div>

      {/* Mobile Header with Hamburger */}
      <header className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full">
                <NavigationContent />
              </div>
            </SheetContent>
          </Sheet>
          <h2 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h2>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            Public
          </Link>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:block bg-white border-b border-gray-200 md:ml-64 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h2>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            View Public Site
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="md:ml-64">
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
