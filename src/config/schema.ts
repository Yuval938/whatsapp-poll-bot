import { z } from 'zod';

export const pollConfigSchema = z.object({
  days_to_offer: z.array(z.string()).min(1),
  allow_multiple_answers: z.boolean().default(true),
  vote_threshold: z.number().int().min(1).default(6),
  auto_conclude_if_impossible: z.boolean().default(true),
});

export const scheduleConfigSchema = z.object({
  poll_create_cron: z.string(),
  reminder_cron: z.string(),
  vote_check_cron: z.string(),
  poll_deadline_cron: z.string(),
  timezone: z.string().default('Asia/Jerusalem'),
});

export const reminderConfigSchema = z.object({
  min_voters_before_reminder: z.number().int().min(1).default(10),
});

export const personalityConfigSchema = z.object({
  bot_name: z.string().default('GameBot'),
  base_traits: z.string(),
  chat_history_window: z.number().int().min(1).default(50),
  language: z.string().default('he'),
  max_response_tokens: z.number().int().min(1).default(300),
});

export const configSchema = z.object({
  poll: pollConfigSchema,
  schedule: scheduleConfigSchema,
  reminder: reminderConfigSchema,
  personality: personalityConfigSchema,
});

export const envSchema = z.object({
  WHATSAPP_GROUP_ID: z.string().min(1),
  WHATSAPP_GROUP_IDS: z.string().optional().default(''),
  WHATSAPP_CLIENT_ID: z.string().default('game-bot'),
  DRY_RUN: z.string().transform(v => v === 'true').default('true'),
  AI_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  AI_MODEL: z.string().default('claude-sonnet-4-20250514'),
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  GROUP_SIZE_ESTIMATE: z.coerce.number().int().min(1).default(20),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type AppConfig = z.infer<typeof configSchema>;
export type EnvConfig = z.infer<typeof envSchema>;
