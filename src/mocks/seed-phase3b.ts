// Phase 3b demo data: credit-bank history (ABC for India, ECTS for Bologna) and credential issuance requests.
// Credentials are seeded unsigned; the issuer service builds and signs them with WebCrypto on first use.
import type { Db } from './seed'
import { gradeFor, passMark } from '@/lib/frameworks'
import type { Credential, CredentialTemplate, CreditRecord, Tenant } from '@/types'

let rand = mulberry32(2024)
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const daysAgo = (now: Date, d: number, h = 11) => {
  const x = new Date(now)
  x.setDate(x.getDate() - d)
  x.setHours(h, 0, 0, 0)
  return x.toISOString()
}

/** Label for the odd semester `sem` taken by a learner currently in `current`. */
export function termLabel(tenant: Tenant, now: Date, sem: number, current: number) {
  const yearsAgo = Math.floor((current - sem) / 2)
  const y = now.getFullYear() - yearsAgo
  return tenant.framework === 'BOLOGNA_ECTS' ? `Fall ${y}` : `Odd Semester ${y}–${String(y + 1).slice(2)}`
}

function seedCredits(db: Db, now: Date) {
  let n = 0
  for (const tenant of db.tenants.filter((t) => t.id === 'iit' || t.id === 'mru')) {
    const scheme: CreditRecord['scheme'] = tenant.country === 'IN' ? 'ABC' : 'ECTS'
    for (const section of db.sections.filter((s) => s.tenantId === tenant.id && s.semester)) {
      const program = db.programs.find((p) => p.id === section.programId)!
      const learners = db.learners.filter((l) => l.sectionId === section.id)
      const research = program.level === 'PHD'
      for (const l of learners) {
        const ability = 0.55 + rand() * 0.4
        // completed semesters: every earlier odd semester; doctoral coursework once past that stage
        const sems = research
          ? (db.research.find((r) => r.learnerId === l.id)?.stage !== 'COURSEWORK' ? [1] : [])
          : [1, 3, 5, 7].filter((s) => s < (section.semester ?? 1))
        // even semesters are not in the demo course catalogue: bank them as one consolidated record each
        if (!research) {
          for (const even of [2, 4, 6].filter((s) => s < (section.semester ?? 1))) {
            n++
            const pct = Math.round(Math.min(95, Math.max(45, (ability + (rand() - 0.5) * 0.2) * 100)))
            // an even semester falls in the same academic year as the odd semester before it
            const y = now.getFullYear() - Math.floor(((section.semester ?? 1) - (even - 1)) / 2)
            db.creditRecords.push({
              id: `${tenant.id}-cr-${n}`, tenantId: tenant.id, learnerId: l.id, scheme, courseCode: `${program.code}-SEM${even}`,
              courseName: `Semester ${even} — all courses (consolidated)`, credits: scheme === 'ECTS' ? 30 : 20, grade: gradeFor(pct, tenant.framework).grade,
              term: scheme === 'ECTS' ? `Spring ${y + 1}` : `Even Semester ${y}–${String(y + 1).slice(2)}`,
              depositedAt: daysAgo(now, 30 + ((section.semester ?? 1) - even) * 180), status: 'ACCEPTED', ref: `${scheme}-${now.getFullYear()}-${String(100000 + n).slice(1)}`,
            })
          }
        }
        for (const sem of sems) {
          const courses = db.courses.filter((c) => c.programId === program.id && c.semester === sem && c.credits > 0)
          for (const c of courses) {
            const pct = Math.round(Math.min(98, Math.max(30, (ability + (rand() - 0.5) * 0.25) * 100)))
            const g = gradeFor(pct, tenant.framework)
            if (pct < passMark(tenant.framework)) continue // credits are banked only for passed courses
            n++
            db.creditRecords.push({
              id: `${tenant.id}-cr-${n}`, tenantId: tenant.id, learnerId: l.id, scheme, courseCode: c.code, courseName: c.name, credits: c.credits,
              grade: g.grade, term: research ? `Doctoral coursework ${now.getFullYear() - 1}` : termLabel(tenant, now, sem, section.semester ?? 1),
              depositedAt: daysAgo(now, 30 + ((section.semester ?? 1) - sem) * 180), status: 'ACCEPTED',
              ref: `${scheme}-${now.getFullYear()}-${String(100000 + n).slice(1)}`,
            })
          }
        }
      }
    }
  }
}

function seedCredentials(db: Db, now: Date) {
  const counters: Record<string, number> = {}
  let n = 0
  const issue = (learnerId: string, template: CredentialTemplate, title: string, days: number, params?: Record<string, string>, extra: Partial<Credential> = {}) => {
    const l = db.learners.find((x) => x.id === learnerId)
    if (!l) return
    const admin = db.users.find((u) => u.tenantId === l.tenantId && u.role === 'INST_ADMIN')!
    counters[l.tenantId] = (counters[l.tenantId] ?? 0) + 1
    n++
    db.credentials.push({
      id: `cred-${l.tenantId}-${String(n).padStart(4, '0')}`, tenantId: l.tenantId, learnerId, template, params, title,
      issuedAt: daysAgo(now, days, 9 + (n % 8)), issuedBy: admin.name, vc: null, statusIndex: counters[l.tenantId],
      status: 'ACTIVE', shared: true, ...extra,
    })
  }
  const user = (id: string) => db.users.find((u) => u.id === id)?.personId ?? ''
  const year = now.getFullYear()

  // Greenfield (K-12): Term 1 progress reports for Grade 3 and Grade 10, attendance badges
  const termTitle = `Progress report — Term 1 ${year}–${String(year + 1).slice(2)}`
  for (const secId of ['gps-p-g3-s-g3a', 'gps-p-g10-s-g10a']) {
    db.learners.filter((l) => l.sectionId === secId).forEach((l) => issue(l.id, 'PROGRESS_REPORT', termTitle, 50))
  }
  const att = new Map<string, { p: number; t: number }>()
  db.attendance.filter((a) => a.tenantId === 'gps').forEach((s) => Object.entries(s.marks).forEach(([lid, m]) => {
    const x = att.get(lid) ?? { p: 0, t: 0 }
    x.t++
    if (m !== 'A') x.p++
    att.set(lid, x)
  }))
  const stars = [...att.entries()].filter(([, x]) => x.t && x.p / x.t >= 0.95).map(([lid]) => lid)
  // badges only for learners who actually meet the 95% criterion
  for (const lid of stars.slice(0, 9)) issue(lid, 'ATTENDANCE_BADGE', 'Star Attendance badge', 6)
  issue(user('u-gps-teen'), 'BONAFIDE', 'Bonafide certificate', 12)
  // one credential revoked (issued in error) for the verification demo
  const g10 = db.learners.filter((l) => l.sectionId === 'gps-p-g10-s-g10b')
  if (g10[0]) issue(g10[0].id, 'BONAFIDE', 'Bonafide certificate', 30, undefined, { status: 'REVOKED', revokedAt: daysAgo(now, 28), revokeReason: 'Issued with an incorrect section; reissued' })
  if (g10[0]) issue(g10[0].id, 'BONAFIDE', 'Bonafide certificate', 28)

  // Indus (engineering): semester grade cards from banked credits
  for (const l of db.learners.filter((x) => x.sectionId === 'iit-p-btcse-s-btcses5')) {
    issue(l.id, 'GRADE_CARD', 'Grade card — Semester 3', 120, { term: termLabel(db.tenants.find((t) => t.id === 'iit')!, now, 3, 5) })
  }
  issue(user('u-iit-student'), 'BONAFIDE', 'Bonafide certificate (internship)', 9)

  // Meridian (Dubai): transcript for MSc Year 2, research milestones for doctoral scholars
  for (const l of db.learners.filter((x) => x.sectionId === 'mru-p-mscds-s-mscdss3')) {
    issue(l.id, 'GRADE_CARD', 'Transcript — Fall', 300, { term: termLabel(db.tenants.find((t) => t.id === 'mru')!, now, 1, 3) })
  }
  for (const r of db.research.filter((x) => x.milestones.some((m) => m.done))) {
    const done = r.milestones.filter((m) => m.done)
    issue(r.learnerId, 'RESEARCH_MILESTONE', `Doctoral milestone — ${done[done.length - 1].label}`, 20, { milestone: done[done.length - 1].label })
  }
  issue(user('u-mru-student'), 'BONAFIDE', 'Enrolment letter (visa)', 15)
}

export function seedPhase3b(db: Db, now: Date) {
  rand = mulberry32(2024)
  seedCredits(db, now)
  seedCredentials(db, now)
}
