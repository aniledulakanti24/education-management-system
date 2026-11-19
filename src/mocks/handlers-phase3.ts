// Phase 3 mock API: LMS (lessons, assignments, quizzes, live classes) and AI services.
import { http } from 'msw'
import { persist } from './db'
import type { Db } from './seed'
import { examinableCourses } from './seed-phase2'
import { ApiError, ageOf, audit, auth, byTenant, handle, requireRole } from './handlers'
import { computeRisk, MODEL_CARD } from './ai/risk'
import { solveTimetable } from './ai/scheduler'
import { similarPairs, suggestGrade } from './ai/grading'
import { answer, SUGGESTIONS } from './ai/assistant'
import type { Assignment, Lesson, Quiz, RubricCriterion, TimetableSlot, User } from '@/types'

const nowIso = () => new Date().toISOString()
const name = (db: Db, learnerId: string) => {
  const l = db.learners.find((x) => x.id === learnerId)
  return l ? `${l.firstName} ${l.lastName}` : '—'
}

type Access = 'TEACHER' | 'LEARNER' | 'GUARDIAN'
function classAccess(db: Db, user: User, sectionId: string, courseId: string): Access {
  const section = db.sections.find((s) => s.id === sectionId && s.tenantId === user.tenantId)
  if (!section || !db.courses.some((c) => c.id === courseId && c.programId === section.programId)) throw new ApiError(404, 'Class not found')
  if (user.role === 'INST_ADMIN') return 'TEACHER'
  if (user.role === 'FACULTY' && (db.slots.some((s) => s.sectionId === sectionId && s.courseId === courseId && s.staffId === user.personId) || section.classTeacherId === user.personId)) return 'TEACHER'
  if (user.role === 'STUDENT' && db.learners.some((l) => l.id === user.personId && l.sectionId === sectionId)) return 'LEARNER'
  if (user.role === 'GUARDIAN' && db.learners.some((l) => user.learnerIds?.includes(l.id) && l.sectionId === sectionId)) return 'GUARDIAN'
  throw new ApiError(403, 'You do not have access to this class')
}
const requireTeacher = (a: Access) => { if (a !== 'TEACHER') throw new ApiError(403, 'Only the class teacher can do this') }

function learnerFor(db: Db, user: User, sectionId: string) {
  if (user.role === 'STUDENT') return db.learners.find((l) => l.id === user.personId)
  if (user.role === 'GUARDIAN') return db.learners.find((l) => user.learnerIds?.includes(l.id) && l.sectionId === sectionId)
  return undefined
}

function classSummary(db: Db, sectionId: string, courseId: string, learnerId?: string) {
  const lessons = db.lessons.filter((l) => l.sectionId === sectionId && l.courseId === courseId)
  const done = learnerId ? (db.lessonDone[learnerId] ?? []) : []
  const assignments = db.assignments.filter((a) => a.sectionId === sectionId && a.courseId === courseId)
  const quizzes = db.quizzes.filter((q) => q.sectionId === sectionId && q.courseId === courseId)
  const now = nowIso()
  const course = db.courses.find((c) => c.id === courseId)!
  const section = db.sections.find((s) => s.id === sectionId)!
  const teacherId = db.slots.find((s) => s.sectionId === sectionId && s.courseId === courseId)?.staffId
  return {
    sectionId, courseId, courseName: course.name, courseCode: course.code, sectionName: section.name, teacherName: db.staff.find((s) => s.id === teacherId)?.name ?? '—',
    lessons: lessons.length, completed: lessons.filter((l) => done.includes(l.id)).length,
    assignments: assignments.length, quizzes: quizzes.length,
    todo: learnerId
      ? assignments.filter((a) => a.dueAt > now && !db.submissions.some((s) => s.assignmentId === a.id && s.learnerId === learnerId)).length
        + quizzes.filter((q) => q.dueAt > now && !db.quizAttempts.some((t) => t.quizId === q.id && t.learnerId === learnerId)).length
      : 0,
    toGrade: assignments.reduce((s, a) => s + db.submissions.filter((x) => x.assignmentId === a.id && x.status === 'SUBMITTED').length, 0),
    nextLive: db.liveSessions.filter((v) => v.sectionId === sectionId && v.courseId === courseId && v.startsAt > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null,
  }
}

export const phase3Handlers = [
  // ================= LMS =================
  http.get('/api/lms/classes', handle(({ request }) => {
    const { db, user } = auth(request)
    if (user.role === 'FACULTY' || user.role === 'INST_ADMIN') {
      const pairs = new Set<string>()
      if (user.role === 'FACULTY') db.slots.filter((s) => s.staffId === user.personId).forEach((s) => pairs.add(`${s.sectionId}|${s.courseId}`))
      else byTenant(db.lessons, user.tenantId).forEach((l) => pairs.add(`${l.sectionId}|${l.courseId}`))
      const classes = [...pairs].map((p) => p.split('|')).filter(([s, c]) => examinableCourses(db, s).some((x) => x.id === c)).map(([s, c]) => classSummary(db, s, c))
      return { role: 'TEACHER', kidMode: false, groups: [{ learnerId: null, learnerName: null, classes: classes.sort((a, b) => a.sectionName.localeCompare(b.sectionName) || a.courseName.localeCompare(b.courseName)) }] }
    }
    const learners = user.role === 'STUDENT' ? db.learners.filter((l) => l.id === user.personId) : db.learners.filter((l) => user.learnerIds?.includes(l.id))
    return {
      role: user.role === 'STUDENT' ? 'LEARNER' : 'GUARDIAN',
      kidMode: user.role === 'STUDENT' && learners[0] ? ageOf(learners[0].dob) < 11 : false,
      groups: learners.map((l) => ({ learnerId: l.id, learnerName: `${l.firstName} ${l.lastName}`, classes: examinableCourses(db, l.sectionId).map((c) => classSummary(db, l.sectionId, c.id, l.id)) })),
    }
  })),

  http.get('/api/lms/classes/:sectionId/:courseId', handle<{ sectionId: string; courseId: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    const access = classAccess(db, user, params.sectionId, params.courseId)
    const me = learnerFor(db, user, params.sectionId)
    const done = me ? db.lessonDone[me.id] ?? [] : []
    const lessons = db.lessons.filter((l) => l.sectionId === params.sectionId && l.courseId === params.courseId)
      .sort((a, b) => a.module.localeCompare(b.module) || a.order - b.order).map((l) => ({ ...l, done: done.includes(l.id) }))
    const roster = db.learners.filter((l) => l.sectionId === params.sectionId && l.status === 'ACTIVE')
    const assignments = db.assignments.filter((a) => a.sectionId === params.sectionId && a.courseId === params.courseId).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((a) => {
      const subs = db.submissions.filter((s) => s.assignmentId === a.id)
      return { ...a, submitted: subs.length, graded: subs.filter((s) => s.status === 'GRADED').length, roster: roster.length, mine: me ? subs.find((s) => s.learnerId === me.id) ?? null : null }
    })
    const quizzes = db.quizzes.filter((q) => q.sectionId === params.sectionId && q.courseId === params.courseId).map((q) => {
      const atts = db.quizAttempts.filter((t) => t.quizId === q.id)
      const mine = me ? atts.find((t) => t.learnerId === me.id) ?? null : null
      return {
        id: q.id, title: q.title, dueAt: q.dueAt, timeLimitMin: q.timeLimitMin, questionCount: q.questions.length,
        attempts: atts.length, avgPct: atts.length ? Math.round((atts.reduce((s, t) => s + t.score / t.max, 0) / atts.length) * 100) : null, mine,
      }
    })
    const progress = access === 'TEACHER' ? roster.map((l) => {
      const d = db.lessonDone[l.id] ?? []
      const due = db.assignments.filter((a) => a.sectionId === params.sectionId && a.courseId === params.courseId && a.dueAt < nowIso())
      return {
        learnerId: l.id, name: `${l.firstName} ${l.lastName}`, rollNo: l.rollNo,
        lessonsDone: lessons.filter((x) => d.includes(x.id)).length,
        submitted: due.filter((a) => db.submissions.some((s) => s.assignmentId === a.id && s.learnerId === l.id)).length, due: due.length,
        quizAvg: (() => { const at = db.quizAttempts.filter((t) => t.learnerId === l.id && quizzes.some((q) => q.id === t.quizId)); return at.length ? Math.round((at.reduce((s, t) => s + t.score / t.max, 0) / at.length) * 100) : null })(),
      }
    }).sort((a, b) => a.rollNo - b.rollNo) : []
    return {
      access, learnerName: me ? `${me.firstName} ${me.lastName}` : null, kidMode: user.role === 'STUDENT' && me ? ageOf(me.dob) < 11 : false,
      summary: classSummary(db, params.sectionId, params.courseId, me?.id), lessons, assignments, quizzes,
      live: db.liveSessions.filter((v) => v.sectionId === params.sectionId && v.courseId === params.courseId).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      progress,
    }
  })),

  http.post('/api/lms/lessons', handle(async ({ request }) => {
    const { db, user } = auth(request)
    const b = (await request.json()) as Partial<Lesson>
    requireTeacher(classAccess(db, user, b.sectionId ?? '', b.courseId ?? ''))
    if (!b.title || !(b.body || b.url)) throw new ApiError(400, 'Title and content (text or link) are required')
    const existing = db.lessons.filter((l) => l.sectionId === b.sectionId && l.courseId === b.courseId && l.module === (b.module || 'New unit'))
    const lesson: Lesson = {
      id: `${user.tenantId}-les-${Date.now().toString(36)}`, tenantId: user.tenantId, sectionId: b.sectionId!, courseId: b.courseId!, module: b.module || 'New unit',
      order: existing.length + 1, title: b.title, kind: b.kind ?? 'ARTICLE', body: b.body ?? '', url: b.url || undefined, minutes: Number(b.minutes) || 10, publishedAt: nowIso(),
    }
    db.lessons.push(lesson)
    audit(db, user, `Published lesson “${lesson.title}”`, 'LMS')
    persist()
    return lesson
  })),

  http.post('/api/lms/lessons/:id/complete', handle<{ id: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'STUDENT')
    const lesson = db.lessons.find((l) => l.id === params.id && l.tenantId === user.tenantId)
    if (!lesson) throw new ApiError(404, 'Lesson not found')
    classAccess(db, user, lesson.sectionId, lesson.courseId)
    const list = db.lessonDone[user.personId!] ?? []
    db.lessonDone[user.personId!] = list.includes(lesson.id) ? list.filter((x) => x !== lesson.id) : [...list, lesson.id]
    persist()
    return { done: db.lessonDone[user.personId!].includes(lesson.id) }
  })),

  http.post('/api/lms/assignments', handle(async ({ request }) => {
    const { db, user } = auth(request)
    const b = (await request.json()) as Partial<Assignment>
    requireTeacher(classAccess(db, user, b.sectionId ?? '', b.courseId ?? ''))
    if (!b.title || !b.instructions || !b.dueAt) throw new ApiError(400, 'Title, instructions and due date are required')
    const rubric: RubricCriterion[] = (b.rubric ?? []).filter((r) => r.criterion && r.points > 0).map((r) => ({ criterion: r.criterion, points: Number(r.points), keywords: r.keywords.map((k) => k.trim()).filter(Boolean) }))
    const a: Assignment = {
      id: `${user.tenantId}-asg-${Date.now().toString(36)}`, tenantId: user.tenantId, sectionId: b.sectionId!, courseId: b.courseId!, title: b.title, instructions: b.instructions,
      dueAt: new Date(b.dueAt).toISOString(), maxPoints: Number(b.maxPoints) || 10, rubric: rubric.length ? rubric : [{ criterion: 'Overall quality', points: Number(b.maxPoints) || 10, keywords: [] }],
      createdBy: user.personId ?? user.id, createdAt: nowIso(),
    }
    db.assignments.push(a)
    audit(db, user, `Set assignment “${a.title}”`, 'LMS')
    persist()
    return a
  })),

  http.get('/api/lms/assignments/:id', handle<{ id: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    const a = db.assignments.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!a) throw new ApiError(404, 'Assignment not found')
    const access = classAccess(db, user, a.sectionId, a.courseId)
    if (access !== 'TEACHER') {
      const me = learnerFor(db, user, a.sectionId)
      return { assignment: a, access, submissions: db.submissions.filter((s) => s.assignmentId === a.id && s.learnerId === me?.id), flags: [] }
    }
    const subs = db.submissions.filter((s) => s.assignmentId === a.id)
    const flags = similarPairs(subs)
    const roster = db.learners.filter((l) => l.sectionId === a.sectionId && l.status === 'ACTIVE')
    return {
      assignment: a, access,
      submissions: subs.map((s) => ({ ...s, learnerName: name(db, s.learnerId), late: s.submittedAt > a.dueAt, similarTo: flags.filter((f) => f.a === s.id || f.b === s.id).map((f) => ({ name: name(db, subs.find((x) => x.id === (f.a === s.id ? f.b : f.a))!.learnerId), score: f.score })) })).sort((x, y) => x.learnerName.localeCompare(y.learnerName)),
      missing: roster.filter((l) => !subs.some((s) => s.learnerId === l.id)).map((l) => `${l.firstName} ${l.lastName}`),
      flags,
    }
  })),

  http.post('/api/lms/assignments/:id/submit', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'STUDENT')
    const a = db.assignments.find((x) => x.id === params.id && x.tenantId === user.tenantId)
    if (!a) throw new ApiError(404, 'Assignment not found')
    classAccess(db, user, a.sectionId, a.courseId)
    const { text } = (await request.json()) as { text: string }
    if (!text || text.trim().split(/\s+/).length < 5) throw new ApiError(400, 'Write at least a few sentences before submitting')
    const existing = db.submissions.find((s) => s.assignmentId === a.id && s.learnerId === user.personId)
    if (existing?.status === 'GRADED') throw new ApiError(409, 'This work has already been graded')
    const sub = existing ?? { id: `${a.id}-sub-${user.personId}`, tenantId: user.tenantId, assignmentId: a.id, learnerId: user.personId!, text: '', submittedAt: '', status: 'SUBMITTED' as const }
    sub.text = text.trim()
    sub.submittedAt = nowIso()
    if (!existing) db.submissions.push(sub)
    persist()
    return { ...sub, late: sub.submittedAt > a.dueAt }
  })),

  http.post('/api/lms/submissions/:id/suggest', handle<{ id: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    const sub = db.submissions.find((s) => s.id === params.id && s.tenantId === user.tenantId)
    const a = sub && db.assignments.find((x) => x.id === sub.assignmentId)
    if (!sub || !a) throw new ApiError(404, 'Submission not found')
    requireTeacher(classAccess(db, user, a.sectionId, a.courseId))
    return suggestGrade(a, sub.text)
  })),

  http.post('/api/lms/submissions/:id/grade', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    const sub = db.submissions.find((s) => s.id === params.id && s.tenantId === user.tenantId)
    const a = sub && db.assignments.find((x) => x.id === sub.assignmentId)
    if (!sub || !a) throw new ApiError(404, 'Submission not found')
    requireTeacher(classAccess(db, user, a.sectionId, a.courseId))
    const b = (await request.json()) as { score: number; feedback: string; aiAssisted?: boolean }
    const score = Number(b.score)
    if (Number.isNaN(score) || score < 0 || score > a.maxPoints) throw new ApiError(400, `Score must be between 0 and ${a.maxPoints}`)
    Object.assign(sub, { score, feedback: b.feedback ?? '', status: 'GRADED', gradedBy: user.personId ?? user.id, gradedAt: nowIso(), aiAssisted: !!b.aiAssisted })
    audit(db, user, `Graded “${a.title}” for ${name(db, sub.learnerId)}${b.aiAssisted ? ' (AI-assisted, teacher-confirmed)' : ''}`, 'LMS')
    persist()
    return sub
  })),

  http.post('/api/lms/quizzes', handle(async ({ request }) => {
    const { db, user } = auth(request)
    const b = (await request.json()) as Partial<Quiz>
    requireTeacher(classAccess(db, user, b.sectionId ?? '', b.courseId ?? ''))
    const questions = (b.questions ?? []).filter((q) => q.prompt && q.options.filter(Boolean).length >= 2)
    if (!b.title || !questions.length) throw new ApiError(400, 'A title and at least one complete question are required')
    const quiz: Quiz = {
      id: `${user.tenantId}-quiz-${Date.now().toString(36)}`, tenantId: user.tenantId, sectionId: b.sectionId!, courseId: b.courseId!, title: b.title,
      questions: questions.map((q, i) => ({ id: `q${i + 1}`, prompt: q.prompt, options: q.options.filter(Boolean), answer: Math.min(q.answer, q.options.filter(Boolean).length - 1), explanation: q.explanation ?? '' })),
      dueAt: b.dueAt ? new Date(b.dueAt).toISOString() : new Date(Date.now() + 7 * 864e5).toISOString(), timeLimitMin: Number(b.timeLimitMin) || questions.length * 2, createdBy: user.personId ?? user.id,
    }
    db.quizzes.push(quiz)
    audit(db, user, `Published quiz “${quiz.title}” (${quiz.questions.length} questions)`, 'LMS')
    persist()
    return quiz
  })),

  http.get('/api/lms/quizzes/:id', handle<{ id: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    const quiz = db.quizzes.find((q) => q.id === params.id && q.tenantId === user.tenantId)
    if (!quiz) throw new ApiError(404, 'Quiz not found')
    const access = classAccess(db, user, quiz.sectionId, quiz.courseId)
    const atts = db.quizAttempts.filter((t) => t.quizId === quiz.id)
    if (access === 'TEACHER') {
      return {
        quiz, access, attempts: atts.map((t) => ({ ...t, learnerName: name(db, t.learnerId) })).sort((a, b) => b.score - a.score),
        perQuestion: quiz.questions.map((q, i) => ({ id: q.id, correctPct: atts.length ? Math.round((atts.filter((t) => t.answers[i] === q.answer).length / atts.length) * 100) : null })),
      }
    }
    const me = learnerFor(db, user, quiz.sectionId)
    const mine = atts.find((t) => t.learnerId === me?.id) ?? null
    // hide answers until the learner has attempted
    return { quiz: mine ? quiz : { ...quiz, questions: quiz.questions.map((q) => ({ ...q, answer: -1, explanation: '' })) }, access, mine }
  })),

  http.post('/api/lms/quizzes/:id/attempt', handle<{ id: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'STUDENT')
    const quiz = db.quizzes.find((q) => q.id === params.id && q.tenantId === user.tenantId)
    if (!quiz) throw new ApiError(404, 'Quiz not found')
    classAccess(db, user, quiz.sectionId, quiz.courseId)
    if (db.quizAttempts.some((t) => t.quizId === quiz.id && t.learnerId === user.personId)) throw new ApiError(409, 'You have already attempted this quiz')
    const { answers } = (await request.json()) as { answers: number[] }
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) throw new ApiError(400, 'Answer every question')
    const score = answers.filter((x, i) => x === quiz.questions[i].answer).length
    const att = { id: `${quiz.id}-att-${user.personId}`, tenantId: user.tenantId, quizId: quiz.id, learnerId: user.personId!, answers, score, max: quiz.questions.length, at: nowIso() }
    db.quizAttempts.push(att)
    persist()
    return { attempt: att, quiz }
  })),

  http.post('/api/lms/live', handle(async ({ request }) => {
    const { db, user } = auth(request)
    const b = (await request.json()) as { sectionId: string; courseId: string; title: string; startsAt: string; minutes: number }
    requireTeacher(classAccess(db, user, b.sectionId, b.courseId))
    if (!b.title || !b.startsAt) throw new ApiError(400, 'Title and start time are required')
    const id = `${user.tenantId}-live-${Date.now().toString(36)}`
    const s = { id, tenantId: user.tenantId, sectionId: b.sectionId, courseId: b.courseId, title: b.title, startsAt: new Date(b.startsAt).toISOString(), minutes: Number(b.minutes) || 45, joinUrl: `https://meet.jit.si/UnifiedTree-${id}`, createdBy: user.personId ?? user.id }
    db.liveSessions.push(s)
    audit(db, user, `Scheduled live class “${s.title}”`, 'LMS')
    persist()
    return s
  })),

  http.get('/api/lms/summary', handle(({ request }) => {
    const { db, user, tenant } = auth(request)
    const now = nowIso()
    if (user.role === 'FACULTY' || user.role === 'INST_ADMIN') {
      const mine = db.assignments.filter((a) => a.tenantId === user.tenantId && (user.role === 'INST_ADMIN' || a.createdBy === user.personId))
      const toGrade = mine.reduce((s, a) => s + db.submissions.filter((x) => x.assignmentId === a.id && x.status === 'SUBMITTED').length, 0)
      const due = db.assignments.filter((a) => a.tenantId === user.tenantId && a.dueAt < now)
      const expected = due.reduce((s, a) => s + db.learners.filter((l) => l.sectionId === a.sectionId && l.status === 'ACTIVE').length, 0)
      const submitted = due.reduce((s, a) => s + db.submissions.filter((x) => x.assignmentId === a.id).length, 0)
      const atts = db.quizAttempts.filter((t) => t.tenantId === user.tenantId)
      const risk = user.role === 'INST_ADMIN' && tenant ? computeRisk(db, tenant) : []
      return {
        kind: 'teacher', toGrade, lessons: byTenant(db.lessons, user.tenantId).length,
        submissionRate: expected ? Math.round((submitted / expected) * 100) : null,
        quizAvg: atts.length ? Math.round((atts.reduce((s, t) => s + t.score / t.max, 0) / atts.length) * 100) : null,
        highRisk: risk.filter((r) => r.tier === 'HIGH').length, mediumRisk: risk.filter((r) => r.tier === 'MEDIUM').length,
        nextLive: db.liveSessions.filter((v) => v.tenantId === user.tenantId && v.startsAt > now && (user.role === 'INST_ADMIN' || v.createdBy === user.personId)).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null,
      }
    }
    const learners = user.role === 'STUDENT' ? db.learners.filter((l) => l.id === user.personId) : db.learners.filter((l) => user.learnerIds?.includes(l.id))
    return {
      kind: 'learner',
      children: learners.map((l) => {
        const classes = examinableCourses(db, l.sectionId).map((c) => classSummary(db, l.sectionId, c.id, l.id))
        const nextLesson = db.lessons.filter((x) => x.sectionId === l.sectionId && !(db.lessonDone[l.id] ?? []).includes(x.id) && x.module !== 'Getting started').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]
        return {
          learnerId: l.id, name: `${l.firstName} ${l.lastName}`,
          todo: classes.reduce((s, c) => s + c.todo, 0),
          lessons: classes.reduce((s, c) => s + c.lessons, 0), completed: classes.reduce((s, c) => s + c.completed, 0),
          nextLesson: nextLesson ? { id: nextLesson.id, title: nextLesson.title, sectionId: nextLesson.sectionId, courseId: nextLesson.courseId, courseName: db.courses.find((c) => c.id === nextLesson.courseId)?.name ?? '' } : null,
          nextLive: db.liveSessions.filter((v) => v.sectionId === l.sectionId && v.startsAt > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null,
        }
      }),
    }
  })),

  // ================= AI =================
  http.get('/api/ai/risk', handle(({ request, url }) => {
    const { db, user, tenant } = auth(request)
    requireRole(user, 'INST_ADMIN', 'FACULTY')
    let ids: Set<string> | undefined
    if (user.role === 'FACULTY') {
      const secs = new Set(db.slots.filter((s) => s.staffId === user.personId).map((s) => s.sectionId))
      ids = new Set(db.learners.filter((l) => secs.has(l.sectionId)).map((l) => l.id))
    }
    const sectionId = url.searchParams.get('sectionId')
    const rows = computeRisk(db, tenant!, ids).filter((r) => !sectionId || r.sectionId === sectionId)
    return {
      model: MODEL_CARD, rows,
      distribution: { HIGH: rows.filter((r) => r.tier === 'HIGH').length, MEDIUM: rows.filter((r) => r.tier === 'MEDIUM').length, LOW: rows.filter((r) => r.tier === 'LOW').length },
      generatedAt: nowIso(),
    }
  })),

  http.post('/api/ai/timetable/:sectionId/propose', handle<{ sectionId: string }>(({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    if (!db.sections.some((s) => s.id === params.sectionId && s.tenantId === user.tenantId)) throw new ApiError(404, 'Section not found')
    const proposal = solveTimetable(db, params.sectionId)
    const staffName = (id: string) => db.staff.find((s) => s.id === id)?.name ?? '—'
    const courseName = (id: string) => db.courses.find((c) => c.id === id)?.name ?? '—'
    return { ...proposal, slots: proposal.slots.map((s) => ({ ...s, courseName: courseName(s.courseId), staffName: staffName(s.staffId) })), currentSlots: db.slots.filter((s) => s.sectionId === params.sectionId).length }
  })),

  http.post('/api/ai/timetable/:sectionId/apply', handle<{ sectionId: string }>(async ({ request, params }) => {
    const { db, user } = auth(request)
    requireRole(user, 'INST_ADMIN')
    const { slots } = (await request.json()) as { slots: Omit<TimetableSlot, 'id' | 'tenantId'>[] }
    for (const s of slots) {
      if (s.sectionId !== params.sectionId) throw new ApiError(400, 'Proposal does not match the section')
      if (db.slots.some((x) => x.sectionId !== params.sectionId && x.staffId === s.staffId && x.day === s.day && x.period === s.period)) throw new ApiError(409, 'The timetable changed since the proposal was generated — please regenerate')
    }
    db.slots = db.slots.filter((s) => s.sectionId !== params.sectionId)
    slots.forEach((s) => db.slots.push({ ...s, id: `${s.sectionId}-${s.day}-${s.period}`, tenantId: user.tenantId }))
    db.staff.forEach((st) => slots.filter((s) => s.staffId === st.id).forEach((s) => st.courseIds.includes(s.courseId) || st.courseIds.push(s.courseId)))
    audit(db, user, `Applied AI timetable for ${db.sections.find((s) => s.id === params.sectionId)?.name} (${slots.length} periods)`, 'Timetable')
    persist()
    return { ok: true }
  })),

  http.post('/api/ai/assistant', handle(async ({ request }) => {
    const { db, user, tenant } = auth(request)
    if (!tenant) throw new ApiError(400, 'The assistant works inside an institution')
    const { question, scope } = (await request.json()) as { question: string; scope?: { sectionId: string; courseId: string } }
    if (!question?.trim()) return { intent: 'help', text: 'Ask me anything about your classes or school data.', suggestions: SUGGESTIONS[user.role] ?? [] }
    if (question.length > 500) throw new ApiError(400, 'Please keep questions under 500 characters')
    if (scope) classAccess(db, user, scope.sectionId, scope.courseId)
    return { ...answer(db, user, tenant, question, scope), engine: 'on-device' }
  })),
]
