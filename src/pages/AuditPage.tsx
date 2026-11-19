import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { api } from '@/lib/api'
import { useFormat } from '@/lib/session'
import type { AuditEntry } from '@/types'
import { Badge, Card, EmptyState, PageHeader, Skeleton, Table, Td, Th } from '@/components/ui'

export default function AuditPage() {
  const { t } = useTranslation()
  const f = useFormat()
  const { data, isLoading } = useQuery({ queryKey: ['audit'], queryFn: () => api.get<AuditEntry[]>('/audit') })
  return (
    <>
      <PageHeader title={t('nav.audit')} description="Every change is recorded with actor and time (GDPR / DPDP accountability)." />
      <Card>
        {isLoading ? <Skeleton className="m-4 h-64" /> : !data?.length ? <EmptyState icon={<ScrollText />} title={t('common.noData')} /> : (
          <Table>
            <thead><tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap text-muted-foreground">{f.date(a.at, { dateStyle: 'medium', timeStyle: 'short' })}</Td>
                  <Td className="font-medium">{a.actor}</Td>
                  <Td>{a.action}</Td>
                  <Td><Badge variant="muted">{a.entity}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
