import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, ExternalLink, KanbanSquare, List, Plus, Search, UserCheck, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import type { ApplicationRow } from '@/lib/apiTypes'
import { errorMessage, useAcademics } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { cn } from '@/lib/utils'
import type { AdmissionStage, Application } from '@/types'
import { Avatar, Badge, Button, Card, Dialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, Table, Tabs, Td, Th, useToast } from '@/components/ui'

export const STAGES: AdmissionStage[] = ['ENQUIRY', 'APPLIED', 'DOCS_VERIFIED', 'ASSESSMENT', 'OFFERED', 'ACCEPTED', 'ENROLLED', 'REJECTED']
export const STAGE_NAME: Record<AdmissionStage, string> = {
  ENQUIRY: 'Enquiry', APPLIED: 'Applied', DOCS_VERIFIED: 'Documents verified', ASSESSMENT: 'Test / interview', OFFERED: 'Offer made',
  ACCEPTED: 'Offer accepted', ENROLLED: 'Enrolled', REJECTED: 'Not admitted',
}
const NEXT: Partial<Record<AdmissionStage, AdmissionStage>> = { ENQUIRY: 'APPLIED', APPLIED: 'DOCS_VERIFIED', DOCS_VERIFIED: 'ASSESSMENT', ASSESSMENT: 'OFFERED', OFFERED: 'ACCEPTED' }
const stageTone = (s: AdmissionStage) => (s === 'ENROLLED' ? 'success' : s === 'REJECTED' ? 'danger' : s === 'OFFERED' || s === 'ACCEPTED' ? 'info' : 'muted') as 'success' | 'danger' | 'info' | 'muted'

export default function AdmissionsPage() {
  const { t } = useTranslation()
  const { tenant } = useMe()
  const f = useFormat()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [q, setQ] = useState('')
  const [programId, setProgramId] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const academics = useAcademics()
  const { data, isLoading } = useQuery({ queryKey: ['admissions'], queryFn: () => api.get<{ items: ApplicationRow[]; funnel: { stage: AdmissionStage; count: number }[] }>('/admissions') })
  const items = useMemo(
    () => (data?.items ?? []).filter((a) => (!programId || a.programId === programId) && (!q || `${a.applicantName} ${a.number} ${a.phone} ${a.email}`.toLowerCase().includes(q.toLowerCase()))),
    [data, q, programId],
  )
  const open = data?.items.find((a) => a.id === openId)
  const total = data?.items.length ?? 0
  const converted = data?.funnel.find((x) => x.stage === 'ENROLLED')?.count ?? 0
  const publicUrl = `${location.origin}/apply/${tenant?.subdomain}`

  return (
    <>
      <PageHeader
        title="Admissions"
        description={`${total} applications this cycle · ${converted} enrolled`}
        actions={
          <>
            <a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink />Public application form</Button></a>
            <Button onClick={() => setCreating(true)}><Plus />New enquiry</Button>
          </>
        }
      />

      {data && (
        <Card className="mb-4 overflow-x-auto p-4">
          <div className="flex min-w-[760px] items-end gap-2">
            {data.funnel.filter((x) => x.stage !== 'REJECTED').map((x, i, arr) => {
              const max = Math.max(...arr.map((a) => a.count), 1)
              return (
                <div key={x.stage} className="flex-1">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{STAGE_NAME[x.stage]}</span><span className="font-semibold text-foreground tabular-nums">{x.count}</span></div>
                  <div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${(x.count / max) * 100}%`, opacity: 1 - i * 0.1 }} /></div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <Tabs value={view} onChange={setView} items={[{ value: 'board', label: <span className="flex items-center gap-1.5"><KanbanSquare className="size-4" />Board</span> }, { value: 'list', label: <span className="flex items-center gap-1.5"><List className="size-4" />List</span> }]} />
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" placeholder="Name, application no, phone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
        </div>
        <Select className="w-auto min-w-52" value={programId} onChange={(e) => setProgramId(e.target.value)} aria-label={t('common.programme')}>
          <option value="">{t('common.all')} — {t('common.programme')}</option>
          {academics.data?.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Card>

      {isLoading ? <Skeleton className="h-96" /> : !items.length ? <Card><EmptyState title={t('common.noData')} /></Card> : view === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {STAGES.map((s) => {
            const col = items.filter((a) => a.stage === s)
            return (
              <div key={s} className="w-64 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
                  {STAGE_NAME[s]} <Badge variant={stageTone(s)}>{col.length}</Badge>
                </div>
                <div className="space-y-2">
                  {col.map((a) => (
                    <button key={a.id} onClick={() => setOpenId(a.id)} className="block w-full cursor-pointer text-start">
                      <Card className="p-3 transition hover:shadow-md">
                        <p className="font-medium">{a.applicantName}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.programName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <Badge variant="outline">{a.category}</Badge>
                          {a.score !== undefined && <Badge variant="muted">Score {a.score}</Badge>}
                          <span className="ms-auto text-[11px] text-muted-foreground">{f.date(a.updatedAt, { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </Card>
                    </button>
                  ))}
                  {!col.length && <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Empty</div>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <thead><tr><Th>Applicant</Th><Th>Application no.</Th><Th>{t('common.programme')}</Th><Th>Category</Th><Th>Source</Th><Th>Stage</Th><Th>Updated</Th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setOpenId(a.id)}>
                  <Td><div className="flex items-center gap-2"><Avatar name={a.applicantName} className="size-8 text-[10px]" /><span className="font-medium">{a.applicantName}</span></div></Td>
                  <Td className="font-mono text-xs">{a.number}</Td>
                  <Td className="max-w-52 truncate">{a.programName}</Td>
                  <Td>{a.category}</Td>
                  <Td className="text-muted-foreground">{a.source}</Td>
                  <Td><Badge variant={stageTone(a.stage)}>{STAGE_NAME[a.stage]}</Badge></Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{f.date(a.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {open && <ApplicationDialog app={open} onClose={() => setOpenId(null)} />}
      {creating && <NewEnquiryDialog onClose={() => setCreating(false)} />}
    </>
  )
}

function ApplicationDialog({ app, onClose }: { app: ApplicationRow; onClose: () => void }) {
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const academics = useAcademics()
  const [note, setNote] = useState('')
  const [score, setScore] = useState(app.score?.toString() ?? '')
  const [sectionId, setSectionId] = useState('')
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admissions'] })
  const update = useMutation({
    mutationFn: (body: Partial<Application> & { note?: string }) => api.patch(`/admissions/${app.id}`, body),
    onSuccess: () => { refresh(); setNote('') },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const enrol = useMutation({
    mutationFn: () => api.post<{ learner: { admissionNo: string }; invoice: { number: string } | null }>(`/admissions/${app.id}/enrol`, { sectionId }),
    onSuccess: (r) => {
      toast(`Enrolled as ${r.learner.admissionNo}${r.invoice ? ` · invoice ${r.invoice.number} raised` : ''}`)
      void qc.invalidateQueries()
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const next = NEXT[app.stage]
  const sections = academics.data?.sections.filter((s) => s.programId === app.programId) ?? []
  const closed = app.stage === 'ENROLLED' || app.stage === 'REJECTED'

  return (
    <Dialog open onClose={onClose} wide title={app.applicantName} description={`${app.number} · ${app.programName}`}
      footer={
        <>
          {!closed && <Button variant="ghost" className="me-auto text-danger" onClick={() => update.mutate({ stage: 'REJECTED' })}><XCircle />Not admitted</Button>}
          <Button variant="outline" onClick={onClose}>Close</Button>
          {next && <Button loading={update.isPending} onClick={() => update.mutate({ stage: next })}>Move to “{STAGE_NAME[next]}”</Button>}
        </>
      }>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={stageTone(app.stage)}>{STAGE_NAME[app.stage]}</Badge>
            <Badge variant="outline">{app.category}</Badge>
            <Badge variant="muted">via {app.source}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Date of birth</dt><dd>{app.dob ? f.date(app.dob) : '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Gender</dt><dd>{{ F: 'Female', M: 'Male', X: 'Not stated' }[app.gender]}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Parent / contact</dt><dd>{app.guardianName}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{app.phone}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">Email</dt><dd className="truncate">{app.email}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">Previous school / institution</dt><dd>{app.previousSchool ?? '—'}</dd></div>
          </dl>
          <div>
            <p className="mb-2 text-sm font-semibold">Documents</p>
            <ul className="space-y-1">
              {app.documents.map((d, i) => (
                <li key={d.name}>
                  <button
                    disabled={closed}
                    onClick={() => update.mutate({ documents: app.documents.map((x, j) => (j === i ? { ...x, verified: !x.verified } : x)) })}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted disabled:cursor-default"
                  >
                    {d.verified ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                    {d.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          {!closed && (
            <div className="flex items-end gap-2">
              <Field label="Entrance / interview score (out of 100)" className="flex-1">{(id) => <Input id={id} type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />}</Field>
              <Button variant="outline" onClick={() => update.mutate({ score: Number(score) })} disabled={score === ''}>Save</Button>
            </div>
          )}
          {(app.stage === 'OFFERED' || app.stage === 'ACCEPTED') && (
            <Card className="space-y-3 border-brand bg-brand-soft p-4">
              <p className="flex items-center gap-2 font-semibold"><UserCheck className="size-4" />Enrol applicant</p>
              <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)} aria-label="Section">
                <option value="">Choose section…</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.learnerCount}/{s.capacity}</option>)}
              </Select>
              <p className="text-xs text-muted-foreground">Creates the lifelong learner record and raises the first fee invoice automatically.</p>
              <Button className="w-full" disabled={!sectionId} loading={enrol.isPending} onClick={() => enrol.mutate()}>Enrol now</Button>
            </Card>
          )}
          <div>
            <p className="mb-2 text-sm font-semibold">Timeline</p>
            <ol className="max-h-56 space-y-2 overflow-y-auto">
              {[...app.notes].reverse().map((n, i) => (
                <li key={i} className="border-s-2 border-border ps-3 text-sm">
                  <p>{n.text}</p>
                  <p className="text-xs text-muted-foreground">{n.by} · {f.date(n.at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </li>
              ))}
            </ol>
          </div>
          {!closed && (
            <div className="flex gap-2">
              <Input placeholder="Add a note (call, visit, follow-up)…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
              <Button variant="outline" disabled={!note.trim()} onClick={() => update.mutate({ note })}>Add</Button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function NewEnquiryDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { tenant } = useMe()
  const academics = useAcademics()
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ applicantName: '', dob: '', gender: 'F', programId: '', guardianName: '', phone: '', email: '', category: tenant?.country === 'IN' ? 'GENERAL' : 'INTERNATIONAL', source: 'Walk-in', previousSchool: '' })
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }))
  const m = useMutation({
    mutationFn: () => api.post<Application>('/admissions', form),
    onSuccess: (a) => {
      toast(`Enquiry ${a.number} recorded`)
      void qc.invalidateQueries({ queryKey: ['admissions'] })
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const cats = tenant?.country === 'IN' ? ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', tenant.type === 'SCHOOL' ? 'RTE' : 'TFWS'] : ['INTERNATIONAL', 'DOMESTIC', 'GCC NATIONAL']
  return (
    <Dialog open onClose={onClose} wide title="New enquiry"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.applicantName || !form.programId || !form.phone} loading={m.isPending} onClick={() => m.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Applicant name *">{(id) => <Input id={id} value={form.applicantName} onChange={set('applicantName')} />}</Field>
        <Field label={`${t('common.programme')} *`}>{(id) => (
          <Select id={id} value={form.programId} onChange={set('programId')}>
            <option value="">—</option>
            {academics.data?.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}</Field>
        <Field label="Date of birth">{(id) => <Input id={id} type="date" value={form.dob} onChange={set('dob')} />}</Field>
        <Field label="Gender">{(id) => <Select id={id} value={form.gender} onChange={set('gender')}><option value="F">Female</option><option value="M">Male</option><option value="X">Not stated</option></Select>}</Field>
        <Field label="Parent / contact name">{(id) => <Input id={id} value={form.guardianName} onChange={set('guardianName')} />}</Field>
        <Field label="Phone *">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Category">{(id) => <Select id={id} value={form.category} onChange={set('category')}>{cats.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
        <Field label="Source">{(id) => <Select id={id} value={form.source} onChange={set('source')}>{['Walk-in', 'Website', 'Referral', 'Education fair', 'Agent', 'Social media'].map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
        <Field label="Previous school">{(id) => <Input id={id} value={form.previousSchool} onChange={set('previousSchool')} />}</Field>
      </div>
      <p className={cn('mt-4 text-xs text-muted-foreground')}>Reservation and quota categories follow the institution’s framework pack and are used only for seat allocation and statutory reporting.</p>
    </Dialog>
  )
}
