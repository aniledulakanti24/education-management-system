import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCheck, CheckCircle2, ClipboardCheck, MessageSquareWarning } from 'lucide-react'
import { api, qs } from '@/lib/api'
import { errorMessage } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { cn, todayIso } from '@/lib/utils'
import type { AttendanceSheet, AttendanceStatus, Learner, Section } from '@/types'
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Progress, Skeleton, useToast } from '@/components/ui'
import { STATUS_KEY, STATUS_STYLE } from '@/components/learner-widgets'

interface Overview {
  date: string
  isWorkingDay: boolean
  sections: { sectionId: string; sectionName: string; programName: string; strength: number; marked: boolean; present: number; absent: number; isClassTeacher: boolean }[]
}

export default function AttendancePage() {
  const { t } = useTranslation()
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(todayIso())
  const sectionId = params.get('section')
  const { data, isLoading } = useQuery({ queryKey: ['attendance-overview', date], queryFn: () => api.get<Overview>(`/attendance/overview${qs({ date })}`) })

  if (sectionId) return <MarkSheet sectionId={sectionId} date={date} onBack={() => setParams({})} />

  const marked = data?.sections.filter((s) => s.marked).length ?? 0
  const total = data?.sections.length ?? 0
  const sorted = [...(data?.sections ?? [])].sort((a, b) => Number(b.isClassTeacher) - Number(a.isClassTeacher) || Number(a.marked) - Number(b.marked))

  return (
    <>
      <PageHeader
        title={t('nav.attendance')}
        description={f.date(date, { dateStyle: 'full' })}
        actions={<Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value || todayIso())} aria-label={t('att.date')} className="w-auto" />}
      />
      {data && !data.isWorkingDay && <Card className="mb-4 p-4 text-sm text-muted-foreground">{t('att.holiday')}</Card>}
      <Card className="mb-4 p-4">
        <div className="mb-2 flex justify-between text-sm"><span>{t('dash.markedToday')}</span><span className="font-medium tabular-nums">{marked} / {total}</span></div>
        <Progress value={total ? (marked / total) * 100 : 0} tone={marked === total && total > 0 ? 'success' : 'brand'} />
      </Card>
      {isLoading ? <Skeleton className="h-64" /> : !sorted.length ? <Card><EmptyState icon={<ClipboardCheck />} title={t('common.noData')} /></Card> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => (
            <button key={s.sectionId} className="cursor-pointer text-start" onClick={() => setParams({ section: s.sectionId })}>
              <Card className="h-full p-4 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{s.sectionName}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.programName}</p>
                  </div>
                  {s.marked ? <Badge variant="success"><CheckCircle2 className="size-3" />{t('att.marked')}</Badge> : <Badge variant="warning">{t('att.notMarked')}</Badge>}
                </div>
                <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{s.strength} learners</span>
                  {s.marked && <><span className="text-success">{s.present} {t('common.present').toLowerCase()}</span><span className="text-danger">{s.absent} {t('common.absent').toLowerCase()}</span></>}
                  {s.isClassTeacher && <Badge variant="info" className="ms-auto">Class teacher</Badge>}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function MarkSheet({ sectionId, date, onBack }: { sectionId: string; date: string; onBack: () => void }) {
  const { t } = useTranslation()
  const f = useFormat()
  const toast = useToast()
  const qc = useQueryClient()
  const { tenant } = useMe()
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-sheet', sectionId, date],
    queryFn: () => api.get<{ section: Section; learners: Learner[]; sheet: AttendanceSheet | null }>(`/attendance/sheet${qs({ sectionId, date })}`),
  })
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  useEffect(() => {
    if (data) setMarks(data.sheet?.marks ?? Object.fromEntries(data.learners.map((l) => [l.id, 'P' as AttendanceStatus])))
  }, [data])
  const counts = useMemo(() => {
    const c = { P: 0, A: 0, L: 0, E: 0 }
    Object.values(marks).forEach((m) => c[m]++)
    return c
  }, [marks])

  const save = useMutation({
    mutationFn: () => api.put<{ notifiedGuardians: number }>('/attendance/sheet', { sectionId, date, marks }),
    onSuccess: (r) => {
      toast(`${t('att.saved')}${r.notifiedGuardians ? ` · ${r.notifiedGuardians} guardian alert(s) queued (SMS/WhatsApp — simulated)` : ''}`)
      void qc.invalidateQueries({ queryKey: ['attendance-overview'] })
      void qc.invalidateQueries({ queryKey: ['attendance-sheet'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      onBack()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })

  if (isLoading || !data) return <Skeleton className="h-96" />
  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={onBack}><ArrowLeft className="rtl:rotate-180" />{t('common.back')}</Button>
      <PageHeader
        title={`${t('att.mark')} · ${data.section.name}`}
        description={`${f.date(date, { dateStyle: 'full' })}${data.sheet ? ` · last saved ${f.date(data.sheet.markedAt, { timeStyle: 'short', dateStyle: 'short' })}` : ''}`}
        actions={<Button variant="outline" onClick={() => setMarks(Object.fromEntries(data.learners.map((l) => [l.id, 'P'])))}><CheckCheck />{t('att.markAll')}</Button>}
      />
      <Card>
        <ul className="divide-y divide-border">
          {data.learners.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="w-8 text-sm tabular-nums text-muted-foreground">{l.rollNo}</span>
              <Avatar name={`${l.firstName} ${l.lastName}`} />
              <span className="min-w-32 flex-1 font-medium">{l.firstName} {l.lastName}</span>
              <div className="flex gap-1" role="radiogroup" aria-label={`${l.firstName} ${l.lastName}`}>
                {(['P', 'A', 'L', 'E'] as AttendanceStatus[]).map((s) => (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={marks[l.id] === s}
                    title={t(STATUS_KEY[s])}
                    onClick={() => setMarks((m) => ({ ...m, [l.id]: s }))}
                    className={cn('h-9 min-w-11 cursor-pointer rounded-lg border border-border px-2 text-sm font-semibold transition', marks[l.id] === s ? STATUS_STYLE[s] + ' border-transparent' : 'bg-card text-muted-foreground hover:bg-muted')}
                  >
                    {t(STATUS_KEY[s]).slice(0, 1)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-card p-4">
          <div className="flex flex-wrap gap-3 text-sm">
            {(['P', 'A', 'L', 'E'] as AttendanceStatus[]).map((s) => <span key={s}>{t(STATUS_KEY[s])}: <b className="tabular-nums">{counts[s]}</b></span>)}
          </div>
          {counts.A > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageSquareWarning className="size-4" />Guardians of absent learners will be notified{tenant?.country === 'IN' ? ' via SMS / WhatsApp' : ''}</span>
          )}
          <Button className="ms-auto" loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
        </div>
      </Card>
    </>
  )
}
