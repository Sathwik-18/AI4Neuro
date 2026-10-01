'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, Brain, CheckCircle2, Clock, Layers, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/roles';
import { analysisApi } from '@/features/analysis/api';
import {
  DIAGNOSIS_META,
  MODALITY_HEX,
  PRIORITY_META,
  type ReviewPriority,
  type StatsRange,
  type TrendBucket,
  type TrendSpan,
} from '@/features/analysis/types';
import { DashboardPageHeader } from '@/components/dashboards/shared/primitives';
import { RANGE_OPTIONS, reportsPathFor } from './shared';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}

export function FilterSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  label,
  className,
}: {
  id: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <label htmlFor={id} className={cn('relative inline-flex items-center', className)}>
      <span className="sr-only">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none rounded-full border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-3 text-[10px] text-slate-500">&#9662;</span>
    </label>
  );
}

function Card({ title, action, children, className }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function useStats(key: string, params: Parameters<typeof analysisApi.stats>[0]) {
  return useQuery({
    queryKey: ['analysis-stats', key, params],
    queryFn: () => analysisApi.stats(params),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------- overview

const TIERS: ReviewPriority[] = ['routine', 'priority', 'urgent'];

type Scope = { hospital_id?: string };

function QuickOverviewCard({ role, scope }: { role: Role; scope: Scope }) {
  const router = useRouter();
  const [range, setRange] = useState<StatsRange>('all');
  const { data, isLoading } = useStats('overview', { range, ...scope });

  return (
    <Card
      title="Review priority"
      action={
        <FilterSelect id="overview-range" label="Overview range" value={range} onChange={setRange} options={RANGE_OPTIONS} />
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TIERS.map((tier) => {
          const meta = PRIORITY_META[tier];
          return (
            <button
              key={tier}
              type="button"
              onClick={() => router.push(`${reportsPathFor(role)}?priority=${tier}&duration=${range}`)}
              className="group text-left rounded-lg border border-slate-200 bg-slate-50/60 p-4 hover:bg-slate-100 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', meta.bar)} />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">{meta.label}</span>
              </div>
              <p className={cn('font-display text-4xl mt-2 tabular-nums', meta.text)}>
                {isLoading ? '–' : data?.by_priority[tier] ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-snug">{meta.action}</p>
              <span className="text-[11px] font-medium text-primary mt-2 inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                Open reports &rarr;
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-3">
        Triage aid from model output only (prediction + confidence). Not a diagnosis.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------- trends

const TREND_OPTIONS: { value: TrendSpan; label: string }[] = [
  { value: '8w', label: 'Last 8 weeks' },
  { value: '12w', label: 'Last 12 weeks' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
];

const MODALITY_OPTIONS = [
  { value: 'all', label: 'All modalities' },
  { value: 'mri', label: 'MRI only' },
  { value: 'eeg', label: 'EEG only' },
];

interface Series {
  key: string;
  label: string;
  hex: string;
}

function StackedTrendCard({
  id,
  title,
  subtitle,
  series,
  pick,
  withModalityFilter,
  scope,
}: {
  scope: Scope;
  id: string;
  title: string;
  subtitle: string;
  series: Series[];
  pick: (bucket: TrendBucket, key: string) => number;
  withModalityFilter?: boolean;
}) {
  const [trend, setTrend] = useState<TrendSpan>('8w');
  const [modality, setModality] = useState('all');
  const [selected, setSelected] = useState<number | null>(null);
  const { data, isLoading } = useStats(`trend-${id}`, {
    trend,
    modality: modality === 'all' ? undefined : modality,
    ...scope,
  });

  const rows = useMemo(
    () =>
      (data?.trend ?? []).map((b) => ({
        label: b.label,
        ...Object.fromEntries(series.map((s) => [s.key, pick(b, s.key)])),
      })) as Array<Record<string, number | string>>,
    [data, series, pick]
  );

  const visibleRows = selected !== null && rows[selected] ? [rows[selected]] : rows;
  const totals = series.map((s) => ({
    ...s,
    value: visibleRows.reduce((n, r) => n + Number(r[s.key] ?? 0), 0),
  }));
  const grand = totals.reduce((n, t) => n + t.value, 0);
  const grain = data?.trend_grain === 'month' ? 'monthly' : 'weekly';

  return (
    <Card
      title={title}
      action={
        <div className="flex flex-wrap gap-2 justify-end">
          {withModalityFilter && (
            <FilterSelect id={`${id}-modality`} label="Modality" value={modality} onChange={(v) => { setModality(v); setSelected(null); }} options={MODALITY_OPTIONS} />
          )}
          <FilterSelect id={`${id}-trend`} label="Period" value={trend} onChange={(v) => { setTrend(v); setSelected(null); }} options={TREND_OPTIONS} />
        </div>
      }
    >
      <p className="text-xs text-slate-500 -mt-2 mb-4">
        {subtitle} · {grain} bars
      </p>
      <div className="flex flex-col md:flex-row gap-5">
        <div className="md:w-56 shrink-0">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">
            {selected !== null && rows[selected] ? String(rows[selected].label) : 'Whole period'}
          </p>
          <p className="font-display text-4xl text-slate-900 tabular-nums">{isLoading ? '–' : grand}</p>
          <div className="h-28 my-2">
            {grand > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={totals} dataKey="value" nameKey="label" innerRadius={34} outerRadius={50} paddingAngle={2} stroke="none">
                    {totals.map((t) => (
                      <Cell key={t.key} fill={t.hex} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="space-y-1.5">
            {totals.map((t) => (
              <li key={t.key} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.hex }} />
                <span className="text-slate-700 flex-1 truncate">{t.label}</span>
                <span className="tabular-nums font-semibold text-slate-900">{t.value}</span>
                <span className="tabular-nums text-slate-400 w-9 text-right">
                  {grand ? Math.round((t.value / grand) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
          {selected !== null && (
            <button type="button" onClick={() => setSelected(null)} className="text-xs font-medium text-primary mt-3 hover:underline">
              Show whole period
            </button>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {!isLoading && rows.every((r) => series.every((s) => !Number(r[s.key]))) ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-400">No analyses in this period</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#EDE0DA" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7D6E64' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#7D6E64' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#F0E8E2' }} contentStyle={{ borderRadius: 8, borderColor: '#EDE0DA', fontSize: 12 }} />
                  {series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      stackId="stack"
                      fill={s.hex}
                      radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                      onClick={(_, index) => setSelected(index)}
                      className="cursor-pointer"
                    >
                      {rows.map((_, idx) => (
                        <Cell key={idx} fillOpacity={selected === null || selected === idx ? 1 : 0.35} />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-1">Tap a bar to see that period on its own.</p>
        </div>
      </div>
    </Card>
  );
}

const DIAGNOSIS_SERIES: Series[] = (['CN', 'MCI', 'AD'] as const).map((k) => ({
  key: k,
  label: DIAGNOSIS_META[k].label,
  hex: DIAGNOSIS_META[k].hex,
}));

const MODALITY_SERIES: Series[] = [
  { key: 'mri', label: 'MRI', hex: MODALITY_HEX.mri },
  { key: 'eeg', label: 'EEG', hex: MODALITY_HEX.eeg },
];

const pickDiagnosis = (b: TrendBucket, k: string) => b.by_prediction[k as keyof typeof b.by_prediction] ?? 0;
const pickModality = (b: TrendBucket, k: string) => b.by_modality[k as keyof typeof b.by_modality] ?? 0;

// ---------------------------------------------------------------- page

/** The analytics block embedded in each role's main dashboard. Patients get the
 * trends only: review priority is clinician triage language. */
export function DashboardAnalytics({ role, hospitalId }: { role: Role; hospitalId?: string }) {
  const scope: Scope = hospitalId ? { hospital_id: hospitalId } : {};
  return (
    <div className="space-y-5">
      {role !== 'patient' && <QuickOverviewCard role={role} scope={scope} />}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <StackedTrendCard
          id="diagnosis"
          title="Diagnosis mix"
          subtitle="Completed results by predicted class"
          series={DIAGNOSIS_SERIES}
          pick={pickDiagnosis}
          withModalityFilter
          scope={scope}
        />
        <StackedTrendCard
          id="modality"
          title="Modality mix"
          subtitle="All analyses, MRI vs EEG"
          series={MODALITY_SERIES}
          pick={pickModality}
          scope={scope}
        />
      </div>
    </div>
  );
}
