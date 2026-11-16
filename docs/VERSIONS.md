# Selected versions

Per the brief, the project is not pinned to a predetermined framework major.
These were the latest stable versions at implementation time (**2026-11-16**)
and are what the lockfile holds.

| Package | Version | Note |
|---|---|---|
| next | 16.4.6 | App Router; `cacheComponents` and `partialPrefetching` on by default from the scaffold |
| react / react-dom | 19.3.0 | |
| typescript | ^5 | |
| tailwindcss | 4.3.3 | CSS-first config; tokens in `src/app/globals.css` under `@theme` |
| eslint | ^9.39 | flat config |
| eslint-config-next | 16.4.6 | exports flat config arrays — imported directly, **not** through `FlatCompat` |
| vitest | ^5.1 | requires `@types/node` ≥ 22, hence `@types/node@^24` rather than the scaffold's `^20` |
| zod | ^4.6 | |
| clsx / tailwind-merge | ^2.1 / ^3.4 | behind `cn()` |

## Pinned by necessity

- **`@typescript-eslint/*` → 8.72.2.** Version 8.73.0 is tagged `latest` on npm
  and resolves, but its tarball returns 404, so any install that reaches it
  fails. Pinned through `overrides`. Revisit once 8.73.x publishes a working
  tarball.
- **`minimatch` → ^11.0.1, scoped to `@typescript-eslint/typescript-estree`.**
  That package's own range pulls a version with a moderate DoS advisory
  (GHSA-g3hv-75wg-m249), and the upstream fix is the uninstallable 8.73.0. The
  override must stay scoped: applied globally it breaks `@eslint/eslintrc`,
  which imports minimatch's v3 CommonJS default export. `npm audit` reports 0
  vulnerabilities with this arrangement.

## Deliberate deviations from the scaffold

- ESLint was added manually (`create-next-app --eslint` fails on the tarball
  issue above) and configured with flat config plus the service-role import
  fence (`docs/PLAN.md` §4).
- `src/app/layout.tsx` types its own props instead of using Next's generated
  `LayoutProps` global, so `tsc --noEmit` does not depend on route types having
  been generated first — which keeps CI step ordering simple.
- `vitest.config.mts` uses the `.mts` extension so Vite loads it as ESM without
  a config-loader warning.
