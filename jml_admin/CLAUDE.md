# CLAUDE.md

## Project

Ant Design Pro — React enterprise boilerplate on Umi Max v4, antd v6, ProComponents v3.

## Commands

`npm start` (built-in WebAPI :5001 + no-mock frontend :8886 + station proxy cleanup), `npm run start:frontend` (frontend only :8886), `npm run dev` (no mock; does not launch WebAPI), `npm run build` (utoopack), `npm run lint` (Biome+tsc), `npm run test` (Jest), `npx antd lint ./src` (antd-specific checks).

Read [管理后台交接](./docs/管理后台交接20261022.md) and [后台权限管理](./docs/后台权限管理.md) for current business behavior. The actual backend is `jml_admin/webapi`, not an older sibling copy. Do not run initialization, deployment, or cleanup scripts merely to inspect the project.

Other: `npm run openapi` (regenerate `src/services/`), `npm run simple` (**irreversible** — commit first), `npm run biome` (auto-fix), `npm run tsc` (type-check only).

## Critical Rules

- **Never edit `src/services/ant-design-pro/`** — auto-generated, regenerate with `npm run openapi`
- **Biome only** — no ESLint, no Prettier. Both `npm run lint` and `npx antd lint ./src` must pass before commit
- **Always `npx antd info <Component>` before writing antd code** — don't guess APIs from memory
- **`npm run simple` is irreversible** — always commit/branch first
- **Conventional commits** required (commitlint enforced)
- **TypeScript strict** · **Node ≥ 20** · **`package-lock.json`** (not yarn/pnpm)
- **`.umi` dir is auto-generated** — delete `src/.umi` and restart if dev server acts up

## Architecture Essentials

**Config**: `config/config.ts` (defineConfig), `config/routes.ts` (declarative routes). Route `name` → `menu.xxx` i18n key; `access` field gates visibility.

**Convention files** (`src/`): `app.tsx` (runtime config + `getInitialState`), `access.ts` (permissions), `global.tsx` (side effects), `loading.tsx`, `typings.d.ts`.

**Auth**: `getInitialState()` → `GET /api/currentUser`; 401 → redirect login. Local Flask Session and trusted-platform OIDC coexist. `access.ts` uses current backend permissions and page switches, not a hardcoded admin string. Backend enforces permissions per request. Do not use template mock credentials or conflate admin accounts with `jml_staff` reporting identities.

**State**: `useModel('filename')` for global hooks (`src/models/`). `useModel('@@initialState')` for currentUser/settings. ProTable `request` prop for most data loading. `@tanstack/react-query` for complex server state.

**Styling priority**: Tailwind CSS v4 (layout) → antd-style v4 / `createStyles` (theme tokens) → CSS Modules → Less (legacy only).

**Request**: built-in `request` from `@umijs/max`, configured in `src/requestErrorConfig.ts`. Per-page `service.ts` for non-generated APIs.

**i18n**: 8 locales in `src/locales/`. `useIntl().formatMessage({ id, defaultMessage })`.

**Mock**: `mock/` (global) + `src/pages/**/_mock.ts` (co-located). Express-style handlers.

**Cloudflare Worker**: `cloudflare-worker/` — separate Hono app, own `package.json`, not an npm workspace.

## Page Co-location

Each page dir: `index.tsx`, optional `service.ts`, `_mock.ts`, `data.d.ts`, style files. Keep page-specific code with the page.
