import { getEnv } from '../config/index.js';
import { getLogger } from '../utils/logger.js';
import { EventEmitter } from 'events';

export interface BotClient extends EventEmitter {
  sendMessage(chatId: string, content: any, options?: any): Promise<{ id: { _serialized: string } }>;
  getMessageById?(messageId: string): Promise<any>;
  getContactById(contactId: string): Promise<{ pushname: string; number: string }>;
  info?: { wid?: { _serialized: string } };
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}

let _client: BotClient | null = null;
let _botId = 'bot@c.us';

export async function initClient(): Promise<BotClient> {
  const logger = getLogger();
  const env = getEnv();

  if (env.DRY_RUN) {
    logger.info('DRY RUN mode - using mock WhatsApp client');
    _client = createMockClient();
    _botId = 'mock-bot@c.us';
    return _client;
  }

  const wweb = await import('whatsapp-web.js');
  const ClientCtor = (wweb as any).Client ?? (wweb as any).default?.Client;
  const LocalAuthCtor = (wweb as any).LocalAuth ?? (wweb as any).default?.LocalAuth;
  if (!ClientCtor || !LocalAuthCtor) {
    throw new Error('Failed to load whatsapp-web.js Client/LocalAuth exports');
  }
  const qrcode = await import('qrcode-terminal');

  const client = new ClientCtor({
    authStrategy: new LocalAuthCtor({ clientId: env.WHATSAPP_CLIENT_ID }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  }) as unknown as BotClient;

  client.on('qr', (qr: string) => {
    logger.info('Scan this QR code with WhatsApp:');
    qrcode.default.generate(qr, { small: true });
  });

  client.on('ready', () => {
    const info = (client as any).info;
    _botId = info?.wid?._serialized ?? 'unknown';
    logger.info({ botId: _botId }, 'WhatsApp client is ready');
  });

  client.on('disconnected', (reason: string) => {
    logger.warn({ reason }, 'WhatsApp client disconnected');
  });

  client.on('auth_failure', (msg: string) => {
    logger.error({ msg }, 'WhatsApp authentication failed');
  });

  await client.initialize();
  _client = client;
  return client;
}

export function getClient(): BotClient {
  if (!_client) throw new Error('WhatsApp client not initialized');
  return _client;
}

export function getBotId(): string {
  return _botId;
}

function createMockClient(): BotClient {
  const logger = getLogger();
  const emitter = new EventEmitter() as BotClient;
  let messageCounter = 0;

  emitter.sendMessage = async (chatId: string, content: any, options?: any) => {
    messageCounter++;
    const id = `mock-msg-${messageCounter}`;

    if (typeof content === 'string') {
      logger.info({ chatId, content, options }, '[DRY RUN] sendMessage');
    } else {
      logger.info({ chatId, content: JSON.stringify(content), options }, '[DRY RUN] sendPoll/sendMessage');
    }

    return { id: { _serialized: id } };
  };

  emitter.getContactById = async (contactId: string) => {
    return { pushname: `MockUser-${contactId}`, number: contactId };
  };

  emitter.info = { wid: { _serialized: 'mock-bot@c.us' } };
  emitter.initialize = async () => { logger.info('[DRY RUN] Client initialized'); };
  emitter.destroy = async () => { logger.info('[DRY RUN] Client destroyed'); };

  return emitter;
}

export function simulateMessage(senderId: string, senderName: string, body: string, mentionsBot = false): void {
  const client = getClient();
  const mockMsg = {
    id: { _serialized: `mock-incoming-${Date.now()}` },
    from: getEnv().WHATSAPP_GROUP_ID,
    author: senderId,
    body,
    mentionedIds: mentionsBot ? [getBotId()] : [],
    getContact: async () => ({ pushname: senderName, number: senderId }),
    reply: async (text: string) => {
      getLogger().info({ text }, '[DRY RUN] Reply sent');
    },
  };
  client.emit('message', mockMsg);
}

export function simulateVote(pollWaMessageId: string, voterId: string, voterName: string, selectedOptions: string[]): void {
  const client = getClient();
  const mockVote = {
    voter: voterId,
    selectedOptions,
    parentMessage: {
      id: { _serialized: pollWaMessageId },
    },
    getContact: async () => ({ pushname: voterName, number: voterId }),
  };
  client.emit('vote_update', mockVote);
}
