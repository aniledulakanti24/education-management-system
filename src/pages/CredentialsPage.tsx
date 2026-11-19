import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, BadgeCheck, CheckCircle2, FileJson, Link2, Search, Send, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import { api, qs } from '@/lib/api'
import type { CredentialDetail, CredentialRow, CreditOverview, IssuePreview, IssuerInfo, TemplateInfo } from '@/lib/apiTypes'
import { errorMessage, useAcademics } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { blockHash } from '@/lib/vc'
import { cn } from '@/lib/utils'
import type { CredentialTemplate, LedgerBlock } from '@/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, StatCard, Table, Tabs, Td, Th, useToast } from '@/components/ui'
import { CertificateView } from '@/components/CertificateView'
import { CreditStatementView } from '@/components/CreditStatement'

type Tab = 'issued' | 'issue' | 'credits' | 'trust'

export default function CredentialsPage() {
  const [tab, setTab] = useState<Tab>('issued')
  const issuer = useQuery({ queryKey: ['issuer'], queryFn: () => api.get<IssuerInfo>('/credentials-issuer') })
  const c = issuer.data?.counts
  return (
    <>
      <PageHeader title="Credentials" description="Tamper-proof digital certificates, badges and transcripts — signed, anchored and verifiable by anyone" />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Issued" value={c?.issued ?? '—'} icon={<BadgeCheck />} />
        <StatCard label="Active" value={c?.active ?? '—'} icon={<ShieldCheck />} tone="success" />
        <StatCard label="Revoked" value={c?.revoked ?? '—'} icon={<ShieldAlert />} tone="danger" />
        <StatCard label="Ledger height" value={issuer.data?.ledger.height ?? '—'} icon={<Link2 />} tone="info" hint={issuer.data?.ledger.head ? <span className="font-mono">{issuer.data.ledger.head.slice(0, 16)}…</span> : undefined} />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: 'issued', label: 'Issued' }, { value: 'issue', label: 'Issue new' }, { value: 'credits', label: 'Credit bank' }, { value: 'trust', label: 'Trust & ledger' }]} />
      {tab === 'issued' && <Issued />}
      {tab === 'issue' && <IssueWizard onDone={() => setTab('issued')} />}
      {tab === 'credits' && <CreditBank />}
      {tab === 'trust' && <Trust info={issuer.data} />}
    </>
  )
}

// ---------------- issued list ----------------
function Issued() {
  const { t } = useTranslation()
  const f = useFormat()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['credentials', q, status], queryFn: () => api.get<CredentialRow[]>(`/credentials${qs({ q, status })}`) })
  return (
    <>
      <Card className="mb-3 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" placeholder="Learner, title or credential ID…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
        </div>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('common.status')}>
          <option value="">{t('common.all')}</option><option value="ACTIVE">Active</option><option value="REVOKED">Revoked</option>
        </Select>
      </Card>
      <Card>
        {isLoading ? <Skeleton className="m-4 h-64" /> : !data?.length ? <EmptyState icon={<Award />} title={t('common.noData')} /> : (
          <Table>
            <thead><tr><Th>Credential</Th><Th>Learner</Th><Th>Issued</Th><Th>{t('common.status')}</Th></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setOpenId(c.id)}>
                  <Td><p className="font-medium">{c.title}</p><p className="font-mono text-xs text-muted-foreground">{c.id}</p></Td>
                  <Td><p>{c.learnerName}</p><p className="text-xs text-muted-foreground">{c.sectionName}</p></Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{f.date(c.issuedAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={c.status === 'ACTIVE' ? 'success' : 'danger'}>{c.status.toLowerCase()}</Badge>
                      {c.digilocker && <Badge variant="info">DigiLocker</Badge>}
                      {!c.shared && <Badge variant="muted">private</Badge>}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {openId && <CredentialDialog id={openId} admin onClose={() => setOpenId(null)} />}
    </>
  )
}

export function CredentialDialog({ id, admin, onClose }: { id: string; admin?: boolean; onClose: () => void }) {
  const { tenant } = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  const [json, setJson] = useState(false)
  const [reason, setReason] = useState('')
  const [revoking, setRevoking] = useState(false)
  const { data } = useQuery({ queryKey: ['credential', id], queryFn: () => api.get<CredentialDetail>(`/credentials/${id}`) })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['credential', id] })
    void qc.invalidateQueries({ queryKey: ['credentials'] })
    void qc.invalidateQueries({ queryKey: ['issuer'] })
  }
  const revoke = useMutation({
    mutationFn: () => api.post(`/credentials/${id}/revoke`, { reason }),
    onSuccess: () => { toast('Credential revoked — verifiers will now see it as revoked'); setRevoking(false); refresh() },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const push = useMutation({
    mutationFn: () => api.post(`/credentials/${id}/digilocker`),
    onSuccess: () => { toast('Delivered to the learner’s DigiLocker (sandbox)'); refresh() },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  return (
    <Dialog open onClose={onClose} wide title={data?.title ?? 'Credential'} description={data ? `${data.learnerName} · ${data.id}` : undefined}
      footer={<>
        <Button variant="ghost" className="me-auto" onClick={() => setJson(!json)}><FileJson />{json ? 'Certificate view' : 'View raw credential'}</Button>
        {admin && data?.status === 'ACTIVE' && tenant?.country === 'IN' && !data.digilocker && <Button variant="outline" loading={push.isPending} onClick={() => push.mutate()}><Send />Push to DigiLocker</Button>}
        {admin && data?.status === 'ACTIVE' && <Button variant="destructive" onClick={() => setRevoking(true)}><XCircle />Revoke</Button>}
      </>}>
      {!data ? <Skeleton className="h-96" /> : json ? (
        <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">{JSON.stringify(data.vc, null, 2)}</pre>
      ) : <CertificateView c={data} />}
      {data?.digilocker && <p className="mt-3 text-xs text-muted-foreground">DigiLocker URI <span className="font-mono">{data.digilocker.uri}</span> · delivered {new Date(data.digilocker.pushedAt).toLocaleString()}</p>}
      {revoking && (
        <div className="mt-4 space-y-2 rounded-lg border border-danger p-4">
          <p className="text-sm font-semibold">Revoke this credential</p>
          <p className="text-xs text-muted-foreground">Revocation is permanent. It is published in the status list and recorded on the ledger; anyone verifying the credential will see it as revoked.</p>
          <Input placeholder="Reason (required — kept in the audit log; verifiers only see that it is revoked)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Revocation reason" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRevoking(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason.trim()} loading={revoke.isPending} onClick={() => revoke.mutate()}>Confirm revocation</Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

// ---------------- issue wizard ----------------
function IssueWizard({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const academics = useAcademics()
  const templates = useQuery({ queryKey: ['templates'], queryFn: () => api.get<TemplateInfo[]>('/credentials/templates') })
  const [template, setTemplate] = useState<CredentialTemplate | null>(null)
  const [sectionId, setSectionId] = useState('')
  const [term, setTerm] = useState('')
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const params = template === 'GRADE_CARD' && term ? { term } : template === 'COURSE_COMPLETION' && courseId ? { courseId } : undefined
  const preview = useQuery({
    queryKey: ['issue-preview', template, sectionId, term, courseId],
    queryFn: () => api.post<IssuePreview>('/credentials/preview', { template, sectionId, params }),
    enabled: !!template && !!sectionId,
  })
  const info = templates.data?.find((x) => x.code === template)
  useEffect(() => {
    if (preview.data) setSelected(new Set(preview.data.rows.filter((r) => r.ok).map((r) => r.learnerId)))
  }, [preview.data])
  useEffect(() => {
    if (!info) return
    const course = preview.data?.courses.find((c) => c.id === courseId)
    setTitle(template === 'GRADE_CARD' && term ? `Grade card — ${term}` : template === 'COURSE_COMPLETION' && course ? `Course completion — ${course.name}` : info.name)
  }, [info, template, term, courseId, preview.data])
  const issue = useMutation({
    mutationFn: () => api.post<{ issued: number; skipped: string[] }>('/credentials/issue', { template, learnerIds: [...selected], title, sectionId, params }),
    onSuccess: (r) => {
      toast(`${r.issued} credential(s) signed, anchored and delivered to learners’ wallets${r.skipped.length ? ` · ${r.skipped.length} skipped` : ''}`)
      void qc.invalidateQueries({ queryKey: ['credentials'] })
      void qc.invalidateQueries({ queryKey: ['issuer'] })
      onDone()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const sections = useMemo(() => academics.data?.sections.filter((s) => s.learnerCount > 0) ?? [], [academics.data])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.data?.map((x) => (
          <button key={x.code} onClick={() => setTemplate(x.code)} className="cursor-pointer text-start">
            <Card className={cn('h-full p-4 transition hover:shadow-md', template === x.code && 'border-brand ring-2 ring-brand/30')}>
              <p className="flex items-center gap-2 font-semibold">{x.standard.includes('Open Badges') ? <Award className="size-4 text-warning" /> : <BadgeCheck className="size-4 text-brand" />}{x.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{x.description}</p>
              <Badge variant="outline" className="mt-2">{x.standard}</Badge>
            </Card>
          </button>
        ))}
      </div>
      {template && (
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
            <Field label="Section">{(id) => (
              <Select id={id} value={sectionId} onChange={(e) => { setSectionId(e.target.value); setTerm(''); setCourseId('') }}>
                <option value="">Choose…</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.termLabel}</option>)}
              </Select>
            )}</Field>
            {template === 'GRADE_CARD' && (
              <Field label="Term">{(id) => (
                <Select id={id} value={term} onChange={(e) => setTerm(e.target.value)} disabled={!preview.data?.terms.length}>
                  <option value="">Latest term</option>
                  {preview.data?.terms.map((x) => <option key={x}>{x}</option>)}
                </Select>
              )}</Field>
            )}
            {template === 'COURSE_COMPLETION' && (
              <Field label="Course">{(id) => (
                <Select id={id} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  <option value="">Choose…</option>
                  {preview.data?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}</Field>
            )}
            <Field label="Title on the credential" className={template === 'GRADE_CARD' || template === 'COURSE_COMPLETION' ? '' : 'sm:col-span-2'}>{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
          </CardContent>
        </Card>
      )}
      {template && sectionId && (template !== 'COURSE_COMPLETION' || courseId) && (
        <Card>
          <CardHeader>
            <CardTitle>Eligibility</CardTitle>
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          </CardHeader>
          {preview.isLoading || !preview.data ? <Skeleton className="m-4 h-40" /> : (
            <ul className="divide-y divide-border">
              {preview.data.rows.map((r) => (
                <li key={r.learnerId} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--brand)]" disabled={!r.ok} checked={selected.has(r.learnerId)} aria-label={`Select ${r.name}`}
                    onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.learnerId); else n.delete(r.learnerId); return n })} />
                  <span className="w-8 tabular-nums text-muted-foreground">{r.rollNo}</span>
                  <span className="flex-1 font-medium">{r.name}</span>
                  <span className={cn('text-xs', r.ok ? 'text-success' : 'text-muted-foreground')}>{r.reason}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">Each credential is built from live records, signed with the institution’s key (ECDSA P-256) and anchored on the ledger. Learners receive it in their wallet instantly.</p>
            <Button disabled={!selected.size || !title} loading={issue.isPending} onClick={() => issue.mutate()}><BadgeCheck />Sign & issue {selected.size || ''}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

// ---------------- credit bank ----------------
function CreditBank() {
  const f = useFormat()
  const toast = useToast()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['credit-overview'], queryFn: () => api.get<CreditOverview>('/credits/overview') })
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [learnerId, setLearnerId] = useState<string | null>(null)
  const learners = useQuery({
    queryKey: ['learners', 'credit', sectionId],
    queryFn: () => api.get<{ items: { id: string; firstName: string; lastName: string }[] }>(`/learners${qs({ sectionId, pageSize: 100 })}`),
    enabled: !!sectionId,
  })
  const push = useMutation({
    mutationFn: (id: string) => api.post<{ deposited: number }>('/credits/push', { sectionId: id }),
    onSuccess: (r) => { toast(`${r.deposited} course record(s) deposited`); void qc.invalidateQueries({ queryKey: ['credit-overview'] }); void qc.invalidateQueries({ queryKey: ['credits'] }) },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  if (isLoading || !data) return <Skeleton className="h-64" />
  if (!data.sections.length) return <Card><EmptyState title="Credit banking applies to credit-based programmes" description="School grades use progress reports instead." /></Card>
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader><CardTitle>{data.scheme === 'ABC' ? 'Academic Bank of Credits — sections' : 'ECTS records — sections'}</CardTitle></CardHeader>
        <Table>
          <thead><tr><Th>Section</Th><Th className="text-end">Credits</Th><Th>{data.scheme === 'ABC' ? 'ABC IDs' : 'Learners'}</Th><Th /></tr></thead>
          <tbody>
            {data.sections.map((s) => (
              <tr key={s.sectionId} className={cn('cursor-pointer hover:bg-muted/60', sectionId === s.sectionId && 'bg-brand-soft')} onClick={() => { setSectionId(s.sectionId); setLearnerId(null) }}>
                <Td><p className="font-medium">{s.sectionName}</p><p className="text-xs text-muted-foreground">{s.lastDeposit ? `Last deposit ${f.date(s.lastDeposit)}` : 'No deposits yet'}</p></Td>
                <Td className="text-end tabular-nums">{f.number(s.credits)}</Td>
                <Td>{s.linked}/{s.learners}</Td>
                <Td className="text-end">
                  <Button size="sm" variant="outline" disabled={!s.canPush} title={s.pushBlockedReason ?? undefined} loading={push.isPending && push.variables === s.sectionId} onClick={(e) => { e.stopPropagation(); push.mutate(s.sectionId) }}>Deposit term</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="p-4 text-xs text-muted-foreground">Deposits open once a section’s final examination results are published, so only final grades reach {data.scheme === 'ABC' ? 'ABC' : 'the ECTS record'}.</p>
      </Card>
      <div className="space-y-3">
        {sectionId && (
          <Select value={learnerId ?? ''} onChange={(e) => setLearnerId(e.target.value || null)} aria-label="Learner">
            <option value="">Choose a learner to view the statement…</option>
            {learners.data?.items.map((l) => <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>)}
          </Select>
        )}
        {learnerId ? <CreditStatementView learnerId={learnerId} /> : <Card><EmptyState title="Select a section, then a learner" /></Card>}
      </div>
    </div>
  )
}

// ---------------- trust & ledger ----------------
function Trust({ info }: { info?: IssuerInfo }) {
  const f = useFormat()
  const [check, setCheck] = useState<{ ok: boolean; checked: number } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!info) return <Skeleton className="h-64" />
  const verifyChain = async () => {
    setBusy(true)
    const { blocks } = await api.get<{ blocks: LedgerBlock[] }>('/public/ledger')
    let ok = true
    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i].prevHash !== blocks[i - 1].hash || (await blockHash(blocks[i])) !== blocks[i].hash) { ok = false; break }
    }
    setCheck({ ok, checked: blocks.length })
    setBusy(false)
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-brand" />Issuer identity</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Decentralised identifier (did:web)</p><p className="font-mono">{info.did}</p></div>
          <div><p className="text-xs text-muted-foreground">Published at</p><p className="font-mono text-xs">{info.didUrl}</p></div>
          <div><p className="text-xs text-muted-foreground">Signing key (ECDSA P-256 · created {info.keyCreatedAt ? f.date(info.keyCreatedAt) : '—'})</p><p className="break-all font-mono text-xs">x: {String(info.publicJwk?.x ?? '')}<br />y: {String(info.publicJwk?.y ?? '')}</p></div>
          <p className="text-xs text-muted-foreground">In production the private key lives in a hardware security module (HSM / cloud KMS) and never leaves it; this demo keeps it in browser storage. DigiLocker delivered: {info.counts.digilocker}.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="size-5 text-brand" />Anchoring ledger</CardTitle>
          <Button size="sm" variant="outline" loading={busy} onClick={() => void verifyChain()}>Verify whole chain</Button>
        </CardHeader>
        <CardContent>
          {check && <p className={cn('mb-3 flex items-center gap-2 text-sm', check.ok ? 'text-success' : 'text-danger')}>{check.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}{check.ok ? `All ${check.checked} blocks re-hashed and linked correctly.` : 'Chain integrity failure detected.'}</p>}
          <ul className="space-y-1.5 text-xs">
            {info.recentBlocks.map((b) => (
              <li key={b.index} className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-2 py-1.5">
                <span className="w-10 tabular-nums text-muted-foreground">#{b.index}</span>
                <Badge variant={b.action === 'REVOKE' ? 'danger' : b.action === 'ISSUE' ? 'success' : 'muted'}>{b.action.toLowerCase()}</Badge>
                <span className="font-mono">{b.credentialId}</span>
                <span className="ms-auto font-mono text-muted-foreground">{b.hash.slice(0, 12)}…</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Only hashes are stored on the ledger — never names, marks or IDs. Production anchors this chain to a permissioned network (e.g. Hyperledger Fabric) shared with partner institutions.</p>
        </CardContent>
      </Card>
    </div>
  )
}
