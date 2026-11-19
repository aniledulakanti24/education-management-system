import { useState } from 'react'
import { Bot, X } from 'lucide-react'
import { useMe } from '@/lib/session'
import { AssistantChat } from './AssistantChat'
import { Button } from './ui'

const STARTERS: Record<string, string[]> = {
  INST_ADMIN: ['Who is at risk of dropping out?', 'Fee defaulters', 'Attendance below 75%', 'How many learners by level?'],
  FACULTY: ['Submissions I need to grade', 'Which of my students are at risk?', 'My classes today', 'Top performers'],
  STUDENT: ['What is due this week?', 'How am I doing?', 'My classes today', 'Explain photosynthesis'],
  GUARDIAN: ['How are my children doing?', 'Homework due this week', 'Any fees due?', 'Attendance this month'],
}

/** Floating assistant available on every page inside an institution. */
export function AssistantLauncher() {
  const { user, tenant } = useMe()
  const [open, setOpen] = useState(false)
  if (!tenant) return null
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="no-print fixed bottom-5 end-5 z-40 flex cursor-pointer items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-medium text-brand-foreground shadow-lg transition hover:brightness-110"
          aria-label="Open the UnifiedTree assistant"
        >
          <Bot className="size-5" /> <span className="hidden sm:inline">Ask UnifiedTree</span>
        </button>
      )}
      {open && (
        <div className="no-print fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:end-5 sm:bottom-5 sm:h-[600px] sm:w-[420px] sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="flex items-center gap-2 font-semibold"><Bot className="size-5 text-brand" />UnifiedTree Assistant</p>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close assistant"><X /></Button>
          </div>
          <AssistantChat
            className="min-h-0 flex-1"
            intro={`Hi ${user.name.split(' ')[0]}! Ask about ${user.role === 'INST_ADMIN' ? 'attendance, risk, fees, results or timetables' : user.role === 'FACULTY' ? 'your classes, grading, attendance and at-risk learners' : 'homework, results, attendance, fees — or ask me to explain a topic'}.`}
            starters={STARTERS[user.role] ?? []}
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}
    </>
  )
}
