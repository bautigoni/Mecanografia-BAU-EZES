# AGENTS.md

**Read [`CLAUDE.md`](CLAUDE.md). That is the whole rulebook.**

It is the single source of truth for this project: architecture, roles and auth,
the visual and responsive systems, island art and assets, curriculum, project
structure, deployment, branching, and the working rules every agent follows.
This file exists only so that agents which look for `AGENTS.md` by name (Codex,
Cursor, OpenCode, and friends) land in the same place Claude Code does.

There is no second rulebook. Three companion docs carry content of their own,
each with a distinct job:

- [`DEPLOY.md`](DEPLOY.md) — ops runbook.
- [`dbnew.md`](dbnew.md) — backend implementation log.
- [`Images/islands/BOTONES.md`](Images/islands/BOTONES.md) — how to draw and
  import a new island's level button.

If any doc ever disagrees with `CLAUDE.md`, **`CLAUDE.md` wins** — fix the other
one rather than working around it.

## The two-line version

**TYPELY** (internal codename *EduTic*) is a Spanish-first, gamified typing and
digital-literacy app for primary school kids: Vite 7 + React 19 + TypeScript +
Tailwind 4 on the front, Fastify + Drizzle + Postgres 16 behind, three Docker
containers behind Caddy. Internal ids stay `edutic_*` / `island1..15` for
backward compatibility; only user-facing strings say "TYPELY".

**One branch: `main`.** It is protected and auto-deploys, so it only changes
through a pull request from a short-lived branch, after `npm run build` passes.
See `CLAUDE.md` §17.
