import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Dashboard } from '@/lib/apiTypes'
import { useMe } from '@/lib/session'
import { PageHeader, Skeleton, Tabs } from '@/components/ui'
import { ReportCardView } from '@/components/ReportCardView'

/** Report cards for a learner (own) or a guardian (choose a child). */
export default function ResultsPage() {
  const { user } = useMe()
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/dashboard'), enabled: user.role === 'GUARDIAN' })
  const children = dash.data?.kind === 'guardian' ? dash.data.children.map((c) => ({ id: c.learner.id, name: c.learner.firstName })) : []
  const [childId, setChildId] = useState<string | null>(null)
  const learnerId = user.role === 'STUDENT' ? user.personId : childId ?? children[0]?.id

  return (
    <>
      <PageHeader title="Results" description="Published assessments and term progress" />
      {user.role === 'GUARDIAN' && children.length > 1 && (
        <Tabs className="mb-4" value={learnerId ?? ''} onChange={setChildId} items={children.map((c) => ({ value: c.id, label: c.name }))} />
      )}
      {learnerId ? <ReportCardView learnerId={learnerId} /> : <Skeleton className="h-96" />}
    </>
  )
}
