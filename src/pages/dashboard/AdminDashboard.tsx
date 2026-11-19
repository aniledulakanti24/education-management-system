import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, BrainCircuit, ClipboardCheck, FlaskConical, GraduationCap, Layers, Users } from 'lucide-react'
import type { AdminDashboard } from '@/lib/apiTypes'
import { useFormat, useMe } from '@/lib/session'
import { LEVEL_ORDER } from '@/lib/frameworks'
import { Avatar, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader, Progress, StatCard } from '@/components/ui'
import { Donut, HBarChart, TrendChart } from '@/components/charts'
import { AdminExtras } from './Extras'
import { TeacherLms } from './LmsWidgets'

export default function AdminDashboardView({ d }: { d: AdminDashboard }) {
  const { t } = useTranslation()
  const { user, tenant } = useMe()
  const f = useFormat()
  const markedPct = d.sectionsTotal ? Math.round((d.markedToday / d.sectionsTotal) * 100) : 0
  const levels = [...d.byLevel].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))

  return (
    <>
      <PageHeader
        title={t('dash.welcome', { name: user.name.split(' ').slice(0, 2).join(' ') })}
        description={`${tenant?.name} · ${f.date(new Date().toISOString(), { dateStyle: 'full' })}`}
        actions={
          <>
            <Link to="/learners?new=1"><Button variant="outline"><GraduationCap />{t('common.add')} {t('nav.learners').toLowerCase()}</Button></Link>
            <Link to="/attendance"><Button><ClipboardCheck />{t('att.mark')}</Button></Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dash.learners')} value={f.number(d.counts.learners)} icon={<GraduationCap />} />
        <StatCard label={t('dash.staff')} value={f.number(d.counts.staff)} icon={<Users />} tone="info" />
        <StatCard label={t('dash.programmes')} value={f.number(d.counts.programs)} icon={<BookOpen />} tone="warning" hint={`${f.number(d.counts.sections)} ${t('dash.sections').toLowerCase()}`} />
        {d.scholars > 0
          ? <StatCard label="PhD scholars" value={f.number(d.scholars)} icon={<FlaskConical />} tone="success" />
          : <StatCard label={t('dash.avgAttendance')} value={f.pct(d.avgAttendance)} icon={<ClipboardCheck />} tone="success" />}
      </div>
      <AdminExtras />
      <TeacherLms showRisk />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t('dash.attendanceTrend')}</CardTitle>
              <CardDescription>{t('dash.avgAttendance')}: {f.pct(d.avgAttendance)}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart data={d.trend.map((x) => ({ label: f.date(x.date, { day: 'numeric', month: 'short' }), value: x.pct }))} format={(n) => f.pct(n)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('dash.markedToday')}</CardTitle>
              <CardDescription>{d.markedToday} / {d.sectionsTotal} {t('dash.sections').toLowerCase()}</CardDescription>
            </div>
            <Layers className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={markedPct} tone={markedPct === 100 ? 'success' : 'brand'} />
            <Link to="/attendance" className="text-sm font-medium text-brand hover:underline">{t('att.mark')} →</Link>
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium">{t('dash.gender')}</p>
              <Donut height={120} data={[{ label: 'Female', value: d.gender.F }, { label: 'Male', value: d.gender.M }, ...(d.gender.X ? [{ label: 'Non-binary / undisclosed', value: d.gender.X }] : [])]} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><BrainCircuit className="size-5 text-brand" />{t('dash.atRisk')}</CardTitle>
              <CardDescription>Learners below 75% attendance. <Link to="/insights" className="font-medium text-brand hover:underline">AI insights</Link> combines attendance, marks, fees and coursework into an explainable risk score.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {d.atRisk.length === 0 ? (
              <EmptyState title="No learners flagged" />
            ) : (
              <ul className="divide-y divide-border">
                {d.atRisk.map((l) => (
                  <li key={l.id}>
                    <Link to={`/learners/${l.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                      <Avatar name={`${l.firstName} ${l.lastName}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{l.firstName} {l.lastName}</p>
                        <p className="truncate text-xs text-muted-foreground">{l.sectionName} · {l.factors.join(' · ')}</p>
                      </div>
                      <Badge variant={l.riskScore >= 35 ? 'danger' : 'warning'}>Risk {l.riskScore}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('dash.byLevel')}</CardTitle></CardHeader>
          <CardContent>
            <HBarChart data={levels.map((l) => ({ label: t(`levels.${l.level}`), value: l.count }))} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t('dash.recent')}</CardTitle>
          <Link to="/audit" className="text-sm font-medium text-brand hover:underline">{t('common.viewAll')}</Link>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {d.recentAudit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <span><span className="font-medium">{a.actor}</span> — {a.action}</span>
                <span className="text-muted-foreground">{f.date(a.at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
