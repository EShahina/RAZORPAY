# Contributing to MerchantShield AI

Thanks for taking the time to contribute! Please follow these guidelines to keep
the project consistent and reviewable.

## Code of Conduct

Be respectful and constructive. Harassment, trolling, and personal attacks are not
tolerated.

## How to contribute

1. **Open an issue** first for substantial changes or bug reports — describe the
   problem and expected behaviour.
2. **Fork** the repository and create a feature branch from `main`:
   `git checkout -b feat/your-feature`
3. **Make your changes**, keeping them focused and well-tested.
4. **Verify your work** locally (see below).
5. **Commit** with a clear, conventional message (e.g. `fix: ...`, `feat: ...`).
6. Open a **pull request** targeting `main` and reference any related issue.

## Development setup

```bash
npm install                    # frontend deps (root)
cd server && npm install       # backend deps
cp .env.example .env           # configure environment
```

## Verification

Run these before submitting a pull request — they are the same checks the CI runs:

```bash
npm run lint                   # Oxlint across the repo
npm run typecheck              # TypeScript type-check
npm --prefix server run test   # backend test suite
npm run build                  # production frontend build
```

## Coding standards

- **TypeScript strict** — no `any` where avoidable; types live in `src/types/`.
- **No dead code** — avoid unused imports/variables (enforced by Oxlint).
- **Immutability** — prefer pure functions and derived state over mutations.
- **Security** — never commit secrets; add new environment variables to
  `server/.env.example`; validate all input with `zod`.
- **Formatting** — 2-space indentation, LF line endings (see `.editorconfig`).

## Branching model

- `main` — the deployable branch (auto-deployed to Render).
- Feature branches — `feat/*`, `fix/*`, `chore/*`.
