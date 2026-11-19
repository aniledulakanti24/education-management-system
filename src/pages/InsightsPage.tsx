import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BrainCircuit, ChevronDown, Info, MessageSquareHeart, Search, ShieldCheck } from 'lucide-react'
import { api, qs } from '@/lib/api'
import type { RiskResponse, RiskRow } from '@/lib/apiTypes'
import { useAcademics } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, PageHeader, Select, Skeleton, StatCard, Tabs } from '@/components/ui'

const TIER_TONE = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'success' } as const

export default function InsightsPage() {
  const { t } = useTranslation()
  const { user } = useMe()
  const f = useFormat()
  const academics = useAcademics()
  const [sectionId, setSectionId] = useState('')
  const [tier, setTier] = useState<'HIGH' | 'MEDIUM' | 'ALL'>('ALL')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['risk', sectionId], queryFn: () => api.get<RiskResponse>(`/ai/risk${qs({ sectionId })}`) })
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => (tier === 'ALL' ? r.tier !== 'LOW' : r.tier === tier) && (!q || r.name.toLowerCase().includes(q.toLowerCase()))), [data, tier, q])

  return (
    <>
      <PageHeader
        title="AI insights"
        description="Early-warning for learners who may need support — explainable, live, and always reviewed by a person"
        actions={user.role === 'INST_ADMIN' && (
          <Select className="w-auto min-w-52" value={sectionId} onChange={(e) => setSectionId(e.target.value)} aria-label={t('common.section')}>
            <option value="">{t('common.all')} — {t('common.section').toLowerCase()}s</option>
            {academics.data?.sections.filter((s) => s.learnerCount).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
      />
      {isLoading || !data ? <Skeleton className="h-96" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="High risk" value={data.distribution.HIGH} icon={<BrainCircuit />} tone="danger" hint="Probability ≥ 50%" />
            <StatCard label="Medium risk" value={data.distribution.MEDIUM} icon={<BrainCircuit />} tone="warning" hint="25–50%" />
            <StatCard label="On track" value={data.distribution.LOW} icon={<ShieldCheck />} tone="success" hint={`Scored ${f.date(data.generatedAt, { timeStyle: 'short' })}`} />
          </div>

          <div className="my-4 flex flex-wrap items-center gap-3">
            <Tabs value={tier} onChange={setTier} items={[{ value: 'ALL', label: 'Needs attention' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }]} />
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="ps-9" placeholder="Find a learner…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              {!rows.length && <Card><EmptyState icon={<ShieldCheck />} title="No learners in this group" /></Card>}
              {rows.map((r) => <RiskCard key={r.learnerId} r={r} open={open === r.learnerId} onToggle={() => setOpen(open === r.learnerId ? null : r.learnerId)} />)}
            </div>
            <Card className="self-start">
              <CardHeader><CardTitle className="flex items-center gap-2"><Info className="size-4" />How the score works</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{data.model.name}</p>
                <ul className="space-y-2">
                  {data.model.features.map((x) => (
                    <li key={x.key} className="flex justify-between gap-2">
                      <span><span className="font-medium">{x.label}</span><span className="block text-xs text-muted-foreground">{x.help}</span></span>
                      <Badge variant="outline" className="h-fit shrink-0">×{x.coef}</Badge>
                    </li>
                  ))}
                </ul>
                <div className="space-y-1.5 border-t border-border pt-3">
                  {data.model.limits.map((l) => <p key={l} className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />{l}</p>)}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
}

function RiskCard({ r, open, onToggle }: { r: RiskRow; open: boolean; onToggle: () => void }) {
  const max = Math.max(...r.contributions.map((c) => c.value), 0.01)
  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="flex w-full cursor-pointer items-center gap-3 p-4 text-start" aria-expanded={open}>
        <Avatar name={r.name} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.sectionName} · {r.contributions[0]?.detail}</p>
        </div>
        <div className="text-end">
          <Badge variant={TIER_TONE[r.tier]}>{r.tier.toLowerCase()}</Badge>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{r.probability}%</p>
        </div>
        <ChevronDown className={cn('size-4 text-muted-foreground transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-border p-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why flagged</p>
            <ul className="space-y-2">
              {r.contributions.filter((c) => c.value > 0).map((c) => (
                <li key={c.key} className="text-sm">
                  <div className="flex justify-between gap-2"><span>{c.label}</span><span className="text-xs tabular-nums text-muted-foreground">+{c.value}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-danger" style={{ width: `${(c.value / max) * 100}%` }} /></div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested next steps</p>
            <ul className="space-y-2 text-sm">
              {r.interventions.map((i) => <li key={i} className="flex gap-2"><MessageSquareHeart className="mt-0.5 size-4 shrink-0 text-brand" />{i}</li>)}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/learners/${r.learnerId}`}><Button size="sm" variant="outline">Open profile</Button></Link>
              <Link to="/communication?tab=messages"><Button size="sm" variant="soft">Message family / teacher</Button></Link>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
