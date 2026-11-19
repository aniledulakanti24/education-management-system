// UnifiedTree Assistant — on-device engine.
// Role-aware intent routing over live ERP data, plus a retrieval tutor over published lessons.
// Every answer is computed from data the signed-in user is already allowed to see.
// In production this module is replaced by a backend that calls Claude with the same tools (see docs/AI.md).
import type { Db } from '../seed'
import type { Lesson, Tenant, User } from '@/types'
import { attendanceStats, pct, visibleLearnerIds } from '../handlers'
import { invoiceView, reportCard } from '../handlers-phase2'
import { computeRisk } from './risk'

export interface AssistantAnswer {
  text: string
  table?: { columns: string[]; rows: (string | number)[][] }
  links?: { label: string; href: string }[]
  sources?: { lessonId: string; title: string; course: string; href: string }[]
  suggestions: string[]
  intent: string
}

const STOP = new Set('a an the is are was were be to of in on for and or what how why does do did explain tell me about define please can you with by from as at it this that these those i my we our your who which'.split(' '))
const tokens = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/u, '')

export const SUGGESTIONS: Record<string, string[]> = {
  INST_ADMIN: ['Who is at risk of dropping out?', 'Attendance below 75% in G10-A', 'Fee defaulters', 'Top performers in G3-A', 'How many learners by level?'],
  FACULTY: ['Which of my students are at risk?', 'Submissions I need to grade', 'My classes today', 'Attendance below 80%', 'Top performers'],
  STUDENT: ['What is due this week?', 'How am I doing?', 'Explain photosynthesis', 'My classes today', 'My attendance'],
  GUARDIAN: ['How are my children doing?', 'Any fees due?', 'Homework due this week', 'Attendance this month'],
}

function lessonsFor(db: Db, user: User): Lesson[] {
  const own = new Set<string>()
  if (user.role === 'STUDENT') db.learners.filter((l) => l.id === user.personId).forEach((l) => own.add(l.sectionId))
  if (user.role === 'GUARDIAN') db.learners.filter((l) => user.learnerIds?.includes(l.id)).forEach((l) => own.add(l.sectionId))
  if (user.role === 'FACULTY') db.slots.filter((s) => s.staffId === user.personId).forEach((s) => own.add(s.sectionId))
  return db.lessons.filter((l) => l.tenantId === user.tenantId && (user.role === 'INST_ADMIN' || own.has(l.sectionId)))
}

/** TF-IDF retrieval over lesson text; returns the best passages with their source lesson. */
export function retrieve(db: Db, user: User, question: string, scope?: { sectionId: string; courseId: string }) {
  let docs = lessonsFor(db, user)
  if (scope) docs = docs.filter((d) => d.sectionId === scope.sectionId && d.courseId === scope.courseId)
  docs = docs.filter((d) => d.module !== 'Getting started')
  const q = [...new Set(tokens(question).map(stem))]
  if (!q.length || !docs.length) return []
  const docTokens = docs.map((d) => tokens(`${d.title} ${d.title} ${d.body}`).map(stem))
  const df = new Map<string, number>()
  docTokens.forEach((ts) => new Set(ts).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)))
  const idf = (t: string) => Math.log(1 + docs.length / (1 + (df.get(t) ?? 0)))
  return docs.map((d, i) => {
    const tf = new Map<string, number>()
    docTokens[i].forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1))
    const score = q.reduce((s, t) => s + (tf.get(t) ?? 0) * idf(t), 0) / Math.sqrt(docTokens[i].length)
    const sentences = d.body.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 20)
    const best = sentences.map((s) => ({ s, hit: tokens(s).map(stem).filter((t) => q.includes(t)).length })).filter((x) => x.hit > 0).sort((a, b) => b.hit - a.hit).slice(0, 3)
    const passage = sentences.filter((s) => best.some((b) => b.s === s)).join(' ')
    return { lesson: d, score, passage }
  }).filter((r) => r.score > 0.15 && r.passage).sort((a, b) => b.score - a.score).slice(0, 2)
}

function sectionsMentioned(db: Db, tenant: Tenant, q: string) {
  const lower = q.toLowerCase()
  const secs = db.sections.filter((s) => s.tenantId === tenant.id && lower.includes(s.name.toLowerCase()))
  const grade = lower.match(/grade\s*(\d{1,2})/)
  if (grade) {
    const prog = db.programs.find((p) => p.tenantId === tenant.id && p.code === `G${grade[1]}`)
    if (prog) db.sections.filter((s) => s.programId === prog.id).forEach((s) => secs.includes(s) || secs.push(s))
  }
  return secs
}

export function answer(db: Db, user: User, tenant: Tenant, question: string, scope?: { sectionId: string; courseId: string }): AssistantAnswer {
  const q = question.trim()
  const lower = q.toLowerCase()
  const role = user.role
  const suggestions = SUGGESTIONS[role] ?? []
  const vis = visibleLearnerIds(db, user)
  const staffish = role === 'INST_ADMIN' || role === 'FACULTY'
  const mySelf = role === 'STUDENT' ? db.learners.filter((l) => l.id === user.personId) : role === 'GUARDIAN' ? db.learners.filter((l) => user.learnerIds?.includes(l.id)) : []
  const sections = sectionsMentioned(db, tenant, q)
  const inScope = (learnerId: string, sectionId: string) => (vis === null || vis.has(learnerId)) && (!sections.length || sections.some((s) => s.id === sectionId))
  const scopeLabel = sections.length ? ` in ${sections.map((s) => s.name).join(', ')}` : ''

  if (scope) {
    const titles = db.lessons.filter((l) => l.sectionId === scope.sectionId && l.courseId === scope.courseId && l.module !== 'Getting started' && l.kind !== 'LINK').map((l) => `Explain ${l.title.toLowerCase()}`)
    return tutor(db, user, q, scope, titles.slice(0, 4))
  }

  if (/^(help|hi|hello|what can you do)/.test(lower)) {
    return { intent: 'help', suggestions, text: `I can answer questions about ${staffish ? 'attendance, at-risk learners, results, fees and timetables for the learners you can see' : 'your classes, homework, results, attendance and fees'}, and explain topics from published lessons. I only use data your account is allowed to view. Try one of the suggestions below.` }
  }

  // ---- at risk
  if (staffish && /(risk|drop ?out|struggl|early warning|attention)/.test(lower)) {
    const ids = vis === null ? undefined : vis
    const rows = computeRisk(db, tenant, ids).filter((r) => !sections.length || sections.some((s) => s.id === r.sectionId)).filter((r) => r.tier !== 'LOW').slice(0, 10)
    return {
      intent: 'risk', suggestions,
      text: rows.length ? `${rows.length} learner(s)${scopeLabel} are flagged medium or high risk. Top reasons are shown; open Insights for the full explanation and suggested interventions.` : `No learners${scopeLabel} are currently flagged.`,
      table: rows.length ? { columns: ['Learner', 'Section', 'Risk', 'Main reason'], rows: rows.map((r) => [r.name, r.sectionName, `${r.probability}% · ${r.tier.toLowerCase()}`, r.contributions[0]?.detail ?? '']) } : undefined,
      links: [{ label: 'Open AI insights', href: '/insights' }],
    }
  }

  // ---- attendance
  if (/attendance|absent|present/.test(lower)) {
    if (staffish) {
      const th = Number(lower.match(/(\d{2})\s*%?/)?.[1] ?? 75)
      const stats = attendanceStats(db, tenant.id)
      const rows = db.learners.filter((l) => l.tenantId === tenant.id && l.status === 'ACTIVE' && inScope(l.id, l.sectionId))
        .map((l) => ({ l, p: pct(stats.get(l.id)) })).filter((x) => x.p !== null && x.p < th).sort((a, b) => a.p! - b.p!)
      return {
        intent: 'attendance', suggestions,
        text: rows.length ? `${rows.length} learner(s)${scopeLabel} are below ${th}% attendance.` : `Everyone${scopeLabel} is at or above ${th}% attendance.`,
        table: rows.length ? { columns: ['Learner', 'Section', 'Attendance'], rows: rows.slice(0, 15).map(({ l, p }) => [`${l.firstName} ${l.lastName}`, db.sections.find((s) => s.id === l.sectionId)?.name ?? '', `${p}%`]) } : undefined,
        links: [{ label: 'Go to attendance', href: '/attendance' }],
      }
    }
    const stats = attendanceStats(db, tenant.id)
    return {
      intent: 'attendance', suggestions,
      text: mySelf.map((l) => `${role === 'GUARDIAN' ? l.firstName : 'Your'} attendance is ${pct(stats.get(l.id)) ?? '—'}%${(pct(stats.get(l.id)) ?? 100) < 75 ? ' — below the 75% minimum, please talk to the class teacher.' : '.'}`).join(' '),
    }
  }

  // ---- fees
  if (/fee|dues|outstanding|defaulter|payment|invoice/.test(lower)) {
    const invs = db.invoices.filter((i) => i.tenantId === tenant.id && (vis === null || vis.has(i.learnerId))).map((i) => invoiceView(db, i))
    if (role === 'INST_ADMIN') {
      const owing = invs.filter((i) => i.balance > 0).sort((a, b) => b.balance - a.balance)
      const total = owing.reduce((s, i) => s + i.balance, 0)
      return {
        intent: 'fees', suggestions,
        text: `${owing.length} invoice(s) have a balance, totalling ${tenant.currency} ${total.toLocaleString()}. ${owing.filter((i) => i.status === 'OVERDUE').length} are overdue.`,
        table: { columns: ['Learner', 'Invoice', 'Balance', 'Status'], rows: owing.slice(0, 10).map((i) => [i.learnerName, i.number, `${tenant.currency} ${i.balance.toLocaleString()}`, i.status.toLowerCase()]) },
        links: [{ label: 'Open fees', href: '/fees' }],
      }
    }
    if (role === 'FACULTY') return { intent: 'fees', suggestions, text: 'Fee information is available to the accounts office and families only.' }
    const due = invs.filter((i) => i.balance > 0)
    return {
      intent: 'fees', suggestions,
      text: due.length ? due.map((i) => `${i.learnerName}: ${tenant.currency} ${i.balance.toLocaleString()} due on ${i.dueDate}${i.status === 'OVERDUE' ? ' (overdue)' : ''}.`).join(' ') : 'No fees are due — everything is paid.',
      links: [{ label: 'Pay or view receipts', href: '/fees' }],
    }
  }

  // ---- results / performance
  if (/\btop\b|topper|best|perform|result|marks|how am i|doing|lowest|weak/.test(lower) && !/submission|to grade/.test(lower)) {
    if (staffish) {
      const learners = db.learners.filter((l) => l.tenantId === tenant.id && l.status === 'ACTIVE' && l.level !== 'PHD' && l.level !== 'PRE_PRIMARY' && inScope(l.id, l.sectionId))
      const scored = learners.map((l) => ({ l, rc: reportCard(db, user, tenant, l) })).filter((x) => x.rc.overall !== null)
      const low = /lowest|weak|bottom|fail/.test(lower)
      scored.sort((a, b) => (low ? a.rc.overall! - b.rc.overall! : b.rc.overall! - a.rc.overall!))
      return {
        intent: 'performance', suggestions,
        text: `${low ? 'Lowest' : 'Top'} performers${scopeLabel} by term result so far:`,
        table: { columns: ['Learner', 'Section', 'Overall', 'Grade'], rows: scored.slice(0, 8).map(({ l, rc }) => [`${l.firstName} ${l.lastName}`, rc.learner.sectionName, `${rc.overall}%`, rc.overallGrade ?? '']) },
        links: [{ label: 'Open gradebook', href: '/exams' }],
      }
    }
    const parts = mySelf.map((l) => {
      const rc = reportCard(db, user, tenant, l)
      if (rc.overall === null) return `${l.firstName}: no published results yet.`
      const best = [...rc.rows].filter((r) => r.percent !== null).sort((a, b) => b.percent! - a.percent!)
      return `${role === 'GUARDIAN' ? l.firstName : 'You'}: ${rc.overall}% overall (${rc.overallGrade}${rc.gpa !== null ? `, ${rc.gpaLabel} ${rc.gpa}` : ''}${rc.rank ? `, rank ${rc.rank} of ${rc.classSize}` : ''}). Strongest: ${best[0]?.courseName}; needs most attention: ${best[best.length - 1]?.courseName}.`
    })
    return { intent: 'performance', suggestions, text: parts.join(' '), links: [{ label: 'Open report card', href: '/results' }] }
  }

  // ---- homework / assignments
  if (/assignment|homework|due|submi|to grade|quiz/.test(lower)) {
    if (role === 'FACULTY' || role === 'INST_ADMIN') {
      const mine = db.assignments.filter((a) => a.tenantId === tenant.id && (role === 'INST_ADMIN' || a.createdBy === user.personId))
      const pending = mine.map((a) => ({ a, n: db.submissions.filter((s) => s.assignmentId === a.id && s.status === 'SUBMITTED').length })).filter((x) => x.n > 0)
      return {
        intent: 'grading', suggestions,
        text: pending.length ? `${pending.reduce((s, x) => s + x.n, 0)} submission(s) are waiting to be graded. The AI grading assistant can draft scores against your rubric.` : 'Nothing is waiting to be graded.',
        table: pending.length ? { columns: ['Assignment', 'Section', 'To grade'], rows: pending.map(({ a, n }) => [a.title, db.sections.find((s) => s.id === a.sectionId)?.name ?? '', n]) } : undefined,
        links: [{ label: 'Open Learn', href: '/learn' }],
      }
    }
    const now = new Date().toISOString()
    const rows: (string | number)[][] = []
    for (const l of mySelf) {
      db.assignments.filter((a) => a.sectionId === l.sectionId && a.dueAt > now && !db.submissions.some((s) => s.assignmentId === a.id && s.learnerId === l.id))
        .forEach((a) => rows.push([l.firstName, a.title, db.courses.find((c) => c.id === a.courseId)?.name ?? '', a.dueAt.slice(0, 10)]))
      db.quizzes.filter((z) => z.sectionId === l.sectionId && z.dueAt > now && !db.quizAttempts.some((t) => t.quizId === z.id && t.learnerId === l.id))
        .forEach((z) => rows.push([l.firstName, `Quiz: ${z.title}`, db.courses.find((c) => c.id === z.courseId)?.name ?? '', z.dueAt.slice(0, 10)]))
    }
    return {
      intent: 'todo', suggestions,
      text: rows.length ? `${rows.length} item(s) to finish:` : 'Nothing due — great job staying on top of your work!',
      table: rows.length ? { columns: role === 'GUARDIAN' ? ['Child', 'Work', 'Course', 'Due'] : ['', 'Work', 'Course', 'Due'], rows: role === 'GUARDIAN' ? rows : rows.map((r) => ['•', ...r.slice(1)]) } : undefined,
      links: [{ label: 'Open Learn', href: '/learn' }],
    }
  }

  // ---- timetable
  if (/timetable|schedule|class(es)? today|today|tomorrow|next class|what.?s next/.test(lower)) {
    const d = new Date()
    if (/tomorrow/.test(lower)) d.setDate(d.getDate() + 1)
    const day = ((d.getDay() + 6) % 7) + 1
    const slots = db.slots.filter((s) => s.tenantId === tenant.id && s.day === day && (role === 'FACULTY' ? s.staffId === user.personId : mySelf.some((l) => l.sectionId === s.sectionId))).sort((a, b) => a.period - b.period)
    const periods = db.periods[tenant.id] ?? []
    return {
      intent: 'timetable', suggestions,
      text: slots.length ? `${/tomorrow/.test(lower) ? 'Tomorrow' : 'Today'} you have ${slots.length} class(es).` : `No classes ${/tomorrow/.test(lower) ? 'tomorrow' : 'today'}.`,
      table: slots.length ? { columns: ['Time', 'Course', role === 'FACULTY' ? 'Section' : 'Teacher', 'Room'], rows: slots.map((s) => [periods.find((p) => p.no === s.period)?.start ?? `P${s.period}`, db.courses.find((c) => c.id === s.courseId)?.name ?? '', role === 'FACULTY' ? db.sections.find((x) => x.id === s.sectionId)?.name ?? '' : db.staff.find((x) => x.id === s.staffId)?.name ?? '', s.room]) } : undefined,
    }
  }

  // ---- counts
  if (role === 'INST_ADMIN' && /how many|count|number of/.test(lower)) {
    const counts = new Map<string, number>()
    db.learners.filter((l) => l.tenantId === tenant.id && l.status === 'ACTIVE').forEach((l) => counts.set(l.level, (counts.get(l.level) ?? 0) + 1))
    const total = [...counts.values()].reduce((s, n) => s + n, 0)
    return { intent: 'counts', suggestions, text: `${total} active learners.`, table: { columns: ['Level', 'Learners'], rows: [...counts.entries()].map(([k, v]) => [k.replace('_', ' ').toLowerCase(), v]) } }
  }

  // ---- who teaches
  const who = lower.match(/who teaches (.+?)(\?|$| in )/)
  if (who) {
    const SYN: Record<string, string> = { maths: 'mathematic', math: 'mathematic', bio: 'biolog', chem: 'chemist', cs: 'computer', os: 'operating', ml: 'machine learning', dbms: 'database', evs: 'evs', sst: 'social' }
    const raw = who[1].trim().replace(/^(the|our|my)\s+/, '')
    const term = SYN[raw] ?? raw
    const slots = db.slots.filter((s) => s.tenantId === tenant.id && (db.courses.find((c) => c.id === s.courseId)?.name.toLowerCase().includes(term) ?? false) && (!sections.length || sections.some((x) => x.id === s.sectionId)) && (role === 'INST_ADMIN' || role === 'FACULTY' || mySelf.some((l) => l.sectionId === s.sectionId)))
    const pairs = [...new Map(slots.map((s) => [`${s.staffId}|${s.sectionId}|${s.courseId}`, s])).values()]
    return {
      intent: 'who-teaches', suggestions,
      text: pairs.length ? `Found ${pairs.length} class(es) for “${term}”.` : `I couldn't find a course matching “${term}”.`,
      table: pairs.length ? { columns: ['Course', 'Section', 'Teacher'], rows: pairs.slice(0, 12).map((s) => [db.courses.find((c) => c.id === s.courseId)?.name ?? '', db.sections.find((x) => x.id === s.sectionId)?.name ?? '', db.staff.find((x) => x.id === s.staffId)?.name ?? '']) } : undefined,
    }
  }

  return tutor(db, user, q, undefined, suggestions)
}

function tutor(db: Db, user: User, q: string, scope: { sectionId: string; courseId: string } | undefined, suggestions: string[]): AssistantAnswer {
  const hits = retrieve(db, user, q, scope)
  if (!hits.length) {
    return {
      intent: 'fallback', suggestions,
      text: scope ? 'I could not find that in this course’s lessons yet. Try different words, or ask your teacher in Messages.' : 'I’m not sure about that one. I can explain topics from published lessons or answer questions about your school data — try a suggestion below.',
    }
  }
  const top = hits[0]
  const course = db.courses.find((c) => c.id === top.lesson.courseId)?.name ?? ''
  return {
    intent: 'tutor', suggestions,
    text: `${top.passage}\n\nWant to go deeper? Re-read “${top.lesson.title}” and try explaining it in your own words — then check yourself with the course quiz.`,
    sources: hits.map((h) => ({ lessonId: h.lesson.id, title: h.lesson.title, course: db.courses.find((c) => c.id === h.lesson.courseId)?.name ?? course, href: `/learn/${h.lesson.sectionId}/${h.lesson.courseId}?lesson=${h.lesson.id}` })),
  }
}
