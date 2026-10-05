# Airspace Explorer

Read `docs/plan.md` before making significant changes. It is the source of truth for the project's product scope, architecture, and roadmap.

## Current scope

Milestones 1–6 and steps 1–5 of Milestone 7 are complete; their history is in `docs/history.md`. Milestone 7 (live data and deployment) is in progress, with steps 6–7 left (world-wide mock data, deployment). It deals with big topics, so we handle it one step at a time rather than all at once: work only on the step the user names, and do not start the next step or anything in the post-MVP backlog unless explicitly asked. The open items and the backlog order are in `docs/plan.md`.

## Development principles

* Prefer simple, understandable solutions.
* Avoid premature abstraction and unnecessary dependencies.
* Keep implementations consistent with `docs/plan.md`.
* If the existing plan conflicts with the code, point out the conflict instead of silently changing direction.

## Working style

For substantial changes:

1. Inspect the existing code.
2. Briefly explain your proposed approach.
3. Wait for confirmation before making significant changes.
4. Add short comments to your code.

For small, obvious changes, implement them directly.

After implementation, run the relevant checks and report what was verified.