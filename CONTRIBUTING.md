# Contributing to DMMS

Thank you for your interest in contributing! This document explains how to get involved, what we value, and how to submit changes.

---

## Ways to Contribute

- **Report a bug** — open an issue with steps to reproduce, expected vs actual behaviour, and your environment
- **Request a feature** — open a discussion or issue describing the problem you want solved
- **Fix a bug** — comment on the issue so we know you're working on it, then submit a PR
- **Implement a roadmap item** — check the [Roadmap section in the README](README.md#roadmap) for planned work
- **Improve documentation** — typos, clarity improvements, and missing examples all count

---

## Development Setup

Follow the [Getting Started guide in the README](README.md#getting-started). Once the app runs locally you're ready.

### Running the full stack

```bash
# Terminal 1: backend
source .env && go run ./cmd/dmms

# Terminal 2: frontend
npm run dev
```

### Useful commands

```bash
make build          # full production build
npm run build:mcp   # rebuild the MCP server only
go vet ./...        # Go linter
npx tsc --noEmit    # TypeScript type check
```

---

## Project Architecture

The codebase follows a layered architecture. When adding or changing behaviour, work in the right layer:

| Layer | Location | Responsibility |
|-------|----------|---------------|
| Models | `internal/models/` | Data structs and status constants — no logic |
| Repository | `internal/repository/` | All DB queries — no business rules |
| Service | `internal/service/` | Business logic (proposals, rewards, budgets) |
| Handlers | `internal/handlers/` | HTTP layer — parse request, call service, return response |
| Frontend API | `src/api/` | Typed wrappers around fetch calls |
| Pages | `src/pages/` | Route-level React components |
| Components | `src/components/` | Shared, reusable UI components |

**Key rule:** repositories call only the database. Services call repositories. Handlers call services. Don't skip layers.

---

## Coding Standards

### Go

- Follow standard Go style — run `go vet ./...` before committing
- Handle every error explicitly; never use `_` to discard errors silently
- Keep functions small and focused — extract helpers when a function exceeds ~50 lines
- Use GORM for all database access; write raw SQL only when GORM cannot express the query

### TypeScript / React

- All new code must be typed — avoid `any`
- Prefer functional components and hooks
- Keep components focused; extract sub-components when JSX exceeds ~150 lines
- Use immutable patterns — never mutate state directly

### General

- No hardcoded secrets, credentials, or environment-specific values in source
- Validate all user input at system boundaries (handlers on the backend, form submission on the frontend)
- Write clear, descriptive variable and function names — avoid abbreviations

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

<optional body explaining why, not what>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`

Examples:
```
feat: add email notification on proposal acceptance
fix: kanban counter now reflects total items, not only loaded page
docs: add Docker Compose self-hosting guide
```

---

## Pull Request Process

1. **Fork** the repository and create a branch from `main`
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** — keep the scope focused; one PR per concern

3. **Test manually** — run the full stack and verify your change works end-to-end

4. **Type-check** — `npx tsc --noEmit` must pass with no errors

5. **Open a PR** against `main` with:
   - A clear title (following the commit convention)
   - A description of what changed and why
   - Steps for the reviewer to test it

6. Address any review feedback — we aim to review PRs within a few days

---

## Reporting Security Issues

Please **do not** open a public issue for security vulnerabilities. Instead, email the maintainer directly (see the GitHub profile). We will acknowledge within 48 hours and coordinate a fix before any public disclosure.

---

## Questions?

Open a [GitHub Discussion](../../discussions) for general questions or ideas. Use issues only for confirmed bugs and feature requests.
