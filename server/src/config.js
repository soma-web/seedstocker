import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../config/scraper.json');

/**
 * Read the scraper config from disk.
 * Returns a plain object with all config values, or sensible defaults.
 */
export function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {}
  return { maxItemsPerShop: null, debug: false, shops: [] };
}

/**
 * Write (merge) config to disk. Returns true on success.
 */
export function writeConfig(data) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the Gemini API key from env or config.
 */
export function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  const config = getConfig();
  return config.geminiApiKey || null;
}

/**
 * Get local LLM config (for LM Studio, Ollama, etc.)
 */
export function getLocalLlmConfig() {
  const config = getConfig();
  return {
    useLocalLlm: !!config.useLocalLlm,
    localLlmUrl: config.localLlmUrl || 'http://localhost:1234/v1/chat/completions',
    localLlmModel: config.localLlmModel || 'local-model'
  };
}

/**
 * Get the ChatGPT API key from env or config.
 */
export function getChatgptApiKey() {
  if (process.env.CHATGPT_API_KEY) {
    return process.env.CHATGPT_API_KEY;
  }
  const config = getConfig();
  return config.chatgptApiKey || null;
}

/**
 * Get ChatGPT config.
 */
export function getChatgptConfig() {
  const config = getConfig();
  return {
    useChatGpt: !!config.useChatGpt,
    chatgptModel: config.chatgptModel || 'gpt-4o-mini'
  };
}

/**
 * Get the max items per shop limit, or null for unlimited.
 */
export function getMaxItemsLimit() {
  const config = getConfig();
  return typeof config.maxItemsPerShop === 'number' ? config.maxItemsPerShop : null;
}

/**
 * Get the list of blocked words from config.
 */
export function getBlockedWords() {
  const config = getConfig();
  if (Array.isArray(config.blockedWords)) {
    return config.blockedWords.map(w => w.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

/**
 * Get proxy configuration (list-based Webshare setup).
 * Returns null if proxy is not configured.
 */
export function getProxyConfig() {
  const config = getConfig();
  if (!config.proxy) return null;
  return config.proxy;
}

/**
 * Get the server port from process.env.PORT, config file ("port"), or fallback default 3002.
 */
export function getServerPort() {
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const config = getConfig();
  if (typeof config.port === 'number' && config.port > 0) {
    return config.port;
  }
  if (typeof config.port === 'string') {
    const parsed = parseInt(config.port, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3002;
}

export { configPath };
