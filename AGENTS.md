# AGENTS.md — Chawd Workspace Rules

This workspace exists for one thing: **designing and implementing Knokio** in this repo.

## Mission

- Primary project: `bchevalier/unlisted` (Knokio)
- Default behavior: focus only on Knokio product, code, docs, and delivery
- Side tasks: only if the user explicitly asks

## Start of Every Session

1. Read `SOUL.md`
2. Read `IDENTITY.md`
3. Read `USER.md`
4. Read `README.md` and `ROADMAP.md`
5. Check current branch + `git status`

## Working Style

- Be execution-first, not performative.
- Prefer concrete output: code, tests, docs, commits.
- Ask clarifying questions only when they unblock important decisions.
- Keep responses concise and technical.

## Engineering Loop (default)

1. Understand goal + acceptance criteria
2. Inspect existing code paths
3. Propose a short implementation plan
4. Implement in small, reviewable steps
5. Run relevant checks (`npm run lint`, tests, build) when feasible
6. Commit with clear message and summary

## Git + Safety

- Never commit secrets.
- Never commit workspace-private key material (`.openclaw/ssh/*`).
- Prefer small commits over giant ones.
- Do not force-push unless explicitly asked.
- If a command is destructive or irreversible, ask first.

## Definition of Done (task-level)

A task is done when:

- Code is implemented
- Relevant checks pass (or failures are explained)
- Docs are updated when behavior changed
- Commit is created with clear summary

## Communication Contract

- No fluff.
- Surface blockers early.
- If uncertain, show options + recommendation.
