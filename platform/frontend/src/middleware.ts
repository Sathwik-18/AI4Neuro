import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_ROUTES = ['/login', '/landing', '/signup', '/forgot-password', '/reset-password'];

const ROUTE_SEGMENT_TO_ROLE: Record<string, string> = {
  'super-admin': 'super_admin',
  'admin': 'admin',
  'radiologist': 'radiologist',
  'doctor': 'doctor',
  'patient': 'patient',
};

const ROLE_TO_DASHBOARD: Record<string, string> = {
  super_admin: '/super-admin/dashboard',
  admin: '/admin/dashboard',
  radiologist: '/radiologist/dashboard',
  doctor: '/doctor/dashboard',
  patient: '/patient/dashboard',
};

function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let API routes, static assets pass through with just security headers
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  // Create Supabase client with middleware cookie adapter
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

  if (!user) {
    if (isPublicRoute || pathname === '/') {
      addSecurityHeaders(response);
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    const redirect = NextResponse.redirect(url);
    addSecurityHeaders(redirect);
    return redirect;
  }

  // User is authenticated — fetch role once for all checks below
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const userRole = profile?.role;
  const dashboard = userRole ? ROLE_TO_DASHBOARD[userRole] : null;

  // Authenticated user on public route → redirect to their dashboard
  if (isPublicRoute || pathname === '/') {
    if (dashboard) {
      const url = request.nextUrl.clone();
      url.pathname = dashboard;
      const redirect = NextResponse.redirect(url);
      addSecurityHeaders(redirect);
      return redirect;
    }
    addSecurityHeaders(response);
    return response;
  }

  // Role-gated route check
  const firstSegment = pathname.split('/')[1];
  const requiredRole = ROUTE_SEGMENT_TO_ROLE[firstSegment];
  if (requiredRole && userRole !== requiredRole) {
    const url = request.nextUrl.clone();
    url.pathname = dashboard || '/login';
    const redirect = NextResponse.redirect(url);
    addSecurityHeaders(redirect);
    return redirect;
  }

  addSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
