# Reminder Bot - Task Deadline Tracker

A fully automated system that monitors **multiple Google Spreadsheets** and sends professional HTML email reminders to team members with overdue or due-today tasks. Built for scale — handles millions of rows with batched processing, an async email queue, exponential backoff, and smart deduplication.

---

## Features

| Feature | Details |
|---|---|
| **Multi-Spreadsheet Support** | Monitor multiple Google Spreadsheets and multiple sheets per spreadsheet from a single bot instance |
| **Batched Sheet Reading** | Reads sheets in configurable pages (default 5,000 rows) via async generators — handles millions of rows without memory pressure |
| **Industry-Standard HTML Emails** | Table-based layout, inline CSS, Outlook/Gmail/Yahoo compatible, dark mode support, mobile responsive |
| **Email Queue** | Async in-memory queue with configurable concurrency (default 5 parallel sends) |
| **Exponential Backoff** | Failed emails retry with exponential delay + jitter (up to 5 retries, max 60s delay) |
| **Indian Timezone (IST)** | "Last Reminded" column always writes timestamps in `Asia/Kolkata` timezone |
| **50+ Date Formats** | Parses ISO, US, European, 2-digit year, dot/dash/slash separators, named months, Google Sheets serial numbers, datetime with time, RFC 2822, and more |
| **Weekend Skip** | Automatically skips sending on Saturdays & Sundays |
| **Deduplication** | "Last Reminded" column prevents spamming — only one email per task per day |
| **Priority Logic** | Due today → friendly blue reminder · Overdue → urgent red email CC'd to manager |
| **Structured Logging** | Winston with daily rotating log files (auto-cleanup after 14 days) + colored console output |
| **Health Server** | HTTP endpoints for health checks, status, and manual triggers (port 7860) |
| **Graceful Shutdown** | SIGINT/SIGTERM handling — in-flight emails finish before exit |
| **Docker Ready** | Multi-stage Dockerfile with non-root user, health checks, Alpine-based (small image) |
| **Free Tier Deployable** | Configured for Hugging Face Spaces, Railway, Render, Fly.io |

---

## 📋 Spreadsheet Format

Your Google Sheet must have these columns **in order** (Row 1 = header):

| Column A | Column B | Column C | Column D | Column E |
|---|---|---|---|---|
| **Task Name** | **Owner Email** | **Due Date** | **Status** | **Last Reminded** |
| Quarterly Tax Filing | jane@company.com | 2026-02-20 | In Progress | 25 Feb 2026, 09:00 AM IST |
| Client Report | bob@company.com | 25/02/2026 | Not Started | |
| Budget Review | alice@company.com | Feb 28, 2026 | Completed | |
| Server Migration | dev@company.com | 03-01-2026 | In Progress | |

### Column Details

- **Task Name** (A) — Name of the task (required)
- **Owner Email** (B) — Email address to send the reminder to (required)
- **Due Date** (C) — Supports 50+ date formats (see [Supported Date Formats](#-supported-date-formats) below)
- **Status** (D) — Any value; tasks with `"Completed"` (case-insensitive) are skipped
- **Last Reminded** (E) — **Auto-populated** by the bot in IST — do not edit manually

### Email Behavior

| Condition | Email Type | Subject | CC Manager? |
|---|---|---|---|
| Due date = today | ⏰ Reminder | `⏰ Reminder: Website Redesign is due today` | No |
| Due date < today | 🚨 Urgent | `🚨 URGENT: Website Redesign is overdue by 3 day(s)` | Yes |
| Status = Completed | — | *(skipped)* | — |
| Due date in future | — | *(skipped)* | — |
| Already reminded today | — | *(deduplicated — skipped)* | — |

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js 18+** ([download](https://nodejs.org/))
- **Google Cloud Service Account** with Google Sheets API enabled
- **Gmail App Password** (or any SMTP provider credentials)

### 2. Google Cloud Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services** → **Library** → search for **Google Sheets API** → **Enable**
4. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **Service Account**
5. Give it a name (e.g., `reminder-bot`) → **Done**
6. Click on the created service account → **Keys** tab → **Add Key** → **Create new key** → **JSON**
7. Download the JSON file — you'll need `client_email` and `private_key` from it
8. **Share your Google Sheet(s)** with the service account email (give **Editor** access):
   - Open your Google Sheet → Click **Share** → paste the service account email → **Editor** → **Send**

### 3. Gmail App Password Setup

> **Note:** If using a non-Gmail SMTP provider, skip this and configure `MAIL_HOST`/`MAIL_PORT` instead.

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (required for App Passwords)
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Select app: **Mail**, Select device: **Other** → type `Reminder Bot` → **Generate**
5. Copy the 16-character password — this is your `MAIL_PASS`

### 4. Configure Environment

```bash
# Clone or download the project
cd reminder-bot

# Copy the example env file
cp .env.example .env
```

Edit `.env` with your credentials:

```dotenv
# Single spreadsheet
SPREADSHEETS=1nRvcqVxyLGB_abc123def456

# Google Auth
GOOGLE_SERVICE_ACCOUNT_EMAIL=reminder-bot@my-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"

# Email
MAIL_USER=your-email@gmail.com
MAIL_PASS=abcd efgh ijkl mnop
MANAGER_EMAIL=manager@company.com
```

### 5. Install & Run

```bash
npm install
npm start
```

You should see:

```
╔══════════════════════════════════════════════════╗
║          REMINDER BOT  —  Production            ║
╚══════════════════════════════════════════════════╝
SMTP transporter verified — connection OK
Scheduling reminder job: "0 9 * * 1-5" (tz: Asia/Kolkata)
Health server listening on http://0.0.0.0:7860
```

---

## 📑 Multi-Spreadsheet Configuration

The `SPREADSHEETS` environment variable supports three formats:

### Option 1: JSON Array (Full Control)

Specify multiple spreadsheets, each with specific sheet names:

```dotenv
SPREADSHEETS=[{"id":"SPREADSHEET_ID_1","sheets":["Sheet1","Sheet2"]},{"id":"SPREADSHEET_ID_2","sheets":["Tasks","Backlog"]}]
```

### Option 2: Comma-Separated IDs

Each spreadsheet will read "Sheet1" by default:

```dotenv
SPREADSHEETS=SPREADSHEET_ID_1,SPREADSHEET_ID_2,SPREADSHEET_ID_3
```

### Option 3: Single Spreadsheet (Legacy)

```dotenv
SPREADSHEETS=SPREADSHEET_ID_1
```

> **Tip:** Find your Spreadsheet ID in the URL:
> `https://docs.google.com/spreadsheets/d/`**`1nRvcqVxyLGB_abc123`**`/edit`

---

## 📅 Supported Date Formats

The date parser (`parseDateSafe`) handles **50+ formats** automatically. No configuration needed — just enter dates in any common format in your Google Sheet:

| Category | Examples |
|---|---|
| **ISO 8601** | `2026-02-25`, `2026-02-25T10:30:00` |
| **Slash (4-digit year)** | `02/25/2026`, `25/02/2026`, `2/5/2026` |
| **Dash (4-digit year)** | `02-25-2026`, `25-02-2026`, `2026-02-25` |
| **Dot (4-digit year)** | `25.02.2026`, `02.25.2026`, `2026.02.25` |
| **Slash (2-digit year)** | `02/25/26`, `25/02/26`, `2/5/26` |
| **Dash (2-digit year)** | `02-25-26`, `25-02-26` |
| **Dot (2-digit year)** | `25.02.26`, `02.25.26` |
| **Named months (full)** | `February 25, 2026`, `25 February 2026` |
| **Named months (short)** | `Feb 25, 2026`, `25 Feb 2026`, `25-Feb-2026`, `25-Feb-26` |
| **With time** | `02/25/2026 14:30:00`, `25/02/2026 02:30:00 PM` |
| **Google Sheets serial** | `46077` (5-digit serial date number) |
| **RFC 2822** | `Wed, 25 Feb 2026 10:30:00 +0530` |
| **IST timestamp** | `25 Feb 2026, 02:30 PM IST` (bot's own format) |
| **JS Date fallback** | Anything Node.js `Date()` constructor can parse |

---

## 🔧 Configuration Reference

All configuration is via environment variables (see `.env.example`):

### Google Sheets

| Variable | Required | Default | Description |
|---|---|---|---|
| `SPREADSHEETS` | ✅ | — | Spreadsheet ID(s). JSON array, comma-separated, or single ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✅ | — | Service account email from Google Cloud |
| `GOOGLE_PRIVATE_KEY` | ✅ | — | Private key from the service account JSON |

### Email (SMTP)

| Variable | Required | Default | Description |
|---|---|---|---|
| `MAIL_USER` | ✅ | — | SMTP username / Gmail address |
| `MAIL_PASS` | ✅ | — | SMTP password / Gmail App Password |
| `MAIL_SERVICE` | | `gmail` | Nodemailer service name (set empty for custom SMTP) |
| `MAIL_HOST` | | — | Custom SMTP host (e.g., `smtp.office365.com`) |
| `MAIL_PORT` | | — | Custom SMTP port (e.g., `587`) |
| `MAIL_SECURE` | | `false` | Use TLS (`true` for port 465) |
| `MAIL_FROM_NAME` | | `Reminder Bot` | Display name in the "From" field |
| `MANAGER_EMAIL` | | `MAIL_USER` | CC'd on overdue/urgent emails |

### Scheduler

| Variable | Required | Default | Description |
|---|---|---|---|
| `CRON_SCHEDULE` | | `0 9 * * 1-5` | Cron expression (default: 9:00 AM, Mon–Fri) |
| `TIMEZONE` | | `Asia/Kolkata` | IANA timezone for scheduling |
| `SKIP_WEEKENDS` | | `true` | Skip reminders on Saturday & Sunday |
| `RUN_ON_STARTUP` | | `false` | Trigger an immediate run when the bot starts |

### Batching

| Variable | Required | Default | Description |
|---|---|---|---|
| `SHEET_BATCH_SIZE` | | `5000` | Rows per Google Sheets API read call |
| `SHEET_WRITE_BATCH_SIZE` | | `500` | Rows per write-back batch |

### Email Queue

| Variable | Required | Default | Description |
|---|---|---|---|
| `QUEUE_CONCURRENCY` | | `5` | Max parallel email sends |
| `QUEUE_MAX_RETRIES` | | `5` | Retry attempts per failed email |
| `QUEUE_BASE_DELAY_MS` | | `1000` | Initial retry delay (1 second) |
| `QUEUE_MAX_DELAY_MS` | | `60000` | Maximum retry delay cap (60 seconds) |

### Other

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEDUP_SAME_DAY` | | `true` | Prevent emailing the same task twice in one day |
| `PORT` | | `7860` | HTTP health server port |
| `LOG_LEVEL` | | `info` | Winston log level (`debug`, `info`, `warn`, `error`) |
| `LOG_DIR` | | `logs` | Directory for log files |
| `LOG_MAX_SIZE` | | `20m` | Max size per log file before rotation |
| `LOG_MAX_FILES` | | `14d` | Keep log files for this many days |

---

## 🌐 HTTP Endpoints

The bot exposes a lightweight HTTP server for health checks and manual control:

| Method | Path | Description | Example |
|---|---|---|---|
| `GET` | `/health` | Health check — returns `200 OK` with uptime | `curl http://localhost:7860/health` |
| `GET` | `/status` | Scheduler status, email queue stats, memory usage | `curl http://localhost:7860/status` |
| `POST` | `/trigger` | Manually trigger a reminder run | `curl -X POST http://localhost:7860/trigger` |

### Example Responses

**`GET /health`**
```json
{
  "status": "ok",
  "service": "reminder-bot",
  "uptime": 3600.5,
  "timestamp": "2026-02-25T15:30:00.000Z"
}
```

**`GET /status`**
```json
{
  "status": "ok",
  "scheduler": {
    "running": true,
    "cron": "0 9 * * 1-5",
    "timezone": "Asia/Kolkata",
    "lastRun": "2026-02-25T09:00:00.000+05:30",
    "jobInProgress": false
  },
  "emailQueue": {
    "pending": 0,
    "processing": 0,
    "completed": 42,
    "failed": 0
  },
  "memory": {
    "rss": 52428800,
    "heapUsed": 25165824,
    "heapTotal": 33554432
  },
  "uptime": 3600.5
}
```

---

## 📧 Email Templates

The bot sends **industry-standard HTML emails** with:

- ✅ Table-based layout (renders correctly in Outlook, Gmail, Yahoo, Apple Mail)
- ✅ Inline CSS only (no external stylesheets — email clients strip `<style>` tags)
- ✅ Dark mode support via `prefers-color-scheme` media query
- ✅ Mobile responsive design (max-width: 600px)
- ✅ Both HTML and plain-text fallback versions
- ✅ IST timestamp in the footer
- ✅ XSS-safe — all user input is HTML-escaped

### Due Today (Blue Theme)
> Subject: `⏰ Reminder: Website Redesign is due today`
>
> A friendly blue-accented card with task details, due date, and a call to action.

### Overdue (Red Theme)
> Subject: `🚨 URGENT: Website Redesign is overdue by 3 day(s)`
>
> A red-accented urgent card with an overdue badge, days overdue count, CC'd to manager.

---

## 📊 Architecture

```
┌───────────────────────────────────────────────────────────┐
│                       CRON SCHEDULER                       │
│           node-cron (0 9 * * 1-5, Asia/Kolkata)           │
│               Overlap protection built-in                  │
└──────────────────────────┬────────────────────────────────┘
                           │ triggers
                           ▼
┌───────────────────────────────────────────────────────────┐
│                    REMINDER SERVICE                        │
│                                                           │
│  for each spreadsheet × sheet:                            │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐   │
│  │ Sheet Reader  │→ │ Filter Logic  │→ │ Email Queue  │   │
│  │ (async gen,   │  │ • skip done   │  │ (async,      │   │
│  │  5000/batch)  │  │ • skip future │  │  5 workers,  │   │
│  │              │  │ • dedup       │  │  exp backoff)│   │
│  └──────────────┘  │ • 50+ date   │  └──────┬───────┘   │
│                     │   formats    │         │           │
│                     └───────────────┘         │           │
└───────────────────────────────────────────────┼───────────┘
                                                │ drain
                                                ▼
┌───────────────────────────────────────────────────────────┐
│               SHEET WRITER (batched, per-sheet)            │
│          Updates "Last Reminded" column in IST             │
│           (e.g., "25 Feb 2026, 09:00 AM IST")             │
└───────────────────────────────────────────────────────────┘
```

### Processing Flow

1. **Cron fires** → `processReminders()` called
2. **Weekend check** → skip if Saturday/Sunday
3. **For each spreadsheet** → for each sheet:
   - Read rows in batches of 5,000 (async generator — constant memory)
   - Filter: skip completed, skip future due dates, skip already-reminded-today
   - Parse due date (50+ format support)
   - Build HTML email (due-today = blue, overdue = red + CC manager)
   - Enqueue into async email queue
4. **Drain queue** → send all emails (5 concurrent, retry with backoff on failure)
5. **Write back** → update "Last Reminded" column per-sheet with IST timestamp
6. **Log summary** → tasks scanned, emails sent, failures, skips

### Error Isolation

- A failure in one sheet does **not** abort other sheets
- A failed email is retried up to 5 times before being logged and skipped
- "Last Reminded" is written even for failed sends to prevent infinite retry loops

---

## 📁 Project Structure

```
reminder-bot/
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
├── .dockerignore                 # Docker build ignore rules
├── Dockerfile                    # Multi-stage production Docker image
├── package.json                  # Dependencies & scripts
├── README.md                     # This file
└── src/
    ├── index.js                  # Entry point — startup sequence & graceful shutdown
    ├── config.js                 # Validated env config, multi-spreadsheet parser
    ├── scheduler.js              # Cron scheduler with overlap protection
    ├── server.js                 # HTTP health / status / trigger endpoints
    ├── service/
    │   ├── sheet.service.js      # Google Sheets batched read/write (async generator)
    │   ├── email.service.js      # SMTP connection pool + async queue + retry
    │   ├── email.templates.js    # Industry-standard HTML email templates
    │   └── reminder.service.js   # Core business logic — multi-sheet orchestrator
    └── utils/
        ├── logger.js             # Winston logger with daily file rotation
        ├── date.js               # Luxon date parser (50+ formats) + IST helpers
        ├── queue.js              # Generic async queue with concurrency control
        └── retry.js              # Exponential backoff with jitter
```

---

## 🐳 Docker Deployment

### Build & Run Locally

```bash
# Build the image
docker build -t reminder-bot .

# Run with env file
docker run -d \
  --name reminder-bot \
  --env-file .env \
  -p 7860:7860 \
  --restart unless-stopped \
  reminder-bot
```

### Docker Compose

```yaml
version: "3.8"
services:
  reminder-bot:
    build: .
    ports:
      - "7860:7860"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:7860/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    volumes:
      - ./logs:/app/logs
```

### Dockerfile Features

- **Multi-stage build** — `npm ci --production` in builder stage, copy only `node_modules` to runtime
- **Alpine-based** — minimal image size (~120MB)
- **Non-root user** — runs as `botuser` for security
- **Built-in healthcheck** — container orchestrators auto-restart on failure
- **Logs directory** — pre-created with correct permissions

---

## ☁️ Deployment Guides

### Hugging Face Spaces (Free)

1. Create a new Space at [huggingface.co/spaces](https://huggingface.co/spaces)
2. Select **Docker** as the SDK
3. Push this repo to the Space (or connect a GitHub repo)
4. Go to **Settings** → **Variables and secrets** → add all `.env` variables as **Secrets**
5. The Space auto-builds from the Dockerfile and exposes port 7860
6. Health check URL: `https://your-username-your-space.hf.space/health`

### Railway

1. Sign up at [railway.app](https://railway.app) and connect your GitHub repo
2. Railway auto-detects the Dockerfile
3. Add environment variables in the Railway dashboard (**Variables** tab)
4. Deploy — Railway assigns a public URL automatically

### Render

1. Sign up at [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo
3. Set **Docker** as the environment
4. Add environment variables in the **Environment** tab
5. Set health check path to `/health`
6. Deploy

### Manual Server (VPS / EC2)

```bash
# Clone the repo
git clone https://github.com/your-username/reminder-bot.git
cd reminder-bot

# Setup
cp .env.example .env
# Edit .env with your credentials

npm install

# Run with PM2 (recommended for production)
npm install -g pm2
pm2 start src/index.js --name reminder-bot
pm2 save
pm2 startup
```

---

## 🧪 Testing

### Quick Verification

1. Set `RUN_ON_STARTUP=true` in `.env`
2. Add a test row in your Google Sheet with today's date and your email
3. Run `npm start` and check your inbox

### Manual Trigger

```bash
# While the bot is running, trigger a run manually:
curl -X POST http://localhost:7860/trigger
```

### Check Status

```bash
# See scheduler and queue stats:
curl http://localhost:7860/status | jq .
```

### View Logs

```bash
# Real-time logs
tail -f logs/application-$(date +%Y-%m-%d).log

# Or check the console output for immediate feedback
```

### Test Checklist

- [ ] Bot starts without errors
- [ ] SMTP connection verified ("connection OK" in logs)
- [ ] Correct spreadsheet(s) detected in logs
- [ ] Tasks are scanned (check "rows scanned" count)
- [ ] Due-today task receives a ⏰ Reminder email
- [ ] Overdue task receives a 🚨 URGENT email (CC'd to manager)
- [ ] "Last Reminded" column is updated with IST timestamp
- [ ] Running again skips already-reminded tasks ("deduped" count > 0)
- [ ] Completed tasks are skipped
- [ ] Future tasks are skipped
- [ ] HTML email renders correctly in Gmail/Outlook

---

## 🔍 Troubleshooting

| Issue | Solution |
|---|---|
| `Missing SPREADSHEETS environment variable` | Set `SPREADSHEETS` in `.env`. See [Multi-Spreadsheet Configuration](#-multi-spreadsheet-configuration) |
| `SMTP transporter verification failed` | Check `MAIL_USER` and `MAIL_PASS`. For Gmail, use App Password (not your login password) |
| `Error: EADDRINUSE port 7860` | Another process is using port 7860. Kill it (`lsof -ti:7860 \| xargs kill`) or change `PORT` in `.env` |
| `Google API 403 Forbidden` | Share your Google Sheet with the service account email (Editor access) |
| `Google API 404 Not Found` | Check that `SPREADSHEETS` contains the correct spreadsheet ID |
| `Emails send again on restart` | The bot was updated to fix this. Ensure the "Last Reminded" IST timestamp is parseable. Clear the column and re-run if needed |
| `0 rows scanned` | Check that your sheet has data starting from row 2 (row 1 = header) |
| `Unparseable due date` | Check the date format. See [Supported Date Formats](#-supported-date-formats) |
| All tasks "deduped" | The "Last Reminded" column already has today's date. Wait until tomorrow or clear the column to re-test |

---

## 📚 Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js 18+** | Runtime (ES Modules) |
| **googleapis** | Google Sheets API v4 |
| **nodemailer** | SMTP email with connection pooling |
| **node-cron** | Cron scheduling |
| **luxon** | Timezone-aware date parsing & formatting |
| **winston** | Structured logging with daily rotation |
| **dotenv** | Environment variable management |

---

## 📝 License

MIT
