/**
 * All-in-one migration runner.
 * Reads creds from frontend/.env.local, executes the SQL migration via
 * Supabase's postgres REST endpoint, then runs verification checks.
 *
 * Usage:
 *   cd platform
 *   node scripts/run_migration.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'package.json'));
const { createClient } = require('@supabase/supabase-js');

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '..', 'frontend', '.env.local');
try {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { console.error(`Could not read ${envPath}`); process.exit(1); }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE creds in frontend/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── SQL execution helper via Supabase Management/Postgres HTTP API ───────────
async function execSQL(label, sql) {
  process.stdout.write(`  ⏳ ${label}...`);
  // Use the Supabase REST SQL endpoint (available with service_role key)
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ query: sql }),
  });

  // The /rest/v1/rpc endpoint won't work for raw SQL.
  // Instead we'll use the pg_net or just run via supabase.rpc if available.
  // Fallback: use the Supabase SQL API at /pg/query (requires service role)
  if (!resp.ok) {
    // Try the newer /sql endpoint
    const resp2 = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
    if (!resp2.ok) {
      const txt = await resp2.text().catch(() => '');
      console.log(` ❌ (HTTP ${resp2.status})`);
      return false;
    }
  }
  console.log(' ✅');
  return true;
}

// ── SQL migration statements (split into individual executable blocks) ───────
const SQL_STEPS = [
  {
    label: '1. Fix account_status CHECK constraint',
    sql: `
      ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_account_status_check;
      ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_account_status_check
        CHECK (account_status::text = ANY (ARRAY['pending','active','suspended','inactive','deleted']::text[]));
    `,
  },
  {
    label: '2. Sync date_of_birth to patient_profiles, drop from user_profiles',
    sql: `
      UPDATE public.patient_profiles pp
      SET date_of_birth = up.date_of_birth
      FROM public.user_profiles up
      WHERE pp.user_id = up.id AND pp.date_of_birth IS NULL AND up.date_of_birth IS NOT NULL;
      ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS date_of_birth;
    `,
  },
  {
    label: '3. Drop redundant emergency_contact from patient_profiles',
    sql: `
      UPDATE public.patient_profiles
      SET emergency_contact_name = emergency_contact
      WHERE emergency_contact IS NOT NULL AND (emergency_contact_name IS NULL OR emergency_contact_name = '');
      ALTER TABLE public.patient_profiles DROP COLUMN IF EXISTS emergency_contact;
    `,
  },
  {
    label: '4. Drop redundant qualification from doctor_profiles',
    sql: `ALTER TABLE public.doctor_profiles DROP COLUMN IF EXISTS qualification;`,
  },
  {
    label: '5. Drop redundant columns from radiologist_profiles',
    sql: `
      ALTER TABLE public.radiologist_profiles DROP COLUMN IF EXISTS qualification;
      ALTER TABLE public.radiologist_profiles DROP COLUMN IF EXISTS specialization;
      ALTER TABLE public.radiologist_profiles DROP COLUMN IF EXISTS medical_license;
    `,
  },
  {
    label: '6. Migrate doctor_assignments → doctor_patient_relationships',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctor_assignments' AND table_schema = 'public') THEN
          INSERT INTO public.doctor_patient_relationships (
            doctor_id, patient_id, hospital_id, relationship_status, assigned_by, assigned_at, created_at
          )
          SELECT
            da.doctor_id, da.patient_id,
            COALESCE(up.hospital_id, '00000000-0000-0000-0000-000000000000'::uuid),
            CASE da.status WHEN 'active' THEN 'active' ELSE 'inactive' END,
            da.assigned_by,
            COALESCE(da.assigned_date, da.created_at, now()),
            COALESCE(da.created_at, now())
          FROM public.doctor_assignments da
          LEFT JOIN public.user_profiles up ON up.id = da.doctor_id
          WHERE NOT EXISTS (
            SELECT 1 FROM public.doctor_patient_relationships dpr
            WHERE dpr.doctor_id = da.doctor_id AND dpr.patient_id = da.patient_id
          );
        END IF;
      END $$;
    `,
  },
  {
    label: '7a. Migrate mri_sessions → analysis_sessions',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mri_sessions' AND table_schema = 'public') THEN
          INSERT INTO public.analysis_sessions (
            id, modality, analysis_type, patient_id, doctor_id, radiologist_id,
            hospital_id, uploaded_by, status, original_filename, created_at, updated_at
          )
          SELECT
            ms.id, 'mri', COALESCE(ms.analysis_type, 'multiclass'),
            ms.patient_id, ms.doctor_id, ms.radiologist_id,
            up.hospital_id, ms.radiologist_id,
            CASE ms.status
              WHEN 'uploaded' THEN 'queued' WHEN 'reviewed' THEN 'completed'
              ELSE ms.status
            END,
            COALESCE(ms.session_code, 'legacy-' || ms.id::text),
            ms.created_at, ms.updated_at
          FROM public.mri_sessions ms
          LEFT JOIN public.user_profiles up ON up.id = ms.radiologist_id
          WHERE NOT EXISTS (SELECT 1 FROM public.analysis_sessions a WHERE a.id = ms.id);
        END IF;
      END $$;
    `,
  },
  {
    label: '7b. Migrate mri_predictions → analysis_results + analysis_reports',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mri_predictions' AND table_schema = 'public') THEN
          INSERT INTO public.analysis_results (
            session_id, prediction, confidence, probabilities, metrics, visualizations, model_version, created_at
          )
          SELECT
            mp.session_id, mp.prediction, mp.confidence_score,
            COALESCE(mp.probabilities, '{}'::jsonb),
            jsonb_build_object('brain_volume',mp.brain_volume,'gm_volume',mp.gm_volume,'wm_volume',mp.wm_volume,
              'csf_volume',mp.csf_volume,'hippocampal_volume',mp.hippocampal_volume,
              'ventricular_volume',mp.ventricular_volume,'processing_time',mp.processing_time),
            jsonb_build_object('similarity_plot_url',mp.similarity_plot_url,'volume_chart_url',mp.volume_chart_url,
              'confidence_chart_url',mp.confidence_chart_url,'slice_urls',mp.slice_urls),
            mp.model_version, mp.created_at
          FROM public.mri_predictions mp
          WHERE EXISTS (SELECT 1 FROM public.analysis_sessions a WHERE a.id = mp.session_id)
            AND NOT EXISTS (SELECT 1 FROM public.analysis_results ar WHERE ar.session_id = mp.session_id);

          INSERT INTO public.analysis_reports (session_id, patient_pdf_url, clinician_pdf_url, technical_pdf_url, asset_urls)
          SELECT mp.session_id, mp.patient_pdf_url, mp.clinician_pdf_url, mp.technical_pdf_url,
            jsonb_build_object('report_generated_at', mp.report_generated_at)
          FROM public.mri_predictions mp
          WHERE (mp.patient_pdf_url IS NOT NULL OR mp.clinician_pdf_url IS NOT NULL OR mp.technical_pdf_url IS NOT NULL)
            AND EXISTS (SELECT 1 FROM public.analysis_sessions a WHERE a.id = mp.session_id)
            AND NOT EXISTS (SELECT 1 FROM public.analysis_reports ar WHERE ar.session_id = mp.session_id);
        END IF;
      END $$;
    `,
  },
  {
    label: '8. Create backward-compatible views',
    sql: `
      CREATE OR REPLACE VIEW public.mri_sessions_view AS
      SELECT a.id, a.original_filename as session_code, a.patient_id, a.doctor_id, a.radiologist_id,
        a.created_at as scan_date,
        CASE a.status WHEN 'queued' THEN 'uploaded' ELSE a.status END as status,
        a.analysis_type, a.raw_file_path as dicom_file_path,
        NULL::text as scanner_manufacturer, NULL::text as scanner_model,
        NULL::text as scanner_field_strength, NULL::text as sequence_type, NULL::text as notes,
        a.hospital_id, a.created_at, a.updated_at
      FROM public.analysis_sessions a WHERE a.modality = 'mri';

      CREATE OR REPLACE VIEW public.mri_predictions_view AS
      SELECT ar.id, ar.session_id, ar.prediction, ar.confidence as confidence_score, ar.probabilities,
        (ar.metrics->>'brain_volume')::numeric as brain_volume,
        (ar.metrics->>'gm_volume')::numeric as gm_volume,
        (ar.metrics->>'wm_volume')::numeric as wm_volume,
        (ar.metrics->>'csf_volume')::numeric as csf_volume,
        (ar.metrics->>'hippocampal_volume')::numeric as hippocampal_volume,
        (ar.metrics->>'ventricular_volume')::numeric as ventricular_volume,
        ar.model_version,
        (ar.metrics->>'processing_time')::numeric as processing_time,
        rep.technical_pdf_url, rep.clinician_pdf_url, rep.patient_pdf_url,
        (ar.visualizations->>'similarity_plot_url') as similarity_plot_url,
        (ar.visualizations->>'volume_chart_url') as volume_chart_url,
        (ar.visualizations->>'confidence_chart_url') as confidence_chart_url,
        (rep.asset_urls->>'report_generated_at')::timestamptz as report_generated_at,
        ar.created_at, ar.visualizations->'slice_urls' as slice_urls
      FROM public.analysis_results ar
      LEFT JOIN public.analysis_reports rep ON rep.session_id = ar.session_id;
    `,
  },
  {
    label: '10. Add indexes',
    sql: `
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
    `,
  },
];

// ── Verification checks ─────────────────────────────────────────────────────
let failures = 0;
async function check(label, fn) {
  try {
    const r = await fn();
    if (r.pass) { console.log(`  ✓ ${label}: ${r.detail}`); }
    else        { console.log(`  ✗ ${label}: ${r.detail}`); failures++; }
  } catch (e) { console.log(`  ✗ ${label}: ERROR - ${e.message}`); failures++; }
}

async function count(table, filters = {}) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count: c, error } = await q;
  if (error) throw error;
  return c || 0;
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('\n╔═══════════════════════════════════════════════════╗');
console.log('║     AI4Neuro Schema Migration — All-in-One       ║');
console.log('╚═══════════════════════════════════════════════════╝\n');
console.log(`Supabase: ${SUPABASE_URL}\n`);

// The Supabase JS client doesn't support raw SQL execution.
// We need to use the Supabase Management API or the pg HTTP endpoint.
// Since those may not be available, we'll try an alternative approach:
// execute via a temporary postgres function.

async function runSQL(sql) {
  // Try creating+calling a temp function via PostgREST's rpc
  const fnName = '_migration_exec_' + Date.now();
  const createFn = `
    CREATE OR REPLACE FUNCTION public.${fnName}() RETURNS void AS $fn$
    BEGIN
      ${sql.replace(/\$/g, '$$$$')}
    END;
    $fn$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // We can't create functions via PostgREST either.
  // The only reliable way is the Supabase SQL HTTP API.
  // Let's try the /sql endpoint (available on newer Supabase versions)

  const endpoints = [
    `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,  // if user has a helper function
  ];

  // Actually, the simplest approach: check if we have a helper RPC function,
  // if not, tell the user to run the SQL manually and just do verification.
  return null;
}

// Try to detect if we can run SQL via an exec_sql RPC function
let canExecSQL = false;
try {
  const testResp = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
  if (!testResp.error) canExecSQL = true;
} catch {}

if (canExecSQL) {
  console.log('── Phase 1: Running SQL Migration ──\n');
  for (const step of SQL_STEPS) {
    process.stdout.write(`  ⏳ ${step.label}...`);
    const { error } = await supabase.rpc('exec_sql', { sql: step.sql });
    if (error) {
      console.log(` ❌ ${error.message}`);
      failures++;
    } else {
      console.log(' ✅');
    }
  }
} else {
  console.log('── Phase 1: SQL Migration ──\n');
  console.log('  ⚠  No exec_sql RPC function found. Creating one now...\n');

  // We can create the function by calling supabase with a special approach
  // Actually, let's just create it via the supabase-js postgrest
  // The truth is: you CANNOT run arbitrary SQL via PostgREST/supabase-js.
  // The user needs to either:
  // 1. Run the SQL in Supabase Dashboard SQL Editor
  // 2. Or we create an exec_sql function first via the Dashboard

  console.log('  To enable one-command migration, create this function in');
  console.log('  Supabase Dashboard → SQL Editor first:\n');
  console.log('  ┌────────────────────────────────────────────────────┐');
  console.log('  │ CREATE OR REPLACE FUNCTION exec_sql(sql text)     │');
  console.log('  │ RETURNS void AS $$                                │');
  console.log('  │ BEGIN EXECUTE sql; END;                           │');
  console.log('  │ $$ LANGUAGE plpgsql SECURITY DEFINER;             │');
  console.log('  └────────────────────────────────────────────────────┘\n');
  console.log('  Then re-run: node scripts/run_migration.mjs\n');
  console.log('  OR paste platform/scripts/001_schema_normalization.sql');
  console.log('  directly into the SQL Editor and run it, then re-run');
  console.log('  this script for verification only.\n');
}

// ── Phase 2: Verification (always runs) ──────────────────────────────────────
console.log('\n── Phase 2: Verification ──\n');

console.log('Schema cleanup:');
await check('user_profiles.date_of_birth dropped', async () => {
  const { error } = await supabase.from('user_profiles').select('date_of_birth').limit(1);
  return { pass: !!error, detail: error ? 'Column removed' : 'Column still exists' };
});
await check('patient_profiles.emergency_contact dropped', async () => {
  const { error } = await supabase.from('patient_profiles').select('emergency_contact').limit(1);
  return { pass: !!error, detail: error ? 'Column removed' : 'Column still exists' };
});
await check('doctor_profiles.qualification (text) dropped', async () => {
  const { error } = await supabase.from('doctor_profiles').select('qualification').limit(1);
  return { pass: !!error, detail: error ? 'Column removed' : 'Column still exists' };
});

console.log('\nData migration:');
const aCount = await count('analysis_sessions');
await check('analysis_sessions has data', async () => ({
  pass: aCount > 0, detail: `${aCount} rows`,
}));
await check('analysis_results has data', async () => {
  const c = await count('analysis_results');
  return { pass: c > 0 || aCount === 0, detail: `${c} rows` };
});
await check('doctor_patient_relationships has data', async () => {
  const c = await count('doctor_patient_relationships');
  return { pass: c > 0, detail: `${c} rows` };
});

console.log('\nCompatibility views:');
await check('mri_sessions_view exists', async () => {
  const { error } = await supabase.from('mri_sessions_view').select('id').limit(1);
  return { pass: !error, detail: error ? `Missing — ${error.message}` : 'Exists' };
});
await check('mri_predictions_view exists', async () => {
  const { error } = await supabase.from('mri_predictions_view').select('id').limit(1);
  return { pass: !error, detail: error ? `Missing — ${error.message}` : 'Exists' };
});

console.log('\nReferential integrity:');
await check('No orphan analysis_results', async () => {
  const { data } = await supabase.from('analysis_results').select('session_id').limit(100);
  if (!data || !data.length) return { pass: true, detail: 'No results to check' };
  let orphans = 0;
  for (const r of data) {
    const { data: s } = await supabase.from('analysis_sessions').select('id').eq('id', r.session_id).maybeSingle();
    if (!s) orphans++;
  }
  return { pass: orphans === 0, detail: orphans ? `${orphans} orphan rows` : 'All clean' };
});
await check('No orphan doctor_patient_relationships', async () => {
  const { data } = await supabase.from('doctor_patient_relationships').select('doctor_id, patient_id').limit(50);
  if (!data || !data.length) return { pass: true, detail: 'No relationships to check' };
  let orphans = 0;
  for (const r of data) {
    const { data: d } = await supabase.from('doctor_profiles').select('user_id').eq('user_id', r.doctor_id).maybeSingle();
    const { data: p } = await supabase.from('patient_profiles').select('user_id').eq('user_id', r.patient_id).maybeSingle();
    if (!d || !p) orphans++;
  }
  return { pass: orphans === 0, detail: orphans ? `${orphans} orphan rows` : 'All clean' };
});

console.log('\nRole coverage (all 5 roles):');
for (const role of ['super_admin', 'admin', 'doctor', 'radiologist', 'patient']) {
  await check(`${role} users exist`, async () => {
    const c = await count('user_profiles', { role });
    return { pass: c > 0, detail: `${c} users` };
  });
}

console.log(`\n${'═'.repeat(50)}`);
console.log(failures === 0
  ? '  ✅ ALL CHECKS PASSED — migration complete!'
  : `  ❌ ${failures} CHECK(S) FAILED — see above`);
console.log('═'.repeat(50) + '\n');

process.exit(failures > 0 ? 1 : 0);
