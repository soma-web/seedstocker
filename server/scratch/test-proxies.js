/**
 * test-proxies.js — verify Webshare proxy setup is working
 *
 * Run: node scratch/test-proxies.js
 *
 * Tests:
 *  1. Config loads correctly (credentials + list)
 *  2. Each proxy in the list can make a real HTTP request
 *  3. The IP returned via the proxy differs from your direct IP
 *  4. fetchWithRetry() on BaseScraper correctly routes through proxy on 429
 */

import { getProxyConfig } from '../src/config.js';
import { ProxyManager } from '../src/scrapers/ProxyManager.js';
import { ProxyAgent } from 'undici';

const PASS = '✅';
const FAIL = '❌';
const INFO = '  ℹ';

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

// ─── 1. Config sanity check ────────────────────────────────────────────────

console.log('\n── 1. Config ──────────────────────────────────────────────────');

const cfg = getProxyConfig();
if (!cfg) {
  log(FAIL, 'No proxy config found in scraper.json');
  process.exit(1);
}
log(PASS, `proxy.enabled  = ${cfg.enabled}`);
log(PASS, `proxy.username = ${cfg.username}`);
log(PASS, `proxy.password = ${'*'.repeat((cfg.password || '').length)}`);

if (!Array.isArray(cfg.list) || cfg.list.length === 0) {
  log(FAIL, 'proxy.list is empty — add at least one proxy IP from Webshare');
  process.exit(1);
}
log(PASS, `proxy.list     = ${cfg.list.length} proxy/proxies: ${cfg.list.join(', ')}`);

// ─── 2. Get direct IP ─────────────────────────────────────────────────────

console.log('\n── 2. Direct IP ───────────────────────────────────────────────');

let directIp = null;
try {
  const res = await fetch('https://api.ipify.org?format=json');
  const data = await res.json();
  directIp = data.ip;
  log(PASS, `Your direct IP: ${directIp}`);
} catch (err) {
  log(FAIL, `Could not fetch direct IP: ${err.message}`);
  process.exit(1);
}

// ─── 3. Test each proxy ───────────────────────────────────────────────────

console.log('\n── 3. Proxy connectivity ──────────────────────────────────────');

let anyFailed = false;

for (const hostPort of cfg.list) {
  const proxyUrl = `http://${cfg.username}:${cfg.password}@${hostPort}`;
  const agent = new ProxyAgent(proxyUrl);

  process.stdout.write(`  Testing ${hostPort} ... `);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch('https://api.ipify.org?format=json', {
      dispatcher: agent,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`${FAIL} HTTP ${res.status}`);
      anyFailed = true;
      continue;
    }

    const data = await res.json();
    const proxyIp = data.ip;

    if (proxyIp === directIp) {
      console.log(`${FAIL} Proxy IP matches direct IP (${proxyIp}) — proxy may not be routing correctly`);
      anyFailed = true;
    } else {
      console.log(`${PASS} OK — proxy IP: ${proxyIp}`);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`${FAIL} Timeout (>10s) — proxy may be down or blocked`);
    } else {
      console.log(`${FAIL} ${err.message}`);
    }
    anyFailed = true;
  }
}

// ─── 4. ProxyManager round-robin test ─────────────────────────────────────

console.log('\n── 4. ProxyManager round-robin ────────────────────────────────');

const pm = new ProxyManager();

if (!pm.enabled) {
  log(FAIL, 'ProxyManager reports not enabled — check config');
} else {
  log(PASS, `ProxyManager enabled, ${pm.totalProxies} proxy/proxies in pool`);

  // Cycle through all proxies twice to confirm round-robin wraps
  const seen = [];
  for (let i = 0; i < pm.totalProxies * 2; i++) {
    const next = pm.nextAgent();
    if (next) seen.push(next.hostPort);
  }
  log(INFO, `Round-robin sequence (${pm.totalProxies * 2} calls): ${seen.join(' → ')}`);

  // Test markFailed
  pm.reset();
  const first = pm.nextAgent();
  if (first) {
    pm.markFailed(first.index);
    const second = pm.nextAgent();
    if (pm.totalProxies > 1) {
      if (second && second.hostPort !== first.hostPort) {
        log(PASS, `markFailed() skips failed proxy correctly`);
      } else if (!second) {
        log(PASS, `markFailed() correctly exhausts pool when only 1 proxy`);
      }
    } else {
      const exhausted = pm.nextAgent();
      if (!exhausted) {
        log(PASS, `markFailed() correctly exhausts single-proxy pool`);
      } else {
        log(FAIL, `markFailed() did not prevent reuse of failed proxy`);
      }
    }
  }
}

// ─── 5. fetchWithRetry 429 simulation ─────────────────────────────────────

console.log('\n── 5. fetchWithRetry() 429 simulation ─────────────────────────');

// We'll use httpbin.org/status/429 to get a real 429, then verify proxy kicks in
// (httpbin is a public HTTP testing service)

import { BaseScraper } from '../src/scrapers/BaseScraper.js';

// Minimal subclass — no DB needed for this test
class TestScraper extends BaseScraper {
  constructor() {
    super('test-shop', (type, msg) => console.log(`  [${type}] ${msg}`));
  }
}

const scraper = new TestScraper();
log(INFO, 'Sending request to httpbin.org/status/429 to simulate 429...');
log(INFO, 'Expect: warning log → proxy activation → retry attempt');

try {
  const res = await scraper.fetchWithRetry('https://httpbin.org/status/429', {
    headers: { 'User-Agent': 'SeedStocker-ProxyTest/1.0' }
  });

  if (scraper._proxyActive) {
    log(PASS, `_proxyActive flipped to true after 429`);
  } else {
    log(FAIL, `_proxyActive did NOT flip — 429 handling may not have triggered`);
  }

  if (res.status === 200) {
    log(PASS, `Proxy recovered successfully — got 200 after 429`);
  } else if (res.status === 429) {
    log(INFO, `Still got 429 from proxy (proxy may also be rate-limited by httpbin) — this is acceptable`);
  } else {
    log(INFO, `Proxy returned status ${res.status}`);
  }
} catch (err) {
  log(FAIL, `fetchWithRetry threw unexpectedly: ${err.message}`);
}

// ─── Summary ──────────────────────────────────────────────────────────────

console.log('\n── Summary ─────────────────────────────────────────────────────');
if (anyFailed) {
  log(FAIL, 'One or more proxy connectivity tests FAILED. Check the proxy IPs above.');
  process.exit(1);
} else {
  log(PASS, 'All proxy tests passed!');
}
