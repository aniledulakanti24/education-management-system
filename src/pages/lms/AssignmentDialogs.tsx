import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { AiGradeSuggestion, AssignmentDetail } from '@/lib/apiTypes'
import { errorMessage } from '@/lib/queries'
import { useFormat } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, Skeleton, useToast } from '@/components/ui'

export function AssignmentDialog({ id, classKey, onClose }: { id: string; classKey: string[]; onClose: () => void }) {
  const f = useFormat()
  const { data } = useQuery({ queryKey: ['assignment', id], queryFn: () => api.get<AssignmentDetail>(`/lms/assignments/${id}`) })
  const [grading, setGrading] = useState<string | null>(null)
  if (!data) return <Dialog open onClose={onClose} title="Assignment"><Skeleton className="h-48" /></Dialog>
  const a = data.assignment
  const sub = grading ? data.submissions.find((s) => s.id === grading) : null

  return (
    <Dialog open onClose={onClose} wide title={a.title} description={`Due ${f.date(a.dueAt, { dateStyle: 'medium', timeStyle: 'short' })} · ${a.maxPoints} points`}>
      {sub ? (
        <GradePanel assignmentId={id} classKey={classKey} sub={sub} max={a.maxPoints} onBack={() => setGrading(null)} />
      ) : (
        <div className="space-y-5">
          <p className="whitespace-pre-line text-sm">{a.instructions}</p>
          <div>
            <p className="mb-2 text-sm font-semibold">Rubric</p>
            <div className="flex flex-wrap gap-2">
              {a.rubric.map((r) => <Badge key={r.criterion} variant="outline">{r.criterion} · {r.points} pts</Badge>)}
            </div>
          </div>
          {data.access === 'TEACHER' ? <TeacherSubmissions data={data} onGrade={setGrading} /> : <LearnerSubmission data={data} classKey={classKey} />}
        </div>
      )}
    </Dialog>
  )
}

function TeacherSubmissions({ data, onGrade }: { data: AssignmentDetail; onGrade: (id: string) => void }) {
  const f = useFormat()
  return (
    <div>
      {data.flags.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-warning/12 p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>Similarity check: {data.flags.length} pair(s) of submissions are near-identical. Review before grading — similarity is a prompt for a conversation, not proof of copying.</span>
        </div>
      )}
      <p className="mb-2 text-sm font-semibold">Submissions ({data.submissions.length}){data.missing?.length ? ` · ${data.missing.length} missing` : ''}</p>
      {!data.submissions.length ? <EmptyState title="No submissions yet" /> : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.submissions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-36 flex-1 font-medium">{s.learnerName}</span>
              <span className="text-xs text-muted-foreground">{f.date(s.submittedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              {s.late && <Badge variant="danger">Late</Badge>}
              {!!s.similarTo?.length && <Badge variant="warning" title={s.similarTo.map((x) => `${x.name} ${x.score}%`).join(', ')}>Similar to {s.similarTo[0].name.split(' ')[0]} {s.similarTo[0].score}%</Badge>}
              {s.status === 'GRADED' ? <Badge variant="success">{s.score}{s.aiAssisted ? ' · AI-assisted' : ''}</Badge> : <Badge variant="info">To grade</Badge>}
              <Button size="sm" variant={s.status === 'GRADED' ? 'ghost' : 'soft'} onClick={() => onGrade(s.id)}>{s.status === 'GRADED' ? 'Review' : 'Grade'}</Button>
            </li>
          ))}
        </ul>
      )}
      {!!data.missing?.length && <p className="mt-3 text-xs text-muted-foreground">Not submitted: {data.missing.join(', ')}</p>}
    </div>
  )
}

function GradePanel({ assignmentId, classKey, sub, max, onBack }: { assignmentId: string; classKey: string[]; sub: AssignmentDetail['submissions'][number]; max: number; onBack: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [score, setScore] = useState(sub.score?.toString() ?? '')
  const [feedback, setFeedback] = useState(sub.feedback ?? '')
  const [ai, setAi] = useState<AiGradeSuggestion | null>(null)
  const [usedAi, setUsedAi] = useState(!!sub.aiAssisted)
  const suggest = useMutation({
    mutationFn: () => api.post<AiGradeSuggestion>(`/lms/submissions/${sub.id}/suggest`),
    onSuccess: (r) => setAi(r),
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const save = useMutation({
    mutationFn: () => api.post(`/lms/submissions/${sub.id}/grade`, { score: Number(score), feedback, aiAssisted: usedAi }),
    onSuccess: () => {
      toast('Grade saved and shared with the learner')
      void qc.invalidateQueries({ queryKey: ['assignment', assignmentId] })
      void qc.invalidateQueries({ queryKey: classKey })
      void qc.invalidateQueries({ queryKey: ['lms-classes'] })
      onBack()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="rtl:rotate-180" />All submissions</Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{sub.learnerName}</p>
        {sub.late && <Badge variant="danger">Submitted late</Badge>}
      </div>
      <Card className="whitespace-pre-wrap bg-muted p-4 text-sm leading-relaxed">{sub.text}</Card>

      <div className="rounded-lg border border-brand/40 bg-brand-soft p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-brand" />AI grading assistant</p>
          <Button size="sm" variant="soft" loading={suggest.isPending} onClick={() => suggest.mutate()}><Sparkles />{ai ? 'Re-run' : 'Suggest a grade'}</Button>
        </div>
        {ai ? (
          <div className="mt-3 space-y-3 text-sm">
            <ul className="space-y-1.5">
              {ai.criteria.map((c) => (
                <li key={c.criterion} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>{c.criterion}{c.missing.length ? <span className="text-xs text-muted-foreground"> — missing: {c.missing.join(', ')}</span> : ''}</span>
                  <span className="font-medium tabular-nums">{c.points}/{c.max}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">{ai.feedback}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Suggested {ai.total}/{max}</Badge>
              <Badge variant={ai.confidence === 'HIGH' ? 'success' : ai.confidence === 'MEDIUM' ? 'warning' : 'danger'}>{ai.confidence.toLowerCase()} confidence</Badge>
              <Button size="sm" onClick={() => { setScore(String(ai.total)); setFeedback(ai.feedback); setUsedAi(true) }}><CheckCircle2 />Use suggestion</Button>
            </div>
          </div>
        ) : <p className="mt-2 text-xs text-muted-foreground">Scores the answer against your rubric keywords and drafts feedback. You review and decide the final mark.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label={`Score / ${max}`}>{(id) => <Input id={id} type="number" min={0} max={max} step={0.5} value={score} onChange={(e) => setScore(e.target.value)} />}</Field>
        <Field label="Feedback to learner">{(id) => <textarea id={id} rows={3} className="w-full rounded-lg border border-border bg-card p-2 text-sm" value={feedback} onChange={(e) => setFeedback(e.target.value)} />}</Field>
      </div>
      <div className="flex justify-end">
        <Button disabled={score === '' || Number(score) < 0 || Number(score) > max} loading={save.isPending} onClick={() => save.mutate()}>Save grade</Button>
      </div>
    </div>
  )
}

function LearnerSubmission({ data, classKey }: { data: AssignmentDetail; classKey: string[] }) {
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const mine = data.submissions[0]
  const [text, setText] = useState(mine?.text ?? '')
  useEffect(() => setText(mine?.text ?? ''), [mine?.text])
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const submit = useMutation({
    mutationFn: () => api.post<{ late: boolean }>(`/lms/assignments/${data.assignment.id}/submit`, { text }),
    onSuccess: (r) => {
      toast(r.late ? 'Submitted (after the due date)' : 'Submitted — your teacher will review it')
      void qc.invalidateQueries({ queryKey: ['assignment', data.assignment.id] })
      void qc.invalidateQueries({ queryKey: classKey })
      void qc.invalidateQueries({ queryKey: ['lms-classes'] })
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  if (data.access === 'GUARDIAN') {
    return mine ? <Card className="whitespace-pre-wrap p-4 text-sm">{mine.text}{mine.status === 'GRADED' && <p className="mt-3 font-medium">Score {mine.score}/{data.assignment.maxPoints} — {mine.feedback}</p>}</Card> : <EmptyState title="Not submitted yet" />
  }
  if (mine?.status === 'GRADED') {
    return (
      <div className="space-y-3">
        <Card className="border-success p-4">
          <p className="text-lg font-semibold">{mine.score} / {data.assignment.maxPoints}</p>
          <p className="mt-1 text-sm">{mine.feedback}</p>
          <p className="mt-2 text-xs text-muted-foreground">Graded {mine.gradedAt ? f.date(mine.gradedAt) : ''}{mine.aiAssisted ? ' · AI-assisted, confirmed by your teacher' : ''}</p>
        </Card>
        <Card className="whitespace-pre-wrap bg-muted p-4 text-sm">{mine.text}</Card>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {mine && <p className="text-sm text-info">Submitted {f.date(mine.submittedAt, { dateStyle: 'medium', timeStyle: 'short' })}. You can update it until it is graded.</p>}
      <textarea aria-label="Your answer" rows={8} className="w-full rounded-lg border border-border bg-card p-3 text-sm" placeholder="Write your answer here…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-xs', words < 5 ? 'text-muted-foreground' : 'text-success')}>{words} words</span>
        <Button disabled={words < 5} loading={submit.isPending} onClick={() => submit.mutate()}>{mine ? 'Update submission' : 'Submit'}</Button>
      </div>
    </div>
  )
}

export function NewAssignmentDialog({ sectionId, courseId, onClose }: { sectionId: string; courseId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const due = new Date(Date.now() + 7 * 864e5)
  due.setHours(23, 59, 0, 0)
  const [form, setForm] = useState({ title: '', instructions: '', dueAt: new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 16), maxPoints: 10 })
  const [rubric, setRubric] = useState([{ criterion: 'Key concepts', points: 6, keywords: '' }, { criterion: 'Clarity & examples', points: 4, keywords: 'example' }])
  const m = useMutation({
    mutationFn: () => api.post('/lms/assignments', { ...form, sectionId, courseId, rubric: rubric.map((r) => ({ ...r, points: Number(r.points), keywords: r.keywords.split(',') })) }),
    onSuccess: () => {
      toast('Assignment set — learners are notified')
      void qc.invalidateQueries({ queryKey: ['lms-class', sectionId, courseId] })
      void qc.invalidateQueries({ queryKey: ['lms-classes'] })
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  return (
    <Dialog open onClose={onClose} wide title="Set an assignment"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.title || !form.instructions} loading={m.isPending} onClick={() => m.mutate()}>Publish</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Title *" className="sm:col-span-3">{(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Field label="Instructions *" className="sm:col-span-3">{(id) => <textarea id={id} rows={4} className="w-full rounded-lg border border-border bg-card p-3 text-sm" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />}</Field>
        <Field label="Due" className="sm:col-span-2">{(id) => <Input id={id} type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />}</Field>
        <Field label="Points">{(id) => <Input id={id} type="number" min={1} value={form.maxPoints} onChange={(e) => setForm({ ...form, maxPoints: Number(e.target.value) })} />}</Field>
      </div>
      <p className="mb-2 mt-5 text-sm font-semibold">Rubric <span className="font-normal text-muted-foreground">— keywords help the AI grading assistant: comma-separated, use a|b for alternatives</span></p>
      <div className="space-y-2">
        {rubric.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_1.5fr_auto]">
            <Input aria-label="Criterion" value={r.criterion} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)))} />
            <Input aria-label="Points" type="number" min={1} value={r.points} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)))} />
            <Input aria-label="Keywords" placeholder="e.g. chlorophyll, sunlight" value={r.keywords} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label="Remove criterion" onClick={() => setRubric(rubric.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setRubric([...rubric, { criterion: '', points: 2, keywords: '' }])}><Plus />Add criterion</Button>
      </div>
    </Dialog>
  )
}
