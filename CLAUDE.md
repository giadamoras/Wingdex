# Wingdex

Read `docs/plan.md` before making significant changes. It is the source of truth for the project's product scope, architecture, and roadmap.

## Current scope

History is in `docs/history.md`. The roadmap in `docs/plan.md` has three lists: "Now", "Only if deployed" (deployment is postponed because of OpenSky's terms and hosting cost) and "Not doing". These are big topics, so we handle them one step at a time rather than all at once: work only on the item the user names, and do not start deployment, anything that needs it, or anything under "Not doing" unless explicitly asked.

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