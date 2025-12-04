import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/public', '/login', '/register'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Admin routes
  const isAdminRoute = pathname.startsWith('/admin');
  
  // Parent routes
  const isParentRoute = pathname.startsWith('/parent');
  
  // Student routes
  const isStudentRoute = pathname.startsWith('/student');

  // If accessing protected route without token, allow through
  // The component/page will handle redirect to login
  if (!token && !isPublicRoute) {
    // Allow through - components will handle auth check
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

