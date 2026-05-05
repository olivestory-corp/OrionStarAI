import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for handling authentication and route protection
 *
 * This middleware checks if user has a valid session cookie
 * and redirects to login page if not authenticated on protected routes
 */

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login/redirect',
  '/api/auth/sso/callback',
  '/api/auth/status',
  '/api/auth/validate',
  '/api/lang/config',
];

// Routes that require authentication (optional for now, can be expanded)
const PROTECTED_ROUTES: string[] = [
  // Add routes that specifically require authentication
  // For now, we don't require auth globally - users can browse without it
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route =>
    pathname.startsWith(route) || pathname === '/'
  );

  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check if the current route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route =>
    pathname.startsWith(route)
  );

  // For protected routes, check for session cookie
  if (isProtectedRoute) {
    const sessionCookie = request.cookies.get('deepwiki_session')?.value;

    if (!sessionCookie) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Configure which routes to apply middleware to
export const config = {
  matcher: [
    /*
     * Currently disabled - authentication is handled in pages via useAuth hook
     * This prevents compatibility issues with Next.js middleware
     */
  ],
};
