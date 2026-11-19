import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarClock, ClipboardCheck, GraduationCap, PencilLine, Star } from 'lucide-react'
import { api } from '@/lib/api'
import type { ClassSummary, LmsClasses } from '@/lib/apiTypes'
import { useFormat, useMe } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Badge, Card, EmptyState, PageHeader, Progress, Skeleton } from '@/components/ui'

const KID = ['from-sky-400 to-sky-500', 'from-amber-400 to-orange-400', 'from-emerald-400 to-teal-500', 'from-pink-400 to-rose-400', 'from-violet-400 to-purple-500']
const EMOJI: [RegExp, string][] = [[/math|number/i, '🔢'], [/english|story/i, '📖'], [/hindi|sanskrit/i, '🪔'], [/evs|science|world/i, '🌱'], [/computer/i, '💻']]

export default function LearnPage() {
  const { user } = useMe()
  const f = useFormat()
  const { data, isLoading } = useQuery({ queryKey: ['lms-classes'], queryFn: () => api.get<LmsClasses>('/lms/classes') })
  const teacher = data?.role === 'TEACHER'

  if (isLoading || !data) return <Skeleton className="h-96" />
  if (data.kidMode) {
    const classes = data.groups[0]?.classes ?? []
    return (
      <div className="kids-font">
        <h1 className="mb-1 text-3xl font-bold">My lessons 📚</h1>
        <p className="mb-6 text-lg text-muted-foreground">Tap a subject to learn and earn stars!</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {classes.map((c, i) => (
            <Link key={c.courseId} to={`/learn/${c.sectionId}/${c.courseId}`} className={cn('rounded-3xl bg-gradient-to-br p-5 text-white shadow-lg transition hover:-translate-y-1', KID[i % KID.length])}>
              <p className="text-5xl">{EMOJI.find(([re]) => re.test(c.courseName))?.[1] ?? '📚'}</p>
              <p className="mt-3 text-xl font-bold">{c.courseName}</p>
              <p className="mt-1 flex items-center gap-1 text-lg">{Array.from({ length: c.lessons }).map((_, k) => <Star key={k} className={cn('size-5', k < c.completed ? 'fill-white' : 'opacity-50')} />)}</p>
              {c.todo > 0 && <p className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-sm font-semibold">{c.todo} to do ✏️</p>}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={teacher ? (user.role === 'INST_ADMIN' ? 'Learning — all classes' : 'My classes') : 'Learn'}
        description={teacher ? 'Lessons, assignments, quizzes and live classes for each class you teach' : 'Your courses, lessons and coursework'}
      />
      {data.groups.map((g) => (
        <section key={g.learnerId ?? 'all'} className="mb-8">
          {g.learnerName && data.groups.length > 1 && <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{g.learnerName}</h2>}
          {!g.classes.length ? <Card><EmptyState icon={<GraduationCap />} title="No classes yet" /></Card> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {g.classes.map((c) => <ClassCard key={`${c.sectionId}${c.courseId}`} c={c} teacher={teacher} fmt={f} />)}
            </div>
          )}
        </section>
      ))}
    </>
  )
}

function ClassCard({ c, teacher, fmt }: { c: ClassSummary; teacher: boolean; fmt: ReturnType<typeof useFormat> }) {
  const pct = c.lessons ? Math.round((c.completed / c.lessons) * 100) : 0
  return (
    <Link to={`/learn/${c.sectionId}/${c.courseId}`}>
      <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{c.courseName}</p>
            <p className="truncate text-xs text-muted-foreground">{teacher ? c.sectionName : c.teacherName} · {c.courseCode}</p>
          </div>
          {teacher ? (c.toGrade > 0 && <Badge variant="warning"><PencilLine className="size-3" />{c.toGrade} to grade</Badge>) : c.todo > 0 && <Badge variant="warning">{c.todo} to do</Badge>}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><BookOpen className="size-3.5" />{c.lessons} lessons</span>
          <span className="flex items-center gap-1"><ClipboardCheck className="size-3.5" />{c.assignments} assignments · {c.quizzes} quizzes</span>
        </div>
        {!teacher && (
          <div className="mt-3 flex items-center gap-2">
            <Progress value={pct} className="flex-1" tone={pct === 100 ? 'success' : 'brand'} />
            <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
          </div>
        )}
        {c.nextLive && <p className="mt-3 flex items-center gap-1 text-xs text-info"><CalendarClock className="size-3.5" />Live: {fmt.date(c.nextLive.startsAt, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>}
      </Card>
    </Link>
  )
}
