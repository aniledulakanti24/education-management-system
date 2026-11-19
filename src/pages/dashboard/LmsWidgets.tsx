import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, BrainCircuit, ClipboardList, PencilLine, PlayCircle, Video } from 'lucide-react'
import { api } from '@/lib/api'
import type { LmsSummary } from '@/lib/apiTypes'
import { useFormat } from '@/lib/session'
import { Button, Card, Progress, StatCard } from '@/components/ui'

const useLms = () => useQuery({ queryKey: ['lms-summary'], queryFn: () => api.get<LmsSummary>('/lms/summary') })

export function TeacherLms({ showRisk }: { showRisk?: boolean }) {
  const { data } = useLms()
  const f = useFormat()
  if (!data || data.kind !== 'teacher') return null
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Link to="/learn"><StatCard label="Submissions to grade" value={data.toGrade} icon={<PencilLine />} tone="warning" hint="AI grading assistant drafts scores" /></Link>
      <Link to="/learn"><StatCard label="Coursework submitted" value={data.submissionRate === null ? '—' : `${data.submissionRate}%`} icon={<ClipboardList />} tone="info" hint={`${data.lessons} lessons published`} /></Link>
      <Link to="/learn"><StatCard label="Quiz average" value={data.quizAvg === null ? '—' : `${data.quizAvg}%`} icon={<BookOpen />} tone="success" hint={data.nextLive ? `Next live: ${f.date(data.nextLive.startsAt, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'No live class scheduled'} /></Link>
      {showRisk
        ? <Link to="/insights"><StatCard label="AI early-warning" value={`${data.highRisk} high`} icon={<BrainCircuit />} tone="danger" hint={`${data.mediumRisk} medium · explainable model`} /></Link>
        : <Link to="/insights"><StatCard label="AI insights" value="Open" icon={<BrainCircuit />} tone="danger" hint="Learners in your classes who may need support" /></Link>}
    </div>
  )
}

export function LearnerLms({ kid }: { kid?: boolean }) {
  const { data } = useLms()
  const f = useFormat()
  if (!data || data.kind !== 'learner') return null
  if (kid) {
    const c = data.children[0]
    if (!c) return null
    return (
      <Link to={c.nextLesson ? `/learn/${c.nextLesson.sectionId}/${c.nextLesson.courseId}?lesson=${c.nextLesson.id}` : '/learn'} className="block rounded-3xl bg-gradient-to-r from-violet-500 to-fuchsia-500 p-6 text-white shadow-lg">
        <p className="text-2xl font-bold">📚 Keep learning!</p>
        <p className="mt-1 text-lg">{c.nextLesson ? `Next: ${c.nextLesson.title}` : 'You finished all your lessons!'} · ⭐ {c.completed}/{c.lessons}</p>
        {c.todo > 0 && <p className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 font-semibold">{c.todo} things to do ✏️</p>}
      </Link>
    )
  }
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {data.children.map((c) => (
        <Card key={c.learnerId} className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{data.children.length > 1 ? `${c.name.split(' ')[0]} · learning` : 'Continue learning'}</p>
            {c.todo > 0 && <Link to="/learn" className="text-sm font-medium text-warning hover:underline">{c.todo} to do</Link>}
          </div>
          <div className="flex items-center gap-2">
            <Progress value={c.lessons ? (c.completed / c.lessons) * 100 : 0} className="flex-1" />
            <span className="text-xs tabular-nums text-muted-foreground">{c.completed}/{c.lessons} lessons</span>
          </div>
          {c.nextLesson && (
            <Link to={`/learn/${c.nextLesson.sectionId}/${c.nextLesson.courseId}?lesson=${c.nextLesson.id}`}>
              <Button variant="soft" size="sm"><PlayCircle />{c.nextLesson.courseName}: {c.nextLesson.title}</Button>
            </Link>
          )}
          {c.nextLive && <p className="flex items-center gap-1.5 text-xs text-info"><Video className="size-3.5" />Live class {f.date(c.nextLive.startsAt, { weekday: 'long', hour: 'numeric', minute: '2-digit' })} — {c.nextLive.title}</p>}
        </Card>
      ))}
    </div>
  )
}
