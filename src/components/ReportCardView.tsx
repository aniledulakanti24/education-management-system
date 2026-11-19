import { useQuery } from '@tanstack/react-query'
import { Award, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import type { ReportCard } from '@/lib/apiTypes'
import { useFormat, useMe } from '@/lib/session'
import { FRAMEWORKS } from '@/lib/frameworks'
import { Badge, Button, Card, EmptyState, Skeleton } from './ui'

export function ReportCardView({ learnerId }: { learnerId: string }) {
  const { tenant } = useMe()
  const f = useFormat()
  const { data, isLoading } = useQuery({ queryKey: ['results', learnerId], queryFn: () => api.get<ReportCard>(`/results/${learnerId}`) })
  if (isLoading || !data) return <Skeleton className="h-96" />
  if (!data.assessments.length) return <Card><EmptyState icon={<Award />} title="No published results yet" description="Results appear here once the exam office publishes them." /></Card>
  const pack = tenant ? FRAMEWORKS[tenant.framework] : null

  return (
    <Card className="print-area overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-brand-soft p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">{tenant?.name} · Progress report</p>
          <h2 className="mt-1 text-xl font-semibold">{data.learner.name}</h2>
          <p className="text-sm text-muted-foreground">{data.learner.programName} · {data.learner.sectionName} · Roll {data.learner.rollNo} · {data.learner.admissionNo}</p>
          <p className="text-sm text-muted-foreground">{data.term}{data.learner.apaarId ? ` · APAAR ${data.learner.apaarId}` : ''}</p>
        </div>
        <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}><Printer />Print / PDF</Button>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {[
          ['Overall', data.overall === null ? '—' : f.pct(data.overall)],
          ['Grade', data.overallGrade ?? '—'],
          [data.gpaLabel ?? 'Rank', data.gpaLabel ? (data.gpa === null ? '—' : `${data.gpa} / ${data.gpaScale}`) : data.rank ? `${data.rank} of ${data.classSize}` : '—'],
          ['Attendance', f.pct(data.attendancePct)],
        ].map(([k, v]) => (
          <div key={k} className="bg-card p-4">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="border-b border-border px-4 py-2.5 text-start">Course</th>
              {data.rows.some((r) => r.credits > 0) && <th className="border-b border-border px-3 py-2.5 text-end">Credits</th>}
              {data.assessments.map((a) => <th key={a.id} className="border-b border-border px-3 py-2.5 text-end" title={`Weight ${a.weight}%`}>{a.name}<span className="block font-normal normal-case">/ {a.maxMarks}</span></th>)}
              <th className="border-b border-border px-3 py-2.5 text-end">%</th>
              <th className="border-b border-border px-4 py-2.5 text-center">Grade</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.courseId}>
                <td className="border-b border-border px-4 py-2.5 font-medium">{r.courseName}<span className="block text-xs font-normal text-muted-foreground">{r.code}</span></td>
                {data.rows.some((x) => x.credits > 0) && <td className="border-b border-border px-3 py-2.5 text-end tabular-nums">{r.credits}</td>}
                {r.cells.map((c) => <td key={c.assessmentId} className="border-b border-border px-3 py-2.5 text-end tabular-nums">{c.mark === undefined ? '—' : c.mark === null ? 'AB' : c.mark}</td>)}
                <td className="border-b border-border px-3 py-2.5 text-end tabular-nums">{r.percent ?? '—'}</td>
                <td className="border-b border-border px-4 py-2.5 text-center">{r.grade ? <Badge variant={r.pass ? 'default' : 'danger'}>{r.grade}{r.points !== null ? ` · ${r.points}` : ''}</Badge> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold">Class teacher’s remark</p>
          <p className="mt-1 text-sm text-muted-foreground">{data.remark ?? '—'}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Draft generated from results — teacher can edit. AI-personalised remarks arrive in Phase 3.</p>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>{pack?.gradingScheme}</p>
          <p className="mt-1">AB = absent; excluded from the term result until a re-test is recorded.</p>
          <p className="mt-1">Pass mark {data.passMark}% · term result = weighted average of assessments ({data.assessments.map((a) => `${a.name} ${a.weight}%`).join(', ')}).</p>
          {data.rank && <p className="mt-1">Position in section: {data.rank} of {data.classSize}</p>}
        </div>
      </div>
    </Card>
  )
}
