import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Globe2, GraduationCap, Users } from 'lucide-react'
import type { SuperDashboard } from '@/lib/apiTypes'
import { FRAMEWORKS } from '@/lib/frameworks'
import { useFormat } from '@/lib/session'
import type { FrameworkCode } from '@/types'
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, StatCard, Table, Td, Th } from '@/components/ui'
import { Donut, HBarChart } from '@/components/charts'

const REGION: Record<string, string> = { IN: 'India', EU: 'Europe', US: 'North America', ME: 'Middle East', APAC: 'Asia-Pacific', AF: 'Africa', LATAM: 'Latin America' }

export default function SuperDashboardView({ d }: { d: SuperDashboard }) {
  const { t } = useTranslation()
  const f = useFormat()
  return (
    <>
      <PageHeader title="Platform overview" description="All institutions on UnifiedTree across regions and data-residency zones." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('nav.tenants')} value={d.totals.tenants} icon={<Building2 />} />
        <StatCard label="Learners on platform" value={f.number(d.totals.learners)} icon={<GraduationCap />} tone="success" />
        <StatCard label="Staff accounts" value={f.number(d.totals.staff)} icon={<Users />} tone="info" />
        <StatCard label="Countries" value={d.totals.countries} icon={<Globe2 />} tone="warning" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Tenants by region</CardTitle></CardHeader>
          <CardContent><Donut data={d.byRegion.map((r) => ({ label: REGION[r.name] ?? r.name, value: r.count }))} height={150} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By plan</CardTitle></CardHeader>
          <CardContent><Donut data={d.byPlan.map((r) => ({ label: r.name, value: r.count }))} height={150} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By framework pack</CardTitle></CardHeader>
          <CardContent><HBarChart data={d.byFramework.map((r) => ({ label: FRAMEWORKS[r.name as FrameworkCode]?.code.replace(/_/g, ' ') ?? r.name, value: r.count }))} /></CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t('nav.tenants')}</CardTitle>
          <Link to="/platform/tenants" className="text-sm font-medium text-brand hover:underline">{t('common.viewAll')}</Link>
        </CardHeader>
        <Table>
          <thead><tr><Th>{t('common.name')}</Th><Th>Region</Th><Th>Framework</Th><Th className="text-end">{t('nav.learners')}</Th><Th>{t('common.status')}</Th></tr></thead>
          <tbody>
            {d.tenants.map((tn) => (
              <tr key={tn.id}>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ background: tn.brandColor }} />
                    <span className="font-medium">{tn.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{tn.city}, {tn.country}</span>
                </Td>
                <Td>{REGION[tn.region]}</Td>
                <Td>{FRAMEWORKS[tn.framework].name}</Td>
                <Td className="text-end tabular-nums">{f.number(tn.learners)}</Td>
                <Td><Badge variant={tn.status === 'ACTIVE' ? 'success' : tn.status === 'TRIAL' ? 'warning' : 'danger'}>{tn.status}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
