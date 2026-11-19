import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, BadgeCheck, Eye, EyeOff, IdCard, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import type { CredentialRow, Dashboard } from '@/lib/apiTypes'
import { errorMessage } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { appHostPath, cn } from '@/lib/utils'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, Tabs, useToast } from '@/components/ui'
import { CredentialDialog } from './CredentialsPage'
import { CreditStatementView } from '@/components/CreditStatement'

export default function WalletPage() {
  const { user, tenant } = useMe()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['credentials', 'wallet'], queryFn: () => api.get<CredentialRow[]>('/credentials') })
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/dashboard') })
  const learners = dash.data?.kind === 'guardian' ? dash.data.children.map((c) => c.learner) : dash.data?.kind === 'student' ? [dash.data.learner] : []
  const [child, setChild] = useState<string | null>(null)
  const learner = learners.find((l) => l.id === child) ?? learners[0]
  const share = useMutation({
    mutationFn: ({ id, shared }: { id: string; shared: boolean }) => api.patch(`/credentials/${id}/share`, { shared }),
    onSuccess: (_, v) => { toast(v.shared ? 'Anyone with the link or QR code can verify it' : 'Hidden — the link and QR code stop working'); void qc.invalidateQueries({ queryKey: ['credentials'] }) },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const mine = (data ?? []).filter((c) => !learner || c.learnerId === learner.id)
  const creditBased = learner && ['UG', 'PG', 'PHD', 'DIPLOMA'].includes(learner.level)

  return (
    <>
      <PageHeader title="Credential wallet" description="Your verifiable certificates, badges and transcripts — you control who can see them" />
      {learners.length > 1 && <Tabs className="mb-4" value={learner?.id ?? ''} onChange={setChild} items={learners.map((l) => ({ value: l.id, label: l.firstName }))} />}
      {learner && (
        <Card className="mb-4 flex flex-wrap items-center gap-4 p-4 text-sm">
          <IdCard className="size-6 text-brand" />
          <div className="flex-1">
            <p className="font-medium">{learner.firstName} {learner.lastName}</p>
            <p className="text-muted-foreground">Lifelong learner ID <span className="font-mono">{learner.id.toUpperCase()}</span></p>
          </div>
          {tenant?.country === 'IN' && (
            <div className="flex flex-wrap gap-2">
              <Badge variant={learner.apaarId ? 'success' : 'muted'}>{learner.apaarId ? `APAAR ${learner.apaarId} · linked` : 'APAAR not linked'}</Badge>
              {learner.abcId && <Badge variant="success">ABC {learner.abcId}</Badge>}
            </div>
          )}
        </Card>
      )}

      {isLoading ? <Skeleton className="h-64" /> : !mine.length ? <Card><EmptyState icon={<Award />} title="No credentials yet" description="Certificates, badges and transcripts appear here when your institution issues them." /></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mine.map((c) => {
            const badge = c.template === 'ATTENDANCE_BADGE' || c.template === 'COURSE_COMPLETION'
            return (
              <Card key={c.id} className={cn('flex flex-col p-4', c.status === 'REVOKED' && 'opacity-70')}>
                <button className="flex cursor-pointer items-start gap-3 text-start" onClick={() => setOpenId(c.id)}>
                  <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', badge ? 'bg-warning/15 text-warning' : 'bg-brand-soft text-brand')}>
                    {badge ? <Award className="size-6" /> : <BadgeCheck className="size-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted-foreground">Issued {f.date(c.issuedAt)} · {tenant?.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant={c.status === 'ACTIVE' ? 'success' : 'danger'}>{c.status === 'ACTIVE' ? 'verified' : 'revoked'}</Badge>
                      {c.digilocker && <Badge variant="info">In DigiLocker</Badge>}
                    </div>
                  </div>
                </button>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{c.shared ? <><Eye className="size-3.5" />Shareable</> : <><EyeOff className="size-3.5" />Private</>}</span>
                  {user.role === 'STUDENT' || user.role === 'GUARDIAN' ? (
                    <Button size="sm" variant="ghost" disabled={c.status === 'REVOKED'} onClick={() => share.mutate({ id: c.id, shared: !c.shared })}>{c.shared ? 'Make private' : 'Allow sharing'}</Button>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {creditBased && <div className="mt-6"><CreditStatementView learnerId={learner.id} /></div>}

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" />Employers and universities can check any credential at <span className="font-mono">{appHostPath('/verify')}</span> — no account needed. Only you decide which credentials are shareable.</p>
      {openId && <CredentialDialog id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
