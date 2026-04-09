import { generateText } from 'ai';
import { getEnv } from '../config/index.js';
import { getLogger } from '../utils/logger.js';

function getModel() {
  const env = getEnv();
  const provider = env.AI_PROVIDER;
  const modelId = env.AI_MODEL;

  if (provider === 'anthropic') {
    const { anthropic } = require('@ai-sdk/anthropic');
    return anthropic(modelId);
  } else if (provider === 'openai') {
    const { openai } = require('@ai-sdk/openai');
    return openai(modelId);
  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export async function generate(
  system: string,
  userMessage: string,
  maxTokens?: number
): Promise<string> {
  const logger = getLogger();
  const env = getEnv();

  // Check if API key is configured
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    logger.warn('No Anthropic API key configured, returning fallback');
    return 'אין כרגע חיבור ל-AI, אבל אני עדיין כאן לפקודות בסיסיות.';
  }
  if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    logger.warn('No OpenAI API key configured, returning fallback');
    return 'אין כרגע חיבור ל-AI, אבל אני עדיין כאן לפקודות בסיסיות.';
  }

  try {
    const { text } = await generateText({
      model: getModel(),
      system,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: maxTokens ?? 300,
    });
    return text;
  } catch (err) {
    logger.error({ err }, 'AI generation failed');
    throw err;
  }
}
