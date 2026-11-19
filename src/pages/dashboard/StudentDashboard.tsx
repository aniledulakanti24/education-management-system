import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Award, BookOpenCheck, CalendarDays, FlaskConical, IdCard, Star } from 'lucide-react'
import type { LearnerSummary, StudentDashboard } from '@/lib/apiTypes'
import { STAGE_LABEL } from '@/lib/apiTypes'
import { useFormat, useMe } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, Progress } from '@/components/ui'
import { AttendanceRing, AttendanceStrip, TodayClasses } from '@/components/learner-widgets'
import { LearnerExtras } from './Extras'
import { LearnerLms } from './LmsWidgets'

const KID_COLORS = ['bg-sky-400', 'bg-amber-400', 'bg-emerald-400', 'bg-pink-400', 'bg-violet-400', 'bg-orange-400', 'bg-teal-400']
const SUBJECT_EMOJI: [RegExp, string][] = [
  [/math|number/i, '🔢'], [/english|story/i, '📖'], [/hindi|sanskrit/i, '🪔'], [/evs|science|world/i, '🌱'],
  [/computer/i, '💻'], [/art|music|play/i, '🎨'], [/physical/i, '⚽'],
]
const emojiFor = (name: string) => SUBJECT_EMOJI.find(([re]) => re.test(name))?.[1] ?? '📚'

/** Child-friendly view (under 11): big tiles, emoji, stars instead of percentages. */
function KidsView({ d }: { d: LearnerSummary }) {
  const { t } = useTranslation()
  const { tenant } = useMe()
  const stars = d.attendance.recent.filter((r) => r.status !== 'A').length
  return (
    <div className="kids-font space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-brand to-sky-500 p-6 text-white shadow-lg sm:p-8">
        <p className="text-4xl font-bold sm:text-5xl">{t('kids.hello', { name: d.learner.firstName })} 👋</p>
        <p className="mt-2 text-lg opacity-90">{d.learner.sectionName} · {tenant?.name}</p>
      </div>

      <section>
        <h2 className="mb-3 text-2xl font-bold">{t('kids.myDay')} ☀️</h2>
        {d.today.length === 0 ? (
          <p className="text-lg text-muted-foreground">🎉 {t('dash.noClasses')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {d.today.map((c, i) => (
              <div key={c.id} className={cn('rounded-2xl p-4 text-white shadow', KID_COLORS[i % KID_COLORS.length])}>
                <p className="text-4xl">{emojiFor(c.courseName)}</p>
                <p className="mt-2 text-lg font-bold leading-tight">{c.courseName}</p>
                <p className="text-sm opacity-90">#{c.period}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <LearnerLms kid />

      <section className="rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 dark:bg-amber-950/30">
        <h2 className="text-2xl font-bold">{t('kids.myAttendance')} ⭐</h2>
        <div className="mt-3 flex flex-wrap gap-1">
          {d.attendance.recent.map((r) => (
            <Star key={r.date} className={cn('size-7', r.status !== 'A' ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
          ))}
        </div>
        <p className="mt-3 text-lg">{stars} ⭐ — {t('kids.great')}</p>
      </section>
    </div>
  )
}

function AdultView({ d }: { d: LearnerSummary }) {
  const { t } = useTranslation()
  const f = useFormat()
  const r = d.research
  return (
    <>
      <PageHeader title={t('dash.welcome', { name: d.learner.firstName })} description={`${d.learner.programName} · ${d.learner.sectionName}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-brand" />{t('dash.todaysClasses')}</CardTitle>
            <Link to="/timetable" className="text-sm font-medium text-brand hover:underline">{t('nav.myTimetable')}</Link>
          </CardHeader>
          <CardContent><TodayClasses classes={d.today} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('nav.myAttendance')}</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {d.attendance.total > 0 ? (
              <>
                <AttendanceRing pct={d.attendance.pct} />
                <p className="text-sm text-muted-foreground">{d.attendance.counts.P + d.attendance.counts.L + d.attendance.counts.E} / {d.attendance.total} days</p>
                {d.attendance.pct !== null && d.attendance.pct < 75 && <Badge variant="danger">Below the 75% minimum</Badge>}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Doctoral scholars record attendance through progress reviews.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <LearnerLms />
      <LearnerExtras only={d.learner.id} />

      {r && (
        <Card className="mt-4">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><FlaskConical className="size-5 text-brand" />My research</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{r.topic}</p>
            </div>
            <Badge variant="info">{STAGE_LABEL[r.stage]}</Badge>
          </CardHeader>
          <CardContent>
            <Progress value={(r.milestones.filter((m) => m.done).length / r.milestones.length) * 100} />
            <ol className="mt-4 grid gap-2 sm:grid-cols-2">
              {r.milestones.map((m) => (
                <li key={m.label} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className={cn(m.done && 'text-muted-foreground line-through')}>{m.label}</span>
                  <span className="text-xs text-muted-foreground">{f.date(m.due)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {d.attendance.recent.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Last {d.attendance.recent.length} working days</CardTitle></CardHeader>
          <CardContent><AttendanceStrip recent={d.attendance.recent} /></CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <IdCardTile label="APAAR ID" value={d.learner.apaarId} />
        <IdCardTile label="ABC ID (Academic Bank of Credits)" value={d.learner.abcId} />
        <Link to="/wallet">
          <Card className="flex h-full items-center gap-3 p-4 transition hover:shadow-md">
            <Award className="size-6 text-brand" />
            <div>
              <p className="text-sm font-medium">Verifiable credentials</p>
              <p className="text-xs text-muted-foreground">Certificates, badges & transcripts — open wallet</p>
            </div>
          </Card>
        </Link>
      </div>
    </>
  )
}

function IdCardTile({ label, value }: { label: string; value?: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      {value ? <IdCard className="size-6 text-brand" /> : <BookOpenCheck className="size-6 text-muted-foreground" />}
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{value ?? 'Not applicable'}</p>
      </div>
    </Card>
  )
}

export default function StudentDashboardView({ d }: { d: StudentDashboard }) {
  return d.age < 11 ? <KidsView d={d} /> : <AdultView d={d} />
}
