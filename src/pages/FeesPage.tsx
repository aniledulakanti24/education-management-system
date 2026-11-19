import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, Building2, CheckCircle2, CreditCard, Landmark, Loader2, Plus, Printer, Receipt, Search, ShieldCheck, Smartphone, Trash2, Wallet } from 'lucide-react'
import { api, qs } from '@/lib/api'
import type { FeeSummary, InvoiceView } from '@/lib/apiTypes'
import { errorMessage, useAcademics } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Field, Input, PageHeader, Progress, Select, Skeleton, StatCard, Table, Td, Th, useToast } from '@/components/ui'
import { ColumnChart, Donut } from '@/components/charts'

const STATUS_TONE = { PAID: 'success', PARTIAL: 'info', DUE: 'warning', OVERDUE: 'danger' } as const
const METHOD_LABEL: Record<PaymentMethod, string> = { UPI: 'UPI', CARD: 'Card', NET_BANKING: 'Net banking', CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque' }

export default function FeesPage() {
  const { user } = useMe()
  return user.role === 'INST_ADMIN' ? <FeesConsole /> : <MyFees />
}

// ---------------- Admin console ----------------
function FeesConsole() {
  const { t } = useTranslation()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [structureId, setStructureId] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const summary = useQuery({ queryKey: ['fees-summary'], queryFn: () => api.get<FeeSummary>('/fees/summary') })
  const invoices = useQuery({
    queryKey: ['invoices', q, status, structureId],
    queryFn: () => api.get<InvoiceView[]>(`/fees/invoices${qs({ q, status, structureId })}`),
    placeholderData: keepPreviousData,
  })
  const remind = useMutation({
    mutationFn: () => api.post<{ sent: number }>('/fees/remind', {}),
    onSuccess: (r) => { toast(`Reminders queued for ${r.sent} families (SMS / email / WhatsApp — simulated)`); void qc.invalidateQueries({ queryKey: ['audit'] }) },
  })
  const s = summary.data
  const compact = (n: number) => new Intl.NumberFormat(f.tag, { notation: 'compact', maximumFractionDigits: 1 }).format(n)

  return (
    <>
      <PageHeader
        title="Fees & payments"
        description="Billing, collections, concessions and receipts"
        actions={
          <>
            <Button variant="outline" loading={remind.isPending} onClick={() => remind.mutate()}><BellRing />Remind all with dues</Button>
            <Button onClick={() => setCreating(true)}><Plus />Fee structure</Button>
          </>
        }
      />
      {!s ? <Skeleton className="h-28" /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Billed this term" value={f.money(s.billed)} icon={<Receipt />} hint={`${f.money(s.concessions)} in concessions & scholarships`} />
          <StatCard label="Collected" value={f.money(s.collected)} icon={<Wallet />} tone="success" hint={`${s.counts.PAID} invoices fully paid`} />
          <StatCard label="Outstanding" value={f.money(s.outstanding)} icon={<BellRing />} tone="danger" hint={`${s.counts.OVERDUE} overdue`} />
          <StatCard label="Collection rate" value={f.pct(s.rate)} icon={<Landmark />} tone="info" hint={<Progress value={s.rate} className="mt-1 h-1.5" tone="success" />} />
        </div>
      )}
      {s && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Daily collections</CardTitle></CardHeader>
            <CardContent><ColumnChart name="Collected" data={s.daily.map((d) => ({ label: f.date(d.date, { day: 'numeric', month: 'short' }), value: d.amount }))} format={compact} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>By payment method</CardTitle></CardHeader>
            <CardContent><Donut height={140} data={s.byMethod.map((m) => ({ label: METHOD_LABEL[m.method as PaymentMethod] ?? m.method, value: m.amount }))} format={compact} /></CardContent>
          </Card>
        </div>
      )}
      {s && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Fee structures</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {s.structures.map((st) => {
              const r = st.billed ? (st.collected / st.billed) * 100 : 0
              return (
                <button key={st.id} onClick={() => setStructureId(structureId === st.id ? '' : st.id)} className={cn('cursor-pointer rounded-lg border p-3 text-start', structureId === st.id ? 'border-brand bg-brand-soft' : 'border-border hover:bg-muted')}>
                  <p className="truncate text-sm font-medium capitalize">{st.name}</p>
                  <p className="text-xs text-muted-foreground">{st.invoices} invoices · {f.money(st.collected)} of {f.money(st.billed)}</p>
                  <Progress value={r} className="mt-2 h-1.5" tone={r > 85 ? 'success' : 'brand'} />
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="ps-9" placeholder="Learner, invoice or admission no…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
          </div>
          <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('common.status')}>
            <option value="">{t('common.all')} — {t('common.status').toLowerCase()}</option>
            <option value="OVERDUE">Overdue</option><option value="PARTIAL">Part-paid</option><option value="DUE">Due</option><option value="PAID">Paid</option>
          </Select>
        </div>
        {invoices.isLoading ? <Skeleton className="m-4 h-64" /> : !invoices.data?.length ? <EmptyState title={t('common.noData')} /> : (
          <Table>
            <thead><tr><Th>Invoice</Th><Th>Learner</Th><Th className="text-end">Net</Th><Th className="text-end">Paid</Th><Th className="text-end">Balance</Th><Th>Due</Th><Th>{t('common.status')}</Th></tr></thead>
            <tbody>
              {invoices.data.map((i) => (
                <tr key={i.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setOpenId(i.id)}>
                  <Td className="font-mono text-xs">{i.number}</Td>
                  <Td><p className="font-medium">{i.learnerName}</p><p className="text-xs text-muted-foreground">{i.sectionName}{i.discountReason ? ` · ${i.discountReason}` : ''}</p></Td>
                  <Td className="text-end tabular-nums">{f.money(i.net)}</Td>
                  <Td className="text-end tabular-nums">{f.money(i.paid)}</Td>
                  <Td className="text-end font-medium tabular-nums">{f.money(i.balance)}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{f.date(i.dueDate)}</Td>
                  <Td><Badge variant={STATUS_TONE[i.status]}>{i.status === 'OVERDUE' && i.paid > 0 ? 'Overdue · part-paid' : i.status.toLowerCase()}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {openId && <InvoiceDialog id={openId} onClose={() => setOpenId(null)} />}
      {creating && <StructureDialog onClose={() => setCreating(false)} />}
    </>
  )
}

// ---------------- Learner / guardian ----------------
function MyFees() {
  const f = useFormat()
  const [openId, setOpenId] = useState<string | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['invoices', 'mine'], queryFn: () => api.get<InvoiceView[]>('/fees/invoices') })
  const due = data?.reduce((a, i) => a + i.balance, 0) ?? 0
  return (
    <>
      <PageHeader title="Fees" description={data ? (due > 0 ? `${f.money(due)} outstanding` : 'All fees are paid — thank you!') : undefined} />
      {isLoading ? <Skeleton className="h-64" /> : !data?.length ? <Card><EmptyState icon={<Receipt />} title="No invoices" /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((i) => (
            <Card key={i.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold capitalize">{i.title}</p>
                  <p className="text-sm text-muted-foreground">{i.learnerName} · {i.number}</p>
                </div>
                <Badge variant={STATUS_TONE[i.status]}>{i.status.toLowerCase()}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="font-medium tabular-nums">{f.money(i.net)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Paid</dt><dd className="font-medium tabular-nums">{f.money(i.paid)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Balance</dt><dd className="font-semibold tabular-nums">{f.money(i.balance)}</dd></div>
              </dl>
              {i.discountReason && <p className="mt-2 text-xs text-success">{i.discountReason}: −{f.money(i.discount)}</p>}
              <p className="mt-2 text-xs text-muted-foreground">Due {f.date(i.dueDate)}{i.lateFee ? ` · late fee ${f.money(i.lateFee)}` : ''}</p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpenId(i.id)}><Receipt />Details & receipts</Button>
                {i.balance > 0 && <Button size="sm" onClick={() => setPayId(i.id)}><CreditCard />Pay {f.money(i.balance)}</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {openId && <InvoiceDialog id={openId} onClose={() => setOpenId(null)} />}
      {payId && <PayDialog invoice={data!.find((i) => i.id === payId)!} onClose={() => setPayId(null)} />}
    </>
  )
}

function PayDialog({ invoice, onClose }: { invoice: InvoiceView; onClose: () => void }) {
  const f = useFormat()
  const { tenant } = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  const india = tenant?.country === 'IN'
  const [amount, setAmount] = useState(String(invoice.balance))
  const [method, setMethod] = useState<PaymentMethod>(india ? 'UPI' : 'CARD')
  const [phase, setPhase] = useState<'form' | 'processing' | 'done'>('form')
  const [ref, setRef] = useState('')
  const m = useMutation({
    mutationFn: async () => {
      setPhase('processing')
      await new Promise((r) => setTimeout(r, 1400))
      return api.post<{ payment: { reference: string } }>(`/fees/invoices/${invoice.id}/payments`, { amount: Number(amount), method })
    },
    onSuccess: (r) => {
      setRef(r.payment.reference)
      setPhase('done')
      void qc.invalidateQueries({ queryKey: ['invoices'] })
      void qc.invalidateQueries({ queryKey: ['dashboard-extras'] })
    },
    onError: (e) => { setPhase('form'); toast(errorMessage(e), 'error') },
  })
  const methods: { id: PaymentMethod; label: string; icon: ReactNode }[] = [
    ...(india ? [{ id: 'UPI' as const, label: 'UPI', icon: <Smartphone /> }] : []),
    { id: 'CARD', label: 'Debit / credit card', icon: <CreditCard /> },
    { id: 'NET_BANKING', label: 'Net banking', icon: <Building2 /> },
  ]
  const n = Number(amount)
  const valid = n > 0 && n <= invoice.balance
  return (
    <Dialog open onClose={phase === 'processing' ? () => undefined : onClose} title={phase === 'done' ? 'Payment successful' : `Pay ${invoice.number}`} description={invoice.learnerName}>
      {phase === 'done' ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto size-14 text-success" />
          <p className="mt-3 text-2xl font-semibold tabular-nums">{f.money(n)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Reference <span className="font-mono">{ref}</span></p>
          <p className="mt-3 text-sm text-muted-foreground">A receipt has been added to the invoice. Email / SMS confirmation is simulated in demo mode.</p>
          <Button className="mt-5" onClick={onClose}>Done</Button>
        </div>
      ) : phase === 'processing' ? (
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground"><Loader2 className="size-8 animate-spin text-brand" />Contacting payment gateway (test mode)…</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-info/10 p-3 text-xs text-info"><ShieldCheck className="size-4 shrink-0" />Test mode: this demo simulates the gateway. No card, UPI or bank details are collected and no money moves.</div>
          <Field label="Amount" hint={`Balance due ${f.money(invoice.balance)} — part payments allowed`}>{(id) => <Input id={id} type="number" min={1} max={invoice.balance} value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          <div className="grid gap-2">
            {methods.map((x) => (
              <button key={x.id} onClick={() => setMethod(x.id)} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-start text-sm [&_svg]:size-4', method === x.id ? 'border-brand bg-brand-soft' : 'border-border hover:bg-muted')}>
                {x.icon}{x.label}
              </button>
            ))}
          </div>
          <Button className="w-full" size="lg" disabled={!valid} onClick={() => m.mutate()}>Pay {valid ? f.money(n) : ''}</Button>
        </div>
      )}
    </Dialog>
  )
}

// ---------------- Shared invoice dialog ----------------
function InvoiceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const f = useFormat()
  const { user } = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  const { data } = useQuery({ queryKey: ['invoice', id], queryFn: () => api.get<InvoiceView & { tenant: { name: string; city: string }; programName?: string }>(`/fees/invoices/${id}`) })
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  useEffect(() => { if (data) setAmount(String(data.balance)) }, [data])
  const record = useMutation({
    mutationFn: () => api.post(`/fees/invoices/${id}/payments`, { amount: Number(amount), method, reference }),
    onSuccess: () => {
      toast('Payment recorded — receipt issued')
      setReference('')
      void qc.invalidateQueries({ queryKey: ['invoice', id] })
      void qc.invalidateQueries({ queryKey: ['invoices'] })
      void qc.invalidateQueries({ queryKey: ['fees-summary'] })
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const remind = useMutation({ mutationFn: () => api.post('/fees/remind', { invoiceIds: [id] }), onSuccess: () => toast('Reminder sent to the family (simulated)') })
  const isAdmin = user.role === 'INST_ADMIN'

  return (
    <Dialog open onClose={onClose} wide title={data ? `Invoice ${data.number}` : 'Invoice'} description={data ? `${data.learnerName} · ${data.sectionName}` : undefined}
      footer={<>
        {isAdmin && data && data.balance > 0 && <Button variant="ghost" className="me-auto" loading={remind.isPending} onClick={() => remind.mutate()}><BellRing />Send reminder</Button>}
        <Button variant="outline" onClick={() => window.print()}><Printer />Print</Button>
        <Button onClick={onClose}>Close</Button>
      </>}>
      {!data ? <Skeleton className="h-64" /> : (
        <div className="print-area space-y-5">
          <div className="flex flex-wrap justify-between gap-3 text-sm">
            <div><p className="font-semibold">{data.tenant.name}</p><p className="text-muted-foreground">{data.tenant.city}</p></div>
            <div className="text-end"><p className="capitalize">{data.title}</p><p className="text-muted-foreground">Issued {f.date(data.issuedOn)} · due {f.date(data.dueDate)}</p><Badge variant={STATUS_TONE[data.status]} className="mt-1">{data.status.toLowerCase()}</Badge></div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {data.items.map((it) => <tr key={it.head}><td className="py-1.5">{it.head}</td><td className="py-1.5 text-end tabular-nums">{f.money(it.amount)}</td></tr>)}
              {data.discount > 0 && <tr className="text-success"><td className="py-1.5">{data.discountReason ?? 'Concession'}</td><td className="py-1.5 text-end tabular-nums">−{f.money(data.discount)}</td></tr>}
              {data.lateFee > 0 && <tr className="text-danger"><td className="py-1.5">Late fee</td><td className="py-1.5 text-end tabular-nums">{f.money(data.lateFee)}</td></tr>}
              <tr className="border-t border-border font-semibold"><td className="pt-2">Total payable</td><td className="pt-2 text-end tabular-nums">{f.money(data.net)}</td></tr>
              <tr><td className="py-1 text-muted-foreground">Paid</td><td className="py-1 text-end tabular-nums text-muted-foreground">{f.money(data.paid)}</td></tr>
              <tr className="font-semibold"><td>Balance</td><td className="text-end tabular-nums">{f.money(data.balance)}</td></tr>
            </tbody>
          </table>
          <div>
            <p className="mb-2 text-sm font-semibold">Payments & receipts</p>
            {!data.payments.length ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {data.payments.map((p, k) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>Receipt {data.number}/{k + 1} · {METHOD_LABEL[p.method]} · <span className="font-mono text-xs">{p.reference}</span></span>
                    <span className="text-muted-foreground">{f.date(p.at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    <span className="font-medium tabular-nums">{f.money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {isAdmin && data.balance > 0 && (
            <div className="no-print rounded-lg border border-border p-4">
              <p className="mb-3 text-sm font-semibold">Record an offline payment</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input type="number" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Select aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'CARD'] as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </Select>
                <Input placeholder="Cheque / UTR / receipt no." aria-label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <Button className="mt-3" loading={record.isPending} disabled={!(Number(amount) > 0)} onClick={() => record.mutate()}>Record payment</Button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

function StructureDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const f = useFormat()
  const academics = useAcademics()
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ name: '', frequency: 'TERM', dueDate: '', programIds: [] as string[], generate: true })
  const [items, setItems] = useState([{ head: 'Tuition fee', amount: '' }])
  const m = useMutation({
    mutationFn: () => api.post<{ generated: number }>('/fees/structures', { ...form, items: items.filter((i) => i.head && i.amount).map((i) => ({ head: i.head, amount: Number(i.amount) })) }),
    onSuccess: (r) => {
      toast(`Fee structure created${r.generated ? ` · ${r.generated} invoices raised` : ''}`)
      void qc.invalidateQueries()
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const total = items.reduce((a, i) => a + (Number(i.amount) || 0), 0)
  return (
    <Dialog open onClose={onClose} wide title="New fee structure"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.name || !form.programIds.length || !total} loading={m.isPending} onClick={() => m.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name *" className="sm:col-span-3">{(id) => <Input id={id} placeholder="e.g. Transport fee — Term 2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="Frequency">{(id) => <Select id={id} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}><option value="TERM">Per term</option><option value="SEMESTER">Per semester</option><option value="ANNUAL">Annual</option></Select>}</Field>
        <Field label="Due date">{(id) => <Input id={id} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />}</Field>
        <div className="flex items-end"><p className="text-sm">Total <span className="font-semibold tabular-nums">{f.money(total)}</span></p></div>
      </div>
      <p className="mb-2 mt-5 text-sm font-medium">Fee heads</p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <Input aria-label="Fee head" value={it.head} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, head: e.target.value } : x)))} />
            <Input aria-label="Amount" type="number" className="w-40" value={it.amount} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setItems([...items, { head: '', amount: '' }])}><Plus />Add head</Button>
      </div>
      <p className="mb-2 mt-5 text-sm font-medium">Programmes *</p>
      <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
        {academics.data?.programs.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={form.programIds.includes(p.id)} onChange={(e) => setForm({ ...form, programIds: e.target.checked ? [...form.programIds, p.id] : form.programIds.filter((x) => x !== p.id) })} />
            {p.name}
          </label>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={form.generate} onChange={(e) => setForm({ ...form, generate: e.target.checked })} />
        Raise invoices now for all active learners in these programmes
      </label>
    </Dialog>
  )
}

