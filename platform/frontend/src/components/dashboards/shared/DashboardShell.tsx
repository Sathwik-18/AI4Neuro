'use client';

import { Brain, Radioactive, Waves } from '@/components/icons';
import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { MaterialIcon, type Accent } from './primitives';
import { NotificationBell, ProfileMenu } from './TopbarWidgets';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

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
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors',
              active
                ? 'bg-slate-100 text-slate-950 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon weight={active ? 'fill' : 'regular'} className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-slate-500')} />
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

  const initials = (userProfile?.full_name ?? 'User')
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const pipelines = [
    { key: 'mri', label: 'MRI', Icon: Brain, href: '/analysis/new?modality=mri', live: true },
    { key: 'eeg', label: 'EEG', Icon: Waves, href: '/analysis/new?modality=eeg', live: true },
    { key: 'pet', label: 'PET', Icon: Radioactive, href: '', live: false },
  ];

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn('flex items-center h-16 border-b border-slate-100', collapsed ? 'justify-center px-2' : 'px-5')}>
        {collapsed ? (
          <img src="/landing_homepage/AI4NEuroLOGO copy.png" alt="AI4Neuro" className="h-7 w-auto object-contain" />
        ) : (
          <BrandLogo markHeight={28} textHeight={14} />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <nav aria-label="Main">
          {!collapsed && (
            <p className="px-3 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace</p>
          )}
          <div className="space-y-0.5">
            <Suspense fallback={null}>
              <NavLinks
                navItems={navItems}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={() => setMobileOpen(false)}
              />
            </Suspense>
          </div>
        </nav>

        {!collapsed && (
          <div>
            <p className="px-3 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pipelines</p>
            <div className="space-y-0.5">
              {pipelines.map(({ key, label, Icon, href, live }) => {
                const inner = (
                  <>
                    <Icon className={cn('h-4 w-4 shrink-0', live ? 'text-primary' : 'text-slate-400')} aria-hidden />
                    <span className={cn('text-[13px] font-medium flex-1', live ? 'text-slate-700' : 'text-slate-400')}>{label}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                        live ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {live ? 'Live' : 'Soon'}
                    </span>
                  </>
                );
                return live && canCreate ? (
                  <Link key={key} href={href} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    {inner}
                  </Link>
                ) : (
                  <div key={key} className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Profile + sign out */}
      <div className="border-t border-slate-100 p-3">
        <div className={cn('flex items-center gap-2.5 rounded-lg', collapsed ? 'justify-center' : 'bg-slate-50 px-2.5 py-2')}>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials || 'U'}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-900 truncate">{userProfile?.full_name ?? 'User'}</p>
              <p className="text-[11px] text-slate-500 truncate">{roleLabel}</p>
            </div>
          )}
          <button
            onClick={() => signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-[#FCE8E6] hover:text-[#C5221F] transition-colors"
          >
            <MaterialIcon name="logout" size={17} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-slate-200 bg-white sticky top-0 h-screen transition-all duration-200',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-5 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 shadow-sm"
        >
          <MaterialIcon name={collapsed ? 'chevron_right' : 'chevron_left'} size={14} />
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white flex flex-col overflow-y-auto">
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
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-slate-200/70 px-4 md:px-8 h-16 flex items-center gap-3">
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
            <ThemeToggle />
            <NotificationBell accent={accent} />
            <ProfileMenu accent={accent} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-7 space-y-6">{children}</main>
      </div>
    </div>
  );
}
