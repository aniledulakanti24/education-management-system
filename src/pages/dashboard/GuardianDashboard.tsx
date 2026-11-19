import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BellRing } from 'lucide-react'
import type { GuardianDashboard } from '@/lib/apiTypes'
import { useMe } from '@/lib/session'
import { Avatar, Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui'
import { AttendanceRing, AttendanceStrip, TodayClasses } from '@/components/learner-widgets'
import { LearnerExtras } from './Extras'
import { LearnerLms } from './LmsWidgets'

export default function GuardianDashboardView({ d }: { d: GuardianDashboard }) {
  const { t } = useTranslation()
  const { user } = useMe()
  return (
    <>
      <PageHeader title={t('dash.welcome', { name: user.name })} description={t('nav.children')} />
      <LearnerExtras />
      <LearnerLms />
      <div className="h-4" />
      <div className="space-y-6">
        {d.children.map((c) => {
          const absentToday = c.attendance.recent.at(-1)?.status === 'A'
          return (
            <Card key={c.learner.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar name={`${c.learner.firstName} ${c.learner.lastName}`} className="size-12 text-sm" />
                  <div>
                    <CardTitle className="text-lg">{c.learner.firstName} {c.learner.lastName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{c.learner.programName} · {c.learner.sectionName} · Age {c.age}</p>
                  </div>
                </div>
                <Link to={`/learners/${c.learner.id}`} className="flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                  Full profile <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-3">
                <div className="flex flex-col items-center gap-2">
                  <AttendanceRing pct={c.attendance.pct} />
                  <p className="text-sm text-muted-foreground">{t('dash.avgAttendance')}</p>
                  {absentToday && <Badge variant="danger"><BellRing className="size-3" /> Marked absent on last working day</Badge>}
                </div>
                <div className="lg:col-span-2">
                  <p className="mb-2 text-sm font-medium">{t('dash.todaysClasses')}</p>
                  <TodayClasses classes={c.today} />
                </div>
                <div className="lg:col-span-3">
                  <AttendanceStrip recent={c.attendance.recent} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
