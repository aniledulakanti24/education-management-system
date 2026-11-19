import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookMarked, CheckCircle2, Circle, FlaskConical, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { STAGE_LABEL, type ScholarRow } from '@/lib/apiTypes'
import { errorMessage } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { cn } from '@/lib/utils'
import type { ResearchStage } from '@/types'
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, PageHeader, Progress, Skeleton, useToast } from '@/components/ui'

const STAGES: ResearchStage[] = ['COURSEWORK', 'SYNOPSIS', 'DATA_COLLECTION', 'WRITING', 'PRE_SUBMISSION', 'UNDER_REVIEW', 'VIVA', 'AWARDED']

export default function ResearchPage() {
  const { t } = useTranslation()
  const { user } = useMe()
  const { data, isLoading } = useQuery({ queryKey: ['scholars'], queryFn: () => api.get<ScholarRow[]>('/research/scholars') })
  const [stage, setStage] = useState<ResearchStage | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)
  const list = (data ?? []).filter((r) => !stage || r.stage === stage)
  const open = data?.find((r) => r.learnerId === openId)

  return (
    <>
      <PageHeader
        title={t('nav.research')}
        description={user.role === 'FACULTY' ? 'Scholars you supervise' : user.role === 'STUDENT' ? 'Your doctoral journey' : 'Doctoral lifecycle — registration to award'}
      />
      {isLoading ? <Skeleton className="h-80" /> : !data?.length ? <Card><EmptyState icon={<FlaskConical />} title={t('common.noData')} /></Card> : (
        <>
          <Card className="mb-4 overflow-x-auto p-4">
            <div className="flex min-w-[720px] gap-2">
              {STAGES.map((s, i) => {
                const n = data.filter((r) => r.stage === s).length
                return (
                  <button
                    key={s}
                    onClick={() => setStage(stage === s ? '' : s)}
                    className={cn('flex-1 cursor-pointer rounded-lg border p-3 text-start transition', stage === s ? 'border-brand bg-brand-soft' : 'border-border hover:bg-muted')}
                  >
                    <p className="text-xs text-muted-foreground">{i + 1}. {STAGE_LABEL[s]}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{n}</p>
                  </button>
                )
              })}
            </div>
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((r) => {
              const done = r.milestones.filter((m) => m.done).length
              return (
                <button key={r.learnerId} className="cursor-pointer text-start" onClick={() => setOpenId(r.learnerId)}>
                  <Card className="h-full p-4 transition hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <Avatar name={r.scholarName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{r.scholarName}</p>
                          <Badge variant="info">{STAGE_LABEL[r.stage]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.programName} · {r.area}</p>
                        <p className="mt-2 line-clamp-2 text-sm">{r.topic}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Supervisor: {r.supervisorName}{r.coSupervisorName ? ` · Co: ${r.coSupervisorName}` : ''}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <Progress value={(done / r.milestones.length) * 100} className="flex-1" />
                          <span className="text-xs tabular-nums text-muted-foreground">{done}/{r.milestones.length}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><BookMarked className="size-3" />{r.publications}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </button>
              )
            })}
          </div>
          <Card className="mt-4">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-muted-foreground" />Coming in Phase 3</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              RAC/DRC committee meetings, six-monthly progress reports, plagiarism checks (iThenticate / Shodhganga), examiner allocation, viva scheduling, ORCID / Scopus publication sync, grants & lab booking.
            </CardContent>
          </Card>
        </>
      )}
      {open && <ScholarDialog r={open} onClose={() => setOpenId(null)} />}
    </>
  )
}

function ScholarDialog({ r, onClose }: { r: ScholarRow; onClose: () => void }) {
  const { user } = useMe()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const canEdit = user.role === 'INST_ADMIN' || (user.role === 'FACULTY' && (r.supervisorId === user.personId || r.coSupervisorId === user.personId))
  const toggle = useMutation({
    mutationFn: (i: number) => api.patch(`/research/${r.learnerId}/milestones/${i}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scholars'] }),
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  return (
    <Dialog open onClose={onClose} title={r.scholarName} description={`${r.programName} · registered ${f.date(r.registeredOn)}`} wide footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      <p className="font-medium">{r.topic}</p>
      <p className="mt-1 text-sm text-muted-foreground">{r.area} · Supervisor {r.supervisorName}{r.coSupervisorName ? ` · Co-supervisor ${r.coSupervisorName}` : ''}</p>
      <h3 className="mb-2 mt-5 text-sm font-semibold">Milestones {canEdit && <span className="font-normal text-muted-foreground">— click to update</span>}</h3>
      <ol className="space-y-2">
        {r.milestones.map((m, i) => (
          <li key={m.label}>
            <button
              disabled={!canEdit || toggle.isPending}
              onClick={() => toggle.mutate(i)}
              className={cn('flex w-full items-center gap-3 rounded-lg border border-border p-3 text-start text-sm', canEdit && 'cursor-pointer hover:bg-muted')}
            >
              {m.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground" />}
              <span className={cn('flex-1', m.done && 'text-muted-foreground line-through')}>{m.label}</span>
              <span className="text-xs text-muted-foreground">{f.date(m.due)}</span>
            </button>
          </li>
        ))}
      </ol>
    </Dialog>
  )
}
