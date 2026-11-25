# Expo

This project is on Expo SDK 54 (the `expo` version in `package.json`). APIs change between SDKs, so read the versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing Expo code.

# Working rules

- **Ask before guessing.** When a request has more than one reasonable reading, or an approach carries a real tradeoff, state your assumption or give two options with a recommendation before writing code.
- **Follow the codebase.** Read the files you'll touch and how similar things are done nearby; reuse the existing helpers, libraries and patterns.
- **Surgical diffs.** Every changed line traces back to the request. Match the file's existing style, leave unrelated code and formatting as they are, and remove only what your own change made unused.
- **Simplest thing that works.** Build for today's requirement: one implementation, hardcoded values, error handling only for errors that can actually occur.
- **Bugs go red first.** Write a test that reproduces the bug and watch it fail before fixing it. Run the tests before and after a change, and report failures that were already there.
- **Dependencies need a reason.** Prefer what's already installed or the platform; say why when you add a package.
- **Plan multi-step work.** List the plan before executing anything longer than one step.
- **Stop when stuck or cascading.** If a fix spreads across many files, or the root cause stays unclear, report what you've seen and ask before continuing.
