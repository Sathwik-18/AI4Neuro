# UI Redesign Changelog — `changes` Branch

**Date:** September 2026
**Branch:** `changes`
**Scope:** Complete visual overhaul, database schema migration, security hardening, pagination/search fixes, and API restructuring.

---

## 1. Design System Changes

### Typography
- **Font:** Replaced Poppins with **Lexend** globally via `next/font/google`.
- Configured in `layout.tsx` and applied as `font-sans` across the app.

### Color System
- **Single blue accent** replaces the previous 4-accent system (green/indigo/blue/teal).
- Every `teal-`, `indigo-`, `violet-`, `purple-`, and `emerald-` Tailwind class across the entire `src/` directory has been migrated to `blue-` equivalents.
- The `ACCENT_STYLES` map in `primitives.tsx` still accepts accent keys for API compatibility, but all variants now resolve to blue classes.

### Flat Design
- **No gradients anywhere.** All `bg-gradient-to-*` classes removed or replaced with flat solid backgrounds (e.g. `bg-slate-900`).
- Consistent use of `rounded-lg`, `shadow-sm` — no heavy shadows or rounded-xl.

### Icons
- **Google Material Symbols Outlined** font loaded globally, replacing Lucide icons in shell/navigation components (`DashboardShell`, `TopbarWidgets`).
- **Custom inline SVGs** for medical modality icons (MRI brain cross-section, EEG waveform trace, PET molecular structure) — replacing generic Material Icons that were irrelevant.
- Lucide icons remain in some detail/viewer pages where they fit contextually.

---

## 2. Component Changes

### DashboardShell (`components/dashboards/shared/DashboardShell.tsx`)
- Sidebar "Services" section renamed to **"Pipelines"**.
- Pipeline items use custom medical SVGs instead of Material Icons.
- Removed "Active" tags and bordered card containers — plain rows with hover states.
- PET scan shown as dimmed with lock icon (coming soon).

### TopbarWidgets / ProfileMenu (`components/dashboards/shared/TopbarWidgets.tsx`)
- Profile button now shows **full name + role label** (not just initials).
- Avatar is `w-7 h-7 rounded-full`.
- Dropdown widened to `w-56`, added **Settings** link with Material Icon.
- Chevron icon `expand_more` for dropdown indicator.

### Profile Page (`app/profile/page.tsx`)
- **Immersive layout:** no card borders, divider-separated flowing sections.
- `InfoCard` replaced with `InfoRow` — minimal icon + label + value, no card wrapper.
- `SettingsLink` simplified to plain text rows with chevron.
- Profile header: borderless, no status dot, no "Active" badge, role + join date inline.
- Edit profile dialog: wider (`sm:max-w-[560px]`), 2-column responsive grid for fields, cleaner avatar section, footer with `border-t bg-slate-50/50`.

### CreateUserDialog (`components/dashboards/shared/CreateUserDialog.tsx`)
- All accent variants now map to `bg-blue-600 hover:bg-blue-700`.

### ScansStatusCalendar (`components/dashboards/shared/ScansStatusCalendar.tsx`)
- All accent palette entries (indigo, teal, green) now resolve to blue classes.

### Primitives (`components/dashboards/shared/primitives.tsx`)
- `DashboardPageHeader` padding reduced from `py-2` to `pb-1`.
- AlertBanner `purple` tone changed to blue equivalents.

### Page Transition Loader
- **Brain signal / EEG wave animation** for page transitions (`PageTransitionLoader` component).

---

## 3. Dashboard-Specific Changes

### DoctorDashboard (`components/dashboards/DoctorDashboard/index.tsx`)
- All `teal-` and `indigo-` classes → `blue-`.

### RadiologistDashboard (`components/dashboards/RadiologistDashboard/index.tsx`)
- All `indigo-` and `violet-` classes → `blue-`.

### HospitalAdminDashboard (`components/dashboards/HospitalAdminDashboard/index.tsx`)
- All `teal-` and `violet-` → `blue-`.
- Gradient header `bg-gradient-to-br from-teal-950 to-slate-950` → flat `bg-slate-900`.
- All `SelectContent` given `position="popper" className="max-h-60"`.

### SuperAdminDashboard (`components/dashboards/SuperAdminDashboard/index.tsx`)
- All `indigo-` → `blue-`.
- Gradient header → flat `bg-slate-900`.

---

## 4. Page-Level Changes

| Page | Changes |
|------|---------|
| `change-password/page.tsx` | Full THEME object (4 accent variants) migrated to blue. Gradient panel backgrounds flattened. SVG grid stroke updated to blue-600. |
| `login/page.tsx` | `teal-`, `indigo-`, `violet-` → `blue-`. |
| `not-found.tsx` | `indigo-`, `violet-` → `blue-`. |
| `analysis/new/page.tsx` | Removed extra `py-2` wrapper. Responsive grid breakpoints adjusted for sidebar-open layout. |
| `super-admin/scans/page.tsx` | `indigo-` → `blue-`. |
| `super-admin/hospitals/page.tsx` | `indigo-` → `blue-`. |
| `super-admin/hospitals/[id]/page.tsx` | `indigo-` → `blue-`. |
| `super-admin/doctors/[id]/page.tsx` | `teal-`, `indigo-` → `blue-`. |
| `super-admin/patients/[id]/page.tsx` | `teal-`, `indigo-` → `blue-`. |
| `super-admin/radiologists/[id]/page.tsx` | `indigo-`, `teal-` → `blue-`. |
| `super-admin/hospital-admins/[id]/page.tsx` | `indigo-`, `teal-` → `blue-`. |
| `super-admin/analytics/page.tsx` | `indigo-` → `blue-`. |
| `doctor/patient/[id]/page.tsx` | `teal-`, `indigo-`, `violet-`, `purple-` → `blue-`. |
| `patient/viewer/[id]/page.tsx` | `teal-` → `blue-`. |
| `profile/page.tsx` | Full redesign (see Component Changes above). All `SelectContent` fixed. |

### Viewer & Shared Components

| File | Changes |
|------|---------|
| `MRISessionViewer.tsx` | `teal-`, `violet-`, `purple-` → `blue-`. |
| `PatientReportModal.tsx` | `teal-` → `blue-`, gradient header flattened. |
| `ReportModal.tsx` | `indigo-` → `blue-`. |
| `ExplainabilityPanel.tsx` | `teal-` → `blue-`. |
| `animated/index.tsx` | teal color mapping → `bg-blue-500`. |

---

## 5. Bug Fixes

### Select Dropdown Crash in Dialogs
- **Root cause:** Radix UI `SelectContent` defaults to `position="item-aligned"`, which causes layout thrashing inside scrollable Dialogs (`overflow-y-auto`).
- **Fix:** Added `position="popper" className="max-h-60"` to all `SelectContent` instances inside Dialogs across the site (profile page, CreateUserDialog, HospitalAdminDashboard).

### Analysis Page Responsiveness (Sidebar Open)
- **Root cause:** Fixed-width 3-column grid (280+320=600px fixed) left too little space when sidebar was open.
- **Fix:** Progressive breakpoints — `lg:grid-cols-[260px_minmax(0,1fr)]` (2 cols), `xl:grid-cols-[260px_minmax(0,1fr)_280px]` (3 cols at xl).

### Analysis Page Content Pushed Down
- **Fix:** Removed extra `py-2` wrapper in `NewAnalysisPage`, reduced `DashboardPageHeader` padding to `pb-1`.

---

## 6. Deletions

- `platform/.env` — removed from tracking.
- `platform/frontend/src/app/test/page.tsx` — test page removed.
- `platform/frontend/src/components/ui/PixelSnow/` — decorative component removed.
- `platform/frontend/src/lib/cornerstone/setup.ts` — unused setup removed.
- `platform/model-sync.env` — removed from tracking.

---

## 7. Database & API Schema Migration

### Unified Analysis Tables
- **`mri_sessions` → `analysis_sessions`**: All frontend API modules (`sessions.ts`, `stats.ts`, `patients.ts`, `doctors.ts`) now query the unified `analysis_sessions` table instead of the old `mri_sessions`.
- **`mri_predictions` → `analysis_results`**: Prediction/result joins updated across all queries. A `transformResult()` mapper in `sessions.ts` maps unified columns (`confidence`, `metrics`, `visualizations`, `report`) back to the legacy `MRIPrediction` interface shape for backward compatibility.
- **`doctor_assignments` → `doctor_patient_relationships`**: Queries in `doctors.ts`, `patients.ts`, `stats.ts` updated. Column renames: `assigned_date` → `assigned_at`, `status` → `relationship_status`. Foreign key hints added (e.g. `patient_profiles!doctor_patient_relationships_patient_id_fkey`).
- **Status mapping**: A `STATUS_MAP` in `sessions.ts` translates granular pipeline statuses (`queued`, `preprocessing`, `running_model`, `generating_visualizations`, etc.) into the frontend's simplified set (`uploaded`, `processing`, `completed`, `failed`).
- **`session_code` → `original_filename`**: Session display names now use the uploaded filename.
- **`scan_date` → `created_at`**: Date fields aligned to the unified schema.
- **MRI allowed extensions**: Removed bare `.gz` from allowed uploads — only `.nii` and `.nii.gz` accepted (`schemas/analysis.py`).

---

## 8. Pagination & Search Hardening

### Page Size Clamping
- Added `MAX_PAGE_SIZE = 200` constant and `clampPageSize()` helper in `lib/api/index.ts`.
- All paginated API modules (`doctors.ts`, `patients.ts`, `users.ts`, `sessions.ts`) now use `clampPageSize(options.pageSize)` instead of raw `pageSize = 10` defaults, preventing unbounded queries.
- Reference data queries (`hospitals`, `qualifications`, `blood_groups`) now have explicit `.limit(500)` / `.limit(100)` caps.

### Search Input Sanitization
- All `.ilike()` search filters now sanitize input: `search.replace(/[%_(),.]/g, '')` strips Postgres wildcard and special characters before interpolation.
- Affected: `doctors.ts`, `patients.ts`, `users.ts`.

### Parallel Query Optimization
- **AuthProvider**: Role profile, hospital name, and blood type lookups now fire in parallel via `Promise.all()` instead of sequential awaits. Blood type lookup (depends on role profile) remains sequential.
- **`doctors.ts` `getDoctorById()`**: Patient count, pending reviews, and assignments fire in parallel.
- **`patients.ts` `getPatientById()`**: Sessions and doctor assignments fire in parallel.

---

## 9. Backend Security & Hardening

### Rate Limiting
- Added `slowapi==0.1.9` dependency.
- Global rate limit: `120/minute` per IP on all endpoints (`main.py`).
- Analysis upload endpoint: `10/minute` per IP (`analysis.py`).

### Auth & JWT
- **`auth_dev_bypass` default changed to `false`** — dev bypass no longer on by default (`config.py`).
- **JWT audience verification enabled**: Removed `options={"verify_aud": False}` from both HS256 and JWKS token decode paths (`security.py`). Audience `"authenticated"` is now strictly verified.

### CORS Tightening
- `allow_methods` restricted from `["*"]` to `["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]`.
- `allow_headers` restricted from `["*"]` to `["Authorization", "Content-Type", "Accept", "X-Requested-With"]`.

### Error Information Leakage
- `_safe_exception_details()` in `analysis.py` now returns only `{"type": ...}` in production (no message/details/hint).
- Database error handler in `main.py` uses generic fallback messages in production instead of exposing Postgres error messages.
- `/docs` and `/redoc` endpoints disabled in production.

### Storage Path Traversal Fix
- `storage.py`: `raw_file_path()` now sanitizes filenames with `os.path.basename()` and strips leading dots, preventing directory traversal via crafted upload filenames.

### Doctor/Radiologist ID Validation
- `analysis.py`: The `create_analysis` endpoint now validates that `doctor_id` and `radiologist_id` (when provided) actually exist in `user_profiles`, hold the correct role, and belong to the same `hospital_id`. Previously these were trusted as-is.

### Health Endpoints Protected
- `/health/database` and `/health/storage` now require authentication (`Depends(get_current_user)`).

---

## 10. Frontend Security

### Middleware Overhaul (`middleware.ts`)
- Replaced pass-through middleware with full Supabase SSR auth guard.
- **Public routes** allowlisted: `/login`, `/landing`, `/signup`, `/forgot-password`, `/reset-password`.
- **Role-based route protection**: URL path segments (`/super-admin/`, `/doctor/`, etc.) matched against user's role from Supabase session. Unauthorized access redirects to the user's own dashboard.
- **Security headers** added to all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### Create User Route (`api/admin/create-user/route.ts`)
- **CSRF protection**: Origin header validated against Host header.
- **Password generation**: `Math.random()` replaced with `crypto.randomBytes()`.
- **Code generation**: Timestamp-based codes replaced with `crypto.randomBytes(5).toString('hex')`.
- **Email validation**: Regex check added before user creation.
- **Temporary password**: No longer returned in API response when email was sent successfully.
- Email transport uses `EMAIL_APP_PASSWORD` instead of `EMAIL_PASSWORD`.

### Test Auth Route (`api/test-auth/route.ts`)
- Returns 404 in production.
- No longer leaks full error messages or full `user_profiles` rows — selects only `id, full_name, role, account_status`.

### Auth Provider
- `console.log('Auth init...')` gated behind `NODE_ENV === 'development'`.
- `getSession()` usage documented (reads local storage, backend independently verifies JWT).

---

## 11. Dependency Changes

### Removed
- `@cornerstonejs/core`, `@cornerstonejs/dicom-image-loader`, `@cornerstonejs/streaming-image-volume-loader`, `@cornerstonejs/tools` — DICOM viewer libraries removed.
- `dcmjs`, `dicom-parser` — DICOM parsing libraries removed.
- `platform/frontend/src/lib/cornerstone/setup.ts` — setup file removed.

### Added
- `slowapi==0.1.9` — backend rate limiting (`requirements/api.txt`).
