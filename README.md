# Housing Society Management Web App

A fast, clean, configurable Housing Society Management application.

## Tech Stack

- **Frontend:** React + Vite + TypeScript → Cloudflare Pages
- **Backend:** Google Apps Script (GAS) REST-style API
- **Database:** Google Sheets (1 Society Spreadsheet + 1 Auth Spreadsheet)
- **Files:** Google Drive

## Quick Start

```bash
# Backend tests (GAS + Schema)
node --test tests/backend/*.test.js tests/schema/schema.test.js

# Frontend (when ready)
cd frontend && npm ci && npm run dev
```

## Documentation

| Document | Purpose |
|---|---|
| `Doc/SRS.md` | Software Requirements Specification |
| `Doc/design.md` | Project design authority (UI/UX) |
| `Doc/DESIGN-General.md` | Universal design system spec |
| `Doc/structure.md` | Repository structure, conventions, commands |
| `Doc/Project_Status.md` | Phase tracking & current status |
| `Doc/changelog.md` | Change history |
| `Doc/AGENTS.md` | Agent coding rules |
| `Doc/TESTING.md` | Testing strategy |
| `Doc/architecture/` | Database, API, backend, frontend, deployment, security architecture |

## Current Status

**GAS-01 Core Infrastructure — COMPLETE** (134/134 tests pass)

See `Doc/Project_Status.md` for full phase tracking.

## License

Private — Housing Society internal use only.
