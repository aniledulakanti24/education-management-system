import { useTranslation } from 'react-i18next'
import { Award, Banknote, BookOpenCheck, Bot, Bus, CheckCircle2, ClipboardList, FileBarChart2, FlaskConical, Library, MessagesSquare, MonitorPlay, UserPlus, Wallet } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui'

const PHASES = [
  {
    name: 'Phase 1 — Foundation', status: 'Live in this build',
    items: [
      [CheckCircle2, 'Multi-tenant SaaS shell, branding & framework packs'], [CheckCircle2, '5 role portals incl. kids mode'],
      [CheckCircle2, 'All ISO languages + RTL, locale formats'], [CheckCircle2, 'Learners, staff, programmes, courses, sections'],
      [CheckCircle2, 'Timetable with clash detection'], [CheckCircle2, 'Attendance with guardian alerts & early-warning'],
      [CheckCircle2, 'PhD scholar registry & milestones'], [CheckCircle2, 'Audit log'],
    ],
  },
  {
    name: 'Phase 2 — Core operations', status: 'Live in this build',
    items: [
      [CheckCircle2, 'Admissions CRM: enquiry → offer → enrol, quotas, document checks, public application form'],
      [CheckCircle2, 'Exams & gradebook: scheduling, marks entry, publishing, subject analysis, CO attainment'],
      [CheckCircle2, 'Report cards with framework grades, SGPA / CGPA / GPA, rank and printable PDF'],
      [CheckCircle2, 'Fees: structures, concessions, invoices, online payment (test mode), receipts, reminders'],
      [CheckCircle2, 'Announcements by audience & channel, safeguarded messaging, unread badges'],
      [CheckCircle2, 'Library catalogue, issue / return rules, overdue fines'],
    ],
  },
  {
    name: 'Phase 2b — Operations', status: 'Next',
    items: [
      [Wallet, 'HR & payroll with country rules (PF/ESI/TDS, PAYE…)'], [Bus, 'Transport with GPS tracking, hostel & mess, inventory'],
      [ClipboardList, 'Holistic Progress Card (NEP 2020), co-scholastic grading, PTM booking'], [Banknote, 'Real payment gateways (Razorpay, Stripe), accounting export (Tally, Xero)'],
      [Library, 'MARC21 / Koha import, RFID, e-resources'], [UserPlus, 'Seat allotment rounds & merit lists'], [MessagesSquare, 'Live SMS / WhatsApp / email delivery'],
    ],
  },
  {
    name: 'Phase 3 — AI & LMS', status: 'Live in this build',
    items: [
      [CheckCircle2, 'LMS: lessons, assignments with rubrics, auto-marked quizzes, live classes, progress tracking, kids mode'],
      [CheckCircle2, 'AI early-warning: explainable dropout / failure risk with suggested interventions'],
      [CheckCircle2, 'AI timetable solver: clash-free, balanced schedules in one click'],
      [CheckCircle2, 'AI grading assistant (teacher-confirmed) and similarity check'],
      [CheckCircle2, 'UnifiedTree Assistant & course tutor — grounded in your data and lessons, Claude-ready'],
    ],
  },
  {
    name: 'Phase 3b — Verifiable credentials', status: 'Live in this build',
    items: [
      [CheckCircle2, 'W3C Verifiable Credentials 2.0, signed with ECDSA P-256 (ecdsa-jcs-2019), did:web issuer identity'],
      [CheckCircle2, 'Open Badges 3.0 badges, progress reports, grade cards, transcripts, enrolment letters, PhD milestones'],
      [CheckCircle2, 'Public verifier with QR codes, revocation status and a hash-chained anchoring ledger'],
      [CheckCircle2, 'Learner wallet with holder-controlled sharing'],
      [CheckCircle2, 'Academic Bank of Credits / ECTS credit bank, NEP 2020 exit milestones, DigiLocker push (sandbox)'],
    ],
  },
  {
    name: 'Phase 3c — Research & compliance', status: 'Next',
    items: [
      [FlaskConical, 'Full PhD lifecycle: RAC/DRC, plagiarism, examiners, viva, ORCID/Scopus, grants'],
      [FileBarChart2, 'Accreditation report builders: NAAC, NBA, NIRF, AISHE, UDISE+, IPEDS, HESA'], [Bot, 'Live Claude integration on a real backend (see docs/AI.md)'], [Award, 'OID4VCI wallet import, degree-award workflow, production ABC / DigiLocker APIs'],
      [MonitorPlay, 'SCORM / xAPI packages, adaptive learning paths, discussion forums'],
    ],
  },
  {
    name: 'Phase 4 — Ecosystem', status: 'Planned',
    items: [[BookOpenCheck, 'Mobile apps (offline-first), production backend, public APIs'], [Wallet, 'Learner wallet across institutions & employers'], [Bus, 'Marketplace, alumni & placements']],
  },
] as const

export default function RoadmapPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('nav.roadmap')} description="The full module plan is in docs/BLUEPRINT.md." />
      <div className="grid gap-4 lg:grid-cols-2">
        {PHASES.map((p) => (
          <Card key={p.name}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <Badge variant={p.status.startsWith('Live') ? 'success' : p.status === 'Next' ? 'info' : 'muted'}>{p.status}</Badge>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-sm">
                {p.items.map(([Icon, label]) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <Icon className={p.status.startsWith('Live') ? 'mt-0.5 size-4 shrink-0 text-success' : 'mt-0.5 size-4 shrink-0 text-muted-foreground'} />
                    {label}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
