'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  Clock,
  Upload,
  CalendarDays,
  Stethoscope,
  Mail,
  Phone,
  Brain,
  Waves,
  ScanLine,
  FileText,
} from '@/components/icons';

import { useAuth } from '@/components/providers/AuthProvider';
import { analysisApi } from '@/features/analysis/api';
import { useAnalysisList } from '@/features/analysis/hooks';
import { useMyPatients, usePatients } from '@/features/admin/queries';
import { isActive, type SessionStatusResponse } from '@/features/analysis/types';
import { getRoleMeta, type Role } from '@/lib/navigation';
import {
  SectionCard,
  StatCard,
  QuickActionsList,
  DashboardPageHeader,
} from '@/components/dashboards/shared/primitives';
import { SessionsTable } from '@/components/dashboards/shared/SessionsTable';
import { DashboardAnalytics } from '@/features/analytics/AnalyticsView';
import { reportsPathFor } from '@/features/analytics/shared';
import { ActivityCalendar } from '@/components/dashboards/shared/ActivityCalendar';
import { PatientReportModal, type PatientReportData } from '@/components/shared/PatientReportModal';
import { toast } from 'sonner';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const ROLE_COPY: Record<Role, { eyebrow: string; title: string; description: string }> = {
  super_admin: {
    eyebrow: 'Super Admin',
    title: 'Analysis Overview',
    description: 'EEG and MRI analysis activity across every hospital.',
  },
  admin: {
    eyebrow: 'Hospital Admin',
    title: 'Hospital Analyses',
    description: 'Monitor EEG and MRI analysis activity across your hospital.',
  },
  radiologist: {
    eyebrow: 'Radiologist',
    title: 'Radiologist Dashboard',
    description: 'Upload scans, review AI output, and track imaging analyses.',
  },
  doctor: {
    eyebrow: 'Doctor',
    title: 'Doctor Dashboard',
    description: 'Review assigned patient analyses, reports, and modality findings.',
  },
  patient: {
    eyebrow: 'Patient',
    title: 'My Analyses',
    description: 'View completed analysis reports shared by your care team.',
  },
};

/**
 * Role dashboard body backed by the unified backend analysis API. Shares the
 * same primitives (StatCard / DonutStat / MiniBarChart / SectionCard) as the
 * Super Admin and Hospital Admin dashboards so every role reads as one product.
 */
export function AnalysisDashboard() {
  const { userProfile } = useAuth();
  const role = (userProfile?.role ?? 'patient') as Role;
  const meta = getRoleMeta(role);
  const copy = ROLE_COPY[role] ?? ROLE_COPY.patient;
  const canCreate = role !== 'patient';
  // Each role's real "all sessions" list page — distinct from /analysis/new,
  // which only starts a fresh analysis and has nothing to do with viewing
  // existing ones.
  const ALL_ANALYSES_HREF: Partial<Record<Role, string>> = {
    admin: '/admin/sessions',
    doctor: '/doctor/sessions',
    radiologist: '/radiologist/sessions',
  };
  const allAnalysesHref = ALL_ANALYSES_HREF[role] ?? '/search';

  // Patient-only: assigned doctor's contact details, resolved server-side by
  // GET /users/me (roleProfile.assigned_doctor_*) — there is no messaging
  // feature yet, so this is the simplest way for a patient to reach their doctor.
  const doctorContact =
    role === 'patient'
      ? (userProfile?.roleProfile as { assigned_doctor_name?: string; assigned_doctor_email?: string; assigned_doctor_phone?: string } | undefined)
      : undefined;

  const {
    data: sessions,
    error: sessionsError,
  } = useAnalysisList({ limit: 100 });
  const error = sessionsError instanceof Error ? sessionsError.message : null;
  const [showCalendar, setShowCalendar] = useState(false);

  // Best-effort patient-name lookup for the Recent Analyses table. The patient
  // role only sees their own analyses (no patient column), so skip the fetch;
  // doctors use their assigned-patients endpoint, other staff the hospital
  // directory. Any permission/network failure just falls back to a placeholder.
  const { data: myPatientsPage } = useMyPatients({ limit: 200 }, { enabled: role === 'doctor' });
  const { data: patientsPage } = usePatients(
    { limit: 200 },
    { enabled: role !== 'patient' && role !== 'doctor' }
  );
  const patientNameById = useMemo(() => {
    if (role === 'patient') return {};
    const page = role === 'doctor' ? myPatientsPage : patientsPage;
    return Object.fromEntries((page?.items ?? []).map((p) => [p.id, p.full_name]));
  }, [role, myPatientsPage, patientsPage]);
  // Patient-only: the simple, plain-language report modal (opened from the
  // Recent Analyses "View Report" button instead of the technical PDF).
  const [patientReport, setPatientReport] = useState<PatientReportData | null>(null);

  const openPatientReport = React.useCallback(
    async (session: SessionStatusResponse) => {
      const rp = (userProfile?.roleProfile ?? {}) as unknown as Record<string, unknown>;
      const sessionCode = `${session.modality.toUpperCase()}-${session.id.slice(0, 8)}`;
      // Base report from what we already have; enrich with the AI result.
      const base: PatientReportData = {
        sessionCode,
        modality: session.modality,
        analysisType: session.analysis_type,
        scanDate: session.created_at,
        status: session.status,
        patientName: userProfile?.full_name ?? null,
        patientCode: (rp.patient_code as string) ?? (rp.patient_id as string) ?? null,
        dateOfBirth: (rp.date_of_birth as string) ?? null,
        bloodGroup: (rp.blood_type as string) ?? ((rp.blood_groups as { blood_group?: string })?.blood_group ?? null),
        doctorName: (rp.assigned_doctor_name as string) ?? null,
        hospitalName: (rp.hospitals as { name?: string })?.name ?? null,
      };
      setPatientReport(base);
      if (session.status === 'completed') {
        try {
          const res = await analysisApi.result(session.id);
          setPatientReport({
            ...base,
            prediction: res.prediction,
            confidence: res.confidence,
            explainability:
              (res.visualizations?.explainability as PatientReportData['explainability']) ?? null,
            reportPdfUrl:
              res.report_urls?.patient ?? res.report_urls?.clinician ?? res.report_urls?.technical ?? null,
          });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not load your result.');
        }
      }
    },
    [userProfile]
  );

  const stats = useMemo(() => {
    const all = sessions ?? [];
    const total = all.length;
    const inProgress = all.filter((s) => isActive(s.status)).length;
    const completed = all.filter((s) => s.status === 'completed').length;
    const failed = all.filter((s) => s.status === 'failed' || s.status === 'cancelled').length;
    const mri = all.filter((s) => s.modality === 'mri').length;
    const eeg = all.filter((s) => s.modality === 'eeg').length;

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const completedThisWeek = all.filter(
      (s) => s.status === 'completed' && new Date(s.updated_at || s.created_at || 0) >= startOfWeek
    ).length;

    return { total, inProgress, completed, failed, mri, eeg, completedThisWeek };
  }, [sessions]);

  const recent = useMemo(
    () =>
      [...(sessions ?? [])]
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
        .slice(0, 8),
    [sessions]
  );

  const loading = sessions === undefined && !error;

  return (
    <>
      <DashboardPageHeader
        eyebrow={`${copy.eyebrow} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`}
        title={copy.title}
        description={`${greeting()}, ${userProfile?.full_name ?? 'there'}. ${copy.description}`}
        accent={meta.accent}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load analyses: {error}
        </div>
      )}

      {/* Patient-only: assigned doctor contact card */}
      {role === 'patient' && doctorContact?.assigned_doctor_name && (
        <SectionCard className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2 rounded-lg bg-slate-100 shrink-0">
              <Stethoscope className="h-4 w-4 text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Your Doctor</p>
              <p className="text-sm font-semibold text-slate-900">
                {/^dr\.?\s/i.test(doctorContact.assigned_doctor_name)
                  ? doctorContact.assigned_doctor_name
                  : `Dr. ${doctorContact.assigned_doctor_name}`}
              </p>
            </div>
            <div className="flex items-center gap-4 ml-auto text-xs text-slate-600">
              {doctorContact.assigned_doctor_email && (
                <a
                  href={`mailto:${doctorContact.assigned_doctor_email}`}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {doctorContact.assigned_doctor_email}
                </a>
              )}
              {doctorContact.assigned_doctor_phone && (
                <a
                  href={`tel:${doctorContact.assigned_doctor_phone}`}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {doctorContact.assigned_doctor_phone}
                </a>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Analyses" value={stats.total} icon={Activity} accent={meta.accent} isLoading={loading} />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} accent={meta.accent} isLoading={loading} />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} accent={meta.accent} isLoading={loading} />
        <StatCard
          label="This Week"
          value={stats.completedThisWeek}
          icon={CalendarDays}
          accent={meta.accent}
          isLoading={loading}
          onClick={() => setShowCalendar(true)}
        />
      </div>

      {canCreate && (
      <QuickActionsList
        accent={meta.accent}
        layout="row"
        actions={
          [
                { label: 'New MRI analysis', hint: 'Upload a T1 NIfTI scan', href: '/analysis/new?modality=mri', icon: Brain },
                { label: 'New EEG analysis', hint: 'Upload a 19-channel .npy', href: '/analysis/new?modality=eeg', icon: Waves },
                { label: 'All analyses', hint: 'Every session you can access', href: allAnalysesHref, icon: ScanLine },
                { label: 'Report library', hint: 'Filter by priority & diagnosis', href: reportsPathFor(role), icon: FileText },
              ]
        }
      />
      )}

      <DashboardAnalytics role={role} />

      {/* Recent analyses */}
      <SectionCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Analyses</h3>
            <p className="text-xs text-slate-500">Sessions available to your role</p>
          </div>
          {!canCreate && (
            <Link href={reportsPathFor(role)} className="text-xs font-medium text-primary hover:underline">
              View my reports &rarr;
            </Link>
          )}
          {canCreate && (
            <Link
              href="/analysis/new"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5" />
              New Analysis
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <SessionsTable
            sessions={recent}
            accent={meta.accent}
            patientNameById={patientNameById}
            showPatientColumn={role !== 'patient'}
            showDeleteAction={role !== 'patient'}
            onViewReport={role === 'patient' ? openPatientReport : undefined}
            emptyLabel={canCreate ? 'No analyses found. Upload a new scan to get started.' : 'Your reports will appear here once available.'}
          />
        )}
      </SectionCard>

      {showCalendar && (
        <ActivityCalendar
          title={`${copy.eyebrow} Activity`}
          timestamps={(sessions ?? []).map((s) => s.created_at)}
          accent={meta.accent}
          onClose={() => setShowCalendar(false)}
        />
      )}

      <PatientReportModal data={patientReport} onClose={() => setPatientReport(null)} />
    </>
  );
}
