# Ballot App 🗳️

A modern voting and feedback application built with OpenTelemetry observability, deployed on Cloudflare's edge infrastructure.

## Overview

Ballot App is a real-time voting platform that allows users to create polls with color-coded feedback (green/yellow/red) and optional comments. Perfect for gathering team feedback, conducting surveys, or making collaborative decisions.

### 🌟 Key Features

- **Color-Coded Voting System**: Green (positive), Yellow (neutral), Red (negative) voting options
- **Real-Time Comments**: Add optional detailed feedback with votes
- **Ballot Management**: Create, view, and track voting results
- **Responsive Design**: Clean, modern UI built with TailwindCSS and Radix UI
- **Full Observability**: OpenTelemetry instrumentation with Honeycomb integration
- **Edge Deployment**: Deployed on Cloudflare Workers/Pages for global performance

### 🔧 Tech Stack

**Frontend**
- React 19 with TypeScript
- TailwindCSS for styling
- Radix UI components
- Vite for build tooling
- Deployed on Cloudflare Pages

**Backend**
- Hono web framework
- TypeScript for type safety
- OpenTelemetry for observability
- Deployed on Cloudflare Workers

**Observability**
- OpenTelemetry SDK with custom spans
- Honeycomb for telemetry data collection
- Custom metrics for voting patterns and API performance

## Live Demo

- https://ballot.io

## Project Structure

```
.
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # UI components (BallotList, BallotDetail, etc.)
│   │   └── App.tsx         # Main application component
│   └── package.json
├── server/                 # Hono backend API
│   ├── src/
│   │   ├── index.ts        # API routes with telemetry
│   │   └── telemetry.ts    # OpenTelemetry configuration
│   └── package.json
├── shared/                 # Shared TypeScript types
│   └── src/types/
└── wrangler.toml          # Cloudflare deployment configuration
```

## API Endpoints

**Base URL:** `https://ballot-app-server.siener.workers.dev`

### Ballot Routes

- `GET /api/ballots` - Retrieve all ballots
- `GET /api/ballots/:id` - Get specific ballot details
- `POST /api/ballots` - Create a new ballot
- `PUT /api/ballots/:id` - Add vote to existing ballot

### Attendance Poll API

Use these endpoints to programmatically create and manage attendance polls.

#### 1. Create a poll

```
POST /api/attendance
Content-Type: application/json

{
  "title": "Tuesday Practice — March 11, Team A @ Fieldhouse",
  "date": "2025-03-11"
}
```

Returns the created attendance object (201):
```json
{
  "id": "attendance-1741...",
  "title": "Tuesday Practice — March 11, Team A @ Fieldhouse",
  "date": "2025-03-11",
  "responses": [],
  "createdAt": "2025-03-06T12:00:00.000Z",
  "updatedAt": "2025-03-06T12:00:00.000Z",
  "version": 1
}
```

The shareable poll URL is: `https://ballot.io/attendance/{id}`

**Tip:** Encode date, time, location, and team into the `title` string — it's free-form text up to 200 characters.

#### 2. Check responses

```
GET /api/attendance/{id}
```

Returns the attendance object with all responses:
```json
{
  "id": "attendance-1741...",
  "title": "Tuesday Practice — March 11, Team A @ Fieldhouse",
  "date": "2025-03-11",
  "responses": [
    { "name": "Alice", "attending": true, "timestamp": "2025-03-06T14:00:00Z" },
    { "name": "Bob", "attending": false, "timestamp": "2025-03-06T14:05:00Z" }
  ],
  "version": 3
}
```

To get counts, compute from the `responses` array:
- **yes:** `responses.filter(r => r.attending === true).length`
- **no:** `responses.filter(r => r.attending === false).length`

#### 3. List all polls

```
GET /api/attendance
```

Returns all attendance polls sorted by date (most recent first). Filter client-side for active/upcoming polls by comparing `date` to today.

#### 4. Submit a response

```
PUT /api/attendance/{id}
Content-Type: application/json

{
  "name": "Alice",
  "attending": true
}
```

If the same name responds again, their previous response is updated.

#### 5. Batch fetch polls

```
GET /api/attendance/batch?ids=id1,id2,id3
```

Returns multiple attendance polls in one request.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) for deployment
- Honeycomb account for observability (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/gsiener/ballot-app.git
cd ballot-app

# Install dependencies
bun install
```

### Development

```bash
# Run all services in development mode
bun run dev

# Or run individually
bun run dev:client  # Frontend dev server
bun run dev:server  # Backend API server
bun run dev:shared  # Watch shared types
```

### Building

```bash
# Build everything
bun run build

# Or build individually
bun run build:client
bun run build:server
bun run build:shared
```

## Deployment

### Environment Variables

Set your Honeycomb API key for observability:

```bash
# Set Honeycomb API key as Cloudflare secret
npx wrangler secret put HONEYCOMB_API_KEY
```

### Deploy to Cloudflare

```bash
# Deploy backend (Workers)
npx wrangler deploy

# Deploy frontend (Pages)
npx wrangler pages deploy client/dist --project-name ballot-app-client
```

## Observability

The application includes comprehensive OpenTelemetry instrumentation:

### Tracked Metrics
- API request/response times
- Ballot creation and voting patterns
- Error rates and debugging information
- Custom business events (ballot_created, vote_added, etc.)

### Honeycomb Integration
- Real-time performance monitoring
- Distributed tracing across API calls
- Custom dashboards for voting analytics
- Error tracking and alerting

## Usage

1. **Create a Ballot**: Enter a question to gather feedback on
2. **Share the Link**: Send the ballot URL to participants
3. **Vote**: Users select green (positive), yellow (neutral), or red (negative)
4. **Add Comments**: Optional detailed feedback with votes
5. **View Results**: Real-time vote counts and comment threads

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Learn More

- [Hono Documentation](https://hono.dev/docs)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Honeycomb Documentation](https://docs.honeycomb.io/)
