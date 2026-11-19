import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import type { TenantRow } from '@/lib/apiTypes'
import { FRAMEWORKS } from '@/lib/frameworks'
import { errorMessage } from '@/lib/queries'
import { useFormat } from '@/lib/session'
import { allLanguages } from '@/i18n/languages'
import type { FrameworkCode, InstitutionType, Tenant } from '@/types'
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, Table, Td, Th, useToast } from '@/components/ui'

const REGIONS: Tenant['region'][] = ['IN', 'EU', 'US', 'ME', 'APAC', 'AF', 'LATAM']

export default function TenantsPage() {
  const { t } = useTranslation()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['tenants'], queryFn: () => api.get<TenantRow[]>('/tenants') })
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Tenant['status'] }) => api.patch(`/tenants/${id}`, { status }),
    onSuccess: () => {
      toast('Tenant updated')
      void qc.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
  return (
    <>
      <PageHeader title={t('nav.tenants')} description="Each institution is an isolated tenant with its own branding, framework pack and data region." actions={<Button onClick={() => setOpen(true)}><Plus />Onboard institution</Button>} />
      <Card>
        {isLoading ? <Skeleton className="m-4 h-64" /> : !data?.length ? <EmptyState icon={<Building2 />} title={t('common.noData')} /> : (
          <Table>
            <thead><tr><Th>Institution</Th><Th>Framework</Th><Th>Region</Th><Th>Plan</Th><Th className="text-end">Learners</Th><Th className="text-end">Staff</Th><Th>{t('common.status')}</Th><Th /></tr></thead>
            <tbody>
              {data.map((tn) => (
                <tr key={tn.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: tn.brandColor }}>{tn.shortName.slice(0, 3)}</div>
                      <div>
                        <p className="font-medium">{tn.name}</p>
                        <p className="text-xs text-muted-foreground">{tn.subdomain}.unifiedtree.app · {tn.city}, {tn.country} · since {f.date(tn.createdAt)}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{FRAMEWORKS[tn.framework].code.replace(/_/g, ' ')}</Td>
                  <Td>{tn.region}</Td>
                  <Td><Badge variant="outline">{tn.plan}</Badge></Td>
                  <Td className="text-end tabular-nums">{f.number(tn.learners)}</Td>
                  <Td className="text-end tabular-nums">{f.number(tn.staff)}</Td>
                  <Td><Badge variant={tn.status === 'ACTIVE' ? 'success' : tn.status === 'TRIAL' ? 'warning' : 'danger'}>{tn.status}</Badge></Td>
                  <Td>
                    <Select className="h-8 w-32 text-xs" value={tn.status} onChange={(e) => setStatus.mutate({ id: tn.id, status: e.target.value as Tenant['status'] })} aria-label={`Status of ${tn.name}`}>
                      <option value="ACTIVE">Active</option><option value="TRIAL">Trial</option><option value="SUSPENDED">Suspended</option>
                    </Select>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {open && <OnboardDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function OnboardDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({
    name: '', subdomain: '', type: 'SCHOOL' as InstitutionType, framework: 'CBSE' as FrameworkCode, country: 'IN', city: '', region: 'IN' as Tenant['region'],
    currency: 'INR', defaultLanguage: 'en', timezone: 'Asia/Kolkata', plan: 'STARTER' as Tenant['plan'], brandColor: '#0d9488', adminName: '', adminEmail: '',
  })
  const pack = FRAMEWORKS[form.framework]
  const m = useMutation({
    mutationFn: () => api.post<Tenant>('/tenants', { ...form, levels: pack.levels }),
    onSuccess: (tn) => {
      toast(`${tn.name} onboarded — admin account created`)
      void qc.invalidateQueries()
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Dialog open onClose={onClose} wide title="Onboard a new institution" description="Creates the tenant, applies the framework pack and provisions an admin account."
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.name || !form.subdomain} loading={m.isPending} onClick={() => m.mutate()}>Create tenant</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Institution name *">{(id) => <Input id={id} value={form.name} onChange={(e) => setForm((x) => ({ ...x, name: e.target.value, subdomain: x.subdomain || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) }))} />}</Field>
        <Field label="Subdomain *" hint={`${form.subdomain || 'name'}.unifiedtree.app`}>{(id) => <Input id={id} value={form.subdomain} onChange={set('subdomain')} />}</Field>
        <Field label="Type">{(id) => (
          <Select id={id} value={form.type} onChange={set('type')}>
            <option value="SCHOOL">School (K-12)</option><option value="COLLEGE">College</option><option value="UNIVERSITY">University</option><option value="TRAINING">Training / vocational</option>
          </Select>
        )}</Field>
        <Field label="Framework pack" hint={pack.gradingScheme}>{(id) => (
          <Select id={id} value={form.framework} onChange={set('framework')}>
            {Object.values(FRAMEWORKS).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </Select>
        )}</Field>
        <Field label="Country (ISO code)">{(id) => <Input id={id} maxLength={2} value={form.country} onChange={(e) => setForm((x) => ({ ...x, country: e.target.value.toUpperCase() }))} />}</Field>
        <Field label="City">{(id) => <Input id={id} value={form.city} onChange={set('city')} />}</Field>
        <Field label="Data-residency region">{(id) => <Select id={id} value={form.region} onChange={set('region')}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</Select>}</Field>
        <Field label="Currency (ISO 4217)">{(id) => <Input id={id} maxLength={3} value={form.currency} onChange={(e) => setForm((x) => ({ ...x, currency: e.target.value.toUpperCase() }))} />}</Field>
        <Field label="Default language">{(id) => (
          <Select id={id} value={form.defaultLanguage} onChange={set('defaultLanguage')}>
            {allLanguages().map((l) => <option key={l.code} value={l.code}>{l.english}</option>)}
          </Select>
        )}</Field>
        <Field label="Time zone">{(id) => <Input id={id} value={form.timezone} onChange={set('timezone')} />}</Field>
        <Field label="Plan">{(id) => <Select id={id} value={form.plan} onChange={set('plan')}><option>STARTER</option><option>GROWTH</option><option>ENTERPRISE</option></Select>}</Field>
        <Field label="Brand colour">{(id) => <Input id={id} type="color" value={form.brandColor} onChange={set('brandColor')} className="p-1" />}</Field>
        <Field label="Admin name">{(id) => <Input id={id} value={form.adminName} onChange={set('adminName')} />}</Field>
        <Field label="Admin email">{(id) => <Input id={id} type="email" value={form.adminEmail} onChange={set('adminEmail')} />}</Field>
      </div>
    </Dialog>
  )
}
