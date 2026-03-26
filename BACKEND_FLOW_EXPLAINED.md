# Backend Architecture

## 1. System Overview

The backend is a single Express server that connects three external systems:

- **Supabase** — all app data (users, chats, connections, dashboards, settings)
- **ClickHouse** — the user's business data (read-only)
- **Mistral AI** — understands requests, writes SQL, generates summaries and charts

```
┌──────────┐       ┌──────────────────────┐
│ Frontend │──────▶│       Backend        │
└──────────┘       │                      │
                   │  Auth ──────▶ Google  │
                   │  Agent ─────▶ Mistral │
                   │  Queries ───▶ ClickH. │
                   │  Storage ───▶ Supabase│
                   └──────────────────────┘
```

---

## 2. Authentication

Uses Google OAuth with a signed session cookie.

**Example:** A new user visits the app.

1. User clicks "Sign in with Google"
2. Backend redirects to Google's login page
3. Google sends the user back with a login code
4. Backend exchanges the code for the user's profile
5. Backend creates or updates the user in Supabase
6. Backend sets a signed session cookie
7. All future requests use that cookie to identify the user

Every protected endpoint reads and verifies this cookie before proceeding.

---

## 3. Chat — The Core Flow

This is the most important part of the backend. When a user sends a message, the backend does far more than just call an AI.

**Example:** User sends _"top 5 airlines by passengers"_

```
User sends message
  → Verify session
  → Find saved database connection (or fall back to defaults)
  → Decrypt the stored password
  → Load last 10 messages for follow-up awareness
  → Hand off to the Agent
  → Save conversation + messages
  → Return ready-to-render UI pieces
```

---

## 4. The Agent — How Requests Are Processed

The agent replaced an older fixed-pipeline approach. Instead of hardcoded paths, it now **dynamically plans** what to do for each request.

### How it works

1. **Planning** — An LLM reads the user's message and decides which tools to use and in what order. It produces a step-by-step execution plan.

2. **Execution** — The plan is turned into a dependency graph. Steps run in order, and each step can use the output of a previous step. If a step fails, all steps that depend on it are skipped automatically.

3. **Assembly** — Results from each step are converted into typed UI fragments (text, tables, charts, dashboards, errors) and sent back to the frontend.

### Available tools

| Tool | What it does |
|---|---|
| Schema Lookup | Reads the database structure (tables and columns) so the AI knows what data exists |
| SQL Query | AI writes a SELECT query from the user's question, then runs it on ClickHouse |
| Chat Response | AI generates a conversational reply (no database involved) |
| Dashboard Builder | AI breaks the request into 3–4 analytical views, generates SQL + chart configs for each |

### Example plans for different requests

**"top 5 airlines by passengers"** → data question

```
Step 1: Schema Lookup → get table/column info
Step 2: SQL Query (needs Step 1) → write and run a SELECT query
```

**"hello, what can you do?"** → general conversation

```
Step 1: Chat Response → generate a helpful text reply
```

**"create a flight operations dashboard"** → dashboard request

```
Step 1: Schema Lookup → get table/column info
Step 2: Dashboard Builder (needs Step 1) → plan sub-charts, generate SQL for each, build chart configs
```

### Dependency handling

Steps declare dependencies. If Schema Lookup fails (e.g. database unreachable), the SQL Query step is skipped immediately rather than running with bad context. The user gets a clear error message instead of waiting 60 seconds for cascading timeouts.

### Safety rules

- Only read-only SELECT queries are allowed
- INSERT, UPDATE, DELETE, DROP, ALTER are all blocked
- A LIMIT of 100 rows is auto-appended if none is specified

---

## 5. What Happens After the Agent Finishes

**New conversation:**
- Backend creates a conversation record
- A background LLM call generates a short title (e.g. _"Top Airlines Analysis"_)

**Then for every request:**
- The user's message is saved
- The assistant's response is saved along with fragments and SQL
- The frontend receives the conversation ID and UI fragments to render

---

## 6. Connections

Users can save their own database connections (ClickHouse or Postgres).

**Example:** User adds a ClickHouse Cloud connection.

1. Backend validates the connection type
2. Password is encrypted before storage
3. Connection record is saved in Supabase
4. Password is **never** returned to the frontend

Users can also browse their connected database — list tables and columns — directly from the app.

If no saved connection exists during a chat request, the backend falls back to default database settings from environment variables.

---

## 7. Conversations

The backend stores all chat history so users can revisit past sessions.

- List all conversations for the current user
- Load all messages within a conversation (ownership is verified)
- Delete a conversation

---

## 8. Dashboards

Dashboards have two main flows:

### Saving

When the AI generates a dashboard during chat, the user can save it. The backend stores the dashboard name, description, fragments, and the underlying SQL queries.

### Refreshing

**Example:** User saved a dashboard last week and clicks "Refresh."

1. Backend loads the saved dashboard and its queries
2. Backend loads and decrypts the associated connection
3. Each saved query is re-executed against ClickHouse
4. For chart-friendly results, the AI regenerates chart configurations
5. Dashboard is updated with fresh data

The user doesn't re-ask anything — the saved queries are simply re-run.

---

## 9. Settings & Team

- **Settings** — stores user preferences like `query_run_mode` (whether to auto-run queries or ask first)
- **Team** — the owner can invite team members by email; invites are stored as pending until accepted

---

## 10. Data Stored

| What | Where | Purpose |
|---|---|---|
| Users | `velora_users` | Created after Google login |
| Preferences | `velora_settings` | User settings like query run mode |
| Team invites | `velora_team_invites` | Pending or accepted invitations |
| Connections | `velora_connections` | Saved database connections (passwords encrypted) |
| Conversations | `velora_conversations` | Chat threads with auto-generated titles |
| Messages | `velora_messages` | User and assistant messages with fragments and SQL |
| Dashboards | `velora_dashboards` | Saved dashboards with fragments and queries |

---

## 11. Behind the Scenes

- **Request tracing** — every request gets a unique `requestId` and `traceId` for structured logging
- **LLM logging** — every AI call logs the model used, token counts, and response time
- **Password encryption** — AES encryption for stored database passwords, decrypted only at query time
- **Session security** — signed cookies that detect tampering
- **Connection health checks** — schema lookup pings ClickHouse before querying to fail fast on unreachable databases
- **Redis** — configured but not actively used in the current flow

---

## 12. Key Behaviors

1. **Chat is not just text** — the same endpoint can reply conversationally, answer with data tables, or generate multi-chart dashboards, depending on what the user asks.

2. **Schema is fetched live** — before writing SQL, the backend reads the latest tables and columns so the AI always has an accurate picture of the database.

3. **Follow-ups work naturally** — the last 10 messages are passed as context, so the AI understands _"now show me just the top 3"_ after a previous query.

4. **Failures are isolated** — if the database is down, dependent steps are skipped immediately and the user gets a clear error in seconds, not after a long timeout chain.

5. **Dashboards stay fresh** — saved dashboards can be refreshed with one click, re-running the original queries against live data.

6. **Passwords never leave the backend** — encrypted at rest, decrypted only for query execution, and stripped from all API responses.

---

## 13. Route Map

| Area | Endpoints |
|---|---|
| **Auth** | `GET /auth/google/start`, `/google/callback`, `/me`, `/logout` |
| **Chat** | `POST /chat` |
| **Connections** | `POST /connections`, `GET /connections`, `DELETE /connections/:id`, `GET /:id/tables`, `GET /:id/tables/:table/columns` |
| **Conversations** | `GET /conversations`, `GET /:id/messages`, `DELETE /:id` |
| **Dashboards** | `POST /dashboards/save`, `GET /dashboards`, `GET /:id`, `POST /:id/refresh`, `DELETE /:id` |
| **Settings** | `GET /settings`, `PUT /settings`, `GET /settings/team`, `POST /settings/invite` |
| **Health** | `GET /health` |
