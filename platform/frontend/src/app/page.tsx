'use client';

import { Brain } from '@/components/icons';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { dashboardPathFor } from '@/lib/roles';
import LandingPage from './landing/page';

/**
 * Root route — the platform's public front door.
 *
 * - Not authenticated        → render the landing page in place (no redirect,
 *                              so `/` is a real, indexable marketing page).
 * - Authenticated + active   → redirect to `/{role}/dashboard`.
 * - Authenticated, not active→ redirect to `/account-suspended`.
 *
 * Previously this route redirected every anonymous visitor straight to
 * `/login`, which left the landing page at `/landing` with nothing linking to
 * it — the product had no public entry point at all.
 */
export default function RootPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || !userProfile) return;

    if (userProfile.account_status !== 'active') {
      router.replace('/account-suspended');
      return;
    }

    if (userProfile.role) {
      router.replace(dashboardPathFor(userProfile.role));
    }
  }, [user, userProfile, loading, router]);

  // Signed-in users are on their way to a dashboard — hold the landing page
  // back so it doesn't flash before the redirect lands.
  if (loading || user) {
    return <RootRedirectSplash />;
  }

  return <LandingPage />;
}

function RootRedirectSplash() {
  return (
    <div className="ai4-page min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-sm">
            <Brain className="w-10 h-10 text-white" aria-hidden />
          </div>
          <div className="absolute inset-0 -m-4 flex items-center justify-center">
            <div className="w-28 h-28 rounded-2xl border-2 border-primary/20 animate-ping"></div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xl font-semibold text-foreground mb-2">AI4NEURO</p>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="relative w-5 h-5">
              <div className="w-5 h-5 border-2 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 w-5 h-5 border-2 border-transparent border-t-primary rounded-full animate-spin"></div>
            </div>
            <span className="text-sm">Loading your dashboard...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
