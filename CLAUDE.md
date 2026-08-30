# CLAUDE.md

Guidance for Claude Code working in this repository.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly before implementing. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If a solution could be a fraction of its current size, rewrite it smaller.

Ask: "Would a senior engineer call this overcomplicated?" If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions your changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → ensure tests pass before and after.

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## 5. Lazy = Efficient (Ponytail)

Best code is code never written. Climb the ladder, stop at first rung that holds:

1. Does this need to exist at all? Speculative need → skip, say so.
2. Already in this codebase? Reuse existing helper/util/pattern.
3. Stdlib does it? Use it.
4. Native platform feature covers it? (HTML input type, CSS, DB constraint over app code)
5. Already-installed dependency solves it? Use it, don't add new one.
6. Can it be one line? One line.
7. Only then: minimum code that works.

Rules:
- No unrequested abstractions (interface for one impl, factory for one product, config for value that never changes).
- No boilerplate/scaffolding "for later".
- Deletion over addition. Boring over clever.
- Fewest files, shortest diff — but only after understanding problem.
- Bug fix = root cause, not symptom. Fix once in shared function, not in every caller.
- Deliberate simplification with known ceiling → mark with `ponytail:` comment naming ceiling and upgrade path.

Never skip: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, anything explicitly requested.

Non-trivial logic (branch, loop, parser, money/security path) leaves one runnable check behind (assert-based demo or small test). Trivial one-liners need no test.
