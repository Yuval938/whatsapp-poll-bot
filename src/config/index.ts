import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { config as loadDotenv } from 'dotenv';
import { configSchema, envSchema, type AppConfig, type EnvConfig } from './schema.js';

let _config: AppConfig | null = null;
let _env: EnvConfig | null = null;

export function loadConfig(configPath?: string): AppConfig {
  if (_config) return _config;
  const filePath = configPath ?? resolve(process.cwd(), 'config.yaml');
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseYaml(raw);
  _config = configSchema.parse(parsed);
  return _config;
}

export function loadEnv(envPath?: string): EnvConfig {
  if (_env) return _env;
  loadDotenv({ path: envPath ?? resolve(process.cwd(), '.env') });
  _env = envSchema.parse(process.env);
  return _env;
}

export function getConfig(): AppConfig {
  if (!_config) throw new Error('Config not loaded. Call loadConfig() first.');
  return _config;
}

export function getEnv(): EnvConfig {
  if (!_env) throw new Error('Env not loaded. Call loadEnv() first.');
  return _env;
}

export function resetConfig(): void {
  _config = null;
  _env = null;
}