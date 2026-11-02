# Gemma 4 staff assist: integration plan

**Status:** Draft for Head and owner review. No code written.
**Date:** 2026-11-02
**Scope:** Staff only (Head, Principal, Pastor, HeadOfDiscipline, SafeguardingLead, Supervisor,
ClubsAdmin, ClubsLead, TechnicalSupport, and `finance-admin` tagged staff). Parent and student
features are out of scope for this plan.

---

## 1. Problem

Staff spend their admin time rebuilding things the portal already knows. A term's invoices look like
last term's with a few changes. A term report restates attendance, PACE and behaviour data that is
already compiled, and the Head then writes the comment from a blank box. Incident write-ups, notices
and permission slips start from nothing every time.

The goal: the portal prepares the draft, a named person approves it. The person's job moves from
writing to reviewing.

## 2. Core decision: code computes, Gemma words

Small language models write fluent sentences and get arithmetic wrong. So every fact in an AI draft is
calculated by tested code first, and Gemma only turns those facts into prose.

Example for one subject:

- **Code (exact):** Maths, ACE level 7, expected level 5 for Year 4, two levels ahead. Four PACEs this
  term, average test score 94%. At this pace, reaches level 10 at age 13 years 8 months.
- **Gemma (wording):** "Amara has had an excellent term in Maths and is working two levels above what's
  expected for her year. If she keeps this pace, she's on track to reach GCSE-level work before she
  turns 14."

Most inputs already exist. `paceNumberToAceLevel` and `expectedPaceLevelForYear` in
`packages/domain/src/subjects.ts` give the level and the ahead or behind status, and `PaceSnapshot` in
the compiled report has PACEs completed this term and the average test score. The only new calculation
is the pace projection.

Because the model only rephrases supplied facts, a phone-sized model is enough.

## 3. Where Gemma runs

Gemma 4 is Apache 2.0 and comes in on-device sizes (E2B, E4B) and server sizes (12B, 26B A4B, 31B).

| Option | Verdict |
|---|---|
| **A. On-device E2B or E4B in the Expo app** | **Recommended for Phase 1.** The Head's phone already receives the decrypted report data to display it, so no data leaves the app that does not already. No GPU bill, which suits the free-tier stack. No new data processor. |
| B. Server 26B on a UK/EU GPU | Not needed for Phase 1. Revisit only if on-device quality falls short, or for batch work a phone cannot do. |
| C. Google's hosted Gemma API | Rejected: children's PII, data terms, processing location. |

On-device constraints:

- **Download:** the model is a separate, opt-in download of roughly 1.5 to 3 GB over Wi-Fi, only for
  staff who use the feature. It is not in the app bundle, so store size limits are unaffected.
- **Devices:** target recent phones with about 8 GB of memory. Unsupported or older phones fall back to
  writing by hand, exactly as today. Confirm on real devices before rollout.
- **Speed:** a few seconds to about 20 seconds per comment. Generate when the Head opens a report, not
  80 at once.
- **Native module:** needs a native runtime (for example `llama.rn`, or Google's LiteRT-LM via an Expo
  module). The app already ships native EAS builds, so this fits. Not available in the web or PWA build.
- **Consistency:** pin one model file version and record it on each draft.

## 4. Every staff workflow, and what to do

Priority: **P1** = Phase 1, **P2** = next, **P3** = later, **No** = leave as is.
"Rules" means plain code, no model.

| # | Workflow (router) | Who | Assist | Priority |
|---|---|---|---|---|
| 1 | **Term reports** (`report`) | Head, admin operations | Code computes per-subject level, ahead or behind, pace this term, and projection. Gemma on the Head's phone writes `progressComment`, `behaviourNotes` and `generalNotes` from those facts plus allow-listed child notes. The Head edits, then uses the existing review and send. | **P1** |
| 2 | **School fee invoices** (`invoice`) | Full admins, `finance-admin` tag | Rules only. Roll forward last period's invoices into next period Drafts per family through the existing generator, then flag: new sibling without discount, student left but still billed, fee config changed, discount opt-out still set. Template text for discount explanations. | **P1** |
| 3 | **Approvals inbox on mobile** (new) | Finance, Head | Mobile has no staff invoice or report screens today. One "Drafts to approve" list on staff home: flags first, then edit, approve or reject. | **P1** |
| 4 | **Incident reports** (`incident`) | All staff write, Head signs off | Structure rough notes into the draft fields and list missing facts. Check the parent copy for other children's names (rules, from the name index) and suggest neutral wording (Gemma). | P2 |
| 5 | **Notices and calendar** (`notice`, `calendar`) | Admin, ClubsAdmin | Turn bullet points or a calendar event into a notice in the school's tone. | P2 |
| 6 | **Permission slips** (`permissionSlip`) | Admin | Start from the last slip for the same venue (rules), Gemma tidies wording. | P2 |
| 7 | **Parent and staff messages** (`message`) | All staff | Reply draft, tone check before send, translation for families using another language. Staff press send. | P2 |
| 8 | **PACE gap plans and diagnostics** (`academicInventory`, `pace`) | Supervisors, admin | Draft a gap plan from a diagnostic result. Next-PACE ordering stays rules. | P2 |
| 9 | **Behaviour** (`behaviour`) | All staff, HeadOfDiscipline | Category suggestion while logging. Pattern summary before a demerit escalation. | P3 |
| 10 | **Child notes and child log** (`childNotes`, `childLog`) | Staff with access | One-page brief before a parent meeting from non-sensitive data. Sensitive review queue excluded. | P3 |
| 11 | **Attendance** (`attendance`) | Admin | Weekly narrative on top of the existing `insights`. Drafted absence follow-up for staff to send. | P3 |
| 12 | **Homework** (`homework`) | Supervisors | Draft feedback and assignment instructions for the supervisor to edit. | P3 |
| 13 | **Staff home and tasks** (`staffHome`, `personalTask`) | All staff | Morning "needs your attention" summary. | P3 |
| 14 | **Club notices** (`club`) | ClubsLead, ClubsAdmin | Same as 5. | P3 |
| 15 | Rota and cover (`rota`) | Admin | **No.** A scheduling problem; code does it better. | No |
| 16 | Attendance marking, shop counter, library, timetable building, user access, agreements, audit log, compliance register | Various | **No.** Taps, scans and rules. | No |

## 5. Phase 1 design

### 5.1 Pace projection (domain, pure)

A new function in `packages/domain`, for example `projectPaceProgress`:

- Input: current PACE number, PACEs completed in the period, period length, date of birth, target ACE
  level.
- Output per subject: current level, expected level, levels ahead or behind, PACEs per term, projected
  date and age at which the target level is reached, or `null` when there is not enough data
  (for example no PACEs completed this term).
- PACEs per level is 12, matching `paceNumberToAceLevel`.
- The target level that counts as "GCSE level" is a config value the Head sets (open question 1).

Unit tests cover ahead, behind, on track, zero pace, and missing date of birth.

### 5.2 Report drafting on the phone

1. The Head opens a Draft report on mobile.
2. The app builds a fact sheet from the compiled report and the projection: names replaced with
   tokens, only allow-listed fields.
3. If the model is installed and the device is supported, Gemma writes the comment and notes. Output is
   checked against a schema and detokenised. Otherwise the fields stay blank for the Head to write.
4. AI text appears in editable fields with an "AI draft" badge and the source facts beside it.
5. Approve calls the existing `review`, then `send`. The API records `aiModel` and an `AiDraft` audit row.

Style: the prompt includes three or four of this Head's previously sent comments, tokenised, so the
draft matches their voice (open question 3).

### 5.3 Invoice roll-forward (rules)

1. Finance taps "Prepare next period" for a school year and cadence.
2. The API finds each family's latest `SchoolFee` invoice for the previous period and calls the existing
   generated-invoice logic with current fee config, siblings and discount opt-outs. One Draft per family.
3. Rule checks produce flags, stored encrypted on the invoice.
4. Finance reviews in the inbox, edits through `updateGenerated`, and publishes with `publishDraft`.

### 5.4 Data model changes

- `aiDraftedAt DateTime?` and `aiModel String?` on `TermReport`.
- `rollForwardFlagsJsonEnc String?` on `SchoolFeeInvoice`.
- Target "GCSE level" ACE level as a setting (existing config pattern, or a new single-row table).

No job queue is needed in Phase 1: generation happens on the phone, one report at a time.

## 6. Rules that apply to every AI feature

1. AI output only ever lands in a Draft. Existing approve, publish and send procedures stay human-only.
2. Gemma never produces a number that is billed or reported as fact. Code computes, Gemma words.
3. Allow-list per feature. `IncidentSafeguardingNote`, safeguarding child notes, the sensitive review
   queue and compliance medical data never reach the model.
4. Names are swapped for tokens before the prompt and put back after. A post-check rejects output that
   contains any known name the input did not supply.
5. Every approved AI draft writes an `AuditLog` row with entity `'AiDraft'`: feature, target id, model,
   prompt version. No prompt or output text.
6. A remote feature flag per feature, so it can be turned off without an app release.

## 7. Failure modes

| Failure | Handling |
|---|---|
| Phone unsupported, model not downloaded, or out of memory | Fields stay blank, Head writes as today. |
| Output invalid or wrong shape | Schema check rejects it, one retry, then blank fields. |
| Model states something not in the facts | Facts shown beside the text. Prompt forbids new numbers; a check rejects output containing numbers not in the fact sheet. Track edit rates per prompt version. |
| Projection data missing | Projection returns `null`, the fact sheet omits it, no claim is made. |
| Invoice rule misses a case | Finance still reviews every draft; add the rule once found. |
| Prompt injection through a note | Inputs passed as data; output only fills editable draft fields. |

## 8. Security and privacy

- DPIA before go-live, signed off by the Head. On-device keeps it simple: no new processor and no data
  leaves the app, but it is still new processing of children's data. Add one line to the parent privacy
  notice. UK GDPR Article 22 does not apply because a person approves every output.
- RBAC: the mobile screens use the same guards as the actions they prepare (`requireInvoiceManager`,
  `adminOperationsProcedure`).
- The model file is downloaded from a pinned URL with a checksum check.

## 9. Rollout and rollback

1. Evaluation set: 20 past reports from client-demo fixtures (or real ones, anonymised, with the Head's
   consent). Score factual accuracy against the fact sheet and Head edit distance, on at least one
   iPhone and one Android.
2. Feature flags off by default. Review tenant first, then the Head only, then finance for invoices.
3. One term in shadow: drafts generated, the Head compares them with their own, nothing changes for
   parents.
4. Rollback: turn the flag off. Manual flows never stop working.

## 10. Success metrics

- Days from period end to all reports sent. Target: halved.
- Head edit distance on AI comments. Target: under 30 percent of characters changed by term two.
- Finance time per invoice run. Target: under 1 minute per family.
- Zero model-produced numbers in sent reports or invoices (enforced by design and tests).
- Zero AI text reaching a parent without a recorded human approval (checked from the audit log).

## 11. Build sequence (PRs under 400 lines each)

**Phase 0, decisions (no code):** open questions below, DPIA, evaluation set.

**Phase 1:**
1. `projectPaceProgress` and fact-sheet builder in domain, with unit tests.
2. Device spike: run Gemma 4 E2B and E4B in an EAS dev build on one iPhone and one Android. Measure
   memory, speed and quality on the evaluation set. Go or no-go on model size.
3. Model download manager, tokeniser and output checks in mobile, behind a flag.
4. Mobile "Drafts to approve" inbox and report review screen with AI drafting.
5. Invoice roll-forward and rule flags (API and web).
6. Mobile invoice review in the same inbox.
7. Shadow-term run and metrics.

**Phase 2:** incidents, notices and permission slips, message drafts and translation, PACE gap plans.

**Phase 3:** behaviour and child briefs, attendance narrative, homework feedback. Revisit a server model
only if on-device quality or batch needs require it.

## 12. Open questions for the Head and owner

1. Which ACE level counts as "GCSE level" for the projection?
2. Who in finance holds the `finance-admin` tag today, and do they use mobile?
3. Can past real reports be used (anonymised) to teach the Head's style, or demo data only?
4. Should AI drafting be off for children with active safeguarding cases? Recommended: yes, by default.
5. Which staff phones need supporting? This decides E2B or E4B.
