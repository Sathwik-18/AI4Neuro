'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Settings,
  User,
  X,
  type AppIcon,
} from '@/components/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ============================================================================
// Named icon helper (legacy Material Symbol names, rendered with Phosphor)
// ============================================================================
const NAMED_ICONS: Record<string, AppIcon> = {
  arrow_back: ArrowLeft,
  check_circle: CheckCircle,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  error: AlertCircle,
  expand_more: ChevronDown,
  key: KeyRound,
  lock: Lock,
  logout: LogOut,
  menu: Menu,
  notifications: Bell,
  pending: Clock,
  person: User,
  progress_activity: Loader2,
  settings: Settings,
};

export function MaterialIcon({
  name,
  className,
  size = 20,
  filled = false,
}: {
  name: string;
  className?: string;
  size?: number;
  filled?: boolean;
}) {
  const Icon = NAMED_ICONS[name] ?? Info;
  return <Icon size={size} weight={filled ? 'fill' : 'regular'} className={cn('shrink-0', className)} aria-hidden />;
}

// ============================================================================
// ACCENT TOKENS — single teal accent, kept for API compat
// ============================================================================
export type Accent = 'green' | 'indigo' | 'blue' | 'teal';

export const ACCENT_STYLES: Record<
  Accent,
  { solid: string; soft: string; text: string; ring: string }
> = {
  green: {
    solid: 'bg-blue-600',
    soft: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-200',
  },
  indigo: {
    solid: 'bg-blue-600',
    soft: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-200',
  },
  blue: {
    solid: 'bg-blue-600',
    soft: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-200',
  },
  teal: {
    solid: 'bg-blue-600',
    soft: 'bg-blue-50',
    text: 'text-blue-600',
    ring: 'ring-blue-200',
  },
};

export const ACCENT_HEX: Record<Accent, string> = {
  green: 'var(--primary)',
  indigo: 'var(--primary)',
  blue: 'var(--primary)',
  teal: 'var(--primary)',
};

export const NEUTRAL_CHART_HEX = 'var(--color-blue-300)';

// ============================================================================
// BRAIN WAVE LOADER
// ============================================================================
export function BrainWaveLoader({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <svg width="120" height="40" viewBox="0 0 120 40" className="text-blue-500">
        <path
          d="M0 20 Q5 20,10 20 T20 20 T30 20 T40 20 T50 20 T60 20 T70 20 T80 20 T90 20 T100 20 T110 20 T120 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="animate-eeg-trace"
        />
        <path
          d="M0 20 L10 20 L12 8 L14 32 L16 12 L18 28 L20 20 L40 20 L42 10 L44 30 L46 14 L48 26 L50 20 L70 20 L72 6 L74 34 L76 10 L78 30 L80 20 L100 20 L102 12 L104 28 L106 16 L108 24 L110 20 L120 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
          className="animate-eeg-trace"
          style={{ animationDelay: '0.3s' }}
        />
      </svg>
    </div>
  );
}

// ============================================================================
// SECTION CARD — flat, minimal
// ============================================================================
export function SectionCard({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(49,36,31,0.04)]',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// STAT CARD — flat, no gradients, no count-up animation
// ============================================================================
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent = 'teal',
  isLoading = false,
  onClick,
  href,
  size = 'default',
  trendText,
  isMain = false,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ElementType;
  accent?: Accent;
  isLoading?: boolean;
  onClick?: () => void;
  href?: string;
  size?: 'default' | 'lg';
  trendText?: string;
  isMain?: boolean;
}) {
  const content = (
    <div className="flex items-start justify-between gap-3 h-full min-h-[96px]">
      <div className="min-w-0 flex flex-col h-full">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
        {isLoading ? (
          <BrainWaveLoader className="py-2" />
        ) : (
          <p className={cn(
            'font-display leading-none tracking-tight text-slate-900 mt-2.5 tabular-nums',
            size === 'lg' || isMain ? 'text-[40px]' : 'text-[34px]'
          )}>
            {value}
          </p>
        )}
        {(trendText || sublabel) && (
          <p className={cn('text-xs mt-auto pt-2', trendText ? 'font-medium text-emerald-700' : 'text-slate-500')}>
            {trendText ?? sublabel}
          </p>
        )}
      </div>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Icon className="h-[18px] w-[18px]" />
      </span>
    </div>
  );

  const wrapperClass = 'p-4 h-full transition-colors';
  const interactiveClass = 'hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

  if (href) {
    return (
      <SectionCard className="p-0 overflow-hidden">
        <Link href={href} className={cn("block", wrapperClass, interactiveClass)}>
          {content}
        </Link>
      </SectionCard>
    );
  }

  if (onClick) {
    return (
      <SectionCard className="p-0 overflow-hidden">
        <button type="button" onClick={onClick} className={cn("block w-full text-left", wrapperClass, interactiveClass)}>
          {content}
        </button>
      </SectionCard>
    );
  }

  return (
    <SectionCard className="p-0 overflow-hidden">
      <div className={wrapperClass}>{content}</div>
    </SectionCard>
  );
}

// ============================================================================
// STATUS BADGE — flat text, no pill bg
// ============================================================================
const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-600',
  reviewed: 'text-blue-600',
  ready: 'text-emerald-600',
  processing: 'text-amber-600',
  queued: 'text-amber-600',
  uploaded: 'text-orange-600',
  pending: 'text-amber-600',
  failed: 'text-red-600',
  active: 'text-emerald-600',
  suspended: 'text-red-600',
  inactive: 'text-slate-500',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status?.toLowerCase()] || 'text-slate-500';
  return (
    <span className={cn('text-xs font-medium capitalize', cls)}>
      {status}
    </span>
  );
}

// ============================================================================
// QUICK ACTIONS — flat list
// ============================================================================
export function QuickActionsList({
  title = 'Quick actions',
  actions,
  layout = 'stack',
}: {
  title?: string;
  accent?: Accent;
  /** `row` spreads actions across the card (full-width dashboards). */
  layout?: 'stack' | 'row';
  actions: { label: string; onClick?: () => void; href?: string; icon?: AppIcon; hint?: string }[];
}) {
  const itemClass =
    'group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
  const body = (action: (typeof actions)[number]) => {
    const Icon = action.icon ?? ArrowUpRight;
    return (
      <>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900 truncate">{action.label}</span>
          {action.hint && <span className="block text-xs text-slate-500 truncate">{action.hint}</span>}
        </span>
        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
      </>
    );
  };
  return (
    <SectionCard className="p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">{title}</h3>
      <div className={cn('grid gap-2', layout === 'row' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'grid-cols-1')}>
        {actions.map((action, i) =>
          action.href ? (
            <Link key={i} href={action.href} className={itemClass}>
              {body(action)}
            </Link>
          ) : (
            <button key={i} type="button" onClick={action.onClick} className={itemClass}>
              {body(action)}
            </button>
          )
        )}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// ALERT LIST
// ============================================================================
export type AlertTone = 'info' | 'warning' | 'purple';

export function AlertList({
  title = 'Alerts',
  alerts,
}: {
  title?: string;
  alerts: { icon: React.ElementType; tone: AlertTone; heading: string; body: string }[];
}) {
  const toneStyles: Record<AlertTone, string> = {
    info: 'border-l-blue-500 bg-blue-50/50 text-blue-700',
    warning: 'border-l-amber-500 bg-amber-50/50 text-amber-800',
    purple: 'border-l-blue-500 bg-blue-50/50 text-blue-700',
  };
  return (
    <SectionCard className="p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{title}</h3>
      <div className="space-y-2">
        {alerts.map((a, i) => {
          const AlertIcon = a.icon;
          return (
            <div key={i} className={cn('rounded-md border-l-2 p-3', toneStyles[a.tone])}>
              <div className="flex gap-2">
                <AlertIcon className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{a.heading}</p>
                  <p className="text-xs opacity-80 mt-0.5">{a.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// MINI BAR CHART — flat, no gradient fills
// ============================================================================
export function MiniBarChart({
  data,
  dataKey = 'value',
  color = ACCENT_HEX.teal,
  isLoading = false,
}: {
  data: { name: string; value: number }[];
  dataKey?: string;
  color?: string;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <BrainWaveLoader />;
  }

  const summary = `Bar chart: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`;

  return (
    <div role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={20} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 500 }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 10, fontWeight: 500 }}
            dx={-8}
          />
          <Tooltip
            cursor={{ fill: 'color-mix(in oklab, var(--muted) 50%, transparent)', radius: 4 }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-slate-800 px-3 py-2 rounded-md shadow-md text-white text-xs">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wide">{label}</p>
                    <p className="font-semibold mt-0.5">{(payload[0].value as number).toLocaleString()}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// DONUT STAT — kept for backward compat, simplified
// ============================================================================
export function DonutStat({
  centerLabel = 'AI',
  segments,
  isLoading = false,
}: {
  centerLabel?: string;
  segments: { name: string; value: number; color: string }[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <BrainWaveLoader />;
  }
  const summary = `Donut chart: ${segments.map((s) => `${s.name} ${s.value}`).join(', ')}`;
  return (
    <div className="relative flex items-center justify-center" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            isAnimationActive={false}
            data={segments}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={78}
            paddingAngle={2}
            stroke="none"
          >
            {segments.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-lg font-semibold text-slate-700">{centerLabel}</span>
      </div>
    </div>
  );
}

export function DonutLegend({
  segments,
}: {
  segments: { name: string; value: string | number; color: string }[];
}) {
  return (
    <div className="space-y-1.5 mt-3">
      {segments.map((s, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-500">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
          <span className="font-semibold text-slate-700">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PAGE HEADER — simple greeting, no hero block
// ============================================================================
export interface TimelineStep {
  label: string;
  href?: string;
  active?: boolean;
}

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  accent = 'teal',
  timelineSteps,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accent?: Accent;
  timelineSteps?: TimelineStep[];
}) {
  return (
    <div className="pb-1">
      {timelineSteps && timelineSteps.length > 0 ? (
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider mb-2 flex-wrap text-slate-400">
          {timelineSteps.map((step, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-300">&rarr;</span>}
              {step.active ? (
                <span className="text-blue-700 font-semibold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  {step.label}
                </span>
              ) : step.href ? (
                <Link href={step.href} className="text-blue-600 hover:underline">
                  {step.label}
                </Link>
              ) : (
                <span>{step.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {eyebrow}
        </span>
      )}
      <h1 className="font-display text-[34px] md:text-[40px] leading-[1.05] font-normal text-slate-950 tracking-[-0.01em] mt-1">{title}</h1>
      <p className="text-sm text-slate-600 mt-2 max-w-2xl">{description}</p>
    </div>
  );
}

// ============================================================================
// FADE IN
// ============================================================================
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('animate-fade-in', className)}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// PAGINATION
// ============================================================================
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  const pages: (number | string)[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-sm text-slate-500">
        Showing {from}-{to} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          aria-label="Previous page"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <MaterialIcon name="chevron_left" size={18} />
        </button>
        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={`dots-${i}`} className="px-1 text-slate-400 text-sm">
              ...
            </span>
          ) : (
            <button
              key={p}
              aria-label={`Page ${p}`}
              aria-current={p === currentPage ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={cn(
                'h-8 w-8 rounded-md text-xs font-medium transition-colors',
                p === currentPage ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          aria-label="Next page"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <MaterialIcon name="chevron_right" size={18} />
        </button>
      </div>
    </div>
  );
}

export function usePaginatedList<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  return {
    page: safePage,
    setPage,
    totalPages,
    paginated,
    resetPage: () => setPage(1),
  };
}
