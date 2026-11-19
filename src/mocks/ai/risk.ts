// Early-warning model: a transparent logistic score over a handful of explainable features.
// Coefficients are deliberately simple so every flag can be explained to a teacher or parent.
import type { Db } from '../seed'
import type { Learner, Tenant } from '@/types'
import { passMark } from '@/lib/frameworks'

export const MODEL_CARD = {
  name: 'UnifiedTree Early-Warning v1 (logistic, explainable)',
  intercept: -3.2,
  features: [
    { key: 'attendance', label: 'Attendance below 90%', coef: 7, help: 'Shortfall of overall attendance below 90%' },
    { key: 'trend', label: 'Recent attendance drop', coef: 5, help: 'Last 10 working days compared with the term before' },
    { key: 'academic', label: 'Low marks', coef: 6, help: 'Shortfall of average marks below 65%' },
    { key: 'fails', label: 'Subjects below pass mark', coef: 0.7, help: 'Number of subjects under the framework pass mark' },
    { key: 'fees', label: 'Fees overdue', coef: 0.8, help: 'An overdue invoice — often a sign of family stress' },
    { key: 'lms', label: 'Missing coursework', coef: 1.6, help: 'Share of assignments past due that were not submitted' },
  ],
  limits: [
    'Supports — never replaces — a teacher’s judgement. No automated decision is taken from this score.',
    'Scores are recalculated live from attendance, marks, fees and coursework; no hidden data is used.',
    'Caste, religion, gender and other protected attributes are never model inputs.',
  ],
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
const today = () => new Date().toISOString().slice(0, 10)

export interface RiskRow {
  learnerId: string
  name: string
  sectionId: string
  sectionName: string
  level: Learner['level']
  probability: number
  tier: 'HIGH' | 'MEDIUM' | 'LOW'
  features: { attendance: number | null; recentAttendance: number | null; academic: number | null; fails: number; feeOverdue: boolean; missingWork: number }
  contributions: { key: string; label: string; value: number; detail: string }[]
  interventions: string[]
}

export function computeRisk(db: Db, tenant: Tenant, learnerIds?: Set<string>): RiskRow[] {
  const learners = db.learners.filter((l) => l.tenantId === tenant.id && l.status === 'ACTIVE' && l.level !== 'PHD' && l.level !== 'PRE_PRIMARY' && (!learnerIds || learnerIds.has(l.id)))
  const bySection = new Map<string, typeof db.attendance>()
  db.attendance.filter((a) => a.tenantId === tenant.id).forEach((a) => bySection.set(a.sectionId, [...(bySection.get(a.sectionId) ?? []), a]))
  bySection.forEach((list) => list.sort((x, y) => x.date.localeCompare(y.date)))
  const assessments = db.assessments.filter((a) => a.tenantId === tenant.id && a.status !== 'SCHEDULED')
  const pm = passMark(tenant.framework)
  const t = today()
  const overdueByLearner = new Set(
    db.invoices.filter((i) => i.tenantId === tenant.id && i.dueDate < t).filter((i) => {
      const net = Math.max(0, i.items.reduce((s, x) => s + x.amount, 0) - i.discount) + i.lateFee
      return i.payments.reduce((s, p) => s + p.amount, 0) < net
    }).map((i) => i.learnerId),
  )
  const sectionNames = new Map(db.sections.map((s) => [s.id, s.name]))

  return learners.map((l) => {
    const sheets = (bySection.get(l.sectionId) ?? []).filter((s) => s.marks[l.id])
    const presentShare = (list: typeof sheets) => (list.length ? list.filter((s) => s.marks[l.id] !== 'A').length / list.length : null)
    const att = presentShare(sheets)
    const recent = presentShare(sheets.slice(-10))
    const before = presentShare(sheets.slice(0, -10))
    // academic: mean % over all entered marks
    const pcts: number[] = []
    const perCourse = new Map<string, number[]>()
    for (const m of db.marks) {
      if (m.sectionId !== l.sectionId) continue
      const a = assessments.find((x) => x.id === m.assessmentId)
      const v = m.marks[l.id]
      if (!a || v === undefined || v === null) continue
      const p = v / a.maxMarks
      pcts.push(p)
      perCourse.set(m.courseId, [...(perCourse.get(m.courseId) ?? []), p])
    }
    const academic = pcts.length ? pcts.reduce((x, y) => x + y, 0) / pcts.length : null
    const failing = [...perCourse.entries()].filter(([, v]) => (v.reduce((x, y) => x + y, 0) / v.length) * 100 < pm)
    const dueAssignments = db.assignments.filter((x) => x.sectionId === l.sectionId && x.dueAt < new Date().toISOString())
    const missing = dueAssignments.filter((x) => !db.submissions.some((s) => s.assignmentId === x.id && s.learnerId === l.id)).length
    const missingWork = dueAssignments.length ? missing / dueAssignments.length : 0
    const feeOverdue = overdueByLearner.has(l.id)

    const raw = {
      attendance: att === null ? 0 : Math.max(0, 0.9 - att),
      trend: recent !== null && before !== null ? Math.max(0, before - recent) : 0,
      academic: academic === null ? 0 : Math.max(0, 0.65 - academic),
      fails: failing.length,
      fees: feeOverdue ? 1 : 0,
      lms: missingWork,
    }
    const contributions = MODEL_CARD.features.map((f) => {
      const value = f.coef * raw[f.key as keyof typeof raw]
      const detail =
        f.key === 'attendance' ? `Attendance ${att === null ? '—' : Math.round(att * 100) + '%'}`
        : f.key === 'trend' ? `Last 10 days ${recent === null ? '—' : Math.round(recent * 100) + '%'} vs ${before === null ? '—' : Math.round(before * 100) + '%'} before`
        : f.key === 'academic' ? `Average marks ${academic === null ? '—' : Math.round(academic * 100) + '%'}`
        : f.key === 'fails' ? (failing.length ? `${failing.length} subject(s) under ${pm}%: ${failing.map(([c]) => db.courses.find((x) => x.id === c)?.name).join(', ')}` : 'No subject below pass mark')
        : f.key === 'fees' ? (feeOverdue ? 'Invoice overdue' : 'No overdue fees')
        : `${missing} of ${dueAssignments.length} assignments not submitted`
      return { key: f.key, label: f.label, value: Math.round(value * 100) / 100, detail }
    }).sort((x, y) => y.value - x.value)
    const z = MODEL_CARD.intercept + contributions.reduce((s, c) => s + c.value, 0)
    const probability = Math.round(sigmoid(z) * 1000) / 10
    const tier: RiskRow['tier'] = probability >= 50 ? 'HIGH' : probability >= 25 ? 'MEDIUM' : 'LOW'
    const top = contributions.filter((c) => c.value > 0.2)
    const interventions: string[] = []
    for (const c of top.slice(0, 3)) {
      if (c.key === 'attendance' || c.key === 'trend') interventions.push('Call the guardian and agree an attendance plan; check for health or transport issues.')
      if (c.key === 'academic' || c.key === 'fails') interventions.push(`Enrol in remedial sessions${failing.length ? ` for ${failing.map(([cid]) => db.courses.find((x) => x.id === cid)?.name).join(', ')}` : ''}; assign a peer mentor.`)
      if (c.key === 'fees') interventions.push('Refer to the accounts office for an instalment plan or scholarship eligibility check.')
      if (c.key === 'lms') interventions.push('Teacher follow-up on missing coursework; extend deadline once with a check-in.')
    }
    if (tier === 'HIGH') interventions.push('Schedule a counsellor meeting within a week and log the outcome.')
    return {
      learnerId: l.id, name: `${l.firstName} ${l.lastName}`, sectionId: l.sectionId, sectionName: sectionNames.get(l.sectionId) ?? '', level: l.level,
      probability, tier,
      features: { attendance: att === null ? null : Math.round(att * 1000) / 10, recentAttendance: recent === null ? null : Math.round(recent * 1000) / 10, academic: academic === null ? null : Math.round(academic * 1000) / 10, fails: failing.length, feeOverdue, missingWork: Math.round(missingWork * 100) },
      contributions, interventions: [...new Set(interventions)],
    }
  }).sort((a, b) => b.probability - a.probability)
}
