'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { analysisApi } from '@/features/analysis/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import { cn } from '@/lib/utils';
import { MaterialIcon, BrainWaveLoader, type Accent } from './primitives';

const LAST_SEEN_KEY = 'ai4neuro:notifications:last-seen';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-emerald-600';
    case 'failed':
    case 'cancelled': return 'text-red-600';
    default: return 'text-amber-600';
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case 'completed': return 'check_circle';
    case 'failed':
    case 'cancelled': return 'error';
    default: return 'pending';
  }
}

export function NotificationBell({ accent }: { accent: Accent }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionStatusResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_SEEN_KEY) : null;
    setLastSeen(raw ? Number(raw) : 0);
  }, []);

  const load = useCallback(async () => {
    setLoading((prev) => (loadedRef.current ? prev : true));
    try {
      const rows = await analysisApi.list({ limit: 8 });
      setSessions(rows);
    } catch {
      if (!loadedRef.current) setSessions([]);
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = sessions.filter((s) => {
    const t = new Date(s.updated_at || s.created_at || 0).getTime();
    return !Number.isNaN(t) && t > lastSeen;
  }).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      load();
      const now = Date.now();
      setLastSeen(now);
      if (typeof window !== 'undefined') window.localStorage.setItem(LAST_SEEN_KEY, String(now));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <MaterialIcon name="notifications" size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg bg-white border border-slate-200 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">Activity</span>
            <span className="text-xs text-slate-400">Recent analyses</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading && sessions.length === 0 ? (
              <BrainWaveLoader />
            ) : sessions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No recent activity
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/analysis/${s.id}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0 transition-colors"
                >
                  <MaterialIcon
                    name={statusIcon(s.status)}
                    size={18}
                    className={statusColor(s.status)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 truncate">
                      <span className="uppercase font-medium">{s.modality}</span>{' '}
                      <span className={cn('capitalize', statusColor(s.status))}>{s.status}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">{timeAgo(s.updated_at || s.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function ProfileMenu({ accent }: { accent: Accent }) {
  const { user, userProfile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = userProfile?.full_name || user?.email || 'User';
  const initials = getInitials(displayName);
  const avatarUrl = userProfile?.avatar_url || (userProfile as any)?.avatar_url;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-slate-50 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-semibold shrink-0 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="hidden sm:flex flex-col leading-none">
          <span className="text-[13px] font-medium text-slate-700 max-w-[140px] truncate">
            {displayName}
          </span>
          <span className="text-[10px] text-slate-400 capitalize">
            {userProfile?.role?.replace(/_/g, ' ') || 'User'}
          </span>
        </div>
        <MaterialIcon name="expand_more" size={16} className="text-slate-300 hidden sm:inline" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-56 rounded-lg bg-white border border-slate-200 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{user?.email || ''}</p>
          </div>
          <div className="py-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <MaterialIcon name="person" size={17} className="text-slate-400" />
              Profile
            </Link>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <MaterialIcon name="settings" size={17} className="text-slate-400" />
              Settings
            </Link>
            <Link
              href="/change-password"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <MaterialIcon name="key" size={17} className="text-slate-400" />
              Change password
            </Link>
          </div>
          <div className="py-1 border-t border-slate-100">
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
            >
              <MaterialIcon name="logout" size={17} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
