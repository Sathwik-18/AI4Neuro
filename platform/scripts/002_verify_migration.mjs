/**
 * Post-migration verification script.
 * Run after executing 001_schema_normalization.sql in the Supabase SQL Editor.
 *
 * Usage:
 *   node scripts/002_verify_migration.mjs
 *
 * Reads creds from frontend/.env.local automatically.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'package.json'));
const { createClient } = require('@supabase/supabase-js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', 'frontend', '.env.local');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error(`Could not read ${envPath}`);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
let failures = 0;

async function check(label, fn) {
  try {
    const result = await fn();
    if (result.pass) {
      console.log(`  ✓ ${label}: ${result.detail}`);
    } else {
      console.log(`  ✗ ${label}: ${result.detail}`);
      failures++;
    }
  } catch (e) {
    console.log(`  ✗ ${label}: ERROR - ${e.message}`);
    failures++;
  }
}

async function count(table, filters = {}) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filters)) {
    query = query.eq(k, v);
  }
  const { count: c, error } = await query;
  if (error) throw error;
  return c || 0;
}

console.log('\n=== AI4Neuro Migration Verification ===\n');

// 1. Check column drops
console.log('1. Schema column cleanup:');
await check('user_profiles.date_of_birth dropped', async () => {
  const { data, error } = await supabase.from('user_profiles').select('id').limit(1);
  // If the column was dropped, selecting it would fail or not return it
  const { data: d2, error: e2 } = await supabase.from('user_profiles').select('date_of_birth').limit(1);
  // If column doesn't exist, supabase returns an error
  return { pass: !!e2, detail: e2 ? 'Column removed' : 'Column still exists — run SQL step 2' };
});

await check('patient_profiles.emergency_contact dropped', async () => {
  const { error } = await supabase.from('patient_profiles').select('emergency_contact').limit(1);
  return { pass: !!error, detail: error ? 'Column removed' : 'Column still exists — run SQL step 3' };
});

await check('doctor_profiles.qualification (text) dropped', async () => {
  const { error } = await supabase.from('doctor_profiles').select('qualification').limit(1);
  return { pass: !!error, detail: error ? 'Column removed' : 'Column still exists — run SQL step 4' };
});

// 2. Data migration
console.log('\n2. Data migration:');
const analysisCount = await count('analysis_sessions');
const relCount = await count('doctor_patient_relationships');

await check('analysis_sessions has data', async () => ({
  pass: analysisCount > 0,
  detail: `${analysisCount} rows`,
}));

await check('analysis_results has data', async () => {
  const c = await count('analysis_results');
  return { pass: c > 0 || analysisCount === 0, detail: `${c} rows` };
});

await check('doctor_patient_relationships has data', async () => ({
  pass: relCount > 0,
  detail: `${relCount} rows`,
}));

// 3. Check legacy tables renamed
console.log('\n3. Legacy tables:');
for (const table of ['mri_sessions', 'mri_predictions', 'doctor_assignments']) {
  await check(`${table} still accessible`, async () => {
    const { error } = await supabase.from(table).select('id').limit(1);
    return {
      pass: true,
      detail: error ? 'Table removed/renamed (good after full migration)' : 'Still exists (rename after frontend migration)',
    };
  });
}

// 4. Check views exist
console.log('\n4. Compatibility views:');
await check('mri_sessions_view exists', async () => {
  const { error } = await supabase.from('mri_sessions_view').select('id').limit(1);
  return { pass: !error, detail: error ? `Missing — ${error.message}` : 'View exists' };
});

await check('mri_predictions_view exists', async () => {
  const { error } = await supabase.from('mri_predictions_view').select('id').limit(1);
  return { pass: !error, detail: error ? `Missing — ${error.message}` : 'View exists' };
});

// 5. Indexes
console.log('\n5. Indexes:');
const { data: indexes } = await supabase.rpc('pg_indexes_list').catch(() => ({ data: null }));
// Can't easily check indexes via PostgREST, so just note it
console.log('  ℹ Run in SQL Editor to verify: SELECT indexname FROM pg_indexes WHERE schemaname = \'public\' ORDER BY indexname;');

// 6. Referential integrity
console.log('\n6. Referential integrity:');
await check('No orphan analysis_results (missing session)', async () => {
  const { data } = await supabase
    .from('analysis_results')
    .select('session_id')
    .limit(100);
  if (!data || data.length === 0) return { pass: true, detail: 'No results to check' };
  let orphans = 0;
  for (const r of data) {
    const { data: s } = await supabase
      .from('analysis_sessions')
      .select('id')
      .eq('id', r.session_id)
      .maybeSingle();
    if (!s) orphans++;
  }
  return { pass: orphans === 0, detail: orphans ? `${orphans} orphan rows found` : 'All clean' };
});

await check('No orphan doctor_patient_relationships (missing doctor/patient)', async () => {
  const { data } = await supabase
    .from('doctor_patient_relationships')
    .select('doctor_id, patient_id')
    .limit(50);
  if (!data || data.length === 0) return { pass: true, detail: 'No relationships to check' };
  let orphans = 0;
  for (const r of data) {
    const { data: d } = await supabase.from('doctor_profiles').select('user_id').eq('user_id', r.doctor_id).maybeSingle();
    const { data: p } = await supabase.from('patient_profiles').select('user_id').eq('user_id', r.patient_id).maybeSingle();
    if (!d || !p) orphans++;
  }
  return { pass: orphans === 0, detail: orphans ? `${orphans} orphan rows found` : 'All clean' };
});

// Summary
console.log(`\n=== Result: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURE(S)`} ===\n`);
process.exit(failures > 0 ? 1 : 0);
