# UnifiedTree AI — design and production path

Phase 3 ships four AI capabilities. In this repository they run as an **on-device engine inside the mock backend** (`src/mocks/ai/`), so the demo works offline, costs nothing and behaves deterministically. Every capability sits behind a normal REST endpoint, so a production backend can swap in a large language model **without changing the UI**.

| Capability | Endpoint | On-device engine (this build) | Production engine |
|---|---|---|---|
| Early-warning (dropout / failure risk) | `GET /api/ai/risk` | Explainable logistic score over attendance, attendance trend, marks, subjects below pass mark, overdue fees and missing coursework (`risk.ts`) | Same features plus a model trained on the institution's history (e.g. gradient-boosted trees), recalibrated each term. Claude writes the plain-language explanation and the intervention plan. |
| Timetable solver | `POST /api/ai/timetable/:section/propose`, `/apply` | Constraint solver with randomised restarts: no teacher clashes, subject spread, lab doubles, usual-teacher preference (`scheduler.ts`) | Same solver (OR-Tools CP-SAT at scale). The LLM is not used for hard constraints. |
| Grading assistant + similarity check | `POST /api/lms/submissions/:id/suggest` | Rubric keyword coverage and length heuristics; Jaccard similarity on 3-word shingles (`grading.ts`) | Claude grades against the rubric with structured output; similarity moves to a dedicated service (e.g. iThenticate / Turnitin for theses). |
| Assistant & course tutor | `POST /api/ai/assistant` | Role-aware intent routing over live data plus TF-IDF retrieval over published lessons (`assistant.ts`) | Claude with tools: the backend exposes read-only data tools; the model answers in the user's language. |

## Principles (both engines)

1. **Permission first.** The assistant only reads data through the same access rules as the UI (`visibleLearnerIds`, `classAccess`). A learner can never see another learner's data; guardians see only their own children; faculty only their classes.
2. **Human in the loop.** AI suggests; people decide. Grade suggestions need a teacher to confirm (`aiAssisted` is recorded on the submission and in the audit log); the risk score never triggers automatic action.
3. **Explainable.** Every risk flag lists its contributing factors; every tutor answer cites the lessons it came from.
4. **No protected attributes.** Caste, religion, gender and nationality are never model inputs.
5. **Minors.** In kids mode, the tutor answers only from published course content.

## Production: swapping in Claude

The backend replaces `answer()` in `src/mocks/ai/assistant.ts` with a call to the Claude API. Keep the API key on the server. Never call the model from the browser.

**Model:** `claude-opus-5-5`. Thinking is always on for this model; control cost and latency with `output_config: { effort }`:
- `low` for chat and simple lookups,
- `medium` (the default) for tutoring,
- `high` for grading long answers.

**Tools, not raw database access.** Expose narrow, read-only tools that run with the signed-in user's permissions. The mock handlers already implement these queries:

| Tool | Backed by |
|---|---|
| `get_attendance(section?, below_pct?)` | `attendanceStats` |
| `get_risk(section?)` | `computeRisk` |
| `get_results(learner_id)` | `reportCard` |
| `get_fees(learner_id?)` | `invoiceView` |
| `get_timetable(day)` | timetable slots |
| `search_lessons(query, course?)` | lesson retrieval, for grounded tutoring |

Define them with `strict: true` and use `tool_choice: { type: "auto" }`; this model rejects forced tool choice. Use the SDK's tool runner (`client.beta.messages.toolRunner`) so the loop and its hooks stay small.

```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic() // reads ANTHROPIC_API_KEY on the server

const response = await client.beta.messages.create({
  model: 'claude-opus-5-5',
  max_tokens: 16000,
  output_config: { effort: 'low' },
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default', // re-runs a declined request on a fallback model automatically
  cache_control: { type: 'ephemeral' }, // the institution's system prompt + tool list are cached
  system: SYSTEM_PROMPT, // role, institution, locale, safety rules; keep it byte-stable for caching
  tools: TOOLS,
  messages,
})
if (response.stop_reason === 'refusal') {
  // show a polite fallback message; never surface raw model errors to learners
}
```

**Grading with structured output.** Ask for `{ criteria: [{ criterion, points, rationale }], total, feedback }` using `output_config.format` with a JSON schema. Store the result as an `AiGradeSuggestion`, exactly as the mock does today.

**Languages.** Pass the user's UI language, for example `hi` or `ar`, in the system prompt. Claude answers in that language, so the assistant works in every language the UI supports. The on-device engine answers in English only.

**Safety and privacy.**
- Send only the fields a tool needs: names and marks, not phone numbers or addresses.
- Log the intent and the tool calls, not the answer text, in the audit trail.
- Honour each tenant's data-residency region when choosing the API endpoint (for example Claude on AWS or Google Cloud in-region).
- Tenants can switch the assistant off.

**Evaluation before launch.** Build a small eval set per role: about 50 real questions with expected tool calls and answers. Re-run it whenever the prompt, the tools or the model change.
