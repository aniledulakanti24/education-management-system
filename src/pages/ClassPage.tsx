import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bot, CheckCircle2, Circle, ClipboardCheck, ExternalLink, FileText, HelpCircle, Link2, Plus, Video } from 'lucide-react'
import { api } from '@/lib/api'
import type { ClassDetail } from '@/lib/apiTypes'
import { errorMessage } from '@/lib/queries'
import { useFormat } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Progress, Skeleton, Table, Tabs, Td, Th, useToast } from '@/components/ui'
import { AssistantChat } from '@/components/AssistantChat'
import { AssignmentDialog, NewAssignmentDialog } from './lms/AssignmentDialogs'
import { NewQuizDialog, QuizDialog } from './lms/QuizDialogs'
import { NewLessonDialog, NewLiveDialog } from './lms/CreateDialogs'

type Tab = 'lessons' | 'assignments' | 'quizzes' | 'live' | 'progress'

export default function ClassPage() {
  const { sectionId = '', courseId = '' } = useParams()
  const { t } = useTranslation()
  const f = useFormat()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('lessons')
  const [dialog, setDialog] = useState<'lesson' | 'assignment' | 'quiz' | 'live' | null>(null)
  const [openAssignment, setOpenAssignment] = useState<string | null>(null)
  const [openQuiz, setOpenQuiz] = useState<string | null>(null)
  const [tutorOpen, setTutorOpen] = useState(false)
  const key = ['lms-class', sectionId, courseId]
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<ClassDetail>(`/lms/classes/${sectionId}/${courseId}`) })
  const complete = useMutation({
    mutationFn: (id: string) => api.post<{ done: boolean }>(`/lms/lessons/${id}/complete`),
    onSuccess: (r) => {
      if (r.done) toast(data?.kidMode ? 'You earned a star! ⭐' : 'Lesson marked complete')
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: ['lms-classes'] })
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !data) return <Card><EmptyState title="Class not available" description={errorMessage(error)} /></Card>
  const teacher = data.access === 'TEACHER'
  const learner = data.access === 'LEARNER'
  const openLessonId = params.get('lesson')
  const lesson = data.lessons.find((l) => l.id === openLessonId) ?? null
  const modules = [...new Set(data.lessons.map((l) => l.module))]
  const done = data.lessons.filter((l) => l.done).length
  const now = new Date().toISOString()

  const tabs: { value: Tab; label: string }[] = [
    { value: 'lessons', label: `Lessons (${data.lessons.length})` },
    { value: 'assignments', label: `Assignments (${data.assignments.length})` },
    { value: 'quizzes', label: `Quizzes (${data.quizzes.length})` },
    { value: 'live', label: `Live classes (${data.live.length})` },
    ...(teacher ? [{ value: 'progress' as const, label: 'Progress' }] : []),
  ]
  const addLabel: Record<Tab, string | null> = { lessons: 'Lesson', assignments: 'Assignment', quizzes: 'Quiz', live: 'Live class', progress: null }

  return (
    <div className={cn(data.kidMode && 'kids-font')}>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate('/learn')}><ArrowLeft className="rtl:rotate-180" />{t('common.back')}</Button>
      <PageHeader
        title={data.summary.courseName}
        description={`${data.summary.sectionName} · ${data.summary.teacherName}${data.learnerName && data.access === 'GUARDIAN' ? ` · viewing as parent of ${data.learnerName}` : ''}`}
        actions={
          <>
            {!teacher && <Button variant="outline" onClick={() => setTutorOpen(true)}><Bot />AI tutor</Button>}
            {teacher && addLabel[tab] && <Button onClick={() => setDialog(tab === 'lessons' ? 'lesson' : tab === 'assignments' ? 'assignment' : tab === 'quizzes' ? 'quiz' : 'live')}><Plus />{addLabel[tab]}</Button>}
          </>
        }
      />
      {!teacher && data.lessons.length > 0 && (
        <Card className="mb-4 flex items-center gap-3 p-4">
          <span className="text-sm font-medium">{data.kidMode ? 'My stars' : 'Course progress'}</span>
          <Progress value={(done / data.lessons.length) * 100} className="flex-1" tone={done === data.lessons.length ? 'success' : 'brand'} />
          <span className="text-sm tabular-nums text-muted-foreground">{done}/{data.lessons.length}</span>
        </Card>
      )}
      <Tabs className="mb-4" value={tab} onChange={setTab} items={tabs} />

      {tab === 'lessons' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            {!modules.length && <Card><EmptyState icon={<FileText />} title="No lessons yet" /></Card>}
            {modules.map((m) => (
              <Card key={m}>
                <CardHeader><CardTitle className="text-sm">{m}</CardTitle></CardHeader>
                <ul className="divide-y divide-border">
                  {data.lessons.filter((l) => l.module === m).map((l) => (
                    <li key={l.id}>
                      <button onClick={() => setParams({ lesson: l.id })} className={cn('flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-start text-sm hover:bg-muted', openLessonId === l.id && 'bg-brand-soft')}>
                        {l.done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : l.kind === 'LINK' ? <Link2 className="size-4 shrink-0 text-muted-foreground" /> : l.kind === 'VIDEO' ? <Video className="size-4 shrink-0 text-muted-foreground" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                        <span className="flex-1">{l.title}</span>
                        <span className="text-xs text-muted-foreground">{l.minutes} min</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <Card className="self-start lg:sticky lg:top-20">
            {lesson ? (
              <>
                <CardHeader>
                  <div>
                    <p className="text-xs text-muted-foreground">{lesson.module}</p>
                    <CardTitle className={cn('mt-1', data.kidMode ? 'text-2xl' : 'text-lg')}>{lesson.title}</CardTitle>
                  </div>
                  <Badge variant="muted">{lesson.minutes} min</Badge>
                </CardHeader>
                <CardContent>
                  <div className={cn('whitespace-pre-line leading-relaxed', data.kidMode ? 'text-lg' : 'text-sm')}>{lesson.body}</div>
                  {lesson.url && (
                    <a href={lesson.url} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                      Open resource <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  <div className="mt-6 flex flex-wrap gap-2">
                    {learner && (
                      <Button variant={lesson.done ? 'outline' : 'default'} loading={complete.isPending} onClick={() => complete.mutate(lesson.id)}>
                        <CheckCircle2 />{lesson.done ? 'Completed — undo' : data.kidMode ? 'I finished! ⭐' : 'Mark complete'}
                      </Button>
                    )}
                    {!teacher && <Button variant="ghost" onClick={() => setTutorOpen(true)}><HelpCircle />Ask the tutor about this</Button>}
                  </div>
                  {teacher && <p className="mt-4 text-xs text-muted-foreground">Published {f.date(lesson.publishedAt)}</p>}
                </CardContent>
              </>
            ) : <EmptyState icon={<FileText />} title="Choose a lesson to read" />}
          </Card>
        </div>
      )}

      {tab === 'assignments' && (
        <div className="grid gap-3 md:grid-cols-2">
          {!data.assignments.length && <Card className="md:col-span-2"><EmptyState icon={<ClipboardCheck />} title="No assignments" /></Card>}
          {data.assignments.map((a) => {
            const overdue = a.dueAt < now
            return (
              <button key={a.id} onClick={() => setOpenAssignment(a.id)} className="cursor-pointer text-start">
                <Card className="h-full p-4 transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{a.title}</p>
                    {teacher ? <Badge variant={a.submitted - a.graded > 0 ? 'warning' : 'muted'}>{a.submitted - a.graded} to grade</Badge>
                      : a.mine ? <Badge variant={a.mine.status === 'GRADED' ? 'success' : 'info'}>{a.mine.status === 'GRADED' ? `${a.mine.score}/${a.maxPoints}` : 'Submitted'}</Badge>
                      : <Badge variant={overdue ? 'danger' : 'warning'}>{overdue ? 'Missing' : 'To do'}</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.instructions}</p>
                  <p className="mt-3 text-xs text-muted-foreground">Due {f.date(a.dueAt, { dateStyle: 'medium', timeStyle: 'short' })} · {a.maxPoints} points{teacher ? ` · ${a.submitted}/${a.roster} submitted` : ''}</p>
                </Card>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'quizzes' && (
        <div className="grid gap-3 md:grid-cols-2">
          {!data.quizzes.length && <Card className="md:col-span-2"><EmptyState icon={<HelpCircle />} title="No quizzes" /></Card>}
          {data.quizzes.map((q) => (
            <button key={q.id} onClick={() => setOpenQuiz(q.id)} className="cursor-pointer text-start">
              <Card className="h-full p-4 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{q.title}</p>
                  {teacher ? <Badge variant="muted">avg {q.avgPct ?? '—'}%</Badge> : q.mine ? <Badge variant="success">{q.mine.score}/{q.mine.max}</Badge> : <Badge variant="warning">Take quiz</Badge>}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{q.questionCount} questions · {q.timeLimitMin} min · due {f.date(q.dueAt)}{teacher ? ` · ${q.attempts} attempts` : ''}</p>
              </Card>
            </button>
          ))}
        </div>
      )}

      {tab === 'live' && (
        <Card>
          {!data.live.length ? <EmptyState icon={<Video />} title="No live classes scheduled" /> : (
            <ul className="divide-y divide-border">
              {data.live.map((v) => {
                const start = new Date(v.startsAt)
                const end = new Date(start.getTime() + v.minutes * 60000)
                const live = Date.now() >= start.getTime() - 10 * 60000 && Date.now() <= end.getTime()
                const past = Date.now() > end.getTime()
                return (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-info/12 text-info"><Video className="size-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{v.title}</p>
                      <p className="text-xs text-muted-foreground">{f.date(v.startsAt, { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {v.minutes} min</p>
                    </div>
                    {past ? <Badge variant="muted">Ended</Badge> : (
                      <a href={v.joinUrl} target="_blank" rel="noreferrer noopener"><Button size="sm" variant={live ? 'default' : 'outline'}><ExternalLink />{live ? 'Join now' : 'Join link'}</Button></a>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="border-t border-border p-3 text-xs text-muted-foreground">Live classes open in Jitsi Meet. Zoom, Google Meet, Teams and BigBlueButton connectors plug in at the same place.</p>
        </Card>
      )}

      {tab === 'progress' && teacher && (
        <Card>
          <Table>
            <thead><tr><Th className="w-14">Roll</Th><Th>Learner</Th><Th>Lessons</Th><Th className="text-end">Work submitted</Th><Th className="text-end">Quiz avg</Th></tr></thead>
            <tbody>
              {data.progress.map((p) => (
                <tr key={p.learnerId}>
                  <Td className="tabular-nums text-muted-foreground">{p.rollNo}</Td>
                  <Td className="font-medium">{p.name}</Td>
                  <Td><div className="flex items-center gap-2"><Progress value={data.lessons.length ? (p.lessonsDone / data.lessons.length) * 100 : 0} className="w-28" /><span className="text-xs tabular-nums text-muted-foreground">{p.lessonsDone}/{data.lessons.length}</span></div></Td>
                  <Td className="text-end">{p.due ? <Badge variant={p.submitted === p.due ? 'success' : 'warning'}>{p.submitted}/{p.due}</Badge> : '—'}</Td>
                  <Td className="text-end tabular-nums">{p.quizAvg === null ? '—' : `${p.quizAvg}%`}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {tutorOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setTutorOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-4">
              <p className="flex items-center gap-2 font-semibold"><Bot className="size-5 text-brand" />{data.summary.courseName} tutor</p>
              <Button variant="ghost" size="sm" onClick={() => setTutorOpen(false)}>{t('common.close')}</Button>
            </div>
            <AssistantChat
              className="flex-1"
              scope={{ sectionId, courseId }}
              intro={data.kidMode ? 'Hi! Ask me anything about your lessons and I’ll explain it simply. 🌟' : `I answer from this course’s published lessons and point you to the source. ${lesson ? `You’re reading “${lesson.title}”.` : ''}`}
              starters={lesson ? [`Explain ${lesson.title.toLowerCase()}`, 'Give me the key points', 'What should I remember?'] : ['What are the key ideas?', 'Explain the first lesson']}
              onNavigate={() => setTutorOpen(false)}
            />
          </div>
        </div>
      )}

      {dialog === 'lesson' && <NewLessonDialog sectionId={sectionId} courseId={courseId} modules={modules} onClose={() => setDialog(null)} />}
      {dialog === 'assignment' && <NewAssignmentDialog sectionId={sectionId} courseId={courseId} onClose={() => setDialog(null)} />}
      {dialog === 'quiz' && <NewQuizDialog sectionId={sectionId} courseId={courseId} onClose={() => setDialog(null)} />}
      {dialog === 'live' && <NewLiveDialog sectionId={sectionId} courseId={courseId} onClose={() => setDialog(null)} />}
      {openAssignment && <AssignmentDialog id={openAssignment} classKey={key} onClose={() => setOpenAssignment(null)} />}
      {openQuiz && <QuizDialog id={openQuiz} classKey={key} kidMode={data.kidMode} onClose={() => setOpenQuiz(null)} />}
    </div>
  )
}
