---
name: coding-preferences
description: Jasper's coding conventions for this project (naming, function design, conditionals, dispatch tables, iteration, immutability, TypeScript, logging, comments). Load before writing or reviewing any code in api/, shared/, src/, or scripts/.
---

# Coding preferences

Source: Jasper's "Coding Preferences" note. Apply these when writing or reviewing code.
Anything a linter can catch is enforced in `eslint.config.ts`. Run `bun run lint` and
fix what it reports, rather than suppressing it. The rules below marked **(judgement)**
cannot be linted, so apply them deliberately.

## Core principles (judgement)

- Prefer explicit over clever. If a reader has to pause to parse something, split it.
- Code should describe itself. Prefer better names over comments.
- Comments explain *why*, not *what*. Before commenting a block, ask whether a better
  name would remove the need.
- Make bad states impossible by structure rather than checking for them at runtime
  (discriminated unions, zod schemas at boundaries, separate routers for public and
  private routes).
- Default to immutable patterns. Mutate only for a meaningful performance reason.

## Naming (lint: `@typescript-eslint/naming-convention`, `unicorn/filename-case`)

| Thing | Convention | Example |
|---|---|---|
| Variables & functions | `camelCase` | `fetchUserById`, `isActive` |
| Classes | `PascalCase` | `UserSession` |
| Module-level constants | `UPPER_SNAKE_CASE` | `MILLISECONDS_PER_DAY` |
| Types & interfaces | `PascalCase` | `UserConfig` |
| Files | `kebab-case` | `user-session.ts`, `batch-settings-view.vue` |

Constants that encode a calculation show the calculation:
`const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24`.

Exceptions:
- zod schemas are `PascalCase`, because they double as types (`const FigureConfig = z.object(…)`).
- SQL column names stay `snake_case` in queries and row types. Map them to camelCase at the service boundary.

## Function design (judgement, plus lint: `max-params`)

- **One function, one job.** If a block needs a comment, it has earned its own named
  function. Extract until the name is the comment.
- **Arguments.** Up to 3–4 positional arguments. Beyond that, use an options object
  (`max-params: 4` is enforced).
- **Thin handlers, fat services.** A Hono route handler only extracts context, calls a
  service, and returns the result. Validation belongs to `zValidator`, and business logic
  to `api/services/`.

## Conditionals (judgement, plus lint: `curly: multi-line`, `no-nested-ternary`)

- Guard clauses and early returns for edge cases and invalid states.
- Keep `if/else` for branches that are conceptually balanced.
- Use braces unless the whole statement fits on one short line: `if (!user) return 0` is
  fine, but a body on the next line needs braces.

## Dispatch tables (judgement, plus lint: `no-restricted-syntax` bans `switch`)

When branching on a key to call different functions, use a plain object map, not
`if/else` chains or `switch`. Adding a case becomes a data change.

```ts
const PARSERS: Record<string, (args: string[]) => Result> = {
  js: jsParser,
  md: mdParser,
}
const parser = PARSERS[options.parser]
if (!parser) throw new Error(`Unknown parser: "${options.parser}"`)
```

Large or growing tables get their own module.

## Loops and iteration (lint: `no-restricted-syntax` bans C-style `for`, `no-constant-condition`)

- Use `for...of`, iterators, and array methods. No `for (let i = 0; …)`.
- Put termination conditions in the `while` header, not in a mid-loop `break`.
- Pass named callbacks point-free: `items.map(transform)`, not `items.map(x => transform(x))`.
  Use an arrow only to adapt the signature.

## Expressions and operators (lint: `no-plusplus`, `eqeqeq`, `prefer-template`, `prefer-optional-chain`, `prefer-nullish-coalescing`)

- `+= 1` / `-= 1`, never `++` / `--`.
- `===` / `!==` always.
- Template literals over concatenation.
- `?.` and `??` for nullable values. Remember that `??` only falls back on
  `null`/`undefined`, not `0`, `''`, or `false`.

## Objects and architecture (judgement)

- Factories over classes. Use classes only for a genuine, shallow "is-a" hierarchy.
- **Inject dependencies through factory arguments** rather than importing them at module
  scope, e.g. `createEntryService(db)`. In this project, bindings come from `c.env` and
  are passed into service factories. Services never reach for globals.
- Keep config and constants apart from logic. Thresholds, limits, lookup tables, and
  dispatch maps get their own declarations, and shared ones live in `shared/`.

## Immutability (lint: `prefer-const`, `no-var`)

Use `const`, spreads, and non-mutating array methods (`toSorted`, `toSpliced`, `with`).
Pure functions are the goal.

## Exports and modules (lint: `no-restricted-exports` bans default exports outside allowed files)

Named exports by default. Default exports only where a framework requires them: Vue
SFCs, the Worker entry `api/index.ts`, and config files (`*.config.ts`). Barrel
`index.ts` files are fine where they help.

## Logging (lint: `no-console`)

Never call `console.*` directly. Use the logger in `api/logger.ts` (Worker) or
`src/lib/logger.ts` (SPA). They are thin facades today, so the backend can be swapped
without a find-and-replace. **Choosing a real logging library is a deliberate decision:
ask Jasper before adding one.**

## Comments and docs (judgement)

- Explain *why*, not *what*.
- This is application code, so there is no JSDoc on internal functions. JSDoc is only
  for code published as a library.

## TypeScript (lint: `no-explicit-any`, `consistent-type-assertions`, `no-restricted-syntax` bans `const enum`)

- No `any`. Use `unknown` and narrow it explicitly.
- `interface` for extendable object shapes. `type` for unions, intersections, mapped
  types, and aliases. Be consistent within a file.
- Let inference work. Annotate only where it clarifies or narrows (`const status: 'a' | 'b' = …`),
  never `const count: number = 42`.
- Plain `enum`, never `const enum`. In practice, prefer string-literal unions or `as const`
  objects.
- **`satisfies` over `as`.** Object-literal `as` assertions are banned by lint. Treat any
  other `as` as a smell that needs a reason, e.g. poorly typed third-party code.

## Style (lint: `@stylistic`)

No semicolons, single quotes, 2-space indent, and trailing commas on multiline
literals. `bun run lint:fix` handles formatting.
