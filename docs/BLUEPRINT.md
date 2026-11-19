# UnifiedTree Education ERP — Product & Architecture Blueprint

> One platform for the entire learning lifecycle — from a child's first day in pre-primary to a PhD defence — for institutions anywhere in the world.

Version 0.1 · November 2026

---

## 1. Vision

Most education ERPs are built for **one segment** (K-12 *or* higher-ed *or* research) and **one market** (one country's boards, grading and regulations). Institutions that span segments — school groups that open colleges, universities with affiliated schools, governments running whole systems — end up stitching together 4–6 products.

UnifiedTree is a **single multi-tenant SaaS** where:

- **Segment is configuration, not a separate product.** A tenant declares which *levels* it runs (Pre-primary, Primary, Secondary, Senior Secondary, UG, PG, Diploma, PhD, Vocational/Skill) and the UI, terminology, grading and workflows adapt.
- **Country/curriculum is a pluggable "Academic Framework Pack".** CBSE, ICSE, State Boards, IB, Cambridge, US Common Core, UK National Curriculum, Australian Curriculum, AICTE/UGC, Bologna/ECTS, etc. are data packs, not code forks.
- **A learner has one lifelong identity** (portable record, credits and credentials) across every institution on the platform — aligned with India's APAAR / Academic Bank of Credits and global verifiable-credential standards.
- **AI is native**, not bolted on: prediction, automation and assistants across every module.

---

## 2. Market scan — what exists and where the gaps are

| Product | Region / Segment | Strengths | Gaps UnifiedTree addresses |
|---|---|---|---|
| PowerSchool | US/Global K-12 | SIS depth, gradebook, state reporting | Weak higher-ed/research, US-centric |
| Infinite Campus | US K-12 | District-scale SIS | US only, no HE |
| Ellucian (Banner/Colleague) | Global HE | Registrar, finance, HR for universities | Heavy, expensive, no K-12, dated UX |
| Workday Student / Oracle Student Cloud | Large universities | Modern HCM/finance integration | Very expensive, no K-12, long implementations |
| Anthology (Blackboard) / Canvas / Moodle | LMS | Teaching & learning | Not an ERP — no fees, HR, admissions depth |
| Fedena, Entab CampusCare, MyClassboard, Teachmint, Edunext | India K-12 | Affordable, CBSE/State aware, fee & transport | Little HE/research, limited global/i18n, basic AI |
| Classe365, OpenEduCat, Odoo Education | SMB global | Broad modules, open-source options | Shallow per-segment depth |
| Camu, Linways, Creatrix Campus, MasterSoft | India HE | NAAC/NBA/OBE, affiliation | No K-12 continuum, limited global |
| Pure / Converis / Symplectic Elements | Research info | Publications, grants | Not connected to student lifecycle |

**Gaps** (the UnifiedTree wedge):
1. No product covers child → adult in one data model.
2. Accreditation (NAAC/NBA/NIRF/ABET/AACSB) and outcome-based education usually live in spreadsheets.
3. Research/PhD lifecycle is disconnected from academic records.
4. Credentials are PDFs — not verifiable, not portable.
5. i18n is shallow: English + 1–2 languages, no RTL, no local calendars/grading.
6. AI is marketing; few products ship real prediction or automation.

---

## 3. Personas & portals

| Portal | Personas | Key jobs |
|---|---|---|
| **Platform (Super Admin)** | UnifiedTree operators, government/education department admins | Tenant onboarding, plans/billing, data-residency, framework packs, global analytics |
| **Institution Admin** | Principal, Registrar, Dean, Admissions, Accounts, HR, Exam controller | Configure structure, admissions, fees, exams, compliance reports |
| **Faculty** | Teacher, Class teacher, Professor, HoD, PhD Supervisor, Lab in-charge | Timetable, attendance, gradebook, LMS, mentoring, research supervision |
| **Learner** | K-12 student (child UX), UG/PG student, PhD scholar | Timetable, assignments, results, fees, credentials, research progress |
| **Guardian** | Parent / guardian / sponsor | Progress, attendance, fees, communication, consent |
| **Alumni / Employer / Verifier** *(Phase 4)* | Alumni, recruiters, foreign universities | Credential verification, placements, alumni network |

The **learner portal adapts by age band**: Kids (3–10: big icons, gamified, voice, no free-text social), Teens (11–17), Adult (18+: full self-service).

---

## 4. Module catalogue

Legend: 🟢 MVP Phase 1 · 🔵 Phase 2 · 🟣 Phase 3 · ⚪ Phase 4+

### 4.1 Platform & Tenancy
- 🟢 Tenant registry, branding (logo, colours, subdomain), institution type & levels offered
- 🟢 Framework pack per tenant (board/curriculum, grading scale, academic calendar)
- 🟢 Role-based access control (RBAC) + attribute rules (campus, department, class)
- 🔵 Plans, metering & SaaS billing; feature flags per tenant
- 🔵 Data-residency regions (IN, EU, US, ME, APAC), per-tenant encryption keys
- 🟣 Multi-campus / group hierarchy (Trust → Group → Campus → School/College)
- ⚪ Marketplace for third-party apps & framework packs

### 4.2 Admissions & Enrolment (CRM)
- 🔵 Enquiry → application → test/interview → offer → enrolment funnel
- 🔵 Online forms per level, document upload & verification, merit lists, quota/reservation rules (India: SC/ST/OBC/EWS, RTE 25%)
- 🔵 International applications (transcripts, English proficiency, visa letters)
- 🟣 Counselling/seat allotment rounds (JoSAA/CAP-style), lead scoring with AI

### 4.3 Student Information System (SIS)
- 🟢 Unified learner profile (demographics, guardians, health, documents, IDs: APAAR, UDISE+ PEN, national IDs)
- 🟢 Enrolment history across levels & institutions (lifelong record)
- 🟢 Section/batch allocation, promotions, transfers, TC/leaving certificate
- 🔵 Discipline, counselling notes (privacy-restricted), special needs (IEP/504)
- 🔵 Bulk import/export, merge duplicates

### 4.4 Academics & Curriculum
- 🟢 Academic structure: Level → Programme/Grade → Course/Subject → Section
- 🟢 Curriculum mapping: subjects, credits (CBCS/ECTS/US credit hours), learning outcomes
- 🟢 Academic calendar & terms (semester, trimester, quarter, annual)
- 🟢 Timetable (manual) — 🔵 AI auto-scheduler with constraints (teacher load, rooms, labs)
- 🔵 Lesson plans, syllabus coverage tracking
- 🔵 Electives, choice-based credit system, MOOCs/SWAYAM credit transfer
- 🔵 Outcome-Based Education: CO/PO/PSO mapping, attainment calculation (NBA/ABET)

### 4.5 Attendance
- 🟢 Daily (K-12) and period/lecture-wise (HE) attendance
- 🔵 QR / geofenced / face-recognition / RFID / biometric integrations
- 🔵 Shortage alerts, condonation workflow, guardian SMS/WhatsApp
- 🔵 Staff attendance & leave

### 4.6 Examinations & Assessment
- 🔵 Exam scheduling, hall tickets, seating, invigilation
- 🔵 Gradebook with configurable schemes: CBSE CCE/grade bands, IB 1–7, GPA 4.0, CGPA 10, ECTS A–F, UK classifications
- 🔵 Holistic Progress Card (NEP 2020/PARAKH 360°)
- 🔵 Question bank with Bloom's taxonomy tagging; online proctored tests
- 🟣 AI-assisted grading (rubric-based, handwritten script OCR), plagiarism checks
- 🔵 Results, revaluation, moderation, transcripts

### 4.7 Fees & Finance
- 🔵 Fee structures by level/category, instalments, concessions, scholarships, late fines
- 🔵 Online payments (UPI, Razorpay, Stripe, PayPal, local gateways), receipts, refunds
- 🔵 Multi-currency, GST/VAT invoicing, accounting ledger, Tally/QuickBooks/Xero export
- 🟣 Education loans, sponsor billing, fee-default prediction

### 4.8 Learning Management (LMS)
- 🔵 Courses, modules, content (video, SCORM/xAPI, H5P), assignments, quizzes
- 🔵 Live classes (Zoom/Meet/Jitsi/BigBlueButton integration), recordings
- 🟣 Adaptive learning paths, AI tutor per course (grounded in course content)
- 🟣 Gamification for kids (badges, streaks, avatars)

### 4.9 Research & PhD Lifecycle
- 🟢 Scholar registry: programme, supervisor/co-supervisor, research area, milestones (shown in Phase 1 data)
- 🟣 Entrance (UGC-NET/CSIR/GATE), RAC/DRC committee meetings, coursework
- 🟣 Six-monthly progress reports, synopsis, pre-submission seminar
- 🟣 Thesis submission, plagiarism (Shodhganga/iThenticate), examiner allocation, viva, award
- 🟣 Publications (ORCID, Scopus, Web of Science, Crossref sync), patents, citations
- 🟣 Grants & projects: proposals, budgets, utilisation certificates, funding agencies (DST, SERB, NSF, ERC)
- 🟣 Lab & equipment booking, ethics committee approvals

### 4.10 Human Resources & Payroll
- 🔵 Staff profiles, qualifications, workload, appraisals (API/CAS for UGC)
- 🟣 Payroll with country rules (PF/ESI/TDS for India, PAYE, etc.), leave, recruitment

### 4.11 Communication & Community
- 🔵 Announcements, circulars, messaging (with moderation for minors), events calendar
- 🔵 SMS, email, WhatsApp, push notifications; multilingual auto-translation
- 🔵 Parent-teacher meetings scheduling, surveys & feedback

### 4.12 Campus Operations
- 🔵 Library (catalogue, circulation, e-resources, RFID, Koha/MARC21 import)
- 🔵 Transport (routes, GPS tracking, student safety alerts)
- 🔵 Hostel & mess, inventory & assets, canteen, health/infirmary, visitor management
- 🟣 Placements & internships, alumni

### 4.13 Compliance & Accreditation
- 🟢 Framework-aware data model (fields needed for UDISE+, AISHE, NIRF captured from day one)
- 🟣 Report builders: UDISE+, AISHE, NIRF, NAAC SSR/AQAR, NBA SAR, IPEDS (US), HESA (UK), state returns
- 🟣 Evidence repository mapped to criteria/metrics
- Privacy: GDPR, FERPA, COPPA, India DPDP Act 2023 (verifiable parental consent for under-18s), consent ledger, right to erasure, audit logs

### 4.14 Credentials & Identity
- 🟢 APAAR ID / ABC ID fields on learner profile
- 🟣 Verifiable digital certificates: W3C Verifiable Credentials + Open Badges 3.0, anchored on a permissioned ledger (hash only — no PII on chain)
- 🟣 ABC credit deposit/redeem, DigiLocker / NAD issuance, public verify portal (QR)
- ⚪ Learner wallet — learner owns and shares credentials across institutions & employers

### 4.15 AI & Analytics
- 🟢 Dashboards per role (enrolment, attendance, performance)
- 🔵 Natural-language Q&A over institution data ("Which Class 9 sections are below 75% attendance?")
- 🟣 Early-warning: dropout / failure risk scoring with explainable factors
- 🟣 AI timetable solver, AI report-card remarks, AI lesson-plan generator
- 🟣 AI copilots: Admin, Teacher, Student tutor, Parent helper — every action audited, human-in-the-loop for decisions about learners

---

## 5. Architecture

### 5.1 Target architecture (production)

```
            ┌──────────────── Clients ────────────────┐
            │ Web (React) · Mobile (React Native) ·    │
            │ Kiosk/Attendance devices · Public APIs  │
            └───────────────┬─────────────────────────┘
                            │ HTTPS / GraphQL + REST, OIDC tokens
                    ┌───────▼────────┐
                    │  API Gateway   │  tenant resolution (subdomain/header),
                    │  + Auth (OIDC) │  rate-limits, SSO (Google, Microsoft, SAML)
                    └───────┬────────┘
     ┌──────────────┬───────┼─────────┬──────────────┬──────────────┐
  Identity &     SIS &     Academics  Finance       LMS        Research
  Tenancy      Admissions  & Exams                              & Credentials
     └──────────────┴───────┬─────────┴──────────────┴──────────────┘
                            │ events (Kafka / NATS)
          ┌─────────────────┼──────────────────┬─────────────────┐
     PostgreSQL (per-     Object storage      Search          AI services
     region, RLS by       (docs, media)    (OpenSearch)   (LLM gateway, ML
     tenant_id)                                             models, vector DB)
```

- **Modular monolith first**, split along the module boundaries above when scale demands.
- **Multi-tenancy:** shared schema with `tenant_id` + PostgreSQL Row-Level Security; enterprise tier can get a dedicated database. Regions deployed separately for data residency.
- **Event-driven** integrations (attendance marked → guardian notification; result published → credential issued → ABC credits deposited).
- **Offline-first mobile** for low-connectivity regions (sync queue).

### 5.2 MVP architecture (this repository)

```
React 18 + TypeScript (Vite)
 ├─ UI: Tailwind CSS + shadcn-style components, Recharts, lucide icons
 ├─ State/data: TanStack Query → fetch('/api/...')
 ├─ i18n: i18next + Intl APIs (all ISO languages listed, RTL aware)
 └─ Mock backend: MSW (Mock Service Worker) in the browser
       └─ in-memory DB persisted to localStorage, seeded per tenant
```

The UI only talks to `/api/*` via `fetch`. Replacing MSW with a real backend requires **no UI changes** — just disable the worker and point to the real API base URL.

### 5.3 Core data model (simplified)

```
Tenant(id, name, type, levels[], framework, gradingScheme, country, currency, locale, branding)
User(id, tenantId, name, email, roles[], linkedPersonId)
Person ─┬─ Learner(id, tenantId, admissionNo, apaarId, abcId, dob, level, programId, sectionId, guardians[])
        ├─ Staff(id, tenantId, designation, departmentId, subjects[])
        └─ Guardian(id, tenantId, relation, learnerIds[])
Level(id, code, name)                    e.g. PRIMARY, SECONDARY, UG, PG, PHD
Program(id, tenantId, levelId, name, durationTerms, creditSystem)   "Grade 5", "B.Tech CSE", "PhD Physics"
Course(id, programId, code, name, credits, outcomes[])
Section(id, programId, name, termId, classTeacherId)
Term(id, tenantId, name, start, end)
TimetableSlot(id, sectionId, day, period, courseId, staffId, room)
AttendanceRecord(id, learnerId, date, slot?, status)
ResearchProfile(learnerId, supervisorId, topic, stage, milestones[])
AuditLog(id, tenantId, actorId, action, entity, at)
```

---

## 6. Global readiness

- **Languages:** every ISO 639-1 language selectable (names rendered via `Intl.DisplayNames`); bundled translations for English, Hindi, Tamil, Telugu, Bengali, Marathi, Arabic, Spanish, French in v1; others fall back to English with a machine-translation pipeline + community translation packs. Full RTL (Arabic, Urdu, Hebrew, Persian).
- **Locale formats:** numbers, currency, dates, and the Indian numbering system (lakh/crore) via `Intl`.
- **Calendars & weeks:** configurable week start, weekends (Fri–Sat in the Gulf), academic years (Apr–Mar India, Sep–Jun Europe/US, Jan–Dec Southern Hemisphere).
- **Grading:** pluggable grading schemes per framework pack.
- **Accessibility:** WCAG 2.2 AA, keyboard-first, screen-reader labels, dyslexia-friendly font option, kids mode.

---

## 7. Security & privacy

- OIDC/SAML SSO, MFA for staff, passwordless/OTP for guardians, age-appropriate child accounts.
- Tenant isolation (RLS), encryption at rest and in transit, per-tenant keys (enterprise).
- Field-level permissions for sensitive data (health, counselling, caste/category).
- Consent ledger; parental consent for minors (DPDP, COPPA, GDPR-K).
- Immutable audit log; data export & erasure workflows.
- AI guardrails: no automated adverse decisions about learners; explanations shown; opt-out per tenant.

---

## 8. Roadmap

| Phase | Scope | Status |
|---|---|---|
| **1 — Foundation** | Multi-tenant shell, branding, RBAC with 5 portals, i18n (all languages, RTL), mock API, dashboards, SIS (learners, guardians, staff), academic structure (levels, programmes, courses, sections), timetable, attendance | ✅ Done |
| **2 — Core operations** | Admissions CRM + public application form, exams & gradebook (marks entry, publishing, analysis, CO attainment), report cards (grades, SGPA/CGPA/GPA, rank), fees & payments (structures, concessions, test-mode online payment, receipts, reminders), announcements & safeguarded messaging, library circulation & fines | ✅ Done |
| 2b — Operations | HR & payroll, transport & hostel, Holistic Progress Card, real payment gateways, MARC21 import, live SMS/WhatsApp | Next |
| **3 — AI & LMS** | LMS (lessons, rubric assignments, auto-marked quizzes, live classes, progress, kids mode), explainable AI early-warning, AI timetable solver, AI grading assistant + similarity check, role-aware assistant & course tutor (see docs/AI.md) | ✅ Done |
| **3b — Verifiable credentials** | W3C VC 2.0 signed credentials (ecdsa-jcs-2019, did:web), Open Badges 3.0, public verifier + QR, revocation, hash-chained ledger, learner wallet, ABC / ECTS credit bank, DigiLocker push (see docs/CREDENTIALS.md) | ✅ Done |
| 3c — Research & compliance | Full PhD lifecycle, accreditation reports, live Claude backend, OID4VCI | Next |
| 4 — Ecosystem | Mobile apps, real backend, marketplace, learner wallet, alumni & placements, public APIs | Planned |

---

## 9. Demo tenants (seed data)

| Tenant | Type | Framework | Levels | Locale |
|---|---|---|---|---|
| Greenfield Public School, Bengaluru | K-12 school | CBSE | Pre-primary → Senior Secondary | en-IN, INR |
| Indus Institute of Technology, Pune | Engineering college | AICTE / NBA, CBCS | UG (B.Tech), PG (M.Tech) | en-IN, INR |
| Meridian Research University, Dubai | University | Bologna / ECTS | UG, PG, PhD | en-AE / ar, AED |

Each tenant has demo users for every role; switch user from the login screen.
