/* AppRouter.tsx — frontend-architecture.md §3: lazy-loaded routes */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from './AppLayout';
import { Forbidden } from './Forbidden';
import { NotFound } from './NotFound';
import { Spinner } from '@/components/ui/Spinner';

/* Auth */
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));

/* Dashboard */
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));

/* Members & Flats */
const FlatListPage = lazy(() => import('@/features/flats/pages/FlatListPage'));
const FlatDetailPage = lazy(() => import('@/features/flats/pages/FlatDetailPage'));
const FlatFormPage = lazy(() => import('@/features/flats/pages/FlatFormPage'));
const MemberListPage = lazy(() => import('@/features/members/pages/MemberListPage'));
const MemberDetailPage = lazy(() => import('@/features/members/pages/MemberDetailPage'));
const MemberFormPage = lazy(() => import('@/features/members/pages/MemberFormPage'));

/* Maintenance */
const DemandListPage = lazy(() => import('@/features/maintenance/pages/DemandListPage'));
const DemandDetailPage = lazy(() => import('@/features/maintenance/pages/DemandDetailPage'));
const GenerateDemandsPage = lazy(() => import('@/features/maintenance/pages/GenerateDemandsPage'));
const MaintenanceDashboardPage = lazy(() => import('@/features/maintenance/pages/MaintenanceDashboardPage'));
const PeriodListPage = lazy(() => import('@/features/maintenance/pages/PeriodListPage'));

/* Payments */
const PaymentListPage = lazy(() => import('@/features/payments/pages/PaymentListPage'));
const PaymentFormPage = lazy(() => import('@/features/payments/pages/PaymentFormPage'));
const PaymentDetailPage = lazy(() => import('@/features/payments/pages/PaymentDetailPage'));
const ReceiptViewPage = lazy(() => import('@/features/payments/pages/ReceiptViewPage'));

/* Ledger */
const LedgerPage = lazy(() => import('@/features/ledger/pages/LedgerPage'));

/* Complaints */
const ComplaintListPage = lazy(() => import('@/features/complaints/pages/ComplaintListPage'));
const ComplaintDetailPage = lazy(() => import('@/features/complaints/pages/ComplaintDetailPage'));

/* Visitors */
const VisitorListPage = lazy(() => import('@/features/visitors/pages/VisitorListPage'));
const VisitorFormPage = lazy(() => import('@/features/visitors/pages/VisitorFormPage'));

/* Notices */
const NoticeListPage = lazy(() => import('@/features/notices/pages/NoticeListPage'));
const NoticeDetailPage = lazy(() => import('@/features/notices/pages/NoticeDetailPage'));

/* Meetings */
const MeetingListPage = lazy(() => import('@/features/meetings/pages/MeetingListPage'));
const MeetingDetailPage = lazy(() => import('@/features/meetings/pages/MeetingDetailPage'));

/* Documents */
const DocumentListPage = lazy(() => import('@/features/documents/pages/DocumentListPage'));
const DocumentDetailPage = lazy(() => import('@/features/documents/pages/DocumentDetailPage'));

/* Parking */
const ParkingListPage = lazy(() => import('@/features/parking/pages/ParkingListPage'));
const ParkingSlotsPage = lazy(() => import('@/features/parking/pages/ParkingSlotsPage'));
const ParkingAllocationsPage = lazy(() => import('@/features/parking/pages/ParkingAllocationsPage'));

/* Employees */
const EmployeeListPage = lazy(() => import('@/features/employees/pages/EmployeeListPage'));
const EmployeeDetailPage = lazy(() => import('@/features/employees/pages/EmployeeDetailPage'));
const AttendancePage = lazy(() => import('@/features/employees/pages/AttendancePage'));
const SalaryPage = lazy(() => import('@/features/employees/pages/SalaryPage'));

/* Expenses */
const ExpenseListPage = lazy(() => import('@/features/expenses/pages/ExpenseListPage'));
const ExpenseDetailPage = lazy(() => import('@/features/expenses/pages/ExpenseDetailPage'));

/* Reports */
const ReportsPage = lazy(() => import('@/features/reports/pages/ReportsPage'));
const ReportDetailPage = lazy(() => import('@/features/reports/pages/ReportDetailPage'));

/* Settings */
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));

/* Backup & Audit */
const BackupListPage = lazy(() => import('@/features/backup/pages/BackupListPage'));
const BackupCreatePage = lazy(() => import('@/features/backup/pages/BackupCreatePage'));
const ArchiveRunPage = lazy(() => import('@/features/backup/pages/ArchiveRunPage'));
const ArchivedRecordsPage = lazy(() => import('@/features/backup/pages/ArchivedRecordsPage'));
const AuditListPage = lazy(() => import('@/features/audit/pages/AuditListPage'));
const AuditDetailPage = lazy(() => import('@/features/audit/pages/AuditDetailPage'));

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Spinner size="lg" />
    </div>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

          {/* Members & Flats */}
          <Route path="/flats" element={<FlatListPage />} />
          <Route path="/flats/new" element={<FlatFormPage />} />
          <Route path="/flats/:flatId" element={<FlatDetailPage />} />
          <Route path="/flats/:flatId/edit" element={<FlatFormPage />} />
          <Route path="/members" element={<MemberListPage />} />
          <Route path="/members/new" element={<MemberFormPage />} />
          <Route path="/members/:memberId" element={<MemberDetailPage />} />

          {/* Maintenance */}
          <Route path="/maintenance" element={<MaintenanceDashboardPage />} />
          <Route path="/maintenance/periods" element={<PeriodListPage />} />
          <Route path="/maintenance/demands" element={<DemandListPage />} />
          <Route path="/maintenance/demands/generate" element={<GenerateDemandsPage />} />
          <Route path="/maintenance/demands/:demandId" element={<DemandDetailPage />} />

          {/* Payments */}
          <Route path="/payments" element={<PaymentListPage />} />
          <Route path="/payments/new" element={<PaymentFormPage />} />
          <Route path="/payments/:paymentId" element={<PaymentDetailPage />} />
          <Route path="/receipts/:receiptId" element={<ReceiptViewPage />} />

          {/* Ledger */}
          <Route path="/ledger/:flatId" element={<LedgerPage />} />

          {/* Complaints */}
          <Route path="/complaints" element={<ComplaintListPage />} />
          <Route path="/complaints/:complaintId" element={<ComplaintDetailPage />} />

          {/* Visitors */}
          <Route path="/visitors" element={<VisitorListPage />} />
          <Route path="/visitors/new" element={<VisitorFormPage />} />

          {/* Notices */}
          <Route path="/notices" element={<NoticeListPage />} />
          <Route path="/notices/:noticeId" element={<NoticeDetailPage />} />

          {/* Meetings */}
          <Route path="/meetings" element={<MeetingListPage />} />
          <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />

          {/* Documents */}
          <Route path="/documents" element={<DocumentListPage />} />
          <Route path="/documents/:documentId" element={<DocumentDetailPage />} />

          {/* Parking */}
          <Route path="/parking" element={<ParkingListPage />} />
          <Route path="/parking/slots" element={<ParkingSlotsPage />} />
          <Route path="/parking/allocations" element={<ParkingAllocationsPage />} />

          {/* Employees */}
          <Route path="/employees" element={<EmployeeListPage />} />
          <Route path="/employees/:employeeId" element={<EmployeeDetailPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/salary" element={<SalaryPage />} />

          {/* Expenses */}
          <Route path="/expenses" element={<ExpenseListPage />} />
          <Route path="/expenses/:expenseId" element={<ExpenseDetailPage />} />

          {/* Reports */}
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/:reportKey" element={<ReportDetailPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/*" element={<SettingsPage />} />

          {/* Backup & Audit */}
          <Route path="/settings/backup" element={<BackupListPage />} />
          <Route path="/settings/backup/new" element={<BackupCreatePage />} />
          <Route path="/settings/backup/archive" element={<ArchiveRunPage />} />
          <Route path="/settings/backup/archived" element={<ArchivedRecordsPage />} />
          <Route path="/settings/audit" element={<AuditListPage />} />
          <Route path="/settings/audit/:auditId" element={<AuditDetailPage />} />

          <Route path="/forbidden" element={<Forbidden />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
