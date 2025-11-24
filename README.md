# Public Welfare Service Assistant Frontend

React + TypeScript single-page application delivering the public welfare guidance experience. The UI focuses on a chatbot-first flow, life-event navigation, and accessibility tooling tailored for civic services.

## Getting Started

```bash
cp .env.example .env   # configure API endpoint
npm install
npm run dev
```

- Development server: `http://localhost:5180`
- Build for production: `npm run build`
- Static preview: `npm run preview`
- Lint & formatting checks: `npm run lint`
- Automated regression tests (Vitest + Testing Library + jest-axe): `npm run test`

## Environment Configuration

- Copy `.env.example` to `.env` and update `VITE_API_BASE_URL` to the reachable Spring Boot backend origin (for other PCs or deployed environments).
- Optional: set `VITE_ENABLE_OFFLINE_MOCK=true` to serve `/api/offices` data from local fixtures when the backend is offline.
- Default dev backend: `http://127.0.0.1:8081`.

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Chatbot widgets, navigation, accessibility primitives
│   ├── data/            # Static guidance fixtures
│   ├── layout/          # Shell, header/footer, accessibility context
│   ├── pages/           # Home and detail templates
│   ├── styles/          # Design tokens and global styles
│   ├── types/           # Domain models
│   └── utils/           # Search helpers, API client, navigation logic
├── tests/               # Vitest suites (chatbot flows, navigation, accessibility)
└── vite.config.ts       # Vite + Vitest configuration
```

## Core User Journeys

1. **Chatbot-Guided Complaint Preparation**

   - `HomePage` renders chatbot input and response components.
   - Queries are matched via search helpers and return online/offline steps plus a document checklist.

2. **Life-Event Navigation**

   - `CategoryGrid` displays cards for senior support, childcare, and disability programs.
   - `ServiceSummaryCard` links to `ServiceDetailPage`, mirroring chatbot guidance.

3. **Accessible Public Experience**
   - `AccessibilityControls` provide text-scale, high-contrast, and audio summary toggles.
   - Global styles standardize focus outlines and responsive typography.
   - `jest-axe` regression tests guard against accessibility regressions.

## Runbook & Preview Checklist

1. `npm install`
2. `npm run lint` to ensure no ESLint violations (jsx-a11y included)
3. `npm run test` for chatbot/navigation UX tests and axe audits
4. `npm run dev` for manual QA on:
   - Chatbot query returning online/offline steps and document checklist
   - Category card navigation and detail page parity
   - Text size & high-contrast toggles; keyboard traversal through header/nav/controls
   - Audio summary button (if browser speech synthesis is available)

## Notes

- Static guidance data is seeded in `src/data/serviceGuidance.ts` while the `/api/civil-petitions` endpoint is served by the Spring Boot backend.
- Audio summary uses the Web Speech API and fails silently in unsupported environments.
- Engine requirements: Node.js >= 18 (tested with Vite 5, React 18).
