# Rolling Tech Debt Pull Request Design

## Problem

The daily tech-debt automation can leave reviewed changes uncommitted and unpushed across multiple runs. This creates a growing local backlog and makes each later run harder to review or recover.

## Goal

Maintain at most one open daily tech-debt pull request for the repository. Each successful automation run should add its reviewable changes to that pull request. If no open tech-debt pull request exists, the run should create one.

## Non-Goals

- Automatically merging tech-debt pull requests.
- Changing product behaviour, public APIs, database schema, migrations, dependencies, or release workflows.
- Combining unrelated user work with automated tech-debt changes.
- Force-pushing, overwriting, or resolving conflicts in an existing pull request branch.

## Existing Backlog

Create one branch from the current default branch and replay only the accumulated changes recorded by `.codex/tech-debt-review/review-log.md` that are not already present on the default branch. Exclude unrelated local files and changes already merged through earlier tech-debt pull requests.

Validate the consolidated branch before publishing it. The pull request remains open for human review and normal repository checks.

## Automation Workflow

Each scheduled run must:

1. Read the repository instructions and tech-debt review memory.
2. Inspect the working tree and stop rather than overwrite unrelated or uncommitted user work.
3. Search the repository for open pull requests whose branch or title follows the daily tech-debt convention.
4. If more than one matching pull request is open, stop and report the ambiguity.
5. If one matching pull request is open:
   - resolve its head branch;
   - confirm the branch belongs to this repository and is writable;
   - fetch the default branch and pull-request branch;
   - confirm the branch is conflict-free and contains no unrelated changes;
   - switch to that branch and add the new review work as a new commit.
6. If no matching pull request is open:
   - create a dated `chore/daily-tech-debt-review-YYYY-MM-DD` branch from the current default branch;
   - commit the review work;
   - push the branch;
   - open a pull request with the standard tech-debt title and description;
   - add the `codex` and `codex-automation` labels when those labels exist.
7. Run the required lint, typecheck, formatting, targeted tests, and broader validation before pushing.
8. Update the pull request body so it accurately lists all review runs currently included.
9. Report the pull request URL, commit, validation status, and any blocker.

## Safety Rules

- Never enable auto-merge and never merge the pull request.
- Never force-push.
- Never append to a pull request from a fork or an unrecognised branch.
- Never append when mergeability is dirty, blocked, or unknown.
- Never add changes when required validation fails.
- Never include unrelated working-tree changes.
- Never create a second tech-debt pull request when exactly one valid matching pull request is already open.
- If the existing pull request cannot be updated safely, leave it unchanged and report the exact blocker.

## Pull Request Identification

A pull request is a tech-debt candidate only when it is open against the repository default branch and either:

- its head branch starts with `chore/daily-tech-debt-review-`; or
- its title starts with `chore: daily tech debt review`.

The automation should prefer the branch convention because it is stable and machine-readable.

## Validation

For the consolidated backlog and every future run:

- selected-file lint passes;
- affected package typechecks pass;
- relevant focused tests pass;
- selected-file formatting passes;
- `git diff --check` passes;
- the branch is conflict-free with the fetched default branch;
- the final staged diff contains only tech-debt review work and review-memory updates.

## Failure Handling

Failures are fail-closed. The automation must not push partial work or create a duplicate pull request. It should preserve the current state where safe and report:

- the failed command or GitHub operation;
- affected files or branch;
- whether local changes remain;
- the action required from a human.
