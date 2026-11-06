# Child library cards and circulation

Status: planned. Card issuance, QR scanning and children's portal cards are not implemented by the circulation-tabs change.

## Intended experience

A child uses the same library identity on a durable physical card and a digital card in the children's portal. Librarians retain control of checkout and returns. Scanning identifies the child; it never completes a write silently.

### Checkout

1. Librarian opens Checkout and scans book barcodes into a cart. Each scan adds one copy; quantities remain visible and editable. Repeated scans must be deliberate, with clear feedback.
2. Scan the child's card. Show their name, school level, current loans and any borrowing restrictions. The librarian can correct the child before proceeding.
3. Show a compact review: child, books/copy quantities, common due date with per-item changes where needed. Confirm checkout once.
4. In one RLS transaction, recheck librarian permissions, card validity, student eligibility, dates and stock. Lock title rows in deterministic order. Create a separate LibraryLoan per physical copy and commit before notifying subscribers.
5. Clear the cart only after success. Use an idempotency key so duplicate scans, retries and network timeouts cannot create duplicate loans. On failure retain the cart and explain which title needs attention.

### Returns, including partial returns

1. Librarian chooses Return and scans the child's card.
2. Load only that child's open loans through authorized tRPC. Display an accessible checklist, grouped by title with checkout date and due date when copies repeat. No boxes are checked by default.
3. Librarian ticks the books physically received. A scanned book barcode can locate matching loans within this child; when two copies match, require the librarian to choose the loan. An ISBN identifies a title, not a unique physical copy.
4. Confirm “Return 2 books for [child]”. Submit the child ID, selected loan IDs and card ID/version. In one transaction, validate every selected loan belongs to that child and is still open. Return only those IDs. A stale selection must never return another child's replacement loan.
5. Record returning staff identity/time; update stock using existing loan triggers. Duplicate return submissions are idempotent. Unticked loans stay open, including overdue loans.

## Cards and identifiers

- Propose a credit-card-sized physical layout (85.6 × 54 mm), school branding, child display name, school level, a readable card reference and a high-contrast QR. Keep QR quiet zones and test real print sizes before ordering cards. Use A4 print sheets with cut guides and a single-card print option.
- Encode a versioned opaque random token such as `oasis-library:v1:<random-token>`. Do not encode a child's database ID, birth date, address, login token or a public profile URL.
- Add a LibraryCard record linked to Student: token digest, version, issuedAt, issuedById, revokedAt and revokedById. Store only the digest for lookup. The raw token must remain recoverable for the authorized digital/print views; choose application-encrypted token storage under the existing encryption facility, with a unique digest index. Do not put tokens in logs, audit metadata or notifications.
- One active card per child initially. Replacing a lost card revokes its token and issues a new one. Printed and digital cards share the active token; old screenshots and old physical cards stop resolving after replacement. A static card identifies a borrower, and does not prove the presenter owns it; show the child identity for staff confirmation.
- The QR is an identifier, never authorization. Resolve and mutate only in a signed-in, librarian-authorized session through RLS. Unauthorized scans reveal no student details. Limit lookup attempts and use generic invalid/revoked-card errors.
- Card issuance/revocation permission follows existing library management. Digital card access is limited to the signed-in child's own student link; guardian access requires an explicit linked-child policy. Public QR URLs must not expose records.

## Digital card in the children's portal

Add a Library entry using the existing student portal shell. Provide “My library card”, an adequately sized QR, readable card reference and outstanding loans. Children can view their own borrowing history with pagination. Provide an accessible text alternative and instructions to show the card to a librarian. The QR must remain legible at 200% zoom and in bright/dim conditions. Avoid storing library card tokens in service-worker caches or analytics. Expired sessions require sign-in; no offline mutation queue in the first release.

## Data, events and rollout

Reuse LibraryBook, LibraryLoan, checkout/checkin stock rules, existing camera infrastructure and committed-change subscriptions. Extend the existing library service with cart checkout and child-scoped batch returns; do not add another loan model. Card persistence and idempotency require a reviewed database migration, grants/RLS, indexes and audit coverage. Register the new model/query area in realtime coverage, including child audiences and revocation events. Reconcile after subscription, reconnect and foreground. Notify only after commit, with no QR token or child PII in events. Keep due-state refresh on the existing Europe/London midnight clock; no polling.

Deliver in stages: (1) migration and service contracts, (2) card issue/revoke and print preview, (3) librarian cart/scan/return checklist, (4) children's portal card/history, (5) supervised pilot with a small printed batch. Keep existing manual checkout and selected-loan returns available throughout.

## Acceptance checks

- Two children borrow the same title; returning one child's selected loan leaves the other's open.
- One child borrows several titles or two copies; a partial return updates only checked loan IDs.
- Wrong-child, wrong-book, cross-scope, inactive-student and revoked-card requests fail without changes.
- Competing carts cannot oversubscribe stock; batch failure rolls back every item.
- Duplicate checkout confirmation creates one set of loans; duplicate return never changes another loan.
- Authorization revocation is rechecked at confirmation; subscriptions clean up on account changes.
- Idle screens make no state-discovery requests; committed changes reach authorized screens; reconnect catches missed changes.
- Print and phone QR scans work with existing supported camera devices and keyboard scanners; camera denial supports readable-reference/manual student selection.
- Lists have bounded pages; student records collapse; keyboard/screen-reader labels and focus survive confirmation and errors.

Open decisions for card implementation: borrowing limits, any guardian digital-card access, replacement-card charges (if any), and whether individual physical copies need unique asset labels in addition to shared title barcodes. None blocks the current loan tabs.
