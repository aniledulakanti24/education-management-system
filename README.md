# UnifiedTree Education ERP

One multi-tenant platform for the whole learning lifecycle — pre-primary to PhD — for institutions anywhere in the world.

- **Blueprint** (modules, architecture, compliance, roadmap): [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
- **This repo:** Phases 1–3 — React front end with a mocked backend: foundation, SIS, academics, timetable, attendance, admissions, exams & report cards, fees, communication, library, LMS, AI and verifiable credentials.
- **AI design & Claude production path:** [docs/AI.md](docs/AI.md)
- **Verifiable credentials design:** [docs/CREDENTIALS.md](docs/CREDENTIALS.md)

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173, choose an institution and a role. No password needed — it's demo mode.

| Demo institution | Framework | What to try |
|---|---|---|
| Greenfield Public School, Bengaluru | CBSE, LKG–Grade 12 | Admin dashboard, attendance marking, **Grade 3 learner → kids mode**, parent with two children |
| Indus Institute of Technology, Pune | AICTE / CBCS | Engineering semesters, faculty timetable, credit-based courses |
| Meridian Research University, Dubai | Bologna / ECTS | PhD scholars, supervisors, research milestones, Mon–Fri week |
| Platform operator | — | All tenants, onboard a new institution, framework packs, 183 languages |
| Public admission form | — | Open `/apply/greenfield`, `/apply/indus` or `/apply/meridian` — no sign-in |
| Credential verifier | — | Open `/verify` — paste a credential, scan its QR code or try tampering with it |

"Reset demo data" on the login screen restores the seed.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 (shadcn-style components) · TanStack Query · React Router · i18next · Recharts · MSW 3.

## Mock backend → real backend

The UI only calls `fetch('/api/...')` through [src/lib/api.ts](src/lib/api.ts). [Mock Service Worker](src/mocks/handlers.ts) answers those calls in the browser and persists data to `localStorage`.

To switch to a real API, set `VITE_API_BASE=https://api.example.com` — the worker is then skipped and no UI code changes. The handlers double as the API contract for the backend team.

## Project layout

```
docs/BLUEPRINT.md        product & architecture blueprint
src/mocks/               seed data, localStorage DB, REST handlers
src/i18n/                language registry (all ISO 639-1), bundled translations
src/lib/                 api client, session/tenant context, framework packs
src/components/          ui primitives, app shell, charts, shared widgets
src/pages/               dashboards per role + module pages
```
# education-management-system
