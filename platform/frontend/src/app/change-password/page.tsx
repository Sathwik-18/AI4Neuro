'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Brain, Check, CheckCircle2, Eye, EyeOff, Loader2, Lock, ShieldCheck } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRoleMeta, type Role } from '@/lib/navigation';
import type { Accent } from '@/components/dashboards/shared/primitives';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/shared/BrandLogo';

// Fully-literal per-accent classes (Tailwind's JIT scanner needs complete
// class strings in source, not ones built by concatenating a variant prefix
// onto a color name at runtime) so this page matches the caller's own
// dashboard color instead of being permanently emerald/green.
const THEME: Record<
  Accent,
  {
    solid: string;
    solidHover: string;
    text: string;
    textHover: string;
    hoverText: string;
    focusBorder: string;
    focusRing: string;
    buttonRing: string;
    lightBg: string;
    lightBorder: string;
    panelGradient: string;
    dot: string;
    ringBorder: string;
  }
> = {
  green: {
    solid: 'bg-blue-600',
    solidHover: 'hover:bg-blue-700',
    text: 'text-blue-600',
    textHover: 'group-hover:text-blue-700',
    hoverText: 'hover:text-blue-700',
    focusBorder: 'focus:border-blue-400',
    focusRing: 'focus:ring-blue-500/40',
    buttonRing: 'focus:ring-blue-500',
    lightBg: 'bg-blue-100',
    lightBorder: 'border-blue-100',
    panelGradient: 'from-blue-50 via-sky-50 to-slate-50',
    dot: 'bg-blue-500',
    ringBorder: 'border-blue-500/20',
  },
  indigo: {
    solid: 'bg-blue-600',
    solidHover: 'hover:bg-blue-700',
    text: 'text-blue-600',
    textHover: 'group-hover:text-blue-700',
    hoverText: 'hover:text-blue-700',
    focusBorder: 'focus:border-blue-400',
    focusRing: 'focus:ring-blue-500/40',
    buttonRing: 'focus:ring-blue-500',
    lightBg: 'bg-blue-100',
    lightBorder: 'border-blue-100',
    panelGradient: 'from-blue-50 via-sky-50 to-slate-50',
    dot: 'bg-blue-500',
    ringBorder: 'border-blue-500/20',
  },
  blue: {
    solid: 'bg-blue-600',
    solidHover: 'hover:bg-blue-700',
    text: 'text-blue-600',
    textHover: 'group-hover:text-blue-700',
    hoverText: 'hover:text-blue-700',
    focusBorder: 'focus:border-blue-400',
    focusRing: 'focus:ring-blue-500/40',
    buttonRing: 'focus:ring-blue-500',
    lightBg: 'bg-blue-100',
    lightBorder: 'border-blue-100',
    panelGradient: 'from-blue-50 via-sky-50 to-slate-50',
    dot: 'bg-blue-500',
    ringBorder: 'border-blue-500/20',
  },
  teal: {
    solid: 'bg-blue-600',
    solidHover: 'hover:bg-blue-700',
    text: 'text-blue-600',
    textHover: 'group-hover:text-blue-700',
    hoverText: 'hover:text-blue-700',
    focusBorder: 'focus:border-blue-400',
    focusRing: 'focus:ring-blue-500/40',
    buttonRing: 'focus:ring-blue-500',
    lightBg: 'bg-blue-100',
    lightBorder: 'border-blue-100',
    panelGradient: 'from-blue-50 via-sky-50 to-slate-50',
    dot: 'bg-blue-500',
    ringBorder: 'border-blue-500/20',
  },
};

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { userProfile } = useAuth();
  const dashboardHref = userProfile?.role ? getRoleMeta(userProfile.role).dashboard : '/';
  const accent = getRoleMeta((userProfile?.role as Role) ?? 'doctor').accent;
  const t = THEME[accent];

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { first_login: false },
      });

      if (updateError) {
        toast.error(updateError.message);
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('User not found');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      toast.success('Password changed successfully!');

      // Client-side navigation keeps the SPA/auth state intact (no full reload).
      if (profile?.role) {
        router.replace(getRoleMeta(profile.role as Role).dashboard);
      } else {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Change password error:', error);
      toast.error('An error occurred');
      setLoading(false);
    }
  };

  const meetsLength = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-[45%] flex flex-col bg-white">
        {/* Logo Header */}
        <div className="p-8 flex items-center justify-between gap-4">
          <Link href="/landing" className="flex items-center gap-2.5 group">
            <BrandLogo markHeight={36} textHeight={18} />
          </Link>
          <Link
            href={dashboardHref}
            className={cn('inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors', t.hoverText)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-8 lg:px-16">
          <div className="w-full max-w-md">
            {/* Header Icon */}
            <div className="mb-6">
              <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', t.solid)}>
                <Lock className="w-7 h-7 text-white" />
              </div>
            </div>

            {/* Welcome Text */}
            <div className="mb-10">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-3">Set new password</h1>
              <p className="text-slate-500">Create a secure password for your account. This is required for first-time login.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleChangePassword} className="space-y-6">
              {/* New Password */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-2">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={8}
                    className={cn('w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all disabled:opacity-50', t.focusBorder, t.focusRing)}
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" aria-hidden />
                    ) : (
                      <Eye className="w-5 h-5" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  minLength={8}
                  className={cn('w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all disabled:opacity-50', t.focusBorder, t.focusRing)}
                  placeholder="Re-enter password"
                />
              </div>

              {/* Password Requirements */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-3">Password requirements</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', meetsLength ? t.lightBg : 'bg-slate-200')}>
                      <Check className={cn('w-3.5 h-3.5', meetsLength ? t.text : 'text-slate-400')} aria-hidden />
                    </div>
                    <span className={meetsLength ? t.text : 'text-slate-500'}>At least 8 characters</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', passwordsMatch ? t.lightBg : 'bg-slate-200')}>
                      <Check className={cn('w-3.5 h-3.5', passwordsMatch ? t.text : 'text-slate-400')} aria-hidden />
                    </div>
                    <span className={passwordsMatch ? t.text : 'text-slate-500'}>Passwords match</span>
                  </li>
                </ul>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !meetsLength || !passwordsMatch}
                className={cn('w-full py-3.5 text-white font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2', t.solid, t.solidHover, t.buttonRing)}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" aria-hidden />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Set password</span>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-slate-400">
                Your password is encrypted with 256-bit encryption
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 text-center">
          <p className="text-xs text-slate-400">
            &copy; 2026 AI4Neuro. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className={cn("hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br", t.panelGradient)}>
        {/* Background Grid */}
        <div className="absolute inset-0">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(128, 98, 87, 0.08)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-16">
          {/* Shield Visualization */}
          <div className="relative mb-12">
            <div className={cn("w-40 h-40 rounded-3xl bg-white border shadow-lg flex items-center justify-center", t.lightBorder)}>
              <ShieldCheck className={cn("w-20 h-20", t.text)} strokeWidth={1.2} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={cn("w-48 h-48 border-2 rounded-full animate-ping", t.ringBorder)}></div>
            </div>
          </div>

          {/* Text Content */}
          <div className="text-center max-w-lg">
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">
              Secure Your
              <span className={cn("block", t.text)}>Account</span>
            </h2>
            <p className="text-slate-500 text-lg mb-8">
              Your security is our priority. Strong passwords protect patient data.
            </p>

            {/* Security Features */}
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-white border border-slate-200 rounded-xl flex items-center justify-center">
                  <Lock className={cn("w-6 h-6", t.text)} />
                </div>
                <div className="text-xs text-slate-500">Encrypted</div>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-white border border-slate-200 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className={cn("w-6 h-6", t.text)} />
                </div>
                <div className="text-xs text-slate-500">Verified</div>
              </div>
            </div>
          </div>

          {/* Bottom Badge */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", t.dot)}></div>
              <span className="text-sm text-slate-500">256-bit Encryption</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
