'use client';

import { Suspense } from 'react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { ReportsLibrary } from '@/features/reports/ReportsLibrary';
import { withAuth } from '@/lib/withAuth';

function DoctorReportsPage() {
  return (
    <RoleShell>
      <Suspense fallback={<div className="h-40" />}>
        <ReportsLibrary role="doctor" />
      </Suspense>
    </RoleShell>
  );
}

export default withAuth(DoctorReportsPage, { allowedRoles: ['doctor'] });
