# 🚀 How the Velora Backend Works (The Simple Flow)

This document explains exactly what happens when you ask Velora a question about your data. No complex code—just the "journey" of your request.

---

## 🏗️ The Big Picture
The backend is like a **smart project manager** for your data. It doesn't just run a search; it thinks, plans, executes, and fixes itself if something goes wrong.

### The 4 Main Players:
1.  **The Brain (Mistral AI)**: Understands your English and turns it into a plan (and SQL).
2.  **The Memory (Supabase)**: Stores your chat history, your database logins, and your saved dashboards.
3.  **The Source (Your Database)**: Where your business data (Postgres or ClickHouse) actually lives.
4.  **The Manager (LangGraph)**: Ensures steps are followed in order and handles retries.

---

## 🗺️ The Flow Diagram (Simplified)

```text
[ USER QUESTION ]
       │
       ▼
[ MISTRAL PLANNER ]  ─────▶ Decides which tools are needed (e.g., Schema, SQL)
       │
       ▼
[ GRAPH BUILDER ]    ─────▶ Converts the static plan into a "LangGraph" workflow
       │
       ▼
[ GRAPH EXECUTION ]  ─────▶ Runs steps in sequence
       │
       ├─▶ Step 1: Schema Lookup  ───▶ [ Reads Table/Column Info ]
       │          │
       │          └─▶ OK? ───▶ Step 2: SQL Query
       │                │
       │                └─▶ Fail? ───▶ [ Retry same step ]
       │                      │
       │                      └─▶ Still Fail? ───▶ [ Replanner ] ───▶ (Back to Graph Builder)
       │
       ▼
[ FRAGMENTS COLLECTOR ] ───▶ Packages results (Summary + Table + Chart)
       │
       ▼
[ FRONTEND RESPONSE ]   ───▶ User sees the dashboard in real-time
```

---

## 🌊 The Flow: From Question to Answer

### 1. The Request Arrives
When you type a message and hit "Send," the backend receives:
*   Your message (e.g., *"Show me total revenue by month"*).
*   Your database connection ID.
*   Your previous chat history.

### 2. The Architect (Planning)
The Brain (AI) looks at your message and says: *"To answer this, I need to do 2 things:"*
1.  **Schema Lookup**: Look at the database to see which tables and columns exist (so I don't guess names).
2.  **SQL Query**: Write a search command (SQL) and run it on the database.

> [!NOTE]
> This "Plan" is just a simple list of steps in English/JSON. The backend then **instantly converts this plan into a LangGraph**, which is a specialized "flowchart" that can handle errors and retries.

### 3. The Builder (Execution & Self-Healing)
This is where the magic happens. The backend runs the steps in the graph:
*   **Step 1 (Schema)**: It gathers table names and column types.
*   **Step 2 (SQL)**: It writes the SQL query using those real column names and runs it.

**What if it fails? (Self-Healing)**
If the database is slow or the AI made a mistake in the SQL:
*   **Retry**: It tries the same thing again (up to 2 times) for tiny hiccups.
*   **Replan**: If it still fails, the Brain looks at the error, realizes what it did wrong, creates a **new corrected plan**, and tries again.
*   **Result**: You get your data, and you never even knew it had to "try again" behind the scenes!

### 4. The Delivery (Fragments)
The backend doesn't just send back raw data. It sends back **"Fragments"**—UI blocks like:
*   **Markdown Fragment**: A text summary (e.g., *"Your revenue peaked in June!"*).
*   **Table Fragment**: The raw data rows in a nice grid.
*   **Chart Fragment**: A Bar/Line chart if you asked for a trend.

The backend saves everything to Supabase so you can see it later, then sends the fragments to your screen.

---

## 📖 Real-World Example
**User Question:** *"Top 5 products by sales this week as a bar chart"*

1.  **AI Plans**:
    *   Step A: Look at product/sales tables.
    *   Step B: Write SQL to SUM sales by product.
    *   Step C: Build a Bar Chart.
2.  **Execution**:
    *   Backend sees tables `orders` and `products`.
    *   AI writes: `SELECT p.name, SUM(o.total) ... GROUP BY 1 ... LIMIT 5`.
    *   Backend runs it and gets the numbers.
    *   Agent wraps the data into a **Chart Fragment**.
3.  **Result on Screen**: You see a beautiful Bar Chart and a small text summary saying *"Product X is your best-seller this week!"*

---

## 🛠️ Key Technology Summary
*   **Express**: The web server that handles the "Send" button.
*   **Mistral LLM**: The AI that writes queries and summaries.
*   **LangGraph**: The system that allows the AI to "think" and "retry" in a workflow.
*   **Supabase**: The database that stores your account and chat logs.
