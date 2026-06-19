# Contributing

Tragents is a pnpm monorepo. The web app lives in `apps/web`; shared packages
live under `packages/`.

## Local Setup

Use Node.js 22.13+; Node 24 is recommended.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173>.

## Before Opening a Pull Request

Run:

```bash
pnpm check
pnpm build
```

For UI changes, include a short note about the screen you tested and the
browser you used. For parser or orchestrator changes, include a small input
sample that shows the behavior.

## Project Notes

- Keep provider keys and local memory out of commits. `.codex/`, `.claude/`,
  `.agents/`, `.env*`, and build output should stay local.
- Prefer focused changes. Parser, storage, and pipeline behavior are easy to
  regress with broad refactors.
- Keep documentation concrete. Say what Tragents does today, not what it might
  eventually become.
