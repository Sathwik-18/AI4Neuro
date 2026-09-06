/**
 * Analysis Sessions API Service
 *
 * Queries the unified analysis_sessions / analysis_results / analysis_reports
 * tables. The MRISession / MRIPrediction interfaces are kept for backward
 * compat with the rest of the frontend — the transform layer maps unified
 * columns into those shapes.
 */

import { createClient } from '@/lib/supabase/client';
import { clampPageSize } from './index';
import type { ApiResponse, PaginatedResponse, FilterOptions } from './index';

export interface MRISession {
  id: string;
  session_code: string;
  patient_id: string;
  doctor_id: string | null;
  radiologist_id: string | null;
  scan_date: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'reviewed';
  analysis_type: string;
  dicom_file_path: string | null;
  scanner_manufacturer: string | null;
  scanner_model: string | null;
  scanner_field_strength: string | null;
  sequence_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patient?: {
    id: string;
    patient_code: string;
    user_profile?: {
      full_name: string;
    };
  };
  doctor?: {
    id: string;
    user_profile?: {
      full_name: string;
    };
  };
  radiologist?: {
    id: string;
    user_profile?: {
      full_name: string;
    };
  };
  prediction?: MRIPrediction;
}

export interface MRIPrediction {
  id: string;
  session_id: string;
  prediction: 'CN' | 'MCI' | 'AD';
  confidence_score: number;
  probabilities: {
    CN: number;
    MCI: number;
    AD: number;
  };
  brain_volume: number | null;
  gm_volume: number | null;
  wm_volume: number | null;
  csf_volume: number | null;
  hippocampal_volume: number | null;
  ventricular_volume: number | null;
  model_version: string | null;
  processing_time: number | null;
  technical_pdf_url: string | null;
  clinician_pdf_url: string | null;
  patient_pdf_url: string | null;
  similarity_plot_url: string | null;
  volume_chart_url: string | null;
  confidence_chart_url: string | null;
  report_generated_at: string | null;
  created_at: string;
  slice_urls?: {
    axial: string[];
    sagittal: string[];
    coronal: string[];
  } | null;
}

export interface CreateSessionInput {
  patient_id: string;
  doctor_id?: string;
  analysis_type?: string;
  notes?: string;
}

const STATUS_MAP: Record<string, MRISession['status']> = {
  queued: 'uploaded',
  uploading: 'processing',
  processing: 'processing',
  preprocessing: 'processing',
  running_model: 'processing',
  generating_visualizations: 'processing',
  generating_reports: 'processing',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'failed',
};

function mapStatus(raw: string): MRISession['status'] {
  return STATUS_MAP[raw] || (raw as MRISession['status']);
}

function transformResult(raw: any): MRIPrediction | undefined {
  if (!raw) return undefined;
  const r = Array.isArray(raw) ? raw[0] : raw;
  if (!r) return undefined;
  const metrics = r.metrics || {};
  const visualizations = r.visualizations || {};
  const report = Array.isArray(r.report) ? r.report[0] : r.report;
  return {
    id: r.id,
    session_id: r.session_id,
    prediction: r.prediction,
    confidence_score: r.confidence ?? 0,
    probabilities: r.probabilities || { CN: 0, MCI: 0, AD: 0 },
    brain_volume: metrics.brain_volume ?? null,
    gm_volume: metrics.gm_volume ?? null,
    wm_volume: metrics.wm_volume ?? null,
    csf_volume: metrics.csf_volume ?? null,
    hippocampal_volume: metrics.hippocampal_volume ?? null,
    ventricular_volume: metrics.ventricular_volume ?? null,
    model_version: r.model_version,
    processing_time: metrics.processing_time ?? null,
    technical_pdf_url: report?.technical_pdf_url ?? null,
    clinician_pdf_url: report?.clinician_pdf_url ?? null,
    patient_pdf_url: report?.patient_pdf_url ?? null,
    similarity_plot_url: visualizations.similarity_plot_url ?? null,
    volume_chart_url: visualizations.volume_chart_url ?? null,
    confidence_chart_url: visualizations.confidence_chart_url ?? null,
    report_generated_at: report?.asset_urls?.report_generated_at ?? null,
    created_at: r.created_at,
    slice_urls: visualizations.slice_urls ?? null,
  };
}

function transformSession(raw: any): MRISession {
  return {
    ...raw,
    session_code: raw.original_filename || raw.id,
    scan_date: raw.created_at,
    status: mapStatus(raw.status),
    dicom_file_path: raw.raw_file_path || null,
    scanner_manufacturer: null,
    scanner_model: null,
    scanner_field_strength: null,
    sequence_type: null,
    notes: null,
    prediction: transformResult(raw.result),
  };
}

const SESSION_SELECT = `
  *,
  patient:patient_profiles!analysis_sessions_patient_id_fkey(
    user_id,
    patient_id,
    user_profile:user_profiles(full_name)
  ),
  doctor:user_profiles!analysis_sessions_doctor_id_fkey(
    id,
    full_name
  ),
  radiologist:user_profiles!analysis_sessions_radiologist_id_fkey(
    id,
    full_name
  ),
  result:analysis_results(
    *,
    report:analysis_reports(*)
  )
`;

const SESSION_LIST_SELECT = `
  id, modality, analysis_type, patient_id, doctor_id, radiologist_id,
  original_filename, raw_file_path, status, created_at, updated_at,
  patient:patient_profiles!analysis_sessions_patient_id_fkey(
    user_id,
    patient_id,
    user_profile:user_profiles(full_name)
  ),
  result:analysis_results(
    id, session_id, prediction, confidence, probabilities, metrics,
    visualizations, model_version, created_at
  )
`;

function normalizePatient(raw: any): any {
  if (!raw?.patient) return raw;
  const p = Array.isArray(raw.patient) ? raw.patient[0] : raw.patient;
  if (!p) return raw;
  return {
    ...raw,
    patient: {
      id: p.user_id,
      patient_code: p.patient_id || p.user_id,
      user_profile: p.user_profile,
    },
  };
}

function normalizeDoctor(raw: any): any {
  if (!raw?.doctor) return raw;
  const d = Array.isArray(raw.doctor) ? raw.doctor[0] : raw.doctor;
  if (!d) return raw;
  return {
    ...raw,
    doctor: {
      id: d.id,
      user_profile: { full_name: d.full_name },
    },
  };
}

function normalizeRadiologist(raw: any): any {
  if (!raw?.radiologist) return raw;
  const r = Array.isArray(raw.radiologist) ? raw.radiologist[0] : raw.radiologist;
  if (!r) return raw;
  return {
    ...raw,
    radiologist: {
      id: r.id,
      user_profile: { full_name: r.full_name },
    },
  };
}

function normalize(raw: any): MRISession {
  return transformSession(normalizeRadiologist(normalizeDoctor(normalizePatient(raw))));
}

class SessionsApi {
  private supabase = createClient();

  async getSessions(options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<MRISession>>> {
    try {
      const {
        page = 1,
        sortBy = 'created_at',
        sortOrder = 'desc',
        search = '',
        status,
      } = options;
      const pageSize = clampPageSize(options.pageSize);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = this.supabase
        .from('analysis_sessions')
        .select(SESSION_LIST_SELECT, { count: 'exact' })
        .eq('modality', 'mri');

      if (search) {
        const sanitized = search.replace(/[%_(),.]/g, '');
        if (sanitized) {
          query = query.ilike('original_filename', `%${sanitized}%`);
        }
      }

      if (status) {
        const backendStatuses = Object.entries(STATUS_MAP)
          .filter(([, v]) => v === status)
          .map(([k]) => k);
        if (backendStatuses.length > 0) {
          query = query.in('status', backendStatuses);
        }
      }

      query = query
        .order(sortBy === 'scan_date' ? 'created_at' : sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: {
          data: (data || []).map(normalize),
          total: count || 0,
          page,
          pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        status: 500,
      };
    }
  }

  async getSession(id: string): Promise<ApiResponse<MRISession>> {
    try {
      const { data, error } = await this.supabase
        .from('analysis_sessions')
        .select(SESSION_SELECT)
        .eq('id', id)
        .single();

      if (error) throw error;

      return { data: normalize(data), error: null, status: 200 };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch session',
        status: 500,
      };
    }
  }

  async getSessionByCode(sessionCode: string): Promise<ApiResponse<MRISession>> {
    try {
      const { data, error } = await this.supabase
        .from('analysis_sessions')
        .select(SESSION_SELECT)
        .eq('original_filename', sessionCode)
        .single();

      if (error) throw error;

      return { data: normalize(data), error: null, status: 200 };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch session',
        status: 500,
      };
    }
  }

  async createSession(input: CreateSessionInput): Promise<ApiResponse<MRISession>> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userProfile } = await this.supabase
        .from('user_profiles')
        .select('role, hospital_id')
        .eq('id', user.id)
        .single();

      const timestamp = Date.now();
      const sessionCode = `MRI-${new Date().getFullYear()}-${timestamp.toString().slice(-6)}`;

      const { data, error } = await this.supabase
        .from('analysis_sessions')
        .insert({
          modality: 'mri',
          analysis_type: input.analysis_type || 'multiclass',
          original_filename: sessionCode,
          patient_id: input.patient_id,
          doctor_id: input.doctor_id || null,
          radiologist_id: user.id,
          hospital_id: userProfile?.hospital_id || null,
          uploaded_by: user.id,
          uploaded_by_role: userProfile?.role || 'radiologist',
          status: 'queued',
          progress_percent: 0,
          pipeline_options: {},
        })
        .select()
        .single();

      if (error) throw error;

      return { data: transformSession(data), error: null, status: 201 };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create session',
        status: 500,
      };
    }
  }

  async updateSessionStatus(id: string, status: MRISession['status']): Promise<ApiResponse<MRISession>> {
    try {
      const backendStatus = status === 'uploaded' ? 'queued' : status;
      const { data, error } = await this.supabase
        .from('analysis_sessions')
        .update({ status: backendStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { data: transformSession(data), error: null, status: 200 };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update session',
        status: 500,
      };
    }
  }

  async markAsReviewed(id: string, _notes?: string): Promise<ApiResponse<MRISession>> {
    try {
      const { data, error } = await this.supabase
        .from('analysis_sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { data: transformSession(data), error: null, status: 200 };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to mark as reviewed',
        status: 500,
      };
    }
  }

  async deleteSession(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      await Promise.all([
        this.supabase.from('analysis_results').delete().eq('session_id', id),
        this.supabase.from('analysis_reports').delete().eq('session_id', id),
        this.supabase.from('job_events').delete().eq('session_id', id),
      ]);

      const { error } = await this.supabase
        .from('analysis_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { data: { success: true }, error: null, status: 200 };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to delete session',
        status: 500,
      };
    }
  }

  async getMySession(options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<MRISession>>> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [
        { data: profile },
        { data: patientProfile },
        { data: radProfile },
      ] = await Promise.all([
        this.supabase.from('user_profiles').select('role').eq('id', user.id).single(),
        this.supabase.from('patient_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
        this.supabase.from('radiologist_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!profile) throw new Error('Profile not found');

      let query = this.supabase
        .from('analysis_sessions')
        .select(SESSION_LIST_SELECT, { count: 'exact' })
        .eq('modality', 'mri');

      switch (profile.role) {
        case 'patient': {
          if (patientProfile) {
            query = query.eq('patient_id', patientProfile.user_id);
          }
          break;
        }
        case 'doctor': {
          const { data: relationships } = await this.supabase
            .from('doctor_patient_relationships')
            .select('patient_id')
            .eq('doctor_id', user.id)
            .eq('relationship_status', 'active');

          const patientIds = relationships?.map((r: any) => r.patient_id) || [];
          if (patientIds.length > 0) {
            query = query.in('patient_id', patientIds);
          }
          break;
        }
        case 'radiologist': {
          if (radProfile) {
            query = query.eq('radiologist_id', radProfile.user_id);
          }
          break;
        }
      }

      const { page = 1 } = options;
      const pageSize = clampPageSize(options.pageSize, 20);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        data: {
          data: (data || []).map(normalize),
          total: count || 0,
          page,
          pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        status: 500,
      };
    }
  }
}

export const sessionsApi = new SessionsApi();
