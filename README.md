# Frontend

Responsive React/Vite client boilerplate for native JWT-protected REST and SSE APIs. The landing page is intentionally product-neutral; replace it when the first domain feature arrives.

## Requirements and dependencies

- Node.js 20.19+ (Node 24 LTS recommended)
- React + React DOM: UI runtime
- Vite + TypeScript: development server, production build, and static types
- Tailwind CSS v4 + its Vite plugin: responsive, utility-first styling
- Application auth context: email/password registration, login, logout, and bearer tokens
- Vitest + Testing Library + jsdom: unit/component tests
- Playwright: desktop and mobile browser integration tests
- ESLint + typescript-eslint: static checks

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Only `VITE_API_URL` is required. Login and signup call the backend's native auth routes. The access token is kept in `sessionStorage`, so it survives a page refresh but is cleared when the browser tab closes; logout clears it immediately. Do not put `JWT_SECRET`, database credentials, or the OpenRouter key in a `VITE_*` variable—Vite variables are shipped to the browser.

## Theme

The UI uses the [Hackthem theme from tweakcn](https://tweakcn.com/r/themes/cmtymlb8t000804l09suz8xl1), installed with shadcn/ui. Its colors, square corners, spacing, and shadows are defined in `src/styles.css`; Geist Mono is bundled locally through Fontsource. Components use semantic Tailwind classes such as `bg-background`, `bg-primary`, and `text-foreground`.

Light mode is the default. Add the `dark` class to the root `<html>` element to use the included dark palette. The shadcn configuration is in `components.json`, with `@/` resolving to `src/` in Vite and TypeScript.

To reapply the theme:

```bash
npx shadcn@latest add https://tweakcn.com/r/themes/cmtymlb8t000804l09suz8xl1
```

## REST and SSE

`src/lib/api.ts` centralizes bearer-token REST requests and authenticated SSE parsing. The stream uses `fetch`, not native `EventSource`, because `EventSource` cannot set an `Authorization` header. Do not put access tokens in SSE query strings.

The protected developer panel demonstrates:

- a REST call to `/auth/me`;
- an SSE subscription to `/events/stream`;
- an SSE AI call to `/ai/chat/stream`.

Move server-state logic into feature-specific hooks as the application grows. Keep the API client small and transport-focused.

## Commands

```bash
npm run dev       # Vite development server
npm run build     # Type-check and production build
npm run lint      # ESLint
npm test -- --run # Vitest once
npm run test:e2e  # Playwright on desktop and mobile viewports
```

Playwright tests the public shell without third-party identity configuration. Authenticated browser tests should create disposable users in an isolated test database and must never commit browser storage containing production tokens.

## Structure

```text
frontend/
├── e2e/                    Playwright browser tests
├── src/
│   ├── components/         Reusable and feature-facing UI components
│   ├── auth/               Native JWT session context
│   ├── lib/                Transport and framework-neutral helpers
│   ├── test/               Shared Vitest setup
│   ├── App.tsx             Neutral responsive application shell
│   ├── main.tsx            Auth and React composition root
│   └── styles.css          Tailwind import and global tokens
├── eslint.config.js
├── playwright.config.ts
├── tsconfig*.json
└── vite.config.ts
```

For new features, prefer `src/features/<feature>/` containing its components, hooks, schemas, and tests. Keep broadly reusable primitives in `components/` and HTTP/SSE mechanics in `lib/`.
