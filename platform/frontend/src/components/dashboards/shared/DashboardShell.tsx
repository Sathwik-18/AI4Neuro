'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { MaterialIcon, type Accent } from './primitives';
import { NotificationBell, ProfileMenu } from './TopbarWidgets';

function isNavActive(href: string, pathname: string, search: string): boolean {
  const [base, query] = href.split('?');
  const pathMatches = base === pathname || (base !== '/' && pathname.startsWith(`${base}/`));
  if (!pathMatches) return false;
  if (!query) return true;
  const hrefParams = new URLSearchParams(query);
  const currentParams = new URLSearchParams(search);
  for (const [key, value] of hrefParams) {
    if (currentParams.get(key) !== value) return false;
  }
  return true;
}

function NavLinks({
  navItems,
  pathname,
  collapsed,
  onNavigate,
}: {
  navItems: NavItem[];
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const search = useSearchParams().toString();
  return (
    <>
      {navItems.map((item) => {
        const active = isNavActive(item.href, pathname, search);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
              active
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-white' : 'text-slate-400')} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </>
  );
}

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface DashboardShellProps {
  roleLabel: string;
  accent: Accent;
  navItems: NavItem[];
  children: React.ReactNode;
}

export function DashboardShell({ roleLabel, accent, navItems, children }: DashboardShellProps) {
  const { userProfile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const canCreate = userProfile?.role !== 'patient';

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        {collapsed ? (
          <img
            src="/landing_homepage/AI4NEuroLOGO copy.png"
            alt="AI4Neuro Logo"
            className="h-7 w-auto object-contain"
          />
        ) : (
          <BrandLogo markHeight={28} textHeight={14} />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <Suspense fallback={null}>
          <NavLinks
            navItems={navItems}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={() => setMobileOpen(false)}
          />
        </Suspense>
      </nav>

      {/* Services */}
      {!collapsed && (
        <div className="px-3 py-3 mt-auto border-t border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">
            Pipelines
          </p>
          <div className="space-y-1">
            {canCreate ? (
              <Link
                href="/analysis/new?modality=mri"
                className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors group"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2 C6.5 2 4 5.5 4 10 C4 14.5 6.5 18 10 18 C13.5 18 16 14.5 16 10 C16 5.5 13.5 2 10 2Z" />
                  <path d="M7 4.5 Q10 7 10 10 Q10 13 7 15.5" />
                  <path d="M13 4.5 Q10 7 10 10 Q10 13 13 15.5" />
                  <line x1="4" y1="10" x2="16" y2="10" />
                </svg>
                <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900">MRI</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-md">
                <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2 C6.5 2 4 5.5 4 10 C4 14.5 6.5 18 10 18 C13.5 18 16 14.5 16 10 C16 5.5 13.5 2 10 2Z" />
                  <path d="M7 4.5 Q10 7 10 10 Q10 13 7 15.5" />
                  <path d="M13 4.5 Q10 7 10 10 Q10 13 13 15.5" />
                  <line x1="4" y1="10" x2="16" y2="10" />
                </svg>
                <span className="text-xs font-medium text-slate-600">MRI</span>
              </div>
            )}

            {canCreate ? (
              <Link
                href="/analysis/new?modality=eeg"
                className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors group"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 10 L4 10 L5.5 4 L7 16 L8.5 7 L10 13 L11.5 3 L13 14 L14.5 8 L16 10 L19 10" />
                </svg>
                <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900">EEG</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-md">
                <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 10 L4 10 L5.5 4 L7 16 L8.5 7 L10 13 L11.5 3 L13 14 L14.5 8 L16 10 L19 10" />
                </svg>
                <span className="text-xs font-medium text-slate-600">EEG</span>
              </div>
            )}

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-md opacity-40">
              <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="7" r="2" />
                <circle cx="13" cy="7" r="2" />
                <circle cx="10" cy="13" r="2" />
                <line x1="8.5" y1="8.5" x2="10" y2="11" />
                <line x1="11.5" y1="8.5" x2="10" y2="11" />
              </svg>
              <span className="text-xs font-medium text-slate-400 flex-1">PET</span>
              <MaterialIcon name="lock" size={12} className="text-slate-300" />
            </div>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-3">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <MaterialIcon name="logout" size={18} />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50/80 flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-slate-200 bg-white sticky top-0 h-screen transition-all duration-200',
          collapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 shadow-sm"
        >
          <MaterialIcon name={collapsed ? 'chevron_right' : 'chevron_left'} size={14} />
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-white flex flex-col overflow-y-auto">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 text-slate-400 hover:text-slate-600"
            >
              <MaterialIcon name="close" size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-slate-100 px-4 md:px-6 h-14 flex items-center gap-3">
          <button
            className="md:hidden text-slate-500"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <MaterialIcon name="menu" size={22} />
          </button>

          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <MaterialIcon name="arrow_back" size={18} />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden lg:inline text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              {roleLabel}
            </span>
            <NotificationBell accent={accent} />
            <ProfileMenu accent={accent} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-6 py-6 space-y-5">{children}</main>
      </div>
    </div>
  );
}
