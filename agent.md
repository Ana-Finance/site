# Ana Finance — Development Instructions

## Project

Ana Finance is a SaaS project with three repositories:

- app: SaaS application
- site: marketing website
- platform: AI agents and their execution system

## General rules

1. Inspect the existing code before making changes.
2. Preserve the current architecture unless a change
   is explicitly justified.
3. Do not introduce new frameworks unnecessarily.
4. Do not modify unrelated files.
5. Never commit secrets or API keys.
6. Follow existing naming conventions.
7. Document significant technical decisions.

## Git workflow

- Never push directly to main.
- Create a dedicated branch for each task.
- Keep changes focused and reviewable.
- Run relevant tests before opening a PR.
- Open a Pull Request for review.
- Do not merge without user authorization.

## Collaboration

- Codex and Claude Code must use the same rules.
- GitHub is the source of truth.
- Read the latest repository documentation.
- Do not assume that another agent's work is complete.
- Check existing branches and Pull Requests.

## Completion

For every task, report:
- Changes made
- Files modified
- Tests executed
- Known limitations
- Next recommended action
