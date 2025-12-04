'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { UserRole } from '@/types/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname?.includes('/dashboard')) return 'Dashboard';
    if (pathname?.includes('/courses')) return 'My Courses';
    if (pathname?.includes('/classes')) return 'Live Classes';
    return 'Student Portal';
  };

  const isLoginPage = pathname === '/student/login';

  // For v1, students access through parent account
  // So we allow PARENT role to access student portal
  useEffect(() => {
    if (!isLoginPage && !isLoading && !user) {
      router.push('/parent/login');
    }
  }, [user, isLoading, router, isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Vibe Coding Academy</h1>
            <p className="text-sm text-gray-500">Student Portal</p>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link
              href="/student/dashboard"
              className={`block px-4 py-2 rounded-lg transition ${
                pathname === '/student/dashboard'
                  ? 'bg-orange-100 text-orange-700 font-semibold'
                  : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/student/courses"
              className={`block px-4 py-2 rounded-lg transition ${
                pathname?.includes('/student/courses')
                  ? 'bg-orange-100 text-orange-700 font-semibold'
                  : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
              }`}
            >
              My Courses
            </Link>
            <Link
              href="/student/classes"
              className={`block px-4 py-2 rounded-lg transition ${
                pathname?.includes('/student/classes')
                  ? 'bg-orange-100 text-orange-700 font-semibold'
                  : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
              }`}
            >
              Live Classes
            </Link>
          </nav>
          <div className="p-4 border-t border-gray-200">
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={logout} variant="outline" className="flex-1">
                Logout
              </Button>
              <Link href="/parent/dashboard">
                <Button variant="outline" className="flex-1">
                  Parent View
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h2>
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
              View Public Site
            </Link>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

