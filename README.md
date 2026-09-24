# Fathom clone

A frontend preview of a meeting workspace built with Next.js App Router, React, TypeScript, and Tailwind CSS.

## Run locally

- Install dependencies: npm install
- Start the app: npm run dev
- Open http://localhost:3000

The first screen is My Calls. The login and onboarding routes are UI previews; no account is created. Meeting content is local sample data in src/lib/sample-data.ts. Recording, AI answers, persistence, private sharing, and billing are not connected yet.

## Checks

- npm run typecheck
- npm run lint
- npm run build

On Windows, the Next CLI scripts use the installed SWC WASM compiler because this workspace's native SWC DLL cannot initialize. Other platforms run Next normally.

Development and production use separate build directories so a running dev server does not overwrite production route checks.
