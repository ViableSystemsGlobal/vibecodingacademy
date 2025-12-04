'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { UserRole } from '@/types/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname?.includes('/dashboard')) return 'Dashboard';
    if (pathname?.includes('/children')) return 'My Children';
    if (pathname?.includes('/registrations')) return 'Class Registrations';
    if (pathname?.includes('/payments')) return 'Payments';
    if (pathname?.includes('/settings')) return 'Settings';
    return 'Parent Portal';
  };

  const isLoginPage = pathname === '/parent/login';

  useEffect(() => {
    if (!isLoginPage && !isLoading && (!user || user.role !== UserRole.PARENT)) {
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

  if (!user || user.role !== UserRole.PARENT) {
    return null;
  }

  const NavigationContent = () => (
    <>
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Vibe Coding Academy</h1>
        <p className="text-sm text-gray-500">Parent Portal</p>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <Link
          href="/parent/dashboard"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname === '/parent/dashboard'
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Dashboard
        </Link>
        <Link
          href="/parent/children"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/parent/children')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          My Children
        </Link>
        <Link
          href="/parent/registrations"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/parent/registrations')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Classes
        </Link>
        <Link
          href="/parent/payments"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/parent/payments')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Payments
        </Link>
        <Link
          href="/parent/settings"
          className={`block px-4 py-2 rounded-lg transition ${
            pathname?.includes('/parent/settings')
              ? 'bg-orange-100 text-orange-700 font-semibold'
              : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
          }`}
        >
          Settings
        </Link>
        <Link
          href="/student/dashboard"
          className="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 mt-4 pt-4 border-t border-gray-200"
        >
          Student Portal
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

