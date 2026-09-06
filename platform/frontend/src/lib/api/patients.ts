/**
 * Patients API Service
 * Handles all patient-related API calls
 */

import { createClient } from '@/lib/supabase/client';
import { clampPageSize } from './index';
import type { ApiResponse, PaginatedResponse, FilterOptions } from './index';

export interface Patient {
  id: string;
  user_id: string;
  patient_code: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  blood_group_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user_profile?: {
    full_name: string;
    email: string;
    phone: string | null;
    account_status: string;
  };
  blood_group?: {
    blood_group: string;
  };
  // Computed
  full_name?: string;
  email?: string;
}

export interface PatientWithSessions extends Patient {
  sessions_count: number;
  latest_session?: {
    id: string;
    session_code: string;
    status: string;
    scan_date: string;
    prediction?: string;
  };
  assigned_doctors?: {
    id: string;
    name: string;
    specialization: string;
  }[];
}

class PatientsApi {
  private supabase = createClient();

  /**
   * Get all patients with pagination and filtering
   */
  async getPatients(options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<Patient>>> {
    try {
      const {
        page = 1,
        sortBy = 'created_at',
        sortOrder = 'desc',
        search = '',
      } = options;
      const pageSize = clampPageSize(options.pageSize);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = this.supabase
        .from('patient_profiles')
        .select(`
          *,
          user_profile:user_profiles!patient_profiles_user_id_fkey(
            full_name,
            email,
            phone,
            account_status
          ),
          blood_group:blood_groups(blood_group)
        `, { count: 'exact' });

      // Apply search filter
      if (search) {
        const sanitized = search.replace(/[%_(),.]/g, '');
        query = query.or(`patient_code.ilike.%${sanitized}%,user_profile.full_name.ilike.%${sanitized}%`);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Transform data
      const patients = (data || []).map((p: any) => ({
        ...p,
        full_name: p.user_profile?.full_name,
        email: p.user_profile?.email,
      }));

      return {
        data: {
          data: patients,
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
        error: error instanceof Error ? error.message : 'Failed to fetch patients',
        status: 500,
      };
    }
  }

  /**
   * Get a single patient by ID
   */
  async getPatient(id: string): Promise<ApiResponse<PatientWithSessions>> {
    try {
      // Get patient profile
      const { data: patient, error: patientError } = await this.supabase
        .from('patient_profiles')
        .select(`
          *,
          user_profile:user_profiles!patient_profiles_user_id_fkey(
            full_name,
            email,
            phone,
            account_status
          ),
          blood_group:blood_groups(blood_group)
        `)
        .eq('id', id)
        .single();

      if (patientError) throw patientError;

      const [
        { data: sessions, error: sessionsError },
        { data: assignments, error: assignmentsError },
      ] = await Promise.all([
        this.supabase
          .from('analysis_sessions')
          .select(`
            id,
            original_filename,
            status,
            created_at,
            result:analysis_results(prediction)
          `)
          .eq('patient_id', id)
          .eq('modality', 'mri')
          .order('created_at', { ascending: false })
          .limit(5),
        this.supabase
          .from('doctor_patient_relationships')
          .select(`
            doctor:doctor_profiles!doctor_patient_relationships_doctor_id_fkey(
              id,
              user_profile:user_profiles(full_name),
              specialization
            )
          `)
          .eq('patient_id', id)
          .eq('relationship_status', 'active')
          .limit(50),
      ]);

      if (sessionsError) throw sessionsError;
      if (assignmentsError) throw assignmentsError;

      const result: PatientWithSessions = {
        ...patient,
        full_name: patient.user_profile?.full_name,
        email: patient.user_profile?.email,
        sessions_count: sessions?.length || 0,
        latest_session: sessions?.[0] ? {
          id: sessions[0].id,
          session_code: (sessions[0] as any).original_filename || sessions[0].id,
          status: sessions[0].status,
          scan_date: sessions[0].created_at,
          prediction: (sessions[0] as any).result?.[0]?.prediction,
        } : undefined,
        assigned_doctors: assignments?.map((a: any) => ({
          id: a.doctor?.id,
          name: Array.isArray(a.doctor?.user_profile)
            ? a.doctor?.user_profile[0]?.full_name
            : a.doctor?.user_profile?.full_name,
          specialization: a.doctor?.specialization,
        })).filter(Boolean) as PatientWithSessions['assigned_doctors'],
      };

      return {
        data: result,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch patient',
        status: 500,
      };
    }
  }

  /**
   * Get patient's MRI sessions
   */
  async getPatientSessions(patientId: string, options: FilterOptions = {}): Promise<ApiResponse<PaginatedResponse<any>>> {
    try {
      const {
        page = 1,
        status,
      } = options;
      const pageSize = clampPageSize(options.pageSize);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = this.supabase
        .from('analysis_sessions')
        .select(`
          *,
          result:analysis_results(*),
          report:analysis_reports(*),
          doctor:user_profiles!analysis_sessions_doctor_id_fkey(
            id,
            full_name
          ),
          radiologist:user_profiles!analysis_sessions_radiologist_id_fkey(
            id,
            full_name
          )
        `, { count: 'exact' })
        .eq('patient_id', patientId)
        .eq('modality', 'mri');

      if (status) {
        query = query.eq('status', status);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: {
          data: data || [],
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

  /**
   * Get current patient's profile (for logged-in patient)
   */
  async getCurrentPatientProfile(): Promise<ApiResponse<PatientWithSessions>> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: patient, error } = await this.supabase
        .from('patient_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return this.getPatient(patient.id);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
        status: 500,
      };
    }
  }
}

export const patientsApi = new PatientsApi();
