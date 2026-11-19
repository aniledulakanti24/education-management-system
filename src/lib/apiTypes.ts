// Response shapes returned by the API (mock or real).
import type { AttendanceStatus, AuditEntry, Learner, LevelCode, ResearchProfile, Section, Staff, Tenant, TimetableSlot } from '@/types'

export type LearnerRow = Learner & { programName: string; sectionName: string; attendancePct: number | null }

export type SlotRow = TimetableSlot & { courseName: string; courseCode: string; staffName: string; sectionName: string }

export interface LearnerSummary {
  learner: LearnerRow
  age: number
  attendance: {
    pct: number | null
    counts: Record<AttendanceStatus, number>
    total: number
    recent: { date: string; status: AttendanceStatus }[]
  }
  today: SlotRow[]
  research: ResearchProfile | null
}

export type TenantRow = Tenant & { learners: number; staff: number; programs: number; sections: number }

export interface AdminDashboard {
  kind: 'admin'
  counts: { learners: number; staff: number; programs: number; sections: number }
  trend: { date: string; pct: number | null }[]
  byLevel: { level: LevelCode; count: number }[]
  gender: { F: number; M: number; X: number }
  markedToday: number
  sectionsTotal: number
  avgAttendance: number | null
  atRisk: (LearnerRow & { riskScore: number; factors: string[] })[]
  scholars: number
  recentAudit: AuditEntry[]
}

export interface FacultyDashboard {
  kind: 'faculty'
  classes: SlotRow[]
  weeklyLoad: number
  sectionsTaught: number
  learnersTaught: number
  classTeacherOf: (Section & { markedToday: boolean })[]
  lowAttendance: LearnerRow[]
  scholars: (ResearchProfile & { learner?: Learner })[]
}

export type StudentDashboard = { kind: 'student' } & LearnerSummary
export interface GuardianDashboard { kind: 'guardian'; children: LearnerSummary[] }

export interface SuperDashboard {
  kind: 'super'
  tenants: TenantRow[]
  totals: { tenants: number; learners: number; staff: number; countries: number }
  byRegion: { name: string; count: number }[]
  byFramework: { name: string; count: number }[]
  byPlan: { name: string; count: number }[]
}

export type Dashboard = AdminDashboard | FacultyDashboard | StudentDashboard | GuardianDashboard | SuperDashboard

export type StaffRow = Staff & { weeklyLoad: number; courseNames: string[]; scholars: number }

export type ScholarRow = ResearchProfile & { scholarName: string; programName: string; supervisorName: string; coSupervisorName?: string }

export const STAGE_LABEL: Record<ResearchProfile['stage'], string> = {
  COURSEWORK: 'Coursework', SYNOPSIS: 'Synopsis', DATA_COLLECTION: 'Research / data collection', WRITING: 'Thesis writing',
  PRE_SUBMISSION: 'Pre-submission', UNDER_REVIEW: 'Under review', VIVA: 'Viva voce', AWARDED: 'Awarded',
}

// ---------------- Phase 2 ----------------
import type { Application, Assessment, Course, FeeStructure, Invoice, Learner as LearnerT, Payment, Announcement, MessageThread, Book, Loan, Role } from '@/types'

export type ApplicationRow = Application & { programName: string }

export type InvoiceView = Invoice & {
  gross: number; net: number; paid: number; balance: number; status: 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE'
  partiallyPaid: boolean; learnerName: string; admissionNo: string; sectionName: string
}

export interface FeeSummary {
  billed: number; collected: number; outstanding: number; rate: number; concessions: number
  counts: Record<'PAID' | 'PARTIAL' | 'OVERDUE' | 'DUE', number>
  byMethod: { method: string; amount: number }[]
  daily: { date: string; amount: number }[]
  structures: { id: string; name: string; invoices: number; billed: number; collected: number }[]
  recent: (Payment & { invoiceId: string; invoiceNumber: string; learnerName: string })[]
}

export type FeeStructureRow = FeeStructure & { programNames: string[]; total: number }

export type ExamRow = Assessment & { expected: number; entered: number }
export interface PendingMark { assessmentId: string; assessmentName: string; sectionId: string; sectionName: string; courseId: string; courseName: string }

export interface ExamSheet {
  assessment: Assessment
  learners: LearnerT[]
  sheet: { marks: Record<string, number | null>; updatedAt: string } | null
  canEdit: boolean
  course?: Course
  section?: { id: string; name: string }
}

export interface ExamAnalysis {
  assessment: Assessment
  perCourse: { courseId: string; courseName: string; entered: boolean; count: number; avg: number | null; max: number | null; min: number | null; passRate: number | null; distribution: Record<string, number>; attainment: number | null }[]
  toppers: { learnerId: string; name: string; pct: number | null }[]
  needsSupport: { learnerId: string; name: string; pct: number | null }[]
}

export interface ReportCard {
  learner: { id: string; name: string; admissionNo: string; rollNo: number; sectionName: string; programName: string; apaarId?: string; abcId?: string }
  term: string
  assessments: { id: string; name: string; maxMarks: number; weight: number; status: Assessment['status'] }[]
  rows: { courseId: string; courseName: string; code: string; credits: number; cells: { assessmentId: string; mark: number | null | undefined; max: number }[]; percent: number | null; grade: string | null; points: number | null; pass: boolean | null }[]
  overall: number | null; overallGrade: string | null; gpa: number | null; gpaLabel: string | null; gpaScale: number | null
  rank: number | null; classSize: number; attendancePct: number | null; remark: string | null; passMark: number
}

export type AnnouncementRow = Announcement & { read: boolean; readCount: number; sectionNames: string[] }
export interface ThreadRow { id: string; subject: string; last: { id: string; authorId: string; authorName: string; body: string; at: string } | null; with: { id?: string; name: string; title: string }[]; unread: number }
export type ThreadDetail = MessageThread & { participants: { id: string; name: string; title: string; role?: Role }[] }
export interface Contact { id: string; name: string; title: string; role: Role }

export type BookRow = Book & { available: number }
export type LoanRow = Loan & { bookTitle: string; bookAuthor: string; borrowerName: string; borrowerSection: string; overdueDays: number; fine: number; active: boolean }

export interface DashboardExtrasAdmin {
  kind: 'admin'
  fees: { billed: number; collected: number; outstanding: number; rate: number; overdue: number }
  admissions: { open: number; offered: number; newThisWeek: number }
  marks: { name: string; entered: number; expected: number } | null
  nextExam: Assessment | null
  library: { overdue: number; issued: number }
  announcements: Announcement[]
}
export interface DashboardExtrasFaculty { kind: 'faculty'; pendingMarks: PendingMark[]; announcements: Announcement[] }
export interface DashboardExtrasLearner {
  kind: 'learner'
  children: { learnerId: string; name: string; overall: number | null; overallGrade: string | null; gpa: number | null; gpaLabel: string | null; rank: number | null; classSize: number; latestAssessment: string | null; feeBalance: number; feeOverdue: boolean; loans: LoanRow[] }[]
  announcements: Announcement[]
}
export type DashboardExtras = DashboardExtrasAdmin | DashboardExtrasFaculty | DashboardExtrasLearner

// ---------------- Phase 3: LMS & AI ----------------
import type { AiGradeSuggestion, Assignment as AssignmentT, Lesson, LiveSession, Quiz, QuizAttempt, Submission } from '@/types'

export interface ClassSummary {
  sectionId: string; courseId: string; courseName: string; courseCode: string; sectionName: string; teacherName: string
  lessons: number; completed: number; assignments: number; quizzes: number; todo: number; toGrade: number; nextLive: LiveSession | null
}
export interface LmsClasses { role: 'TEACHER' | 'LEARNER' | 'GUARDIAN'; kidMode: boolean; groups: { learnerId: string | null; learnerName: string | null; classes: ClassSummary[] }[] }

export interface ClassDetail {
  access: 'TEACHER' | 'LEARNER' | 'GUARDIAN'
  learnerName: string | null
  kidMode: boolean
  summary: ClassSummary
  lessons: (Lesson & { done: boolean })[]
  assignments: (AssignmentT & { submitted: number; graded: number; roster: number; mine: Submission | null })[]
  quizzes: { id: string; title: string; dueAt: string; timeLimitMin: number; questionCount: number; attempts: number; avgPct: number | null; mine: QuizAttempt | null }[]
  live: LiveSession[]
  progress: { learnerId: string; name: string; rollNo: number; lessonsDone: number; submitted: number; due: number; quizAvg: number | null }[]
}

export interface AssignmentDetail {
  assignment: AssignmentT
  access: ClassDetail['access']
  submissions: (Submission & { learnerName?: string; late?: boolean; similarTo?: { name: string; score: number }[] })[]
  missing?: string[]
  flags: { a: string; b: string; score: number }[]
}

export type { AiGradeSuggestion }

export interface QuizDetail {
  quiz: Quiz
  access: ClassDetail['access']
  mine?: QuizAttempt | null
  attempts?: (QuizAttempt & { learnerName: string })[]
  perQuestion?: { id: string; correctPct: number | null }[]
}

export interface RiskRow {
  learnerId: string; name: string; sectionId: string; sectionName: string; level: string; probability: number; tier: 'HIGH' | 'MEDIUM' | 'LOW'
  features: { attendance: number | null; recentAttendance: number | null; academic: number | null; fails: number; feeOverdue: boolean; missingWork: number }
  contributions: { key: string; label: string; value: number; detail: string }[]
  interventions: string[]
}
export interface RiskResponse {
  model: { name: string; intercept: number; features: { key: string; label: string; coef: number; help: string }[]; limits: string[] }
  rows: RiskRow[]
  distribution: Record<'HIGH' | 'MEDIUM' | 'LOW', number>
  generatedAt: string
}

export interface ScheduleProposalView {
  sectionId: string
  slots: { sectionId: string; day: number; period: number; courseId: string; staffId: string; room: string; courseName: string; staffName: string }[]
  demand: { courseId: string; courseName: string; periods: number; placed: number; teacherId: string | null; teacherName: string }[]
  unfilled: number
  metrics: { score: number; clashes: number; maxSameDay: number; backToBack: number; labDoubles: number; substitutes: number; attempts: number }
  notes: string[]
  currentSlots: number
}

export interface AssistantAnswer {
  text: string
  intent: string
  table?: { columns: string[]; rows: (string | number)[][] }
  links?: { label: string; href: string }[]
  sources?: { lessonId: string; title: string; course: string; href: string }[]
  suggestions: string[]
  engine?: string
}

export type LmsSummary =
  | { kind: 'teacher'; toGrade: number; lessons: number; submissionRate: number | null; quizAvg: number | null; highRisk: number; mediumRisk: number; nextLive: LiveSession | null }
  | { kind: 'learner'; children: { learnerId: string; name: string; todo: number; lessons: number; completed: number; nextLesson: { id: string; title: string; sectionId: string; courseId: string; courseName: string } | null; nextLive: LiveSession | null }[] }

// ---------------- Phase 3b: credentials ----------------
import type { CredentialTemplate, CreditRecord, LedgerBlock, VerifiableCredential } from '@/types'

export interface CredentialRow {
  id: string; learnerId: string; learnerName: string; sectionName: string; template: CredentialTemplate; title: string
  issuedAt: string; issuedBy: string; status: 'ACTIVE' | 'REVOKED'; revokedAt?: string; revokeReason?: string
  shared: boolean; digilocker?: { uri: string; pushedAt: string; status: string }; hash?: string; statusIndex: number
}
export type CredentialDetail = CredentialRow & { vc: VerifiableCredential; ledgerIndex: number | null }
export interface TemplateInfo { code: CredentialTemplate; name: string; description: string; standard: string }
export interface IssuePreview { terms: string[]; courses: { id: string; name: string }[]; rows: { learnerId: string; name: string; rollNo: number; apaarId?: string; ok: boolean; reason: string }[] }
export interface IssuerInfo {
  did: string; didUrl: string; keyCreatedAt?: string; publicJwk?: JsonWebKey
  counts: { issued: number; active: number; revoked: number; digilocker: number }
  ledger: { height: number; head?: string }
  recentBlocks: LedgerBlock[]
}
export interface CreditStatement {
  learner: { id: string; name: string; abcId?: string; apaarId?: string; level: string }
  scheme: 'ABC' | 'ECTS'; total: number; records: CreditRecord[]
  milestones: { credits: number; award: string; reached: boolean }[]
}
export interface CreditOverview {
  scheme: 'ABC' | 'ECTS'
  sections: { sectionId: string; sectionName: string; programName: string; learners: number; linked: number; credits: number; lastDeposit: string | null; canPush: boolean; pushBlockedReason: string | null }[]
}
