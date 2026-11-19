// Phase 3b mock API: verifiable credentials (issue, sign, revoke, share), anchoring ledger,
// public verification endpoints, credit bank (ABC / ECTS) and DigiLocker push.
import { http } from 'msw'
import { getDb, persist } from './db'
import type { Db } from './seed'
import { ApiError, attendanceStats, audit, auth, byTenant, canSeeLearner, handle, pct, requireRole } from './handlers'
import { reportCard } from './handlers-phase2'
import { blockHash, credentialHash, generateIssuerKey, signCredential } from '@/lib/vc'
import { gpaInfo, passMark } from '@/lib/frameworks'
import type { Credential, CredentialTemplate, CreditRecord, Learner, LedgerBlock, Tenant, User, VerifiableCredential } from '@/types'

export const didOf = (t: Tenant) => `did:web:${t.subdomain}.unifiedtree.app`
const base = (t: Tenant) => `https://${t.subdomain}.unifiedtree.app`
const VC_CONTEXT = 'https://www.w3.org/ns/credentials/v2'
const OB_CONTEXT = 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'

export const TEMPLATES: Record<CredentialTemplate, { name: string; description: string; for: Tenant['type'][]; standard: string }> = {
  PROGRESS_REPORT: { name: 'Progress report', description: 'Term results with subject grades and overall grade (published assessments only).', for: ['SCHOOL'], standard: 'W3C VC 2.0' },
  GRADE_CARD: { name: 'Grade card / transcript', description: 'Semester courses, credits and grades from the credit bank, with SGPA or GPA.', for: ['COLLEGE', 'UNIVERSITY'], standard: 'W3C VC 2.0 · ABC / Europass-ready' },
  COURSE_COMPLETION: { name: 'Course completion', description: 'Completed an LMS course (≥ 80% of lessons and all quizzes attempted).', for: ['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'TRAINING'], standard: 'Open Badges 3.0' },
  ATTENDANCE_BADGE: { name: 'Star Attendance badge', description: 'Attendance of 95% or more this term.', for: ['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'TRAINING'], standard: 'Open Badges 3.0' },
  BONAFIDE: { name: 'Bonafide / enrolment letter', description: 'Confirms current enrolment — for scholarships, visas, internships and bank accounts.', for: ['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'TRAINING'], standard: 'W3C VC 2.0' },
  RESEARCH_MILESTONE: { name: 'Doctoral milestone', description: 'Certifies the latest completed PhD milestone (coursework, synopsis, progress review…).', for: ['UNIVERSITY', 'COLLEGE'], standard: 'W3C VC 2.0' },
}

const RESULTS_VIEWER = { role: 'STUDENT' } as User // credentials only ever include published results

// ---------------- builders ----------------
function subjectBase(db: Db, l: Learner) {
  const program = db.programs.find((p) => p.id === l.programId)
  const section = db.sections.find((s) => s.id === l.sectionId)
  return {
    id: l.apaarId ? `urn:apaar:${l.apaarId}` : `urn:unifiedtree:learner:${l.id}`,
    type: ['Learner'],
    name: `${l.firstName} ${l.lastName}`,
    ...(l.abcId ? { abcId: l.abcId } : {}),
    programme: program?.name,
    section: section?.name,
    admissionNo: l.admissionNo,
  }
}

function termCredits(db: Db, learnerId: string, term?: string) {
  const recs = db.creditRecords.filter((r) => r.learnerId === learnerId)
  const terms = [...new Set(recs.map((r) => r.term))]
  const chosen = term ?? terms[terms.length - 1]
  return { term: chosen, records: recs.filter((r) => r.term === chosen), terms }
}

function buildVc(db: Db, c: Credential, t: Tenant): VerifiableCredential {
  const l = db.learners.find((x) => x.id === c.learnerId)!
  const term = db.terms.find((x) => x.tenantId === t.id && x.current)
  const badge = c.template === 'ATTENDANCE_BADGE' || c.template === 'COURSE_COMPLETION'
  let subject: Record<string, unknown> = subjectBase(db, l)
  let validUntil: string | undefined

  if (c.template === 'PROGRESS_REPORT') {
    const rc = reportCard(db, RESULTS_VIEWER, t, l)
    subject = {
      ...subject, academicTerm: rc.term, framework: t.framework,
      assessments: rc.assessments.map((a) => a.name),
      results: rc.rows.filter((r) => r.percent !== null).map((r) => ({ course: r.courseName, percent: r.percent, grade: r.grade })),
      overallPercent: rc.overall, overallGrade: rc.overallGrade, ...(rc.gpa !== null ? { [rc.gpaLabel ?? 'gpa']: rc.gpa } : {}),
    }
  } else if (c.template === 'GRADE_CARD') {
    const { term: chosen, records } = termCredits(db, l.id, c.params?.term)
    const gp = gpaInfo(t.framework)
    const totalCredits = records.reduce((s, r) => s + r.credits, 0)
    const points = gp ? records.reduce((s, r) => s + (gp.points[r.grade] ?? 0) * r.credits, 0) / Math.max(1, totalCredits) : null
    subject = {
      ...subject, academicTerm: chosen, creditScheme: records[0]?.scheme ?? (t.country === 'IN' ? 'ABC' : 'ECTS'),
      courses: records.map((r) => ({ code: r.courseCode, title: r.courseName, credits: r.credits, grade: r.grade })),
      totalCredits, ...(points !== null ? { [gp!.label]: Math.round(points * 100) / 100 } : {}),
    }
  } else if (c.template === 'BONAFIDE') {
    subject = { ...subject, enrolmentStatus: 'Currently enrolled', academicTerm: term?.name }
    validUntil = term ? new Date(term.end + 'T23:59:59Z').toISOString() : undefined
  } else if (c.template === 'RESEARCH_MILESTONE') {
    const r = db.research.find((x) => x.learnerId === l.id)
    subject = { ...subject, researchTopic: r?.topic, milestone: c.params?.milestone, supervisor: db.staff.find((s) => s.id === r?.supervisorId)?.name }
  } else if (c.template === 'ATTENDANCE_BADGE') {
    const a = pct(attendanceStats(db, t.id).get(l.id))
    subject = {
      ...subject, type: ['AchievementSubject'], attendancePercent: a,
      achievement: { id: `${base(t)}/achievements/star-attendance`, type: ['Achievement'], name: 'Star Attendance', description: 'Attended at least 95% of school days this term.', criteria: { narrative: 'Attendance of 95% or more in the current term, as recorded in the attendance register.' } },
    }
  } else if (c.template === 'COURSE_COMPLETION') {
    const course = db.courses.find((x) => x.id === c.params?.courseId)
    const lessons = db.lessons.filter((x) => x.sectionId === c.params?.sectionId && x.courseId === c.params?.courseId)
    const done = lessons.filter((x) => (db.lessonDone[l.id] ?? []).includes(x.id)).length
    const atts = db.quizAttempts.filter((q) => q.learnerId === l.id && db.quizzes.some((z) => z.id === q.quizId && z.courseId === c.params?.courseId))
    subject = {
      ...subject, type: ['AchievementSubject'], lessonsCompleted: `${done}/${lessons.length}`,
      quizAverage: atts.length ? Math.round((atts.reduce((s, q) => s + q.score / q.max, 0) / atts.length) * 100) : null,
      achievement: { id: `${base(t)}/achievements/course-${course?.code}`, type: ['Achievement'], name: `Completed ${course?.name}`, description: `Completed the online course ${course?.name}.`, criteria: { narrative: 'Completed at least 80% of lessons and attempted every quiz.' } },
    }
  }

  return {
    '@context': badge ? [VC_CONTEXT, OB_CONTEXT] : [VC_CONTEXT],
    id: `${base(t)}/credentials/${c.id}`,
    type: badge ? ['VerifiableCredential', 'OpenBadgeCredential'] : ['VerifiableCredential', 'EducationalCredential'],
    issuer: { id: didOf(t), name: t.name },
    validFrom: c.issuedAt,
    ...(validUntil ? { validUntil } : {}),
    name: c.title,
    credentialSubject: subject,
    credentialStatus: {
      id: `${base(t)}/status/revocation#${c.statusIndex}`, type: 'BitstringStatusListEntry', statusPurpose: 'revocation',
      statusListIndex: String(c.statusIndex), statusListCredential: `${base(t)}/status/revocation`,
    },
  }
}

// ---------------- issuer service ----------------
let running: Promise<void> | null = null

async function appendBlock(db: Db, action: LedgerBlock['action'], issuerDid: string, credentialId: string, credentialHashHex: string, at: string) {
  const prev = db.ledger[db.ledger.length - 1]
  const b = { index: db.ledger.length, at, action, issuerDid, credentialId, credentialHash: credentialHashHex, prevHash: prev?.hash ?? '0'.repeat(64) }
  db.ledger.push({ ...b, hash: await blockHash(b) })
}

/** Build, sign and anchor any credential that is not yet signed; record revocations on the ledger. */
export async function ensureIssued(db: Db) {
  if (running) return running
  running = (async () => {
    let changed = false
    if (!db.ledger.length) {
      await appendBlock(db, 'GENESIS', 'did:web:unifiedtree.app', 'genesis', '0'.repeat(64), '2024-01-01T00:00:00.000Z')
      changed = true
    }
    const anchoredRevokes = new Set(db.ledger.filter((b) => b.action === 'REVOKE').map((b) => b.credentialId))
    type Ev = { at: string; kind: 'ISSUE' | 'REVOKE'; c: Credential }
    const events: Ev[] = [
      ...db.credentials.filter((c) => !c.vc?.proof).map((c) => ({ at: c.issuedAt, kind: 'ISSUE' as const, c })),
      ...db.credentials.filter((c) => c.status === 'REVOKED' && !anchoredRevokes.has(c.id)).map((c) => ({ at: c.revokedAt ?? new Date().toISOString(), kind: 'REVOKE' as const, c })),
    ].sort((a, b) => a.at.localeCompare(b.at) || (a.kind === 'ISSUE' ? -1 : 1))
    for (const ev of events) {
      const t = db.tenants.find((x) => x.id === ev.c.tenantId)!
      if (ev.kind === 'ISSUE') {
        if (!db.issuerKeys[t.id]) db.issuerKeys[t.id] = await generateIssuerKey()
        const unsigned = ev.c.vc ?? buildVc(db, ev.c, t)
        ev.c.vc = (await signCredential(unsigned, db.issuerKeys[t.id].privateJwk, `${didOf(t)}#key-1`, ev.c.issuedAt)) as VerifiableCredential
        ev.c.hash = await credentialHash(ev.c.vc)
        await appendBlock(db, 'ISSUE', didOf(t), ev.c.id, ev.c.hash, ev.c.issuedAt)
      } else if (ev.c.hash) {
        await appendBlock(db, 'REVOKE', didOf(t), ev.c.id, ev.c.hash, ev.at)
      }
      changed = true
    }
    if (changed) persist()
  })()
  try {
    await running
  } finally {
    running = null
  }
}

// ---------------- eligibility ----------------
function eligibility(db: Db, t: Tenant, l: Learner, template: CredentialTemplate, params: Record<string, string>) {
  const dup = db.credentials.some((c) => c.learnerId === l.id && c.template === template && c.status === 'ACTIVE' && JSON.stringify(c.params ?? {}) === JSON.stringify(params ?? {}))
  if (dup && template !== 'BONAFIDE') return { ok: false, reason: 'Already issued' }
  if (l.status !== 'ACTIVE') return { ok: false, reason: 'Not currently enrolled' }
  switch (template) {
    case 'PROGRESS_REPORT': {
      const rc = reportCard(db, RESULTS_VIEWER, t, l)
      return rc.overall === null ? { ok: false, reason: 'No published results yet' } : { ok: true, reason: `${rc.overall}% · ${rc.overallGrade}` }
    }
    case 'GRADE_CARD': {
      const { records, term } = termCredits(db, l.id, params.term)
      return records.length ? { ok: true, reason: `${records.reduce((s, r) => s + r.credits, 0)} credits · ${term}` } : { ok: false, reason: 'No banked credits for this term' }
    }
    case 'ATTENDANCE_BADGE': {
      const a = pct(attendanceStats(db, t.id).get(l.id))
      return a !== null && a >= 95 ? { ok: true, reason: `${a}% attendance` } : { ok: false, reason: `${a ?? '—'}% attendance (needs 95%)` }
    }
    case 'COURSE_COMPLETION': {
      const lessons = db.lessons.filter((x) => x.sectionId === params.sectionId && x.courseId === params.courseId)
      const done = lessons.filter((x) => (db.lessonDone[l.id] ?? []).includes(x.id)).length
      const quizzes = db.quizzes.filter((z) => z.sectionId === params.sectionId && z.courseId === params.courseId)
      const attempted = quizzes.every((z) => db.quizAttempts.some((q) => q.quizId === z.id && q.learnerId === l.id))
      if (!lessons.length) return { ok: false, reason: 'Course has no lessons' }
      return done / lessons.length >= 0.8 && attempted ? { ok: true, reason: `${done}/${lessons.length} lessons` } : { ok: false, reason: `${done}/${lessons.length} lessons${attempted ? '' : ', quiz pending'}` }
    }
    case 'BONAFIDE':
      return { ok: true, reason: 'Enrolled' }
    case 'RESEARCH_MILESTONE': {
      const r = db.research.find((x) => x.learnerId === l.id)
      const done = r?.milestones.filter((m) => m.done) ?? []
      return done.length ? { ok: true, reason: done[done.length - 1].label } : { ok: false, reason: 'No completed milestone' }
    }
  }
}

function credentialRow(db: Db, c: Credential) {
  const l = db.learners.find((x) => x.id === c.learnerId)
  return {
    id: c.id, learnerId: c.learnerId, learnerName: l ? `${l.firstName} ${l.lastName}` : '—', sectionName: db.sections.find((s) => s.id === l?.sectionId)?.name ?? '',
    template: c.template, title: c.title, issuedAt: c.issuedAt, issuedBy: c.issuedBy, status: c.status, revokedAt: c.revokedAt, revokeReason: c.revokeReason,
    shared: c.shared, digilocker: c.digilocker, hash: c.hash, statusIndex: c.statusIndex,
  }
}

function canSeeCredential(user: User, c: Credential) {
  if (c.tenantId !== user.tenantId) return false
  if (user.role === 'INST_ADMIN') return true
  if (user.role === 'STUDENT') return c.learnerId === user.personId
  if (user.role === 'GUARDIAN') return !!user.learnerIds?.includes(c.learnerId)
  return false
}

const NEP_EXITS = [
  { credits: 40, award: 'UG Certificate (after Year 1)' }, { credits: 80, award: 'UG Diploma (after Year 2)' },
  { credits: 120, award: 'Bachelor’s degree (3 years)' }, { credits: 160, award: 'Bachelor’s degree with Honours / Research (4 years)' },
]

export const phase3bHandlers = [
  // ---------- templates & issuance ----------
  http.get('/api/credentials/templates', handle(({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const hasPhd = db.programs.some((p) => p.tenantId === tenant!.id && p.level === 'PHD')
    return Object.entries(TEMPLATES)
      .filter(([k, v]) => v.for.includes(tenant!.type) && (k !== 'RESEARCH_MILESTONE' || hasPhd))
      .map(([code, v]) => ({ code, ...v }))
  })),

  http.post('/api/credentials/preview', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const b = (await request.json()) as { template: CredentialTemplate; sectionId: string; params?: Record<string, string> }
    const learners = db.learners.filter((l) => l.sectionId === b.sectionId && l.tenantId === user.tenantId).sort((x, y) => x.rollNo - y.rollNo)
    const terms = [...new Set(db.creditRecords.filter((r) => learners.some((l) => l.id === r.learnerId)).map((r) => r.term))]
    const courses = db.courses.filter((c) => db.lessons.some((x) => x.sectionId === b.sectionId && x.courseId === c.id)).map((c) => ({ id: c.id, name: c.name }))
    const params = { ...(b.params ?? {}), ...(b.template === 'COURSE_COMPLETION' ? { sectionId: b.sectionId } : {}) }
    return {
      terms, courses,
      rows: learners.map((l) => ({ learnerId: l.id, name: `${l.firstName} ${l.lastName}`, rollNo: l.rollNo, apaarId: l.apaarId, ...eligibility(db, tenant!, l, b.template, params) })),
    }
  })),

  http.post('/api/credentials/issue', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const b = (await request.json()) as { template: CredentialTemplate; learnerIds: string[]; title: string; sectionId?: string; params?: Record<string, string> }
    if (!b.learnerIds?.length || !b.title) throw new ApiError(400, 'Choose learners and a title')
    const params = { ...(b.params ?? {}), ...(b.template === 'COURSE_COMPLETION' && b.sectionId ? { sectionId: b.sectionId } : {}) }
    let next = Math.max(0, ...byTenant(db.credentials, user.tenantId).map((c) => c.statusIndex))
    const issued: string[] = []
    const skipped: string[] = []
    for (const id of b.learnerIds) {
      const l = db.learners.find((x) => x.id === id && x.tenantId === user.tenantId)
      if (!l) continue
      const e = eligibility(db, tenant!, l, b.template, params)
      if (!e.ok) { skipped.push(`${l.firstName} ${l.lastName}: ${e.reason}`); continue }
      const c: Credential = {
        id: `cred-${tenant!.id}-${Date.now().toString(36)}${issued.length}`, tenantId: tenant!.id, learnerId: l.id, template: b.template,
        params: Object.keys(params).length ? params : undefined, title: b.title, issuedAt: new Date().toISOString(), issuedBy: user.name,
        vc: null, statusIndex: ++next, status: 'ACTIVE', shared: true,
      }
      db.credentials.push(c)
      issued.push(c.id)
    }
    await ensureIssued(db)
    audit(db, user, `Issued ${issued.length} × “${b.title}” (${TEMPLATES[b.template].name}), signed and anchored`, 'Credentials')
    persist()
    return { issued: issued.length, skipped }
  })),

  // ---------- listing & detail ----------
  http.get('/api/credentials', handle(async ({ request, url }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN', 'STUDENT', 'GUARDIAN')
    await ensureIssued(db)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const template = url.searchParams.get('template')
    const status = url.searchParams.get('status')
    return byTenant(db.credentials, user.tenantId)
      .filter((c) => canSeeCredential(user, c) && (!template || c.template === template) && (!status || c.status === status))
      .map((c) => credentialRow(db, c))
      .filter((r) => !q || `${r.learnerName} ${r.title} ${r.id}`.toLowerCase().includes(q))
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  })),

  http.get('/api/credentials/:id', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    await ensureIssued(db)
    const c = db.credentials.find((x) => x.id === params.id)
    if (!c || !canSeeCredential(user, c)) throw new ApiError(404, 'Credential not found')
    const block = db.ledger.find((b) => b.credentialId === c.id && b.action === 'ISSUE')
    return { ...credentialRow(db, c), vc: c.vc, ledgerIndex: block?.index ?? null }
  })),

  http.post('/api/credentials/:id/revoke', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const c = db.credentials.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!c) throw new ApiError(404, 'Credential not found')
    if (c.status === 'REVOKED') throw new ApiError(409, 'Already revoked')
    const { reason } = (await request.json()) as { reason: string }
    if (!reason?.trim()) throw new ApiError(400, 'A reason is required for revocation')
    c.status = 'REVOKED'
    c.revokedAt = new Date().toISOString()
    c.revokeReason = reason.trim()
    await ensureIssued(db)
    audit(db, user, `Revoked credential ${c.id} — ${c.revokeReason}`, 'Credentials')
    persist()
    return credentialRow(db, c)
  })),

  http.patch('/api/credentials/:id/share', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    const c = db.credentials.find((x) => x.id === params.id)
    if (!c || !canSeeCredential(user, c) || user.role === 'INST_ADMIN') throw new ApiError(404, 'Credential not found')
    const { shared } = (await request.json()) as { shared: boolean }
    c.shared = !!shared
    persist()
    return credentialRow(db, c)
  })),

  http.post('/api/credentials/:id/digilocker', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const c = db.credentials.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!c) throw new ApiError(404, 'Credential not found')
    if (tenant!.country !== 'IN') throw new ApiError(400, 'DigiLocker is available for Indian institutions only')
    if (c.status !== 'ACTIVE') throw new ApiError(400, 'Revoked credentials cannot be pushed')
    const l = db.learners.find((x) => x.id === c.learnerId)
    if (!l?.apaarId && !l?.abcId) throw new ApiError(400, 'The learner has no APAAR / ABC ID linked')
    c.digilocker = { uri: `in.gov.digilocker.${tenant!.shortName.toLowerCase()}-${c.template.toLowerCase().replace(/_/g, '')}-${c.id.slice(-6)}`, pushedAt: new Date().toISOString(), status: 'DELIVERED' }
    audit(db, user, `Pushed ${c.id} to DigiLocker (sandbox)`, 'Credentials')
    persist()
    return credentialRow(db, c)
  })),

  http.get('/api/credentials-issuer', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    await ensureIssued(db)
    const key = db.issuerKeys[tenant!.id]
    const mine = byTenant(db.credentials, tenant!.id)
    return {
      did: didOf(tenant!), didUrl: `${base(tenant!)}/.well-known/did.json`, keyCreatedAt: key?.createdAt, publicJwk: key?.publicJwk,
      counts: { issued: mine.length, active: mine.filter((c) => c.status === 'ACTIVE').length, revoked: mine.filter((c) => c.status === 'REVOKED').length, digilocker: mine.filter((c) => c.digilocker).length },
      ledger: { height: db.ledger.length, head: db.ledger[db.ledger.length - 1]?.hash },
      recentBlocks: [...db.ledger].reverse().slice(0, 12),
    }
  })),

  // ---------- credit bank ----------
  http.get('/api/credits', handle(({ request, url }) => {
    const { db, user, tenant } = auth(request)
    const learnerId = url.searchParams.get('learnerId') ?? user.personId ?? ''
    const l = db.learners.find((x) => x.id === learnerId)
    if (!l || !canSeeLearner(db, user, l)) throw new ApiError(404, 'Learner not found')
    const records = db.creditRecords.filter((r) => r.learnerId === l.id).sort((a, b) => a.depositedAt.localeCompare(b.depositedAt))
    const total = records.reduce((s, r) => s + r.credits, 0)
    const scheme: CreditRecord['scheme'] = tenant!.country === 'IN' ? 'ABC' : 'ECTS'
    return {
      learner: { id: l.id, name: `${l.firstName} ${l.lastName}`, abcId: l.abcId, apaarId: l.apaarId, level: l.level },
      scheme, total, records,
      milestones: scheme === 'ABC' && l.level === 'UG' ? NEP_EXITS.map((m) => ({ ...m, reached: total >= m.credits })) : scheme === 'ECTS' && l.level !== 'PHD' ? [{ credits: 60, award: 'One full academic year (60 ECTS)' }, { credits: l.level === 'PG' ? 120 : 180, award: l.level === 'PG' ? 'Master’s degree (120 ECTS)' : 'Bachelor’s degree (180 ECTS)' }].map((m) => ({ ...m, reached: total >= m.credits })) : [],
    }
  })),

  http.get('/api/credits/overview', handle(({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const sections = byTenant(db.sections, tenant!.id).filter((s) => s.semester !== undefined && db.learners.some((l) => l.sectionId === s.id))
    return {
      scheme: tenant!.country === 'IN' ? 'ABC' : 'ECTS',
      sections: sections.map((s) => {
        const ls = db.learners.filter((l) => l.sectionId === s.id)
        const recs = db.creditRecords.filter((r) => ls.some((l) => l.id === r.learnerId))
        const program = db.programs.find((p) => p.id === s.programId)!
        const final = db.assessments.find((a) => a.tenantId === tenant!.id && a.kind === 'FINAL' && a.programIds.includes(program.id))
        return {
          sectionId: s.id, sectionName: s.name, programName: program.name, learners: ls.length,
          linked: ls.filter((l) => (tenant!.country === 'IN' ? l.abcId : true)).length,
          credits: recs.reduce((a, r) => a + r.credits, 0), lastDeposit: recs.map((r) => r.depositedAt).sort().pop() ?? null,
          canPush: final?.status === 'PUBLISHED', pushBlockedReason: final?.status === 'PUBLISHED' ? null : `${final?.name ?? 'Final examination'} results are not published yet`,
        }
      }),
    }
  })),

  http.post('/api/credits/push', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const { sectionId } = (await request.json()) as { sectionId: string }
    const section = db.sections.find((s) => s.id === sectionId && s.tenantId === tenant!.id)
    if (!section) throw new ApiError(404, 'Section not found')
    const final = db.assessments.find((a) => a.tenantId === tenant!.id && a.kind === 'FINAL' && a.programIds.includes(section.programId))
    if (final?.status !== 'PUBLISHED') throw new ApiError(400, `Credits can be deposited only after ${final?.name ?? 'final'} results are published`)
    const scheme: CreditRecord['scheme'] = tenant!.country === 'IN' ? 'ABC' : 'ECTS'
    const term = db.terms.find((t) => t.tenantId === tenant!.id && t.current)?.name ?? 'Current term'
    let deposited = 0
    for (const l of db.learners.filter((x) => x.sectionId === section.id && x.status === 'ACTIVE')) {
      if (scheme === 'ABC' && !l.abcId) continue
      const rc = reportCard(db, RESULTS_VIEWER, tenant!, l)
      for (const r of rc.rows.filter((x) => x.pass && x.credits > 0)) {
        if (db.creditRecords.some((c) => c.learnerId === l.id && c.courseCode === r.code && c.term === term)) continue
        db.creditRecords.push({ id: `${tenant!.id}-cr-${Date.now().toString(36)}${deposited}`, tenantId: tenant!.id, learnerId: l.id, scheme, courseCode: r.code, courseName: r.courseName, credits: r.credits, grade: r.grade ?? '', term, depositedAt: new Date().toISOString(), status: 'ACCEPTED', ref: `${scheme}-${Date.now().toString(36).toUpperCase()}${deposited}` })
        deposited++
      }
    }
    audit(db, user, `Deposited ${deposited} course credit record(s) for ${section.name} to ${scheme === 'ABC' ? 'the Academic Bank of Credits (sandbox)' : 'the ECTS record'}`, 'Credits')
    persist()
    return { deposited, passMark: passMark(tenant!.framework) }
  })),

  // ---------- public verification (no sign-in) ----------
  http.get('/api/public/credentials/:id', handle<{ id: string }>(async ({ params }) => {
    const db = getDb()
    await ensureIssued(db)
    const c = db.credentials.find((x) => x.id === params.id || x.vc?.id === params.id)
    if (!c?.vc) throw new ApiError(404, 'No credential with this ID')
    if (!c.shared) throw new ApiError(403, 'The holder has not shared this credential. Ask them for a share link or the credential file.')
    return { vc: c.vc }
  })),

  http.get('/api/public/did/:subdomain', handle<{ subdomain: string }>(async ({ params }) => {
    const db = getDb()
    await ensureIssued(db)
    const t = db.tenants.find((x) => x.subdomain === params.subdomain)
    const key = t && db.issuerKeys[t.id]
    if (!t || !key) throw new ApiError(404, 'Issuer not found')
    const did = didOf(t)
    return {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/jwk/v1'], id: did, alsoKnownAs: [base(t)],
      verificationMethod: [{ id: `${did}#key-1`, type: 'JsonWebKey', controller: did, publicKeyJwk: key.publicJwk }],
      assertionMethod: [`${did}#key-1`], name: t.name,
    }
  })),

  http.get('/api/public/status/:subdomain', handle<{ subdomain: string }>(({ params }) => {
    const db = getDb()
    const t = db.tenants.find((x) => x.subdomain === params.subdomain)
    if (!t) throw new ApiError(404, 'Issuer not found')
    return { statusPurpose: 'revocation', revoked: byTenant(db.credentials, t.id).filter((c) => c.status === 'REVOKED').map((c) => c.statusIndex).sort((a, b) => a - b) }
  })),

  http.get('/api/public/ledger', handle(async () => {
    const db = getDb()
    await ensureIssued(db)
    return { blocks: db.ledger }
  })),
]

export { buildVc }
