// Mock REST API. The UI only talks to /api/* with fetch, so a real backend can replace this unchanged.
import { delay, http, HttpResponse, type PathParams } from 'msw'
import { getDb, persist, resetDb } from './db'
import { isoDate, isoWeekday, type Db } from './seed'
import type {
  AttendanceSheet, AttendanceStatus, Course, Learner, Program, ResearchProfile, Role, Section, Staff, Tenant, TimetableSlot, User,
} from '@/types'

// ---------- helpers ----------
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function auth(request: Request): { db: Db; user: User; tenant: Tenant | null } {
  const db = getDb()
  const userId = request.headers.get('x-user-id')
  const user = db.users.find((u) => u.id === userId)
  if (!user) throw new ApiError(401, 'Not signed in')
  const tenant = db.tenants.find((t) => t.id === user.tenantId) ?? null
  return { db, user, tenant }
}

export function requireRole(user: User, ...roles: Role[]) {
  if (!roles.includes(user.role)) throw new ApiError(403, 'You do not have permission for this action')
}

export function handle<P = Record<string, string>>(fn: (args: { request: Request; params: P; url: URL }) => unknown | Promise<unknown>) {
  return async ({ request, params }: { request: Request; params: PathParams }) => {
    await delay(120 + Math.random() * 180)
    try {
      const body = await fn({ request, params: params as unknown as P, url: new URL(request.url) })
      return HttpResponse.json(body as never)
    } catch (e) {
      if (e instanceof ApiError) return HttpResponse.json({ message: e.message }, { status: e.status })
      console.error(e)
      return HttpResponse.json({ message: 'Unexpected server error' }, { status: 500 })
    }
  }
}

export function audit(db: Db, user: User, action: string, entity: string) {
  db.audit.unshift({ id: crypto.randomUUID(), tenantId: user.tenantId, actor: user.name, action, entity, at: new Date().toISOString() })
  if (db.audit.length > 500) db.audit.length = 500
}

export const byTenant = <T extends { tenantId: string }>(list: T[], tenantId: string) => list.filter((x) => x.tenantId === tenantId)

export function attendanceStats(db: Db, tenantId: string) {
  const stats = new Map<string, { present: number; total: number; absent: number; late: number }>()
  for (const sheet of db.attendance) {
    if (sheet.tenantId !== tenantId) continue
    for (const [lid, st] of Object.entries(sheet.marks)) {
      const s = stats.get(lid) ?? { present: 0, total: 0, absent: 0, late: 0 }
      s.total++
      if (st === 'P' || st === 'L' || st === 'E') s.present++
      if (st === 'A') s.absent++
      if (st === 'L') s.late++
      stats.set(lid, s)
    }
  }
  return stats
}
export const pct = (s?: { present: number; total: number }) => (s && s.total ? Math.round((s.present / s.total) * 1000) / 10 : null)

function enrichLearner(db: Db, l: Learner, stats?: ReturnType<typeof attendanceStats>) {
  const program = db.programs.find((p) => p.id === l.programId)
  const section = db.sections.find((s) => s.id === l.sectionId)
  return { ...l, programName: program?.name ?? '—', sectionName: section?.name ?? '—', attendancePct: stats ? pct(stats.get(l.id)) : null }
}

export function ageOf(dob: string) {
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age
}

function enrichSlots(db: Db, slots: TimetableSlot[]) {
  return slots.map((s) => ({
    ...s,
    courseName: db.courses.find((c) => c.id === s.courseId)?.name ?? '—',
    courseCode: db.courses.find((c) => c.id === s.courseId)?.code ?? '',
    staffName: db.staff.find((t) => t.id === s.staffId)?.name ?? '—',
    sectionName: db.sections.find((x) => x.id === s.sectionId)?.name ?? '—',
  }))
}

export function visibleLearnerIds(db: Db, user: User): Set<string> | null {
  if (user.role === 'INST_ADMIN') return null // all in tenant
  if (user.role === 'STUDENT') return new Set(user.personId ? [user.personId] : [])
  if (user.role === 'GUARDIAN') return new Set(user.learnerIds ?? [])
  if (user.role === 'FACULTY') {
    const sections = new Set(db.slots.filter((s) => s.staffId === user.personId).map((s) => s.sectionId))
    db.sections.filter((s) => s.classTeacherId === user.personId).forEach((s) => sections.add(s.id))
    const ids = new Set(db.learners.filter((l) => sections.has(l.sectionId)).map((l) => l.id))
    db.research.filter((r) => r.supervisorId === user.personId || r.coSupervisorId === user.personId).forEach((r) => ids.add(r.learnerId))
    return ids
  }
  return new Set()
}

export function canSeeLearner(db: Db, user: User, learner: Learner) {
  if (learner.tenantId !== user.tenantId) return false
  const vis = visibleLearnerIds(db, user)
  return vis === null || vis.has(learner.id)
}

function tenantCounts(db: Db, tenantId: string) {
  return {
    learners: byTenant(db.learners, tenantId).filter((l) => l.status === 'ACTIVE').length,
    staff: byTenant(db.staff, tenantId).length,
    programs: byTenant(db.programs, tenantId).length,
    sections: byTenant(db.sections, tenantId).length,
  }
}

function workingDaysBack(tenant: Tenant, n: number) {
  const out: string[] = []
  const d = new Date()
  while (out.length < n) {
    if (tenant.weekDays.includes(isoWeekday(d))) out.unshift(isoDate(d))
    d.setDate(d.getDate() - 1)
  }
  return out
}

function todayClasses(db: Db, filter: (s: TimetableSlot) => boolean) {
  const day = isoWeekday(new Date())
  return enrichSlots(db, db.slots.filter((s) => s.day === day && filter(s))).sort((a, b) => a.period - b.period)
}

// ---------- dashboards ----------
function adminDashboard(db: Db, tenant: Tenant) {
  const learners = byTenant(db.learners, tenant.id).filter((l) => l.status === 'ACTIVE')
  const stats = attendanceStats(db, tenant.id)
  const days = workingDaysBack(tenant, 14)
  const trend = days.map((date) => {
    let present = 0
    let total = 0
    db.attendance.filter((s) => s.tenantId === tenant.id && s.date === date).forEach((s) => {
      Object.values(s.marks).forEach((m) => {
        total++
        if (m !== 'A') present++
      })
    })
    return { date, pct: total ? Math.round((present / total) * 1000) / 10 : null }
  })
  const byLevel = new Map<string, number>()
  learners.forEach((l) => byLevel.set(l.level, (byLevel.get(l.level) ?? 0) + 1))
  const gender = { F: 0, M: 0, X: 0 }
  learners.forEach((l) => gender[l.gender]++)
  const today = isoDate(new Date())
  const sections = byTenant(db.sections, tenant.id).filter((s) => learners.some((l) => l.sectionId === s.id && l.level !== 'PHD'))
  const markedToday = sections.filter((s) => db.attendance.some((a) => a.id === `${s.id}|${today}`)).length
  const atRisk = learners
    .map((l) => ({ l, p: pct(stats.get(l.id)) }))
    .filter((x) => x.p !== null && x.p < 75)
    .sort((a, b) => (a.p ?? 0) - (b.p ?? 0))
    .slice(0, 8)
    .map(({ l, p }) => {
      const s = stats.get(l.id)!
      const factors = [`Attendance ${p}%`]
      if (s.absent >= 5) factors.push(`${s.absent} absences`)
      if (s.late >= 2) factors.push(`${s.late} late arrivals`)
      return { ...enrichLearner(db, l), attendancePct: p, riskScore: Math.round(100 - (p ?? 0)), factors }
    })
  return {
    kind: 'admin' as const,
    counts: tenantCounts(db, tenant.id),
    trend,
    byLevel: [...byLevel.entries()].map(([level, count]) => ({ level, count })),
    gender,
    markedToday,
    sectionsTotal: sections.length,
    avgAttendance: pct({ present: [...stats.values()].reduce((a, s) => a + s.present, 0), total: [...stats.values()].reduce((a, s) => a + s.total, 0) }),
    atRisk,
    scholars: byTenant(db.research, tenant.id).length,
    recentAudit: byTenant(db.audit, tenant.id).slice(0, 6),
  }
}

function facultyDashboard(db: Db, user: User, tenant: Tenant) {
  const staffId = user.personId!
  const classes = todayClasses(db, (s) => s.staffId === staffId)
  const sectionIds = new Set(db.slots.filter((s) => s.staffId === staffId).map((s) => s.sectionId))
  const classTeacherOf = byTenant(db.sections, tenant.id).filter((s) => s.classTeacherId === staffId)
  const today = isoDate(new Date())
  const stats = attendanceStats(db, tenant.id)
  const myLearners = db.learners.filter((l) => sectionIds.has(l.sectionId))
  const lowAttendance = myLearners
    .map((l) => ({ ...enrichLearner(db, l), attendancePct: pct(stats.get(l.id)) }))
    .filter((l) => l.attendancePct !== null && l.attendancePct < 75)
    .sort((a, b) => (a.attendancePct ?? 0) - (b.attendancePct ?? 0))
    .slice(0, 6)
  const scholars = db.research
    .filter((r) => r.supervisorId === staffId || r.coSupervisorId === staffId)
    .map((r) => ({ ...r, learner: db.learners.find((l) => l.id === r.learnerId) }))
  return {
    kind: 'faculty' as const,
    classes,
    weeklyLoad: db.slots.filter((s) => s.staffId === staffId).length,
    sectionsTaught: sectionIds.size,
    learnersTaught: myLearners.length,
    classTeacherOf: classTeacherOf.map((s) => ({ ...s, markedToday: db.attendance.some((a) => a.id === `${s.id}|${today}`) })),
    lowAttendance,
    scholars,
  }
}

function learnerSummary(db: Db, learner: Learner) {
  const sheets = db.attendance.filter((a) => a.sectionId === learner.sectionId && a.marks[learner.id]).sort((a, b) => a.date.localeCompare(b.date))
  const counts = { P: 0, A: 0, L: 0, E: 0 } as Record<AttendanceStatus, number>
  sheets.forEach((s) => counts[s.marks[learner.id]]++)
  const total = sheets.length
  return {
    learner: enrichLearner(db, learner),
    age: ageOf(learner.dob),
    attendance: {
      pct: total ? Math.round(((counts.P + counts.L + counts.E) / total) * 1000) / 10 : null,
      counts,
      total,
      recent: sheets.slice(-30).map((s) => ({ date: s.date, status: s.marks[learner.id] })),
    },
    today: todayClasses(db, (s) => s.sectionId === learner.sectionId),
    research: db.research.find((r) => r.learnerId === learner.id) ?? null,
  }
}

function superDashboard(db: Db) {
  const tenants = db.tenants.map((t) => ({ ...t, ...tenantCounts(db, t.id) }))
  const group = (key: (t: Tenant) => string) => {
    const m = new Map<string, number>()
    db.tenants.forEach((t) => m.set(key(t), (m.get(key(t)) ?? 0) + 1))
    return [...m.entries()].map(([name, count]) => ({ name, count }))
  }
  return {
    kind: 'super' as const,
    tenants,
    totals: {
      tenants: db.tenants.length,
      learners: db.learners.length,
      staff: db.staff.length,
      countries: new Set(db.tenants.map((t) => t.country)).size,
    },
    byRegion: group((t) => t.region),
    byFramework: group((t) => t.framework),
    byPlan: group((t) => t.plan),
  }
}

// ---------- handlers ----------
export const handlers = [
  http.get('/api/demo-users', handle(() => {
    const db = getDb()
    return { tenants: db.tenants, users: db.users }
  })),

  http.post('/api/reset', handle(() => {
    resetDb()
    return { ok: true }
  })),

  http.get('/api/me', handle(({ request }) => {
    const { db, user, tenant } = auth(request)
    return { user, tenant, periods: tenant ? db.periods[tenant.id] ?? [] : [] }
  })),

  // Tenants
  http.get('/api/tenants', handle(({ request }) => {
    const { db, user } = auth(request)
    const list = user.role === 'SUPER_ADMIN' ? db.tenants : db.tenants.filter((t) => t.id === user.tenantId)
    return list.map((t) => ({ ...t, ...tenantCounts(db, t.id) }))
  })),

  http.post('/api/tenants', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'SUPER_ADMIN')
    const body = (await request.json()) as Partial<Tenant> & { adminName?: string; adminEmail?: string }
    if (!body.name || !body.subdomain) throw new ApiError(400, 'Name and subdomain are required')
    const subdomain = body.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (db.tenants.some((t) => t.subdomain === subdomain)) throw new ApiError(409, 'Subdomain already taken')
    const id = subdomain.slice(0, 12) + '-' + Math.random().toString(36).slice(2, 6)
    const tenant: Tenant = {
      id, name: body.name, shortName: body.shortName || body.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase(),
      type: body.type ?? 'SCHOOL', levels: body.levels ?? [], framework: body.framework ?? 'CBSE', country: body.country ?? 'IN',
      city: body.city ?? '', region: body.region ?? 'IN', currency: body.currency ?? 'INR', defaultLanguage: body.defaultLanguage ?? 'en',
      timezone: body.timezone ?? 'UTC', weekDays: body.weekDays ?? [1, 2, 3, 4, 5], brandColor: body.brandColor ?? '#0d9488',
      subdomain, plan: body.plan ?? 'STARTER', status: 'TRIAL', createdAt: isoDate(new Date()),
    }
    db.tenants.push(tenant)
    db.periods[id] = db.periods.gps
    db.users.push({ id: `u-${id}-admin`, tenantId: id, name: body.adminName || 'Institution Admin', email: body.adminEmail || `admin@${subdomain}.edu`, role: 'INST_ADMIN', title: 'Administrator' })
    audit(db, user, `Created tenant ${tenant.name}`, 'Tenant')
    persist()
    return tenant
  })),

  http.patch('/api/tenants/:id', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    const t = db.tenants.find((x) => x.id === params.id)
    if (!t) throw new ApiError(404, 'Tenant not found')
    if (!(user.role === 'SUPER_ADMIN' || (user.role === 'INST_ADMIN' && user.tenantId === t.id))) throw new ApiError(403, 'Not allowed')
    const body = (await request.json()) as Partial<Tenant>
    const allowed: (keyof Tenant)[] = user.role === 'SUPER_ADMIN'
      ? ['name', 'shortName', 'brandColor', 'defaultLanguage', 'weekDays', 'framework', 'levels', 'plan', 'status', 'city', 'currency', 'timezone']
      : ['name', 'shortName', 'brandColor', 'defaultLanguage', 'weekDays', 'city', 'timezone']
    for (const k of allowed) if (k in body) (t as unknown as Record<string, unknown>)[k] = body[k]
    audit(db, user, `Updated settings for ${t.name}`, 'Tenant')
    persist()
    return t
  })),

  // Dashboard
  http.get('/api/dashboard', handle(({ request }) => {
    const { db, user, tenant } = auth(request)
    if (user.role === 'SUPER_ADMIN') return superDashboard(db)
    if (!tenant) throw new ApiError(404, 'Tenant not found')
    if (user.role === 'INST_ADMIN') return adminDashboard(db, tenant)
    if (user.role === 'FACULTY') return facultyDashboard(db, user, tenant)
    if (user.role === 'STUDENT') {
      const l = db.learners.find((x) => x.id === user.personId)
      if (!l) throw new ApiError(404, 'Learner not found')
      return { kind: 'student' as const, ...learnerSummary(db, l) }
    }
    const children = (user.learnerIds ?? []).map((id) => db.learners.find((l) => l.id === id)).filter(Boolean) as Learner[]
    return { kind: 'guardian' as const, children: children.map((c) => learnerSummary(db, c)) }
  })),

  // Learners
  http.get('/api/learners', handle(({ request, url }) => {
    const { db, user } = auth(request)
    const q = (url.searchParams.get('q') ?? '').toLowerCase().trim()
    const programId = url.searchParams.get('programId')
    const sectionId = url.searchParams.get('sectionId')
    const level = url.searchParams.get('level')
    const status = url.searchParams.get('status')
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25)
    const vis = visibleLearnerIds(db, user)
    let list = byTenant(db.learners, user.tenantId).filter((l) => vis === null || vis.has(l.id))
    if (programId) list = list.filter((l) => l.programId === programId)
    if (sectionId) list = list.filter((l) => l.sectionId === sectionId)
    if (level) list = list.filter((l) => l.level === level)
    if (status) list = list.filter((l) => l.status === status)
    if (q) list = list.filter((l) => `${l.firstName} ${l.lastName} ${l.admissionNo} ${l.apaarId ?? ''} ${l.email ?? ''}`.toLowerCase().includes(q))
    const stats = attendanceStats(db, user.tenantId)
    const total = list.length
    const items = list.slice((page - 1) * pageSize, page * pageSize).map((l) => enrichLearner(db, l, stats))
    return { items, total, page, pageSize }
  })),

  http.get('/api/learners/:id', handle<{ id: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    const l = db.learners.find((x) => x.id === params.id)
    if (!l || !canSeeLearner(db, user, l)) throw new ApiError(404, 'Learner not found')
    return learnerSummary(db, l)
  })),

  http.post('/api/learners', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const body = (await request.json()) as Partial<Learner>
    if (!body.firstName || !body.sectionId || !body.dob) throw new ApiError(400, 'First name, date of birth and section are required')
    const section = db.sections.find((s) => s.id === body.sectionId && s.tenantId === user.tenantId)
    if (!section) throw new ApiError(400, 'Unknown section')
    const program = db.programs.find((p) => p.id === section.programId)!
    const n = byTenant(db.learners, user.tenantId).length + 1
    const l: Learner = {
      id: `${user.tenantId}-l-${Date.now().toString(36)}`,
      tenantId: user.tenantId,
      admissionNo: body.admissionNo || `${tenant!.shortName}/${new Date().getFullYear()}/${String(n).padStart(4, '0')}`,
      firstName: body.firstName, lastName: body.lastName ?? '', gender: body.gender ?? 'X', dob: body.dob,
      level: program.level, programId: program.id, sectionId: section.id,
      rollNo: db.learners.filter((x) => x.sectionId === section.id).length + 1,
      apaarId: body.apaarId, abcId: body.abcId, nationalId: body.nationalId, email: body.email, phone: body.phone,
      bloodGroup: body.bloodGroup, address: body.address ?? '', nationality: body.nationality ?? tenant!.country,
      guardians: body.guardians ?? [], status: 'ACTIVE', enrolledOn: isoDate(new Date()),
    }
    db.learners.push(l)
    audit(db, user, `Enrolled ${l.firstName} ${l.lastName} in ${section.name}`, 'Learner')
    persist()
    return l
  })),

  http.patch('/api/learners/:id', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const l = db.learners.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!l) throw new ApiError(404, 'Learner not found')
    const body = (await request.json()) as Partial<Learner>
    const { id: _id, tenantId: _t, ...rest } = body
    void _id
    void _t
    Object.assign(l, rest)
    if (body.sectionId) {
      const s = db.sections.find((x) => x.id === body.sectionId)
      const p = s && db.programs.find((x) => x.id === s.programId)
      if (p) {
        l.programId = p.id
        l.level = p.level
      }
    }
    audit(db, user, `Updated learner ${l.firstName} ${l.lastName}`, 'Learner')
    persist()
    return l
  })),

  http.delete('/api/learners/:id', handle<{ id: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const l = db.learners.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!l) throw new ApiError(404, 'Learner not found')
    l.status = 'WITHDRAWN'
    audit(db, user, `Withdrew learner ${l.firstName} ${l.lastName}`, 'Learner')
    persist()
    return { ok: true }
  })),

  // Staff
  http.get('/api/staff', handle(({ request, url }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    return byTenant(db.staff, user.tenantId)
      .filter((s) => !q || `${s.name} ${s.department} ${s.designation}`.toLowerCase().includes(q))
      .map((s) => ({
        ...s,
        weeklyLoad: db.slots.filter((x) => x.staffId === s.id).length,
        courseNames: s.courseIds.map((id) => db.courses.find((c) => c.id === id)?.name).filter(Boolean),
        scholars: db.research.filter((r) => r.supervisorId === s.id).length,
      }))
  })),

  http.post('/api/staff', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const body = (await request.json()) as Partial<Staff>
    if (!body.name || !body.designation) throw new ApiError(400, 'Name and designation are required')
    const n = byTenant(db.staff, user.tenantId).length + 1
    const s: Staff = {
      id: `${user.tenantId}-st-${Date.now().toString(36)}`, tenantId: user.tenantId,
      employeeNo: `${tenant!.shortName}-EMP-${String(n).padStart(3, '0')}`, name: body.name, email: body.email ?? '',
      phone: body.phone ?? '', designation: body.designation, department: body.department ?? '', qualification: body.qualification ?? '',
      courseIds: [], isSupervisor: !!body.isSupervisor, joinedOn: isoDate(new Date()),
    }
    db.staff.push(s)
    audit(db, user, `Added staff ${s.name}`, 'Staff')
    persist()
    return s
  })),

  // Academic structure
  http.get('/api/academics', handle(({ request }) => {
    const { db, user } = auth(request)
    const counts = new Map<string, number>()
    byTenant(db.learners, user.tenantId).filter((l) => l.status === 'ACTIVE').forEach((l) => counts.set(l.sectionId, (counts.get(l.sectionId) ?? 0) + 1))
    return {
      programs: byTenant(db.programs, user.tenantId),
      courses: byTenant(db.courses, user.tenantId),
      sections: byTenant(db.sections, user.tenantId).map((s) => ({
        ...s, learnerCount: counts.get(s.id) ?? 0, classTeacherName: db.staff.find((t) => t.id === s.classTeacherId)?.name,
      })),
      terms: byTenant(db.terms, user.tenantId),
      periods: db.periods[user.tenantId] ?? [],
    }
  })),

  http.post('/api/programs', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const body = (await request.json()) as Partial<Program>
    if (!body.name || !body.code || !body.level) throw new ApiError(400, 'Name, code and level are required')
    const p: Program = {
      id: `${user.tenantId}-p-${body.code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36).slice(-3)}`, tenantId: user.tenantId,
      level: body.level, name: body.name, code: body.code.toUpperCase(), durationTerms: body.durationTerms ?? 1,
      creditSystem: body.creditSystem ?? 'NONE', department: body.department ?? '',
    }
    db.programs.push(p)
    audit(db, user, `Created programme ${p.name}`, 'Program')
    persist()
    return p
  })),

  http.post('/api/courses', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const body = (await request.json()) as Partial<Course>
    if (!body.name || !body.programId) throw new ApiError(400, 'Name and programme are required')
    const c: Course = {
      id: `${user.tenantId}-c-${Date.now().toString(36)}`, tenantId: user.tenantId, programId: body.programId,
      code: body.code ?? body.name.slice(0, 3).toUpperCase(), name: body.name, credits: Number(body.credits ?? 0),
      type: body.type ?? 'CORE', semester: body.semester ? Number(body.semester) : undefined, outcomes: body.outcomes ?? [],
    }
    db.courses.push(c)
    audit(db, user, `Created course ${c.name}`, 'Course')
    persist()
    return c
  })),

  http.post('/api/sections', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const body = (await request.json()) as Partial<Section>
    if (!body.name || !body.programId) throw new ApiError(400, 'Name and programme are required')
    const s: Section = {
      id: `${body.programId}-s-${body.name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36).slice(-3)}`,
      tenantId: user.tenantId, programId: body.programId, name: body.name, termLabel: body.termLabel ?? '',
      semester: body.semester ? Number(body.semester) : undefined, room: body.room ?? '', classTeacherId: body.classTeacherId, capacity: Number(body.capacity ?? 40),
    }
    db.sections.push(s)
    audit(db, user, `Created section ${s.name}`, 'Section')
    persist()
    return s
  })),

  // Timetable
  http.get('/api/timetable', handle(({ request, url }) => {
    const { db, user, tenant } = auth(request)
    const sectionId = url.searchParams.get('sectionId')
    const staffId = url.searchParams.get('staffId')
    let slots: TimetableSlot[] = []
    if (sectionId) slots = db.slots.filter((s) => s.sectionId === sectionId && s.tenantId === user.tenantId)
    else if (staffId) slots = db.slots.filter((s) => s.staffId === staffId && s.tenantId === user.tenantId)
    return { slots: enrichSlots(db, slots), periods: db.periods[user.tenantId] ?? [], weekDays: tenant?.weekDays ?? [1, 2, 3, 4, 5] }
  })),

  http.put('/api/timetable/slots', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const body = (await request.json()) as Omit<TimetableSlot, 'id' | 'tenantId'>
    const clash = db.slots.find((s) => s.staffId === body.staffId && s.day === body.day && s.period === body.period && s.sectionId !== body.sectionId)
    if (clash) {
      const sec = db.sections.find((x) => x.id === clash.sectionId)
      throw new ApiError(409, `Teacher clash: already teaching ${sec?.name ?? 'another section'} in this period`)
    }
    const id = `${body.sectionId}-${body.day}-${body.period}`
    const existing = db.slots.find((s) => s.id === id)
    if (existing) Object.assign(existing, body)
    else db.slots.push({ ...body, id, tenantId: user.tenantId })
    const staff = db.staff.find((s) => s.id === body.staffId)
    if (staff && !staff.courseIds.includes(body.courseId)) staff.courseIds.push(body.courseId)
    audit(db, user, `Updated timetable slot ${id}`, 'Timetable')
    persist()
    return { ok: true }
  })),

  http.delete('/api/timetable/slots/:id', handle<{ id: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    db.slots = db.slots.filter((s) => !(s.id === params.id && s.tenantId === user.tenantId))
    audit(db, user, `Cleared timetable slot ${params.id}`, 'Timetable')
    persist()
    return { ok: true }
  })),

  // Attendance
  http.get('/api/attendance/sheet', handle(({ request, url }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const sectionId = url.searchParams.get('sectionId') ?? ''
    const date = url.searchParams.get('date') ?? isoDate(new Date())
    const section = db.sections.find((s) => s.id === sectionId && s.tenantId === user.tenantId)
    if (!section) throw new ApiError(404, 'Section not found')
    const learners = db.learners.filter((l) => l.sectionId === sectionId && l.status === 'ACTIVE').sort((a, b) => a.rollNo - b.rollNo)
    const sheet = db.attendance.find((a) => a.id === `${sectionId}|${date}`) ?? null
    return { section, learners, sheet }
  })),

  http.put('/api/attendance/sheet', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const body = (await request.json()) as { sectionId: string; date: string; marks: Record<string, AttendanceStatus> }
    const section = db.sections.find((s) => s.id === body.sectionId && s.tenantId === user.tenantId)
    if (!section) throw new ApiError(404, 'Section not found')
    if (body.date > isoDate(new Date())) throw new ApiError(400, 'Cannot mark attendance for a future date')
    if (user.role === 'FACULTY') {
      const teaches = section.classTeacherId === user.personId || db.slots.some((s) => s.sectionId === section.id && s.staffId === user.personId)
      if (!teaches) throw new ApiError(403, 'You do not teach this section')
    }
    const id = `${body.sectionId}|${body.date}`
    const sheet: AttendanceSheet = { id, tenantId: user.tenantId, sectionId: body.sectionId, date: body.date, marks: body.marks, markedBy: user.personId ?? user.id, markedAt: new Date().toISOString() }
    db.attendance = db.attendance.filter((a) => a.id !== id)
    db.attendance.push(sheet)
    const absent = Object.values(body.marks).filter((m) => m === 'A').length
    audit(db, user, `Marked attendance for ${section.name} on ${body.date} (${absent} absent)`, 'Attendance')
    persist()
    return { ok: true, notifiedGuardians: absent }
  })),

  http.get('/api/attendance/overview', handle(({ request, url }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const date = url.searchParams.get('date') ?? isoDate(new Date())
    const vis = visibleLearnerIds(db, user)
    const sections = byTenant(db.sections, user.tenantId)
      .map((s) => {
        const learners = db.learners.filter((l) => l.sectionId === s.id && l.status === 'ACTIVE' && l.level !== 'PHD')
        return { s, learners }
      })
      .filter(({ learners }) => learners.length && (vis === null || learners.some((l) => vis.has(l.id))))
      .map(({ s, learners }) => {
        const sheet = db.attendance.find((a) => a.id === `${s.id}|${date}`)
        const marks = sheet ? Object.values(sheet.marks) : []
        return {
          sectionId: s.id, sectionName: s.name, programName: db.programs.find((p) => p.id === s.programId)?.name ?? '',
          strength: learners.length, marked: !!sheet,
          present: marks.filter((m) => m !== 'A').length, absent: marks.filter((m) => m === 'A').length,
          isClassTeacher: s.classTeacherId === user.personId,
        }
      })
    const isWorkingDay = !!tenant && tenant.weekDays.includes(isoWeekday(new Date(date + 'T12:00:00')))
    return { date, isWorkingDay, sections }
  })),

  // Research
  http.get('/api/research/scholars', handle(({ request }) => {
    const { db, user } = auth(request)
    let list: ResearchProfile[] = byTenant(db.research, user.tenantId)
    if (user.role === 'FACULTY') list = list.filter((r) => r.supervisorId === user.personId || r.coSupervisorId === user.personId)
    else if (user.role === 'STUDENT') list = list.filter((r) => r.learnerId === user.personId)
    else if (user.role !== 'INST_ADMIN') list = []
    return list.map((r) => {
      const l = db.learners.find((x) => x.id === r.learnerId)!
      return {
        ...r,
        scholarName: `${l.firstName} ${l.lastName}`,
        programName: db.programs.find((p) => p.id === l.programId)?.name ?? '',
        supervisorName: db.staff.find((s) => s.id === r.supervisorId)?.name ?? '—',
        coSupervisorName: db.staff.find((s) => s.id === r.coSupervisorId)?.name,
      }
    })
  })),

  http.patch('/api/research/:learnerId/milestones/:index', handle<{ learnerId: string; index: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const r = db.research.find((x) => x.learnerId === params.learnerId && x.tenantId === user.tenantId)
    if (!r) throw new ApiError(404, 'Research profile not found')
    if (user.role === 'FACULTY' && r.supervisorId !== user.personId && r.coSupervisorId !== user.personId) throw new ApiError(403, 'Only the supervisor can update milestones')
    const m = r.milestones[Number(params.index)]
    if (!m) throw new ApiError(404, 'Milestone not found')
    m.done = !m.done
    audit(db, user, `${m.done ? 'Completed' : 'Reopened'} milestone "${m.label}"`, 'Research')
    persist()
    return r
  })),

  // Audit
  http.get('/api/audit', handle(({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'SUPER_ADMIN')
    return user.role === 'SUPER_ADMIN' ? db.audit.slice(0, 100) : byTenant(db.audit, user.tenantId).slice(0, 100)
  })),
]
