import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Target } from 'lucide-react'
import { api } from '@/lib/api'
import { errorMessage, useAcademics, useStaff } from '@/lib/queries'
import { FRAMEWORKS, LEVEL_ORDER } from '@/lib/frameworks'
import { useFormat, useMe } from '@/lib/session'
import type { Course, LevelCode, Program } from '@/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Field, Input, PageHeader, Progress, Select, Skeleton, Table, Tabs, Td, Th, useToast } from '@/components/ui'

type Tab = 'programs' | 'courses' | 'sections' | 'calendar'

export default function AcademicsPage() {
  const { t } = useTranslation()
  const { tenant } = useMe()
  const f = useFormat()
  const { data, isLoading } = useAcademics()
  const [tab, setTab] = useState<Tab>('programs')
  const [programFilter, setProgramFilter] = useState('')
  const [dialog, setDialog] = useState<'program' | 'course' | 'section' | null>(null)
  const pack = tenant ? FRAMEWORKS[tenant.framework] : null

  if (isLoading || !data) return <Skeleton className="h-96" />
  const programName = (id: string) => data.programs.find((p) => p.id === id)?.name ?? ''
  const levels = LEVEL_ORDER.filter((l) => data.programs.some((p) => p.level === l))
  const courses = data.courses.filter((c) => !programFilter || c.programId === programFilter)
  const sections = data.sections.filter((s) => !programFilter || s.programId === programFilter)

  return (
    <>
      <PageHeader
        title={t('nav.academics')}
        description={pack ? `${pack.name} · ${pack.creditSystem}` : undefined}
        actions={tab !== 'calendar' && (
          <Button onClick={() => setDialog(tab === 'programs' ? 'program' : tab === 'courses' ? 'course' : 'section')}>
            <Plus />{t('common.add')}
          </Button>
        )}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} items={[
          { value: 'programs', label: `Programmes (${data.programs.length})` },
          { value: 'courses', label: `Courses (${data.courses.length})` },
          { value: 'sections', label: `Sections (${data.sections.length})` },
          { value: 'calendar', label: 'Terms & periods' },
        ]} />
        {(tab === 'courses' || tab === 'sections') && (
          <Select className="w-auto min-w-60" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} aria-label={t('common.programme')}>
            <option value="">{t('common.all')} — {t('common.programme')}</option>
            {data.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
      </div>

      {tab === 'programs' && (
        <div className="space-y-6">
          {levels.map((level) => (
            <section key={level}>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">{t(`levels.${level}`)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.programs.filter((p) => p.level === level).map((p) => {
                  const secs = data.sections.filter((s) => s.programId === p.id)
                  const learners = secs.reduce((a, s) => a + s.learnerCount, 0)
                  const credits = data.courses.filter((c) => c.programId === p.id).reduce((a, c) => a + c.credits, 0)
                  return (
                    <Card key={p.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{p.name}</p>
                        <Badge variant="outline" className="font-mono">{p.code}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{p.department}{p.creditSystem !== 'NONE' ? ` · ${p.durationTerms} semesters · ${p.creditSystem}` : ''}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <span><b className="tabular-nums">{secs.length}</b> sections</span>
                        <span><b className="tabular-nums">{learners}</b> learners</span>
                        {credits > 0 && <span><b className="tabular-nums">{f.number(credits)}</b> credits offered</span>}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'courses' && (
        <Card>
          {!courses.length ? <EmptyState icon={<BookOpen />} title={t('common.noData')} /> : (
            <Table>
              <thead><tr><Th>Code</Th><Th>Course</Th><Th>{t('common.programme')}</Th><Th>Type</Th><Th className="text-end">Sem.</Th><Th className="text-end">Credits</Th></tr></thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-mono text-xs">{c.code}</Td>
                    <Td>
                      <p className="font-medium">{c.name}</p>
                      {c.outcomes.length > 0 && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Target className="size-3" />{c.outcomes.length} learning outcomes (CO)</p>}
                    </Td>
                    <Td className="max-w-56 truncate text-muted-foreground">{programName(c.programId)}</Td>
                    <Td><Badge variant={c.type === 'CORE' ? 'default' : c.type === 'LAB' ? 'info' : c.type === 'RESEARCH' ? 'success' : 'muted'}>{c.type}</Badge></Td>
                    <Td className="text-end tabular-nums">{c.semester ?? '—'}</Td>
                    <Td className="text-end tabular-nums">{c.credits || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'sections' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{programName(s.programId)} · {s.termLabel}</p>
                </div>
                <Badge variant="muted">{s.room}</Badge>
              </div>
              <div className="mt-3 flex justify-between text-sm"><span className="text-muted-foreground">Strength</span><span className="tabular-nums">{s.learnerCount} / {s.capacity}</span></div>
              <Progress className="mt-1" value={(s.learnerCount / s.capacity) * 100} />
              <p className="mt-3 text-sm"><span className="text-muted-foreground">Class teacher: </span>{s.classTeacherName ?? '—'}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Academic terms</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.terms.map((term) => (
                <div key={term.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{term.name}</p>
                    <p className="text-xs text-muted-foreground">{f.date(term.start)} – {f.date(term.end)}</p>
                  </div>
                  {term.current && <Badge variant="success">Current</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Bell schedule</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {data.periods.map((p) => (
                  <div key={p.no} className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Period {p.no}</p>
                    <p className="font-medium tabular-nums">{p.start}–{p.end}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Working days: {tenant?.weekDays.map((d) => f.weekday(d)).join(', ')}</p>
            </CardContent>
          </Card>
          {pack && (
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Grading scheme — {pack.name}</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">{pack.gradingScheme}</p>
                <div className="flex flex-wrap gap-2">
                  {pack.gradeBands.map((b) => <Badge key={b.label} variant="outline">{b.label} ≥ {b.min}%</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {dialog === 'program' && <ProgramDialog onClose={() => setDialog(null)} />}
      {dialog === 'course' && <CourseDialog programs={data.programs} defaultProgram={programFilter} onClose={() => setDialog(null)} />}
      {dialog === 'section' && <SectionDialog programs={data.programs} defaultProgram={programFilter} onClose={() => setDialog(null)} />}
    </>
  )
}

function useCreate<T>(path: string, label: string, onClose: () => void) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (body: T) => api.post(path, body),
    onSuccess: () => {
      toast(`${label} created`)
      void qc.invalidateQueries({ queryKey: ['academics'] })
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
}

function ProgramDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { tenant } = useMe()
  const [form, setForm] = useState<Partial<Program>>({ level: tenant?.levels[0], creditSystem: tenant?.framework === 'BOLOGNA_ECTS' ? 'ECTS' : ['AICTE_CBCS', 'UGC_CBCS'].includes(tenant?.framework ?? '') ? 'CBCS' : 'NONE', durationTerms: 1 })
  const m = useCreate<Partial<Program>>('/programs', 'Programme', onClose)
  return (
    <Dialog open onClose={onClose} title="New programme"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.name || !form.code} loading={m.isPending} onClick={() => m.mutate(form)}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *" className="sm:col-span-2">{(id) => <Input id={id} placeholder="e.g. B.Sc Physics, Grade 6" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="Code *">{(id) => <Input id={id} value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />}</Field>
        <Field label={t('common.level')}>{(id) => (
          <Select id={id} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as LevelCode })}>
            {LEVEL_ORDER.map((l) => <option key={l} value={l}>{t(`levels.${l}`)}</option>)}
          </Select>
        )}</Field>
        <Field label="Department">{(id) => <Input id={id} value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />}</Field>
        <Field label="Duration (terms)">{(id) => <Input id={id} type="number" min={1} value={form.durationTerms ?? 1} onChange={(e) => setForm({ ...form, durationTerms: Number(e.target.value) })} />}</Field>
        <Field label="Credit system">{(id) => (
          <Select id={id} value={form.creditSystem} onChange={(e) => setForm({ ...form, creditSystem: e.target.value as Program['creditSystem'] })}>
            <option value="NONE">None</option><option value="CBCS">CBCS (India)</option><option value="ECTS">ECTS (Europe)</option><option value="US_CREDIT">US credit hours</option>
          </Select>
        )}</Field>
      </div>
    </Dialog>
  )
}

function CourseDialog({ programs, defaultProgram, onClose }: { programs: Program[]; defaultProgram: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [form, setForm] = useState<Partial<Course> & { outcomesText?: string }>({ programId: defaultProgram || programs[0]?.id, type: 'CORE', credits: 0 })
  const m = useCreate<Partial<Course>>('/courses', 'Course', onClose)
  const submit = () => m.mutate({ ...form, outcomes: (form.outcomesText ?? '').split('\n').map((s) => s.trim()).filter(Boolean) })
  return (
    <Dialog open onClose={onClose} title="New course / subject"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.name || !form.programId} loading={m.isPending} onClick={submit}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`${t('common.programme')} *`} className="sm:col-span-2">{(id) => (
          <Select id={id} value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}</Field>
        <Field label="Name *">{(id) => <Input id={id} value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="Code">{(id) => <Input id={id} value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />}</Field>
        <Field label="Type">{(id) => (
          <Select id={id} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Course['type'] })}>
            {['CORE', 'ELECTIVE', 'LAB', 'ACTIVITY', 'RESEARCH'].map((x) => <option key={x}>{x}</option>)}
          </Select>
        )}</Field>
        <Field label="Credits">{(id) => <Input id={id} type="number" min={0} step={0.5} value={form.credits ?? 0} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })} />}</Field>
        <Field label="Semester (optional)">{(id) => <Input id={id} type="number" min={1} value={form.semester ?? ''} onChange={(e) => setForm({ ...form, semester: e.target.value ? Number(e.target.value) : undefined })} />}</Field>
        <Field label="Learning outcomes (one per line)" className="sm:col-span-2" hint="Used for Outcome-Based Education (CO–PO mapping) in Phase 2.">{(id) => (
          <textarea id={id} rows={3} className="w-full rounded-lg border border-border bg-card p-2 text-sm" value={form.outcomesText ?? ''} onChange={(e) => setForm({ ...form, outcomesText: e.target.value })} />
        )}</Field>
      </div>
    </Dialog>
  )
}

function SectionDialog({ programs, defaultProgram, onClose }: { programs: Program[]; defaultProgram: string; onClose: () => void }) {
  const { t } = useTranslation()
  const staff = useStaff()
  const [form, setForm] = useState({ programId: defaultProgram || programs[0]?.id || '', name: '', termLabel: '', room: '', capacity: 40, classTeacherId: '', semester: '' })
  const m = useCreate<typeof form>('/sections', 'Section', onClose)
  return (
    <Dialog open onClose={onClose} title="New section / batch"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.name || !form.programId} loading={m.isPending} onClick={() => m.mutate(form)}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`${t('common.programme')} *`} className="sm:col-span-2">{(id) => (
          <Select id={id} value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}</Field>
        <Field label="Name *">{(id) => <Input id={id} placeholder="e.g. G6-C" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="Term label">{(id) => <Input id={id} placeholder="e.g. Semester 3" value={form.termLabel} onChange={(e) => setForm({ ...form, termLabel: e.target.value })} />}</Field>
        <Field label="Room">{(id) => <Input id={id} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />}</Field>
        <Field label="Capacity">{(id) => <Input id={id} type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />}</Field>
        <Field label="Semester (credit programmes)">{(id) => <Input id={id} type="number" min={1} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} />}</Field>
        <Field label="Class teacher / coordinator">{(id) => (
          <Select id={id} value={form.classTeacherId} onChange={(e) => setForm({ ...form, classTeacherId: e.target.value })}>
            <option value="">—</option>
            {staff.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}</Field>
      </div>
    </Dialog>
  )
}
