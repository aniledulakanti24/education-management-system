import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRightLeft, Award, Droplet, FlaskConical, IdCard, Mail, MapPin, Phone, UserMinus } from 'lucide-react'
import { api } from '@/lib/api'
import type { LearnerSummary } from '@/lib/apiTypes'
import { STAGE_LABEL } from '@/lib/apiTypes'
import { errorMessage, useAcademics } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Field, Progress, Select, Skeleton, Tabs, useToast } from '@/components/ui'
import { AttendanceRing, AttendanceStrip, STATUS_KEY } from '@/components/learner-widgets'
import { TimetableGrid } from './TimetablePage'
import { ReportCardView } from '@/components/ReportCardView'

export default function LearnerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({ queryKey: ['learner', id], queryFn: () => api.get<LearnerSummary>(`/learners/${id}`) })
  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate(-1)}><ArrowLeft className="rtl:rotate-180" />{t('common.back')}</Button>
      {isLoading ? <Skeleton className="h-96" /> : error || !data ? <Card><EmptyState title="Learner not found" description={errorMessage(error)} /></Card> : <LearnerProfile s={data} />}
    </>
  )
}

type TabKey = 'overview' | 'attendance' | 'timetable' | 'results' | 'research'

export function LearnerProfile({ s }: { s: LearnerSummary }) {
  const { t } = useTranslation()
  const { user, tenant } = useMe()
  const f = useFormat()
  const [tab, setTab] = useState<TabKey>('overview')
  const [transfer, setTransfer] = useState(false)
  const l = s.learner
  const isAdmin = user.role === 'INST_ADMIN'
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()

  const withdraw = useMutation({
    mutationFn: () => api.del(`/learners/${l.id}`),
    onSuccess: () => {
      toast(`${l.firstName} marked as withdrawn`)
      void qc.invalidateQueries()
      navigate('/learners')
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })

  const tabs: { value: TabKey; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'attendance', label: t('nav.attendance') },
    { value: 'timetable', label: t('nav.timetable') },
    ...(l.level !== 'PHD' && l.level !== 'PRE_PRIMARY' ? [{ value: 'results' as const, label: t('nav.results') }] : []),
    ...(s.research ? [{ value: 'research' as const, label: t('nav.research') }] : []),
  ]

  return (
    <>
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={`${l.firstName} ${l.lastName}`} className="size-16 text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">{l.firstName} {l.lastName}</h1>
            <p className="text-muted-foreground">{l.programName} · {l.sectionName} · Roll {l.rollNo}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{t(`levels.${l.level}`)}</Badge>
              <Badge variant="muted">Age {s.age}</Badge>
              <Badge variant="outline" className="font-mono">{l.admissionNo}</Badge>
              <Badge variant={l.status === 'ACTIVE' ? 'success' : 'danger'}>{l.status}</Badge>
            </div>
          </div>
          {isAdmin && l.status === 'ACTIVE' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTransfer(true)}><ArrowRightLeft />Transfer / promote</Button>
              <Button variant="ghost" className="text-danger" loading={withdraw.isPending} onClick={() => confirm(`Withdraw ${l.firstName}? The record is kept (status: withdrawn).`) && withdraw.mutate()}>
                <UserMinus />Withdraw
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} items={tabs} className="mb-4" />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <Item label="Date of birth" value={f.date(l.dob, { dateStyle: 'long' })} />
                <Item label="Gender" value={{ F: 'Female', M: 'Male', X: 'Non-binary / undisclosed' }[l.gender]} />
                <Item label="Nationality" value={new Intl.DisplayNames([f.tag, 'en'], { type: 'region' }).of(l.nationality) ?? l.nationality} />
                <Item label="Enrolled on" value={f.date(l.enrolledOn)} />
                <Item label="Blood group" value={l.bloodGroup} icon={<Droplet className="size-3.5" />} />
                {l.email && <Item label="Email" value={l.email} icon={<Mail className="size-3.5" />} />}
                {l.phone && <Item label="Phone" value={l.phone} icon={<Phone className="size-3.5" />} />}
                <Item label="Address" value={l.address} icon={<MapPin className="size-3.5" />} />
              </dl>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><IdCard className="size-4" />Identity & credits</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {tenant?.country === 'IN' && <Item label="APAAR ID" value={l.apaarId} mono />}
                {tenant?.country === 'IN' && <Item label="ABC ID" value={l.abcId} mono />}
                <Item label="Lifelong learner ID" value={l.id.toUpperCase()} mono />
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <Award className="size-4 shrink-0" /> Verifiable credentials & DigiLocker issuance arrive in Phase 3.
                </div>
              </CardContent>
            </Card>
            {l.guardians.length > 0 && (
              <Card>
                <CardHeader><CardTitle>{l.level === 'UG' || l.level === 'PG' ? 'Family / emergency contacts' : 'Parents / guardians'}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {l.guardians.map((g) => (
                    <div key={g.name} className="flex items-center gap-3 text-sm">
                      <Avatar name={g.name} className="size-8 text-[10px]" />
                      <div className="min-w-0">
                        <p className="font-medium">{g.name} <span className="text-xs font-normal text-muted-foreground">· {g.relation}</span></p>
                        <p className="truncate text-xs text-muted-foreground">{g.phone} · {g.email}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <Card>
          <CardContent className="pt-5">
            {s.attendance.total === 0 ? <EmptyState title="No attendance records" description="Doctoral scholars are tracked through progress reviews instead of daily attendance." /> : (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="flex flex-col items-center gap-3">
                  <AttendanceRing pct={s.attendance.pct} size={140} />
                  <div className="grid w-full grid-cols-2 gap-2 text-sm">
                    {(['P', 'A', 'L', 'E'] as const).map((k) => (
                      <div key={k} className="rounded-lg bg-muted p-2 text-center">
                        <p className="text-lg font-semibold tabular-nums">{s.attendance.counts[k]}</p>
                        <p className="text-xs text-muted-foreground">{t(STATUS_KEY[k])}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <p className="mb-3 text-sm font-medium">Last {s.attendance.recent.length} working days</p>
                  <AttendanceStrip recent={s.attendance.recent} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'timetable' && <Card className="p-4"><TimetableGrid query={{ sectionId: l.sectionId }} /></Card>}

      {tab === 'results' && <ReportCardView learnerId={l.id} />}

      {tab === 'research' && s.research && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><FlaskConical className="size-5 text-brand" />{s.research.topic}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{s.research.area} · registered {f.date(s.research.registeredOn)} · {s.research.publications} publications</p>
            </div>
            <Badge variant="info">{STAGE_LABEL[s.research.stage]}</Badge>
          </CardHeader>
          <CardContent>
            <Progress value={(s.research.milestones.filter((m) => m.done).length / s.research.milestones.length) * 100} />
            <ol className="mt-4 space-y-2">
              {s.research.milestones.map((m) => (
                <li key={m.label} className="flex justify-between gap-2 text-sm">
                  <span className={cn(m.done && 'text-muted-foreground line-through')}>{m.label}</span>
                  <span className="text-muted-foreground">{f.date(m.due)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {isAdmin && <TransferDialog open={transfer} onClose={() => setTransfer(false)} learnerId={l.id} currentSectionId={l.sectionId} />}
    </>
  )
}

function Item({ label, value, icon, mono }: { label: string; value?: string; icon?: ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 flex items-center gap-1.5 font-medium', mono && 'font-mono text-xs')}>{icon}{value || '—'}</dd>
    </div>
  )
}

function TransferDialog({ open, onClose, learnerId, currentSectionId }: { open: boolean; onClose: () => void; learnerId: string; currentSectionId: string }) {
  const { t } = useTranslation()
  const academics = useAcademics()
  const [sectionId, setSectionId] = useState(currentSectionId)
  const qc = useQueryClient()
  const toast = useToast()
  const m = useMutation({
    mutationFn: () => api.patch(`/learners/${learnerId}`, { sectionId }),
    onSuccess: () => {
      toast('Learner moved')
      void qc.invalidateQueries()
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  return (
    <Dialog open={open} onClose={onClose} title="Transfer or promote" description="Move the learner to another section or programme. History is kept in the lifelong record."
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} disabled={sectionId === currentSectionId} onClick={() => m.mutate()}>{t('common.save')}</Button></>}>
      <Field label={t('common.section')}>{(id) => (
        <Select id={id} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          {academics.data?.programs.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {academics.data!.sections.filter((s) => s.programId === p.id).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.termLabel}</option>)}
            </optgroup>
          ))}
        </Select>
      )}</Field>
    </Dialog>
  )
}
