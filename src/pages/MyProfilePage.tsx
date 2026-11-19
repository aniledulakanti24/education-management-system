import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { LearnerSummary } from '@/lib/apiTypes'
import { useMe } from '@/lib/session'
import { Skeleton } from '@/components/ui'
import { LearnerProfile } from './LearnerDetailPage'

export default function MyProfilePage() {
  const { user } = useMe()
  const { data } = useQuery({ queryKey: ['learner', user.personId], queryFn: () => api.get<LearnerSummary>(`/learners/${user.personId}`) })
  return data ? <LearnerProfile s={data} /> : <Skeleton className="h-96" />
}
