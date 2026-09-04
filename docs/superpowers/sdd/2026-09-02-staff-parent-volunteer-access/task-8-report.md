# Task 8 report

- Added a non-manager Admin Rota tab modifier so four planning tabs use four equal desktop columns.
- Preserved the manager five-tab layout and the existing `max-width: 1100px` two-column rule.
- Scoped volunteer-access pending/disabled state to the staff row currently being toggled.
- Added focused source-contract coverage for both UX corrections.
- Checks passed: Admin Rota tab tests, volunteer-access contract tests, web typecheck, web lint, and `git diff --check`.
- Follow-up P1 correction: pending mutation counts are tracked per row and decremented using callback variables, so out-of-order success/error completion cannot re-enable another outstanding row.
- Follow-up rereview correction: disabled state now relies solely on row counts; `onSettled` always decrements the matching request, while invalidation is non-blocking and caught.
