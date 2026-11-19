import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarPlus, ClipboardList, Lock, PencilLine, Send, Trophy, TriangleAlert } from 'lucide-react'
import { api, qs } from '@/lib/api'
import type { ExamAnalysis, ExamRow, ExamSheet, PendingMark } from '@/lib/apiTypes'
import { FRAMEWORKS, gradeFor } from '@/lib/frameworks'
import { errorMessage, useAcademics } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { cn } from '@/lib/utils'
import type { Assessment } from '@/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Field, Input, PageHeader, Progress, Select, Skeleton, Table, Td, Th, useToast } from '@/components/ui'

const STATUS_TONE = { SCHEDULED: 'muted', MARKS_ENTRY: 'warning', PUBLISHED: 'success' } as const
const STATUS_LABEL = { SCHEDULED: 'Scheduled', MARKS_ENTRY: 'Marks entry open', PUBLISHED: 'Results published' }
const KIND_LABEL: Record<Assessment['kind'], string> = { UNIT_TEST: 'Unit test', MIDTERM: 'Mid-term', FINAL: 'Final', INTERNAL: 'Internal', PRACTICAL: 'Practical' }

export default function ExamsPage() {
  const [params, setParams] = useSearchParams()
  const a = params.get('a')
  const section = params.get('section')
  const course = params.get('course')
  if (a && section && course) return <MarksEntry assessmentId={a} sectionId={section} courseId={course} onBack={() => setParams({ a, section })} />
  if (a) return <AssessmentDetail assessmentId={a} sectionId={section} onSection={(s) => setParams({ a, section: s })} onOpen={(s, c) => setParams({ a, section: s, course: c })} onBack={() => setParams({})} />
  return <ExamList onOpen={(id, s, c) => setParams(Object.fromEntries(Object.entries({ a: id, section: s, course: c }).filter(([, v]) => v)) as Record<string, string>)} />
}

function ExamList({ onOpen }: { onOpen: (id: string, section?: string, course?: string) => void }) {
  const { user, tenant } = useMe()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const isAdmin = user.role === 'INST_ADMIN'
  const [scheduling, setScheduling] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['exams'], queryFn: () => api.get<{ items: ExamRow[]; myPending: PendingMark[] }>('/exams') })
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Assessment['status'] }) => api.patch(`/exams/${id}`, { status }),
    onSuccess: (_, v) => {
      toast(v.status === 'PUBLISHED' ? 'Results published — learners and parents notified' : 'Marks entry opened for teachers')
      void qc.invalidateQueries()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const pack = tenant ? FRAMEWORKS[tenant.framework] : null

  return (
    <>
      <PageHeader
        title="Exams & gradebook"
        description={pack ? `${pack.gradingScheme}` : undefined}
        actions={isAdmin && <Button onClick={() => setScheduling(true)}><CalendarPlus />Schedule assessment</Button>}
      />
      {!!data?.myPending.length && (
        <Card className="mb-4 border-warning">
          <CardHeader><CardTitle className="flex items-center gap-2"><PencilLine className="size-5 text-warning" />Marks you still need to enter</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.myPending.map((p) => (
              <button key={`${p.assessmentId}${p.sectionId}${p.courseId}`} onClick={() => onOpen(p.assessmentId, p.sectionId, p.courseId)} className="cursor-pointer rounded-lg border border-border p-3 text-start text-sm hover:bg-muted">
                <p className="font-medium">{p.courseName}</p>
                <p className="text-xs text-muted-foreground">{p.sectionName} · {p.assessmentName}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
      {isLoading ? <Skeleton className="h-64" /> : !data?.items.length ? <Card><EmptyState icon={<ClipboardList />} title="No assessments yet" /></Card> : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.items.map((e) => {
            const progress = e.expected ? Math.round((e.entered / e.expected) * 100) : 0
            return (
              <Card key={e.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{KIND_LABEL[e.kind]} · {f.date(e.startDate)} · max {e.maxMarks} · weight {e.weight}%</p>
                  </div>
                  <Badge variant={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Progress value={progress} tone={progress === 100 ? 'success' : 'brand'} className="flex-1" />
                  <span className="text-xs tabular-nums text-muted-foreground">{e.entered}/{e.expected} mark sheets</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {e.status !== 'SCHEDULED' && <Button size="sm" variant="outline" onClick={() => onOpen(e.id)}>Analyse & marks</Button>}
                  {isAdmin && e.status === 'SCHEDULED' && <Button size="sm" variant="soft" loading={setStatus.isPending} onClick={() => setStatus.mutate({ id: e.id, status: 'MARKS_ENTRY' })}><PencilLine />Open marks entry</Button>}
                  {isAdmin && e.status === 'MARKS_ENTRY' && (
                    <Button size="sm" loading={setStatus.isPending} onClick={() => (progress === 100 || confirm(`Only ${progress}% of mark sheets are complete. Publish anyway?`)) && setStatus.mutate({ id: e.id, status: 'PUBLISHED' })}>
                      <Send />Publish results
                    </Button>
                  )}
                  {e.status === 'PUBLISHED' && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3" />Marks locked</span>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {scheduling && <ScheduleDialog onClose={() => setScheduling(false)} />}
    </>
  )
}

function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const academics = useAcademics()
  const qc = useQueryClient()
  const toast = useToast()
  const programs = academics.data?.programs.filter((p) => p.level !== 'PRE_PRIMARY' && p.level !== 'PHD') ?? []
  const [form, setForm] = useState({ name: '', kind: 'UNIT_TEST', maxMarks: 50, weight: 10, startDate: '', programIds: [] as string[] })
  const m = useMutation({
    mutationFn: () => api.post('/exams', form),
    onSuccess: () => { toast('Assessment scheduled'); void qc.invalidateQueries({ queryKey: ['exams'] }); onClose() },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const all = form.programIds.length === programs.length && programs.length > 0
  return (
    <Dialog open onClose={onClose} wide title="Schedule an assessment"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.name || !form.programIds.length} loading={m.isPending} onClick={() => m.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *">{(id) => <Input id={id} placeholder="e.g. Periodic Test 3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="Type">{(id) => <Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
        <Field label="Maximum marks">{(id) => <Input id={id} type="number" min={1} value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} />}</Field>
        <Field label="Weight in term result (%)">{(id) => <Input id={id} type="number" min={0} max={100} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />}</Field>
        <Field label="Start date">{(id) => <Input id={id} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />}</Field>
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Programmes *</p>
            <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, programIds: all ? [] : programs.map((p) => p.id) })}>{all ? 'Clear' : 'Select all'}</Button>
          </div>
          <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
            {programs.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={form.programIds.includes(p.id)}
                  onChange={(e) => setForm({ ...form, programIds: e.target.checked ? [...form.programIds, p.id] : form.programIds.filter((x) => x !== p.id) })} />
                {p.name}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function AssessmentDetail({ assessmentId, sectionId, onSection, onOpen, onBack }: { assessmentId: string; sectionId: string | null; onSection: (s: string) => void; onOpen: (s: string, c: string) => void; onBack: () => void }) {
  const { t } = useTranslation()
  const { user, tenant } = useMe()
  const f = useFormat()
  const academics = useAcademics()
  const exams = useQuery({ queryKey: ['exams'], queryFn: () => api.get<{ items: ExamRow[]; myPending: PendingMark[] }>('/exams') })
  const timetable = useQuery({
    queryKey: ['my-sections', user.personId],
    queryFn: () => api.get<{ slots: { sectionId: string }[] }>(`/timetable${qs({ staffId: user.personId })}`),
    enabled: user.role === 'FACULTY',
  })
  const exam = exams.data?.items.find((e) => e.id === assessmentId)
  const sections = useMemo(() => {
    const mine = new Set(timetable.data?.slots.map((s) => s.sectionId))
    return (academics.data?.sections ?? []).filter((s) => exam?.programIds.includes(s.programId) && s.learnerCount > 0 && (user.role !== 'FACULTY' || mine.has(s.id)))
  }, [academics.data, exam, timetable.data, user.role])
  const current = sectionId ?? sections[0]?.id
  useEffect(() => {
    if (!sectionId && sections[0]) onSection(sections[0].id)
  }, [sectionId, sections, onSection])
  const { data } = useQuery({
    queryKey: ['exam-analysis', assessmentId, current],
    queryFn: () => api.get<ExamAnalysis>(`/exams/${assessmentId}/analysis${qs({ sectionId: current })}`),
    enabled: !!current,
  })
  const credit = !!academics.data?.programs.find((p) => p.id === academics.data?.sections.find((s) => s.id === current)?.programId && p.creditSystem !== 'NONE')
  const grades = tenant ? FRAMEWORKS[tenant.framework].gradeBands.map((b) => b.label) : []

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={onBack}><ArrowLeft className="rtl:rotate-180" />{t('common.back')}</Button>
      <PageHeader
        title={exam?.name ?? '…'}
        description={exam ? `${STATUS_LABEL[exam.status]} · max ${exam.maxMarks} · ${f.date(exam.startDate)}` : undefined}
        actions={
          <Select className="w-auto min-w-56" value={current ?? ''} onChange={(e) => onSection(e.target.value)} aria-label={t('common.section')}>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.termLabel}</option>)}
          </Select>
        }
      />
      {!data ? <Skeleton className="h-80" /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Subject analysis</CardTitle></CardHeader>
            <Table>
              <thead>
                <tr>
                  <Th>Course</Th><Th className="text-end">Avg %</Th><Th className="text-end">High</Th><Th className="text-end">Low</Th><Th className="text-end">Pass %</Th>
                  {credit && <Th className="text-center" title="NBA course-outcome attainment level (0–3)">CO level</Th>}
                  <Th className="hidden xl:table-cell">Grades</Th><Th />
                </tr>
              </thead>
              <tbody>
                {data.perCourse.map((c) => (
                  <tr key={c.courseId}>
                    <Td className="font-medium">{c.courseName}</Td>
                    <Td className="text-end tabular-nums">{c.avg ?? '—'}</Td>
                    <Td className="text-end tabular-nums">{c.max ?? '—'}</Td>
                    <Td className="text-end tabular-nums">{c.min ?? '—'}</Td>
                    <Td className="text-end">{c.passRate === null ? '—' : <Badge variant={c.passRate >= 90 ? 'success' : c.passRate >= 75 ? 'warning' : 'danger'}>{c.passRate}%</Badge>}</Td>
                    {credit && <Td className="text-center">{c.attainment === null ? '—' : <Badge variant={c.attainment >= 2 ? 'success' : c.attainment === 1 ? 'warning' : 'danger'}>L{c.attainment}</Badge>}</Td>}
                    <Td className="hidden xl:table-cell">
                      <div className="flex h-5 w-40 overflow-hidden rounded">
                        {grades.map((g, i) => {
                          const n = c.distribution[g] ?? 0
                          return n ? <div key={g} title={`${g}: ${n}`} style={{ flex: n, background: `color-mix(in oklab, var(--brand) ${100 - i * 11}%, var(--danger))` }} /> : null
                        })}
                      </div>
                    </Td>
                    <Td className="text-end">
                      <Button size="sm" variant={c.entered ? 'ghost' : 'soft'} onClick={() => onOpen(current!, c.courseId)}>{c.entered ? 'View' : 'Enter marks'}</Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {credit && <p className="px-5 pb-4 pt-2 text-xs text-muted-foreground">CO level: share of students reaching the 60% target — L3 ≥ 70%, L2 ≥ 60%, L1 ≥ 50% (NBA outcome-based education).</p>}
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="size-4 text-warning" />Top performers</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {data.toppers.map((tp, i) => <li key={tp.learnerId} className="flex justify-between gap-2"><span>{i + 1}. {tp.name}</span><span className="tabular-nums text-muted-foreground">{tp.pct}%</span></li>)}
                  {!data.toppers.length && <p className="text-muted-foreground">No marks yet</p>}
                </ol>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TriangleAlert className="size-4 text-danger" />Needs support</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {data.needsSupport.map((tp) => <li key={tp.learnerId} className="flex justify-between gap-2"><span>{tp.name}</span><Badge variant="danger">{tp.pct}%</Badge></li>)}
                  {!data.needsSupport.length && <p className="text-muted-foreground">Everyone is comfortably above the pass mark.</p>}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

function MarksEntry({ assessmentId, sectionId, courseId, onBack }: { assessmentId: string; sectionId: string; courseId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const { tenant } = useMe()
  const toast = useToast()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['exam-sheet', assessmentId, sectionId, courseId],
    queryFn: () => api.get<ExamSheet>(`/exams/${assessmentId}/sheet${qs({ sectionId, courseId })}`),
  })
  const [marks, setMarks] = useState<Record<string, string>>({})
  useEffect(() => {
    if (data) setMarks(Object.fromEntries(data.learners.map((l) => {
      const v = data.sheet?.marks[l.id]
      return [l.id, v === null ? 'AB' : v === undefined ? '' : String(v)]
    })))
  }, [data])
  const max = data?.assessment.maxMarks ?? 100
  const invalid = Object.values(marks).some((v) => v !== '' && v.toUpperCase() !== 'AB' && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > max))
  const blanks = Object.values(marks).filter((v) => v === '').length
  const save = useMutation({
    mutationFn: () => api.put(`/exams/${assessmentId}/sheet`, {
      sectionId, courseId,
      marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v.toUpperCase() === 'AB' || v === '' ? null : Number(v)])),
    }),
    onSuccess: () => {
      toast('Marks saved')
      void qc.invalidateQueries({ queryKey: ['exams'] })
      void qc.invalidateQueries({ queryKey: ['exam-analysis'] })
      void qc.invalidateQueries({ queryKey: ['exam-sheet'] })
      onBack()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })

  if (isLoading || !data) return <Skeleton className="h-96" />
  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={onBack}><ArrowLeft className="rtl:rotate-180" />{t('common.back')}</Button>
      <PageHeader
        title={`${data.course?.name} · ${data.section?.name}`}
        description={`${data.assessment.name} · out of ${max}${data.canEdit ? ' · type AB for absent' : ''}`}
        actions={!data.canEdit && <Badge variant="muted"><Lock className="size-3" />{data.assessment.status === 'PUBLISHED' ? 'Published — read only' : 'Read only'}</Badge>}
      />
      <Card>
        <Table>
          <thead><tr><Th className="w-16">Roll</Th><Th>{t('common.name')}</Th><Th className="w-36">Marks / {max}</Th><Th className="w-24 text-end">%</Th><Th className="w-24 text-center">Grade</Th></tr></thead>
          <tbody>
            {data.learners.map((l, i) => {
              const v = marks[l.id] ?? ''
              const n = Number(v)
              const valid = v !== '' && v.toUpperCase() !== 'AB' && !Number.isNaN(n) && n >= 0 && n <= max
              const p = valid ? Math.round((n / max) * 1000) / 10 : null
              const g = p !== null && tenant ? gradeFor(p, tenant.framework) : null
              return (
                <tr key={l.id}>
                  <Td className="tabular-nums text-muted-foreground">{l.rollNo}</Td>
                  <Td className="font-medium">{l.firstName} {l.lastName}</Td>
                  <Td>
                    <Input
                      aria-label={`Marks for ${l.firstName} ${l.lastName}`}
                      inputMode="decimal"
                      disabled={!data.canEdit}
                      value={v}
                      data-row={i}
                      onChange={(e) => setMarks((m) => ({ ...m, [l.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                          e.preventDefault()
                          document.querySelector<HTMLInputElement>(`input[data-row="${i + 1}"]`)?.focus()
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          document.querySelector<HTMLInputElement>(`input[data-row="${i - 1}"]`)?.focus()
                        }
                      }}
                      className={cn('h-8 tabular-nums', v !== '' && !valid && v.toUpperCase() !== 'AB' && 'border-danger')}
                    />
                  </Td>
                  <Td className="text-end tabular-nums">{p ?? (v.toUpperCase() === 'AB' ? 'AB' : '—')}</Td>
                  <Td className="text-center">{g ? <Badge variant={g.pass ? 'default' : 'danger'}>{g.grade}</Badge> : '—'}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        {data.canEdit && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border p-4">
            <span className="text-sm text-muted-foreground">{blanks ? `${blanks} blank — saved as absent` : 'All learners have a mark'}</span>
            {invalid && <span className="text-sm text-danger">Marks must be between 0 and {max}</span>}
            <Button className="ms-auto" disabled={invalid} loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
          </div>
        )}
      </Card>
    </>
  )
}
