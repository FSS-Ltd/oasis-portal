# Rolling Tech Debt Pull Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the accumulated unmerged tech-debt reviews in one pull request and make future scheduled runs append to one existing open tech-debt pull request or create one when none exists.

**Architecture:** Rebuild the backlog on a clean branch from the fetched default branch so already-merged work drops out and unrelated local files remain untouched. Update the existing Codex automation prompt, not repository CI, because scheduling already belongs to the Codex project automation.

**Tech Stack:** Git, GitHub pull requests, Codex cron automation, pnpm Turborepo, TypeScript, ESLint, Prettier, Vitest.

## Global Constraints

- Never automatically merge or enable auto-merge.
- Never force-push or overwrite unrelated work.
- Never create a second tech-debt pull request when exactly one valid matching pull request is open.
- Never append when the existing pull request branch is ambiguous, unwritable, conflict-blocked, or from a fork.
- Preserve product behaviour and all API, auth, role, tenancy, billing, safeguarding, and database contracts.
- Do not include unrelated local documentation or feature work.

---

### Task 1: Rebuild the accumulated backlog on the current default branch

**Files:**

- Modify: `.codex/tech-debt-review/current-pass.md`
- Modify: `.codex/tech-debt-review/memory.json`
- Modify: `.codex/tech-debt-review/review-log.md`
- Modify: review-backed source files recorded in `review-log.md`
- Create when still unmerged: `apps/web/src/lib/photo-upload-validation.ts`

**Interfaces:**

- Consumes: the current worktree diff, `review-log.md`, and `origin/main`
- Produces: a branch diff containing only review-backed changes not already present on `origin/main`

- [ ] **Step 1: Fetch and inspect the default branch**

Run:

```bash
git fetch origin main
git status --short --branch
git log --oneline --left-right --cherry-pick origin/main...HEAD
```

Expected: the current branch is named and the existing worktree changes remain visible.

- [ ] **Step 2: Identify review-backed changed files**

Cross-reference every changed or untracked source file against `.codex/tech-debt-review/review-log.md`. Exclude unrelated documentation and any feature files not recorded by the review log.

- [ ] **Step 3: Rebuild from `origin/main`**

Create an isolated worktree from `origin/main`, cherry-pick the approved design commit, and apply only the review-backed patch. Do not apply files whose working-tree content is already identical to `origin/main`.

- [ ] **Step 4: Verify the reconstructed diff**

Run:

```bash
git diff --check origin/main
git diff --name-status origin/main
```

Expected: only review memory, review-backed source changes, the design, and this plan are present.

### Task 2: Update the Daily Tech Debt Review automation

**Files:**

- External Codex automation: `daily-tech-debt-review`

**Interfaces:**

- Consumes: existing automation schedule, model, project, reasoning effort, and review prompt
- Produces: the same active daily schedule with rolling pull-request publishing rules

- [ ] **Step 1: Preserve current automation configuration**

Keep the existing name, schedule, model, project, execution environment, status, and notification policy unchanged.

- [ ] **Step 2: Replace publishing guidance**

Add instructions to search for an open tech-debt pull request, append a new validated commit to its repository-owned head branch when safe, or create a new dated branch and pull request when none exists.

- [ ] **Step 3: Add fail-closed guards**

Require the run to stop without pushing when multiple matching pull requests exist, the branch is from a fork, mergeability is blocked or unknown, conflicts exist, validation fails, or unrelated changes are present. Explicitly prohibit merging and auto-merge.

- [ ] **Step 4: Inspect the updated automation**

View the automation after updating it and confirm the schedule remains active and unchanged.

### Task 3: Validate and publish the consolidated pull request

**Files:**

- Test: all files in the final `origin/main...HEAD` diff

**Interfaces:**

- Consumes: the reconstructed branch and updated automation
- Produces: one open GitHub pull request with no auto-merge

- [ ] **Step 1: Run selected-file quality checks**

Run Prettier and ESLint on all changed TypeScript and TSX files, then run `git diff --check`.

- [ ] **Step 2: Run affected package checks**

Run typechecks for API, mobile, web, database, and domain packages touched by the final diff. Run focused tests named in the accumulated review log plus any tests affected by retained refactors.

- [ ] **Step 3: Run repository build checks**

Run the repository build command when the package scripts and environment permit it. Record any exact external blocker.

- [ ] **Step 4: Review the final diff**

Confirm every changed file belongs to this pull request, no product ownership boundary changed, no migration exists, and no temporary output, debug log, placeholder, conflict marker, or unrelated user file is included.

- [ ] **Step 5: Commit and push**

Commit the reconstructed backlog with:

```text
chore: consolidate pending tech debt reviews
```

Push the named branch without force.

- [ ] **Step 6: Open or update the pull request**

If no open tech-debt pull request exists, open one against the default branch. If exactly one valid pull request exists, push the commit to its head branch instead and update its body. Leave the pull request open without auto-merge.
