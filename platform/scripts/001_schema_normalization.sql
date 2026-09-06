-- =============================================================================
-- AI4Neuro Schema Normalization Migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================================
-- IMPORTANT: Take a database backup before running this script.
-- Run each section one at a time and verify before proceeding.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix account_status CHECK constraint — add 'deleted' (code references it)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_account_status_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_account_status_check
  CHECK (account_status::text = ANY (ARRAY[
    'pending', 'active', 'suspended', 'inactive', 'deleted'
  ]::text[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Sync date_of_birth: copy from user_profiles → patient_profiles where missing,
--    then drop the column from user_profiles (canonical location: patient_profiles)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.patient_profiles pp
SET date_of_birth = up.date_of_birth
FROM public.user_profiles up
WHERE pp.user_id = up.id
  AND pp.date_of_birth IS NULL
  AND up.date_of_birth IS NOT NULL;

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS date_of_birth;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Drop redundant emergency_contact text column from patient_profiles
--    (keep the structured emergency_contact_name / emergency_contact_phone)
-- ─────────────────────────────────────────────────────────────────────────────
-- First, backfill structured columns from the free-text column if they're empty
UPDATE public.patient_profiles
SET emergency_contact_name = emergency_contact
WHERE emergency_contact IS NOT NULL
  AND (emergency_contact_name IS NULL OR emergency_contact_name = '');

ALTER TABLE public.patient_profiles DROP COLUMN IF EXISTS emergency_contact;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop redundant free-text columns from doctor_profiles
--    (qualification_id FK is the canonical reference; free text 'qualification' is stale)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.doctor_profiles DROP COLUMN IF EXISTS qualification;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Drop redundant free-text columns from radiologist_profiles
--    qualification_id is the canonical FK; imaging_expertise covers specialization;
--    radiologist_license is the canonical license field
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.radiologist_profiles DROP COLUMN IF EXISTS qualification;
ALTER TABLE public.radiologist_profiles DROP COLUMN IF EXISTS specialization;
ALTER TABLE public.radiologist_profiles DROP COLUMN IF EXISTS medical_license;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Migrate legacy doctor_assignments → doctor_patient_relationships
--    (only rows that don't already exist in the target table)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctor_assignments' AND table_schema = 'public') THEN
    INSERT INTO public.doctor_patient_relationships (
      doctor_id, patient_id, hospital_id, relationship_status, assigned_by, assigned_at, created_at
    )
    SELECT
      da.doctor_id,
      da.patient_id,
      COALESCE(up.hospital_id, '00000000-0000-0000-0000-000000000000'::uuid) as hospital_id,
      CASE da.status
        WHEN 'active' THEN 'active'
        WHEN 'inactive' THEN 'inactive'
        ELSE 'inactive'
      END as relationship_status,
      da.assigned_by,
      COALESCE(da.assigned_date, da.created_at, now()) as assigned_at,
      COALESCE(da.created_at, now()) as created_at
    FROM public.doctor_assignments da
    LEFT JOIN public.user_profiles up ON up.id = da.doctor_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.doctor_patient_relationships dpr
      WHERE dpr.doctor_id = da.doctor_id
        AND dpr.patient_id = da.patient_id
    );

    RAISE NOTICE 'doctor_assignments data migrated to doctor_patient_relationships';
  ELSE
    RAISE NOTICE 'doctor_assignments table does not exist, skipping';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Migrate legacy mri_sessions + mri_predictions → analysis_sessions + analysis_results
--    (only rows that don't already exist in analysis_sessions)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mri_sessions' AND table_schema = 'public') THEN
    -- Migrate sessions
    INSERT INTO public.analysis_sessions (
      id, modality, analysis_type, patient_id, doctor_id, radiologist_id,
      hospital_id, uploaded_by, status, original_filename,
      created_at, updated_at
    )
    SELECT
      ms.id,
      'mri',
      COALESCE(ms.analysis_type, 'multiclass'),
      ms.patient_id,
      ms.doctor_id,
      ms.radiologist_id,
      up.hospital_id,
      ms.radiologist_id,  -- best guess for uploaded_by
      CASE ms.status
        WHEN 'uploaded' THEN 'queued'
        WHEN 'processing' THEN 'processing'
        WHEN 'completed' THEN 'completed'
        WHEN 'reviewed' THEN 'completed'
        WHEN 'failed' THEN 'failed'
        ELSE ms.status
      END,
      COALESCE(ms.session_code, 'legacy-' || ms.id::text),
      ms.created_at,
      ms.updated_at
    FROM public.mri_sessions ms
    LEFT JOIN public.user_profiles up ON up.id = ms.radiologist_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.analysis_sessions a WHERE a.id = ms.id
    );

    RAISE NOTICE 'mri_sessions data migrated to analysis_sessions';
  ELSE
    RAISE NOTICE 'mri_sessions table does not exist, skipping';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mri_predictions' AND table_schema = 'public') THEN
    -- Migrate predictions → results
    INSERT INTO public.analysis_results (
      session_id, prediction, confidence, probabilities, metrics,
      visualizations, model_version, created_at
    )
    SELECT
      mp.session_id,
      mp.prediction,
      mp.confidence_score,
      COALESCE(mp.probabilities, '{}'::jsonb),
      jsonb_build_object(
        'brain_volume', mp.brain_volume,
        'gm_volume', mp.gm_volume,
        'wm_volume', mp.wm_volume,
        'csf_volume', mp.csf_volume,
        'hippocampal_volume', mp.hippocampal_volume,
        'ventricular_volume', mp.ventricular_volume,
        'processing_time', mp.processing_time
      ),
      jsonb_build_object(
        'similarity_plot_url', mp.similarity_plot_url,
        'volume_chart_url', mp.volume_chart_url,
        'confidence_chart_url', mp.confidence_chart_url,
        'slice_urls', mp.slice_urls
      ),
      mp.model_version,
      mp.created_at
    FROM public.mri_predictions mp
    WHERE EXISTS (
      SELECT 1 FROM public.analysis_sessions a WHERE a.id = mp.session_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.analysis_results ar WHERE ar.session_id = mp.session_id
    );

    -- Migrate report URLs → analysis_reports
    INSERT INTO public.analysis_reports (
      session_id, patient_pdf_url, clinician_pdf_url, technical_pdf_url, asset_urls
    )
    SELECT
      mp.session_id,
      mp.patient_pdf_url,
      mp.clinician_pdf_url,
      mp.technical_pdf_url,
      jsonb_build_object(
        'report_generated_at', mp.report_generated_at
      )
    FROM public.mri_predictions mp
    WHERE (mp.patient_pdf_url IS NOT NULL OR mp.clinician_pdf_url IS NOT NULL OR mp.technical_pdf_url IS NOT NULL)
    AND EXISTS (
      SELECT 1 FROM public.analysis_sessions a WHERE a.id = mp.session_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.analysis_reports ar WHERE ar.session_id = mp.session_id
    );

    RAISE NOTICE 'mri_predictions data migrated to analysis_results + analysis_reports';
  ELSE
    RAISE NOTICE 'mri_predictions table does not exist, skipping';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Create backward-compatible views so legacy frontend code keeps working
--    during the transition (these can be dropped after frontend migration)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.mri_sessions_view AS
SELECT
  a.id,
  a.original_filename as session_code,
  a.patient_id,
  a.doctor_id,
  a.radiologist_id,
  a.created_at as scan_date,
  CASE a.status
    WHEN 'queued' THEN 'uploaded'
    WHEN 'completed' THEN 'completed'
    WHEN 'failed' THEN 'failed'
    WHEN 'processing' THEN 'processing'
    ELSE a.status
  END as status,
  a.analysis_type,
  a.raw_file_path as dicom_file_path,
  NULL::text as scanner_manufacturer,
  NULL::text as scanner_model,
  NULL::text as scanner_field_strength,
  NULL::text as sequence_type,
  NULL::text as notes,
  a.hospital_id,
  a.created_at,
  a.updated_at
FROM public.analysis_sessions a
WHERE a.modality = 'mri';

CREATE OR REPLACE VIEW public.mri_predictions_view AS
SELECT
  ar.id,
  ar.session_id,
  ar.prediction,
  ar.confidence as confidence_score,
  ar.probabilities,
  (ar.metrics->>'brain_volume')::numeric as brain_volume,
  (ar.metrics->>'gm_volume')::numeric as gm_volume,
  (ar.metrics->>'wm_volume')::numeric as wm_volume,
  (ar.metrics->>'csf_volume')::numeric as csf_volume,
  (ar.metrics->>'hippocampal_volume')::numeric as hippocampal_volume,
  (ar.metrics->>'ventricular_volume')::numeric as ventricular_volume,
  ar.model_version,
  (ar.metrics->>'processing_time')::numeric as processing_time,
  rep.technical_pdf_url,
  rep.clinician_pdf_url,
  rep.patient_pdf_url,
  (ar.visualizations->>'similarity_plot_url') as similarity_plot_url,
  (ar.visualizations->>'volume_chart_url') as volume_chart_url,
  (ar.visualizations->>'confidence_chart_url') as confidence_chart_url,
  (rep.asset_urls->>'report_generated_at')::timestamptz as report_generated_at,
  ar.created_at,
  ar.visualizations->'slice_urls' as slice_urls
FROM public.analysis_results ar
LEFT JOIN public.analysis_reports rep ON rep.session_id = ar.session_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. After verifying views work, rename legacy tables (don't drop yet)
-- ─────────────────────────────────────────────────────────────────────────────
-- Uncomment these AFTER verifying the migration is correct:
--
-- ALTER TABLE IF EXISTS public.mri_sessions RENAME TO _legacy_mri_sessions;
-- ALTER TABLE IF EXISTS public.mri_predictions RENAME TO _legacy_mri_predictions;
-- ALTER TABLE IF EXISTS public.doctor_assignments RENAME TO _legacy_doctor_assignments;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Add useful indexes for common query patterns
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_patient_id ON public.analysis_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_doctor_id ON public.analysis_sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_radiologist_id ON public.analysis_sessions(radiologist_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_hospital_id ON public.analysis_sessions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_status ON public.analysis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_modality ON public.analysis_sessions(modality);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_created_at ON public.analysis_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_results_session_id ON public.analysis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_relationships_doctor_id ON public.doctor_patient_relationships(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_relationships_patient_id ON public.doctor_patient_relationships(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_relationships_hospital_id ON public.doctor_patient_relationships(hospital_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_hospital_id ON public.user_profiles(hospital_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_status ON public.user_profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_hospital_id ON public.audit_log(hospital_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
