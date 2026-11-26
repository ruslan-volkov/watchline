# Expo

APIs change between Expo SDKs. Before writing Expo code, read the SDK major from the `expo` version in `package.json` and use the docs for that version: `https://docs.expo.dev/versions/v<major>.0.0/`.

# Working rules

- **Ask before guessing.** When a request has more than one reasonable reading, or an approach carries a real tradeoff, state your assumption or give two options with a recommendation before writing code.
- **Follow the codebase.** Read the files you'll touch and how similar things are done nearby; reuse the existing helpers, libraries and patterns.
- **Surgical diffs.** Every changed line traces back to the request. Match the file's existing style, leave unrelated code and formatting as they are, and remove only what your own change made unused.
- **Simplest thing that works.** Build for today's requirement: one implementation, hardcoded values, error handling only for errors that can actually occur.
- **Bugs go red first.** Write a test that reproduces the bug and watch it fail before fixing it.
- **Run only the test file you're changing** (`npx jest <path>`). The full suite, the typecheck and `test:db` run in CI.
- **A failing test names a rule.** Before changing a test, state the rule it checks. If the rule still holds, fix the code. If the rule changed, cite the ticket, spec or ADR that changed it, then update the test. If no rule can be named, say so and propose rewriting or deleting the test; don't delete it yourself.
- **Dependencies need a reason.** Prefer what's already installed or the platform; say why when you add a package.
- **Plan multi-step work.** List the plan before executing anything longer than one step.
- **Stop when stuck or cascading.** If a fix spreads across many files, or the root cause stays unclear, report what you've seen and ask before continuing.
- **Never skip the hooks.** Don't commit with `--no-verify`. The pre-commit hook formats, lints and typechecks; fix what it reports.
