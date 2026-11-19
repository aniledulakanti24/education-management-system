import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, CheckCircle2, ClipboardCheck, FlaskConical, GraduationCap, Layers } from 'lucide-react'
import type { FacultyDashboard } from '@/lib/apiTypes'
import { STAGE_LABEL } from '@/lib/apiTypes'
import { useFormat, useMe } from '@/lib/session'
import { Avatar, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader, StatCard } from '@/components/ui'
import { TodayClasses } from '@/components/learner-widgets'
import { FacultyExtras } from './Extras'
import { TeacherLms } from './LmsWidgets'

export default function FacultyDashboardView({ d }: { d: FacultyDashboard }) {
  const { t } = useTranslation()
  const { user } = useMe()
  const f = useFormat()
  return (
    <>
      <PageHeader title={t('dash.welcome', { name: user.name })} description={`${user.title} · ${f.date(new Date().toISOString(), { dateStyle: 'full' })}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dash.todaysClasses')} value={d.classes.length} icon={<CalendarDays />} />
        <StatCard label="Weekly teaching load" value={`${d.weeklyLoad} periods`} icon={<Layers />} tone="info" />
        <StatCard label={t('dash.sections')} value={d.sectionsTaught} icon={<ClipboardCheck />} tone="warning" />
        <StatCard label={t('nav.learners')} value={d.learnersTaught} icon={<GraduationCap />} tone="success" />
      </div>
      <FacultyExtras />
      <TeacherLms />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('dash.todaysClasses')}</CardTitle>
            <Link to="/timetable" className="text-sm font-medium text-brand hover:underline">{t('nav.myTimetable')}</Link>
          </CardHeader>
          <CardContent><TodayClasses classes={d.classes} show="section" /></CardContent>
        </Card>

        <div className="space-y-4">
          {d.classTeacherOf.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Class teacher / coordinator</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {d.classTeacherOf.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.room}</p>
                    </div>
                    {s.markedToday ? (
                      <Badge variant="success"><CheckCircle2 className="size-3" />{t('att.marked')}</Badge>
                    ) : (
                      <Link to={`/attendance?section=${s.id}`}><Button size="sm">{t('att.mark')}</Button></Link>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Low attendance in my classes</CardTitle>
                <CardDescription>Below 75%</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {d.lowAttendance.length === 0 ? <EmptyState title="Everyone is on track" /> : (
                <ul className="space-y-2">
                  {d.lowAttendance.map((l) => (
                    <li key={l.id}>
                      <Link to={`/learners/${l.id}`} className="flex items-center gap-2 text-sm hover:opacity-80">
                        <Avatar name={`${l.firstName} ${l.lastName}`} className="size-7 text-[10px]" />
                        <span className="flex-1 truncate">{l.firstName} {l.lastName} <span className="text-muted-foreground">· {l.sectionName}</span></span>
                        <Badge variant="danger">{f.pct(l.attendancePct)}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {d.scholars.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FlaskConical className="size-5 text-brand" />Doctoral scholars I supervise</CardTitle>
            <Link to="/research" className="text-sm font-medium text-brand hover:underline">{t('common.viewAll')}</Link>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {d.scholars.map((r) => {
              const done = r.milestones.filter((m) => m.done).length
              return (
                <div key={r.learnerId} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{r.learner?.firstName} {r.learner?.lastName}</p>
                    <Badge variant="info">{STAGE_LABEL[r.stage]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.topic}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{done}/{r.milestones.length} milestones · {r.publications} publications</p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </>
  )
}
