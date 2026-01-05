# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ballot App is a real-time voting platform built as a monorepo with Bun, deployed on Cloudflare's edge infrastructure. The application uses a color-coded voting system (green/yellow/red) with optional comments, featuring comprehensive OpenTelemetry observability.

**Live URLs:**
- Frontend: https://d9cc5b2a.ballot-app-client.pages.dev
- API: https://ballot-app-server.siener.workers.dev

## Development Commands

### Running the Application
```bash
# Run all services concurrently (recommended for development)
bun run dev

# Run individual services
bun run dev:client   # React frontend on Vite dev server
bun run dev:server   # Hono API with hot reload
bun run dev:shared   # Watch mode for shared types
```

### Building
```bash
# Build all packages (required order: shared → server → client)
bun run build

# Build individually
bun run build:shared   # MUST build first - provides types to other packages
bun run build:server   # Build after shared types are available
bun run build:client   # Build after server types are available
```

### Testing
```bash
# Run all working tests (66 tests)
bun run test

# Run specific test suites
bun run test:server       # Server API tests (50 tests)
bun run test:client       # Client utility tests (16 tests)
bun run test:components   # Component tests (requires jsdom setup)
bun run test:all          # All tests including components
```

### Deployment
```bash
# Deploy backend to Cloudflare Workers
npx wrangler deploy

# Deploy frontend to Cloudflare Pages (ballot.io domain)
# IMPORTANT: Use "ballot-app" project, NOT "ballot-app-client"
# The ballot.io domain is attached to the "ballot-app" project
npx wrangler pages deploy client/dist --project-name ballot-app

# Set environment secrets
npx wrangler secret put HONEYCOMB_API_KEY
npx wrangler secret put ADMIN_API_KEY
```

## Architecture

### Monorepo Structure
This is a **Bun workspace** monorepo with three packages:

1. **`shared/`** - Shared TypeScript types used by both client and server
   - Must be built FIRST before other packages
   - Exports common types like `ApiResponse`
   - Changes here require rebuilding server and client

2. **`server/`** - Hono-based REST API on Cloudflare Workers
   - Uses OpenTelemetry for comprehensive observability
   - Data persistence via Cloudflare KV:
     - "ballots" key stores JSON array of all ballots
     - "dashboards" key stores JSON array of all dashboards
   - Admin routes protected by API key authentication
   - Demo data auto-initializes on first run if KV is empty

3. **`client/`** - React 19 frontend on Cloudflare Pages
   - Built with Vite, styled with TailwindCSS
   - Uses Radix UI for accessible components
   - React Router for client-side routing

### Key Architectural Decisions

**Data Persistence (ADR-006):**
- All ballot data stored as single JSON array in Cloudflare KV under "ballots" key
- All dashboard data stored as single JSON array in Cloudflare KV under "dashboards" key
- Eventual consistency model - be aware of potential race conditions
- Demo data automatically initialized for ballots if KV is empty
- Dashboards start empty on first run
- No complex querying - all operations load full arrays

**OpenTelemetry Integration (ADR-003):**
- `server/src/telemetry.ts` exports: `initTelemetry()`, `createSpan()`, `addSpanAttributes()`, `recordSpanEvent()`, `setSpanStatus()`
- Telemetry initialized per-request via middleware
- All API operations instrumented with custom spans
- Honeycomb backend for telemetry collection (optional, gracefully degrades)
- Admin operations include audit trail in span attributes

**Cloudflare Edge Deployment (ADR-002):**
- Backend runs on Workers runtime (10ms CPU limit, V8 isolates)
- Frontend on Pages with automatic CDN distribution
- KV namespace binding: `BALLOTS_KV` (defined in wrangler.toml)
- Environment variables: `HONEYCOMB_API_KEY`, `HONEYCOMB_DATASET`, `ADMIN_API_KEY`, `NODE_ENV`

### API Architecture

All routes defined in `server/src/index.ts`:

**Ballot Routes (Public):**
- `GET /api/ballots` - Returns all ballots with vote counts
- `GET /api/ballots/:id` - Returns specific ballot details
- `POST /api/ballots` - Creates new ballot (requires `question` field)
- `PUT /api/ballots/:id` - Adds vote to ballot (requires `color` and optional `comment`)

**Dashboard Routes (Public):**
- `GET /api/dashboards` - Returns all dashboards
- `GET /api/dashboards/:id` - Returns specific dashboard details
- `POST /api/dashboards` - Creates new dashboard (requires `name` field)
- `PUT /api/dashboards/:id` - Updates dashboard (accepts `name` and/or `ballotIds`)
- `DELETE /api/dashboards/:id` - Deletes dashboard

**Admin Routes (require `Authorization: Bearer <ADMIN_API_KEY>`):**
- `GET /api/admin/ballots` - Returns ballots with admin metadata (total votes, comments)
- `DELETE /api/admin/ballots/:id` - Deletes ballot with audit logging

Each API operation creates an OpenTelemetry span with business event attributes. Check `server/src/index.ts` for span naming conventions and attribute structure.

### Build Dependencies

The build order matters due to TypeScript type dependencies:

```
shared (provides types)
  ↓
server (imports shared types)
  ↓
client (imports shared types AND references server types)
```

The `postinstall` script automatically builds shared and server packages to ensure types are available.

## Testing Strategy

**Current Status: 66/66 tests passing**

Tests use Bun's built-in test runner with custom mocks for:
- Cloudflare KV storage
- Fetch API
- OpenTelemetry functions
- DOM APIs (for component tests)

**Server Tests (`server/src/index.test.ts`, `server/tests/integration.test.ts`):**
- All CRUD operations for ballots and dashboards with validation
- Admin authentication/authorization flows
- KV storage operations and error handling
- Complete integration scenarios (auth → list → delete)
- OpenTelemetry span attribute validation
- Dashboard data structure and operations

**Client Tests (`client/src/utils/ballot.test.ts`):**
- Vote counting and aggregation algorithms
- URL generation for ballots and admin panel
- Form validation logic
- Date formatting utilities

**Component Tests (written but require jsdom setup):**
- Located in `client/src/components/*.test.tsx`
- Run with: `bun run test:components`
- 73 tests covering BallotList, BallotDetail, AdminPanel

See `TEST_COVERAGE.md` for comprehensive test documentation.

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/deploy.yml`):

1. **Test Job** (runs on all PRs and pushes):
   - Installs dependencies with Bun
   - Builds shared → server
   - Runs full test suite (`bun run test`)

2. **Deploy Job** (only on main branch):
   - Builds all packages
   - Deploys server to Cloudflare Workers with secrets
   - Deploys client to Cloudflare Pages
   - Comments deployment URLs on PRs

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN` - Token with Workers:Edit and Zone:Read permissions
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `HONEYCOMB_API_KEY` - Optional, for observability
- `ADMIN_API_KEY` - For admin panel authentication

See `.github/DEPLOYMENT_SETUP.md` for detailed setup instructions.

## Common Development Patterns

### Adding a New API Endpoint

1. Define route in `server/src/index.ts`
2. Create span with `createSpan('operation_name')`
3. Add business event attributes with `recordSpanEvent()`
4. Set span status with `setSpanStatus(span, success, message)`
5. Handle KV operations with `getAllBallots()` and `saveBallots()`
6. Write tests in `server/src/index.test.ts`
7. Add integration test in `server/tests/integration.test.ts` if multi-step

### Working with Shared Types

1. Add/modify types in `shared/src/types/index.ts`
2. Run `bun run build:shared` to compile
3. Rebuild server and client to pick up new types
4. Both packages auto-import from `shared/dist`

### Telemetry Best Practices

- Initialize once per request (handled by middleware)
- Create spans for all operations: `createSpan('operation_name', attributes)`
- Add business context: `addSpanAttributes({ ballot_id, vote_color })`
- Record events: `recordSpanEvent('ballot_created', { question })`
- Always set status: `setSpanStatus(span, true/false, errorMessage)`
- End spans: `span.end()`

### KV Storage Patterns

**Ballots:**
- Load all ballots: `const ballots = await getAllBallots(c.env.BALLOTS_KV)`
- Find ballot: `ballots.find(b => b.id === id)`
- Modify array: push/splice/filter
- Save back: `await saveBallots(c.env.BALLOTS_KV, ballots)`

**Dashboards:**
- Load all dashboards: `const dashboards = await getAllDashboards(c.env.BALLOTS_KV)`
- Find dashboard: `dashboards.find(d => d.id === id)`
- Modify array: push/splice/filter
- Save back: `await saveDashboards(c.env.BALLOTS_KV, dashboards)`

**General:**
- Handle eventual consistency - consider optimistic locking for high-concurrency scenarios
- Both ballots and dashboards use the same KV namespace (BALLOTS_KV) with different keys

## Important Notes

- **Build order matters**: Always build `shared` before `server` and `client`
- **KV eventual consistency**: Race conditions possible with concurrent writes
- **Workers CPU limits**: Keep operations under 10ms for Cloudflare Workers
- **Telemetry graceful degradation**: App works without `HONEYCOMB_API_KEY`
- **Demo data**: KV auto-initializes with sample ballots on first access (dashboards start empty)
- **Dashboard persistence**: Dashboards now stored in KV (not localStorage) for cross-device sync
- **Admin auth**: Set `ADMIN_API_KEY` secret via wrangler for admin routes
- **Component tests**: Require jsdom environment configuration to run

## Documentation References

- `README.md` - Project overview, setup instructions, feature list
- `ARCHITECTURE_DECISIONS.md` - ADRs explaining key architectural choices
- `TEST_COVERAGE.md` - Detailed test suite documentation
- `.github/DEPLOYMENT_SETUP.md` - GitHub Actions and Cloudflare setup
- `CLOUDFLARE_TOKEN_SETUP.md` - Cloudflare API token configuration
