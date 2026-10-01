'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Brain, ChevronRight, Eye, FileText, Folder, LayoutGrid, List, Loader2, Search, Waves, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/roles';
import { analysisApi, type ListSort } from '@/features/analysis/api';
import {
  DIAGNOSIS_META,
  PRIORITY_META,
  type Diagnosis,
  type Modality,
  type ReviewPriority,
  type SessionListItem,
} from '@/features/analysis/types';
import { DashboardPageHeader } from '@/components/dashboards/shared/primitives';
import { FilterSelect } from '@/features/analytics/AnalyticsView';
import { DURATION_OPTIONS, dateFromForDuration, viewerPathFor } from '@/features/analytics/shared';

const PAGE_SIZE = 24;

const MODALITY_FOLDERS: { key: Modality; label: string; hint: string; icon: React.ElementType }[] = [
  { key: 'mri', label: 'MRI', hint: 'Structural brain MRI', icon: Brain },
  { key: 'eeg', label: 'EEG', hint: 'Resting-state EEG', icon: Waves },
];
const DIAGNOSES: Diagnosis[] = ['CN', 'MCI', 'AD'];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  ...(['urgent', 'priority', 'routine'] as ReviewPriority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label })),
];
const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'multiclass', label: 'Multiclass' },
  { value: 'binary', label: 'Binary' },
];
const SORT_OPTIONS: { value: ListSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'patient_asc', label: 'Patient A–Z' },
  { value: 'patient_desc', label: 'Patient Z–A' },
  { value: 'confidence_desc', label: 'Highest confidence' },
];

function formatCompleted(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function SeverityBar({ priority }: { priority: ReviewPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <div className="flex gap-1" aria-label={`${meta.label} priority`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={cn('h-1.5 flex-1 rounded-full', n <= meta.level ? meta.bar : 'bg-slate-200')} />
      ))}
    </div>
  );
}

function useOpenReport() {
  const [busy, setBusy] = useState<string | null>(null);
  const open = async (sessionId: string, kind: 'clinician' | 'patient') => {
    // Open synchronously so the tab stays inside the click's user gesture.
    const win = window.open('', '_blank');
    setBusy(`${sessionId}:${kind}`);
    try {
      const { report_urls } = await analysisApi.reports(sessionId);
      const url = kind === 'patient' ? report_urls.patient : report_urls.clinician ?? report_urls.technical;
      if (url && win) {
        win.location.href = url;
      } else {
        win?.close();
        toast.error('This report is not available yet.');
      }
    } catch (err) {
      win?.close();
      toast.error(err instanceof Error ? err.message : 'Failed to load report.');
    } finally {
      setBusy(null);
    }
  };
  return { open, busy };
}

function ReportCard({ item, role, onOpen, busy }: {
  item: SessionListItem;
  role: Role;
  onOpen: (id: string, kind: 'clinician' | 'patient') => void;
  busy: string | null;
}) {
  const diagnosis = item.prediction as Diagnosis | null;
  const priority = item.review_priority;
  const isPatient = role === 'patient';
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{item.patient_name || 'Unassigned patient'}</p>
          <p className="text-xs text-slate-500">Completed {formatCompleted(item.created_at)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          {item.modality}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: diagnosis ? DIAGNOSIS_META[diagnosis]?.hex : undefined }}>
            {diagnosis ? DIAGNOSIS_META[diagnosis]?.label ?? diagnosis : 'No result'}
          </p>
          <p className="text-xs text-slate-500">
            {item.analysis_type === 'binary' ? 'Binary' : 'Multiclass'}
            {item.doctor_name ? ` · Dr. ${item.doctor_name}` : ''}
          </p>
        </div>
        {item.confidence != null && (
          <p className="font-mono text-xs text-slate-600 tabular-nums">{Math.round(item.confidence * 100)}% conf.</p>
        )}
      </div>

      {priority && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', PRIORITY_META[priority].badge)}>
              {PRIORITY_META[priority].label}
            </span>
            <span className="text-[11px] text-slate-400">Review priority</span>
          </div>
          <SeverityBar priority={priority} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1 mt-auto">
        {!isPatient && (
          <button
            type="button"
            onClick={() => onOpen(item.id, 'clinician')}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            {busy === `${item.id}:clinician` ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            Clinician report
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpen(item.id, 'patient')}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {busy === `${item.id}:patient` ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
          Patient report
        </button>
        <Link
          href={viewerPathFor(role, item.id)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Eye className="h-3 w-3" /> Open
        </Link>
      </div>
    </article>
  );
}

function FolderTile({ label, hint, count, icon: Icon, onClick, swatch }: {
  label: string;
  hint: string;
  count: number;
  icon: React.ElementType;
  onClick: () => void;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700" style={swatch ? { color: swatch } : undefined}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 truncate">{label}</p>
          <p className="text-xs text-slate-500 truncate">{hint}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        <span className="font-display text-2xl text-slate-900 tabular-nums mr-1">{count}</span>
        report{count === 1 ? '' : 's'}
      </p>
    </button>
  );
}

export function ReportsLibrary({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const modality = (params.get('modality') as Modality | null) ?? null;
  const diagnosis = (params.get('prediction') as Diagnosis | null) ?? null;
  const priority = params.get('priority') ?? 'all';
  const analysisType = params.get('type') ?? 'all';
  const duration = params.get('duration') ?? 'all';
  const sort = (params.get('sort') as ListSort | null) ?? 'newest';
  // Deep links that already narrow the set (e.g. a priority tile) land on the flat list.
  const view = params.get('view') ?? (priority !== 'all' ? 'list' : 'folders');

  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(search);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const setParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === 'all' || v === '') next.delete(k);
      else next.set(k, v);
    }
    setPage(1);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports-library', debounced, priority, analysisType, duration, sort],
    queryFn: () =>
      analysisApi.listAll({
        status: 'completed',
        q: debounced || undefined,
        priority: priority === 'all' ? undefined : priority,
        analysis_type: analysisType === 'all' ? undefined : analysisType,
        date_from: dateFromForDuration(duration),
        sort,
      }),
    staleTime: 30_000,
  });
  const all = useMemo(() => data?.items ?? [], [data]);

  const counts = useMemo(() => {
    const byModality: Record<string, number> = {};
    const byDiagnosis: Record<string, number> = {};
    for (const r of all) {
      byModality[r.modality] = (byModality[r.modality] ?? 0) + 1;
      if (r.modality === modality && r.prediction) byDiagnosis[r.prediction] = (byDiagnosis[r.prediction] ?? 0) + 1;
    }
    return { byModality, byDiagnosis };
  }, [all, modality]);

  const records = useMemo(
    () =>
      all.filter(
        (r) => (!modality || r.modality === modality) && (!diagnosis || r.prediction === diagnosis)
      ),
    [all, modality, diagnosis]
  );

  const filtersActive = priority !== 'all' || analysisType !== 'all' || duration !== 'all' || !!debounced;
  const level = view === 'list' ? 'records' : !modality ? 'modality' : !diagnosis ? 'diagnosis' : 'records';
  const shown = records.slice(0, page * PAGE_SIZE);
  const { open, busy } = useOpenReport();

  const crumbs = [
    { label: 'Reports', onClick: () => setParam({ modality: null, prediction: null }) },
    ...(view !== 'list' && modality
      ? [{ label: modality.toUpperCase(), onClick: () => setParam({ prediction: null }) }]
      : []),
    ...(view !== 'list' && diagnosis ? [{ label: DIAGNOSIS_META[diagnosis]?.label ?? diagnosis, onClick: () => {} }] : []),
  ];

  return (
    <div className="space-y-5">
      <DashboardPageHeader
        eyebrow="Report library"
        title="Reports"
        description="Completed analyses, organised by modality and diagnosis. Filter by review priority, type, and date, or search by patient."
      />

      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
        <label htmlFor="reports-search" className="relative flex-1 min-w-0">
          <span className="sr-only">Search reports</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="reports-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by patient name, doctor, or session ID…"
            className="w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          {role !== 'patient' && (
            <FilterSelect id="reports-priority" label="Review priority" value={priority} onChange={(v) => setParam({ priority: v })} options={PRIORITY_OPTIONS} />
          )}
          <FilterSelect id="reports-type" label="Analysis type" value={analysisType} onChange={(v) => setParam({ type: v })} options={TYPE_OPTIONS} />
          <FilterSelect id="reports-duration" label="Duration" value={duration} onChange={(v) => setParam({ duration: v })} options={DURATION_OPTIONS} />
          <FilterSelect id="reports-sort" label="Sort" value={sort} onChange={(v) => setParam({ sort: v === 'newest' ? null : v })} options={SORT_OPTIONS} />
          <div className="inline-flex rounded-full border border-slate-200 p-0.5" role="group" aria-label="View">
            {[
              { v: 'folders', icon: LayoutGrid, label: 'Folders' },
              { v: 'list', icon: List, label: 'All reports' },
            ].map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setParam({ view: v === 'folders' && priority === 'all' ? null : v })}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                  view === v ? 'bg-primary text-primary-foreground' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setParam({ priority: null, type: null, duration: null, sort: null });
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
              {i < crumbs.length - 1 ? (
                <button type="button" onClick={c.onClick} className="font-medium text-primary hover:underline">
                  {c.label}
                </button>
              ) : (
                <span className="font-semibold text-slate-900">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <p className="text-xs text-slate-500">
          {isLoading ? 'Loading…' : `${records.length} report${records.length === 1 ? '' : 's'}`}
          {(data?.total ?? 0) > all.length && ` · showing newest ${all.length} of ${data?.total}`}
        </p>
      </div>

      {isError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Couldn&apos;t load reports. Check that the backend is running, then refresh.
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : level === 'modality' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MODALITY_FOLDERS.map((f) => (
            <FolderTile
              key={f.key}
              label={f.label}
              hint={f.hint}
              icon={f.icon}
              count={counts.byModality[f.key] ?? 0}
              onClick={() => setParam({ modality: f.key })}
            />
          ))}
        </div>
      ) : level === 'diagnosis' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DIAGNOSES.map((d) => (
            <FolderTile
              key={d}
              label={DIAGNOSIS_META[d].label}
              hint={`${modality?.toUpperCase()} · ${d}`}
              icon={Folder}
              swatch={DIAGNOSIS_META[d].hex}
              count={counts.byDiagnosis[d] ?? 0}
              onClick={() => setParam({ prediction: d })}
            />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <FileText className="h-8 w-8 mx-auto text-slate-300" />
          <p className="text-sm font-medium text-slate-700 mt-2">No reports found</p>
          <p className="text-xs text-slate-500 mt-1">Try a longer duration or clear the filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {shown.map((item) => (
              <ReportCard key={item.id} item={item} role={role} onOpen={open} busy={busy} />
            ))}
          </div>
          {shown.length < records.length && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Show more ({records.length - shown.length} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
