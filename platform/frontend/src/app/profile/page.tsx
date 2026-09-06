'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { withAuth } from '@/lib/withAuth';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { getRoleMeta, type Role } from '@/lib/navigation';
import { type Accent } from '@/components/dashboards/shared/primitives';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MaterialIcon } from '@/components/dashboards/shared/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminApi, type Hospital } from '@/features/admin/api';
import { apiClient } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

interface BloodGroup {
  id: number;
  blood_type: string;
}

interface Qualification {
  id: number;
  qualification_name: string;
  specialization?: string | null;
}


function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: Accent;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-400">
        {icon}
      </div>
      <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 truncate flex-1">{value || '—'}</span>
    </div>
  );
}

function SettingsLink({ icon, title, href }: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  href: string;
  badge?: string;
  accent?: Accent;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 py-2.5 hover:text-blue-600 transition-colors"
    >
      <div className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
        {icon}
      </div>
      <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors flex-1">{title}</span>
      <MaterialIcon name="chevron_right" size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
    </Link>
  );
}

function ProfilePage() {
  const { user, userProfile, signOut, refreshProfile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  // Display-only label for a picked file — kept separate from editAvatarUrl
  // (which holds the actual data: URI / URL value) so the raw base64 string
  // never ends up rendered into a text input.
  const [editAvatarFileName, setEditAvatarFileName] = useState('');
  const [editQualificationId, setEditQualificationId] = useState('');
  const [editLicense, setEditLicense] = useState('');
  const [editSpecialization, setEditSpecialization] = useState('');
  const [editImagingExpertise, setEditImagingExpertise] = useState('');
  const [editCertifications, setEditCertifications] = useState('');
  const [editExperience, setEditExperience] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editBloodGroupId, setEditBloodGroupId] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [bloodGroups, setBloodGroups] = useState<BloodGroup[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hospitalName, setHospitalName] = useState<string>('');

  const displayName = userProfile?.full_name || 'User';
  const role = userProfile?.role || 'patient';
  const accent = getRoleMeta(role as Role).accent;
  const email = userProfile?.email || user?.email || '';
  const phone = userProfile?.phone || '';
  const roleProfile = (userProfile?.roleProfile || (userProfile as any)?.profile?.roleProfile || (userProfile as any)?.profile || {}) as any;
  const avatarUrl = (userProfile as any)?.avatar_url || roleProfile?.avatar_url || (userProfile as any)?.profile?.avatar_url || '';

  const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1594824813566-88855ce7890b?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  ];

  useEffect(() => {
    if (userProfile) {
      setEditName(userProfile.full_name || '');
      setEditPhone(userProfile.phone || '');
      setEditAvatarUrl((userProfile as any)?.avatar_url || roleProfile?.avatar_url || (userProfile as any)?.profile?.avatar_url || '');
      setEditAvatarFileName('');
      setEditBloodGroupId(roleProfile?.blood_group_id ? String(roleProfile.blood_group_id) : '');
      setEditQualificationId(roleProfile?.qualification_id ? String(roleProfile.qualification_id) : '');
      // doctor_profiles.medical_license vs radiologist_profiles.radiologist_license —
      // the UI shows one "License Number" field regardless of which column backs it.
      setEditLicense(roleProfile?.medical_license || roleProfile?.radiologist_license || '');
      setEditSpecialization(roleProfile?.specialization || '');
      setEditImagingExpertise(roleProfile?.imaging_expertise || '');
      setEditCertifications(roleProfile?.certifications || '');
      setEditExperience(roleProfile?.experience_years ? String(roleProfile.experience_years) : '');
      setEditDob(roleProfile?.date_of_birth ? String(roleProfile.date_of_birth).slice(0, 10) : '');
      setEditEmergencyName(roleProfile?.emergency_contact_name || '');
      setEditEmergencyPhone(roleProfile?.emergency_contact_phone || '');
      setEditEmployeeId(roleProfile?.employee_id || '');
      setEditDepartment(roleProfile?.department || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (role !== 'patient') return;
    let cancelled = false;
    apiClient
      .get<BloodGroup[]>('/api/v1/users/blood-groups')
      .then((rows) => !cancelled && setBloodGroups(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (role !== 'doctor' && role !== 'radiologist') return;
    let cancelled = false;
    apiClient
      .get<Qualification[]>('/api/v1/users/qualifications')
      .then((rows) => !cancelled && setQualifications(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    const hospitalId = roleProfile?.hospital_id || (userProfile as any)?.hospital_id;
    if (hospitalId) {
      const supabase = createClient();
      supabase
        .from('hospitals')
        .select('name')
        .eq('id', hospitalId)
        .single()
        .then((res: { data: { name: string } | null }) => {
          if (!cancelled && res.data?.name) {
            setHospitalName(res.data.name);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [userProfile]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch {
      toast.error('Failed to log out');
      setIsLoggingOut(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;
    setIsSaving(true);

    let backendSuccess = false;
    let supabaseSuccess = false;
    // Only meaningful when backendSuccess is false — the backend PATCH
    // already writes the role-detail table server-side in one call (see
    // _ROLE_FIELD_MAP in app/api/v1/users.py), so these direct-Supabase
    // writes below are a fallback path only reached when that call failed.
    // Defaults true for roles with no role-detail table (super_admin).
    let roleTableSuccess = true;

    try {
      const supabase = createClient();
      const experienceYears = editExperience ? parseInt(editExperience, 10) : null;
      const qualificationId = editQualificationId ? parseInt(editQualificationId, 10) : null;
      const bloodGroupId = editBloodGroupId ? parseInt(editBloodGroupId, 10) : null;

      // 1. Update backend FastAPI users/me endpoint (service role bypasses
      // RLS). Only real column names for the caller's role are sent — see
      // _ROLE_FIELD_MAP in app/api/v1/users.py — so a field that doesn't
      // apply to this role is simply ignored server-side rather than
      // breaking the whole save.
      try {
        await apiClient.patch('/api/v1/users/me', {
          full_name: editName,
          phone: editPhone,
          avatar_url: editAvatarUrl || null,
          license_number: editLicense || null,
          qualification_id: qualificationId,
          experience_years: experienceYears,
          specialization: editSpecialization || null,
          imaging_expertise: editImagingExpertise || null,
          certifications: editCertifications || null,
          date_of_birth: editDob || null,
          emergency_contact_name: editEmergencyName || null,
          emergency_contact_phone: editEmergencyPhone || null,
          blood_group_id: bloodGroupId,
          employee_id: editEmployeeId || null,
          department: editDepartment || null,
        });
        backendSuccess = true;
      } catch (err) {
        console.warn('API client patch error (backend might be down or blocked by CORS):', err);
      }

      // 2. Fallback: Update user_profiles in Supabase directly
      try {
        const { error: userError } = await supabase
          .from('user_profiles')
          .update({
            full_name: editName,
            phone: editPhone,
            avatar_url: editAvatarUrl || null,
          })
          .eq('id', userProfile.id);

        if (userError) {
           console.warn('Supabase direct update error:', userError);
        } else {
           supabaseSuccess = true;
        }
      } catch (err) {
        console.warn('Supabase client exception:', err);
      }

      // 3. Fallback: Update role-specific table in Supabase directly, using
      // each table's real column names (doctor_profiles.medical_license vs
      // radiologist_profiles.radiologist_license, etc — see full_setup.sql).
      if (role === 'doctor') {
        try {
          const { error: roleError } = await supabase.from('doctor_profiles').upsert(
            {
              user_id: userProfile.id,
              medical_license: editLicense || undefined,
              qualification_id: qualificationId,
              specialization: editSpecialization || null,
              experience_years: experienceYears,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (roleError) {
            console.warn('Doctor table upsert error:', roleError);
            roleTableSuccess = false;
          }
        } catch (err) {
          console.warn('Doctor table upsert exception:', err);
          roleTableSuccess = false;
        }
      } else if (role === 'radiologist') {
        try {
          const { error: roleError } = await supabase.from('radiologist_profiles').upsert(
            {
              user_id: userProfile.id,
              radiologist_license: editLicense || undefined,
              qualification_id: qualificationId,
              imaging_expertise: editImagingExpertise || undefined,
              certifications: editCertifications || null,
              experience_years: experienceYears,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (roleError) {
            console.warn('Radiologist table upsert error:', roleError);
            roleTableSuccess = false;
          }
        } catch (err) {
          console.warn('Radiologist table upsert exception:', err);
          roleTableSuccess = false;
        }
      } else if (role === 'patient') {
        try {
          const { error: roleError } = await supabase.from('patient_profiles').upsert(
            {
              user_id: userProfile.id,
              date_of_birth: editDob || null,
              emergency_contact_name: editEmergencyName || null,
              emergency_contact_phone: editEmergencyPhone || null,
              blood_group_id: bloodGroupId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (roleError) {
            console.warn('Patient table upsert error:', roleError);
            roleTableSuccess = false;
          }
        } catch (err) {
          console.warn('Patient table upsert exception:', err);
          roleTableSuccess = false;
        }
      } else if (role === 'admin') {
        try {
          const { error: roleError } = await supabase.from('hospital_admin_profiles').upsert(
            {
              user_id: userProfile.id,
              employee_id: editEmployeeId || null,
              department: editDepartment || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
          if (roleError) {
            console.warn('Hospital admin table upsert error:', roleError);
            roleTableSuccess = false;
          }
        } catch (err) {
          console.warn('Hospital admin table upsert exception:', err);
          roleTableSuccess = false;
        }
      }

      if (!backendSuccess && !supabaseSuccess) {
        toast.error('Failed to save profile. Please check connection and try again.');
        setIsSaving(false);
        return;
      }

      await refreshProfile();
      if (!backendSuccess && !roleTableSuccess) {
        // The primary (backend) path failed, and its fallback for the
        // role-specific table (license/specialization/DOB/etc — see
        // roleTableSuccess above) also failed, even though the basic
        // name/phone/avatar fields did save via the user_profiles fallback.
        toast.warning('Profile partially updated — some role-specific details (e.g. license, specialization) could not be saved. Please try again.');
      } else {
        toast.success('Profile updated successfully');
      }
      setIsEditModalOpen(false);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = getInitials(displayName);
  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  // Role-specific info
  const getRoleSpecificInfo = () => {
    switch (role) {
      case 'patient': {
        const assignedDoctorName = roleProfile?.assigned_doctor_name
          ? (String(roleProfile.assigned_doctor_name).startsWith('Dr.')
              ? roleProfile.assigned_doctor_name
              : `Dr. ${roleProfile.assigned_doctor_name}`)
          : '';
        return [
          {
            label: 'Assigned Doctor',
            value: assignedDoctorName,
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            ),
          },
          {
            label: 'Associated Hospital',
            value: roleProfile?.hospital_name || roleProfile?.hospitals?.name || hospitalName || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
          {
            label: 'Date of Birth',
            value: roleProfile?.date_of_birth ? new Date(roleProfile.date_of_birth).toLocaleDateString() : '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            label: 'Blood Group',
            value: roleProfile?.blood_type || roleProfile?.blood_groups?.blood_type || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            ),
          },
          {
            label: 'Emergency Contact',
            value: [roleProfile?.emergency_contact_name, roleProfile?.emergency_contact_phone]
              .filter(Boolean)
              .join(' - '),
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            ),
          },
        ];
      }
      case 'doctor':
        return [
          {
            label: 'Qualification',
            value: roleProfile?.qualification_name || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            ),
          },
          {
            label: 'License Number',
            value: roleProfile?.medical_license || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            ),
          },
          {
            label: 'Specialization',
            value: roleProfile?.specialization || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            ),
          },
          {
            label: 'Hospital',
            value: roleProfile?.hospital_name || roleProfile?.hospitals?.name || hospitalName || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
          {
            label: 'Experience',
            value: roleProfile?.experience_years ? `${roleProfile.experience_years} years` : '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ];
      case 'radiologist':
        return [
          {
            label: 'Qualification',
            value: roleProfile?.qualification_name || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            ),
          },
          {
            label: 'License Number',
            value: roleProfile?.radiologist_license || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            ),
          },
          {
            label: 'Imaging Expertise',
            value: roleProfile?.imaging_expertise || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            ),
          },
          {
            label: 'Certifications',
            value: roleProfile?.certifications || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ),
          },
          {
            label: 'Hospital',
            value: roleProfile?.hospital_name || roleProfile?.hospitals?.name || hospitalName || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
          {
            label: 'Experience',
            value: roleProfile?.experience_years ? `${roleProfile.experience_years} years` : '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ];
      case 'admin':
        return [
          {
            label: 'Employee ID',
            value: roleProfile?.employee_id || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ),
          },
          {
            label: 'Department',
            value: roleProfile?.department || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            ),
          },
          {
            label: 'Hospital',
            value: roleProfile?.hospital_name || roleProfile?.hospitals?.name || hospitalName || '',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
          },
        ];
      case 'super_admin':
        return [
          {
            label: 'Access Level',
            value: 'Platform (all hospitals)',
            icon: (
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ),
          },
        ];
      default:
        return [];
    }
  };

  const roleSpecificInfo = getRoleSpecificInfo();

  return (
    <RoleShell>
      <div className="pb-12 max-w-3xl mx-auto">
        {/* Profile Header — borderless, immersive */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-8">
          <div className="shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-20 h-20 rounded-lg object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-blue-600 flex items-center justify-center text-2xl font-semibold text-white">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">{displayName}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{email}</p>
            <p className="text-xs text-slate-400 mt-1">
              {role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              {' · '}Joined {joinDate}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
          >
            Edit
          </button>
        </div>

        {/* Divider-separated sections, no card borders */}
        <div className="divide-y divide-slate-100">
          {/* Contact */}
          <div className="pb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Contact</h2>
            <div className="space-y-0.5">
              <InfoRow label="Email" value={email} accent={accent} icon={<svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 6.5l6.5 4.3a1.5 1.5 0 001.6 0l6.5-4.3M4 15.5h12a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H4A1.5 1.5 0 002.5 6v8a1.5 1.5 0 001.5 1.5z" /></svg>} />
              <InfoRow label="Phone" value={phone} accent={accent} icon={<svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 4a1.5 1.5 0 011.5-1.5h2.46a.75.75 0 01.71.51l1.12 3.37a.75.75 0 01-.38.91l-1.7.85a8.28 8.28 0 004.14 4.14l.85-1.7a.75.75 0 01.91-.38l3.37 1.12a.75.75 0 01.51.71V15.5a1.5 1.5 0 01-1.5 1.5h-.75C7.29 17 2.5 12.21 2.5 5.5V4z" /></svg>} />
            </div>
          </div>

          {/* Role Details */}
          {roleSpecificInfo.length > 0 && (
            <div className="py-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                {role === 'patient' ? 'Medical' : 'Professional'}
              </h2>
              <div className="space-y-0.5">
                {roleSpecificInfo.map((info, index) => (
                  <InfoRow key={index} {...info} accent={accent} />
                ))}
              </div>
            </div>
          )}

          {/* Account */}
          <div className="py-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Account</h2>
            <div className="space-y-0.5">
              <SettingsLink
                href="/change-password"
                accent={accent}
                icon={<svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 12.5v1.5m-4.5 3h9a1.5 1.5 0 001.5-1.5v-4.5a1.5 1.5 0 00-1.5-1.5h-9a1.5 1.5 0 00-1.5 1.5V15a1.5 1.5 0 001.5 1.5zm7.5-7.5V6a3 3 0 00-6 0v2.5h6z" /></svg>}
                title="Change password"
              />
              <SettingsLink
                href={getRoleMeta(role).dashboard}
                accent={accent}
                icon={<svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 10l1.5-1.5m0 0l5.25-5.25 5.25 5.25M4 8.5v7.5a.75.75 0 00.75.75h2.25m7.5-8.25l1.5 1.5m-1.5-1.5v7.5a.75.75 0 01-.75.75h-2.25m-4.5 0a.75.75 0 00.75-.75v-3a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v3a.75.75 0 00.75.75m-4.5 0h4.5" /></svg>}
                title="Go to dashboard"
              />
            </div>
          </div>

          {/* Sign out */}
          <div className="pt-6">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? (
                <MaterialIcon name="progress_activity" size={16} className="animate-spin" />
              ) : (
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 13.5l3-3m0 0l-3-3m3 3H5.5m4.5 3v.75a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 14V5.5A2.25 2.25 0 014.5 3.25h3.25A2.25 2.25 0 0110 5.5v.75" /></svg>
              )}
              {isLoggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => !isSaving && setIsEditModalOpen(open)}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg">Edit profile</DialogTitle>
            <DialogDescription className="text-sm text-slate-400">Update your photo, contact info, and role details.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              {editAvatarUrl ? (
                <img src={editAvatarUrl} alt="Avatar" className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xl">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    id="avatar-file-input"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setEditAvatarUrl(event.target.result as string);
                            setEditAvatarFileName(file.name);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="avatar-file-input"
                    className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    Upload photo
                  </label>
                  {(editAvatarUrl || editAvatarFileName) && (
                    <button
                      type="button"
                      onClick={() => { setEditAvatarFileName(''); setEditAvatarUrl(''); }}
                      disabled={isSaving}
                      className="text-xs text-red-500 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {editAvatarFileName ? (
                  <p className="text-[11px] text-slate-400 truncate">{editAvatarFileName}</p>
                ) : !editAvatarUrl ? (
                  <Input
                    placeholder="Or paste image URL…"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    disabled={isSaving}
                    className="text-xs h-8"
                  />
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {PRESET_AVATARS.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { setEditAvatarUrl(url); setEditAvatarFileName(''); }}
                  className={cn(
                    'w-9 h-9 rounded-md overflow-hidden border-2 transition-all shrink-0',
                    editAvatarUrl === url ? 'border-blue-600' : 'border-transparent opacity-70 hover:opacity-100'
                  )}
                >
                  <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Contact — two-column responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-full-name" className="text-xs">Full name</Label>
                <Input
                  id="edit-full-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-phone" className="text-xs">Phone</Label>
                <Input
                  id="edit-phone"
                  placeholder="+1 (555) 000-1003"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Doctor / Radiologist Shared Fields */}
            {(role === 'doctor' || role === 'radiologist') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-qualification" className="text-xs">Qualification</Label>
                  <Select value={editQualificationId} onValueChange={setEditQualificationId} disabled={isSaving}>
                    <SelectTrigger id="edit-qualification">
                      <SelectValue placeholder="Select qualification" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-60">
                      {qualifications.map((q) => (
                        <SelectItem key={q.id} value={String(q.id)}>
                          {q.qualification_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-license" className="text-xs">License number</Label>
                  <Input id="edit-license" placeholder="e.g. MED-849201" value={editLicense} onChange={(e) => setEditLicense(e.target.value)} disabled={isSaving} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-experience" className="text-xs">Experience (years)</Label>
                  <Input id="edit-experience" type="number" placeholder="e.g. 8" value={editExperience} onChange={(e) => setEditExperience(e.target.value)} disabled={isSaving} />
                </div>
                {role === 'doctor' && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-specialization" className="text-xs">Specialization</Label>
                    <Input id="edit-specialization" placeholder="e.g. Neuroradiology" value={editSpecialization} onChange={(e) => setEditSpecialization(e.target.value)} disabled={isSaving} />
                  </div>
                )}
                {role === 'radiologist' && (
                  <>
                    <div className="grid gap-1.5">
                      <Label htmlFor="edit-imaging-expertise" className="text-xs">Imaging expertise</Label>
                      <Input id="edit-imaging-expertise" placeholder="e.g. MRI, CT" value={editImagingExpertise} onChange={(e) => setEditImagingExpertise(e.target.value)} disabled={isSaving} />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor="edit-certifications" className="text-xs">Certifications</Label>
                      <Input id="edit-certifications" placeholder="e.g. Board Certified Radiologist" value={editCertifications} onChange={(e) => setEditCertifications(e.target.value)} disabled={isSaving} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Patient Fields */}
            {role === 'patient' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-dob" className="text-xs">Date of birth</Label>
                  <Input id="edit-dob" type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} disabled={isSaving} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-blood-group" className="text-xs">Blood group</Label>
                  <Select value={editBloodGroupId} onValueChange={setEditBloodGroupId} disabled={isSaving}>
                    <SelectTrigger id="edit-blood-group">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-60">
                      {bloodGroups.map((bg) => (
                        <SelectItem key={bg.id} value={String(bg.id)}>{bg.blood_type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-emergency-name" className="text-xs">Emergency contact</Label>
                  <Input id="edit-emergency-name" placeholder="Name" value={editEmergencyName} onChange={(e) => setEditEmergencyName(e.target.value)} disabled={isSaving} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-emergency-phone" className="text-xs">Emergency phone</Label>
                  <Input id="edit-emergency-phone" placeholder="+1 (555) 999-8888" value={editEmergencyPhone} onChange={(e) => setEditEmergencyPhone(e.target.value)} disabled={isSaving} />
                </div>
              </div>
            )}

            {/* Hospital Admin Fields */}
            {role === 'admin' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-employee-id" className="text-xs">Employee ID</Label>
                  <Input id="edit-employee-id" placeholder="e.g. EMP-2024-001" value={editEmployeeId} onChange={(e) => setEditEmployeeId(e.target.value)} disabled={isSaving} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-department" className="text-xs">Department</Label>
                  <Input id="edit-department" placeholder="e.g. Radiology Administration" value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} disabled={isSaving} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveProfile} disabled={isSaving || !editName}>
              {isSaving ? <MaterialIcon name="progress_activity" size={16} className="animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}

export default withAuth(ProfilePage);
