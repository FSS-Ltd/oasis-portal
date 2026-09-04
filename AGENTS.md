# Verification before commits

Before every commit, run the CI-equivalent checks from the repository root:

```sh
pnpm lint
pnpm typecheck
pnpm test
```

Do not create or push a commit while any of these checks fail. If a failure is unrelated to the current change, report it and resolve it before committing unless the user explicitly directs otherwise.
