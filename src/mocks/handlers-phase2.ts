// Phase 2 mock API: admissions, exams & results, fees, communication, library.
import { http } from 'msw'
import { getDb, persist } from './db'
import type { Db } from './seed'
import { examinableCourses } from './seed-phase2'
import { ApiError, attendanceStats, audit, auth, byTenant, canSeeLearner, handle, pct, requireRole, visibleLearnerIds } from './handlers'
import { gpaInfo, gradeFor, passMark } from '@/lib/frameworks'
import type {
  AdmissionStage, Announcement, Application, Assessment, FeeStructure, Invoice, Learner, Loan, PaymentMethod, Role, Tenant, User,
} from '@/types'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
const learnerName = (db: Db, id: string) => {
  const l = db.learners.find((x) => x.id === id)
  return l ? `${l.firstName} ${l.lastName}` : '—'
}
const sectionName = (db: Db, id: string) => db.sections.find((s) => s.id === id)?.name ?? '—'
const round1 = (n: number) => Math.round(n * 10) / 10

// ---------------- fees helpers ----------------
export function invoiceView(db: Db, inv: Invoice) {
  const gross = inv.items.reduce((a, x) => a + x.amount, 0)
  const net = Math.max(0, gross - inv.discount) + inv.lateFee
  const paid = inv.payments.reduce((a, p) => a + p.amount, 0)
  const balance = Math.max(0, net - paid)
  const status = balance <= 0 ? 'PAID' : inv.dueDate < today() ? 'OVERDUE' : paid > 0 ? 'PARTIAL' : 'DUE'
  const l = db.learners.find((x) => x.id === inv.learnerId)
  return { ...inv, gross, net, paid, balance, status: status as 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE', partiallyPaid: paid > 0 && balance > 0, learnerName: learnerName(db, inv.learnerId), admissionNo: l?.admissionNo ?? '', sectionName: l ? sectionName(db, l.sectionId) : '—' }
}

function createInvoice(db: Db, tenant: Tenant, st: FeeStructure, learner: Learner) {
  const n = byTenant(db.invoices, tenant.id).length + 1
  const inv: Invoice = {
    id: `${tenant.id}-inv-${Date.now().toString(36)}${n}`, tenantId: tenant.id, number: `${tenant.shortName}-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`,
    learnerId: learner.id, structureId: st.id, title: st.name, items: st.items, discount: 0, lateFee: 0, dueDate: st.dueDate, issuedOn: today(), payments: [],
  }
  db.invoices.push(inv)
  return inv
}

// ---------------- results helpers ----------------
function visibleAssessments(db: Db, user: User, tenantId: string) {
  const all = byTenant(db.assessments, tenantId)
  return user.role === 'STUDENT' || user.role === 'GUARDIAN' ? all.filter((a) => a.status === 'PUBLISHED') : all.filter((a) => a.status !== 'SCHEDULED')
}

export function reportCard(db: Db, user: User, tenant: Tenant, learner: Learner) {
  const assessments = visibleAssessments(db, user, tenant.id).filter((a) => a.programIds.includes(learner.programId))
  const courses = examinableCourses(db, learner.sectionId)
  const gp = gpaInfo(tenant.framework)
  const rows = courses.map((c) => {
    const cells = assessments.map((a) => {
      const sheet = db.marks.find((m) => m.id === `${a.id}|${learner.sectionId}|${c.id}`)
      const mark = sheet ? sheet.marks[learner.id] : undefined
      return { assessmentId: a.id, mark: mark === undefined ? undefined : mark, max: a.maxMarks }
    })
    let w = 0
    let acc = 0
    cells.forEach((cell, i) => {
      // absent (null) is excluded from the weighting until a re-test is recorded
      if (cell.mark === undefined || cell.mark === null) return
      w += assessments[i].weight
      acc += assessments[i].weight * (cell.mark / cell.max) * 100
    })
    const percent = w ? round1(acc / w) : null
    const g = percent === null ? null : gradeFor(percent, tenant.framework)
    return { courseId: c.id, courseName: c.name, code: c.code, credits: c.credits, cells, percent, grade: g?.grade ?? null, points: g?.points ?? null, pass: g?.pass ?? null }
  })
  const graded = rows.filter((r) => r.percent !== null)
  const overall = graded.length ? round1(graded.reduce((a, r) => a + r.percent!, 0) / graded.length) : null
  let gpa: number | null = null
  if (gp && graded.length) {
    const useCredits = graded.some((r) => r.credits > 0)
    const wsum = graded.reduce((a, r) => a + (useCredits ? r.credits : 1), 0)
    gpa = wsum ? Math.round((graded.reduce((a, r) => a + (r.points ?? 0) * (useCredits ? r.credits : 1), 0) / wsum) * 100) / 100 : null
  }
  // rank within section on overall %
  const peers = db.learners.filter((l) => l.sectionId === learner.sectionId && l.status === 'ACTIVE')
  const peerScores = peers.map((p) => {
    const vals = courses.map((c) => {
      let w = 0
      let acc = 0
      assessments.forEach((a) => {
        const m = db.marks.find((s) => s.id === `${a.id}|${p.sectionId}|${c.id}`)?.marks[p.id]
        if (m === undefined || m === null) return
        w += a.weight
        acc += a.weight * (m / a.maxMarks)
      })
      return w ? acc / w : null
    }).filter((v): v is number => v !== null)
    return { id: p.id, v: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : -1 }
  }).sort((a, b) => b.v - a.v)
  const rank = overall === null ? null : peerScores.findIndex((p) => p.id === learner.id) + 1
  const att = pct(attendanceStats(db, tenant.id).get(learner.id))
  const failed = rows.filter((r) => r.pass === false)
  const strongest = [...graded].sort((a, b) => b.percent! - a.percent!)[0]
  const remark = overall === null ? null
    : failed.length ? `Needs support in ${failed.map((f) => f.courseName).join(', ')}. A remedial plan has been suggested.`
    : overall >= 85 ? `Outstanding performance, especially in ${strongest?.courseName}. Keep it up!`
    : overall >= 70 ? `Consistent effort with good results. ${strongest?.courseName} is a clear strength.`
    : `Satisfactory progress. More regular revision will help lift scores across subjects.`
  return {
    learner: { id: learner.id, name: `${learner.firstName} ${learner.lastName}`, admissionNo: learner.admissionNo, rollNo: learner.rollNo, sectionName: sectionName(db, learner.sectionId), programName: db.programs.find((p) => p.id === learner.programId)?.name ?? '', apaarId: learner.apaarId, abcId: learner.abcId },
    term: db.terms.find((t) => t.tenantId === tenant.id && t.current)?.name ?? '',
    assessments: assessments.map((a) => ({ id: a.id, name: a.name, maxMarks: a.maxMarks, weight: a.weight, status: a.status })),
    rows, overall, gpa, gpaLabel: gp?.label ?? null, gpaScale: gp?.scale ?? null,
    overallGrade: overall === null ? null : gradeFor(overall, tenant.framework).grade,
    rank, classSize: peers.length, attendancePct: att, remark, passMark: passMark(tenant.framework),
  }
}

function sectionsTaughtBy(db: Db, staffId?: string) {
  const set = new Set<string>()
  if (!staffId) return set
  db.slots.filter((s) => s.staffId === staffId).forEach((s) => set.add(`${s.sectionId}|${s.courseId}`))
  return set
}

function pendingMarks(db: Db, user: User) {
  const taught = sectionsTaughtBy(db, user.personId)
  const out: { assessmentId: string; assessmentName: string; sectionId: string; sectionName: string; courseId: string; courseName: string }[] = []
  for (const a of byTenant(db.assessments, user.tenantId).filter((x) => x.status === 'MARKS_ENTRY')) {
    for (const key of taught) {
      const [sectionId, courseId] = key.split('|')
      const s = db.sections.find((x) => x.id === sectionId)
      if (!s || !a.programIds.includes(s.programId)) continue
      if (!examinableCourses(db, sectionId).some((c) => c.id === courseId)) continue
      if (db.marks.some((m) => m.id === `${a.id}|${sectionId}|${courseId}`)) continue
      out.push({ assessmentId: a.id, assessmentName: a.name, sectionId, sectionName: s.name, courseId, courseName: db.courses.find((c) => c.id === courseId)?.name ?? '' })
    }
  }
  return out
}

// ---------------- communication helpers ----------------
function learnerSectionsOf(db: Db, user: User): Set<string> {
  if (user.role === 'STUDENT') return new Set(db.learners.filter((l) => l.id === user.personId).map((l) => l.sectionId))
  if (user.role === 'GUARDIAN') return new Set(db.learners.filter((l) => user.learnerIds?.includes(l.id)).map((l) => l.sectionId))
  if (user.role === 'FACULTY') return new Set(db.slots.filter((s) => s.staffId === user.personId).map((s) => s.sectionId))
  return new Set()
}

function canSeeAnnouncement(db: Db, user: User, a: Announcement) {
  if (a.tenantId !== user.tenantId) return false
  if (user.role === 'INST_ADMIN' || a.authorId === user.id) return true
  if (!a.audienceRoles.includes(user.role)) return false
  if (!a.sectionIds.length) return true
  const mine = learnerSectionsOf(db, user)
  return a.sectionIds.some((s) => mine.has(s))
}

function allowedContacts(db: Db, user: User) {
  const others = db.users.filter((u) => u.tenantId === user.tenantId && u.id !== user.id)
  // Safeguarding: learners and guardians may only contact staff; no learner-to-learner DMs.
  if (user.role === 'STUDENT' || user.role === 'GUARDIAN') return others.filter((u) => u.role === 'FACULTY' || u.role === 'INST_ADMIN')
  return others
}

// ---------------- library helpers ----------------
const fineRate = (t: Tenant) => (t.country === 'IN' ? 2 : 1)
function loanView(db: Db, tenant: Tenant, l: Loan) {
  const book = db.books.find((b) => b.id === l.bookId)
  const end = l.returnedOn ?? today()
  const overdueDays = Math.max(0, daysBetween(l.dueOn, end))
  const borrower = l.borrowerType === 'LEARNER' ? db.learners.find((x) => x.id === l.borrowerId) : null
  return {
    ...l, bookTitle: book?.title ?? '—', bookAuthor: book?.author ?? '', borrowerName: borrower ? `${borrower.firstName} ${borrower.lastName}` : db.staff.find((s) => s.id === l.borrowerId)?.name ?? '—',
    borrowerSection: borrower ? sectionName(db, borrower.sectionId) : 'Staff', overdueDays, fine: l.finePaid ?? overdueDays * fineRate(tenant), active: !l.returnedOn,
  }
}

const STAGES: AdmissionStage[] = ['ENQUIRY', 'APPLIED', 'DOCS_VERIFIED', 'ASSESSMENT', 'OFFERED', 'ACCEPTED', 'ENROLLED', 'REJECTED']

export const phase2Handlers = [
  // ======== Admissions ========
  http.get('/api/admissions', handle(({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const list = byTenant(db.applications, user.tenantId).map((a) => ({ ...a, programName: db.programs.find((p) => p.id === a.programId)?.name ?? '' }))
    const funnel = STAGES.map((s) => ({ stage: s, count: list.filter((a) => a.stage === s).length }))
    return { items: list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), funnel }
  })),

  http.post('/api/admissions', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const b = (await request.json()) as Partial<Application>
    if (!b.applicantName || !b.programId || !b.phone) throw new ApiError(400, 'Applicant name, programme and phone are required')
    const app = newApplication(db, tenant!, b, 'ENQUIRY', b.source ?? 'Walk-in')
    audit(db, user, `New enquiry ${app.number} — ${app.applicantName}`, 'Admission')
    persist()
    return app
  })),

  http.patch('/api/admissions/:id', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const app = db.applications.find((a) => a.id === params.id && a.tenantId === user.tenantId)
    if (!app) throw new ApiError(404, 'Application not found')
    const b = (await request.json()) as { stage?: AdmissionStage; score?: number; note?: string; documents?: Application['documents'] }
    if (b.stage && b.stage !== app.stage) {
      if (b.stage === 'ENROLLED') throw new ApiError(400, 'Use “Enrol” to create the learner record')
      if (b.stage === 'DOCS_VERIFIED' && app.documents.some((d) => !d.verified)) throw new ApiError(400, 'Verify all documents first')
      app.notes.push({ at: new Date().toISOString(), by: user.name, text: `Moved to ${b.stage.replace('_', ' ').toLowerCase()}` })
      app.stage = b.stage
    }
    if (b.score !== undefined) app.score = b.score
    if (b.documents) app.documents = b.documents
    if (b.note) app.notes.push({ at: new Date().toISOString(), by: user.name, text: b.note })
    app.updatedAt = new Date().toISOString()
    audit(db, user, `Updated application ${app.number}`, 'Admission')
    persist()
    return app
  })),

  http.post('/api/admissions/:id/enrol', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const app = db.applications.find((a) => a.id === params.id && a.tenantId === user.tenantId)
    if (!app) throw new ApiError(404, 'Application not found')
    if (app.stage !== 'ACCEPTED' && app.stage !== 'OFFERED') throw new ApiError(400, 'Only offered or accepted applicants can be enrolled')
    const { sectionId } = (await request.json()) as { sectionId: string }
    const section = db.sections.find((s) => s.id === sectionId && s.programId === app.programId)
    if (!section) throw new ApiError(400, 'Choose a section of the applied programme')
    const program = db.programs.find((p) => p.id === app.programId)!
    const [firstName, ...rest] = app.applicantName.split(' ')
    const n = byTenant(db.learners, tenant!.id).length + 1
    const adult = ['UG', 'PG', 'PHD'].includes(program.level)
    const l: Learner = {
      id: `${tenant!.id}-l-${Date.now().toString(36)}`, tenantId: tenant!.id, admissionNo: `${tenant!.shortName}/${new Date().getFullYear()}/${String(n).padStart(4, '0')}`,
      firstName, lastName: rest.join(' '), gender: app.gender, dob: app.dob, level: program.level, programId: program.id, sectionId: section.id,
      rollNo: db.learners.filter((x) => x.sectionId === section.id).length + 1, email: adult ? app.email : undefined, phone: adult ? app.phone : undefined,
      address: '', nationality: tenant!.country,
      guardians: adult ? [] : [{ name: app.guardianName, relation: 'Guardian', phone: app.phone, email: app.email }], status: 'ACTIVE', enrolledOn: today(),
    }
    db.learners.push(l)
    app.stage = 'ENROLLED'
    app.learnerId = l.id
    app.updatedAt = new Date().toISOString()
    app.notes.push({ at: app.updatedAt, by: user.name, text: `Enrolled as ${l.admissionNo} in ${section.name}` })
    const st = byTenant(db.feeStructures, tenant!.id).find((f) => f.programIds.includes(program.id))
    const inv = st ? createInvoice(db, tenant!, st, l) : null
    audit(db, user, `Enrolled applicant ${app.applicantName} as ${l.admissionNo}${inv ? ` and raised invoice ${inv.number}` : ''}`, 'Admission')
    persist()
    return { learner: l, invoice: inv }
  })),

  // Public application form (no sign-in)
  http.get('/api/public/institutions/:subdomain', handle<{ subdomain: string }>(({ params }) => {
    const db = getDb()
    const t = db.tenants.find((x) => x.subdomain === params.subdomain)
    if (!t) throw new ApiError(404, 'Institution not found')
    return {
      tenant: { name: t.name, city: t.city, country: t.country, brandColor: t.brandColor, shortName: t.shortName, type: t.type, framework: t.framework },
      programs: byTenant(db.programs, t.id).filter((p) => p.level !== 'PHD' || t.type === 'UNIVERSITY').map((p) => ({ id: p.id, name: p.name, level: p.level })),
    }
  })),

  http.post('/api/public/institutions/:subdomain/apply', handle<{ subdomain: string }>(async ({ request, params }) => {
    const db = getDb()
    const t = db.tenants.find((x) => x.subdomain === params.subdomain)
    if (!t) throw new ApiError(404, 'Institution not found')
    const b = (await request.json()) as Partial<Application> & { consent?: boolean }
    if (!b.applicantName || !b.programId || !b.phone || !b.email || !b.dob) throw new ApiError(400, 'Please fill in all required fields')
    if (!b.consent) throw new ApiError(400, 'Consent to process personal data is required')
    if (!db.programs.some((p) => p.id === b.programId && p.tenantId === t.id)) throw new ApiError(400, 'Unknown programme')
    const app = newApplication(db, t, b, 'APPLIED', 'Website')
    db.audit.unshift({ id: crypto.randomUUID(), tenantId: t.id, actor: 'Public portal', action: `Online application ${app.number} — ${app.applicantName}`, entity: 'Admission', at: new Date().toISOString() })
    persist()
    return { number: app.number }
  })),

  // ======== Exams & results ========
  http.get('/api/exams', handle(({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const items = byTenant(db.assessments, user.tenantId).map((a) => {
      const expected = db.sections
        .filter((s) => a.programIds.includes(s.programId) && db.learners.some((l) => l.sectionId === s.id))
        .reduce((acc, s) => acc + examinableCourses(db, s.id).length, 0)
      const entered = db.marks.filter((m) => m.assessmentId === a.id).length
      return { ...a, expected, entered }
    }).sort((a, b) => a.startDate.localeCompare(b.startDate))
    return { items, myPending: user.role === 'FACULTY' ? pendingMarks(db, user) : [] }
  })),

  http.post('/api/exams', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const b = (await request.json()) as Partial<Assessment>
    if (!b.name || !b.maxMarks || !b.programIds?.length) throw new ApiError(400, 'Name, maximum marks and at least one programme are required')
    const term = db.terms.find((t) => t.tenantId === user.tenantId && t.current)
    const a: Assessment = {
      id: `${user.tenantId}-ex-${Date.now().toString(36)}`, tenantId: user.tenantId, name: b.name, kind: b.kind ?? 'UNIT_TEST', termId: term?.id ?? '',
      programIds: b.programIds, maxMarks: Number(b.maxMarks), weight: Number(b.weight ?? 0), startDate: b.startDate ?? today(), status: 'SCHEDULED',
    }
    db.assessments.push(a)
    audit(db, user, `Scheduled assessment ${a.name}`, 'Exam')
    persist()
    return a
  })),

  http.patch('/api/exams/:id', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const a = db.assessments.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!a) throw new ApiError(404, 'Assessment not found')
    const b = (await request.json()) as Partial<Assessment>
    if (b.status) a.status = b.status
    audit(db, user, `${b.status === 'PUBLISHED' ? 'Published results of' : 'Updated'} ${a.name}`, 'Exam')
    persist()
    return a
  })),

  http.get('/api/exams/:id/sheet', handle<{ id: string }>(({ request, params, url }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const a = db.assessments.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!a) throw new ApiError(404, 'Assessment not found')
    const sectionId = url.searchParams.get('sectionId') ?? ''
    const courseId = url.searchParams.get('courseId') ?? ''
    const learners = db.learners.filter((l) => l.sectionId === sectionId && l.status === 'ACTIVE').sort((x, y) => x.rollNo - y.rollNo)
    const sheet = db.marks.find((m) => m.id === `${a.id}|${sectionId}|${courseId}`) ?? null
    const canEdit = a.status === 'MARKS_ENTRY' && (user.role === 'INST_ADMIN' || sectionsTaughtBy(db, user.personId).has(`${sectionId}|${courseId}`))
    return { assessment: a, learners, sheet, canEdit, course: db.courses.find((c) => c.id === courseId), section: db.sections.find((s) => s.id === sectionId) }
  })),

  http.put('/api/exams/:id/sheet', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const a = db.assessments.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!a) throw new ApiError(404, 'Assessment not found')
    if (a.status !== 'MARKS_ENTRY') throw new ApiError(400, a.status === 'PUBLISHED' ? 'Results are published; marks are locked' : 'Marks entry has not opened for this assessment')
    const b = (await request.json()) as { sectionId: string; courseId: string; marks: Record<string, number | null> }
    if (user.role === 'FACULTY' && !sectionsTaughtBy(db, user.personId).has(`${b.sectionId}|${b.courseId}`)) throw new ApiError(403, 'You do not teach this course in this section')
    for (const v of Object.values(b.marks)) if (v !== null && (v < 0 || v > a.maxMarks || Number.isNaN(v))) throw new ApiError(400, `Marks must be between 0 and ${a.maxMarks}`)
    const id = `${a.id}|${b.sectionId}|${b.courseId}`
    db.marks = db.marks.filter((m) => m.id !== id)
    db.marks.push({ id, tenantId: user.tenantId, assessmentId: a.id, sectionId: b.sectionId, courseId: b.courseId, marks: b.marks, enteredBy: user.personId ?? user.id, updatedAt: new Date().toISOString() })
    audit(db, user, `Entered ${a.name} marks for ${sectionName(db, b.sectionId)} · ${db.courses.find((c) => c.id === b.courseId)?.name}`, 'Exam')
    persist()
    return { ok: true }
  })),

  http.get('/api/exams/:id/analysis', handle<{ id: string }>(({ request, params, url }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const a = db.assessments.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!a) throw new ApiError(404, 'Assessment not found')
    const sectionId = url.searchParams.get('sectionId') ?? ''
    const courses = examinableCourses(db, sectionId)
    const learners = db.learners.filter((l) => l.sectionId === sectionId && l.status === 'ACTIVE')
    const pass = passMark(tenant!.framework)
    const perCourse = courses.map((c) => {
      const sheet = db.marks.find((m) => m.id === `${a.id}|${sectionId}|${c.id}`)
      const vals = sheet ? Object.values(sheet.marks).filter((v): v is number => v !== null).map((v) => (v / a.maxMarks) * 100) : []
      const dist: Record<string, number> = {}
      vals.forEach((v) => { const g = gradeFor(v, tenant!.framework).grade; dist[g] = (dist[g] ?? 0) + 1 })
      const target = 60
      const aboveTarget = vals.length ? vals.filter((v) => v >= target).length / vals.length : 0
      // NBA-style course-outcome attainment: level 3 if ≥70% of students reach the target, 2 if ≥60%, 1 if ≥50%.
      const attainment = !vals.length ? null : aboveTarget >= 0.7 ? 3 : aboveTarget >= 0.6 ? 2 : aboveTarget >= 0.5 ? 1 : 0
      return {
        courseId: c.id, courseName: c.name, entered: !!sheet, count: vals.length,
        avg: vals.length ? round1(vals.reduce((x, y) => x + y, 0) / vals.length) : null,
        max: vals.length ? round1(Math.max(...vals)) : null, min: vals.length ? round1(Math.min(...vals)) : null,
        passRate: vals.length ? round1((vals.filter((v) => v >= pass).length / vals.length) * 100) : null,
        distribution: dist, attainment,
      }
    })
    const totals = learners.map((l) => {
      const vs = courses.map((c) => db.marks.find((m) => m.id === `${a.id}|${sectionId}|${c.id}`)?.marks[l.id]).filter((v): v is number => typeof v === 'number')
      return { learnerId: l.id, name: `${l.firstName} ${l.lastName}`, pct: vs.length ? round1((vs.reduce((x, y) => x + y, 0) / (vs.length * a.maxMarks)) * 100) : null }
    }).filter((x) => x.pct !== null).sort((x, y) => y.pct! - x.pct!)
    return { assessment: a, perCourse, toppers: totals.slice(0, 5), needsSupport: totals.filter((t) => t.pct! < pass + 7).slice(-5).reverse(), gradeLabels: [] as string[] }
  })),

  http.get('/api/results/:learnerId', handle<{ learnerId: string }>(({ request, params }) => {
    const { db, user, tenant } = auth(request)
    const l = db.learners.find((x) => x.id === params.learnerId)
    if (!l || !tenant || !(canSeeLearner(db, user, l))) throw new ApiError(404, 'Learner not found')
    return reportCard(db, user, tenant, l)
  })),

  // ======== Fees ========
  http.get('/api/fees/summary', handle(({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const invs = byTenant(db.invoices, user.tenantId).map((i) => invoiceView(db, i))
    const billed = invs.reduce((a, i) => a + i.net, 0)
    const collected = invs.reduce((a, i) => a + i.paid, 0)
    const byMethod = new Map<string, number>()
    const daily = new Map<string, number>()
    invs.forEach((i) => i.payments.forEach((p) => {
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount)
      const d = p.at.slice(0, 10)
      daily.set(d, (daily.get(d) ?? 0) + p.amount)
    }))
    const structures = byTenant(db.feeStructures, user.tenantId).map((s) => {
      const mine = invs.filter((i) => i.structureId === s.id)
      return { id: s.id, name: s.name, invoices: mine.length, billed: mine.reduce((a, i) => a + i.net, 0), collected: mine.reduce((a, i) => a + i.paid, 0) }
    })
    const recent = invs.flatMap((i) => i.payments.map((p) => ({ ...p, invoiceId: i.id, invoiceNumber: i.number, learnerName: i.learnerName }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
    return {
      billed, collected, outstanding: billed - collected, rate: billed ? round1((collected / billed) * 100) : 0,
      counts: { PAID: invs.filter((i) => i.status === 'PAID').length, PARTIAL: invs.filter((i) => i.status === 'PARTIAL' || (i.status === 'OVERDUE' && i.paid > 0)).length, OVERDUE: invs.filter((i) => i.status === 'OVERDUE').length, DUE: invs.filter((i) => i.status === 'DUE').length },
      concessions: invs.reduce((a, i) => a + i.discount, 0),
      byMethod: [...byMethod.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
      daily: [...daily.entries()].sort().slice(-30).map(([date, amount]) => ({ date, amount })),
      structures, recent,
    }
  })),

  http.get('/api/fees/invoices', handle(({ request, url }) => {
    const { db, user } = auth(request)
    const vis = visibleLearnerIds(db, user)
    if (user.role === 'FACULTY') throw new ApiError(403, 'Not allowed')
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const status = url.searchParams.get('status')
    const structureId = url.searchParams.get('structureId')
    let list = byTenant(db.invoices, user.tenantId).filter((i) => vis === null || vis.has(i.learnerId)).map((i) => invoiceView(db, i))
    if (structureId) list = list.filter((i) => i.structureId === structureId)
    if (status) list = list.filter((i) => i.status === status)
    if (q) list = list.filter((i) => `${i.learnerName} ${i.number} ${i.admissionNo}`.toLowerCase().includes(q))
    return list.sort((a, b) => b.balance - a.balance || a.number.localeCompare(b.number)).slice(0, 200)
  })),

  http.get('/api/fees/invoices/:id', handle<{ id: string }>(({ request, params }) => {
    const { db, user, tenant } = auth(request)
    const inv = db.invoices.find((i) => i.id === params.id && i.tenantId === user.tenantId)
    const l = inv && db.learners.find((x) => x.id === inv.learnerId)
    if (!inv || !l || !canSeeLearner(db, user, l) || user.role === 'FACULTY') throw new ApiError(404, 'Invoice not found')
    return { ...invoiceView(db, inv), tenant: { name: tenant!.name, city: tenant!.city, currency: tenant!.currency, country: tenant!.country }, programName: db.programs.find((p) => p.id === l.programId)?.name }
  })),

  http.post('/api/fees/invoices/:id/payments', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    const inv = db.invoices.find((i) => i.id === params.id && i.tenantId === user.tenantId)
    const l = inv && db.learners.find((x) => x.id === inv.learnerId)
    if (!inv || !l || !canSeeLearner(db, user, l) || user.role === 'FACULTY') throw new ApiError(404, 'Invoice not found')
    const b = (await request.json()) as { amount: number; method: PaymentMethod; reference?: string }
    const online: PaymentMethod[] = ['UPI', 'CARD', 'NET_BANKING']
    if (user.role !== 'INST_ADMIN' && !online.includes(b.method)) throw new ApiError(400, 'Choose an online payment method')
    const v = invoiceView(db, inv)
    const amount = Math.round(Number(b.amount) * 100) / 100
    if (!(amount > 0)) throw new ApiError(400, 'Enter an amount greater than zero')
    if (amount > v.balance + 0.001) throw new ApiError(400, 'Amount exceeds the balance due')
    const payment = {
      id: `${inv.id}-p${inv.payments.length + 1}-${Date.now().toString(36)}`, amount, method: b.method,
      reference: b.reference || `${b.method.slice(0, 3)}${Math.floor(Math.random() * 1e9)}`, at: new Date().toISOString(),
      receivedBy: user.role === 'INST_ADMIN' ? user.name : 'Online gateway (test mode)',
    }
    inv.payments.push(payment)
    audit(db, user, `Payment of ${amount} received on ${inv.number} via ${b.method}`, 'Fees')
    persist()
    return { payment, invoice: invoiceView(db, inv) }
  })),

  http.post('/api/fees/remind', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const { invoiceIds } = (await request.json()) as { invoiceIds?: string[] }
    const targets = byTenant(db.invoices, user.tenantId).map((i) => invoiceView(db, i)).filter((i) => i.balance > 0 && (!invoiceIds || invoiceIds.includes(i.id)))
    audit(db, user, `Sent fee reminders for ${targets.length} invoice(s) (SMS / email / WhatsApp — simulated)`, 'Fees')
    persist()
    return { sent: targets.length }
  })),

  http.get('/api/fees/structures', handle(({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    return byTenant(db.feeStructures, user.tenantId).map((s) => ({ ...s, programNames: s.programIds.map((id) => db.programs.find((p) => p.id === id)?.name ?? ''), total: s.items.reduce((a, x) => a + x.amount, 0) }))
  })),

  http.post('/api/fees/structures', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const b = (await request.json()) as Partial<FeeStructure> & { generate?: boolean }
    if (!b.name || !b.programIds?.length || !b.items?.length) throw new ApiError(400, 'Name, programmes and at least one fee head are required')
    const st: FeeStructure = { id: `${user.tenantId}-fs-${Date.now().toString(36)}`, tenantId: user.tenantId, name: b.name, programIds: b.programIds, items: b.items.map((i) => ({ head: i.head, amount: Number(i.amount) })), frequency: b.frequency ?? 'TERM', dueDate: b.dueDate ?? today() }
    db.feeStructures.push(st)
    let generated = 0
    if (b.generate) {
      for (const l of db.learners.filter((x) => x.tenantId === user.tenantId && x.status === 'ACTIVE' && st.programIds.includes(x.programId))) {
        createInvoice(db, tenant!, st, l)
        generated++
      }
    }
    audit(db, user, `Created fee structure ${st.name}${generated ? ` and raised ${generated} invoices` : ''}`, 'Fees')
    persist()
    return { structure: st, generated }
  })),

  // ======== Communication ========
  http.get('/api/announcements', handle(({ request }) => {
    const { db, user } = auth(request)
    return byTenant(db.announcements, user.tenantId)
      .filter((a) => canSeeAnnouncement(db, user, a))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
      .map((a) => ({ ...a, read: a.readBy.includes(user.id), readCount: a.readBy.length, sectionNames: a.sectionIds.map((s) => sectionName(db, s)) }))
  })),

  http.post('/api/announcements', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    const b = (await request.json()) as Partial<Announcement>
    if (!b.title || !b.body || !b.audienceRoles?.length) throw new ApiError(400, 'Title, message and audience are required')
    if (user.role === 'FACULTY') {
      const mine = learnerSectionsOf(db, user)
      if (!b.sectionIds?.length || b.sectionIds.some((s) => !mine.has(s))) throw new ApiError(403, 'Faculty can post only to sections they teach')
    }
    const a: Announcement = {
      id: `${user.tenantId}-ann-${Date.now().toString(36)}`, tenantId: user.tenantId, title: b.title, body: b.body, audienceRoles: b.audienceRoles as Role[],
      sectionIds: b.sectionIds ?? [], channels: b.channels?.length ? b.channels : ['APP'], authorId: user.id, authorName: user.name, pinned: !!b.pinned && user.role === 'INST_ADMIN',
      createdAt: new Date().toISOString(), readBy: [user.id],
    }
    db.announcements.push(a)
    audit(db, user, `Posted announcement “${a.title}” via ${a.channels.join(', ')}`, 'Communication')
    persist()
    return a
  })),

  http.post('/api/announcements/:id/read', handle<{ id: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    const a = db.announcements.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (a && !a.readBy.includes(user.id)) {
      a.readBy.push(user.id)
      persist()
    }
    return { ok: true }
  })),

  http.get('/api/messages', handle(({ request }) => {
    const { db, user } = auth(request)
    return byTenant(db.threads, user.tenantId)
      .filter((t) => t.participantIds.includes(user.id))
      .map((t) => {
        const last = t.messages[t.messages.length - 1]
        const others = t.participantIds.filter((p) => p !== user.id).map((p) => db.users.find((u) => u.id === p))
        return {
          id: t.id, subject: t.subject, last: last ? { ...last, authorName: db.users.find((u) => u.id === last.authorId)?.name ?? '' } : null,
          with: others.map((o) => ({ id: o?.id, name: o?.name ?? '—', title: o?.title ?? '' })),
          unread: t.messages.filter((m) => m.authorId !== user.id && m.at > (t.readBy[user.id] ?? '')).length,
        }
      })
      .sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? ''))
  })),

  http.get('/api/messages/contacts', handle(({ request }) => {
    const { db, user } = auth(request)
    return allowedContacts(db, user).map((u) => ({ id: u.id, name: u.name, title: u.title, role: u.role }))
  })),

  http.get('/api/messages/:id', handle<{ id: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    const t = db.threads.find((x) => x.id === params.id && x.participantIds.includes(user.id))
    if (!t) throw new ApiError(404, 'Conversation not found')
    t.readBy[user.id] = new Date().toISOString()
    persist()
    return {
      ...t,
      participants: t.participantIds.map((p) => {
        const u = db.users.find((x) => x.id === p)
        return { id: p, name: u?.name ?? '—', title: u?.title ?? '', role: u?.role }
      }),
    }
  })),

  http.post('/api/messages', handle(async ({ request }) => {
    const { db, user } = auth(request)
    const b = (await request.json()) as { toUserId: string; subject: string; body: string }
    if (!b.subject?.trim() || !b.body?.trim()) throw new ApiError(400, 'Subject and message are required')
    if (!allowedContacts(db, user).some((u) => u.id === b.toUserId)) throw new ApiError(403, 'You cannot message this person')
    const now = new Date().toISOString()
    const t = { id: `${user.tenantId}-th-${Date.now().toString(36)}`, tenantId: user.tenantId, subject: b.subject.trim(), participantIds: [user.id, b.toUserId], messages: [{ id: crypto.randomUUID(), authorId: user.id, body: b.body.trim(), at: now }], readBy: { [user.id]: now } }
    db.threads.push(t)
    persist()
    return t
  })),

  http.post('/api/messages/:id', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    const t = db.threads.find((x) => x.id === params.id && x.participantIds.includes(user.id))
    if (!t) throw new ApiError(404, 'Conversation not found')
    const { body } = (await request.json()) as { body: string }
    if (!body?.trim()) throw new ApiError(400, 'Message is empty')
    const now = new Date().toISOString()
    t.messages.push({ id: crypto.randomUUID(), authorId: user.id, body: body.trim(), at: now })
    t.readBy[user.id] = now
    persist()
    return { ok: true }
  })),

  http.get('/api/notifications/counts', handle(({ request }) => {
    const { db, user } = auth(request)
    const announcements = byTenant(db.announcements, user.tenantId).filter((a) => canSeeAnnouncement(db, user, a) && !a.readBy.includes(user.id)).length
    const messages = byTenant(db.threads, user.tenantId).filter((t) => t.participantIds.includes(user.id)).reduce((acc, t) => acc + t.messages.filter((m) => m.authorId !== user.id && m.at > (t.readBy[user.id] ?? '')).length, 0)
    return { announcements, messages }
  })),

  // ======== Library ========
  http.get('/api/library/books', handle(({ request, url }) => {
    const { db, user } = auth(request)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const category = url.searchParams.get('category')
    const active = byTenant(db.loans, user.tenantId).filter((l) => !l.returnedOn)
    return byTenant(db.books, user.tenantId)
      .filter((b) => (!q || `${b.title} ${b.author} ${b.isbn}`.toLowerCase().includes(q)) && (!category || b.category === category))
      .map((b) => ({ ...b, available: b.copies - active.filter((l) => l.bookId === b.id).length }))
  })),

  http.post('/api/library/books', handle(async ({ request }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const b = (await request.json()) as { title: string; author: string; isbn?: string; category?: string; copies?: number; shelf?: string; year?: number }
    if (!b.title || !b.author) throw new ApiError(400, 'Title and author are required')
    const book = { id: `${user.tenantId}-bk-${Date.now().toString(36)}`, tenantId: user.tenantId, isbn: b.isbn ?? '', title: b.title, author: b.author, category: b.category || 'General', year: Number(b.year) || new Date().getFullYear(), shelf: b.shelf ?? '', copies: Number(b.copies) || 1, forLevels: 'GENERAL' as const }
    db.books.push(book)
    audit(db, user, `Catalogued “${book.title}” (${book.copies} copies)`, 'Library')
    persist()
    return book
  })),

  http.get('/api/library/loans', handle(({ request, url }) => {
    const { db, user, tenant } = auth(request)
    const status = url.searchParams.get('status') ?? 'active'
    const vis = visibleLearnerIds(db, user)
    let list = byTenant(db.loans, user.tenantId)
    if (user.role !== 'INST_ADMIN') list = list.filter((l) => l.borrowerType === 'LEARNER' && vis !== null && vis.has(l.borrowerId))
    const views = list.map((l) => loanView(db, tenant!, l))
    const filtered = status === 'all' ? views : status === 'overdue' ? views.filter((l) => l.active && l.overdueDays > 0) : views.filter((l) => l.active)
    return filtered.sort((a, b) => b.overdueDays - a.overdueDays || b.issuedOn.localeCompare(a.issuedOn))
  })),

  http.post('/api/library/loans', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const b = (await request.json()) as { bookId: string; borrowerId: string; days?: number }
    const book = db.books.find((x) => x.id === b.bookId && x.tenantId === user.tenantId)
    const learner = db.learners.find((x) => x.id === b.borrowerId && x.tenantId === user.tenantId)
    if (!book || !learner) throw new ApiError(400, 'Choose a book and a borrower')
    const active = db.loans.filter((l) => !l.returnedOn)
    if (active.filter((l) => l.bookId === book.id).length >= book.copies) throw new ApiError(409, 'No copies available')
    if (active.filter((l) => l.borrowerId === learner.id).length >= 3) throw new ApiError(409, `${learner.firstName} already has 3 books issued`)
    const overdue = active.filter((l) => l.borrowerId === learner.id && l.dueOn < today())
    if (overdue.length) throw new ApiError(409, `${learner.firstName} has an overdue book; return it first`)
    const due = new Date()
    due.setDate(due.getDate() + (b.days ?? 14))
    const loan: Loan = { id: `${user.tenantId}-ln-${Date.now().toString(36)}`, tenantId: user.tenantId, bookId: book.id, borrowerId: learner.id, borrowerType: 'LEARNER', issuedOn: today(), dueOn: due.toISOString().slice(0, 10) }
    db.loans.push(loan)
    audit(db, user, `Issued “${book.title}” to ${learner.firstName} ${learner.lastName}`, 'Library')
    persist()
    return loanView(db, tenant!, loan)
  })),

  http.post('/api/library/loans/:id/return', handle<{ id: string }>(({ request, params }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const loan = db.loans.find((l) => l.id === params.id && l.tenantId === user.tenantId && !l.returnedOn)
    if (!loan) throw new ApiError(404, 'Active loan not found')
    const v = loanView(db, tenant!, loan)
    loan.returnedOn = today()
    loan.finePaid = v.fine
    audit(db, user, `Returned “${v.bookTitle}” from ${v.borrowerName}${v.fine ? ` — fine ${v.fine}` : ''}`, 'Library')
    persist()
    return loanView(db, tenant!, loan)
  })),

  // ======== Dashboard extras ========
  http.get('/api/dashboard/extras', handle(({ request }) => {
    const { db, user, tenant } = auth(request)
    if (!tenant) return {}
    const announcements = byTenant(db.announcements, tenant.id).filter((a) => canSeeAnnouncement(db, user, a)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3)
    if (user.role === 'INST_ADMIN') {
      const invs = byTenant(db.invoices, tenant.id).map((i) => invoiceView(db, i))
      const billed = invs.reduce((a, i) => a + i.net, 0)
      const collected = invs.reduce((a, i) => a + i.paid, 0)
      const apps = byTenant(db.applications, tenant.id)
      const exams = byTenant(db.assessments, tenant.id)
      const inEntry = exams.find((e) => e.status === 'MARKS_ENTRY')
      const expected = inEntry ? db.sections.filter((s) => inEntry.programIds.includes(s.programId)).reduce((acc, s) => acc + examinableCourses(db, s.id).length, 0) : 0
      return {
        kind: 'admin',
        fees: { billed, collected, outstanding: billed - collected, rate: billed ? round1((collected / billed) * 100) : 0, overdue: invs.filter((i) => i.status === 'OVERDUE').length },
        admissions: { open: apps.filter((a) => !['ENROLLED', 'REJECTED'].includes(a.stage)).length, offered: apps.filter((a) => a.stage === 'OFFERED' || a.stage === 'ACCEPTED').length, newThisWeek: apps.filter((a) => daysBetween(a.createdAt.slice(0, 10), today()) <= 7).length },
        marks: inEntry ? { name: inEntry.name, entered: db.marks.filter((m) => m.assessmentId === inEntry.id).length, expected } : null,
        nextExam: exams.filter((e) => e.status === 'SCHEDULED' && e.startDate >= today()).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null,
        library: { overdue: byTenant(db.loans, tenant.id).filter((l) => !l.returnedOn && l.dueOn < today()).length, issued: byTenant(db.loans, tenant.id).filter((l) => !l.returnedOn).length },
        announcements,
      }
    }
    if (user.role === 'FACULTY') return { kind: 'faculty', pendingMarks: pendingMarks(db, user), announcements }
    const learnerIds = user.role === 'STUDENT' ? [user.personId!] : user.learnerIds ?? []
    const children = learnerIds.map((id) => {
      const l = db.learners.find((x) => x.id === id)!
      const rc = reportCard(db, user, tenant, l)
      const invs = byTenant(db.invoices, tenant.id).filter((i) => i.learnerId === id).map((i) => invoiceView(db, i))
      const loans = byTenant(db.loans, tenant.id).filter((x) => x.borrowerId === id && !x.returnedOn).map((x) => loanView(db, tenant, x))
      return {
        learnerId: id, name: `${l.firstName} ${l.lastName}`, overall: rc.overall, overallGrade: rc.overallGrade, gpa: rc.gpa, gpaLabel: rc.gpaLabel, rank: rc.rank, classSize: rc.classSize,
        latestAssessment: rc.assessments[rc.assessments.length - 1]?.name ?? null,
        feeBalance: invs.reduce((a, i) => a + i.balance, 0), feeOverdue: invs.some((i) => i.status === 'OVERDUE'), loans,
      }
    })
    return { kind: 'learner', children, announcements }
  })),
]

function newApplication(db: Db, t: Tenant, b: Partial<Application>, stage: AdmissionStage, source: Application['source']): Application {
  const n = byTenant(db.applications, t.id).length + 101
  const now = new Date().toISOString()
  const docsFor: Record<string, string[]> = {
    SCHOOL: ['Birth certificate', 'Aadhaar / ID proof', 'Address proof', 'Previous report card', 'Transfer certificate', 'Passport-size photo'],
    COLLEGE: ['Class 12 marksheet', 'Entrance scorecard (JEE / MHT-CET)', 'Aadhaar', 'Category certificate', 'Migration certificate'],
    UNIVERSITY: ['Academic transcripts', 'Passport copy', 'English proficiency (IELTS / TOEFL)', 'Statement of purpose', 'Two recommendation letters'],
    TRAINING: ['ID proof', 'Previous certificate'],
  }
  const app: Application = {
    id: `${t.id}-app-${Date.now().toString(36)}`, tenantId: t.id,
    number: `${t.shortName}/ADM/${new Date().getFullYear() + (t.type === 'SCHOOL' ? 1 : 0)}/${String(n).padStart(4, '0')}`,
    applicantName: b.applicantName!.trim(), dob: b.dob ?? '', gender: b.gender ?? 'X', programId: b.programId!, stage,
    category: b.category || (t.country === 'IN' ? 'GENERAL' : 'INTERNATIONAL'), source, guardianName: b.guardianName ?? b.applicantName!, phone: b.phone!, email: b.email ?? '',
    previousSchool: b.previousSchool, documents: (docsFor[t.type] ?? docsFor.SCHOOL).map((name) => ({ name, verified: false })),
    notes: [{ at: now, by: source === 'Website' ? 'Public portal' : 'Admissions office', text: source === 'Website' ? 'Submitted online application form.' : 'Enquiry recorded.' }],
    createdAt: now, updatedAt: now,
  }
  db.applications.push(app)
  return app
}
