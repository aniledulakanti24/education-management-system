// Rubric-based grading assistant and similarity (plagiarism) check.
// Suggestions are advisory: a teacher always reviews and confirms the final mark.
import type { AiGradeSuggestion, Assignment } from '@/types'

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
const stem = (w: string) => w.replace(/(ing|ed|es|s|ation|isation|ization)$/u, '').slice(0, 7)

function mentions(text: string, keyword: string): boolean {
  // "a|b|c" means any one of the alternatives counts
  if (keyword.includes('|')) return keyword.split('|').some((k) => k.trim() && mentions(text, k.trim()))
  const t = norm(text)
  const k = norm(keyword)
  if (t.includes(k)) return true
  // tolerant match on word stems for multi-word keywords and simple inflections
  const words = new Set(t.split(' ').map(stem))
  return k.split(' ').every((w) => words.has(stem(w)))
}

export function suggestGrade(assignment: Assignment, text: string): AiGradeSuggestion {
  const wordCount = norm(text).split(' ').filter(Boolean).length
  const lengthFactor = wordCount < 15 ? 0.6 : wordCount < 30 ? 0.85 : 1
  const criteria = assignment.rubric.map((r) => {
    const matched = r.keywords.filter((k) => mentions(text, k))
    const missing = r.keywords.filter((k) => !matched.includes(k))
    const coverage = r.keywords.length ? matched.length / r.keywords.length : 1
    const points = Math.round(r.points * Math.min(1, coverage * 1.15) * lengthFactor * 2) / 2
    return { criterion: r.criterion, points, max: r.points, matched, missing }
  })
  const raw = criteria.reduce((s, c) => s + c.points, 0)
  const rubricMax = assignment.rubric.reduce((s, r) => s + r.points, 0) || 1
  const total = Math.round((raw / rubricMax) * assignment.maxPoints * 2) / 2
  const strong = criteria.filter((c) => c.points >= c.max * 0.8).map((c) => c.criterion.toLowerCase())
  const weak = criteria.filter((c) => c.points < c.max * 0.5)
  const feedback = [
    strong.length ? `Well done on: ${strong.join(', ')}.` : 'You have made a start.',
    ...weak.map((c) => `To improve “${c.criterion}”, include: ${c.missing.slice(0, 3).join(', ')}.`),
    wordCount < 30 ? 'Your answer is quite short — explain your ideas in more detail.' : '',
  ].filter(Boolean).join(' ')
  const confidence = wordCount < 15 ? 'LOW' : criteria.every((c) => c.matched.length || c.max <= 2) ? 'HIGH' : 'MEDIUM'
  return { criteria, total, feedback, confidence }
}

function shingles(text: string, k = 3) {
  const w = norm(text).split(' ').filter(Boolean)
  const out = new Set<string>()
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(' '))
  return out
}

export function similarity(a: string, b: string) {
  const A = shingles(a)
  const B = shingles(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  A.forEach((x) => B.has(x) && inter++)
  return inter / (A.size + B.size - inter)
}

/** Pairs of submissions that look copied (Jaccard similarity on 3-word shingles). */
export function similarPairs(subs: { id: string; learnerId: string; text: string }[], threshold = 0.85) {
  const out: { a: string; b: string; score: number }[] = []
  for (let i = 0; i < subs.length; i++) {
    for (let j = i + 1; j < subs.length; j++) {
      const s = similarity(subs[i].text, subs[j].text)
      if (s >= threshold) out.push({ a: subs[i].id, b: subs[j].id, score: Math.round(s * 100) })
    }
  }
  return out
}
