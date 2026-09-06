/**
 * Statistics API Service
 * Handles all dashboard statistics API calls
 */

import { createClient } from '@/lib/supabase/client';
import type { ApiResponse } from './index';

export interface PatientStats {
  totalScans: number;
  completedScans: number;
  pendingScans: number;
  latestScanDate: string | null;
  resultDistribution: {
    CN: number;
    MCI: number;
    AD: number;
  };
  recentScans: {
    id: string;
    sessionCode: string;
    scanDate: string;
    status: string;
    prediction: string | null;
  }[];
}

export interface DoctorStats {
  totalPatients: number;
  activePatients: number;
  pendingReviews: number;
  completedReviews: number;
  thisMonthScans: number;
  resultDistribution: {
    CN: number;
    MCI: number;
    AD: number;
  };
  recentPatients: {
    id: string;
    name: string;
    patientCode: string;
    latestScanStatus: string | null;
    latestPrediction: string | null;
  }[];
}

export interface RadiologistStats {
  totalScans: number;
  processingScans: number;
  completedToday: number;
  completedThisWeek: number;
  averageProcessingTime: number;
  qualityScore: number;
  recentScans: {
    id: string;
    sessionCode: string;
    patientName: string;
    status: string;
    scanDate: string;
  }[];
}

export interface AdminStats {
  totalUsers: number;
  totalPatients: number;
  totalDoctors: number;
  totalRadiologists: number;
  totalAdmins: number;
  activeUsers: number;
  suspendedUsers: number;
  totalScans: number;
  scansThisMonth: number;
  pendingVerifications: number;
  systemHealth: {
    database: 'healthy' | 'degraded' | 'down';
    storage: 'healthy' | 'degraded' | 'down';
    mlService: 'healthy' | 'degraded' | 'down';
  };
  recentActivity: {
    id: string;
    type: string;
    description: string;
    timestamp: string;
    userId: string;
  }[];
}

class StatsApi {
  private supabase = createClient();

  /**
   * Get patient dashboard statistics
   */
  async getPatientStats(patientId?: string): Promise<ApiResponse<PatientStats>> {
    try {
      let pid = patientId;

      // If no patientId provided, get current user's patient profile
      if (!pid) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await this.supabase
          .from('patient_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) throw new Error('Patient profile not found');
        pid = profile.id;
      }

      const { data: sessions } = await this.supabase
        .from('analysis_sessions')
        .select(`
          id,
          original_filename,
          created_at,
          status,
          result:analysis_results(prediction)
        `)
        .eq('patient_id', pid)
        .eq('modality', 'mri')
        .order('created_at', { ascending: false })
        .limit(200);

      const allSessions = (sessions || []) as any[];

      // Calculate statistics
      const totalScans = allSessions.length;
      const completedScans = allSessions.filter(s => s.status === 'completed' || s.status === 'reviewed').length;
      const pendingScans = allSessions.filter(s => s.status === 'processing' || s.status === 'uploaded').length;
      const latestScanDate = allSessions[0]?.created_at || null;

      const resultDistribution = { CN: 0, MCI: 0, AD: 0 };
      allSessions.forEach(s => {
        const pred = Array.isArray(s.result) ? s.result[0]?.prediction : s.result?.prediction;
        if (pred && pred in resultDistribution) {
          resultDistribution[pred as keyof typeof resultDistribution]++;
        }
      });

      const recentScans = allSessions.slice(0, 5).map(s => ({
        id: s.id,
        sessionCode: s.original_filename || s.id,
        scanDate: s.created_at,
        status: s.status,
        prediction: Array.isArray(s.result) ? s.result[0]?.prediction : s.result?.prediction || null,
      }));

      return {
        data: {
          totalScans,
          completedScans,
          pendingScans,
          latestScanDate,
          resultDistribution,
          recentScans,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch patient stats',
        status: 500,
      };
    }
  }

  /**
   * Get doctor dashboard statistics
   */
  async getDoctorStats(doctorId?: string): Promise<ApiResponse<DoctorStats>> {
    try {
      let did = doctorId;

      if (!did) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await this.supabase
          .from('doctor_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) throw new Error('Doctor profile not found');
        did = profile.id;
      }

      const { data: assignments } = await this.supabase
        .from('doctor_patient_relationships')
        .select(`
          id,
          relationship_status,
          patient:patient_profiles!doctor_patient_relationships_patient_id_fkey(
            user_id,
            patient_id,
            user_profile:user_profiles(full_name)
          )
        `)
        .eq('doctor_id', did)
        .limit(500);

      const allAssignments = (assignments || []) as any[];
      const activeAssignments = allAssignments.filter(a => a.relationship_status === 'active');

      const patientIds = activeAssignments.map(a => a.patient?.user_id).filter(Boolean);

      // Get sessions for assigned patients
      let sessionsData: any[] = [];
      if (patientIds.length > 0) {
        const { data: sessions } = await this.supabase
          .from('analysis_sessions')
          .select(`
            id,
            original_filename,
            patient_id,
            created_at,
            status,
            result:analysis_results(prediction)
          `)
          .in('patient_id', patientIds)
          .eq('modality', 'mri')
          .order('created_at', { ascending: false })
          .limit(500);

        sessionsData = sessions || [];
      }

      // Calculate statistics
      const totalPatients = allAssignments.length;
      const activePatients = activeAssignments.length;
      const pendingReviews = sessionsData.filter(s => s.status === 'completed').length;
      const completedReviews = 0;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const thisMonthScans = sessionsData.filter(s => new Date(s.created_at) >= startOfMonth).length;

      const resultDistribution = { CN: 0, MCI: 0, AD: 0 };
      sessionsData.forEach(s => {
        const pred = Array.isArray(s.result) ? s.result[0]?.prediction : s.result?.prediction;
        if (pred && pred in resultDistribution) {
          resultDistribution[pred as keyof typeof resultDistribution]++;
        }
      });

      const recentPatients = activeAssignments.slice(0, 5).map(a => {
        const patientSessions = sessionsData.filter(s => s.patient_id === a.patient?.user_id);
        const latestSession = patientSessions[0];
        return {
          id: a.patient?.user_id || '',
          name: Array.isArray(a.patient?.user_profile) ? a.patient?.user_profile[0]?.full_name : a.patient?.user_profile?.full_name || '',
          patientCode: a.patient?.patient_id || '',
          latestScanStatus: latestSession?.status || null,
          latestPrediction: latestSession?.result?.[0]?.prediction || null,
        };
      });

      return {
        data: {
          totalPatients,
          activePatients,
          pendingReviews,
          completedReviews,
          thisMonthScans,
          resultDistribution,
          recentPatients,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch doctor stats',
        status: 500,
      };
    }
  }

  /**
   * Get radiologist dashboard statistics
   */
  async getRadiologistStats(radiologistId?: string): Promise<ApiResponse<RadiologistStats>> {
    try {
      let rid = radiologistId;

      if (!rid) {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await this.supabase
          .from('radiologist_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) throw new Error('Radiologist profile not found');
        rid = profile.id;
      }

      const { data: sessions } = await this.supabase
        .from('analysis_sessions')
        .select(`
          id,
          original_filename,
          created_at,
          status,
          patient:patient_profiles!analysis_sessions_patient_id_fkey(
            user_profile:user_profiles(full_name)
          ),
          result:analysis_results(metrics)
        `)
        .eq('radiologist_id', rid)
        .eq('modality', 'mri')
        .order('created_at', { ascending: false })
        .limit(200);

      const allSessions = (sessions || []) as any[];

      // Calculate statistics
      const totalScans = allSessions.length;
      const processingScans = allSessions.filter(s => s.status === 'processing').length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completedToday = allSessions.filter(s => {
        const scanDate = new Date(s.created_at);
        return scanDate >= today && s.status === 'completed';
      }).length;

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const completedThisWeek = allSessions.filter(s => {
        const scanDate = new Date(s.created_at);
        return scanDate >= startOfWeek && s.status === 'completed';
      }).length;

      const processingTimes = allSessions
        .map(s => {
          const r = Array.isArray(s.result) ? s.result[0] : s.result;
          return r?.metrics?.processing_time;
        })
        .filter(Boolean) as number[];
      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

      const qualityScore = 98.5;

      const recentScans = allSessions.slice(0, 5).map(s => {
        const pat = Array.isArray(s.patient) ? s.patient[0] : s.patient;
        const patientProfile = Array.isArray(pat?.user_profile)
          ? pat?.user_profile[0]
          : pat?.user_profile;
        return {
          id: s.id,
          sessionCode: s.original_filename || s.id,
          patientName: patientProfile?.full_name || 'Unknown',
          status: s.status,
          scanDate: s.created_at,
        };
      });

      return {
        data: {
          totalScans,
          processingScans,
          completedToday,
          completedThisWeek,
          averageProcessingTime,
          qualityScore,
          recentScans,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch radiologist stats',
        status: 500,
      };
    }
  }

  /**
   * Get admin dashboard statistics
   */
  async getAdminStats(): Promise<ApiResponse<AdminStats>> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        totalUsersResult,
        totalPatientsResult,
        totalDoctorsResult,
        totalRadiologistsResult,
        totalAdminsResult,
        activeUsersResult,
        suspendedUsersResult,
        totalScansResult,
        scansThisMonthResult,
        pendingVerificationsResult,
      ] = await Promise.all([
        this.supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
        this.supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'patient'),
        this.supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'doctor'),
        this.supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'radiologist'),
        this.supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        this.supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'active'),
        this.supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'suspended'),
        this.supabase.from('analysis_sessions').select('*', { count: 'exact', head: true }).eq('modality', 'mri'),
        this.supabase.from('analysis_sessions').select('*', { count: 'exact', head: true }).eq('modality', 'mri').gte('created_at', startOfMonth.toISOString()),
        this.supabase.from('doctor_profiles').select('*', { count: 'exact', head: true }).is('license_number', null),
      ]);

      const totalUsers = totalUsersResult.count || 0;
      const totalPatients = totalPatientsResult.count || 0;
      const totalDoctors = totalDoctorsResult.count || 0;
      const totalRadiologists = totalRadiologistsResult.count || 0;
      const totalAdmins = totalAdminsResult.count || 0;
      const activeUsers = activeUsersResult.count || 0;
      const suspendedUsers = suspendedUsersResult.count || 0;

      // System health (mock - would come from real monitoring)
      const systemHealth = {
        database: 'healthy' as const,
        storage: 'healthy' as const,
        mlService: 'healthy' as const,
      };

      // Recent activity (mock - would come from audit log)
      const recentActivity: AdminStats['recentActivity'] = [];

      return {
        data: {
          totalUsers,
          totalPatients,
          totalDoctors,
          totalRadiologists,
          totalAdmins,
          activeUsers,
          suspendedUsers,
          totalScans: totalScansResult.count || 0,
          scansThisMonth: scansThisMonthResult.count || 0,
          pendingVerifications: pendingVerificationsResult.count || 0,
          systemHealth,
          recentActivity,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch admin stats',
        status: 500,
      };
    }
  }
}

export const statsApi = new StatsApi();
