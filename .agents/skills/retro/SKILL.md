---
name: retro
description: Run a post-session retrospective for LINKO to convert recurring agent mistakes or friction into ESLint rules, tests, or concise CODING_STANDARDS.md updates — and prune stale or bloated rules.
---

# LINKO Agent Environment Retro

Improve LINKO's engineering guardrails after a session or branch review that uncovered recurring mistakes or friction.

**Goal:** Improve the *environment* (`eslint.config.js`, tests, `CODING_STANDARDS.md`), not patch feature code.

## Step 1: Identify Recurring Friction

Inspect the recent session, `/code-review` findings, or `git log -n 10 --stat` and list each repeatable mistake or confusion point in one sentence. Skip one-off typos or task-specific details.

## Step 2: Route Every Lesson via the Three-Tier Filter

| Tier | Destination | Use When |
| :--- | :--- | :--- |
| **Tier 1 (Preferred)** | `eslint.config.js`, a unit/integration test, or a SQL constraint | The violation is **mechanical** (banned API, import boundary, schema invariant). Deterministic checks cost zero attention tokens and enforce standards across every contributor. |
| **Tier 2** | `CODING_STANDARDS.md` | The violation is a **judgment call, smell, or LINKO idiom** a linter cannot reliably catch. Add 1–3 concise bullets; keep prose tight. |
| **Tier 3 (Rare)** | `AGENTS.md` | **Push back against adding lines here.** Only touch `AGENTS.md` for repo navigation, commands, deployment facts, or core domain terminology — never coding standards. |

## Step 3: Prune & Sync

1. **Graduated rules:** If a prose rule in `CODING_STANDARDS.md` is now enforced by ESLint or a test, delete or compress it to a one-line note.
2. **Stale references:** Verify reference files, monolith lists, and commands still match the repo.
3. **Bloat check:** Keep `AGENTS.md` lean (`< 120` lines) and `CODING_STANDARDS.md` scannable (`< 400` lines; split deep domain guides into `docs/` with pointers if it outgrows that).
4. **Optional small-model kit sync:** If `local-notes/small-model-kit/` exists locally and a critical invariant changed, note whether its compressed rules need a 1-line update.

## Step 4: Propose & Apply

Present a short routing table (**Friction** → **Tier & target file** → **Exact addition or prune**). Apply edits and run `npm run check` once confirmed (or immediately if the user asked to apply).
