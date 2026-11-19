import type { FrameworkCode, LevelCode } from '@/types'

// Academic Framework Packs: country/curriculum behaviour expressed as data, not code forks.
export interface FrameworkPack {
  code: FrameworkCode
  name: string
  region: string
  levels: LevelCode[]
  gradingScheme: string
  gradeBands: { label: string; min: number }[]
  creditSystem: string
  academicYearStartMonth: number // 1..12
  reports: string[]
}

export const FRAMEWORKS: Record<FrameworkCode, FrameworkPack> = {
  CBSE: {
    code: 'CBSE',
    name: 'CBSE (India)',
    region: 'India',
    levels: ['PRE_PRIMARY', 'PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'],
    gradingScheme: '8-point grade (A1–E), CGPA, Holistic Progress Card (NEP 2020)',
    gradeBands: [
      { label: 'A1', min: 91 }, { label: 'A2', min: 81 }, { label: 'B1', min: 71 }, { label: 'B2', min: 61 },
      { label: 'C1', min: 51 }, { label: 'C2', min: 41 }, { label: 'D', min: 33 }, { label: 'E', min: 0 },
    ],
    creditSystem: 'None (NCrF credits from Class 9)',
    academicYearStartMonth: 4,
    reports: ['UDISE+', 'CBSE OASIS', 'PARAKH'],
  },
  ICSE: {
    code: 'ICSE',
    name: 'CISCE — ICSE / ISC (India)',
    region: 'India',
    levels: ['PRE_PRIMARY', 'PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'],
    gradingScheme: 'Percentage with grades 1–9',
    gradeBands: [{ label: '1', min: 90 }, { label: '2', min: 80 }, { label: '3', min: 70 }, { label: '4', min: 60 }, { label: '5', min: 50 }, { label: '6', min: 40 }, { label: '7', min: 0 }],
    creditSystem: 'None',
    academicYearStartMonth: 4,
    reports: ['UDISE+', 'CISCE Careers portal'],
  },
  STATE_BOARD_IN: {
    code: 'STATE_BOARD_IN',
    name: 'Indian State Board',
    region: 'India',
    levels: ['PRE_PRIMARY', 'PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'],
    gradingScheme: 'Percentage / state grade bands',
    gradeBands: [{ label: 'Distinction', min: 75 }, { label: 'First', min: 60 }, { label: 'Second', min: 45 }, { label: 'Pass', min: 35 }, { label: 'Fail', min: 0 }],
    creditSystem: 'None',
    academicYearStartMonth: 6,
    reports: ['UDISE+', 'State EMIS'],
  },
  IB: {
    code: 'IB',
    name: 'International Baccalaureate (PYP/MYP/DP)',
    region: 'Global',
    levels: ['PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'],
    gradingScheme: 'IB 1–7 per subject, DP total /45',
    gradeBands: [{ label: '7', min: 85 }, { label: '6', min: 72 }, { label: '5', min: 60 }, { label: '4', min: 48 }, { label: '3', min: 36 }, { label: '2', min: 20 }, { label: '1', min: 0 }],
    creditSystem: 'None (CAS hours tracked)',
    academicYearStartMonth: 8,
    reports: ['IBIS submissions'],
  },
  CAMBRIDGE: {
    code: 'CAMBRIDGE',
    name: 'Cambridge International (IGCSE / A Level)',
    region: 'Global',
    levels: ['PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY'],
    gradingScheme: 'A*–G (IGCSE), A*–E (A Level)',
    gradeBands: [{ label: 'A*', min: 90 }, { label: 'A', min: 80 }, { label: 'B', min: 70 }, { label: 'C', min: 60 }, { label: 'D', min: 50 }, { label: 'E', min: 40 }, { label: 'U', min: 0 }],
    creditSystem: 'None',
    academicYearStartMonth: 9,
    reports: ['Cambridge Direct entries'],
  },
  US_COMMON_CORE: {
    code: 'US_COMMON_CORE',
    name: 'US K-12 (Common Core)',
    region: 'United States',
    levels: ['PRE_PRIMARY', 'PRIMARY', 'MIDDLE', 'SECONDARY'],
    gradingScheme: 'Letter grades A–F, GPA 4.0, standards-based for elementary',
    gradeBands: [{ label: 'A', min: 90 }, { label: 'B', min: 80 }, { label: 'C', min: 70 }, { label: 'D', min: 60 }, { label: 'F', min: 0 }],
    creditSystem: 'Carnegie units',
    academicYearStartMonth: 8,
    reports: ['State SIS / Ed-Fi', 'IPEDS (post-secondary)'],
  },
  UK_NATIONAL: {
    code: 'UK_NATIONAL',
    name: 'UK National Curriculum (GCSE / A Level)',
    region: 'United Kingdom',
    levels: ['PRIMARY', 'SECONDARY', 'SENIOR_SECONDARY'],
    gradingScheme: 'GCSE 9–1, A Level A*–E',
    gradeBands: [{ label: '9', min: 90 }, { label: '7', min: 70 }, { label: '5', min: 55 }, { label: '4', min: 45 }, { label: '1', min: 0 }],
    creditSystem: 'None',
    academicYearStartMonth: 9,
    reports: ['DfE School Census'],
  },
  AICTE_CBCS: {
    code: 'AICTE_CBCS',
    name: 'AICTE / NBA — Engineering (India, CBCS + OBE)',
    region: 'India',
    levels: ['DIPLOMA', 'UG', 'PG', 'PHD'],
    gradingScheme: '10-point CGPA (O, A+, A, B+, B, C, P, F)',
    gradeBands: [{ label: 'O', min: 90 }, { label: 'A+', min: 80 }, { label: 'A', min: 70 }, { label: 'B+', min: 60 }, { label: 'B', min: 55 }, { label: 'C', min: 50 }, { label: 'P', min: 40 }, { label: 'F', min: 0 }],
    creditSystem: 'CBCS credits, ABC (Academic Bank of Credits)',
    academicYearStartMonth: 8,
    reports: ['AISHE', 'NIRF', 'NBA SAR', 'NAAC SSR/AQAR', 'AICTE EoA'],
  },
  UGC_CBCS: {
    code: 'UGC_CBCS',
    name: 'UGC — University (India, NEP 2020 FYUGP)',
    region: 'India',
    levels: ['UG', 'PG', 'PHD'],
    gradingScheme: '10-point CGPA',
    gradeBands: [{ label: 'O', min: 90 }, { label: 'A+', min: 80 }, { label: 'A', min: 70 }, { label: 'B+', min: 60 }, { label: 'B', min: 50 }, { label: 'C', min: 45 }, { label: 'P', min: 40 }, { label: 'F', min: 0 }],
    creditSystem: 'CBCS, ABC, multiple entry / exit',
    academicYearStartMonth: 7,
    reports: ['AISHE', 'NIRF', 'NAAC', 'Shodhganga'],
  },
  BOLOGNA_ECTS: {
    code: 'BOLOGNA_ECTS',
    name: 'Bologna Process / ECTS (Europe & partners)',
    region: 'Europe / Global',
    levels: ['UG', 'PG', 'PHD'],
    gradingScheme: 'ECTS A–F, UK-style classifications optional',
    gradeBands: [{ label: 'A', min: 90 }, { label: 'B', min: 80 }, { label: 'C', min: 70 }, { label: 'D', min: 60 }, { label: 'E', min: 50 }, { label: 'F', min: 0 }],
    creditSystem: 'ECTS (60 per year)',
    academicYearStartMonth: 9,
    reports: ['Diploma Supplement', 'HESA', 'Accreditation self-study'],
  },
}

export const LEVEL_ORDER: LevelCode[] = [
  'PRE_PRIMARY', 'PRIMARY', 'MIDDLE', 'SECONDARY', 'SENIOR_SECONDARY', 'VOCATIONAL', 'DIPLOMA', 'UG', 'PG', 'PHD',
]

// Grade points per band label, for frameworks that compute a GPA / CGPA.
const GRADE_POINTS: Partial<Record<FrameworkCode, { scale: number; label: string; points: Record<string, number> }>> = {
  CBSE: { scale: 10, label: 'CGPA', points: { A1: 10, A2: 9, B1: 8, B2: 7, C1: 6, C2: 5, D: 4, E: 0 } },
  AICTE_CBCS: { scale: 10, label: 'SGPA', points: { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 } },
  UGC_CBCS: { scale: 10, label: 'SGPA', points: { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 } },
  US_COMMON_CORE: { scale: 4, label: 'GPA', points: { A: 4, B: 3, C: 2, D: 1, F: 0 } },
  BOLOGNA_ECTS: { scale: 4, label: 'GPA', points: { A: 4, B: 3.5, C: 3, D: 2.5, E: 2, F: 0 } },
}

export function gradeFor(pct: number, code: FrameworkCode) {
  const pack = FRAMEWORKS[code]
  const band = pack.gradeBands.find((b) => pct >= b.min) ?? pack.gradeBands[pack.gradeBands.length - 1]
  const gp = GRADE_POINTS[code]
  return { grade: band.label, points: gp ? gp.points[band.label] ?? 0 : null, pass: pct >= passMark(code) }
}

export function gpaInfo(code: FrameworkCode) {
  return GRADE_POINTS[code] ?? null
}

export function passMark(code: FrameworkCode) {
  return { CBSE: 33, ICSE: 35, STATE_BOARD_IN: 35, IB: 36, CAMBRIDGE: 40, US_COMMON_CORE: 60, UK_NATIONAL: 45, AICTE_CBCS: 40, UGC_CBCS: 40, BOLOGNA_ECTS: 50 }[code]
}
