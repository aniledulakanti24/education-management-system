import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, Landmark } from 'lucide-react'
import { api, qs } from '@/lib/api'
import type { CreditStatement } from '@/lib/apiTypes'
import { useFormat } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Progress, Skeleton } from './ui'

export function CreditStatementView({ learnerId }: { learnerId?: string }) {
  const f = useFormat()
  const { data, isLoading } = useQuery({ queryKey: ['credits', learnerId], queryFn: () => api.get<CreditStatement>(`/credits${qs({ learnerId })}`) })
  if (isLoading || !data) return <Skeleton className="h-64" />
  const abc = data.scheme === 'ABC'
  const terms = [...new Set(data.records.map((r) => r.term))]
  const next = data.milestones.find((m) => !m.reached)
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2"><Landmark className="size-5 text-brand" />{abc ? 'Academic Bank of Credits' : 'ECTS credit record'}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.learner.name}
            {abc && (data.learner.abcId ? <> · ABC ID <span className="font-mono">{data.learner.abcId}</span></> : ' · no ABC ID linked')}
            {data.learner.apaarId && <> · APAAR <span className="font-mono">{data.learner.apaarId}</span></>}
          </p>
        </div>
        <div className="text-end">
          <p className="text-2xl font-semibold tabular-nums">{f.number(data.total)}</p>
          <p className="text-xs text-muted-foreground">credits banked</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.milestones.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">{abc ? 'NEP 2020 multiple entry / exit' : 'Progress towards award'}</p>
            {next && <Progress value={(data.total / next.credits) * 100} className="mb-3" />}
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.milestones.map((m) => (
                <li key={m.credits} className={cn('flex items-center gap-2 rounded-lg border p-2 text-sm', m.reached ? 'border-success/40 bg-success/10' : 'border-border')}>
                  {m.reached ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="flex-1">{m.award}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{m.credits}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!data.records.length ? <EmptyState title="No credits banked yet" description="Credits are deposited after final results are published." /> : terms.map((term) => {
          const recs = data.records.filter((r) => r.term === term)
          return (
            <div key={term}>
              <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{term}</span><span className="tabular-nums text-muted-foreground">{recs.reduce((s, r) => s + r.credits, 0)} credits</span></div>
              <table className="w-full text-sm">
                <tbody>
                  {recs.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1.5 pe-2 font-mono text-xs text-muted-foreground">{r.courseCode}</td>
                      <td className="py-1.5">{r.courseName}</td>
                      <td className="py-1.5 text-end tabular-nums">{r.credits}</td>
                      <td className="w-12 py-1.5 text-end font-medium">{r.grade}</td>
                      <td className="hidden py-1.5 text-end sm:table-cell"><Badge variant="success">{r.status.toLowerCase()}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        <p className="text-xs text-muted-foreground">{abc ? 'Deposits use the ABC / NAD sandbox. In production they post to the Academic Bank of Credits API and are visible in the learner’s ABC and DigiLocker accounts.' : 'Credits follow the European Credit Transfer System and export to a Europass Diploma Supplement.'}</p>
      </CardContent>
    </Card>
  )
}
