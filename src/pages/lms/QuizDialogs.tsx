import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Plus, Trash2, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import type { QuizDetail } from '@/lib/apiTypes'
import { errorMessage } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { Quiz, QuizAttempt } from '@/types'
import { Badge, Button, Dialog, Field, Input, Progress, Skeleton, useToast } from '@/components/ui'

export function QuizDialog({ id, classKey, kidMode, onClose }: { id: string; classKey: string[]; kidMode: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data } = useQuery({ queryKey: ['quiz', id], queryFn: () => api.get<QuizDetail>(`/lms/quizzes/${id}`) })
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<{ attempt: QuizAttempt; quiz: Quiz } | null>(null)
  const submit = useMutation({
    mutationFn: () => api.post<{ attempt: QuizAttempt; quiz: Quiz }>(`/lms/quizzes/${id}/attempt`, { answers }),
    onSuccess: (r) => {
      setResult(r)
      void qc.invalidateQueries({ queryKey: classKey })
      void qc.invalidateQueries({ queryKey: ['lms-classes'] })
      void qc.invalidateQueries({ queryKey: ['quiz', id] })
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  if (!data) return <Dialog open onClose={onClose} title="Quiz"><Skeleton className="h-48" /></Dialog>
  const quiz = result?.quiz ?? data.quiz

  if (data.access === 'TEACHER') {
    return (
      <Dialog open onClose={onClose} wide title={quiz.title} description={`${data.attempts?.length ?? 0} attempts`}>
        <div className="space-y-4">
          {quiz.questions.map((q, i) => {
            const pct = data.perQuestion?.[i]?.correctPct
            return (
              <div key={q.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{i + 1}. {q.prompt}</p>
                  <Badge variant={pct === null || pct === undefined ? 'muted' : pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'danger'}>{pct ?? '—'}% correct</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Answer: {q.options[q.answer]} · {q.explanation}</p>
                {pct !== null && pct !== undefined && pct < 40 && <p className="mt-1 text-xs text-danger">Most of the class missed this — consider re-teaching it.</p>}
              </div>
            )
          })}
          <div>
            <p className="mb-2 text-sm font-semibold">Scores</p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {data.attempts?.map((a) => <li key={a.id} className="flex justify-between rounded px-2 py-1 hover:bg-muted"><span>{a.learnerName}</span><span className="tabular-nums">{a.score}/{a.max}</span></li>)}
            </ul>
          </div>
        </div>
      </Dialog>
    )
  }

  const attempt = result?.attempt ?? data.mine
  if (attempt) {
    const pct = Math.round((attempt.score / attempt.max) * 100)
    return (
      <Dialog open onClose={onClose} wide title={quiz.title} description="Your result">
        <div className={cn('mb-4 rounded-xl p-4 text-center', pct >= 70 ? 'bg-success/12' : 'bg-warning/15')}>
          <p className="text-3xl font-bold tabular-nums">{attempt.score} / {attempt.max}</p>
          <p className="text-sm">{kidMode ? (pct >= 70 ? 'Amazing! 🌟🌟🌟' : 'Good try! Read the lesson again and you’ll get it. 💪') : pct >= 70 ? 'Well done.' : 'Review the explanations below.'}</p>
        </div>
        <ol className="space-y-3">
          {quiz.questions.map((q, i) => {
            const ok = attempt.answers[i] === q.answer
            return (
              <li key={q.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="flex items-start gap-2 font-medium">{ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}{q.prompt}</p>
                {!ok && <p className="mt-1 text-xs text-danger">Your answer: {q.options[attempt.answers[i]] ?? '—'}</p>}
                <p className="mt-1 text-xs text-success">Correct: {q.options[q.answer]}</p>
                {q.explanation && <p className="mt-1 text-xs text-muted-foreground">{q.explanation}</p>}
              </li>
            )
          })}
        </ol>
      </Dialog>
    )
  }

  if (data.access === 'GUARDIAN') return <Dialog open onClose={onClose} title={quiz.title}><p className="text-sm text-muted-foreground">Not attempted yet.</p></Dialog>

  const answered = answers.filter((a) => a !== undefined).length
  return (
    <Dialog open onClose={onClose} wide title={quiz.title} description={`${quiz.questions.length} questions · ${quiz.timeLimitMin} min · one attempt`}
      footer={<Button disabled={answered < quiz.questions.length} loading={submit.isPending} onClick={() => submit.mutate()}>Submit answers</Button>}>
      <Progress value={(answered / quiz.questions.length) * 100} className="mb-4" />
      <ol className="space-y-5">
        {quiz.questions.map((q, i) => (
          <li key={q.id}>
            <p className={cn('mb-2 font-medium', kidMode && 'text-lg')}>{i + 1}. {q.prompt}</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={q.prompt}>
              {q.options.map((o, k) => (
                <button key={k} role="radio" aria-checked={answers[i] === k} onClick={() => setAnswers((a) => { const n = [...a]; n[i] = k; return n })}
                  className={cn('cursor-pointer rounded-lg border px-3 py-2 text-start text-sm', answers[i] === k ? 'border-brand bg-brand-soft font-medium' : 'border-border hover:bg-muted', kidMode && 'py-3 text-base')}>
                  {o}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </Dialog>
  )
}

export function NewQuizDialog({ sectionId, courseId, onClose }: { sectionId: string; courseId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState([{ prompt: '', options: ['', '', '', ''], answer: 0, explanation: '' }])
  const m = useMutation({
    mutationFn: () => api.post('/lms/quizzes', { sectionId, courseId, title, questions }),
    onSuccess: () => {
      toast('Quiz published — it is marked automatically')
      void qc.invalidateQueries({ queryKey: ['lms-class', sectionId, courseId] })
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const update = (i: number, patch: Partial<(typeof questions)[number]>) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const valid = title && questions.every((q) => q.prompt && q.options.filter(Boolean).length >= 2 && q.options[q.answer])
  return (
    <Dialog open onClose={onClose} wide title="Create a quiz"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>Publish</Button></>}>
      <Field label="Quiz title *">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
      <div className="mt-4 space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex gap-2">
              <Input aria-label={`Question ${i + 1}`} placeholder={`Question ${i + 1}`} value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
              <Button variant="ghost" size="icon" aria-label="Remove question" onClick={() => setQuestions(questions.filter((_, j) => j !== i))} disabled={questions.length === 1}><Trash2 /></Button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {q.options.map((o, k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name={`ans-${i}`} className="size-4 accent-[var(--brand)]" checked={q.answer === k} onChange={() => update(i, { answer: k })} aria-label={`Mark option ${k + 1} correct`} />
                  <Input placeholder={`Option ${k + 1}`} value={o} onChange={(e) => update(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
                </label>
              ))}
            </div>
            <Input className="mt-2" placeholder="Explanation shown after the attempt (optional)" value={q.explanation} onChange={(e) => update(i, { explanation: e.target.value })} />
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setQuestions([...questions, { prompt: '', options: ['', '', '', ''], answer: 0, explanation: '' }])}><Plus />Add question</Button>
      </div>
    </Dialog>
  )
}
