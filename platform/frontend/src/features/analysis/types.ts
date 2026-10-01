/**
 * Analysis wire types — mirror the backend DTOs in
 * platform/backend/app/schemas/analysis.py. Both modalities share the same outer
 * shape; modality specifics live inside the jsonb sub-objects.
 */

export type Modality = 'eeg' | 'mri';

export type SessionStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'preprocessing'
  | 'running_model'
  | 'generating_visualizations'
  | 'generating_reports'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const ACTIVE_STATUSES: readonly SessionStatus[] = [
  'queued',
  'uploading',
  'processing',
  'preprocessing',
  'running_model',
  'generating_visualizations',
  'generating_reports',
];

export const TERMINAL_STATUSES: readonly SessionStatus[] = [
  'completed',
  'failed',
  'cancelled',
];

export function isActive(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

export type ReviewPriority = 'routine' | 'priority' | 'urgent';
export type Diagnosis = 'CN' | 'MCI' | 'AD';

/** Triage tiers (backend: app/services/triage.py). A worklist aid, not a diagnosis. */
export const PRIORITY_META: Record<
  ReviewPriority,
  { label: string; action: string; text: string; badge: string; bar: string; level: number }
> = {
  routine: {
    label: 'Routine',
    action: 'Confident normal result. Standard follow-up.',
    text: 'text-emerald-700',
    badge: 'bg-[#E6F4EA] text-[#137333]',
    bar: 'bg-emerald-500',
    level: 1,
  },
  priority: {
    label: 'Priority',
    action: 'MCI or low-confidence result. Review this visit.',
    text: 'text-amber-700',
    badge: 'bg-[#FEF7E0] text-[#B06000]',
    bar: 'bg-amber-500',
    level: 2,
  },
  urgent: {
    label: 'Urgent',
    action: 'Confident Alzheimer’s pattern. Clinician review first.',
    text: 'text-red-700',
    badge: 'bg-[#FCE8E6] text-[#C5221F]',
    bar: 'bg-red-500',
    level: 3,
  },
};

export const DIAGNOSIS_META: Record<Diagnosis, { label: string; hex: string }> = {
  CN: { label: 'Cognitively Normal', hex: '#10B981' },
  MCI: { label: 'Mild Cognitive Impairment', hex: '#F59E0B' },
  AD: { label: 'Alzheimer’s Disease', hex: '#EF4444' },
};

export const MODALITY_HEX: Record<Modality, string> = { mri: '#806257', eeg: '#C7A79B' };

export interface CreateAnalysisResponse {
  session_id: string;
  status: string;
  modality: string;
  analysis_type: string;
}

export interface SessionStatusResponse {
  id: string;
  modality: Modality;
  analysis_type: string;
  patient_id: string | null;
  doctor_id: string | null;
  status: SessionStatus;
  current_stage: string | null;
  progress_percent: number;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** A list row: session + outcome + triage tier + display names. */
export interface SessionListItem extends SessionStatusResponse {
  radiologist_id: string | null;
  patient_name: string | null;
  doctor_name: string | null;
  prediction: string | null;
  confidence: number | null;
  review_priority: ReviewPriority | null;
}

export interface TrendBucket {
  label: string;
  start: string;
  end: string;
  total: number;
  by_prediction: Partial<Record<Diagnosis, number>>;
  by_modality: Partial<Record<Modality, number>>;
}

export type StatsRange = 'today' | 'week' | 'month' | 'quarter' | 'all';
export type TrendSpan = '8w' | '12w' | '6m' | '12m';

export interface AnalysisStats {
  range: StatsRange;
  total: number;
  by_status: Record<string, number>;
  by_modality: Record<Modality, number>;
  by_prediction: Record<Diagnosis, number>;
  by_priority: Record<ReviewPriority, number>;
  by_analysis_type: Record<string, number>;
  trend_grain: 'week' | 'month';
  trend: TrendBucket[];
}

export interface ReportUrls {
  patient?: string | null;
  clinician?: string | null;
  technical?: string | null;
}

export interface ExplainabilityPanel {
  plane?: string | null;
  caption?: string | null;
  observations?: string[];
  affected_url?: string | null;
  reference_url?: string | null;
}

export interface Explainability {
  method?: string | null;
  regions?: string[];
  summary?: string | null;
  panels?: ExplainabilityPanel[];
}

export interface AnalysisResultResponse {
  session_id: string;
  modality: Modality;
  analysis_type: string;
  prediction: string;
  confidence: number | null;
  probabilities: Record<string, number>;
  metrics: Record<string, unknown>;
  similarity: Record<string, unknown>;
  consistency: Record<string, unknown>;
  visualizations: Record<string, unknown>;
  model_version: string | null;
  report_urls: ReportUrls;
}

export interface ReportsResponse {
  session_id: string;
  report_urls: ReportUrls;
  asset_urls: Record<string, unknown>;
}

export interface RetryResponse {
  session_id: string;
  status: string;
  retry_count: number;
}

export interface CancelResponse {
  session_id: string;
  status: string;
}

/** Options offered per modality on the upload form. */
export const ANALYSIS_TYPES: Record<Modality, { value: string; label: string }[]> = {
  // The backend runs every EEG request as multiclass (binary checkpoint retired).
  eeg: [
    { value: 'multiclass', label: 'Multiclass (CN / MCI / AD)' },
  ],
  mri: [
    { value: 'multiclass', label: 'Multiclass (CN / MCI / AD)' },
    { value: 'binary', label: 'Binary (CN vs AD)' },
  ],
};

export const ACCEPTED_EXTENSIONS: Record<Modality, string> = {
  eeg: '.npy',
  mri: '.nii,.nii.gz,.gz',
};
