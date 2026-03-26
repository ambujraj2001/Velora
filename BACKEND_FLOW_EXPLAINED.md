# Backend Flow Explained

This file explains how your backend works today in simple human words.

It covers:
- how the server starts
- how login works
- how chat works
- how database connections work
- how conversations are saved
- how dashboards are saved and refreshed
- how settings and team invites work
- what data is stored
- what supporting services are involved behind the scenes

---

## 1. Big Picture

Your app has **one backend server**.

That backend mainly talks to **three outside systems**:
- **Supabase** for storing app data like users, chats, connections, dashboards, settings, and invites
- **ClickHouse** for reading the business data the user wants to ask questions about
- **Mistral AI** for understanding the user request, writing SQL, creating summaries, and building dashboard/chart ideas

### Main backend idea

1. The frontend sends a request to the backend.
2. The backend checks who the user is.
3. The backend loads the user’s saved database connection.
4. The backend reads the database structure.
5. The backend decides what kind of request this is:
   - normal chat
   - data question
   - dashboard request
6. The backend gets the answer.
7. The backend saves the result.
8. The backend sends ready-to-show pieces back to the frontend.

---

## 2. Overall Backend Map

### Word diagram

```text
User in frontend
  ->
Backend server
  ->
Different backend flows
  ->
- Login flow -> Google
- Chat flow -> Mistral AI + ClickHouse + Supabase
- Connections flow -> ClickHouse + Supabase
- Conversation history flow -> Supabase
- Dashboard flow -> Mistral AI + ClickHouse + Supabase
- Settings and team flow -> Supabase
```

---

## 3. Server Entry Flow

When the backend starts:

- it creates an Express server
- it allows the frontend to call it
- it accepts JSON data
- it opens these main route groups:
  - `/auth`
  - `/chat`
  - `/connections`
  - `/conversations`
  - `/dashboards`
  - `/settings`
- it also exposes `/health` for a simple health check

### Startup flow

```text
Backend starts
  ->
Allow frontend requests
  ->
Accept JSON data
  ->
Open all route groups
  ->
Start listening on the server port
```

---

## 4. Authentication Flow

Your app uses **Google login**.

After login, your backend creates its own **session cookie** and uses that cookie on future requests.

### What happens during login

1. User clicks login.
2. Frontend sends user to `/auth/google/start`.
3. Backend redirects the user to Google.
4. Google sends the user back to `/auth/google/callback` with a login code.
5. Backend exchanges that code for the user profile.
6. Backend creates a stable internal user id from the Google user id.
7. Backend saves or updates the user in Supabase table `velora_users`.
8. Backend creates a signed session token.
9. Backend stores that token in a cookie called `velora_session`.
10. Backend redirects the user back to the frontend.

### Login diagram

```text
User
  ->
Frontend
  ->
Backend /auth/google/start
  ->
Google login page
  ->
Backend /auth/google/callback
  ->
Get Google profile
  ->
Save or update user in Supabase
  ->
Create session cookie
  ->
Send user back to frontend
```

### How future requests know the user

For protected routes, the backend:

- reads the session cookie
- verifies the cookie signature
- rebuilds the internal user id
- if valid, allows the request
- if not valid, returns `Unauthorized`

### Auth endpoints

- `GET /auth/google/start` -> starts Google login
- `GET /auth/google/callback` -> finishes Google login
- `GET /auth/me` -> returns the current logged-in user
- `GET /auth/logout` and `POST /auth/logout` -> clears the session cookie

---

## 5. Chat Flow

This is the most important backend flow in your app.

When the user sends a message, the backend does much more than just ask an AI model for text.

It:

- checks the user
- finds the right data connection
- loads the database structure
- loads recent conversation history
- sends everything through a multi-step decision flow
- saves the conversation and messages
- returns ready-made UI blocks to the frontend

### Full chat flow

```text
User sends message
  ->
POST /chat
  ->
Check logged in user
  ->
Find selected connection or latest saved connection
  ->
Decrypt saved database password
  ->
Read tables and columns from ClickHouse
  ->
Load recent conversation history
  ->
Run AI decision flow
  ->
Save conversation if needed
  ->
Save user message and assistant result
  ->
Send ready-made fragments back to frontend
```

### What the chat request receives

The chat route receives:

- the user message
- optional conversation id
- optional connection id

### Step-by-step details

#### Step 1. Clear previous logs

At the beginning of each chat request:

- the backend clears the current log file
- then writes fresh logs for this request

This helps you inspect one request at a time.

#### Step 2. Check the user

The backend only continues if the session cookie is valid.

If not, it stops with a 401 response.

#### Step 3. Find the data connection

The backend looks in `velora_connections`.

- If the request includes a connection id, it uses that one.
- If not, it uses the user’s newest saved connection.
- If none is found, it falls back to default environment-based database settings.

#### Step 4. Decrypt the saved password

Saved connection passwords are stored in encrypted form.

Before using them, the backend decrypts the password.

#### Step 5. Read the database structure

The backend asks ClickHouse:

- what tables exist
- what columns each table has

It turns that into a plain text description of the database structure.

This is later given to the AI so it knows what data exists.

#### Step 6. Load recent conversation history

If a conversation id is present, the backend loads up to the last 10 messages from `velora_messages`.

This helps the AI understand follow-up questions.

#### Step 7. Run the AI decision flow

This is handled by your graph flow.

The graph decides whether the message is:

- a normal chat request
- a data question
- a dashboard request

Then it follows the right path.

---

## 6. The AI Decision Flow Inside Chat

Your backend uses a step-by-step internal flow for chat requests.

### Main decision map

```text
Start
  ->
Understand user intent
  ->
Choose one path

If normal talk:
  -> create text answer
  -> return fragments

If data question:
  -> write SQL
  -> run SQL on ClickHouse
  -> if query fails, retry up to 2 times
  -> if query works, build response pieces
  -> return fragments

If dashboard request:
  -> plan dashboard sections
  -> create dashboard pieces
  -> return fragments
```

### 6.1 Intent step

The first AI step looks at:

- the new user message
- the recent chat history

It decides one label only:

- `CHAT`
- `DATA_QUERY`
- `DASHBOARD`

#### Meaning of each label

- `CHAT` means normal conversation, explanation, greeting, or general help
- `DATA_QUERY` means the user wants one data answer, usually one table or one result set
- `DASHBOARD` means the user wants a bigger view with multiple angles, charts, or sections

### 6.2 If it is normal chat

The backend asks Mistral for a clean helpful reply.

Then it wraps the answer as a markdown block and returns it.

This path does **not** query ClickHouse for data results.

### 6.3 If it is a data question

The backend asks Mistral to write a ClickHouse `SELECT` query using:

- the user message
- the recent history
- the database structure text

Safety rules are applied:

- only read-only queries are allowed
- write and delete actions are blocked
- if no result limit is present, a limit of 100 is added

Then the backend runs the query in ClickHouse.

#### If the query fails

- the backend records the error
- it retries up to 2 times
- after the final failure, it creates an error block for the frontend

#### If the query works

The backend creates three output pieces:

1. a short summary block
2. a table block with rows and columns
3. the SQL block

So the frontend receives already-structured content, not just plain text.

### 6.4 If it is a dashboard request

The backend asks Mistral to break the request into 3 or 4 smaller analysis tasks.

For each smaller task, it:

1. creates a SQL question
2. writes a SQL query
3. runs it in ClickHouse
4. decides whether the output should be a table or chart
5. if chart, asks Mistral to prepare chart settings

Then all those pieces are grouped into one dashboard block.

If no useful pieces are created, the backend returns an error.

---

## 7. What Happens After the Chat Result Is Ready

Once the AI flow finishes:

### If this is a new conversation

The backend creates a new row in `velora_conversations`:

- user id
- a temporary title from the first user message

After that, it separately asks Mistral to create a shorter better title and updates that conversation title in the background.

### Then messages are saved

The backend inserts two rows in `velora_messages`:

1. the user message
2. the assistant result

The assistant message stores:

- the generated UI fragments
- the SQL if there is one
- the connection id used

### Chat save diagram

```text
Graph result ready
  ->
Check if conversation already exists

If no:
  -> create conversation
  -> create better title in background

If yes:
  -> use existing conversation

Then:
  -> save user message
  -> save assistant message with fragments and SQL
  -> return response to frontend
```

### Final chat response sent to frontend

The backend returns:

- conversation id
- connection id
- fragments

The frontend can render those fragments directly.

---

## 8. Connection Flow

This part manages the user’s data source settings.

### What the backend supports today

The backend accepts these connection types:

- ClickHouse
- Postgres

But the current real data-reading flow is built around **ClickHouse queries**.

### Add connection flow

When a user adds a connection:

1. backend checks the user
2. backend checks if the connection type is allowed
3. backend encrypts the password
4. backend saves the connection in `velora_connections`
5. backend returns the saved record without the password

### Connection browsing flow

The backend can also:

- list all user connections
- delete a connection
- list tables from a selected connection
- list columns from a selected table

### Connection diagram

```text
Save connection flow:
User saves connection
  ->
Check logged in user
  ->
Validate connection type
  ->
Encrypt password
  ->
Save in Supabase

Browse connection flow:
User opens data context
  ->
Load saved connection
  ->
Decrypt password
  ->
Ask ClickHouse for tables
  ->
Ask ClickHouse for columns
```

### Connection endpoints

- `POST /connections` -> save a new connection
- `GET /connections` -> list the user’s saved connections
- `DELETE /connections/:id` -> delete one connection
- `GET /connections/:id/tables` -> list tables
- `GET /connections/:id/tables/:table/columns` -> list columns

---

## 9. Conversation History Flow

This is the part that supports the chat history page and reopening old chats.

### What it does

- lists all saved conversations for the logged-in user
- returns all messages inside one conversation
- deletes a conversation

### Safety check here

Before returning messages, the backend first checks that the requested conversation belongs to the current user.

### Conversation endpoints

- `GET /conversations` -> list all conversations
- `GET /conversations/:conversationId/messages` -> list all messages in one conversation
- `DELETE /conversations/:conversationId` -> delete one conversation

### Conversation flow

```text
User opens chat history
  ->
List conversations from Supabase

User opens one conversation
  ->
Check that it belongs to this user
  ->
Load all messages in time order
```

---

## 10. Dashboard Flow

Your backend has two dashboard paths:

1. creating and saving a dashboard
2. refreshing an existing dashboard

### 10.1 Save dashboard flow

When the frontend wants to save a dashboard, it sends:

- connection id
- dashboard name
- description
- fragments
- queries

The backend stores that in `velora_dashboards`.

### 10.2 Get dashboards flow

The backend can:

- list all dashboards for the current user
- return one dashboard by id
- delete a dashboard

### 10.3 Refresh dashboard flow

This is the smart part.

When refresh is requested:

1. backend checks the user
2. backend loads the saved dashboard
3. backend loads the saved connection
4. backend decrypts the database password
5. backend reruns each saved query in ClickHouse
6. for each result:
   - if the result fits a chart style, it creates a chart
   - otherwise it creates a table
7. backend updates the dashboard with fresh fragments
8. backend saves the refresh time

### Dashboard refresh diagram

```text
User clicks refresh dashboard
  ->
Load saved dashboard
  ->
Load saved connection
  ->
Decrypt password
  ->
Run saved queries again
  ->
Check the result shape

If chart friendly:
  -> create chart settings with AI

If not chart friendly:
  -> create table block

Then:
  -> build fresh dashboard fragments
  -> update dashboard in Supabase
```

### Dashboard endpoints

- `POST /dashboards/save` -> save dashboard
- `GET /dashboards` -> list dashboards
- `GET /dashboards/:id` -> get one dashboard
- `POST /dashboards/:id/refresh` -> refresh dashboard data
- `DELETE /dashboards/:id` -> delete dashboard

---

## 11. Settings and Team Flow

This part stores a small amount of user preference data and team invites.

### Settings flow

The backend reads and writes the user setting `query_run_mode`.

If no setting exists yet, it returns a default value:

- `ask_every_time`

### Team flow

When the user opens the team area:

- the backend loads the current user from `velora_users`
- the backend loads invite rows from `velora_team_invites`
- it combines them into one member list

When invites are sent:

- the backend receives a list of emails
- it stores them as pending invite rows

### Settings endpoints

- `GET /settings` -> get settings
- `PUT /settings` -> update settings
- `GET /settings/team` -> get owner and invited members
- `POST /settings/invite` -> save invite emails

---

## 12. Data Stored By The Backend

Here are the main Supabase tables your backend uses today.

### User-related

- `velora_users` -> app users created after Google login
- `velora_settings` -> user preferences
- `velora_team_invites` -> pending or accepted invites

### Connection-related

- `velora_connections` -> saved database connections with encrypted passwords

### Chat-related

- `velora_conversations` -> top-level chat threads
- `velora_messages` -> user and assistant messages inside each thread

### Dashboard-related

- `velora_dashboards` -> saved dashboards, fragments, and saved queries

### Storage map

```text
Supabase
  ->
- velora_users
- velora_settings
- velora_team_invites
- velora_connections
- velora_conversations
- velora_messages
- velora_dashboards
```

---

## 13. Support Pieces Behind The Scenes

These parts support the backend even if the user never sees them directly.

### Logging

For chat requests, logs are written to a local file in `logs/app.json`.

This makes it easier to inspect one request at a time.

### Password protection

Saved database passwords are encrypted before storing and decrypted only when needed.

### Session protection

The login cookie is signed, so the backend can detect tampering.

### Database structure reader

Before answering data questions, the backend reads tables and columns from ClickHouse so the AI knows what it can talk about.

### Health check

`/health` returns a simple OK response.

---

## 14. Real User Journey Example

This is the full flow for one normal data question.

```text
User
  ->
Frontend
  ->
Backend POST /chat
  ->
Check session cookie
  ->
Load saved connection from Supabase
  ->
Read tables and columns from ClickHouse
  ->
Load recent messages from Supabase
  ->
Ask AI what kind of request this is
  ->
Ask AI to write SQL
  ->
Run SQL in ClickHouse
  ->
Ask AI for a short summary
  ->
Save conversation and messages in Supabase
  ->
Return fragments to frontend
  ->
Show summary, table, and SQL to user
```

---

## 15. Important Behavior To Know

These are important truths about how your backend currently behaves.

### 1. Chat is not just text chat

It is a full decision system that can:

- reply normally
- answer with data
- generate dashboards

### 2. The database structure is read on each chat request

Before the AI writes SQL, the backend reads the latest tables and columns from the connected database.

### 3. Recent history is used for follow-up questions

The AI sees recent messages when deciding intent and writing SQL.

### 4. Only read-only SQL is intended

The backend blocks unsafe query types and only allows select-style reading.

### 5. Dashboard refresh does not ask the user again

It uses the already saved queries and reruns them.

### 6. Saved connection passwords are not returned to the frontend

They are encrypted in storage and removed from normal API responses.

### 7. There is a fallback database path

If no saved user connection is found during chat, the backend can fall back to default database settings from environment values.

### 8. Redis is configured but not actively used in the current flow

A Redis client exists in the backend setup, but the main routes and chat flow do not currently use it.

---

## 16. Backend Flow In One Short Summary

Your backend works like this:

- Google login creates a session cookie
- every important route checks that cookie
- user data and app records are stored in Supabase
- real business data is read from ClickHouse
- Mistral AI decides whether a message is normal chat, data analysis, or a dashboard request
- the backend turns the result into ready-made UI blocks
- conversations, messages, and dashboards are saved for later use

---

## 17. Route List At A Glance

### Auth

- `GET /auth/google/start`
- `GET /auth/google/callback`
- `GET /auth/me`
- `GET /auth/logout`
- `POST /auth/logout`

### Chat

- `POST /chat`

### Connections

- `POST /connections`
- `GET /connections`
- `DELETE /connections/:id`
- `GET /connections/:id/tables`
- `GET /connections/:id/tables/:table/columns`

### Conversations

- `GET /conversations`
- `DELETE /conversations/:conversationId`
- `GET /conversations/:conversationId/messages`

### Dashboards

- `POST /dashboards/save`
- `GET /dashboards`
- `GET /dashboards/:id`
- `POST /dashboards/:id/refresh`
- `DELETE /dashboards/:id`

### Settings

- `GET /settings`
- `PUT /settings`
- `GET /settings/team`
- `POST /settings/invite`

### Utility

- `GET /health`

---

## 18. Plain-English Final View

If we say it in the simplest way:

- your backend first figures out **who the user is**
- then it figures out **which data source to use**
- then it figures out **what the user is really asking for**
- then it gets the answer from **AI**, **database**, or both
- then it saves the work in **Supabase**
- then it sends back clean ready-to-show blocks for the frontend

That is the full backend flow running in your app today.
