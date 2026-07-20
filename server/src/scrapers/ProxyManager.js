/**
 * ProxyManager — round-robin proxy selection for scraping.
 *
 * Proxies are stored as `host:port` strings in scraper.json under `proxy.list`.
 * Auth credentials (username/password) are shared across all proxies.
 *
 * On 429, the caller calls nextAgent() to get an HttpsProxyAgent for the next
 * proxy in the list. Failed proxies are tracked per-session and skipped.
 */

import { ProxyAgent } from 'undici';
import { getProxyConfig } from '../config.js';

export class ProxyManager {
  constructor() {
    this._index = 0;
    this._skipped = new Set(); // indices of proxies that returned 429
    this._config = null;
  }

  _loadConfig() {
    if (!this._config) {
      this._config = getProxyConfig();
    }
    return this._config;
  }

  get enabled() {
    const cfg = this._loadConfig();
    return !!(cfg?.enabled && cfg?.username && Array.isArray(cfg?.list) && cfg.list.length > 0);
  }

  get totalProxies() {
    const cfg = this._loadConfig();
    return Array.isArray(cfg?.list) ? cfg.list.length : 0;
  }

  /**
   * Get an HttpsProxyAgent for the next available proxy in the list.
   * Skips proxies that have already been marked as failed.
   * Returns null if no proxies are available.
   */
  nextAgent() {
    const cfg = this._loadConfig();
    if (!this.enabled) return null;

    const list = cfg.list;
    const { username, password } = cfg;

    // Try up to list.length times to find a non-skipped proxy
    for (let attempt = 0; attempt < list.length; attempt++) {
      const idx = this._index % list.length;
      this._index++;

      if (this._skipped.has(idx)) continue;

      const hostPort = list[idx];
      const auth = password ? `${username}:${password}` : username;
      const proxyUrl = `http://${auth}@${hostPort}`;

      return { agent: new ProxyAgent(proxyUrl), index: idx, hostPort };
    }

    // All proxies are exhausted/skipped
    return null;
  }

  /**
   * Mark a proxy index as failed (returned 429 or connection error).
   */
  markFailed(index) {
    this._skipped.add(index);
  }

  /**
   * Reset failed proxy tracking (e.g. at the start of a new scrape session).
   */
  reset() {
    this._index = 0;
    this._skipped.clear();
    this._config = null; // re-read config on next use
  }
}

// Shared singleton — one manager per process, state reset per scrape run
export const proxyManager = new ProxyManager();
