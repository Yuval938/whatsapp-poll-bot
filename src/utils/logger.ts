import pino from 'pino';

let _logger: pino.Logger | null = null;

export function initLogger(level: string = 'info'): pino.Logger {
  _logger = pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  });
  return _logger;
}

export function getLogger(): pino.Logger {
  if (!_logger) {
    _logger = initLogger();
  }
  return _logger;
}