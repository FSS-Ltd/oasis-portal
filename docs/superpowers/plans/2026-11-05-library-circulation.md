# Library circulation tabs implementation

Base: origin/main 3552e9db (2026-11-03). Brief: staff Checked Out, Overdue and Borrowing History tabs (Returned tab removed per user correction); selected-child returns; paginated tables and student accordions; plan physical/digital QR cards.

## Direction and decisions

Reuse current library records, tRPC authorization/RLS, loan-ID returns and commit/midnight notifications. Extend read operations with bounded pagination. Keep the existing catalogue, collections and circulation desk. Returned loans appear in student history; the catalogue shows stock. Implement staff web and native tabs with shared domain status labels. Cards are planning only; no migration or new dependency for this task. An additional loan model or a public child QR endpoint would duplicate ownership or weaken access boundaries.

## Tasks

1. Add failing API tests for overdue boundaries (London), paginated loan reads, student-specific history, permission rejection and return replay/wrong-loan safety. Add a shared loan-status helper with tests. Query service lives in `apps/api/src/services/library-circulation.ts`; new router methods are `circulationPage` and `borrowerHistoryPage`, with existing librarian middleware. Pages return at most 20 loans or 12 students plus `nextPage` and the server's London date.
2. Build web view tabs and compact paginated tables. History headers are paginated student accordions, each lazily loading paginated loans by student ID. Keep explicit named-child return actions. Refresh the library query family on successful writes and use existing realtime coverage for remote writes and midnight. Check loading/error/empty/pending/success and keyboard states.
3. Add native equivalents using existing mobile components and tokens. Paginate the existing native catalogue. Keep camera and checkout behavior.
4. Save card plan, update feature inventory and scoped Graphify extraction, self-review changed files. Verify no stale affected graph paths. Run root lint, typecheck, tests and web build; record any environment limits. Review in Codex in-app browser if available, without Chrome.

## Verification focus

Due today is not overdue; returned loans never show overdue. Every return sends a loan ID, never title-wide updates. Inactive students retain history. Every page has a deterministic tie-breaker. History details do not fetch until expanded. No repeated discovery polling. No new database migration.
