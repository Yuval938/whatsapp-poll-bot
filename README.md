# WhatsApp Game Night Bot

Production-oriented WhatsApp bot for weekly game-night coordination.

It handles the full poll lifecycle in group chats:
- Create weekly poll
- Track votes
- Send reminders
- Conclude with a final result
- Handle missed deadlines
- Optionally use AI for natural-language responses

## What Is Implemented

### Core stack
- Node.js + TypeScript app
- `whatsapp-web.js` client (QR login, persistent session)
- SQLite database with migrations
- `node-cron` scheduler
- Structured logging (`pino`)
- Test suite (`vitest`)

### Data model
- `polls`: poll metadata and lifecycle status (`active`, `concluded`, `expired`)
- `votes`: per-user vote selections
- `chat_history`: recent group message context
- `bot_state`: runtime telemetry and delivery health keys
- `_migrations`: migration tracking

### Group-aware behavior
- Primary group via `WHATSAPP_GROUP_ID`
- Optional extra groups via `WHATSAPP_GROUP_IDS` (comma-separated)
- Incoming messages are processed only if they come from configured groups
- Scheduled jobs iterate configured groups

### Reliability upgrades
- Poll/text send paths store ack telemetry in `bot_state`
- Poll creation waits for delivery ack before confirming success
- Fallback messages are used if AI is unavailable or fails
- Periodic jobs backstop real-time events (for missed vote updates)

### Dedicated WhatsApp profile support
- `WHATSAPP_CLIENT_ID` selects LocalAuth profile directory
- Lets you run one dedicated phone number/session per bot profile

## End-to-End Runtime Flow

1. Startup (`src/index.ts`)
- Load config (`config.yaml` + `.env`)
- Initialize logger
- Initialize database + run migrations
- Initialize WhatsApp client
- Register event handlers
- Start scheduled jobs

2. Message ingestion (`src/whatsapp/events.ts`)
- Ignore messages from non-configured groups
- Persist message into `chat_history`
- Detect trigger condition:
  - explicit mention, or
  - recognized command text
- Route to responder (`src/ai/responder.ts`)

3. Command/mention handling (`src/ai/responder.ts`)
- If command matches, execute command handler:
  - create poll
  - status
  - help/health
- If no command match, generate AI reply for free-form message

4. Poll lifecycle (`src/poll/manager.ts`)
- Expire old active poll for that group
- Generate intro text (AI with fallback)
- Send WhatsApp poll and verify ack
- Persist poll record
- Track votes and tallies
- Auto-conclude when threshold is met
- Auto-expire if deadline/impossibility is reached

5. Scheduled automation (`src/scheduler/index.ts`)
- Weekly create-poll job
- Reminder job
- Vote-check fallback job
- Deadline job
- Chat-history pruning
- Each job records run metadata in `bot_state`

## User Commands (Simple)

Users can trigger the bot by command text (tagging is optional).

English commands:
- `create poll`
- `status`
- `help`
- `health`

Hebrew aliases are also supported (configured in `src/ai/responder.ts`).

Free-form AI usage:
- Mention the bot and ask any question or request wording help.
- If message is not a known command, responder routes it to AI (if configured).

## When AI Is Used vs Not Used

### AI is used for
- Poll intro announcement text
- Reminder wording
- Final outcome announcement text
- Free-form conversational responses in group

### AI is not used for
- Poll/vote storage
- Command parsing
- Vote counting and threshold logic
- Deadline logic
- Scheduler behavior
- Group filtering/security boundaries

## AI Trigger Rules

AI is called when at least one of these is true:
- System needs generated text for announcement/reminder/outcome
- User sends a non-command interaction to the bot (mention or direct command-like trigger path)

AI is skipped when:
- Message is recognized as a built-in command
- Logic-only workflows run (votes, deadlines, cron checks)

## Fallback Behavior

- No AI key configured: bot returns safe static fallback text
- AI provider error/timeout: bot logs error and uses fallback message
- Poll send ack failure: bot does not fake success in live mode
- Missed real-time vote events: fallback check job still validates state
- `DRY_RUN=true`: no live WhatsApp sends; mock behavior for local validation

## Environment Variables

See `.env.example` for full list.

Important variables:
- `WHATSAPP_GROUP_ID`
- `WHATSAPP_GROUP_IDS` (optional)
- `WHATSAPP_CLIENT_ID`
- `GROUP_SIZE_ESTIMATE`
- `DRY_RUN`
- `AI_PROVIDER`
- `AI_MODEL`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

## Local Run

1. Install deps:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
```

3. Start bot:
```bash
npm run dev
```

4. Scan WhatsApp QR code from the account you want the bot to run as.

## Dedicated Number Setup

1. Set `WHATSAPP_CLIENT_ID` in `.env` to a stable value (for example `bot-prod`).
2. Start bot with `DRY_RUN=false`.
3. Scan QR using dedicated phone number account.
4. Keep the generated session directory; this preserves login for future runs.

## Expandability

Domain structure:
- `src/ai`: provider, prompts, responder
- `src/poll`: poll lifecycle and analysis logic
- `src/scheduler`: cron jobs and orchestration
- `src/storage`: migrations and repository layer
- `src/whatsapp`: client/actions/events adapters

Common extension paths:
- Add command: update command registry in `src/ai/responder.ts`
- Add job: add job module + register in `src/scheduler/index.ts`
- Add persistence: add migration + repository methods
- Add AI provider/model options: extend `src/ai/provider.ts`

## Current Capability Snapshot

- Poll orchestration bot for WhatsApp groups
- Multi-group configuration support
- AI-optional operation mode
- Delivery ack and job telemetry tracking
- Live mode and dry-run mode
- Clean test/build pipeline

## Suggested Next Tasks

1. Add admin-only permissions for sensitive commands.
2. Add per-group schedule/threshold config instead of shared global config.
3. Expose an HTTP `/health` endpoint sourced from `bot_state`.
4. Add retries/backoff strategy for failed sends.
5. Add integration tests that simulate multiple groups and failures.
