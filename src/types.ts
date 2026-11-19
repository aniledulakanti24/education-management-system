// Core domain types shared by the UI and the mock backend.

export type Role = 'SUPER_ADMIN' | 'INST_ADMIN' | 'FACULTY' | 'STUDENT' | 'GUARDIAN'

export type LevelCode =
  | 'PRE_PRIMARY'
  | 'PRIMARY'
  | 'MIDDLE'
  | 'SECONDARY'
  | 'SENIOR_SECONDARY'
  | 'DIPLOMA'
  | 'UG'
  | 'PG'
  | 'PHD'
  | 'VOCATIONAL'

export type InstitutionType = 'SCHOOL' | 'COLLEGE' | 'UNIVERSITY' | 'TRAINING'

export type FrameworkCode =
  | 'CBSE'
  | 'ICSE'
  | 'STATE_BOARD_IN'
  | 'IB'
  | 'CAMBRIDGE'
  | 'US_COMMON_CORE'
  | 'UK_NATIONAL'
  | 'AICTE_CBCS'
  | 'UGC_CBCS'
  | 'BOLOGNA_ECTS'

export type AttendanceStatus = 'P' | 'A' | 'L' | 'E' // present, absent, late, excused

export interface Tenant {
  id: string
  name: string
  shortName: string
  type: InstitutionType
  levels: LevelCode[]
  framework: FrameworkCode
  country: string // ISO 3166-1 alpha-2
  city: string
  region: 'IN' | 'EU' | 'US' | 'ME' | 'APAC' | 'AF' | 'LATAM'
  currency: string // ISO 4217
  defaultLanguage: string // ISO 639-1
  timezone: string
  weekDays: number[] // 1 = Monday ... 7 = Sunday
  brandColor: string // hex
  subdomain: string
  plan: 'STARTER' | 'GROWTH' | 'ENTERPRISE'
  status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED'
  createdAt: string
}

export interface User {
  id: string
  tenantId: string // 'platform' for super admins
  name: string
  email: string
  role: Role
  title: string
  personId?: string // learner or staff id
  learnerIds?: string[] // guardians
}

export interface Guardian {
  name: string
  relation: 'Father' | 'Mother' | 'Guardian' | 'Spouse' | 'Sponsor'
  phone: string
  email: string
}

export interface Learner {
  id: string
  tenantId: string
  admissionNo: string
  firstName: string
  lastName: string
  gender: 'F' | 'M' | 'X'
  dob: string
  level: LevelCode
  programId: string
  sectionId: string
  rollNo: number
  apaarId?: string
  abcId?: string
  nationalId?: string
  email?: string
  phone?: string
  bloodGroup?: string
  address: string
  nationality: string
  guardians: Guardian[]
  status: 'ACTIVE' | 'ALUMNI' | 'WITHDRAWN' | 'ON_LEAVE'
  enrolledOn: string
}

export interface Staff {
  id: string
  tenantId: string
  employeeNo: string
  name: string
  email: string
  phone: string
  designation: string
  department: string
  qualification: string
  courseIds: string[]
  isSupervisor: boolean
  joinedOn: string
}

export interface Program {
  id: string
  tenantId: string
  level: LevelCode
  name: string
  code: string
  durationTerms: number
  creditSystem: 'NONE' | 'CBCS' | 'ECTS' | 'US_CREDIT'
  department: string
}

export interface Course {
  id: string
  tenantId: string
  programId: string
  code: string
  name: string
  credits: number
  type: 'CORE' | 'ELECTIVE' | 'LAB' | 'ACTIVITY' | 'RESEARCH'
  semester?: number // for credit-based programmes
  outcomes: string[]
}

export interface Section {
  id: string
  tenantId: string
  programId: string
  name: string
  termLabel: string
  semester?: number
  room: string
  classTeacherId?: string
  capacity: number
}

export interface Term {
  id: string
  tenantId: string
  name: string
  start: string
  end: string
  current: boolean
}

export interface TimetableSlot {
  id: string
  tenantId: string
  sectionId: string
  day: number // 1..7
  period: number // 1..n
  courseId: string
  staffId: string
  room: string
}

export interface AttendanceSheet {
  id: string // `${sectionId}|${date}`
  tenantId: string
  sectionId: string
  date: string // YYYY-MM-DD
  marks: Record<string, AttendanceStatus>
  markedBy: string
  markedAt: string
}

export type ResearchStage =
  | 'COURSEWORK'
  | 'SYNOPSIS'
  | 'DATA_COLLECTION'
  | 'WRITING'
  | 'PRE_SUBMISSION'
  | 'UNDER_REVIEW'
  | 'VIVA'
  | 'AWARDED'

export interface ResearchProfile {
  learnerId: string
  tenantId: string
  supervisorId: string
  coSupervisorId?: string
  topic: string
  area: string
  stage: ResearchStage
  registeredOn: string
  publications: number
  milestones: { label: string; due: string; done: boolean }[]
}

export interface AuditEntry {
  id: string
  tenantId: string
  actor: string
  action: string
  entity: string
  at: string
}

export interface Period {
  no: number
  start: string
  end: string
}

export interface AcademicStructure {
  programs: Program[]
  courses: Course[]
  sections: Section[]
  terms: Term[]
  periods: Period[]
}

// ---------------- Phase 2 ----------------

export type AdmissionStage =
  | 'ENQUIRY'
  | 'APPLIED'
  | 'DOCS_VERIFIED'
  | 'ASSESSMENT'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'ENROLLED'
  | 'REJECTED'

export interface Application {
  id: string
  tenantId: string
  number: string
  applicantName: string
  dob: string
  gender: 'F' | 'M' | 'X'
  programId: string
  stage: AdmissionStage
  category: string // reservation / fee category, e.g. GENERAL, OBC, SC, ST, EWS, RTE, INTERNATIONAL
  source: 'Website' | 'Walk-in' | 'Referral' | 'Education fair' | 'Agent' | 'Social media'
  guardianName: string
  phone: string
  email: string
  previousSchool?: string
  score?: number // entrance / assessment score out of 100
  documents: { name: string; verified: boolean }[]
  notes: { at: string; by: string; text: string }[]
  createdAt: string
  updatedAt: string
  learnerId?: string
}

export interface Assessment {
  id: string
  tenantId: string
  name: string
  kind: 'UNIT_TEST' | 'MIDTERM' | 'FINAL' | 'INTERNAL' | 'PRACTICAL'
  termId: string
  programIds: string[]
  maxMarks: number
  weight: number // % contribution to term result
  startDate: string
  status: 'SCHEDULED' | 'MARKS_ENTRY' | 'PUBLISHED'
}

export interface MarkSheet {
  id: string // `${assessmentId}|${sectionId}|${courseId}`
  tenantId: string
  assessmentId: string
  sectionId: string
  courseId: string
  marks: Record<string, number | null> // null = absent
  enteredBy: string
  updatedAt: string
}

export interface FeeStructure {
  id: string
  tenantId: string
  name: string
  programIds: string[]
  items: { head: string; amount: number }[]
  frequency: 'TERM' | 'SEMESTER' | 'ANNUAL'
  dueDate: string
}

export type PaymentMethod = 'UPI' | 'CARD' | 'NET_BANKING' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE'

export interface Payment {
  id: string
  amount: number
  method: PaymentMethod
  reference: string
  at: string
  receivedBy: string
}

export interface Invoice {
  id: string
  tenantId: string
  number: string
  learnerId: string
  structureId: string
  title: string
  items: { head: string; amount: number }[]
  discount: number
  discountReason?: string
  lateFee: number
  dueDate: string
  issuedOn: string
  payments: Payment[]
}

export interface Announcement {
  id: string
  tenantId: string
  title: string
  body: string
  audienceRoles: Role[]
  sectionIds: string[] // empty = whole institution
  channels: ('APP' | 'EMAIL' | 'SMS' | 'WHATSAPP')[]
  authorId: string
  authorName: string
  pinned: boolean
  createdAt: string
  readBy: string[]
}

export interface MessageThread {
  id: string
  tenantId: string
  subject: string
  participantIds: string[]
  messages: { id: string; authorId: string; body: string; at: string }[]
  readBy: Record<string, string> // userId -> last read ISO time
}

export interface Book {
  id: string
  tenantId: string
  isbn: string
  title: string
  author: string
  category: string
  year: number
  shelf: string
  copies: number
  forLevels: 'CHILDREN' | 'GENERAL' | 'ACADEMIC'
}

export interface Loan {
  id: string
  tenantId: string
  bookId: string
  borrowerId: string // learner or staff id
  borrowerType: 'LEARNER' | 'STAFF'
  issuedOn: string
  dueOn: string
  returnedOn?: string
  finePaid?: number
}

// ---------------- Phase 3: LMS & AI ----------------

export interface Lesson {
  id: string
  tenantId: string
  sectionId: string
  courseId: string
  module: string
  order: number
  title: string
  kind: 'ARTICLE' | 'VIDEO' | 'LINK'
  body: string
  url?: string
  minutes: number
  publishedAt: string
}

export interface RubricCriterion {
  criterion: string
  points: number
  keywords: string[]
}

export interface Assignment {
  id: string
  tenantId: string
  sectionId: string
  courseId: string
  title: string
  instructions: string
  dueAt: string
  maxPoints: number
  rubric: RubricCriterion[]
  createdBy: string
  createdAt: string
}

export interface AiGradeSuggestion {
  criteria: { criterion: string; points: number; max: number; matched: string[]; missing: string[] }[]
  total: number
  feedback: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface Submission {
  id: string
  tenantId: string
  assignmentId: string
  learnerId: string
  text: string
  submittedAt: string
  status: 'SUBMITTED' | 'GRADED'
  score?: number
  feedback?: string
  gradedBy?: string
  gradedAt?: string
  aiAssisted?: boolean
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  answer: number
  explanation: string
}

export interface Quiz {
  id: string
  tenantId: string
  sectionId: string
  courseId: string
  title: string
  questions: QuizQuestion[]
  dueAt: string
  timeLimitMin: number
  createdBy: string
}

export interface QuizAttempt {
  id: string
  tenantId: string
  quizId: string
  learnerId: string
  answers: number[]
  score: number
  max: number
  at: string
}

export interface LiveSession {
  id: string
  tenantId: string
  sectionId: string
  courseId: string
  title: string
  startsAt: string
  minutes: number
  joinUrl: string
  createdBy: string
}

// ---------------- Phase 3b: credentials ----------------

export type CredentialTemplate = 'PROGRESS_REPORT' | 'GRADE_CARD' | 'COURSE_COMPLETION' | 'ATTENDANCE_BADGE' | 'BONAFIDE' | 'RESEARCH_MILESTONE'

/** A W3C Verifiable Credential (VC Data Model 2.0) as JSON. */
export type VerifiableCredential = Record<string, unknown> & {
  id: string
  type: string[]
  issuer: { id: string; name: string }
  validFrom: string
  validUntil?: string
  name: string
  credentialSubject: Record<string, unknown>
  credentialStatus?: { id: string; type: string; statusPurpose: string; statusListIndex: string; statusListCredential: string }
  proof?: { type: string; cryptosuite: string; created: string; verificationMethod: string; proofPurpose: string; proofValue: string }
}

export interface Credential {
  id: string
  tenantId: string
  learnerId: string
  template: CredentialTemplate
  params?: Record<string, string> // e.g. { term } for grade cards, { courseId, sectionId } for course completion
  title: string
  issuedAt: string
  issuedBy: string
  vc: VerifiableCredential | null // null until built & signed by the issuer service
  hash?: string // sha-256 of the signed, canonicalised credential (anchored on the ledger)
  statusIndex: number
  status: 'ACTIVE' | 'REVOKED'
  revokedAt?: string
  revokeReason?: string
  shared: boolean
  digilocker?: { uri: string; pushedAt: string; status: 'DELIVERED' }
}

export interface LedgerBlock {
  index: number
  at: string
  action: 'GENESIS' | 'ISSUE' | 'REVOKE'
  issuerDid: string
  credentialId: string
  credentialHash: string
  prevHash: string
  hash: string
}

export interface CreditRecord {
  id: string
  tenantId: string
  learnerId: string
  scheme: 'ABC' | 'ECTS'
  courseCode: string
  courseName: string
  credits: number
  grade: string
  term: string
  depositedAt: string
  status: 'ACCEPTED' | 'PENDING'
  ref: string
}
