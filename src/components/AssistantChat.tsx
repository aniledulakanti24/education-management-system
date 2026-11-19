import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { BookOpen, Bot, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import type { AssistantAnswer } from '@/lib/apiTypes'
import { errorMessage } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Button, Input } from './ui'

interface Turn { role: 'user' | 'assistant'; text: string; answer?: AssistantAnswer }

export function AssistantChat({ scope, intro, starters, onNavigate, className }: {
  scope?: { sectionId: string; courseId: string }
  intro: string
  starters: string[]
  onNavigate?: () => void
  className?: string
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [q, setQ] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const ask = useMutation({
    mutationFn: (question: string) => api.post<AssistantAnswer>('/ai/assistant', { question, scope }),
    onSuccess: (answer) => setTurns((t) => [...t, { role: 'assistant', text: answer.text, answer }]),
    onError: (e) => setTurns((t) => [...t, { role: 'assistant', text: errorMessage(e) }]),
  })
  useEffect(() => {
    // scrollIntoView may return a Promise in newer browsers — never return it from an effect
    end.current?.scrollIntoView({ block: 'end' })
  }, [turns.length, ask.isPending])
  const send = (question: string) => {
    if (!question.trim() || ask.isPending) return
    setTurns((t) => [...t, { role: 'user', text: question.trim() }])
    setQ('')
    ask.mutate(question.trim())
  }
  const lastSuggestions = [...turns].reverse().find((t) => t.answer)?.answer?.suggestions ?? starters

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Bot className="size-4" /></div>
          <div className="rounded-2xl bg-muted px-3 py-2 text-sm">{intro}</div>
        </div>
        {turns.map((t, i) => (
          <div key={i} className={cn('flex gap-2', t.role === 'user' && 'justify-end')}>
            {t.role === 'assistant' && <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Bot className="size-4" /></div>}
            <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm', t.role === 'user' ? 'bg-brand text-brand-foreground' : 'bg-muted')}>
              <p className="whitespace-pre-wrap">{t.text}</p>
              {t.answer?.table && (
                <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card">
                  <table className="w-full text-xs">
                    <thead><tr>{t.answer.table.columns.map((c) => <th key={c} className="border-b border-border px-2 py-1.5 text-start font-medium text-muted-foreground">{c}</th>)}</tr></thead>
                    <tbody>{t.answer.table.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className="border-b border-border px-2 py-1.5">{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {!!t.answer?.sources?.length && (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">From your lessons</p>
                  {t.answer.sources.map((s) => (
                    <Link key={s.lessonId} to={s.href} onClick={onNavigate} className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"><BookOpen className="size-3" />{s.title} · {s.course}</Link>
                  ))}
                </div>
              )}
              {!!t.answer?.links?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {t.answer.links.map((l) => <Link key={l.href} to={l.href} onClick={onNavigate} className="text-xs font-medium text-brand hover:underline">{l.label} →</Link>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {ask.isPending && (
          <div className="flex gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Sparkles className="size-4 animate-pulse" /></div>
            <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">Thinking…</div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {lastSuggestions.slice(0, 4).map((s) => (
            <button key={s} onClick={() => send(s)} className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted">{s}</button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(q) }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question…" aria-label="Ask the assistant" maxLength={500} />
          <Button type="submit" size="icon" aria-label="Send" disabled={!q.trim()} loading={ask.isPending}>{!ask.isPending && <Send />}</Button>
        </form>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="size-3" />Answers use only data you can already see. On-device engine — Claude-ready.</p>
      </div>
    </div>
  )
}
