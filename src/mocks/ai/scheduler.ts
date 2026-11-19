// AI timetable solver: constraint-based scheduling with randomised restarts.
// Hard constraints: no teacher double-booking across sections; each period taught by a free, qualified teacher.
// Soft constraints (scored): subjects spread across the week, max 2 periods of a subject per day,
// no back-to-back repeats except labs (which prefer double periods), keep the usual teacher where possible.
import type { Db } from '../seed'
import type { Course, TimetableSlot } from '@/types'

export interface ScheduleProposal {
  sectionId: string
  slots: Omit<TimetableSlot, 'id' | 'tenantId'>[]
  demand: { courseId: string; courseName: string; periods: number; placed: number; teacherId: string | null; teacherName: string }[]
  unfilled: number
  metrics: { score: number; clashes: number; maxSameDay: number; backToBack: number; labDoubles: number; substitutes: number; attempts: number }
  notes: string[]
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function solveTimetable(db: Db, sectionId: string, seed = Date.now()): ScheduleProposal {
  const section = db.sections.find((s) => s.id === sectionId)!
  const tenant = db.tenants.find((t) => t.id === section.tenantId)!
  const periods = db.periods[tenant.id] ?? []
  const days = tenant.weekDays
  const total = days.length * periods.length
  const courses = db.courses.filter((c) => c.programId === section.programId && (section.semester === undefined || c.semester === section.semester))

  // Demand: credit-based programmes use credits; otherwise weight core subjects higher.
  const weight = (c: Course) => (c.credits > 0 ? c.credits : c.type === 'CORE' ? (/math|english|science/i.test(c.name) ? 3 : 2) : 1)
  const wsum = courses.reduce((s, c) => s + weight(c), 0)
  const demand = courses.map((c) => ({ c, n: Math.max(1, Math.floor((weight(c) / wsum) * total)) }))
  let left = total - demand.reduce((s, d) => s + d.n, 0)
  for (const d of [...demand].sort((a, b) => weight(b.c) - weight(a.c))) {
    if (left <= 0) break
    d.n++
    left--
  }

  // Teacher options per course: the usual teacher first, then qualified colleagues by lightest load.
  const load = new Map<string, number>()
  db.slots.filter((s) => s.tenantId === tenant.id && s.sectionId !== sectionId).forEach((s) => load.set(s.staffId, (load.get(s.staffId) ?? 0) + 1))
  const teachingStaff = db.staff.filter((s) => s.tenantId === tenant.id && s.department !== 'Administration')
  const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3)
  const options = new Map<string, string[]>()
  const primary = new Map<string, string | null>()
  for (const c of courses) {
    const current = db.slots.find((s) => s.sectionId === sectionId && s.courseId === c.id)?.staffId
    const qualified = teachingStaff
      .filter((s) => s.courseIds.includes(c.id) || s.courseIds.some((id) => {
        const other = db.courses.find((x) => x.id === id)
        return !!other && words(other.name).some((w) => words(c.name).includes(w))
      }) || words(s.department).some((w) => words(c.name).includes(w)))
      .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0))
      .map((s) => s.id)
    const list = [...new Set([...(current ? [current] : []), ...qualified])]
    options.set(c.id, list)
    primary.set(c.id, list[0] ?? null)
  }
  const busy = new Set(db.slots.filter((s) => s.tenantId === tenant.id && s.sectionId !== sectionId).map((s) => `${s.staffId}|${s.day}|${s.period}`))
  const freeTeacher = (cid: string, di: number, pi: number) => (options.get(cid) ?? []).find((t) => !busy.has(`${t}|${days[di]}|${periods[pi].no}`))

  let best: ScheduleProposal | null = null
  const attempts = 40
  for (let k = 0; k < attempts; k++) {
    const rand = mulberry32(seed + k * 7919)
    const remaining = new Map(demand.map((d) => [d.c.id, d.n]))
    const grid: (string | null)[][] = days.map(() => periods.map(() => null))
    const who: (string | null)[][] = days.map(() => periods.map(() => null))
    const place = (di: number, pi: number, relaxDemand: boolean) => {
      const candidates = courses.filter((c) => {
        if (!relaxDemand && (remaining.get(c.id) ?? 0) <= 0) return false
        if (!freeTeacher(c.id, di, pi)) return false
        return grid[di].filter((x) => x === c.id).length < 2
      })
      if (!candidates.length) return
      const scored = candidates.map((c) => {
        const neighbour = grid[di][pi - 1] === c.id || grid[di][pi + 1] === c.id
        const usual = freeTeacher(c.id, di, pi) === primary.get(c.id)
        return { c, s: (remaining.get(c.id) ?? 0) * 2 + (usual ? 1.5 : 0) + (neighbour ? (c.type === 'LAB' ? 3 : -4) : 0) + rand() }
      }).sort((a, b) => b.s - a.s)
      const pickC = scored[0].c
      grid[di][pi] = pickC.id
      who[di][pi] = freeTeacher(pickC.id, di, pi)!
      remaining.set(pickC.id, (remaining.get(pickC.id) ?? 0) - 1)
      // labs: try to take the adjacent period too, with the same teacher
      if (pickC.type === 'LAB' && (remaining.get(pickC.id) ?? 0) > 0) {
        const t = who[di][pi]!
        for (const adj of [pi + 1, pi - 1]) {
          if (adj >= 0 && adj < periods.length && !grid[di][adj] && !busy.has(`${t}|${days[di]}|${periods[adj].no}`)) {
            grid[di][adj] = pickC.id
            who[di][adj] = t
            remaining.set(pickC.id, (remaining.get(pickC.id) ?? 0) - 1)
            break
          }
        }
      }
    }
    const order = days.flatMap((_, di) => periods.map((_, pi) => [di, pi] as const)).sort(() => rand() - 0.5)
    for (const [di, pi] of order) if (!grid[di][pi]) place(di, pi, false)
    // second pass: fill gaps with any subject that still has a free teacher
    for (const [di, pi] of order) if (!grid[di][pi]) place(di, pi, true)

    let backToBack = 0
    let labDoubles = 0
    let maxSameDay = 0
    let unfilled = 0
    let substitutes = 0
    grid.forEach((row, di) => {
      const counts = new Map<string, number>()
      row.forEach((cid, pi) => {
        if (!cid) {
          unfilled++
          return
        }
        if (who[di][pi] !== primary.get(cid)) substitutes++
        counts.set(cid, (counts.get(cid) ?? 0) + 1)
        if (pi > 0 && row[pi - 1] === cid) {
          if (courses.find((c) => c.id === cid)?.type === 'LAB') labDoubles++
          else backToBack++
        }
      })
      maxSameDay = Math.max(maxSameDay, ...counts.values(), 0)
    })
    const spread = courses.reduce((s, c) => s + grid.filter((row) => row.includes(c.id)).length, 0)
    const score = Math.round(100 - unfilled * 8 - backToBack * 3 - substitutes * 0.5 + labDoubles * 2 + spread * 0.3 - Math.max(0, maxSameDay - 2) * 5)
    if (!best || score > best.metrics.score) {
      const slots = grid.flatMap((row, di) => row.map((cid, pi) => (cid ? {
        sectionId, day: days[di], period: periods[pi].no, courseId: cid, staffId: who[di][pi]!,
        room: courses.find((c) => c.id === cid)?.type === 'LAB' ? 'Lab 1' : section.room,
      } : null)).filter((x): x is NonNullable<typeof x> => x !== null))
      best = {
        sectionId, slots, unfilled,
        demand: demand.map((d) => ({
          courseId: d.c.id, courseName: d.c.name, periods: d.n, placed: slots.filter((s) => s.courseId === d.c.id).length,
          teacherId: primary.get(d.c.id) ?? null, teacherName: db.staff.find((s) => s.id === primary.get(d.c.id))?.name ?? 'No qualified teacher',
        })),
        metrics: { score, clashes: 0, maxSameDay, backToBack, labDoubles, substitutes, attempts },
        notes: [],
      }
    }
  }
  const result = best!
  if (result.metrics.substitutes) result.notes.push(`${result.metrics.substitutes} period(s) use another qualified teacher because the usual teacher is busy in another section then.`)
  if (result.unfilled) result.notes.push(`${result.unfilled} period(s) left free because every qualified teacher is busy in another section then.`)
  const noTeacher = result.demand.filter((d) => !d.teacherId)
  if (noTeacher.length) result.notes.push(`No teacher is assigned to ${noTeacher.map((d) => d.courseName).join(', ')} — add one in Staff or the timetable.`)
  result.notes.push('Teacher clashes with other sections are checked against the live timetable, so applying this never double-books anyone.')
  return result
}
