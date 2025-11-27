import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const url = new URL(request.url);
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  
  // Determine which domain/port we're on
  // Port 3000 = Ecommerce (shop), Port 3001/3003 = Admin (sms)
  const isAdminDomain = hostname.includes('sms.') || hostname.includes('admin.');
  const adminPortMatches = [':3001', ':3003'];
  const isAdminPort =
    port === '3001' ||
    port === '3003' ||
    adminPortMatches.some((match) => hostname.includes(match));
  const isShopPort = port === '3000' || hostname.includes(':3000');
  
  // Admin domain/port (sms.thepoolshop.africa or localhost:3001)
  if (isAdminDomain || isAdminPort) {
    // Block access to shop routes on admin
    if (pathname.startsWith('/shop')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Let the root path through - the page component will handle auth redirect
    // (redirects to /auth/signin if not logged in, or /dashboard if logged in)
    
    // Allow all other admin routes
    return NextResponse.next();
  }

  // Shop domain/port (thepoolshop.africa or localhost:3000) - Ecommerce
  if (isShopPort || (!isAdminDomain && !isAdminPort)) {
    // Block access to admin routes on shop (except public APIs)
    const adminRoutes = [
      '/dashboard',
      '/crm',
      '/drm',
      '/sales',
      '/inventory',
      '/orders',
      '/quotations',
      '/invoices',
      '/payments',
      '/products',
      '/warehouses',
      '/agents',
      '/tasks',
      '/reports',
      '/settings',
      '/auth',
    ];

    // Allow API routes and shop routes
    if (pathname.startsWith('/api') || pathname.startsWith('/shop')) {
      return NextResponse.next();
    }

    // Redirect admin routes to shop
    if (adminRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/shop', request.url));
    }

    // Allow root path to show homepage (not redirect)
    // Root path will show homepage on shop domain
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
