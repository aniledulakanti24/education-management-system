// Phase 2 demo data: admissions pipeline, exams & marks, fees & payments, communication, library.
import type { Db } from './seed'
import type {
  AdmissionStage, Application, Assessment, Book, Course, FeeStructure, Invoice, Learner, MarkSheet, PaymentMethod, Program, Tenant,
} from '@/types'

let rand = mulberry32(7)
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const gauss = () => {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysFrom = (now: Date, n: number) => {
  const d = new Date(now)
  d.setDate(d.getDate() + n)
  return iso(d)
}
const roundTo = (n: number, step: number) => Math.round(n / step) * step

// Courses a section actually studies (same rule as the timetable), excluding non-examined activities.
export function examinableCourses(db: Db, sectionId: string): Course[] {
  const s = db.sections.find((x) => x.id === sectionId)
  if (!s) return []
  return db.courses.filter((c) => c.programId === s.programId && (s.semester === undefined || c.semester === s.semester) && c.type !== 'ACTIVITY')
}

// ---------------- Exams & marks ----------------
function seedExams(db: Db, tenant: Tenant, now: Date) {
  const term = db.terms.find((t) => t.tenantId === tenant.id && t.current)!
  const programs = db.programs.filter((p) => p.tenantId === tenant.id && p.level !== 'PRE_PRIMARY' && p.level !== 'PHD').map((p) => p.id)
  const y = now.getFullYear()
  const defs: Omit<Assessment, 'id' | 'tenantId' | 'termId' | 'programIds'>[] =
    tenant.type === 'SCHOOL'
      ? [
          { name: 'Periodic Test 1', kind: 'UNIT_TEST', maxMarks: 40, weight: 10, startDate: `${y}-07-21`, status: 'PUBLISHED' },
          { name: 'Half-Yearly Examination', kind: 'MIDTERM', maxMarks: 80, weight: 30, startDate: `${y}-09-15`, status: 'PUBLISHED' },
          { name: 'Periodic Test 2', kind: 'UNIT_TEST', maxMarks: 40, weight: 10, startDate: daysFrom(now, -6), status: 'MARKS_ENTRY' },
          { name: 'Annual Examination', kind: 'FINAL', maxMarks: 80, weight: 50, startDate: `${y + 1}-02-24`, status: 'SCHEDULED' },
        ]
      : tenant.type === 'COLLEGE'
        ? [
            { name: 'Internal Assessment 1', kind: 'INTERNAL', maxMarks: 20, weight: 20, startDate: `${y}-09-05`, status: 'PUBLISHED' },
            { name: 'Mid-Semester Examination', kind: 'MIDTERM', maxMarks: 30, weight: 30, startDate: `${y}-10-06`, status: 'PUBLISHED' },
            { name: 'End-Semester Examination', kind: 'FINAL', maxMarks: 50, weight: 50, startDate: daysFrom(now, 18), status: 'SCHEDULED' },
          ]
        : [
            { name: 'Midterm Examination', kind: 'MIDTERM', maxMarks: 100, weight: 40, startDate: `${y}-10-20`, status: 'PUBLISHED' },
            { name: 'Coursework & Projects', kind: 'INTERNAL', maxMarks: 100, weight: 20, startDate: daysFrom(now, -10), status: 'MARKS_ENTRY' },
            { name: 'Final Examination', kind: 'FINAL', maxMarks: 100, weight: 40, startDate: daysFrom(now, 22), status: 'SCHEDULED' },
          ]
  const assessments: Assessment[] = defs.map((d, i) => ({ ...d, id: `${tenant.id}-ex-${i + 1}`, tenantId: tenant.id, termId: term.id, programIds: programs }))
  db.assessments.push(...assessments)

  const learners = db.learners.filter((l) => l.tenantId === tenant.id && programs.includes(l.programId))
  const ability = new Map<string, number>()
  learners.forEach((l) => ability.set(l.id, clamp(0.7 + gauss() * 0.14, 0.25, 0.98)))
  // demo accounts get a believable, healthy profile
  const demo: Record<string, number> = { 'u-gps-kid': 0.86, 'u-gps-teen': 0.76, 'u-iit-student': 0.79, 'u-mru-student': 0.82 }
  db.users.filter((u) => demo[u.id] && u.personId).forEach((u) => ability.set(u.personId!, demo[u.id]))
  const sections = db.sections.filter((s) => s.tenantId === tenant.id && programs.includes(s.programId))

  for (const a of assessments.filter((x) => x.status !== 'SCHEDULED')) {
    for (const [si, s] of sections.entries()) {
      // marks entry in progress: only about half of the sections are done
      if (a.status === 'MARKS_ENTRY' && si % 2 === 1) continue
      const inSection = learners.filter((l) => l.sectionId === s.id)
      for (const c of examinableCourses(db, s.id)) {
        const difficulty = (c.name.length % 7) / 100 - 0.03
        const marks: Record<string, number | null> = {}
        for (const l of inSection) {
          if (rand() < 0.02) marks[l.id] = null
          else marks[l.id] = clamp(Math.round(a.maxMarks * (ability.get(l.id)! - difficulty + gauss() * 0.08)), 0, a.maxMarks)
        }
        const teacher = db.slots.find((x) => x.sectionId === s.id && x.courseId === c.id)?.staffId ?? s.classTeacherId ?? 'system'
        const sheet: MarkSheet = { id: `${a.id}|${s.id}|${c.id}`, tenantId: tenant.id, assessmentId: a.id, sectionId: s.id, courseId: c.id, marks, enteredBy: teacher, updatedAt: `${a.startDate}T16:00:00` }
        db.marks.push(sheet)
      }
    }
  }
}

// ---------------- Fees ----------------
function feeItems(tenant: Tenant, p: Program): { name: string; items: { head: string; amount: number }[]; frequency: FeeStructure['frequency'] } {
  if (tenant.id === 'gps') {
    const tuition = { PRE_PRIMARY: 28000, PRIMARY: 35000, MIDDLE: 42000, SECONDARY: 48000, SENIOR_SECONDARY: 56000 }[p.level as 'PRIMARY'] ?? 35000
    return {
      name: `Term 2 fees — ${p.level.replace('_', ' ').toLowerCase()}`, frequency: 'TERM',
      items: [{ head: 'Tuition fee', amount: tuition }, { head: 'Development fee', amount: 6000 }, { head: 'Activities & labs', amount: p.level === 'SENIOR_SECONDARY' ? 7500 : 3500 }, { head: 'Examination fee', amount: 1500 }],
    }
  }
  if (tenant.id === 'iit') {
    const pg = p.level === 'PG'
    return {
      name: `Odd semester fees — ${pg ? 'M.Tech' : 'B.Tech'}`, frequency: 'SEMESTER',
      items: [{ head: 'Tuition fee', amount: pg ? 62000 : 87500 }, { head: 'Development fee', amount: 15000 }, { head: 'Library & laboratory', amount: 6000 }, { head: 'Examination fee', amount: 3500 }, { head: 'Student activities & gymkhana', amount: 2500 }],
    }
  }
  const tuition = p.level === 'PHD' ? 14000 : p.level === 'PG' ? 39500 : 33000
  return {
    name: `Fall ${new Date().getFullYear()} — ${p.level === 'PHD' ? 'doctoral' : p.level === 'PG' ? 'postgraduate' : 'undergraduate'}`, frequency: 'SEMESTER',
    items: [{ head: 'Tuition fee', amount: tuition }, { head: 'Registration', amount: 1500 }, { head: 'Student services & health', amount: 1250 }, { head: 'Technology fee', amount: 900 }],
  }
}

function seedFees(db: Db, tenant: Tenant, now: Date) {
  const programs = db.programs.filter((p) => p.tenantId === tenant.id)
  const dueOffset = tenant.id === 'gps' ? -35 : tenant.id === 'iit' ? -70 : -55
  const methods: PaymentMethod[] = tenant.country === 'IN' ? ['UPI', 'UPI', 'UPI', 'CARD', 'NET_BANKING', 'NET_BANKING', 'CASH', 'CHEQUE'] : ['CARD', 'CARD', 'BANK_TRANSFER', 'BANK_TRANSFER', 'CASH']
  // group programmes by fee structure name
  const byName = new Map<string, { items: { head: string; amount: number }[]; frequency: FeeStructure['frequency']; programIds: string[] }>()
  for (const p of programs) {
    const f = feeItems(tenant, p)
    const e = byName.get(f.name) ?? { items: f.items, frequency: f.frequency, programIds: [] }
    e.programIds.push(p.id)
    byName.set(f.name, e)
  }
  let n = 0
  ;[...byName.entries()].forEach(([name, e], i) => {
    const st: FeeStructure = { id: `${tenant.id}-fs-${i + 1}`, tenantId: tenant.id, name, programIds: e.programIds, items: e.items, frequency: e.frequency, dueDate: daysFrom(now, dueOffset) }
    db.feeStructures.push(st)
    const learners = db.learners.filter((l) => l.tenantId === tenant.id && e.programIds.includes(l.programId) && l.status === 'ACTIVE')
    for (const l of learners) {
      n++
      const total = st.items.reduce((a, x) => a + x.amount, 0)
      const tuition = st.items[0].amount
      let discount = 0
      let discountReason: string | undefined
      const r = rand()
      if (l.level === 'PHD' && r < 0.75) { discount = tuition; discountReason = 'Doctoral fellowship — full tuition waiver' }
      else if (tenant.id === 'gps' && r < 0.04) { discount = total; discountReason = 'RTE Act 25% quota — full waiver' }
      else if (r < 0.1) { discount = roundTo(tuition * 0.25, 50); discountReason = 'Merit scholarship (25% of tuition)' }
      else if (r < 0.16) { discount = roundTo(tuition * 0.1, 50); discountReason = tenant.id === 'mru' ? 'Early-payment discount (10%)' : 'Sibling concession (10% of tuition)' }
      const net = total - discount
      const inv: Invoice = {
        id: `${tenant.id}-inv-${n}`, tenantId: tenant.id, number: `${tenant.shortName}-${now.getFullYear()}-${String(n).padStart(5, '0')}`,
        learnerId: l.id, structureId: st.id, title: name, items: st.items, discount, discountReason, lateFee: 0,
        dueDate: st.dueDate, issuedOn: daysFrom(now, dueOffset - 30), payments: [],
      }
      const p = rand()
      const paidAt = (k: number) => `${daysFrom(now, dueOffset - int(0, 25) + k)}T${String(int(9, 20)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`
      const pay = (amount: number, k = 0) => {
        const method = pick(methods)
        inv.payments.push({ id: `${inv.id}-p${inv.payments.length + 1}`, amount, method, reference: method === 'CASH' ? `RCPT-${int(10000, 99999)}` : `${method.slice(0, 3)}${int(100000000, 999999999)}`, at: paidAt(k), receivedBy: method === 'CASH' || method === 'CHEQUE' ? 'Accounts office' : 'Online gateway' })
      }
      if (net <= 0) { /* fully waived */ }
      else if (p < 0.66) pay(net)
      else if (p < 0.82) { const first = roundTo(net * 0.5, 100); pay(first); if (rand() < 0.3) pay(roundTo(net * 0.2, 100), 20) }
      else if (p < 0.9) { inv.lateFee = tenant.country === 'IN' ? 500 : 100 }
      db.invoices.push(inv)
    }
  })
}

// ---------------- Admissions ----------------
const STAGE_MIX: AdmissionStage[] = [
  'ENQUIRY', 'ENQUIRY', 'ENQUIRY', 'ENQUIRY', 'ENQUIRY', 'ENQUIRY', 'ENQUIRY', 'APPLIED', 'APPLIED', 'APPLIED', 'APPLIED', 'APPLIED', 'APPLIED',
  'DOCS_VERIFIED', 'DOCS_VERIFIED', 'DOCS_VERIFIED', 'DOCS_VERIFIED', 'ASSESSMENT', 'ASSESSMENT', 'ASSESSMENT', 'OFFERED', 'OFFERED', 'OFFERED',
  'ACCEPTED', 'ACCEPTED', 'REJECTED', 'REJECTED',
]
const ORDER: AdmissionStage[] = ['ENQUIRY', 'APPLIED', 'DOCS_VERIFIED', 'ASSESSMENT', 'OFFERED', 'ACCEPTED', 'ENROLLED']

export const DOCS_FOR: Record<string, string[]> = {
  SCHOOL: ['Birth certificate', 'Aadhaar / ID proof', 'Address proof', 'Previous report card', 'Transfer certificate', 'Passport-size photo'],
  COLLEGE: ['Class 12 marksheet', 'Entrance scorecard (JEE / MHT-CET)', 'Aadhaar', 'Category certificate', 'Migration certificate'],
  UNIVERSITY: ['Academic transcripts', 'Passport copy', 'English proficiency (IELTS / TOEFL)', 'Statement of purpose', 'Two recommendation letters'],
}

function seedAdmissions(db: Db, tenant: Tenant, now: Date, pool: { f: string[]; m: string[]; last: string[] }) {
  const programs = db.programs.filter((p) => p.tenantId === tenant.id)
  const targets = tenant.id === 'gps' ? programs.filter((p) => ['LKG', 'G1', 'G6', 'G9', 'G11'].includes(p.code)) : tenant.id === 'iit' ? programs : programs
  const docs = DOCS_FOR[tenant.type] ?? DOCS_FOR.SCHOOL
  const categories = tenant.country === 'IN'
    ? (tenant.type === 'SCHOOL' ? ['GENERAL', 'GENERAL', 'GENERAL', 'OBC', 'OBC', 'SC', 'ST', 'EWS', 'RTE'] : ['GENERAL', 'GENERAL', 'OBC', 'OBC', 'SC', 'ST', 'EWS', 'TFWS'])
    : ['INTERNATIONAL', 'INTERNATIONAL', 'DOMESTIC', 'GCC NATIONAL']
  const sources: Application['source'][] = ['Website', 'Website', 'Website', 'Walk-in', 'Referral', 'Social media', tenant.type === 'UNIVERSITY' ? 'Agent' : 'Education fair']
  const schools = tenant.country === 'IN' ? ['St. Mary’s Convent', 'Kendriya Vidyalaya No. 2', 'DPS East', 'Little Flower Nursery', 'Sri Chaitanya Jr. College', 'National Public School'] : ['GEMS Wellington', 'Dubai College', 'Delhi Private School Sharjah', 'British School Muscat', 'King’s College Lagos']
  STAGE_MIX.forEach((stage, i) => {
    const gender = rand() < 0.5 ? 'F' : 'M'
    const first = pick(gender === 'F' ? pool.f : pool.m)
    const last = pick(pool.last)
    const program = targets[i % targets.length]
    const created = daysFrom(now, -int(1, 60) - ORDER.indexOf(stage === 'REJECTED' ? 'ASSESSMENT' : stage) * 6)
    const ageBase = { PRE_PRIMARY: 3, PRIMARY: 5, MIDDLE: 10, SECONDARY: 13, SENIOR_SECONDARY: 15, UG: 17, PG: 22, PHD: 24, DIPLOMA: 16, VOCATIONAL: 17 }[program.level]
    const stageIdx = ORDER.indexOf(stage)
    const guardian = `${pick(pool.m)} ${last}`
    const app: Application = {
      id: `${tenant.id}-app-${i + 1}`, tenantId: tenant.id, number: `${tenant.shortName}/ADM/${now.getFullYear() + (tenant.type === 'SCHOOL' ? 1 : 0)}/${String(i + 101).padStart(4, '0')}`,
      applicantName: `${first} ${last}`, dob: iso(new Date(now.getFullYear() - ageBase - int(0, 1), int(0, 11), int(1, 28))), gender, programId: program.id, stage,
      category: pick(categories), source: pick(sources), guardianName: ['UG', 'PG', 'PHD'].includes(program.level) ? `${first} ${last}` : guardian,
      phone: tenant.country === 'IN' ? `+91 9${int(100000000, 999999999)}` : `+971 5${int(10000000, 99999999)}`,
      email: `${first.toLowerCase().replace(/\s/g, '')}.${last.toLowerCase().replace(/\s/g, '')}${i}@mail.example`,
      previousSchool: pick(schools),
      score: stageIdx >= 3 || stage === 'REJECTED' ? int(stage === 'REJECTED' ? 28 : 55, stage === 'REJECTED' ? 48 : 97) : undefined,
      documents: docs.map((name) => ({ name, verified: stageIdx >= 2 || (stage === 'APPLIED' && rand() < 0.4) || stage === 'REJECTED' })),
      notes: stage === 'ENQUIRY' ? [] : [{ at: `${created}T11:00:00`, by: 'Admissions office', text: stage === 'REJECTED' ? 'Did not meet the assessment cut-off.' : 'Application form complete; follow-up call done.' }],
      createdAt: `${created}T10:00:00`, updatedAt: `${daysFrom(now, -int(0, 6))}T10:00:00`,
    }
    db.applications.push(app)
  })
}

// ---------------- Communication ----------------
function seedCommunication(db: Db, now: Date) {
  const at = (d: number, h = 9) => `${daysFrom(now, d)}T${String(h).padStart(2, '0')}:30:00`
  const ann = (tenantId: string, i: number, title: string, body: string, audienceRoles: Db['announcements'][number]['audienceRoles'], authorId: string, d: number, pinned = false, channels: Db['announcements'][number]['channels'] = ['APP', 'EMAIL']) => {
    const author = db.users.find((u) => u.id === authorId)!
    db.announcements.push({ id: `${tenantId}-ann-${i}`, tenantId, title, body, audienceRoles, sectionIds: [], channels, authorId, authorName: author.name, pinned, createdAt: at(d), readBy: [] })
  }
  const ALL: ('INST_ADMIN' | 'FACULTY' | 'STUDENT' | 'GUARDIAN')[] = ['INST_ADMIN', 'FACULTY', 'STUDENT', 'GUARDIAN']
  ann('gps', 1, 'Annual Sports Day — 6 December', 'Our Annual Sports Day will be held on the main ground from 8:30 am. Students should report in house T-shirts. Parents are warmly invited; seating opens at 8 am.', ALL, 'u-gps-admin', -1, true, ['APP', 'EMAIL', 'SMS', 'WHATSAPP'])
  ann('gps', 2, 'Periodic Test 2 marks being entered', 'Class teachers: please complete PT-2 marks entry by Friday. Report cards for PT-2 will be published on the portal next week.', ['FACULTY', 'INST_ADMIN'], 'u-gps-admin', -2)
  ann('gps', 3, 'Parent–Teacher Meeting on Saturday', 'PTM for Grades 1–10 is on Saturday, 9 am – 12 pm. Please book a slot with the class teacher through the app. Half-Yearly answer scripts will be shown.', ['GUARDIAN', 'STUDENT'], 'u-gps-admin', -4, false, ['APP', 'SMS', 'WHATSAPP'])
  ann('gps', 4, 'Term 2 fee reminder', 'Term 2 fees were due last month. A late fee applies to unpaid invoices. Pay online by UPI, card or net banking from the Fees section.', ['GUARDIAN'], 'u-gps-admin', -8, false, ['APP', 'EMAIL', 'SMS'])
  ann('gps', 5, 'Winter uniform from 1 December', 'Students may switch to the winter uniform (navy blazer and sweater) from 1 December.', ['STUDENT', 'GUARDIAN'], 'u-gps-admin', -12)
  ann('iit', 1, 'Mid-semester results published', 'Mid-semester and Internal Assessment 1 results are now available under Results. Re-evaluation requests close in 7 days.', ['STUDENT', 'GUARDIAN', 'FACULTY'], 'u-iit-admin', -3, true)
  ann('iit', 2, 'Campus placement drive — Week 49', 'Twelve companies are visiting for final-year placements. Register on the placement portal and keep your resume updated.', ['STUDENT', 'FACULTY'], 'u-iit-admin', -5)
  ann('iit', 3, 'Smart India Hackathon internal round', 'Form teams of six (at least one woman member) and submit problem statements by the 30th.', ['STUDENT'], 'u-iit-faculty', -9)
  ann('iit', 4, 'End-semester examination timetable', 'End-semester exams begin in about three weeks. Hall tickets will be issued only to students with ≥ 75% attendance and no fee dues.', ['STUDENT', 'GUARDIAN', 'FACULTY'], 'u-iit-admin', -1)
  ann('mru', 1, 'Doctoral progress reports due', 'All PhD scholars must submit their six-monthly progress report to their supervisor before the DRC meeting on the 15th.', ['STUDENT', 'FACULTY'], 'u-mru-admin', -2, true)
  ann('mru', 2, 'Library extended hours during finals', 'The library is open 24/7 from next week until the end of the final examination period.', ALL, 'u-mru-admin', -4)
  ann('mru', 3, 'Fall convocation registration', 'Graduating students: register for the fall convocation ceremony. Gowns can be collected from Student Services.', ['STUDENT', 'GUARDIAN'], 'u-mru-admin', -10)

  const thread = (tenantId: string, i: number, subject: string, parts: string[], msgs: [string, string, number][]) =>
    db.threads.push({
      id: `${tenantId}-th-${i}`, tenantId, subject, participantIds: parts,
      messages: msgs.map(([authorId, body, d], k) => ({ id: `${tenantId}-th-${i}-m${k}`, authorId, body, at: at(d, 10 + k) })),
      readBy: Object.fromEntries(parts.map((p) => {
        const k = msgs.map((m) => m[0]).lastIndexOf(p)
        return [p, k >= 0 ? at(msgs[k][2], 10 + k) : at(-30)]
      })),
    })
  thread('gps', 1, 'Arjun’s maths homework', ['u-gps-parent', 'u-gps-faculty'], [
    ['u-gps-parent', 'Good evening ma’am, Arjun found the fractions worksheet difficult. Could you suggest some practice at home?', -3],
    ['u-gps-faculty', 'Thank you for writing. I’ve shared two extra worksheets in his folder. Pizza-slice examples work well for him!', -2],
    ['u-gps-parent', 'That’s very helpful, thank you. We’ll practise this weekend.', -2],
  ])
  thread('gps', 2, 'PT-2 marks entry', ['u-gps-admin', 'u-gps-faculty'], [
    ['u-gps-admin', 'Please complete PT-2 marks for your sections by Friday so we can publish on Monday.', -1],
  ])
  thread('iit', 1, 'Major project topic approval', ['u-iit-student', 'u-iit-faculty'], [
    ['u-iit-student', 'Sir, our team would like to work on a crop-disease detection app using on-device ML. Can we discuss scope?', -6],
    ['u-iit-faculty', 'Good idea. Bring a one-page proposal with the dataset you plan to use on Thursday at 3 pm.', -5],
  ])
  thread('mru', 1, 'Synopsis draft feedback', ['u-mru-scholar', 'u-mru-faculty'], [
    ['u-mru-scholar', 'Dear Professor, I have uploaded the revised synopsis with the related-work section expanded.', -4],
    ['u-mru-faculty', 'Thanks — the problem statement is much sharper. Please add a threat model before we take it to the DRC.', -3],
    ['u-mru-scholar', 'Will do. I’ll send the updated version by Sunday.', -3],
  ])
}

// ---------------- Library ----------------
const CHILDREN_BOOKS: [string, string, string][] = [
  ['Panchatantra Stories', 'Vishnu Sharma (retold)', 'Folk tales'], ['Malgudi Days', 'R. K. Narayan', 'Fiction'], ['The Blue Umbrella', 'Ruskin Bond', 'Fiction'],
  ['Tenali Raman Tales', 'Anonymous (retold)', 'Folk tales'], ['Alice’s Adventures in Wonderland', 'Lewis Carroll', 'Classics'], ['The Jungle Book', 'Rudyard Kipling', 'Classics'],
  ['Charlotte’s Web', 'E. B. White', 'Fiction'], ['Matilda', 'Roald Dahl', 'Fiction'], ['Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography'],
  ['The Diary of a Young Girl', 'Anne Frank', 'Biography'], ['Gitanjali', 'Rabindranath Tagore', 'Poetry'], ['NCERT Mathematics Exemplar — Class 10', 'NCERT', 'Reference'],
  ['Concepts of Physics Vol. 1', 'H. C. Verma', 'Reference'], ['Oxford Student Atlas for India', 'Oxford University Press', 'Reference'], ['Wonders of Space', 'National Geographic Kids', 'Science'],
  ['A Brief History of Time', 'Stephen Hawking', 'Science'], ['Swami and Friends', 'R. K. Narayan', 'Fiction'], ['Godaan', 'Munshi Premchand', 'Hindi literature'],
  ['Little Women', 'Louisa May Alcott', 'Classics'], ['The Story of My Life', 'Helen Keller', 'Biography'],
]
const ENGG_BOOKS: [string, string, string][] = [
  ['Introduction to Algorithms', 'Cormen, Leiserson, Rivest, Stein', 'Computer Science'], ['Operating System Concepts', 'Silberschatz, Galvin, Gagne', 'Computer Science'],
  ['Database System Concepts', 'Silberschatz, Korth, Sudarshan', 'Computer Science'], ['Computer Networks', 'Andrew S. Tanenbaum', 'Computer Science'],
  ['Compilers: Principles, Techniques, and Tools', 'Aho, Lam, Sethi, Ullman', 'Computer Science'], ['Pattern Recognition and Machine Learning', 'Christopher Bishop', 'Computer Science'],
  ['Deep Learning', 'Goodfellow, Bengio, Courville', 'Computer Science'], ['Microelectronic Circuits', 'Sedra & Smith', 'Electronics'],
  ['Signals and Systems', 'Oppenheim & Willsky', 'Electronics'], ['Digital Design', 'M. Morris Mano', 'Electronics'], ['Communication Systems', 'Simon Haykin', 'Electronics'],
  ['Engineering Thermodynamics', 'P. K. Nag', 'Mechanical'], ['Fluid Mechanics', 'Frank M. White', 'Mechanical'], ['Design of Machine Elements', 'V. B. Bhandari', 'Mechanical'],
  ['Higher Engineering Mathematics', 'B. S. Grewal', 'Mathematics'], ['Engineering Physics', 'Gaur & Gupta', 'Physics'], ['Clean Code', 'Robert C. Martin', 'Computer Science'],
  ['The Pragmatic Programmer', 'Hunt & Thomas', 'Computer Science'], ['Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography'], ['Engineering Drawing', 'N. D. Bhatt', 'Mechanical'],
]
const UNI_BOOKS: [string, string, string][] = [
  ['Artificial Intelligence: A Modern Approach', 'Russell & Norvig', 'Computer Science'], ['The Elements of Statistical Learning', 'Hastie, Tibshirani, Friedman', 'Data Science'],
  ['Designing Data-Intensive Applications', 'Martin Kleppmann', 'Computer Science'], ['Distributed Systems', 'van Steen & Tanenbaum', 'Computer Science'],
  ['Speech and Language Processing', 'Jurafsky & Martin', 'Computer Science'], ['Probability Theory: The Logic of Science', 'E. T. Jaynes', 'Mathematics'],
  ['Linear Algebra Done Right', 'Sheldon Axler', 'Mathematics'], ['Introduction to Solid State Physics', 'Charles Kittel', 'Physics'],
  ['Modern Quantum Mechanics', 'Sakurai & Napolitano', 'Physics'], ['Classical Electrodynamics', 'J. D. Jackson', 'Physics'],
  ['Solar Energy Engineering', 'Kalogirou', 'Physics'], ['The Craft of Research', 'Booth, Colomb, Williams', 'Research methods'],
  ['How to Write a Thesis', 'Umberto Eco', 'Research methods'], ['Research Design', 'John W. Creswell', 'Research methods'],
  ['The Muqaddimah', 'Ibn Khaldun', 'History'], ['Season of Migration to the North', 'Tayeb Salih', 'Arabic literature'],
  ['Weapons of Math Destruction', 'Cathy O’Neil', 'Data Science'], ['Thinking, Fast and Slow', 'Daniel Kahneman', 'Psychology'],
  ['Introduction to Algorithms', 'Cormen, Leiserson, Rivest, Stein', 'Computer Science'], ['Statistical Rethinking', 'Richard McElreath', 'Data Science'],
]

function seedLibrary(db: Db, tenant: Tenant, now: Date) {
  const list = tenant.id === 'gps' ? CHILDREN_BOOKS : tenant.id === 'iit' ? ENGG_BOOKS : UNI_BOOKS
  const books: Book[] = list.map(([title, author, category], i) => ({
    id: `${tenant.id}-bk-${i + 1}`, tenantId: tenant.id, isbn: `978-${int(0, 9)}-${int(100, 999)}-${int(10000, 99999)}-${int(0, 9)}`,
    title, author, category, year: int(1950, 2024), shelf: `${String.fromCharCode(65 + (i % 8))}-${int(1, 12)}`, copies: int(2, 6),
    forLevels: tenant.id === 'gps' ? (['Reference', 'Science', 'Biography'].includes(category) ? 'GENERAL' : 'CHILDREN') : 'ACADEMIC',
  }))
  db.books.push(...books)
  const learners = db.learners.filter((l) => l.tenantId === tenant.id && l.level !== 'PRE_PRIMARY')
  const demoLearnerIds = db.users.filter((u) => u.tenantId === tenant.id && u.role === 'STUDENT').map((u) => u.personId!)
  let n = 0
  for (const b of books) {
    const out = int(0, Math.min(3, b.copies))
    for (let k = 0; k < out; k++) {
      n++
      const borrower: Learner = n <= demoLearnerIds.length ? learners.find((l) => l.id === demoLearnerIds[n - 1])! : pick(learners)
      const issued = -int(2, 30)
      db.loans.push({ id: `${tenant.id}-ln-${n}`, tenantId: tenant.id, bookId: b.id, borrowerId: borrower.id, borrowerType: 'LEARNER', issuedOn: daysFrom(now, issued), dueOn: daysFrom(now, issued + 14) })
    }
    // a few historical returns
    if (rand() < 0.5) {
      n++
      const issued = -int(40, 90)
      db.loans.push({ id: `${tenant.id}-ln-${n}`, tenantId: tenant.id, bookId: b.id, borrowerId: pick(learners).id, borrowerType: 'LEARNER', issuedOn: daysFrom(now, issued), dueOn: daysFrom(now, issued + 14), returnedOn: daysFrom(now, issued + int(5, 20)) })
    }
  }
}

const IN_POOL = {
  f: ['Aanya', 'Diya', 'Ishita', 'Kavya', 'Meera', 'Nisha', 'Saanvi', 'Tara', 'Fatima', 'Harleen', 'Sneha', 'Zara', 'Aditi'],
  m: ['Aarav', 'Vihaan', 'Arjun', 'Kabir', 'Rohan', 'Ishaan', 'Karthik', 'Siddharth', 'Imran', 'Gurpreet', 'Pranav', 'Rizwan', 'Yash'],
  last: ['Sharma', 'Iyer', 'Reddy', 'Nair', 'Patel', 'Gupta', 'Khan', 'Singh', 'Das', 'Menon', 'Joshi', 'Kulkarni', 'Rao', 'Mehta'],
}
const INTL_POOL = {
  f: ['Layla', 'Amira', 'Sofia', 'Aisha', 'Elena', 'Hana', 'Maryam', 'Olivia', 'Noor', 'Yuki', 'Zainab', 'Ines'],
  m: ['Omar', 'Yusuf', 'Lucas', 'Hamza', 'Daniel', 'Kenji', 'Ali', 'Mateo', 'Karim', 'Samuel', 'Ibrahim', 'Tariq'],
  last: ['Al Mansoori', 'Haddad', 'Rossi', 'Wang', 'Khan', 'Petrov', 'Tanaka', 'Nasser', 'Okafor', 'Al Hashimi', 'García', 'Rahman'],
}

export function seedPhase2(db: Db, now: Date) {
  rand = mulberry32(7)
  for (const id of ['gps', 'iit', 'mru']) {
    const tenant = db.tenants.find((t) => t.id === id)!
    seedExams(db, tenant, now)
    seedFees(db, tenant, now)
    seedAdmissions(db, tenant, now, tenant.country === 'IN' ? IN_POOL : INTL_POOL)
    seedLibrary(db, tenant, now)
  }
  seedCommunication(db, now)
}
