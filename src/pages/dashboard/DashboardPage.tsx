import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Dashboard } from '@/lib/apiTypes'
import { Card, EmptyState, Skeleton } from '@/components/ui'
import AdminDashboardView from './AdminDashboard'
import FacultyDashboardView from './FacultyDashboard'
import StudentDashboardView from './StudentDashboard'
import GuardianDashboardView from './GuardianDashboard'
import SuperDashboardView from './SuperDashboard'

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/dashboard') })
  if (isLoading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
  if (error || !data) return <Card><EmptyState title="Could not load dashboard" description={(error as Error)?.message} /></Card>
  switch (data.kind) {
    case 'admin': return <AdminDashboardView d={data} />
    case 'faculty': return <FacultyDashboardView d={data} />
    case 'student': return <StudentDashboardView d={data} />
    case 'guardian': return <GuardianDashboardView d={data} />
    case 'super': return <SuperDashboardView d={data} />
  }
}
