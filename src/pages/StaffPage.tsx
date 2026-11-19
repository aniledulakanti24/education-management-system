import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { errorMessage, useStaff } from '@/lib/queries'
import type { Staff } from '@/types'
import { Avatar, Badge, Button, Card, Dialog, EmptyState, Field, Input, PageHeader, Skeleton, Table, Td, Th, useToast } from '@/components/ui'

export default function StaffPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useStaff()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [open, setOpen] = useState(false)
  const departments = [...new Set(data?.map((s) => s.department) ?? [])].sort()
  const list = (data ?? []).filter((s) => (!dept || s.department === dept) && (!q || `${s.name} ${s.designation} ${s.email}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <>
      <PageHeader title={t('nav.staff')} description={data ? `${data.length} staff · HR & payroll arrive in Phase 2` : undefined} actions={<Button onClick={() => setOpen(true)}><Plus />{t('common.add')}</Button>} />
      <Card className="mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" placeholder={`${t('common.search')}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant={dept ? 'ghost' : 'soft'} onClick={() => setDept('')}>{t('common.all')}</Button>
          {departments.map((d) => <Button key={d} size="sm" variant={dept === d ? 'soft' : 'ghost'} onClick={() => setDept(d)}>{d}</Button>)}
        </div>
      </Card>
      <Card>
        {isLoading ? <Skeleton className="m-4 h-64" /> : !list.length ? <EmptyState icon={<Users />} title={t('common.noData')} /> : (
          <Table>
            <thead><tr><Th>{t('common.name')}</Th><Th>Designation</Th><Th>Department</Th><Th className="hidden lg:table-cell">Teaches</Th><Th className="text-end">Load / week</Th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} />
                      <div className="min-w-0">
                        <p className="font-medium">{s.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.employeeNo} · {s.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {s.designation}
                    {s.isSupervisor && <Badge variant="info" className="ms-2">PhD supervisor{s.scholars ? ` · ${s.scholars}` : ''}</Badge>}
                  </Td>
                  <Td>{s.department}</Td>
                  <Td className="hidden max-w-xs lg:table-cell"><span className="line-clamp-2 text-xs text-muted-foreground">{s.courseNames.join(', ') || '—'}</span></Td>
                  <Td className="text-end tabular-nums">{s.weeklyLoad}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <AddStaffDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function AddStaffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const empty = { name: '', designation: '', department: '', qualification: '', email: '', phone: '', isSupervisor: false }
  const [form, setForm] = useState(empty)
  const m = useMutation({
    mutationFn: () => api.post<Staff>('/staff', form),
    onSuccess: (s) => {
      toast(`${s.name} added · ${s.employeeNo}`)
      void qc.invalidateQueries({ queryKey: ['staff'] })
      setForm(empty)
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Dialog open={open} onClose={onClose} title="Add staff member"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.name || !form.designation} loading={m.isPending} onClick={() => m.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *">{(id) => <Input id={id} value={form.name} onChange={set('name')} />}</Field>
        <Field label="Designation *">{(id) => <Input id={id} placeholder="e.g. TGT, Assistant Professor" value={form.designation} onChange={set('designation')} />}</Field>
        <Field label="Department">{(id) => <Input id={id} value={form.department} onChange={set('department')} />}</Field>
        <Field label="Qualification">{(id) => <Input id={id} value={form.qualification} onChange={set('qualification')} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set('phone')} />}</Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.isSupervisor} onChange={(e) => setForm((x) => ({ ...x, isSupervisor: e.target.checked }))} className="size-4 accent-[var(--brand)]" />
          Recognised research (PhD) supervisor
        </label>
      </div>
    </Dialog>
  )
}
