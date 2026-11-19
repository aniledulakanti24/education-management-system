import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, RefreshCw, Sparkles } from 'lucide-react'
import { api, qs } from '@/lib/api'
import type { LearnerSummary, ScheduleProposalView, SlotRow } from '@/lib/apiTypes'
import { errorMessage, useAcademics, useStaff } from '@/lib/queries'
import { useFormat, useMe, useSession } from '@/lib/session'
import { cn, isoWeekday } from '@/lib/utils'
import type { Period } from '@/types'
import { Button, Card, Dialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, Tabs, useToast } from '@/components/ui'

interface TimetableResponse { slots: SlotRow[]; periods: Period[]; weekDays: number[] }
type Query = { sectionId?: string; staffId?: string }

const COURSE_COLORS = [
  'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100', 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100', 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
  'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100', 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100',
  'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100', 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100',
]
const colorFor = (id: string) => COURSE_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COURSE_COLORS.length]

export function TimetableGrid({ query, editable }: { query: Query; editable?: boolean }) {
  const f = useFormat()
  const { data, isLoading } = useQuery({
    queryKey: ['timetable', query],
    queryFn: () => api.get<TimetableResponse>(`/timetable${qs(query)}`),
    enabled: !!(query.sectionId || query.staffId),
  })
  const [editing, setEditing] = useState<{ day: number; period: number; slot?: SlotRow } | null>(null)
  if (!query.sectionId && !query.staffId) return <EmptyState icon={<CalendarDays />} title="Choose a section or teacher" />
  if (isLoading || !data) return <Skeleton className="h-80" />
  const today = isoWeekday(new Date())
  const bySection = !!query.sectionId

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-24" />
              {data.weekDays.map((d) => (
                <th key={d} className={cn('rounded-md px-2 py-2 text-xs font-medium uppercase tracking-wide', d === today ? 'bg-brand text-brand-foreground' : 'text-muted-foreground')}>
                  {f.weekday(d, 'long')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.periods.map((p) => (
              <tr key={p.no}>
                <td className="px-2 text-xs text-muted-foreground">
                  <span className="block font-medium text-foreground">P{p.no}</span>
                  {p.start}–{p.end}
                </td>
                {data.weekDays.map((d) => {
                  const slot = data.slots.find((s) => s.day === d && s.period === p.no)
                  const cell = slot ? (
                    <div className={cn('h-full rounded-lg p-2 text-start', colorFor(slot.courseId))}>
                      <p className="line-clamp-2 font-medium leading-tight">{slot.courseName}</p>
                      <p className="mt-1 truncate text-xs opacity-75">{bySection ? slot.staffName : slot.sectionName} · {slot.room}</p>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-14 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">{editable ? '+' : 'Free'}</div>
                  )
                  return (
                    <td key={d} className="h-16 align-top">
                      {editable && bySection ? (
                        <button className="h-full w-full cursor-pointer transition hover:opacity-80" onClick={() => setEditing({ day: d, period: p.no, slot })}>{cell}</button>
                      ) : cell}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && editing && query.sectionId && (
        <SlotDialog sectionId={query.sectionId} day={editing.day} period={editing.period} slot={editing.slot} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

function SlotDialog({ sectionId, day, period, slot, onClose }: { sectionId: string; day: number; period: number; slot?: SlotRow; onClose: () => void }) {
  const { t } = useTranslation()
  const f = useFormat()
  const academics = useAcademics()
  const staff = useStaff()
  const qc = useQueryClient()
  const toast = useToast()
  const section = academics.data?.sections.find((s) => s.id === sectionId)
  const courses = academics.data?.courses.filter((c) => c.programId === section?.programId && (section?.semester === undefined || c.semester === section.semester)) ?? []
  const [courseId, setCourseId] = useState(slot?.courseId ?? courses[0]?.id ?? '')
  const [staffId, setStaffId] = useState(slot?.staffId ?? '')
  const [room, setRoom] = useState(slot?.room ?? section?.room ?? '')
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['timetable'] })
    onClose()
  }
  const save = useMutation({
    mutationFn: () => api.put('/timetable/slots', { sectionId, day, period, courseId, staffId, room }),
    onSuccess: () => { toast('Timetable updated'); done() },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const clear = useMutation({ mutationFn: () => api.del(`/timetable/slots/${slot!.id}`), onSuccess: () => { toast('Slot cleared'); done() } })
  const suggested = staff.data?.filter((s) => s.courseIds.includes(courseId)) ?? []
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${section?.name} · ${f.weekday(day, 'long')} · P${period}`}
      description="Teacher clashes are checked automatically."
      footer={
        <>
          {slot && <Button variant="ghost" className="me-auto text-danger" loading={clear.isPending} onClick={() => clear.mutate()}>Clear slot</Button>}
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={!courseId || !staffId} loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Course / subject">{(id) => (
          <Select id={id} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}</Field>
        <Field label="Teacher" hint={suggested.length ? `Usually taught by: ${suggested.map((s) => s.name).join(', ')}` : undefined}>{(id) => (
          <Select id={id} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">—</option>
            {staff.data?.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.department}</option>)}
          </Select>
        )}</Field>
        <Field label="Room">{(id) => <Input id={id} value={room} onChange={(e) => setRoom(e.target.value)} />}</Field>
      </div>
    </Dialog>
  )
}

export default function TimetablePage() {
  const { t } = useTranslation()
  const { user } = useMe()
  const isAdmin = user.role === 'INST_ADMIN'
  const academics = useAcademics()
  const staff = useStaff(isAdmin)
  const [mode, setMode] = useState<'section' | 'teacher'>('section')
  const [solving, setSolving] = useState(false)
  const [sectionId, setSectionId] = useState('')
  const [staffId, setStaffId] = useState('')
  const me = useQuery({
    queryKey: ['learner', user.personId],
    queryFn: () => api.get<LearnerSummary>(`/learners/${user.personId}`),
    enabled: user.role === 'STUDENT',
  })

  let query: Query = {}
  if (user.role === 'FACULTY') query = { staffId: user.personId }
  else if (user.role === 'STUDENT') query = { sectionId: me.data?.learner.sectionId }
  else query = mode === 'section' ? { sectionId: sectionId || academics.data?.sections[0]?.id } : { staffId: staffId || staff.data?.[0]?.id }

  return (
    <>
      <PageHeader
        title={isAdmin ? t('nav.timetable') : t('nav.myTimetable')}
        description={isAdmin ? 'Click any cell to assign a course and teacher.' : user.role === 'STUDENT' ? me.data?.learner.sectionName : user.title}
        actions={isAdmin && (
          <Button variant="outline" disabled={mode !== 'section' || !query.sectionId} onClick={() => setSolving(true)} title={mode !== 'section' ? 'Switch to a section to auto-schedule it' : undefined}>
            <Sparkles />AI auto-schedule
          </Button>
        )}
      />
      {isAdmin && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
          <Tabs value={mode} onChange={setMode} items={[{ value: 'section', label: t('common.section') }, { value: 'teacher', label: 'Teacher' }]} />
          {mode === 'section' ? (
            <Select className="w-auto min-w-64" value={query.sectionId ?? ''} onChange={(e) => setSectionId(e.target.value)} aria-label={t('common.section')}>
              {academics.data?.programs.map((p) => (
                <optgroup key={p.id} label={p.name}>
                  {academics.data!.sections.filter((s) => s.programId === p.id).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.termLabel}</option>)}
                </optgroup>
              ))}
            </Select>
          ) : (
            <Select className="w-auto min-w-64" value={query.staffId ?? ''} onChange={(e) => setStaffId(e.target.value)} aria-label="Teacher">
              {staff.data?.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.department}</option>)}
            </Select>
          )}
        </Card>
      )}
      <Card className="p-4">
        <TimetableGrid query={query} editable={isAdmin} />
      </Card>
      {solving && query.sectionId && <AutoScheduleDialog sectionId={query.sectionId} onClose={() => setSolving(false)} />}
    </>
  )
}

function AutoScheduleDialog({ sectionId, onClose }: { sectionId: string; onClose: () => void }) {
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const { me } = useSession()
  const [proposal, setProposal] = useState<ScheduleProposalView | null>(null)
  const propose = useMutation({
    mutationFn: () => api.post<ScheduleProposalView>(`/ai/timetable/${sectionId}/propose`),
    onSuccess: setProposal,
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const apply = useMutation({
    mutationFn: () => api.post(`/ai/timetable/${sectionId}/apply`, { slots: proposal!.slots.map(({ courseName: _c, staffName: _s, ...s }) => { void _c; void _s; return s }) }),
    onSuccess: () => {
      toast('AI timetable applied')
      void qc.invalidateQueries({ queryKey: ['timetable'] })
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  useEffect(() => { propose.mutate() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const periods = me?.periods ?? []
  const days = [...new Set(proposal?.slots.map((s) => s.day) ?? [])].sort()
  return (
    <Dialog open onClose={onClose} wide title="AI auto-schedule" description="Constraint solver: no teacher clashes across sections, subjects spread over the week, labs as double periods."
      footer={<>
        <Button variant="ghost" className="me-auto" loading={propose.isPending} onClick={() => propose.mutate()}><RefreshCw />Try another layout</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!proposal} loading={apply.isPending} onClick={() => apply.mutate()}>Apply to timetable</Button>
      </>}>
      {!proposal ? <Skeleton className="h-72" /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Quality score', proposal.metrics.score],
              ['Teacher clashes', proposal.metrics.clashes],
              ['Free periods', proposal.unfilled],
              ['Substitute periods', proposal.metrics.substitutes],
            ].map(([k, v]) => <div key={k} className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
              <thead><tr><th />{days.map((d) => <th key={d} className="py-1 font-medium text-muted-foreground">{f.weekday(d)}</th>)}</tr></thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.no}>
                    <td className="pe-2 text-muted-foreground">P{p.no}</td>
                    {days.map((d) => {
                      const s = proposal.slots.find((x) => x.day === d && x.period === p.no)
                      return <td key={d} className={cn('rounded-md p-1.5 align-top', s ? colorFor(s.courseId) : 'border border-dashed border-border')}>{s ? <><p className="line-clamp-1 font-medium">{s.courseName}</p><p className="line-clamp-1 opacity-75">{s.staffName}</p></> : ''}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-1 text-xs sm:grid-cols-2">
            {proposal.demand.map((d) => <p key={d.courseId} className="flex justify-between gap-2"><span>{d.courseName}</span><span className="tabular-nums text-muted-foreground">{d.placed}/{d.periods} periods</span></p>)}
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">{proposal.notes.map((n) => <li key={n}>• {n}</li>)}</ul>
        </div>
      )}
    </Dialog>
  )
}
