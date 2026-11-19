import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, GraduationCap, Plus, Search } from 'lucide-react'
import { api, qs } from '@/lib/api'
import type { LearnerRow } from '@/lib/apiTypes'
import { errorMessage, useAcademics } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { LEVEL_ORDER } from '@/lib/frameworks'
import type { Guardian, Learner } from '@/types'
import { Avatar, Badge, Button, Card, Dialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, Table, Td, Th, useToast } from '@/components/ui'

export default function LearnersPage() {
  const { t } = useTranslation()
  const { user, tenant } = useMe()
  const f = useFormat()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [level, setLevel] = useState('')
  const [programId, setProgramId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [page, setPage] = useState(1)
  const isAdmin = user.role === 'INST_ADMIN'
  const academics = useAcademics()

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250)
    return () => clearTimeout(id)
  }, [q])
  useEffect(() => setPage(1), [debounced, level, programId, sectionId])

  const { data, isLoading } = useQuery({
    queryKey: ['learners', debounced, level, programId, sectionId, page],
    queryFn: () => api.get<{ items: LearnerRow[]; total: number; pageSize: number }>(`/learners${qs({ q: debounced, level, programId, sectionId, page, status: 'ACTIVE' })}`),
    placeholderData: keepPreviousData,
  })

  const programs = useMemo(() => (academics.data?.programs ?? []).filter((p) => !level || p.level === level), [academics.data, level])
  const sections = useMemo(() => (academics.data?.sections ?? []).filter((s) => !programId || s.programId === programId), [academics.data, programId])
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  function exportCsv() {
    if (!data) return
    const rows = [['Admission No', 'First name', 'Last name', 'Programme', 'Section', 'APAAR ID', 'Attendance %'],
      ...data.items.map((l) => [l.admissionNo, l.firstName, l.lastName, l.programName, l.sectionName, l.apaarId ?? '', String(l.attendancePct ?? '')])]
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `learners-${tenant?.subdomain}.csv`
    a.click()
  }

  return (
    <>
      <PageHeader
        title={t('nav.learners')}
        description={data ? `${f.number(data.total)} active learners${user.role === 'FACULTY' ? ' in sections you teach or supervise' : ''}` : undefined}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}><Download />CSV</Button>
            {isAdmin && <Button onClick={() => setParams({ new: '1' })}><Plus />{t('common.add')}</Button>}
          </>
        }
      />

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" placeholder="Name, admission no, APAAR…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
        </div>
        <Select value={level} onChange={(e) => { setLevel(e.target.value); setProgramId(''); setSectionId('') }} aria-label={t('common.level')}>
          <option value="">{t('common.all')} — {t('common.level')}</option>
          {LEVEL_ORDER.filter((l) => tenant?.levels.includes(l)).map((l) => <option key={l} value={l}>{t(`levels.${l}`)}</option>)}
        </Select>
        <Select value={programId} onChange={(e) => { setProgramId(e.target.value); setSectionId('') }} aria-label={t('common.programme')}>
          <option value="">{t('common.all')} — {t('common.programme')}</option>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)} aria-label={t('common.section')}>
          <option value="">{t('common.all')} — {t('common.section')}</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Card>

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !data?.items.length ? (
          <EmptyState icon={<GraduationCap />} title={t('common.noData')} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{t('common.name')}</Th><Th>Admission no.</Th><Th>{t('common.programme')}</Th><Th>{t('common.section')}</Th>
                  <Th className="hidden xl:table-cell">{tenant?.country === 'IN' ? 'APAAR ID' : 'Nationality'}</Th><Th className="text-end">{t('nav.attendance')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id} className="cursor-pointer hover:bg-muted/60" onClick={() => navigate(`/learners/${l.id}`)}>
                    <Td>
                      <Link to={`/learners/${l.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Avatar name={`${l.firstName} ${l.lastName}`} />
                        <span>
                          <span className="block font-medium">{l.firstName} {l.lastName}</span>
                          <span className="block text-xs text-muted-foreground">{t(`levels.${l.level}`)}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs">{l.admissionNo}</Td>
                    <Td className="max-w-56 truncate">{l.programName}</Td>
                    <Td>{l.sectionName}</Td>
                    <Td className="hidden font-mono text-xs xl:table-cell">{tenant?.country === 'IN' ? l.apaarId ?? '—' : l.nationality}</Td>
                    <Td className="text-end">
                      {l.attendancePct === null ? <span className="text-muted-foreground">—</span> : (
                        <Badge variant={l.attendancePct >= 85 ? 'success' : l.attendancePct >= 75 ? 'warning' : 'danger'}>{f.pct(l.attendancePct)}</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between gap-2 p-4 text-sm text-muted-foreground">
              <span>{page} / {pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('common.previous')}</Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {isAdmin && <AddLearnerDialog open={params.get('new') === '1'} onClose={() => setParams({})} />}
    </>
  )
}

function AddLearnerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { tenant } = useMe()
  const toast = useToast()
  const qc = useQueryClient()
  const academics = useAcademics()
  const empty = { firstName: '', lastName: '', gender: 'F', dob: '', programId: '', sectionId: '', apaarId: '', email: '', phone: '', address: '', gName: '', gRelation: 'Mother', gPhone: '', gEmail: '' }
  const [form, setForm] = useState(empty)
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }))
  const program = academics.data?.programs.find((p) => p.id === form.programId)
  const adult = program && ['UG', 'PG', 'PHD', 'DIPLOMA'].includes(program.level)

  const m = useMutation({
    mutationFn: () => {
      const guardians: Guardian[] = form.gName ? [{ name: form.gName, relation: form.gRelation as Guardian['relation'], phone: form.gPhone, email: form.gEmail }] : []
      const body: Partial<Learner> = {
        firstName: form.firstName, lastName: form.lastName, gender: form.gender as Learner['gender'], dob: form.dob, sectionId: form.sectionId,
        apaarId: form.apaarId || undefined, email: form.email || undefined, phone: form.phone || undefined, address: form.address, guardians,
      }
      return api.post<Learner>('/learners', body)
    },
    onSuccess: (l) => {
      toast(`${l.firstName} enrolled · ${l.admissionNo}`)
      void qc.invalidateQueries({ queryKey: ['learners'] })
      void qc.invalidateQueries({ queryKey: ['academics'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      setForm(empty)
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })

  const valid = form.firstName && form.dob && form.sectionId
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enrol a learner"
      description="Creates a lifelong learner record. Admissions CRM (enquiry → offer) arrives in Phase 2."
      wide
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>{t('common.save')}</Button></>}
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (valid) m.mutate() }}>
        <Field label="First name *">{(id) => <Input id={id} value={form.firstName} onChange={set('firstName')} required />}</Field>
        <Field label="Last name">{(id) => <Input id={id} value={form.lastName} onChange={set('lastName')} />}</Field>
        <Field label="Date of birth *">{(id) => <Input id={id} type="date" value={form.dob} onChange={set('dob')} required />}</Field>
        <Field label="Gender">{(id) => (
          <Select id={id} value={form.gender} onChange={set('gender')}>
            <option value="F">Female</option><option value="M">Male</option><option value="X">Non-binary / prefer not to say</option>
          </Select>
        )}</Field>
        <Field label={`${t('common.programme')} *`}>{(id) => (
          <Select id={id} value={form.programId} onChange={(e) => setForm((x) => ({ ...x, programId: e.target.value, sectionId: '' }))}>
            <option value="">—</option>
            {academics.data?.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}</Field>
        <Field label={`${t('common.section')} *`}>{(id) => (
          <Select id={id} value={form.sectionId} onChange={set('sectionId')} disabled={!form.programId}>
            <option value="">—</option>
            {academics.data?.sections.filter((s) => s.programId === form.programId).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.learnerCount}/{s.capacity})</option>)}
          </Select>
        )}</Field>
        {tenant?.country === 'IN' && (
          <Field label="APAAR ID" hint="12-digit Automated Permanent Academic Account Registry ID">{(id) => <Input id={id} inputMode="numeric" maxLength={12} value={form.apaarId} onChange={set('apaarId')} />}</Field>
        )}
        {adult && <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>}
        <Field label="Address" className="sm:col-span-2">{(id) => <Input id={id} value={form.address} onChange={set('address')} />}</Field>

        <p className="text-sm font-semibold sm:col-span-2">{adult ? 'Emergency contact / sponsor' : 'Parent / guardian'}</p>
        <Field label="Name">{(id) => <Input id={id} value={form.gName} onChange={set('gName')} />}</Field>
        <Field label="Relation">{(id) => (
          <Select id={id} value={form.gRelation} onChange={set('gRelation')}>
            {['Mother', 'Father', 'Guardian', 'Spouse', 'Sponsor'].map((r) => <option key={r}>{r}</option>)}
          </Select>
        )}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.gPhone} onChange={set('gPhone')} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={form.gEmail} onChange={set('gEmail')} />}</Field>
        {!adult && <p className="text-xs text-muted-foreground sm:col-span-2">Verifiable parental consent is recorded for learners under 18 (DPDP Act 2023, GDPR-K, COPPA).</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
