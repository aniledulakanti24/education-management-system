// Deterministic demo data for three fully populated tenants plus onboarding tenants.
import { seedPhase2 } from './seed-phase2'
import { seedPhase3 } from './seed-phase3'
import { seedPhase3b } from './seed-phase3b'
import type { IssuerKey } from '@/lib/vc'
import type {
  AttendanceSheet, AttendanceStatus, AuditEntry, Course, Learner, LevelCode, Period, Program,
  ResearchProfile, ResearchStage, Section, Staff, Tenant, Term, TimetableSlot, User,
  Application, Assessment, MarkSheet, FeeStructure, Invoice, Announcement, MessageThread, Book, Loan,
  Lesson, Assignment, Submission, Quiz, QuizAttempt, LiveSession, Credential, LedgerBlock, CreditRecord,
} from '@/types'

export interface Db {
  version: number
  tenants: Tenant[]
  users: User[]
  learners: Learner[]
  staff: Staff[]
  programs: Program[]
  courses: Course[]
  sections: Section[]
  terms: Term[]
  slots: TimetableSlot[]
  attendance: AttendanceSheet[]
  research: ResearchProfile[]
  audit: AuditEntry[]
  periods: Record<string, Period[]>
  applications: Application[]
  assessments: Assessment[]
  marks: MarkSheet[]
  feeStructures: FeeStructure[]
  invoices: Invoice[]
  announcements: Announcement[]
  threads: MessageThread[]
  books: Book[]
  loans: Loan[]
  lessons: Lesson[]
  assignments: Assignment[]
  submissions: Submission[]
  quizzes: Quiz[]
  quizAttempts: QuizAttempt[]
  liveSessions: LiveSession[]
  lessonDone: Record<string, string[]>
  credentials: Credential[]
  ledger: LedgerBlock[]
  creditRecords: CreditRecord[]
  issuerKeys: Record<string, IssuerKey>
}

export const DB_VERSION = 9

// ---------- helpers ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let rand = mulberry32(42)
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
const pad = (n: number, w = 3) => String(n).padStart(w, '0')
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1 // Mon=1..Sun=7

const IN_FIRST_F = ['Aanya', 'Diya', 'Ishita', 'Kavya', 'Meera', 'Nisha', 'Priya', 'Riya', 'Saanvi', 'Tara', 'Ananya', 'Pooja', 'Lakshmi', 'Fatima', 'Harleen', 'Sneha', 'Divya', 'Zara', 'Aditi', 'Neha']
const IN_FIRST_M = ['Aarav', 'Vihaan', 'Arjun', 'Kabir', 'Rohan', 'Ishaan', 'Aditya', 'Karthik', 'Rahul', 'Siddharth', 'Varun', 'Imran', 'Gurpreet', 'Manoj', 'Nikhil', 'Pranav', 'Rizwan', 'Tejas', 'Yash', 'Dev']
const IN_LAST = ['Sharma', 'Iyer', 'Reddy', 'Nair', 'Patel', 'Gupta', 'Khan', 'Singh', 'Das', 'Menon', 'Joshi', 'Kulkarni', 'Banerjee', 'Rao', 'Mehta', 'Pillai', 'Chatterjee', 'Fernandes', 'Hegde', 'Shetty']
const INTL_FIRST_F = ['Layla', 'Amira', 'Sofia', 'Chen Wei', 'Aisha', 'Elena', 'Hana', 'Maryam', 'Olivia', 'Priya', 'Noor', 'Yuki', 'Grace', 'Zainab', 'Ines']
const INTL_FIRST_M = ['Omar', 'Yusuf', 'Lucas', 'Arjun', 'Hamza', 'Daniel', 'Kenji', 'Ali', 'Mateo', 'Karim', 'Samuel', 'Ibrahim', 'Leo', 'Rashid', 'Tariq']
const INTL_LAST = ['Al Mansoori', 'Haddad', 'Rossi', 'Wang', 'Khan', 'Petrov', 'Tanaka', 'Nasser', 'Smith', 'Menon', 'Okafor', 'Al Hashimi', 'García', 'Schmidt', 'Rahman']
const INTL_NATIONALITY = ['AE', 'IN', 'EG', 'JO', 'PK', 'GB', 'CN', 'NG', 'IT', 'RU', 'JP', 'ES', 'DE', 'BD', 'LB']

interface NamePool { f: string[]; m: string[]; last: string[] }
const IN_POOL: NamePool = { f: IN_FIRST_F, m: IN_FIRST_M, last: IN_LAST }
const INTL_POOL: NamePool = { f: INTL_FIRST_F, m: INTL_FIRST_M, last: INTL_LAST }

// ---------- builders ----------
interface Ctx {
  db: Db
  tenant: Tenant
  pool: NamePool
  seq: { learner: number; staff: number; course: number }
}

function addProgram(c: Ctx, level: LevelCode, name: string, code: string, durationTerms: number, creditSystem: Program['creditSystem'], department: string): Program {
  const p: Program = { id: `${c.tenant.id}-p-${code.toLowerCase()}`, tenantId: c.tenant.id, level, name, code, durationTerms, creditSystem, department }
  c.db.programs.push(p)
  return p
}

function addCourses(c: Ctx, program: Program, list: [string, number, Course['type'], number?][]) {
  for (const [name, credits, type, semester] of list) {
    c.seq.course++
    const code = program.creditSystem === 'NONE'
      ? `${program.code}-${name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}`
      : `${program.code.replace(/[^A-Z]/g, '').slice(0, 3)}${semester ?? 0}${pad(c.seq.course % 100, 2)}`
    c.db.courses.push({
      id: `${c.tenant.id}-c-${c.seq.course}`,
      tenantId: c.tenant.id,
      programId: program.id,
      code,
      name,
      credits,
      type,
      semester,
      outcomes: [`Explain core concepts of ${name}`, `Apply ${name} to real-world problems`, `Communicate ${name} reasoning clearly`],
    })
  }
}

function addSection(c: Ctx, program: Program, name: string, termLabel: string, room: string, semester?: number): Section {
  const s: Section = {
    id: `${program.id}-s-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    tenantId: c.tenant.id, programId: program.id, name, termLabel, semester, room, capacity: 40,
  }
  c.db.sections.push(s)
  return s
}

function birthDateFor(level: LevelCode, gradeNum: number, now: Date) {
  const baseAge: Record<LevelCode, number> = {
    PRE_PRIMARY: 4, PRIMARY: 5, MIDDLE: 5, SECONDARY: 5, SENIOR_SECONDARY: 5, VOCATIONAL: 17, DIPLOMA: 16, UG: 18, PG: 22, PHD: 25,
  }
  const age = baseAge[level] + gradeNum + (rand() < 0.5 ? 0 : 1)
  return isoDate(new Date(now.getFullYear() - age, int(0, 11), int(1, 28)))
}

function addLearners(c: Ctx, program: Program, section: Section, count: number, gradeNum: number, now: Date) {
  const isIndia = c.tenant.country === 'IN'
  for (let i = 1; i <= count; i++) {
    c.seq.learner++
    const gender: Learner['gender'] = rand() < 0.5 ? 'F' : 'M'
    const first = pick(gender === 'F' ? c.pool.f : c.pool.m)
    const last = pick(c.pool.last)
    const adult = ['UG', 'PG', 'PHD', 'DIPLOMA'].includes(program.level)
    const parentFirst = pick(c.pool.m)
    const motherFirst = pick(c.pool.f)
    const domain = c.tenant.subdomain
    const l: Learner = {
      id: `${c.tenant.id}-l-${pad(c.seq.learner, 4)}`,
      tenantId: c.tenant.id,
      admissionNo: `${c.tenant.shortName}/${now.getFullYear() - Math.min(gradeNum, 4)}/${pad(c.seq.learner, 4)}`,
      firstName: first,
      lastName: last,
      gender,
      dob: birthDateFor(program.level, gradeNum, now),
      level: program.level,
      programId: program.id,
      sectionId: section.id,
      rollNo: i,
      apaarId: isIndia ? `${int(1000, 9999)}${int(1000, 9999)}${int(1000, 9999)}` : undefined,
      abcId: isIndia && adult ? `ABC${int(100000000, 999999999)}` : undefined,
      email: adult ? `${first.toLowerCase().replace(/\s/g, '')}.${last.toLowerCase().replace(/\s/g, '')}${c.seq.learner}@${domain}.edu` : undefined,
      phone: adult ? (isIndia ? `+91 9${int(100000000, 999999999)}` : `+971 5${int(10000000, 99999999)}`) : undefined,
      bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'O-', 'A-', 'B-']),
      address: `${int(1, 250)}, ${pick(isIndia ? ['MG Road', 'Park Street', 'Lake View', 'Nehru Nagar', 'Gandhi Path', 'Hill Colony'] : ['Al Wasl Rd', 'Jumeirah St', 'Marina Walk', 'Al Barsha 1', 'Business Bay'])}, ${c.tenant.city}`,
      nationality: isIndia ? 'IN' : pick(INTL_NATIONALITY),
      guardians: program.level === 'PHD'
        ? []
        : [
            { name: `${parentFirst} ${last}`, relation: 'Father', phone: isIndia ? `+91 98${int(10000000, 99999999)}` : `+971 50${int(1000000, 9999999)}`, email: `${parentFirst.toLowerCase().replace(/\s/g, '')}.${c.seq.learner}@mail.example` },
            { name: `${motherFirst} ${last}`, relation: 'Mother', phone: isIndia ? `+91 99${int(10000000, 99999999)}` : `+971 55${int(1000000, 9999999)}`, email: `${motherFirst.toLowerCase().replace(/\s/g, '')}.${c.seq.learner}@mail.example` },
          ],
      status: 'ACTIVE',
      enrolledOn: isoDate(new Date(now.getFullYear() - Math.min(gradeNum, 4), 5, 1)),
    }
    c.db.learners.push(l)
  }
}

function addStaff(c: Ctx, designation: string, department: string, qualification: string, subjects: string[], isSupervisor = false, now = new Date()): Staff {
  c.seq.staff++
  const female = rand() < 0.55
  const name = `${female ? pick(c.pool.f) : pick(c.pool.m)} ${pick(c.pool.last)}`
  const s: Staff = {
    id: `${c.tenant.id}-st-${pad(c.seq.staff)}`,
    tenantId: c.tenant.id,
    employeeNo: `${c.tenant.shortName}-EMP-${pad(c.seq.staff)}`,
    name: designation.startsWith('Prof') || designation.includes('Professor') ? `Dr. ${name}` : name,
    email: `${name.split(' ')[0].toLowerCase()}.${c.seq.staff}@${c.tenant.subdomain}.edu`,
    phone: c.tenant.country === 'IN' ? `+91 97${int(10000000, 99999999)}` : `+971 52${int(1000000, 9999999)}`,
    designation,
    department,
    qualification,
    courseIds: [],
    isSupervisor,
    joinedOn: isoDate(new Date(now.getFullYear() - int(1, 15), int(0, 11), 1)),
  }
  // subjects are matched against course names when assigning
  ;(s as Staff & { _subjects?: string[] })._subjects = subjects
  c.db.staff.push(s)
  return s
}

function buildTimetable(c: Ctx, daysPerWeek: number[], periodsPerDay: number) {
  const tStaff = c.db.staff.filter((s) => s.tenantId === c.tenant.id) as (Staff & { _subjects?: string[] })[]
  const busy = new Set<string>()
  const sections = c.db.sections.filter((s) => s.tenantId === c.tenant.id)
  for (const section of sections) {
    const courses = c.db.courses.filter(
      (co) => co.programId === section.programId && (section.semester === undefined || co.semester === section.semester),
    )
    if (!courses.length) continue
    let k = 0
    for (const day of daysPerWeek) {
      for (let period = 1; period <= periodsPerDay; period++) {
        const course = courses[(k + day) % courses.length]
        k++
        const subjectMatch = (s: Staff & { _subjects?: string[] }) =>
          (s._subjects ?? []).some((sub) => course.name.toLowerCase().includes(sub.toLowerCase()))
        const free = (s: Staff) => !busy.has(`${s.id}|${day}|${period}`)
        const teacher = tStaff.find((s) => subjectMatch(s) && free(s)) ?? tStaff.find((s) => free(s) && s.designation !== 'Principal')
        if (!teacher) continue
        busy.add(`${teacher.id}|${day}|${period}`)
        if (!teacher.courseIds.includes(course.id)) teacher.courseIds.push(course.id)
        c.db.slots.push({
          id: `${section.id}-${day}-${period}`,
          tenantId: c.tenant.id,
          sectionId: section.id,
          day,
          period,
          courseId: course.id,
          staffId: teacher.id,
          room: course.type === 'LAB' ? `Lab ${int(1, 6)}` : section.room,
        })
      }
    }
    // class teacher / programme coordinator = most frequent teacher in that section
    const counts = new Map<string, number>()
    c.db.slots.filter((sl) => sl.sectionId === section.id).forEach((sl) => counts.set(sl.staffId, (counts.get(sl.staffId) ?? 0) + 1))
    section.classTeacherId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  }
}

function buildAttendance(c: Ctx, now: Date, days: number) {
  const learners = c.db.learners.filter((l) => l.tenantId === c.tenant.id && l.level !== 'PHD')
  const propensity = new Map<string, number>()
  learners.forEach((l) => propensity.set(l.id, rand() < 0.12 ? 0.55 + rand() * 0.2 : 0.82 + rand() * 0.17))
  const bySection = new Map<string, Learner[]>()
  learners.forEach((l) => bySection.set(l.sectionId, [...(bySection.get(l.sectionId) ?? []), l]))
  const d = new Date(now)
  let produced = 0
  while (produced < days) {
    d.setDate(d.getDate() - 1)
    if (!c.tenant.weekDays.includes(isoWeekday(d))) continue
    produced++
    const date = isoDate(d)
    for (const [sectionId, list] of bySection) {
      const marks: Record<string, AttendanceStatus> = {}
      for (const l of list) {
        const r = rand()
        const p = propensity.get(l.id)!
        marks[l.id] = r < p ? (rand() < 0.04 ? 'L' : 'P') : rand() < 0.2 ? 'E' : 'A'
      }
      const section = c.db.sections.find((s) => s.id === sectionId)
      c.db.attendance.push({
        id: `${sectionId}|${date}`, tenantId: c.tenant.id, sectionId, date, marks,
        markedBy: section?.classTeacherId ?? 'system', markedAt: `${date}T09:10:00`,
      })
    }
  }
}

function addResearch(c: Ctx, now: Date) {
  const supervisors = c.db.staff.filter((s) => s.tenantId === c.tenant.id && s.isSupervisor)
  const scholars = c.db.learners.filter((l) => l.tenantId === c.tenant.id && l.level === 'PHD')
  const topicsCS = [
    'Federated learning for privacy-preserving healthcare diagnostics',
    'Low-resource machine translation for Gulf Arabic dialects',
    'Energy-efficient scheduling for edge AI devices',
    'Explainable models for student dropout prediction',
    'Graph neural networks for smart-grid fault detection',
    'Verifiable credentials on permissioned ledgers',
    'Robust multimodal learning under distribution shift',
    'Secure multi-party computation for e-governance',
  ]
  const topicsPhy = [
    'Perovskite thin films for desert-climate photovoltaics',
    'Quantum transport in 2D heterostructures',
    'Atmospheric aerosols and solar irradiance in the UAE',
    'Topological phases in cold-atom lattices',
    'Dust-resilient optics for concentrated solar power',
    'Machine-learning potentials for battery materials',
    'Neutrino detection with liquid scintillators',
    'Plasma diagnostics for compact fusion devices',
  ]
  const stages: ResearchStage[] = ['COURSEWORK', 'SYNOPSIS', 'DATA_COLLECTION', 'WRITING', 'PRE_SUBMISSION', 'UNDER_REVIEW', 'VIVA']
  scholars.forEach((l, i) => {
    const prog = c.db.programs.find((p) => p.id === l.programId)!
    const isCS = prog.code.includes('CS')
    const pool = supervisors.filter((s) => (isCS ? s.department.includes('Computer') : s.department.includes('Physics')))
    const sup = pool[i % Math.max(pool.length, 1)] ?? supervisors[0]
    const stage = stages[i % stages.length]
    const regYear = now.getFullYear() - Math.min(1 + Math.floor(stages.indexOf(stage) / 2), 4)
    const stageIdx = stages.indexOf(stage)
    const ms = [
      'Coursework completed', 'Synopsis approved by DRC', 'Ethics clearance', 'Six-monthly progress report',
      'First journal paper', 'Pre-submission seminar', 'Thesis submission',
    ].map((label, j) => ({
      label,
      due: isoDate(new Date(regYear, 8 + j * 6, 15)),
      done: j < stageIdx + (j === 3 ? 1 : 0),
    }))
    c.db.research.push({
      learnerId: l.id, tenantId: c.tenant.id, supervisorId: sup.id,
      coSupervisorId: rand() < 0.4 ? supervisors.find((s) => s.id !== sup.id)?.id : undefined,
      topic: (isCS ? topicsCS : topicsPhy)[i % 8],
      area: isCS ? pick(['Artificial Intelligence', 'Distributed Systems', 'Security & Privacy', 'NLP']) : pick(['Condensed Matter', 'Renewable Energy', 'Quantum Physics', 'Atmospheric Physics']),
      stage, registeredOn: isoDate(new Date(regYear, 7, 20)), publications: Math.max(0, stageIdx - 2 + int(0, 2)), milestones: ms,
    })
  })
}

const SCHOOL_PERIODS: Period[] = [
  { no: 1, start: '08:30', end: '09:15' }, { no: 2, start: '09:15', end: '10:00' }, { no: 3, start: '10:20', end: '11:05' },
  { no: 4, start: '11:05', end: '11:50' }, { no: 5, start: '12:30', end: '13:15' }, { no: 6, start: '13:15', end: '14:00' },
]
const COLLEGE_PERIODS: Period[] = [
  { no: 1, start: '09:00', end: '10:00' }, { no: 2, start: '10:00', end: '11:00' }, { no: 3, start: '11:15', end: '12:15' },
  { no: 4, start: '12:15', end: '13:15' }, { no: 5, start: '14:00', end: '15:00' }, { no: 6, start: '15:00', end: '16:00' },
]

// ---------- tenants ----------
function seedGreenfield(db: Db, now: Date) {
  const tenant: Tenant = {
    id: 'gps', name: 'Greenfield Public School', shortName: 'GPS', type: 'SCHOOL',
    levels: ['PRE_PRIMARY', 'PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'],
    framework: 'CBSE', country: 'IN', city: 'Bengaluru', region: 'IN', currency: 'INR', defaultLanguage: 'en',
    timezone: 'Asia/Kolkata', weekDays: [1, 2, 3, 4, 5, 6], brandColor: '#16a34a', subdomain: 'greenfield',
    plan: 'GROWTH', status: 'ACTIVE', createdAt: '2024-03-12',
  }
  db.tenants.push(tenant)
  db.periods[tenant.id] = SCHOOL_PERIODS
  const c: Ctx = { db, tenant, pool: IN_POOL, seq: { learner: 0, staff: 0, course: 0 } }
  db.terms.push(
    { id: 'gps-t1', tenantId: 'gps', name: `Term 1 ${now.getFullYear()}–${String(now.getFullYear() + 1).slice(2)}`, start: `${now.getFullYear()}-04-01`, end: `${now.getFullYear()}-09-30`, current: false },
    { id: 'gps-t2', tenantId: 'gps', name: `Term 2 ${now.getFullYear()}–${String(now.getFullYear() + 1).slice(2)}`, start: `${now.getFullYear()}-10-01`, end: `${now.getFullYear() + 1}-03-31`, current: true },
  )

  addStaff(c, 'Principal', 'Administration', 'M.Ed, PhD', [])
  const teacherSpecs: [string, string[]][] = [
    ['Mathematics', ['Mathematics', 'Numbers']], ['Mathematics', ['Mathematics']], ['Science', ['Science', 'EVS']],
    ['Physics', ['Physics', 'Science']], ['Chemistry', ['Chemistry', 'Science']], ['Biology', ['Biology', 'EVS']],
    ['English', ['English']], ['English', ['English', 'Story']], ['Hindi', ['Hindi', 'Sanskrit']], ['Hindi', ['Hindi']],
    ['Social Science', ['Social']], ['Computer Science', ['Computer', 'Artificial']], ['Arts', ['Art', 'Play', 'Music']],
    ['Pre-Primary', ['Story', 'Numbers', 'Play', 'EVS']], ['Physical Education', ['Physical', 'Play']], ['Mathematics', ['Mathematics', 'Numbers']],
  ]
  // ~40 teachers for 28 sections × 36 periods (≈25 periods each)
  ;[...teacherSpecs, ...teacherSpecs, ...teacherSpecs.slice(1, 9)].forEach(([dept, subs], i) => addStaff(c, i % 5 === 0 ? 'PGT' : i % 3 === 0 ? 'TGT' : 'Teacher', dept, pick(['B.Ed, M.Sc', 'B.Ed, M.A', 'B.Ed, B.Sc', 'M.Ed, M.Sc']), subs))

  const grades: { label: string; code: string; level: LevelCode; num: number; subjects: string[] }[] = [
    { label: 'LKG', code: 'LKG', level: 'PRE_PRIMARY', num: 0, subjects: ['Story Time & English', 'Numbers & Shapes', 'EVS — My World', 'Art & Play'] },
    { label: 'UKG', code: 'UKG', level: 'PRE_PRIMARY', num: 1, subjects: ['Story Time & English', 'Numbers & Shapes', 'EVS — My World', 'Art & Play'] },
  ]
  for (let g = 1; g <= 12; g++) {
    const level: LevelCode = g <= 5 ? 'PRIMARY' : g <= 8 ? 'MIDDLE' : g <= 10 ? 'SECONDARY' : 'SENIOR_SECONDARY'
    const subjects =
      g <= 5 ? ['English', 'Hindi', 'Mathematics', 'EVS', 'Computer Basics', 'Art & Music', 'Physical Education']
      : g <= 8 ? ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Sanskrit', 'Computer Science']
      : g <= 10 ? ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Artificial Intelligence (Skill)']
      : ['English Core', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'Physical Education']
    grades.push({ label: g <= 10 ? `Grade ${g}` : `Grade ${g} — Science`, code: `G${g}`, level, num: g, subjects })
  }
  let room = 101
  for (const gr of grades) {
    const p = addProgram(c, gr.level, gr.label, gr.code, 1, 'NONE', 'School')
    addCourses(c, p, gr.subjects.map((s) => [s, 0, s.includes('Art') || s.includes('Physical') ? 'ACTIVITY' : 'CORE'] as [string, number, Course['type']]))
    for (const sec of ['A', 'B']) {
      const s = addSection(c, p, `${gr.code}-${sec}`, 'Term 2', `Room ${room++}`)
      addLearners(c, p, s, 7, gr.num, now)
    }
  }
  buildTimetable(c, tenant.weekDays, 6)
  buildAttendance(c, now, 22)
}

function seedIndus(db: Db, now: Date) {
  const tenant: Tenant = {
    id: 'iit', name: 'Indus Institute of Technology', shortName: 'IIT', type: 'COLLEGE',
    levels: ['UG', 'PG'], framework: 'AICTE_CBCS', country: 'IN', city: 'Pune', region: 'IN', currency: 'INR',
    defaultLanguage: 'en', timezone: 'Asia/Kolkata', weekDays: [1, 2, 3, 4, 5, 6], brandColor: '#2563eb',
    subdomain: 'indus', plan: 'ENTERPRISE', status: 'ACTIVE', createdAt: '2023-07-01',
  }
  db.tenants.push(tenant)
  db.periods[tenant.id] = COLLEGE_PERIODS
  const c: Ctx = { db, tenant, pool: IN_POOL, seq: { learner: 0, staff: 0, course: 0 } }
  const y = now.getFullYear()
  db.terms.push({ id: 'iit-t1', tenantId: 'iit', name: `Odd Semester ${y}–${String(y + 1).slice(2)}`, start: `${y}-08-01`, end: `${y}-12-15`, current: true },
    { id: 'iit-t2', tenantId: 'iit', name: `Even Semester ${y}–${String(y + 1).slice(2)}`, start: `${y + 1}-01-05`, end: `${y + 1}-05-31`, current: false })

  addStaff(c, 'Director', 'Administration', 'PhD (IIT Bombay)', [])
  const fac: [string, string, string[]][] = [
    ['Professor & HoD', 'Computer Science & Engg', ['Data Structures', 'Algorithms', 'Machine Learning']],
    ['Associate Professor', 'Computer Science & Engg', ['Operating', 'Database', 'Cloud']],
    ['Assistant Professor', 'Computer Science & Engg', ['Programming', 'Web', 'Compiler']],
    ['Assistant Professor', 'Computer Science & Engg', ['Networks', 'Security', 'Deep Learning']],
    ['Professor & HoD', 'Electronics & Communication', ['Signals', 'Communication', 'VLSI']],
    ['Assistant Professor', 'Electronics & Communication', ['Digital', 'Analog', 'Embedded', 'Microprocessor']],
    ['Professor & HoD', 'Mechanical Engineering', ['Thermodynamics', 'Fluid', 'Heat']],
    ['Assistant Professor', 'Mechanical Engineering', ['Mechanics', 'Manufacturing', 'Machine Design', 'Robotics']],
    ['Associate Professor', 'Applied Sciences', ['Mathematics', 'Physics', 'Chemistry']],
    ['Assistant Professor', 'Applied Sciences', ['Engineering Graphics', 'Mathematics', 'Communication Skills']],
    ['Assistant Professor', 'Humanities', ['Environmental', 'Economics', 'Ethics', 'Communication Skills']],
    ['Associate Professor', 'Computer Science & Engg', ['Research Methodology', 'Advanced Algorithms', 'Natural Language']],
  ]
  // 18 faculty for 14 sections × 36 periods
  ;[...fac, ...fac.slice(1, 7).map(([, dept, subs]) => ['Assistant Professor', dept, subs] as [string, string, string[]])].forEach(([d, dept, subs]) => addStaff(c, d, dept, pick(['PhD', 'M.Tech, PhD', 'M.E., PhD (pursuing)']), subs, d.includes('Professor') && !d.startsWith('Assistant')))

  const firstYear: [string, number, Course['type'], number][] = [
    ['Engineering Mathematics I', 4, 'CORE', 1], ['Engineering Physics', 3, 'CORE', 1], ['Programming for Problem Solving', 3, 'CORE', 1],
    ['Engineering Graphics & Design', 2, 'LAB', 1], ['Communication Skills', 2, 'CORE', 1], ['Programming Lab', 1, 'LAB', 1],
  ]
  const programs: { name: string; code: string; dept: string; courses: [string, number, Course['type'], number][] }[] = [
    { name: 'B.Tech Computer Science & Engineering', code: 'BTCSE', dept: 'Computer Science & Engg', courses: [
      ...firstYear,
      ['Data Structures', 4, 'CORE', 3], ['Digital Logic Design', 3, 'CORE', 3], ['Discrete Mathematics', 4, 'CORE', 3], ['Object-Oriented Programming Lab', 2, 'LAB', 3], ['Environmental Science', 2, 'CORE', 3],
      ['Operating Systems', 4, 'CORE', 5], ['Database Management Systems', 4, 'CORE', 5], ['Computer Networks', 3, 'CORE', 5], ['Machine Learning', 3, 'ELECTIVE', 5], ['DBMS Lab', 2, 'LAB', 5],
      ['Compiler Design', 3, 'CORE', 7], ['Cloud Computing', 3, 'ELECTIVE', 7], ['Cyber Security', 3, 'ELECTIVE', 7], ['Major Project I', 6, 'RESEARCH', 7],
    ] },
    { name: 'B.Tech Electronics & Communication', code: 'BTECE', dept: 'Electronics & Communication', courses: [
      ...firstYear,
      ['Analog Circuits', 4, 'CORE', 3], ['Signals & Systems', 4, 'CORE', 3], ['Digital Electronics', 3, 'CORE', 3], ['Electronic Devices Lab', 2, 'LAB', 3],
      ['Communication Systems', 4, 'CORE', 5], ['Microprocessors & Microcontrollers', 4, 'CORE', 5], ['Embedded Systems Lab', 2, 'LAB', 5],
      ['VLSI Design', 3, 'CORE', 7], ['Wireless Communication', 3, 'ELECTIVE', 7], ['Major Project I', 6, 'RESEARCH', 7],
    ] },
    { name: 'B.Tech Mechanical Engineering', code: 'BTME', dept: 'Mechanical Engineering', courses: [
      ...firstYear,
      ['Engineering Mechanics', 4, 'CORE', 3], ['Thermodynamics', 4, 'CORE', 3], ['Manufacturing Processes', 3, 'CORE', 3], ['Workshop Lab', 2, 'LAB', 3],
      ['Fluid Mechanics', 4, 'CORE', 5], ['Machine Design', 4, 'CORE', 5], ['Heat Transfer Lab', 2, 'LAB', 5],
      ['Robotics & Automation', 3, 'ELECTIVE', 7], ['Industrial Engineering & Economics', 3, 'CORE', 7], ['Major Project I', 6, 'RESEARCH', 7],
    ] },
    { name: 'M.Tech Computer Science (AI & Data Science)', code: 'MTCSE', dept: 'Computer Science & Engg', courses: [
      ['Advanced Algorithms', 4, 'CORE', 1], ['Research Methodology & IPR', 2, 'CORE', 1], ['Deep Learning', 4, 'CORE', 1], ['Natural Language Processing', 3, 'ELECTIVE', 1],
      ['Dissertation Phase I', 10, 'RESEARCH', 3], ['Machine Learning Ops', 3, 'ELECTIVE', 3],
    ] },
  ]
  let room = 201
  for (const pr of programs) {
    const isPG = pr.code.startsWith('MT')
    const p = addProgram(c, isPG ? 'PG' : 'UG', pr.name, pr.code, isPG ? 4 : 8, 'CBCS', pr.dept)
    addCourses(c, p, pr.courses)
    for (const sem of isPG ? [1, 3] : [1, 3, 5, 7]) {
      const s = addSection(c, p, `${pr.code}-S${sem}`, `Semester ${sem}`, `${isPG ? 'PG' : 'LH'}-${room++}`, sem)
      addLearners(c, p, s, isPG ? 6 : 8, Math.ceil(sem / 2) - 1, now)
    }
  }
  buildTimetable(c, tenant.weekDays, 6)
  buildAttendance(c, now, 22)
}

function seedMeridian(db: Db, now: Date) {
  const tenant: Tenant = {
    id: 'mru', name: 'Meridian Research University', shortName: 'MRU', type: 'UNIVERSITY',
    levels: ['UG', 'PG', 'PHD'], framework: 'BOLOGNA_ECTS', country: 'AE', city: 'Dubai', region: 'ME', currency: 'AED',
    defaultLanguage: 'en', timezone: 'Asia/Dubai', weekDays: [1, 2, 3, 4, 5], brandColor: '#7c3aed',
    subdomain: 'meridian', plan: 'ENTERPRISE', status: 'ACTIVE', createdAt: '2025-01-15',
  }
  db.tenants.push(tenant)
  db.periods[tenant.id] = COLLEGE_PERIODS
  const c: Ctx = { db, tenant, pool: INTL_POOL, seq: { learner: 0, staff: 0, course: 0 } }
  const y = now.getFullYear()
  db.terms.push({ id: 'mru-t1', tenantId: 'mru', name: `Fall ${y}`, start: `${y}-09-01`, end: `${y}-12-20`, current: true },
    { id: 'mru-t2', tenantId: 'mru', name: `Spring ${y + 1}`, start: `${y + 1}-01-12`, end: `${y + 1}-05-15`, current: false })

  addStaff(c, 'Vice-Chancellor', 'Administration', 'PhD (Oxford)', [])
  const fac: [string, string, string[]][] = [
    ['Professor', 'Computer Science', ['Machine Learning', 'Artificial Intelligence', 'Research Seminar']],
    ['Professor', 'Computer Science', ['Distributed', 'Security', 'Research Methods']],
    ['Associate Professor', 'Computer Science', ['Programming', 'Algorithms', 'Data Structures']],
    ['Associate Professor', 'Computer Science', ['Statistics', 'Data', 'Big Data']],
    ['Assistant Professor', 'Computer Science', ['Databases', 'Software', 'Web']],
    ['Professor', 'Physics', ['Quantum', 'Condensed', 'Research Seminar']],
    ['Associate Professor', 'Physics', ['Electromagnetism', 'Mechanics', 'Research Methods']],
    ['Assistant Professor', 'Mathematics', ['Calculus', 'Linear Algebra', 'Probability', 'Mathematics']],
    ['Assistant Professor', 'Humanities', ['Academic Writing', 'Ethics', 'Arabic', 'Islamic']],
  ]
  fac.forEach(([d, dept, subs]) => addStaff(c, d, dept, 'PhD', subs, d !== 'Assistant Professor'))

  const programs: { name: string; code: string; level: LevelCode; dept: string; terms: number; sems: number[]; courses: [string, number, Course['type'], number][]; perSection: number }[] = [
    { name: 'BSc Computer Science', code: 'BSCCS', level: 'UG', dept: 'Computer Science', terms: 6, sems: [1, 3, 5], perSection: 8, courses: [
      ['Programming Fundamentals', 6, 'CORE', 1], ['Calculus I', 6, 'CORE', 1], ['Academic Writing', 3, 'CORE', 1], ['Islamic Studies & UAE Society', 3, 'CORE', 1],
      ['Data Structures & Algorithms', 6, 'CORE', 3], ['Linear Algebra', 6, 'CORE', 3], ['Databases', 6, 'CORE', 3],
      ['Artificial Intelligence', 6, 'CORE', 5], ['Distributed Systems', 6, 'CORE', 5], ['Software Engineering Project', 9, 'RESEARCH', 5],
    ] },
    { name: 'MSc Data Science', code: 'MSCDS', level: 'PG', dept: 'Computer Science', terms: 4, sems: [1, 3], perSection: 7, courses: [
      ['Statistical Learning', 7.5, 'CORE', 1], ['Big Data Systems', 7.5, 'CORE', 1], ['Probability for Data Science', 7.5, 'CORE', 1], ['Ethics of AI', 5, 'CORE', 1],
      ['Machine Learning at Scale', 7.5, 'CORE', 3], ['MSc Thesis', 30, 'RESEARCH', 3],
    ] },
    { name: 'PhD Computer Science', code: 'PHDCS', level: 'PHD', dept: 'Computer Science', terms: 8, sems: [1], perSection: 8, courses: [
      ['Research Methods in Computing', 10, 'CORE', 1], ['Research Seminar (CS)', 5, 'RESEARCH', 1], ['Research Ethics & Integrity', 5, 'CORE', 1],
    ] },
    { name: 'PhD Physics', code: 'PHDPHY', level: 'PHD', dept: 'Physics', terms: 8, sems: [1], perSection: 6, courses: [
      ['Research Methods in Physics', 10, 'CORE', 1], ['Research Seminar (Physics)', 5, 'RESEARCH', 1], ['Research Ethics & Integrity', 5, 'CORE', 1],
    ] },
  ]
  let room = 1
  for (const pr of programs) {
    const p = addProgram(c, pr.level, pr.name, pr.code, pr.terms, 'ECTS', pr.dept)
    addCourses(c, p, pr.courses)
    for (const sem of pr.sems) {
      const label = pr.level === 'PHD' ? 'Doctoral cohort' : `Semester ${sem}`
      const s = addSection(c, p, pr.level === 'PHD' ? `${pr.code}-COHORT` : `${pr.code}-S${sem}`, label, `B${Math.ceil(room / 4)}-${100 + room++}`, sem)
      addLearners(c, p, s, pr.perSection, pr.level === 'PHD' ? 1 : Math.ceil(sem / 2) - 1, now)
    }
  }
  buildTimetable(c, tenant.weekDays, 5)
  buildAttendance(c, now, 20)
  addResearch(c, now)
}

function onboardingTenants(db: Db) {
  const base = { levels: [] as LevelCode[], status: 'TRIAL' as const, plan: 'STARTER' as const }
  db.tenants.push(
    { ...base, id: 'lha', name: 'Lincoln Heights Academy', shortName: 'LHA', type: 'SCHOOL', levels: ['PRE_PRIMARY', 'PRIMARY', 'MIDDLE', 'SECONDARY'], framework: 'US_COMMON_CORE', country: 'US', city: 'Austin', region: 'US', currency: 'USD', defaultLanguage: 'en', timezone: 'America/Chicago', weekDays: [1, 2, 3, 4, 5], brandColor: '#dc2626', subdomain: 'lincolnheights', createdAt: '2026-10-02' },
    { ...base, id: 'ris', name: 'Riverside International School', shortName: 'RIS', type: 'SCHOOL', levels: ['PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'], framework: 'CAMBRIDGE', country: 'KE', city: 'Nairobi', region: 'AF', currency: 'KES', defaultLanguage: 'sw', timezone: 'Africa/Nairobi', weekDays: [1, 2, 3, 4, 5], brandColor: '#0891b2', subdomain: 'riverside', createdAt: '2026-09-18', plan: 'GROWTH' },
    { ...base, id: 'csm', name: 'Colegio San Martín', shortName: 'CSM', type: 'SCHOOL', levels: ['PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'], framework: 'IB', country: 'CO', city: 'Bogotá', region: 'LATAM', currency: 'COP', defaultLanguage: 'es', timezone: 'America/Bogota', weekDays: [1, 2, 3, 4, 5], brandColor: '#ea580c', subdomain: 'sanmartin', createdAt: '2026-11-03' },
  )
}

function users(db: Db) {
  const u = (x: User) => db.users.push(x)
  u({ id: 'u-super', tenantId: 'platform', name: 'Platform Administrator', email: 'admin@unifiedtree.app', role: 'SUPER_ADMIN', title: 'UnifiedTree Super Admin' })

  for (const t of db.tenants.filter((t) => ['gps', 'iit', 'mru'].includes(t.id))) {
    const head = db.staff.find((s) => s.tenantId === t.id)!
    u({ id: `u-${t.id}-admin`, tenantId: t.id, name: head.name, email: head.email, role: 'INST_ADMIN', title: head.designation, personId: head.id })
  }
  // Faculty
  const gpsSection = db.sections.find((s) => s.id === 'gps-p-g3-s-g3a')!
  const gpsTeacher = db.staff.find((s) => s.id === gpsSection.classTeacherId)!
  u({ id: 'u-gps-faculty', tenantId: 'gps', name: gpsTeacher.name, email: gpsTeacher.email, role: 'FACULTY', title: `Class Teacher, ${gpsSection.name}`, personId: gpsTeacher.id })
  const iitHod = db.staff.find((s) => s.tenantId === 'iit' && s.designation === 'Professor & HoD')!
  u({ id: 'u-iit-faculty', tenantId: 'iit', name: iitHod.name, email: iitHod.email, role: 'FACULTY', title: `${iitHod.designation}, ${iitHod.department}`, personId: iitHod.id })
  const mruSup = db.staff.find((s) => s.tenantId === 'mru' && s.isSupervisor && s.department === 'Computer Science')!
  u({ id: 'u-mru-faculty', tenantId: 'mru', name: mruSup.name, email: mruSup.email, role: 'FACULTY', title: `${mruSup.designation} & PhD Supervisor`, personId: mruSup.id })

  // Students: a child (Grade 3), a teen (Grade 10), an engineering student, a PhD scholar
  const kid = db.learners.find((l) => l.sectionId === 'gps-p-g3-s-g3a')!
  const teen = db.learners.find((l) => l.sectionId === 'gps-p-g10-s-g10a')!
  // make them siblings for the guardian demo
  teen.lastName = kid.lastName
  teen.guardians = kid.guardians.map((g) => ({ ...g }))
  u({ id: 'u-gps-kid', tenantId: 'gps', name: `${kid.firstName} ${kid.lastName}`, email: `${kid.admissionNo}`, role: 'STUDENT', title: 'Grade 3 student', personId: kid.id })
  u({ id: 'u-gps-teen', tenantId: 'gps', name: `${teen.firstName} ${teen.lastName}`, email: `${teen.admissionNo}`, role: 'STUDENT', title: 'Grade 10 student', personId: teen.id })
  const parent = kid.guardians[0]
  u({ id: 'u-gps-parent', tenantId: 'gps', name: parent.name, email: parent.email, role: 'GUARDIAN', title: `Parent of ${kid.firstName} & ${teen.firstName}`, learnerIds: [kid.id, teen.id] })

  const eng = db.learners.find((l) => l.sectionId === 'iit-p-btcse-s-btcses5')!
  u({ id: 'u-iit-student', tenantId: 'iit', name: `${eng.firstName} ${eng.lastName}`, email: eng.email!, role: 'STUDENT', title: 'B.Tech CSE, Semester 5', personId: eng.id })
  u({ id: 'u-iit-parent', tenantId: 'iit', name: eng.guardians[0].name, email: eng.guardians[0].email, role: 'GUARDIAN', title: `Parent of ${eng.firstName}`, learnerIds: [eng.id] })

  const supervised = db.research.find((r) => r.supervisorId === mruSup.id) ?? db.research[0]
  const phd = db.learners.find((l) => l.id === supervised.learnerId)!
  u({ id: 'u-mru-scholar', tenantId: 'mru', name: `${phd.firstName} ${phd.lastName}`, email: phd.email!, role: 'STUDENT', title: 'PhD Scholar, Computer Science', personId: phd.id })
  const bsc = db.learners.find((l) => l.sectionId === 'mru-p-bsccs-s-bsccss1')!
  u({ id: 'u-mru-student', tenantId: 'mru', name: `${bsc.firstName} ${bsc.lastName}`, email: bsc.email!, role: 'STUDENT', title: 'BSc Computer Science, Year 1', personId: bsc.id })
  u({ id: 'u-mru-parent', tenantId: 'mru', name: bsc.guardians[0].name, email: bsc.guardians[0].email, role: 'GUARDIAN', title: `Parent of ${bsc.firstName}`, learnerIds: [bsc.id] })
}

export function createSeed(now = new Date()): Db {
  rand = mulberry32(42)
  const db: Db = {
    version: DB_VERSION, tenants: [], users: [], learners: [], staff: [], programs: [], courses: [], sections: [],
    terms: [], slots: [], attendance: [], research: [], audit: [], periods: {},
    applications: [], assessments: [], marks: [], feeStructures: [], invoices: [], announcements: [], threads: [], books: [], loans: [],
    lessons: [], assignments: [], submissions: [], quizzes: [], quizAttempts: [], liveSessions: [], lessonDone: {},
    credentials: [], ledger: [], creditRecords: [], issuerKeys: {},
  }
  seedGreenfield(db, now)
  seedIndus(db, now)
  seedMeridian(db, now)
  onboardingTenants(db)
  for (const s of db.staff) delete (s as Staff & { _subjects?: string[] })._subjects
  users(db)
  seedPhase2(db, now)
  seedPhase3(db, now)
  seedPhase3b(db, now)
  const at = now.toISOString()
  db.audit.push(
    { id: 'a1', tenantId: 'gps', actor: 'System', action: 'Seeded demo data', entity: 'Tenant', at },
    { id: 'a2', tenantId: 'iit', actor: 'System', action: 'Seeded demo data', entity: 'Tenant', at },
    { id: 'a3', tenantId: 'mru', actor: 'System', action: 'Seeded demo data', entity: 'Tenant', at },
  )
  return db
}
