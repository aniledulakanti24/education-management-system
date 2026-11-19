import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Award, BookOpen, CalendarClock, FileSpreadsheet, Megaphone, PencilLine, UserPlus, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import type { DashboardExtras, DashboardExtrasAdmin, DashboardExtrasFaculty, DashboardExtrasLearner } from '@/lib/apiTypes'
import { useFormat } from '@/lib/session'
import type { Announcement } from '@/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Progress, Skeleton, StatCard } from '@/components/ui'

export function useExtras() {
  return useQuery({ queryKey: ['dashboard-extras'], queryFn: () => api.get<DashboardExtras>('/dashboard/extras') })
}

export function AnnouncementsCard({ items }: { items: Announcement[] }) {
  const f = useFormat()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Megaphone className="size-4 text-brand" />Announcements</CardTitle>
        <Link to="/communication" className="text-sm font-medium text-brand hover:underline">All</Link>
      </CardHeader>
      <CardContent>
        {!items.length ? <p className="text-sm text-muted-foreground">Nothing new</p> : (
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id}>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{f.date(a.createdAt, { day: 'numeric', month: 'short' })} · {a.authorName}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminExtras() {
  const { data } = useExtras()
  const f = useFormat()
  if (!data) return <Skeleton className="mt-4 h-28" />
  const d = data as DashboardExtrasAdmin
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Link to="/fees"><StatCard label="Fee collection" value={f.pct(d.fees.rate)} icon={<Wallet />} tone="success" hint={`${f.money(d.fees.outstanding)} outstanding · ${d.fees.overdue} overdue`} /></Link>
      <Link to="/admissions"><StatCard label="Open applications" value={d.admissions.open} icon={<UserPlus />} hint={`${d.admissions.newThisWeek} new this week · ${d.admissions.offered} offers`} /></Link>
      <Link to="/exams">
        <StatCard
          label={d.marks ? `${d.marks.name} — marks entry` : 'Next assessment'}
          value={d.marks ? `${d.marks.entered}/${d.marks.expected}` : d.nextExam ? f.date(d.nextExam.startDate, { day: 'numeric', month: 'short' }) : '—'}
          icon={<FileSpreadsheet />}
          tone="warning"
          hint={d.marks ? <Progress value={(d.marks.entered / Math.max(1, d.marks.expected)) * 100} className="mt-1 h-1.5" /> : d.nextExam?.name}
        />
      </Link>
      <Link to="/library"><StatCard label="Library books out" value={d.library.issued} icon={<BookOpen />} tone="info" hint={`${d.library.overdue} overdue`} /></Link>
    </div>
  )
}

export function FacultyExtras() {
  const { data } = useExtras()
  if (!data) return null
  const d = data as DashboardExtrasFaculty
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PencilLine className="size-4 text-warning" />Marks to enter</CardTitle>
          <Link to="/exams" className="text-sm font-medium text-brand hover:underline">Gradebook</Link>
        </CardHeader>
        <CardContent>
          {!d.pendingMarks.length ? <p className="text-sm text-muted-foreground">You’re all caught up.</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {d.pendingMarks.slice(0, 6).map((p) => (
                <Link key={`${p.assessmentId}${p.sectionId}${p.courseId}`} to={`/exams?a=${p.assessmentId}&section=${p.sectionId}&course=${p.courseId}`} className="rounded-lg border border-border p-3 text-sm hover:bg-muted">
                  <p className="font-medium">{p.courseName}</p>
                  <p className="text-xs text-muted-foreground">{p.sectionName} · {p.assessmentName}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <AnnouncementsCard items={d.announcements} />
    </div>
  )
}

export function LearnerExtras({ only }: { only?: string }) {
  const { data } = useExtras()
  const f = useFormat()
  if (!data) return null
  const d = data as DashboardExtrasLearner
  const kids = d.children.filter((c) => !only || c.learnerId === only)
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {kids.map((c) => (
          <Card key={c.learnerId} className="grid gap-px overflow-hidden bg-border sm:grid-cols-3">
            <Link to="/results" className="bg-card p-4 hover:bg-muted">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Award className="size-3.5" />{only ? 'Results' : `${c.name.split(' ')[0]} · results`}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{c.overall === null ? '—' : f.pct(c.overall)} {c.overallGrade && <Badge>{c.overallGrade}</Badge>}</p>
              <p className="text-xs text-muted-foreground">{c.gpa !== null ? `${c.gpaLabel} ${c.gpa}` : ''}{c.rank ? ` · rank ${c.rank}/${c.classSize}` : ''}{c.latestAssessment ? ` · up to ${c.latestAssessment}` : ''}</p>
            </Link>
            <Link to="/fees" className="bg-card p-4 hover:bg-muted">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="size-3.5" />Fees due</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{f.money(c.feeBalance)}</p>
              {c.feeBalance > 0 ? <Badge variant={c.feeOverdue ? 'danger' : 'warning'}>{c.feeOverdue ? 'Overdue — pay now' : 'Due'}</Badge> : <Badge variant="success">All paid</Badge>}
            </Link>
            <Link to="/library" className="bg-card p-4 hover:bg-muted">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BookOpen className="size-3.5" />Library</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{c.loans.length} book{c.loans.length === 1 ? '' : 's'}</p>
              {c.loans[0] && <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><CalendarClock className="size-3" />{c.loans[0].bookTitle} · due {f.date(c.loans[0].dueOn, { day: 'numeric', month: 'short' })}</p>}
            </Link>
          </Card>
        ))}
        {kids.some((c) => c.feeBalance > 0) && (
          <Link to="/fees"><Button size="sm"><Wallet />Pay fees online</Button></Link>
        )}
      </div>
      <AnnouncementsCard items={d.announcements} />
    </div>
  )
}
