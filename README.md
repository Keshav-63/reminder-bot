# 🤖 Reminder Bot — Production-Grade Task Deadline Tracker

Automated system that monitors a Google Sheets project deadline tracker and sends email reminders to team members with overdue or due-today tasks.

## ✨ Features

| Feature | Details |
|---|---|
| **Batched Sheet Reading** | Reads Google Sheets in configurable pages (default 5,000 rows) — handles millions of rows without memory pressure |
| **Email Queue** | Async in-memory queue with configurable concurrency (default 5 parallel sends) |
| **Exponential Backoff** | Failed emails retry with exponential delay + jitter (up to 5 retries) |
| **Weekend Skip** | Automatically skips sending on Saturdays & Sundays |
| **Deduplication** | "Last Reminded" column prevents spamming — only one email per task per day |
| **Priority Logic** | Due today → friendly reminder · Overdue → URGENT email CC'd to manager |
| **Structured Logging** | Winston with daily rotating log files + console output |
| **Health Server** | HTTP endpoints for health checks, status, and manual triggers |
| **Graceful Shutdown** | SIGINT/SIGTERM handling — in-flight emails finish before exit |
| **Docker Ready** | Multi-stage Dockerfile with non-root user and health checks |
| **Free Tier Deployable** | Configured for Hugging Face Spaces, Railway, Render, Fly.io |

## 📋 Spreadsheet Format

Your Google Sheet must have these columns (in order):

| Column A | Column B | Column C | Column D | Column E |
|---|---|---|---|---|
| Task Name | Owner Email | Due Date | Status | Last Reminded |
| Quarterly Tax Filing | jane.doe@firm.com | 2026-02-20 | In Progress | *(auto-filled)* |
| Client Report | bob@firm.com | 2026-02-25 | Not Started | |
| Budget Review | alice@firm.com | 2026-03-01 | Completed | |

- **Status** values: `"In Progress"`, `"Not Started"`, `"Completed"` (case-insensitive for "Completed")
- **Due Date**: Supports ISO (`2026-02-25`), US (`02/25/2026`), and most common date formats
- **Last Reminded**: Auto-populated by the bot — do not edit manually

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js 18+**
- **Google Cloud Service Account** with Sheets API enabled
- **Gmail App Password** (or any SMTP credentials)

### 2. Google Sheets Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Google Sheets API**
3. Create a **Service Account** → Download the JSON key
4. Share your Google Sheet with the service account email (Editor access)

### 3. Gmail App Password

1. Enable 2-Factor Authentication on your Google Account
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate a password for "Mail" → "Other (Reminder Bot)"

### 4. Configure

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 5. Install & Run

```bash
npm install
npm start
```

## 🔧 Configuration

All config is via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `SPREADSHEET_ID` | *(required)* | Google Sheet ID from the URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | *(required)* | Service account email |
| `GOOGLE_PRIVATE_KEY` | *(required)* | Service account private key |
| `MAIL_USER` | *(required)* | SMTP username / Gmail address |
| `MAIL_PASS` | *(required)* | SMTP password / Gmail App Password |
| `MAIL_SERVICE` | `gmail` | Nodemailer service name |
| `MANAGER_EMAIL` | `MAIL_USER` | CC'd on urgent/overdue emails |
| `CRON_SCHEDULE` | `0 9 * * 1-5` | Cron expression (default: 9 AM weekdays) |
| `TIMEZONE` | `UTC` | IANA timezone |
| `SKIP_WEEKENDS` | `true` | Skip Saturday/Sunday |
| `RUN_ON_STARTUP` | `false` | Run immediately on boot |
| `SHEET_BATCH_SIZE` | `5000` | Rows per read batch |
| `QUEUE_CONCURRENCY` | `5` | Parallel email sends |
| `QUEUE_MAX_RETRIES` | `5` | Email retry attempts |
| `PORT` | `7860` | Health server port |

## 🌐 HTTP Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (returns 200) |
| `GET` | `/status` | Scheduler status, queue stats, memory usage |
| `POST` | `/trigger` | Manually trigger a reminder run |

## 🐳 Docker Deployment

```bash
# Build
docker build -t reminder-bot .

# Run
docker run -d \
  --name reminder-bot \
  --env-file .env \
  -p 7860:7860 \
  reminder-bot
```

## 🤗 Deploy to Hugging Face Spaces (Free)

1. Create a new Space → Select **Docker** as the SDK
2. Push this repo to the Space
3. Add all `.env` variables as **Space Secrets** (Settings → Variables & Secrets)
4. The Space will auto-build from the Dockerfile and expose port 7860

## 🚂 Deploy to Railway (Free Tier)

1. Connect your GitHub repo to [Railway](https://railway.app)
2. Add environment variables in the Railway dashboard
3. Railway auto-detects the Dockerfile

## 📊 Architecture

```
┌──────────────────────────────────────────────────────┐
│                     CRON SCHEDULER                    │
│              (node-cron, 0 9 * * 1-5)                │
└─────────────────────┬────────────────────────────────┘
                      │ triggers
                      ▼
┌──────────────────────────────────────────────────────┐
│               REMINDER SERVICE                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Sheet Reader │→ │ Filter/Logic │→ │ Email Queue │ │
│  │ (batched     │  │ (weekend,    │  │ (async,     │ │
│  │  5000/page)  │  │  dedup,      │  │  5 workers, │ │
│  │              │  │  priority)   │  │  exp backoff│ │
│  └─────────────┘  └──────────────┘  └──────┬──────┘ │
└─────────────────────────────────────────────┼────────┘
                                              │ drain
                                              ▼
┌──────────────────────────────────────────────────────┐
│              SHEET WRITER (batched)                    │
│         Updates "Last Reminded" column                │
└──────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
src/
├── index.js                 # Entry point, startup, graceful shutdown
├── config.js                # Validated environment config
├── scheduler.js             # Cron scheduler with overlap protection
├── server.js                # HTTP health/status/trigger server
├── service/
│   ├── sheet.service.js     # Google Sheets batched read/write
│   ├── email.service.js     # SMTP + queue + exponential backoff
│   └── reminder.service.js  # Core business logic
└── utils/
    ├── logger.js            # Winston with daily rotation
    ├── date.js              # Luxon date helpers
    ├── queue.js             # Async queue with concurrency
    └── retry.js             # Exponential backoff with jitter
```

## 📝 License

MIT
