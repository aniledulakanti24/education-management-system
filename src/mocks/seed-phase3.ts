// Phase 3 demo data: LMS lessons, assignments & submissions, quizzes & attempts, live classes.
import type { Db } from './seed'
import { examinableCourses } from './seed-phase2'
import type { Assignment, Course, Lesson, Quiz, RubricCriterion, Submission } from '@/types'

let rand = mulberry32(99)
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const at = (now: Date, days: number, h = 10, m = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

type LessonDef = [title: string, kind: Lesson['kind'], minutes: number, body: string, url?: string]
interface ContentDef { section: string; course: string; module: string; lessons: LessonDef[] }

const CONTENT: ContentDef[] = [
  // ---------- Grade 3 ----------
  { section: 'gps-p-g3-s-g3a', course: 'EVS', module: 'Unit 4 · Plants around us', lessons: [
    ['Parts of a plant', 'ARTICLE', 8, 'A plant has many parts and each part has a job. The roots hold the plant in the soil and drink water. The stem stands tall and carries water from the roots to the leaves. The leaves are the kitchen of the plant: they make food. Flowers make seeds, and seeds grow into new plants.\n\nActivity: find a small plant at home and point to its root, stem, leaf and flower.'],
    ['How do plants make food?', 'ARTICLE', 10, 'Leaves make food using sunlight, air and water. This is called photosynthesis. The green colour in leaves, called chlorophyll, catches sunlight. Leaves take in carbon dioxide from the air and give out oxygen that we breathe. That is why trees keep our air fresh.\n\nRemember: sunlight + water + air → food for the plant + oxygen for us.'],
    ['Watch & explore: NCERT textbooks', 'LINK', 5, 'Read the Looking Around (EVS) chapter on plants in the free NCERT textbook and look at the pictures of different leaves.', 'https://ncert.nic.in/textbook.php'],
  ] },
  { section: 'gps-p-g3-s-g3a', course: 'Mathematics', module: 'Unit 6 · Fractions', lessons: [
    ['Fractions with pizza', 'ARTICLE', 10, 'A fraction is a part of a whole. If a pizza is cut into 4 equal slices and you eat 1 slice, you ate one-fourth, written 1/4. The bottom number (denominator) tells how many equal parts there are. The top number (numerator) tells how many parts we take.\n\nIf you eat 2 of the 4 slices, you ate 2/4, which is the same as one-half (1/2).'],
    ['Comparing fractions', 'ARTICLE', 8, 'When the denominators are the same, the fraction with the bigger numerator is bigger: 3/5 is more than 2/5. When the numerators are the same, the fraction with the smaller denominator is bigger: 1/2 is more than 1/4, because the whole is cut into fewer, larger pieces.'],
  ] },
  { section: 'gps-p-g3-s-g3a', course: 'English', module: 'Grammar · Naming words', lessons: [
    ['Nouns are naming words', 'ARTICLE', 7, 'A noun is a naming word. It names a person (teacher, Arjun), a place (school, Bengaluru), an animal (elephant) or a thing (pencil). Proper nouns are special names and always begin with a capital letter, like India or Monday. Common nouns are general names, like city or day.'],
  ] },
  // ---------- Grade 10 ----------
  { section: 'gps-p-g10-s-g10a', course: 'Science', module: 'Chapter 1 · Chemical reactions and equations', lessons: [
    ['What is a chemical reaction?', 'ARTICLE', 12, 'In a chemical reaction, reactants change into new substances called products. Signs of a reaction include a change in colour, release of gas, change in temperature or formation of a precipitate. A balanced chemical equation has the same number of atoms of each element on both sides, following the law of conservation of mass. For example: 2H2 + O2 → 2H2O.'],
    ['Types of reactions', 'ARTICLE', 14, 'Combination: two or more reactants form one product (CaO + H2O → Ca(OH)2). Decomposition: one reactant breaks into simpler products, often using heat, light or electricity. Displacement: a more reactive element displaces a less reactive one (Fe + CuSO4 → FeSO4 + Cu). Double displacement: ions are exchanged. Redox reactions involve oxidation (gain of oxygen or loss of hydrogen) and reduction together.'],
  ] },
  { section: 'gps-p-g10-s-g10a', course: 'Science', module: 'Chapter 6 · Life processes', lessons: [
    ['Nutrition in plants: photosynthesis', 'ARTICLE', 12, 'Autotrophic nutrition: green plants make their own food by photosynthesis. Chlorophyll absorbs light energy, which is converted into chemical energy; water is split into hydrogen and oxygen; and carbon dioxide is reduced to carbohydrates. The overall equation is 6CO2 + 12H2O → C6H12O6 + 6O2 + 6H2O in the presence of sunlight and chlorophyll. Gas exchange happens through stomata, which open and close using guard cells.'],
  ] },
  { section: 'gps-p-g10-s-g10a', course: 'Mathematics', module: 'Chapter 4 · Quadratic equations', lessons: [
    ['Solving quadratic equations', 'ARTICLE', 15, 'A quadratic equation has the form ax² + bx + c = 0 where a ≠ 0. It can be solved by factorisation, by completing the square, or by the quadratic formula x = (−b ± √(b² − 4ac)) / 2a. The discriminant D = b² − 4ac tells the nature of roots: D > 0 gives two distinct real roots, D = 0 gives two equal real roots, and D < 0 gives no real roots.'],
  ] },
  { section: 'gps-p-g10-s-g10a', course: 'Artificial Intelligence', module: 'Unit 1 · Introduction to AI', lessons: [
    ['What is artificial intelligence?', 'ARTICLE', 10, 'Artificial intelligence is the ability of a machine to perform tasks that normally need human intelligence, such as recognising speech, translating languages or recommending videos. AI systems learn patterns from data. The AI project cycle has five stages: problem scoping, data acquisition, data exploration, modelling and evaluation. AI must be used ethically: data should be collected with consent, and decisions should be fair and explainable.'],
  ] },
  // ---------- B.Tech CSE Semester 5 ----------
  { section: 'iit-p-btcse-s-btcses5', course: 'Operating Systems', module: 'Module 2 · Process management', lessons: [
    ['Processes and threads', 'ARTICLE', 15, 'A process is a program in execution with its own address space, registers and open files, described by a process control block (PCB). A thread is the unit of CPU scheduling inside a process; threads of one process share code, data and files but have separate stacks and registers. Context switching saves and restores the PCB. Multithreading improves responsiveness and lets programs use multiple cores, but shared data requires synchronisation with mutexes or semaphores.'],
    ['CPU scheduling algorithms', 'ARTICLE', 18, 'FCFS runs processes in arrival order; it is simple but suffers from the convoy effect. SJF picks the shortest burst next and gives the minimum average waiting time, but needs burst prediction and can cause starvation. Round Robin gives each process a time quantum and is preemptive, giving good response time for interactive systems; a quantum that is too small increases context-switch overhead. Priority scheduling can starve low-priority jobs, which ageing fixes.'],
    ['Further reading: MIT OpenCourseWare', 'LINK', 30, 'Optional deep-dive: operating-system engineering lecture notes and labs on MIT OpenCourseWare.', 'https://ocw.mit.edu'],
  ] },
  { section: 'iit-p-btcse-s-btcses5', course: 'Database Management Systems', module: 'Module 3 · Normalisation', lessons: [
    ['Functional dependencies and normal forms', 'ARTICLE', 16, 'Normalisation removes redundancy and update anomalies. 1NF requires atomic values. 2NF removes partial dependency of non-key attributes on part of a composite key. 3NF removes transitive dependency: non-key attributes must depend only on the key. BCNF requires that for every functional dependency X → Y, X is a superkey. Decomposition should be lossless and, ideally, dependency preserving.'],
  ] },
  { section: 'iit-p-btcse-s-btcses5', course: 'Machine Learning', module: 'Unit 2 · Supervised learning', lessons: [
    ['Linear regression', 'ARTICLE', 15, 'Linear regression models a target as a weighted sum of features plus a bias. Parameters are learned by minimising mean squared error, either with the closed-form normal equation or with gradient descent, which updates weights in the direction of the negative gradient scaled by the learning rate. Feature scaling speeds up gradient descent. R² measures how much variance the model explains.'],
    ['Overfitting and regularisation', 'ARTICLE', 15, 'Overfitting happens when a model learns noise in the training data: training error is low but validation error is high. Remedies include collecting more data, using a simpler model, cross-validation for model selection, early stopping, dropout for neural networks, and regularisation. L2 (ridge) regularisation penalises large weights; L1 (lasso) can drive weights to zero and performs feature selection. The bias–variance trade-off explains the balance.'],
  ] },
  { section: 'iit-p-btcse-s-btcses5', course: 'Computer Networks', module: 'Unit 4 · Transport layer', lessons: [
    ['TCP vs UDP', 'ARTICLE', 12, 'TCP is connection-oriented and reliable: it uses a three-way handshake, sequence numbers, acknowledgements, retransmission, flow control with a sliding window and congestion control. UDP is connectionless with no delivery guarantee but very low overhead, so it suits DNS queries, live video and online games. Ports identify the application process on each host.'],
  ] },
  // ---------- BSc CS Year 1 (Dubai) ----------
  { section: 'mru-p-bsccs-s-bsccss1', course: 'Programming Fundamentals', module: 'Week 3 · Control flow and functions', lessons: [
    ['Variables and control flow', 'ARTICLE', 12, 'A variable is a named storage location. Control flow decides which statements run: if/else chooses between branches based on a condition, while loops repeat while a condition is true, and for loops iterate over a range or collection. Avoid infinite loops by making sure the loop condition eventually becomes false.'],
    ['Functions and decomposition', 'ARTICLE', 12, 'A function is a named, reusable block of code that takes parameters and returns a value. Functions make programs easier to read, test and reuse. Good functions do one thing, have descriptive names, and avoid changing global state. Decomposition means breaking a big problem into smaller functions that each solve a sub-problem.'],
  ] },
  { section: 'mru-p-bsccs-s-bsccss1', course: 'Calculus', module: 'Chapter 2 · Limits and derivatives', lessons: [
    ['Limits', 'ARTICLE', 12, 'The limit of f(x) as x approaches a is the value f(x) gets arbitrarily close to as x gets close to a. A function is continuous at a if the limit exists and equals f(a). One-sided limits must agree for the limit to exist.'],
    ['The derivative', 'ARTICLE', 14, 'The derivative f′(x) is the instantaneous rate of change: the limit of (f(x+h) − f(x))/h as h approaches 0. Geometrically it is the slope of the tangent line. Key rules: the power rule d/dx xⁿ = n·xⁿ⁻¹, the product rule, the quotient rule and the chain rule.'],
  ] },
  // ---------- PhD CS cohort ----------
  { section: 'mru-p-phdcs-s-phdcscohort', course: 'Research Seminar', module: 'Seminar · From question to thesis', lessons: [
    ['Writing a literature review', 'ARTICLE', 20, 'A literature review maps what is known, how it is known and what is missing. Search systematically (Scopus, Web of Science, arXiv), record inclusion criteria, and organise papers in a synthesis matrix by theme, method, dataset and finding. Critique rather than summarise: compare assumptions and evaluation choices, then state the research gap your thesis addresses.'],
    ['Research ethics and integrity', 'ARTICLE', 15, 'Responsible research requires informed consent, data protection, ethics committee approval for human-subject studies, honest reporting of negative results, proper citation to avoid plagiarism, and declaring conflicts of interest. Keep a research data management plan and reproducible code.'],
  ] },
]

interface AssignmentDef {
  section: string
  course: string
  title: string
  instructions: string
  maxPoints: number
  rubric: RubricCriterion[]
  bank: { text: string; strong: boolean }[]
}

const ASSIGNMENTS: AssignmentDef[] = [
  {
    section: 'gps-p-g3-s-g3a', course: 'EVS', title: 'My plant diary', maxPoints: 10,
    instructions: 'Look at a plant at home or school. Write 4–5 sentences: name its parts and say what each part does.',
    rubric: [
      { criterion: 'Names the parts', points: 4, keywords: ['root', 'stem', 'leaf', 'flower'] },
      { criterion: 'Explains what parts do', points: 4, keywords: ['water', 'food', 'sunlight', 'seed'] },
      { criterion: 'Clear sentences', points: 2, keywords: ['plant'] },
    ],
    bank: [
      { text: 'I looked at the tulsi plant in our balcony.', strong: false },
      { text: 'The roots hold the plant and drink water from the soil.', strong: true },
      { text: 'The stem carries water up to the leaves.', strong: true },
      { text: 'The green leaves make food using sunlight.', strong: true },
      { text: 'The flower makes seeds for new plants.', strong: true },
      { text: 'My plant is very nice and I like it.', strong: false },
    ],
  },
  {
    section: 'gps-p-g10-s-g10a', course: 'Science', title: 'Explain photosynthesis', maxPoints: 20,
    instructions: 'In about 120 words, explain how plants make food. Include the balanced equation, the role of chlorophyll and stomata, and what happens to light energy.',
    rubric: [
      { criterion: 'Correct equation & reactants/products', points: 8, keywords: ['carbon dioxide', 'water', 'glucose', 'oxygen', 'equation'] },
      { criterion: 'Role of chlorophyll and light energy', points: 6, keywords: ['chlorophyll', 'light energy', 'chemical energy'] },
      { criterion: 'Gas exchange through stomata', points: 6, keywords: ['stomata', 'guard cells'] },
    ],
    bank: [
      { text: 'Photosynthesis is the process by which green plants make their own food.', strong: false },
      { text: 'Chlorophyll in the leaves absorbs light energy and converts it into chemical energy.', strong: true },
      { text: 'Carbon dioxide and water are used to make glucose, and oxygen is released.', strong: true },
      { text: 'The balanced equation is 6CO2 + 12H2O → C6H12O6 + 6O2 + 6H2O.', strong: true },
      { text: 'Gas exchange happens through tiny pores called stomata which are opened and closed by guard cells.', strong: true },
      { text: 'Plants are important for all living beings on Earth.', strong: false },
    ],
  },
  {
    section: 'iit-p-btcse-s-btcses5', course: 'Operating Systems', title: 'Compare CPU scheduling algorithms', maxPoints: 25,
    instructions: 'Compare FCFS, SJF and Round Robin. Discuss waiting time, starvation, preemption and when each is appropriate. Mention the effect of the time quantum.',
    rubric: [
      { criterion: 'FCFS characteristics', points: 6, keywords: ['fcfs', 'arrival', 'convoy'] },
      { criterion: 'SJF characteristics', points: 7, keywords: ['sjf', 'shortest', 'waiting time', 'starvation'] },
      { criterion: 'Round Robin & quantum', points: 8, keywords: ['round robin', 'quantum', 'preemptive', 'context switch'] },
      { criterion: 'Use-case judgement', points: 4, keywords: ['interactive', 'batch'] },
    ],
    bank: [
      { text: 'FCFS schedules processes in order of arrival and is simple but suffers from the convoy effect.', strong: true },
      { text: 'SJF chooses the shortest job first and gives minimum average waiting time, but long jobs can face starvation.', strong: true },
      { text: 'Round Robin is preemptive and gives each process a fixed time quantum.', strong: true },
      { text: 'If the quantum is too small the context switch overhead becomes large.', strong: true },
      { text: 'Round Robin suits interactive systems while SJF fits batch systems where burst times are known.', strong: true },
      { text: 'Scheduling is an important part of every operating system.', strong: false },
    ],
  },
  {
    section: 'iit-p-btcse-s-btcses5', course: 'Machine Learning', title: 'Overfitting: diagnosis and remedies', maxPoints: 20,
    instructions: 'Explain how you would detect overfitting and describe at least three remedies, including one regularisation technique.',
    rubric: [
      { criterion: 'Diagnosis', points: 6, keywords: ['training error', 'validation', 'noise'] },
      { criterion: 'Regularisation', points: 7, keywords: ['regularisation', 'l1', 'l2', 'penalty'] },
      { criterion: 'Other remedies', points: 7, keywords: ['more data', 'cross-validation', 'early stopping', 'dropout'] },
    ],
    bank: [
      { text: 'Overfitting is detected when training error is low but validation error is high, because the model learns noise.', strong: true },
      { text: 'L2 regularisation adds a penalty on large weights, and L1 can set some weights to zero.', strong: true },
      { text: 'Collecting more data and using cross-validation help choose a model that generalises.', strong: true },
      { text: 'Early stopping and dropout are useful for neural networks.', strong: true },
      { text: 'Machine learning is a very popular field nowadays.', strong: false },
    ],
  },
  {
    section: 'mru-p-bsccs-s-bsccss1', course: 'Programming Fundamentals', title: 'Design a grade calculator', maxPoints: 15,
    instructions: 'Describe (in words or pseudocode) a program that reads marks and prints a letter grade. Use at least one function, one loop and an if/else chain.',
    rubric: [
      { criterion: 'Uses a function', points: 5, keywords: ['function', 'return', 'parameter'] },
      { criterion: 'Loop over inputs', points: 5, keywords: ['loop', 'for', 'while'] },
      { criterion: 'Branching for grades', points: 5, keywords: ['if', 'else', 'grade'] },
    ],
    bank: [
      { text: 'I define a function letter_grade that takes marks as a parameter and returns the grade.', strong: true },
      { text: 'Inside it an if / else if / else chain returns A for 90 and above, B for 80 and above, and so on.', strong: true },
      { text: 'The main program uses a for loop to read each student’s marks and print the grade.', strong: true },
      { text: 'A while loop could also be used until the user types done.', strong: true },
      { text: 'Programming is fun and useful.', strong: false },
    ],
  },
]

const QUIZZES: { section: string; course: string; title: string; questions: [string, string[], number, string][] }[] = [
  { section: 'gps-p-g3-s-g3a', course: 'EVS', title: 'Plants quiz 🌱', questions: [
    ['Which part of the plant makes food?', ['Root', 'Leaf', 'Stem', 'Flower'], 1, 'Leaves make food using sunlight — they are the plant’s kitchen.'],
    ['What do roots do?', ['Make seeds', 'Hold the plant and drink water', 'Catch sunlight', 'Make oxygen'], 1, 'Roots hold the plant in the soil and take in water.'],
    ['What gas do plants give out that we breathe?', ['Oxygen', 'Carbon dioxide', 'Smoke', 'Steam'], 0, 'Plants release oxygen during photosynthesis.'],
    ['Seeds come from the…', ['Root', 'Stem', 'Flower', 'Soil'], 2, 'Flowers make seeds, and seeds grow into new plants.'],
  ] },
  { section: 'gps-p-g10-s-g10a', course: 'Science', title: 'Chemical reactions — quick check', questions: [
    ['Fe + CuSO₄ → FeSO₄ + Cu is an example of…', ['Combination', 'Decomposition', 'Displacement', 'Double displacement'], 2, 'Iron is more reactive and displaces copper.'],
    ['A balanced equation follows the law of…', ['Gravitation', 'Conservation of mass', 'Definite proportions only', 'Inertia'], 1, 'Atoms are neither created nor destroyed.'],
    ['Gain of oxygen is called…', ['Reduction', 'Oxidation', 'Neutralisation', 'Sublimation'], 1, 'Oxidation is gain of oxygen or loss of hydrogen.'],
    ['Which is NOT a sign of a chemical reaction?', ['Change of colour', 'Evolution of gas', 'Change of state of water', 'Formation of precipitate'], 2, 'Melting or boiling water is a physical change.'],
    ['CaO + H₂O → Ca(OH)₂ is a…', ['Combination reaction', 'Decomposition reaction', 'Displacement reaction', 'Redox only'], 0, 'Two reactants form a single product.'],
  ] },
  { section: 'iit-p-btcse-s-btcses5', course: 'Operating Systems', title: 'Scheduling MCQ', questions: [
    ['Which algorithm gives minimum average waiting time?', ['FCFS', 'SJF', 'Round Robin', 'Priority'], 1, 'SJF is optimal for average waiting time given known bursts.'],
    ['The convoy effect is associated with…', ['FCFS', 'SJF', 'Round Robin', 'Multilevel queue'], 0, 'Short jobs wait behind a long job in FCFS.'],
    ['Ageing is used to prevent…', ['Deadlock', 'Starvation', 'Thrashing', 'Fragmentation'], 1, 'Ageing gradually raises the priority of waiting processes.'],
    ['Threads of the same process share…', ['Stack', 'Registers', 'Code and data', 'Program counter'], 2, 'Each thread has its own stack and registers.'],
  ] },
  { section: 'mru-p-bsccs-s-bsccss1', course: 'Programming Fundamentals', title: 'Control flow check', questions: [
    ['Which loop is best when the number of iterations is known?', ['while', 'for', 'do-while only', 'none'], 1, 'A for loop iterates over a known range or collection.'],
    ['A function that returns nothing in Python returns…', ['0', 'None', 'False', 'An error'], 1, 'Functions without a return statement return None.'],
    ['What causes an infinite loop?', ['A condition that never becomes false', 'Using a function', 'An if statement', 'A comment'], 0, 'The loop condition must eventually become false.'],
  ] },
]

const PERSONAL_OPENERS = ['When I tried this at home,', 'During the class discussion,', 'While revising with a friend,', 'In my notebook,', 'After reading the lesson again,', 'Yesterday evening', 'In the library,', 'Over the weekend', 'On the bus to school', 'Before the test,']
const PERSONAL_DETAILS = [
  'I noticed something new about this topic.', 'I drew a small diagram to remember it.', 'my family asked me questions about it.', 'I wrote my own example to check my understanding.',
  'I found one point confusing at first but it became clear.', 'I compared it with what we studied last term.', 'I explained it to a younger cousin.', 'I checked the textbook figure carefully.',
  'I made flash cards for the key terms.', 'I watched how it works in real life.',
]

function courseIn(db: Db, sectionId: string, match: string): Course | undefined {
  return examinableCourses(db, sectionId).find((c) => c.name.toLowerCase().includes(match.toLowerCase()))
}
const teacherOf = (db: Db, sectionId: string, courseId: string) => db.slots.find((s) => s.sectionId === sectionId && s.courseId === courseId)?.staffId ?? 'system'

export function seedPhase3(db: Db, now: Date) {
  rand = mulberry32(99)
  let n = 0
  const addLesson = (sectionId: string, course: Course, module: string, order: number, [title, kind, minutes, body, url]: LessonDef, daysAgo: number) => {
    n++
    db.lessons.push({ id: `${course.tenantId}-les-${n}`, tenantId: course.tenantId, sectionId, courseId: course.id, module, order, title, kind, body, url, minutes, publishedAt: at(now, -daysAgo, 8) })
  }
  // Rich content
  for (const c of CONTENT) {
    const course = courseIn(db, c.section, c.course)
    if (!course) continue
    c.lessons.forEach((l, i) => addLesson(c.section, course, c.module, i + 1, l, 20 - i * 3))
  }
  // Every class in demo sections and every class a demo teacher teaches gets a welcome lesson.
  const demoSections = ['gps-p-g3-s-g3a', 'gps-p-g10-s-g10a', 'iit-p-btcse-s-btcses5', 'mru-p-bsccs-s-bsccss1', 'mru-p-phdcs-s-phdcscohort']
  const classes = new Set<string>()
  demoSections.forEach((s) => examinableCourses(db, s).forEach((c) => classes.add(`${s}|${c.id}`)))
  db.users.filter((u) => u.role === 'FACULTY').forEach((u) => db.slots.filter((s) => s.staffId === u.personId).forEach((s) => classes.add(`${s.sectionId}|${s.courseId}`)))
  for (const key of classes) {
    const [sectionId, courseId] = key.split('|')
    const course = db.courses.find((c) => c.id === courseId)
    if (!course || course.type === 'ACTIVITY') continue
    const section = db.sections.find((s) => s.id === sectionId)!
    addLesson(sectionId, course, 'Getting started', 0, [
      `Welcome to ${course.name}`, 'ARTICLE', 4,
      `Welcome to ${course.name} for ${section.name}. This term we will cover the following outcomes: ${course.outcomes.join('; ')}. Lessons, assignments and quizzes appear here as your teacher publishes them. Ask the AI tutor if you are stuck, and talk to your teacher whenever you need help.`,
    ], 40)
  }

  // Assignments & submissions
  const demoLearners = new Set(db.users.filter((u) => u.role === 'STUDENT' && u.personId).map((u) => u.personId!))
  let a = 0
  for (const def of ASSIGNMENTS) {
    const course = courseIn(db, def.section, def.course)
    if (!course) continue
    a++
    const asg: Assignment = {
      id: `${course.tenantId}-asg-${a}`, tenantId: course.tenantId, sectionId: def.section, courseId: course.id, title: def.title, instructions: def.instructions,
      dueAt: at(now, -2, 23, 59), maxPoints: def.maxPoints, rubric: def.rubric, createdBy: teacherOf(db, def.section, course.id), createdAt: at(now, -10, 9),
    }
    db.assignments.push(asg)
    const learners = db.learners.filter((l) => l.sectionId === def.section && l.status === 'ACTIVE')
    let copied: string | null = null
    learners.forEach((l, i) => {
      const demo = demoLearners.has(l.id)
      if (!demo && rand() < 0.15) return // did not submit
      const strong = def.bank.filter((b) => b.strong)
      const weak = def.bank.filter((b) => !b.strong)
      const k = demo ? strong.length - 1 : Math.max(1, Math.round(strong.length * (0.35 + rand() * 0.65)))
      // pick k points at random (keeping the natural order) and add a personal sentence, so honest answers differ
      const chosen = strong.map((s, idx) => ({ s, r: rand(), idx })).sort((x, y) => x.r - y.r).slice(0, k).sort((x, y) => x.idx - y.idx).map((x) => x.s.text)
      const personal = `${PERSONAL_OPENERS[Math.floor(rand() * PERSONAL_OPENERS.length)]} ${PERSONAL_DETAILS[Math.floor(rand() * PERSONAL_DETAILS.length)]} It took me about ${10 + Math.floor(rand() * 50)} minutes.`
      const parts = [weak[0].text, ...chosen, personal, ...(rand() < 0.5 ? [weak[weak.length - 1].text] : [])]
      let text = parts.join(' ')
      if (i === 3 && copied) text = copied // a copied pair, for the similarity check
      if (i === 2) copied = text
      const graded = !demo && rand() < 0.45
      const coverage = k / strong.length
      const sub: Submission = {
        id: `${asg.id}-sub-${l.id}`, tenantId: asg.tenantId, assignmentId: asg.id, learnerId: l.id, text,
        submittedAt: at(now, -3 - Math.floor(rand() * 4), 18 + Math.floor(rand() * 4), Math.floor(rand() * 59)), status: graded ? 'GRADED' : 'SUBMITTED',
      }
      if (graded) {
        sub.score = Math.round(asg.maxPoints * Math.min(1, 0.4 + coverage * 0.6))
        sub.feedback = coverage > 0.8 ? 'Excellent — complete and accurate.' : coverage > 0.5 ? 'Good work. Add more detail on the missing points.' : 'Please revise the lesson and cover the key ideas.'
        sub.gradedBy = asg.createdBy
        sub.gradedAt = at(now, -1, 17)
      }
      db.submissions.push(sub)
    })
    // a second, upcoming assignment so learners have something "to do"
    a++
    db.assignments.push({
      ...asg, id: `${course.tenantId}-asg-${a}`, title: `${def.title} — reflection`, dueAt: at(now, 4, 23, 59), createdAt: at(now, -1, 9),
      instructions: `Write a short reflection (60–100 words) on what you learned in “${def.title}”: one thing you understood well, one example from daily life, and one question you still have.`,
      maxPoints: 10, rubric: [
        { criterion: 'Key learning stated', points: 4, keywords: ['learned|learnt|understood|learn'] },
        { criterion: 'Real-life example', points: 3, keywords: ['example|for instance|daily life|at home'] },
        { criterion: 'Thoughtful question', points: 3, keywords: ['question|why|how|wonder'] },
      ],
    })
  }

  // Quizzes & attempts
  let q = 0
  for (const def of QUIZZES) {
    const course = courseIn(db, def.section, def.course)
    if (!course) continue
    q++
    const quiz: Quiz = {
      id: `${course.tenantId}-quiz-${q}`, tenantId: course.tenantId, sectionId: def.section, courseId: course.id, title: def.title,
      questions: def.questions.map(([prompt, options, answer, explanation], i) => ({ id: `q${i + 1}`, prompt, options, answer, explanation })),
      dueAt: at(now, 3, 23, 59), timeLimitMin: def.questions.length * 2, createdBy: teacherOf(db, def.section, course.id),
    }
    db.quizzes.push(quiz)
    db.learners.filter((l) => l.sectionId === def.section && !demoLearners.has(l.id)).forEach((l) => {
      if (rand() < 0.25) return
      const answers = quiz.questions.map((qq) => (rand() < 0.72 ? qq.answer : Math.floor(rand() * qq.options.length)))
      const score = answers.filter((x, i) => x === quiz.questions[i].answer).length
      db.quizAttempts.push({ id: `${quiz.id}-att-${l.id}`, tenantId: quiz.tenantId, quizId: quiz.id, learnerId: l.id, answers, score, max: quiz.questions.length, at: at(now, -1, 19) })
    })
  }

  // Live classes
  let v = 0
  for (const s of demoSections) {
    const course = examinableCourses(db, s)[0]
    if (!course) continue
    for (const [d, h] of [[1, 16], [3, 17]] as const) {
      v++
      const id = `${course.tenantId}-live-${v}`
      db.liveSessions.push({ id, tenantId: course.tenantId, sectionId: s, courseId: course.id, title: d === 1 ? `${course.name}: doubt-clearing session` : `${course.name}: revision before the test`, startsAt: at(now, d, h), minutes: 45, joinUrl: `https://meet.jit.si/UnifiedTree-${id}`, createdBy: teacherOf(db, s, course.id) })
    }
  }

  // Lesson completion
  for (const l of db.learners) {
    const lessons = db.lessons.filter((x) => x.sectionId === l.sectionId)
    if (!lessons.length) continue
    const share = demoLearners.has(l.id) ? 0.5 : 0.3 + rand() * 0.7
    db.lessonDone[l.id] = lessons.filter(() => rand() < share).map((x) => x.id)
  }
}
