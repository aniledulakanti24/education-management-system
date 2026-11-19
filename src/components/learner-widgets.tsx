import { useTranslation } from 'react-i18next'
import { Clock, MapPin } from 'lucide-react'
import type { AttendanceStatus, Period } from '@/types'
import type { SlotRow } from '@/lib/apiTypes'
import { useFormat, useSession } from '@/lib/session'
import { cn } from '@/lib/utils'
import { EmptyState } from './ui'

export const STATUS_STYLE: Record<AttendanceStatus, string> = {
  P: 'bg-success text-white',
  A: 'bg-danger text-white',
  L: 'bg-warning text-white',
  E: 'bg-info text-white',
}
export const STATUS_KEY: Record<AttendanceStatus, string> = { P: 'common.present', A: 'common.absent', L: 'common.late', E: 'common.excused' }

export function AttendanceRing({ pct, size = 120 }: { pct: number | null; size?: number }) {
  const f = useFormat()
  const r = 42
  const c = 2 * Math.PI * r
  const v = pct ?? 0
  const color = v >= 85 ? 'var(--success)' : v >= 75 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums">{f.pct(pct)}</span>
    </div>
  )
}

export function AttendanceStrip({ recent }: { recent: { date: string; status: AttendanceStatus }[] }) {
  const { t } = useTranslation()
  const f = useFormat()
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {recent.map((r) => (
          <span
            key={r.date}
            title={`${f.date(r.date)} — ${t(STATUS_KEY[r.status])}`}
            className={cn('flex size-7 items-center justify-center rounded-md text-[10px] font-semibold', STATUS_STYLE[r.status])}
          >
            {new Date(r.date + 'T12:00:00').getDate()}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(['P', 'A', 'L', 'E'] as AttendanceStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={cn('size-2.5 rounded-sm', STATUS_STYLE[s])} />{t(STATUS_KEY[s])}</span>
        ))}
      </div>
    </div>
  )
}

export function TodayClasses({ classes, show = 'course' }: { classes: SlotRow[]; show?: 'course' | 'section' }) {
  const { t } = useTranslation()
  const { me } = useSession()
  const periods: Period[] = me?.periods ?? []
  if (!classes.length) return <EmptyState icon={<Clock />} title={t('dash.noClasses')} />
  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return (
    <ol className="space-y-2">
      {classes.map((c) => {
        const p = periods.find((x) => x.no === c.period)
        const live = p && p.start <= hhmm && hhmm < p.end
        return (
          <li key={c.id} className={cn('flex items-center gap-3 rounded-lg border border-border p-3', live && 'border-brand bg-brand-soft')}>
            <div className="w-14 shrink-0 text-center">
              <p className="text-xs text-muted-foreground">P{c.period}</p>
              <p className="text-sm font-medium tabular-nums">{p?.start ?? ''}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.courseName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {show === 'section' ? c.sectionName : c.staffName} · <MapPin className="inline size-3" /> {c.room}
              </p>
            </div>
            {live && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">Now</span>}
          </li>
        )
      })}
    </ol>
  )
}
