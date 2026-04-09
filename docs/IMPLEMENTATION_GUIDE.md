# Implementation Guide

This guide explains what is implemented, how requests flow through the code, when AI is used, and how to extend the bot safely.

## 1. Architecture

The service is an event-driven worker with scheduled automation:
- Event path: WhatsApp messages and poll vote updates
- Time path: cron jobs for poll lifecycle and housekeeping
- Persistence path: SQLite repositories
- Language path: optional AI text generation

Main entrypoint: `src/index.ts`

## 2. Module Map

- `src/index.ts`
  - bootstraps config, db, WhatsApp client, events, scheduler
- `src/config/*`
  - loads and validates env/config
- `src/whatsapp/*`
  - client setup, send actions, incoming event subscriptions
- `src/ai/*`
  - provider adapter, prompt builders, command/mention responder
- `src/poll/*`
  - poll lifecycle manager and tally analyzer
- `src/scheduler/*`
  - cron jobs and orchestration
- `src/storage/*`
  - database init, migrations, repositories

## 3. Startup Flow

1. `src/index.ts` loads config.
2. Logger is initialized.
3. Database connection starts and migrations run.
4. WhatsApp client is created and initialized.
5. Event handlers are registered.
6. Scheduler starts cron jobs.

Startup finishes only after core services are ready.

## 4. Incoming Message Flow

From `src/whatsapp/events.ts`:

1. Receive `message` event.
2. Validate chat/group against configured target group IDs.
3. Persist message into `chat_history`.
4. Determine route:
  - mention/direct trigger + command match => command handler
  - mention/direct trigger + no command match => AI responder
  - otherwise ignore

From `src/ai/responder.ts`:

1. Normalize text (strip mention prefix).
2. Evaluate command regex list.
3. If command matched:
  - create poll / status / help / health flow
4. Else:
  - call AI generation path for free-form reply
5. Send reply using WhatsApp action helper.

## 5. Poll Lifecycle Flow

From `src/poll/manager.ts`:

1. `createWeeklyPoll(groupId)`:
  - expire previous active poll in same group
  - generate intro announcement (AI with fallback)
  - send poll and verify ack
  - persist poll row
2. Vote updates:
  - identify poll by WhatsApp poll message id
  - upsert voter selections
  - recompute tallies
  - conclude if threshold reached
3. Deadline path:
  - conclude if impossible state or time limit reached
4. Final message:
  - generated via AI prompt with fallback text

## 6. Scheduler Flow

From `src/scheduler/index.ts`:

- Weekly poll creation job
- Reminder job
- Fallback vote-check job
- Deadline-enforcement job
- Chat history pruning job

Jobs iterate each configured group and write telemetry to `bot_state`, for example:
- `job:create-poll:last_started_at`
- `job:create-poll:last_finished_at`
- `job:create-poll:last_status`

## 7. Data and State

SQLite tables:
- `polls`
  - includes `group_id`, poll ids, status, timing fields
- `votes`
  - voter id + selected options
- `chat_history`
  - short-term chat context
- `bot_state`
  - generic key/value operational telemetry
- `_migrations`
  - migration versions

Repository pattern:
- domain modules call repository functions, not raw SQL
- migrations are versioned and replay-safe

## 8. AI Boundaries

AI is used for language generation only:
- poll announcement text
- reminder text
- final outcome/no-game text
- free-form mention responses

AI is never used for deterministic decisions:
- command routing
- vote counting
- threshold checks
- deadline checks
- delivery status handling

This keeps core behavior stable even when AI is unavailable.

## 9. AI Trigger Conditions

AI call happens when:
- poll manager asks for announcement/outcome text
- responder receives non-command mention interaction

AI call does not happen when:
- command text is recognized
- scheduled logic evaluates poll state
- persistence-only operations occur

## 10. Fallback Strategy

- Missing API key => non-breaking fallback text
- Provider/runtime failure => fallback text + logged error
- Poll delivery ack failure in live mode => fail loudly, no fake success
- Missed real-time events => fallback cron checks maintain eventual consistency
- Dry run => mock send objects for local development without live posting

## 11. User-Facing Capabilities

Simple user capabilities:
- create poll now
- view active poll status
- ask for help/health
- ask free-form questions to bot (AI path)

Operational behavior:
- tag is supported, not required for command text
- only configured groups are handled
- poll/vote state is persisted across restarts

## 12. How a New User Uses It

1. Add bot account to target WhatsApp group.
2. Start bot process and scan QR from that account.
3. In group, send:
  - `create poll` (or Hebrew alias)
  - `status`
  - `help`
  - `health`
4. Users vote in WhatsApp poll UI.
5. Bot posts reminders and final result automatically.

## 13. Expandability Guidance

To add a new command:
1. Add regex and handler in `src/ai/responder.ts`.
2. Keep deterministic actions in service/repository modules.
3. Add tests in `tests/ai` or integration tests.

To add a new scheduled behavior:
1. Create job under `src/scheduler/jobs`.
2. Register it in `src/scheduler/index.ts`.
3. Add telemetry keys in `bot_state`.

To add persistent features:
1. Add migration in `src/storage/database.ts`.
2. Add repository methods.
3. Update domain module + tests.

## 14. Current Refactor Outcomes

Implemented in this cycle:
- Group-aware poll handling with `group_id`
- Multi-group target config (`WHATSAPP_GROUP_IDS`)
- Dedicated LocalAuth profile support (`WHATSAPP_CLIENT_ID`)
- Delivery ack instrumentation in `bot_state`
- Scheduler run telemetry instrumentation
- Cleaner command/health surfaces in responder
- Documentation refresh for operations and ownership

## 15. Recommended Next Tasks

1. Admin-only command authorization.
2. Per-group schedules and thresholds.
3. Exposed health endpoint for monitoring tools.
4. Retry/backoff policy for delivery failures.
5. More integration tests for multi-group and failure paths.
