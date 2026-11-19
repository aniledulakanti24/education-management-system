import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider, useSession } from '@/lib/session'
import { AppShell } from '@/components/AppShell'
import { Skeleton, ToastProvider } from '@/components/ui'
import type { Role } from '@/types'
import LoginPage from '@/pages/LoginPage'
import { routerBase } from '@/lib/utils'

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const LearnersPage = lazy(() => import('@/pages/LearnersPage'))
const LearnerDetailPage = lazy(() => import('@/pages/LearnerDetailPage'))
const StaffPage = lazy(() => import('@/pages/StaffPage'))
const AcademicsPage = lazy(() => import('@/pages/AcademicsPage'))
const TimetablePage = lazy(() => import('@/pages/TimetablePage'))
const AttendancePage = lazy(() => import('@/pages/AttendancePage'))
const ResearchPage = lazy(() => import('@/pages/ResearchPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const AuditPage = lazy(() => import('@/pages/AuditPage'))
const TenantsPage = lazy(() => import('@/pages/platform/TenantsPage'))
const FrameworksPage = lazy(() => import('@/pages/platform/FrameworksPage'))
const LanguagesPage = lazy(() => import('@/pages/platform/LanguagesPage'))
const RoadmapPage = lazy(() => import('@/pages/RoadmapPage'))
const MyProfilePage = lazy(() => import('@/pages/MyProfilePage'))
const AdmissionsPage = lazy(() => import('@/pages/AdmissionsPage'))
const PublicApplyPage = lazy(() => import('@/pages/PublicApplyPage'))
const ExamsPage = lazy(() => import('@/pages/ExamsPage'))
const ResultsPage = lazy(() => import('@/pages/ResultsPage'))
const FeesPage = lazy(() => import('@/pages/FeesPage'))
const CommunicationPage = lazy(() => import('@/pages/CommunicationPage'))
const LibraryPage = lazy(() => import('@/pages/LibraryPage'))
const LearnPage = lazy(() => import('@/pages/LearnPage'))
const ClassPage = lazy(() => import('@/pages/ClassPage'))
const InsightsPage = lazy(() => import('@/pages/InsightsPage'))
const CredentialsPage = lazy(() => import('@/pages/CredentialsPage'))
const WalletPage = lazy(() => import('@/pages/WalletPage'))
const VerifyPage = lazy(() => import('@/pages/VerifyPage'))

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })

function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { me, loading } = useSession()
  if (loading) return <div className="p-6"><Loading /></div>
  if (!me) return <Navigate to="/login" replace />
  if (roles && !roles.includes(me.user.role)) return <Navigate to="/" replace />
  return (
    <AppShell>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </AppShell>
  )
}

const ADMIN: Role[] = ['INST_ADMIN']
const STAFFISH: Role[] = ['INST_ADMIN', 'FACULTY']

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          <BrowserRouter basename={routerBase}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Protected><DashboardPage /></Protected>} />
              <Route path="/learners" element={<Protected roles={STAFFISH}><LearnersPage /></Protected>} />
              <Route path="/learners/:id" element={<Protected roles={['INST_ADMIN', 'FACULTY', 'GUARDIAN']}><LearnerDetailPage /></Protected>} />
              <Route path="/me" element={<Protected roles={['STUDENT']}><MyProfilePage /></Protected>} />
              <Route path="/staff" element={<Protected roles={ADMIN}><StaffPage /></Protected>} />
              <Route path="/academics" element={<Protected roles={ADMIN}><AcademicsPage /></Protected>} />
              <Route path="/timetable" element={<Protected roles={['INST_ADMIN', 'FACULTY', 'STUDENT']}><TimetablePage /></Protected>} />
              <Route path="/attendance" element={<Protected roles={STAFFISH}><AttendancePage /></Protected>} />
              <Route path="/research" element={<Protected roles={['INST_ADMIN', 'FACULTY', 'STUDENT']}><ResearchPage /></Protected>} />
              <Route path="/settings" element={<Protected roles={ADMIN}><SettingsPage /></Protected>} />
              <Route path="/audit" element={<Protected roles={['INST_ADMIN', 'SUPER_ADMIN']}><AuditPage /></Protected>} />
              <Route path="/platform/tenants" element={<Protected roles={['SUPER_ADMIN']}><TenantsPage /></Protected>} />
              <Route path="/platform/frameworks" element={<Protected roles={['SUPER_ADMIN']}><FrameworksPage /></Protected>} />
              <Route path="/platform/languages" element={<Protected roles={['SUPER_ADMIN']}><LanguagesPage /></Protected>} />
              <Route path="/roadmap" element={<Protected><RoadmapPage /></Protected>} />
              <Route path="/admissions" element={<Protected roles={ADMIN}><AdmissionsPage /></Protected>} />
              <Route path="/exams" element={<Protected roles={STAFFISH}><ExamsPage /></Protected>} />
              <Route path="/results" element={<Protected roles={['STUDENT', 'GUARDIAN']}><ResultsPage /></Protected>} />
              <Route path="/fees" element={<Protected roles={['INST_ADMIN', 'STUDENT', 'GUARDIAN']}><FeesPage /></Protected>} />
              <Route path="/communication" element={<Protected roles={['INST_ADMIN', 'FACULTY', 'STUDENT', 'GUARDIAN']}><CommunicationPage /></Protected>} />
              <Route path="/learn" element={<Protected roles={['INST_ADMIN', 'FACULTY', 'STUDENT', 'GUARDIAN']}><LearnPage /></Protected>} />
              <Route path="/learn/:sectionId/:courseId" element={<Protected roles={['INST_ADMIN', 'FACULTY', 'STUDENT', 'GUARDIAN']}><ClassPage /></Protected>} />
              <Route path="/credentials" element={<Protected roles={ADMIN}><CredentialsPage /></Protected>} />
              <Route path="/wallet" element={<Protected roles={['STUDENT', 'GUARDIAN']}><WalletPage /></Protected>} />
              <Route path="/verify" element={<Suspense fallback={<div className="p-6"><Loading /></div>}><VerifyPage /></Suspense>} />
              <Route path="/verify/:id" element={<Suspense fallback={<div className="p-6"><Loading /></div>}><VerifyPage /></Suspense>} />
              <Route path="/insights" element={<Protected roles={STAFFISH}><InsightsPage /></Protected>} />
              <Route path="/library" element={<Protected roles={['INST_ADMIN', 'STUDENT', 'GUARDIAN']}><LibraryPage /></Protected>} />
              <Route path="/apply/:subdomain" element={<Suspense fallback={<div className="p-6"><Loading /></div>}><PublicApplyPage /></Suspense>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
