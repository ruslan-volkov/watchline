# Agent skills

Project skills for Claude Code. Every session in this repo (worktrees and cloud included) loads them from here.

## Origin

Copied from [mattpocock/skills](https://github.com/mattpocock/skills) at commit `6f7f7831a625f040a8e06a0e7954826b87ce775a` (2026-11-25), MIT licensed: see `LICENSE-mattpocock-skills`. Folders are copied as-is, including their `agents/` files, so they can be diffed against upstream.

| Skill | Upstream path | Changed here |
| --- | --- | --- |
| code-review | `skills/engineering/code-review` | no |
| codebase-design | `skills/engineering/codebase-design` | no (dependency of improve-codebase-architecture, tdd, setup-ts-deep-modules) |
| domain-modeling | `skills/engineering/domain-modeling` | no |
| grill-me | `skills/productivity/grill-me` | no |
| grill-with-docs | `skills/engineering/grill-with-docs` | no |
| grilling | `skills/productivity/grilling` | no |
| handoff | `skills/productivity/handoff` | no |
| implement | `skills/engineering/implement` | no |
| implement-spec | `skills/engineering/implement-spec` | no |
| improve-codebase-architecture | `skills/engineering/improve-codebase-architecture` | no |
| pr | `skills/engineering/pr` | no |
| prototype | `skills/engineering/prototype` | no |
| research | `skills/engineering/research` | no (dependency of wayfinder) |
| setup-matt-pocock-skills | `skills/engineering/setup-matt-pocock-skills` | no |
| setup-ts-deep-modules | `skills/in-progress/setup-ts-deep-modules` | no (upstream marks it in-progress) |
| tdd | `skills/engineering/tdd` | no |
| to-spec | `skills/engineering/to-spec` | no |
| to-tickets | `skills/engineering/to-tickets` | no |
| wayfinder | `skills/engineering/wayfinder` | no |
| writing-for-agents | `skills/productivity/writing-for-agents` | no |

When you change a copied skill, set "Changed here" to what changed and why.

## Our own

- **database-migrations**: writing, testing and shipping Supabase migrations in this repo.
- **mutation-testing**: reading a Stryker JSON report and acting on surviving mutants. Assumes `npm run test:mutation` and a `reports/` folder ignored by git; neither exists until Stryker is set up.

## Updating from upstream

Clone upstream, `diff -r` each folder against the copy here, take what you want, then update the commit SHA above.
