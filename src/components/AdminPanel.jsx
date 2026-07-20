import React, { useRef, useEffect } from 'react';
import { 
  RotateCw, 
  Layers, 
  Coins, 
  Database, 
  Activity, 
  Trash2, 
  Info, 
  Sparkles, 
  CheckCircle2, 
  ChevronUp, 
  ChevronDown, 
  Terminal, 
  X 
} from 'lucide-react';

export default function AdminPanel({
  config,
  savingSettings,
  handleSaveSettings,
  dbStats,
  handleResetDb,
  resettingDb,
  handleStartScrape,
  scraper,
  handleStartSanityCheck,
  sanityCheck,
  handleClearShop,
  singleScrapeUrl,
  setSingleScrapeUrl,
  handleSingleScrape,
  runningSingleScrape,
  singleScrapeError,
  singleScrapeResult,
  handleStartSeedfinderScrape,
  seedfinderScraper,
  isSeedfinderOpen,
  setIsSeedfinderOpen,
  handleStartBulkAi,
  bulkAi,
  handleStopBulkAi,
  isBulkAiOpen,
  setIsBulkAiOpen,
  sqlQuery,
  setSqlQuery,
  handleExecuteQuery,
  executingQuery,
  queryError,
  queryResult,
  dbStrains
}) {
  const seedfinderLogTerminalRef = useRef(null);
  const bulkAiLogTerminalRef = useRef(null);

  useEffect(() => {
    if (isSeedfinderOpen && seedfinderLogTerminalRef.current) {
      seedfinderLogTerminalRef.current.scrollTop = seedfinderLogTerminalRef.current.scrollHeight;
    }
  }, [seedfinderScraper.logs, isSeedfinderOpen]);

  useEffect(() => {
    if (isBulkAiOpen && bulkAiLogTerminalRef.current) {
      bulkAiLogTerminalRef.current.scrollTop = bulkAiLogTerminalRef.current.scrollHeight;
    }
  }, [bulkAi.logs, isBulkAiOpen]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
      <div className="space-y-8">
        
        {/* Scraper Settings Panel */}
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-emerald-400" />
            Scraper Configuration Settings
          </h2>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const limit = formData.get('maxItemsPerShop');
            const debugVal = formData.get('debug') === 'on';
            const geminiApiKeyVal = formData.get('geminiApiKey');
            const useLocalLlmVal = formData.get('useLocalLlm') === 'on';
            const localLlmUrlVal = formData.get('localLlmUrl');
            const localLlmModelVal = formData.get('localLlmModel');
            const blockedWordsVal = formData.get('blockedWords')
              ? formData.get('blockedWords').split('\n').map(w => w.trim()).filter(Boolean)
              : [];
            handleSaveSettings({
              maxItemsPerShop: limit === '' ? null : Number(limit),
              debug: debugVal,
              geminiApiKey: geminiApiKeyVal || null,
              useLocalLlm: useLocalLlmVal,
              localLlmUrl: localLlmUrlVal || null,
              localLlmModel: localLlmModelVal || null,
              blockedWords: blockedWordsVal
            });
          }} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Max Scraped Items Per Shop
              </label>
              <input
                type="number"
                name="maxItemsPerShop"
                defaultValue={config.maxItemsPerShop ?? ''}
                placeholder="Unlimited (scrape full catalog)"
                className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                Limit the number of listings fetched per store for debugging speed. Leaving this blank will crawl the entire catalog, which may take several minutes.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Blocked Words List
              </label>
              <textarea
                name="blockedWords"
                defaultValue={config.blockedWords ? config.blockedWords.join('\n') : ''}
                placeholder="Enter one word per line (e.g. bestseller, card)"
                rows={4}
                className="w-full p-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 text-sm font-mono resize-y"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                Strains/products containing any of these words in their name/title or description will be ignored and not inserted into the database. Enter each blocked word/phrase on a new line.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Gemini API Key
              </label>
              <input
                type="password"
                name="geminiApiKey"
                defaultValue={config.geminiApiKey ?? ''}
                placeholder="Enter your Gemini API Key..."
                className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                Used to generate creative and natural German prose descriptions using Google Gemini. Leave blank to use the local fallback engine.
              </p>
            </div>

            <div className="flex items-center justify-between bg-slate-950/60 p-4 border border-slate-900 rounded-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                  Enable Local LLM (LM Studio / Ollama)
                </label>
                <span className="text-[11px] text-slate-500 leading-normal">
                  Route prose description synthesis to a local server (e.g., LM Studio or Ollama).
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="useLocalLlm"
                  defaultChecked={config.useLocalLlm}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Local LLM API URL
              </label>
              <input
                type="text"
                name="localLlmUrl"
                defaultValue={config.localLlmUrl ?? 'http://localhost:1234/v1/chat/completions'}
                placeholder="e.g. http://localhost:1234/v1/chat/completions"
                className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                The endpoint URL of your local inference server. For LM Studio, use <code>http://localhost:1234/v1/chat/completions</code>. For Ollama, use <code>http://localhost:11434/v1/chat/completions</code>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Local LLM Model Name
              </label>
              <input
                type="text"
                name="localLlmModel"
                defaultValue={config.localLlmModel ?? 'local-model'}
                placeholder="e.g. llama3"
                className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                Model name identifier to pass in completions payload. (Optional for LM Studio if only one model is loaded).
              </p>
            </div>

            <div className="flex items-center justify-between bg-slate-950/60 p-4 border border-slate-900 rounded-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                  Enable Debug Mode
                </label>
                <span className="text-[11px] text-slate-500 leading-normal">
                  Exposes system statistics, file diagnostics, and backend overrides.
                </span>
              </div>
              <input
                type="checkbox"
                name="debug"
                defaultChecked={config.debug}
                className="w-5 h-5 accent-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center"
            >
              {savingSettings ? 'Saving settings...' : 'Save Settings Override'}
            </button>
          </form>
        </div>

        {/* Database Diagnostics Panel */}
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            Database Diagnostics
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl flex flex-col justify-between gap-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Strains Count</span>
              <span className="text-xl font-bold text-slate-200 font-mono">{dbStats.strainsCount}</span>
            </div>
            <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl flex flex-col justify-between gap-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Scraped Offers</span>
              <span className="text-xl font-bold text-slate-200 font-mono">{dbStats.offersCount}</span>
            </div>
            <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl flex flex-col justify-between gap-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">File Size</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">{dbStats.fileSize}</span>
            </div>
          </div>

          <div className="mb-6">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2.5 font-semibold">Currently Scraped Shops</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dbStats.shopStats && dbStats.shopStats.map(s => (
                <div key={s.shop} className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 flex flex-col justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-slate-200 truncate">{s.shop}</span>
                    <span className="block text-[9px] text-slate-500 mt-0.5 truncate">
                      {s.strainsCount} strains • {s.offersCount} offers
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleStartScrape(s.shop, 'price')}
                        disabled={scraper.isScanning || sanityCheck.isRunning}
                        title="Scrape Prices (Fast)"
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                          scraper.isScanning || sanityCheck.isRunning
                            ? 'bg-slate-950 text-slate-600 border-slate-950 cursor-not-allowed'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-300'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        Scrape Prices
                      </button>
                      <button
                        onClick={() => handleStartScrape(s.shop, 'metadata')}
                        disabled={scraper.isScanning || sanityCheck.isRunning}
                        title="Scrape Full Metadata (DOM Scan)"
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                          scraper.isScanning || sanityCheck.isRunning
                            ? 'bg-slate-950 text-slate-600 border-slate-950 cursor-not-allowed'
                            : 'bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20 hover:text-teal-300'
                        }`}
                      >
                        <Database className="w-3.5 h-3.5" />
                        Scrape Meta
                      </button>
                    </div>
                    <button
                      onClick={() => handleStartSanityCheck(s.shop)}
                      disabled={scraper.isScanning || sanityCheck.isRunning}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                        scraper.isScanning || sanityCheck.isRunning
                          ? 'bg-slate-950 text-slate-600 border-slate-950 cursor-not-allowed'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-300'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Test
                    </button>
                    <button
                      onClick={() => handleClearShop(s.shop)}
                      disabled={scraper.isScanning || sanityCheck.isRunning}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                        scraper.isScanning || sanityCheck.isRunning
                          ? 'bg-slate-950 text-slate-600 border-slate-950 cursor-not-allowed'
                          : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 hover:text-red-300'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Absolute DB Path</span>
            <span className="block text-[10px] font-mono text-slate-400 break-all leading-normal bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
              {dbStats.dbPath}
            </span>
          </div>

          <div className="border-t border-slate-900 pt-6 mt-6">
            <div className="mb-4 bg-red-500/5 border border-red-500/10 p-3 rounded-xl flex gap-2">
              <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="text-[10px] text-slate-400 leading-normal">
                Database reset deletes all strains and offers. You will need to trigger a new scrape run to repopulate data.
              </span>
            </div>
            <button
              onClick={handleResetDb}
              disabled={resettingDb}
              className="w-full h-11 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-xs transition-all flex items-center justify-center"
            >
              {resettingDb ? 'Resetting database...' : 'Wipe & Clean Database'}
            </button>
          </div>

        </div>

      </div>

      {/* Single Product Scraper Card */}
      <div className="glass-panel rounded-2xl p-6 mt-8">
        <h2 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          On-Demand Single Page Scraper
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Paste a specific product URL from <strong>Dutch Passion</strong>, <strong>Sensi Seeds</strong>, <strong>Gas Station LU</strong>, <strong>Gas Station Co. Seeds</strong>, <strong>Zamnesia</strong>, <strong>Hans Brainfood</strong>, or <strong>House of Seeds</strong> to scrape and upsert that strain and its price offers into the database instantly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="url"
            value={singleScrapeUrl}
            onChange={(e) => setSingleScrapeUrl(e.target.value)}
            placeholder="e.g., https://www.zamnesia.de/3269-zamnesia-seeds-amnesia-haze-feminisiert.html"
            className="flex-1 h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 text-sm"
          />
          <button
            onClick={handleSingleScrape}
            disabled={runningSingleScrape}
            className="px-6 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-1.5 shrink-0"
          >
            {runningSingleScrape ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Scraping URL...
              </>
            ) : (
              'Scrape Product'
            )}
          </button>
        </div>

        {/* Error Message */}
        {singleScrapeError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold mt-4">
            Error: {singleScrapeError}
          </div>
        )}

        {/* Success Results */}
        {singleScrapeResult && (
          <div className="bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl p-4 text-xs mt-4 flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-200">Successfully scraped and saved!</p>
              <p className="text-slate-400 mt-1 leading-normal">
                Parsed <span className="text-emerald-400 font-semibold">{singleScrapeResult.name}</span> by <span className="text-emerald-400 font-semibold">{singleScrapeResult.breeder || 'Unknown'}</span> from <span className="text-slate-300 font-semibold">{singleScrapeResult.shop}</span>. Exposing <span className="text-emerald-400 font-semibold">{singleScrapeResult.offersCreated} pricing offers</span>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Seedfinder.eu Scraper Card */}
      <div className="glass-panel rounded-2xl p-6 mt-8">
        <h2 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          Seedfinder.eu Metadata Enrichment
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Enrich existing strains with metadata from <strong>seedfinder.eu</strong> including strain type, flowering time, THC/CBD, yield, and more. Only fills in missing fields - won't overwrite existing data.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleStartSeedfinderScrape}
            disabled={seedfinderScraper.isScanning || scraper.isScanning}
            className={`px-6 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              seedfinderScraper.isScanning || scraper.isScanning
                ? 'bg-slate-950 text-slate-600 border border-slate-950 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/10'
            }`}
          >
            {seedfinderScraper.isScanning ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Start Enrichment
              </>
            )}
          </button>
          <button
            onClick={() => setIsSeedfinderOpen(!isSeedfinderOpen)}
            className="px-4 h-12 rounded-xl bg-slate-950 border border-slate-900 text-slate-400 text-xs font-semibold hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5"
          >
            {isSeedfinderOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isSeedfinderOpen ? 'Hide' : 'Show'} Logs
          </button>
        </div>

        {/* Status Info */}
        <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-slate-500">
          <span>Processed: <span className="text-slate-300 font-semibold">{seedfinderScraper.productsScraped}</span></span>
          {seedfinderScraper.currentProduct && (
            <span>Current: <span className="text-emerald-400 font-semibold">{seedfinderScraper.currentProduct}</span></span>
          )}
          {seedfinderScraper.startTime && !seedfinderScraper.endTime && (
            <span className="text-emerald-400">Running...</span>
          )}
          {seedfinderScraper.endTime && (
            <span>Finished: <span className="text-slate-300 font-semibold">{new Date(seedfinderScraper.endTime).toLocaleTimeString()}</span></span>
          )}
        </div>

        {/* Log Terminal */}
        {isSeedfinderOpen && (
          <div className="mt-4 bg-slate-950 border border-slate-900 rounded-xl p-4 h-64 overflow-y-auto font-mono text-[11px] leading-relaxed" ref={seedfinderLogTerminalRef}>
            {seedfinderScraper.logs.length === 0 ? (
              <span className="text-slate-600">No logs yet...</span>
            ) : (
              seedfinderScraper.logs.map((log, i) => (
                <div key={i} className={`mb-1 ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-emerald-400' :
                  log.type === 'warning' ? 'text-amber-400' :
                  'text-slate-400'
                }`}>
                  <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                  <span className="font-semibold">[{log.type.toUpperCase()}]</span>{' '}
                  {log.message}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bulk AI Description Generator Card */}
      <div className="glass-panel rounded-2xl p-6 mt-8">
        <h2 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          Bulk AI Description Generator
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Synthesize natural German prose descriptions using the configured AI engine (Gemini API or local inference server) for all strains in the database.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleStartBulkAi}
              disabled={bulkAi.isScanning || scraper.isScanning || seedfinderScraper.isScanning}
              className={`px-6 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${
                bulkAi.isScanning || scraper.isScanning || seedfinderScraper.isScanning
                  ? 'bg-slate-950 text-slate-600 border border-slate-950 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/10'
              }`}
            >
              {bulkAi.isScanning ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Generating Descriptions...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Start Bulk Generation
                </>
              )}
            </button>
            {bulkAi.isScanning && (
              <button
                onClick={handleStopBulkAi}
                className="px-6 h-12 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-sm transition-all flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>
          <button
            onClick={() => setIsBulkAiOpen(!isBulkAiOpen)}
            className="px-4 h-12 rounded-xl bg-slate-950 border border-slate-900 text-slate-400 text-xs font-semibold hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            {isBulkAiOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isBulkAiOpen ? 'Hide' : 'Show'} Logs
          </button>
        </div>

        {/* Progress Bar & Status */}
        {bulkAi.totalStrains > 0 && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span>Generation Progress</span>
              <span>{bulkAi.processedStrains} / {bulkAi.totalStrains} Strains ({Math.round((bulkAi.processedStrains / bulkAi.totalStrains) * 100)}%)</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-900">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(bulkAi.processedStrains / bulkAi.totalStrains) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-slate-500">
          <span>Total in Queue: <span className="text-slate-300 font-semibold">{bulkAi.totalStrains}</span></span>
          <span>Processed: <span className="text-slate-300 font-semibold">{bulkAi.processedStrains}</span></span>
          {bulkAi.currentStrain && (
            <span>Current Strain: <span className="text-emerald-400 font-semibold">{bulkAi.currentStrain}</span></span>
          )}
          {bulkAi.isScanning && (
            <span className="text-emerald-400 animate-pulse">Processing...</span>
          )}
          {bulkAi.endTime && (
            <span>Finished: <span className="text-slate-300 font-semibold">{new Date(bulkAi.endTime).toLocaleTimeString()}</span></span>
          )}
        </div>

        {/* Log Terminal */}
        {isBulkAiOpen && (
          <div className="mt-4 bg-slate-950 border border-slate-900 rounded-xl p-4 h-64 overflow-y-auto font-mono text-[11px] leading-relaxed" ref={bulkAiLogTerminalRef}>
            {bulkAi.logs.length === 0 ? (
              <span className="text-slate-600">No logs yet...</span>
            ) : (
              bulkAi.logs.map((log, i) => (
                <div key={i} className={`mb-1 ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-emerald-400' :
                  log.type === 'warning' ? 'text-amber-400' :
                  'text-slate-400'
                }`}>
                  <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                  <span className="font-semibold">[{log.type.toUpperCase()}]</span>{' '}
                  {log.message}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* SQL Playground Panel */}
      <div className="glass-panel rounded-2xl p-6 mt-8">
        <h2 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          SQL Database Playground
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Execute raw SQL queries directly on the SQLite database. Select a pre-built template from the dropdown to load it into the editor.
        </p>

        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          <div className="flex-1">
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full h-32 p-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500/50"
              placeholder="SELECT * FROM strains LIMIT 10;"
            />
          </div>

          <div className="w-full lg:w-72 flex flex-col gap-3 justify-between">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Quick Templates
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setSqlQuery(e.target.value);
                  }
                }}
                defaultValue=""
                className="w-full h-11 px-3 bg-slate-950 border border-slate-900 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-emerald-500/50"
              >
                <option value="" disabled>Select a query template...</option>
                <option value="SELECT name FROM sqlite_master WHERE type='table';">Show Database Tables</option>
                <option value="PRAGMA table_info(strains);">Inspect Strains Schema</option>
                <option value="PRAGMA table_info(scraped_offers);">Inspect Scraped Offers Schema</option>
                <option value="SELECT breeder, COUNT(*) AS count FROM strains GROUP BY breeder ORDER BY count DESC;">Strains Count by Breeder</option>
                <option value="SELECT shop, COUNT(DISTINCT strain_id) AS strains_count, COUNT(*) AS offers_count, ROUND(AVG(price), 2) AS avg_price FROM scraped_offers GROUP BY shop;">Shop Summary Statistics</option>
                <option value="SELECT s.name, s.breeder, o.shop, o.seeds, MIN(o.price) AS min_price FROM strains s JOIN scraped_offers o ON s.id = o.strain_id GROUP BY s.id ORDER BY min_price ASC LIMIT 15;">Cheapest Strains Overall</option>
                <option value="SELECT s.name, o.shop, o.seeds, o.price, o.url FROM strains s JOIN scraped_offers o ON s.id = o.strain_id WHERE s.name LIKE '%amnesia%' ORDER BY o.price ASC;">Find Amnesia Strains & Offers</option>
                <option value="SELECT LOWER(s.name) AS name, GROUP_CONCAT(DISTINCT s.breeder) AS breeders, MIN(CASE WHEN o.shop = 'Zamnesia' THEN o.price END) AS zamn_min_price, MIN(CASE WHEN o.shop = 'House of Seeds' THEN o.price END) AS hos_min_price FROM strains s JOIN scraped_offers o ON s.id = o.strain_id GROUP BY LOWER(s.name) HAVING SUM(CASE WHEN o.shop = 'Zamnesia' THEN 1 ELSE 0 END) > 0 AND SUM(CASE WHEN o.shop = 'House of Seeds' THEN 1 ELSE 0 END) > 0 ORDER BY name ASC;">Strains Available at Both Shops</option>
              </select>
            </div>

            <button
              onClick={handleExecuteQuery}
              disabled={executingQuery}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-1.5"
            >
              {executingQuery ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Terminal className="w-4 h-4" />
                  Execute SQL Query
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {queryError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold font-mono whitespace-pre-wrap">
            Error: {queryError}
          </div>
        )}

        {/* Query Results View */}
        {queryResult && (
          <div className="mt-6 border-t border-slate-900 pt-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Query Results ({queryResult.type === 'select' ? `${queryResult.rows.length} rows returned` : 'Statement executed successfully'})
            </h3>

            {queryResult.type === 'select' && queryResult.rows.length > 0 && (
              <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-900 bg-slate-950/40">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-900">
                      {Object.keys(queryResult.rows[0]).map((key) => (
                        <th key={key} className="p-3 font-semibold text-slate-400 border-r border-slate-900 last:border-r-0">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {queryResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/20">
                        {Object.values(row).map((val, cIdx) => (
                          <td key={cIdx} className="p-3 text-slate-300 border-r border-slate-900 last:border-r-0 font-mono break-all max-w-[200px]">
                            {val === null ? <span className="text-slate-600 font-sans italic">null</span> : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {queryResult.type === 'select' && queryResult.rows.length === 0 && (
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-center text-xs text-slate-500">
                Empty set. No rows returned.
              </div>
            )}

            {queryResult.type === 'write' && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl p-4 text-xs font-mono">
                <p className="font-semibold">Query Status: Success</p>
                <pre className="mt-2 text-[10px] text-slate-400">
                  {JSON.stringify(queryResult.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Database Strains Explorer Card */}
      <div className="glass-panel rounded-2xl p-6 mt-8">
        <h2 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          Tracked Seed Entries ({dbStrains.length})
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          All raw cannabis strains and breeders currently stored in the SQLite database.
        </p>

        {dbStrains.length === 0 ? (
          <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 text-center text-xs text-slate-500">
            No seed entries tracked in the database.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-900 bg-slate-950/40">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-semibold">
                  <th className="p-3">ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Breeder</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Seed Type</th>
                  <th className="p-3 text-right">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {dbStrains.map(s => (
                  <tr key={s.id} className="hover:bg-slate-900/20 text-slate-300">
                    <td className="p-3 font-mono text-[10px] text-slate-500 break-all max-w-[80px]">
                      {s.id}
                    </td>
                    <td className="p-3 font-bold text-slate-200">{s.name}</td>
                    <td className="p-3 text-emerald-400 font-medium">{s.breeder || 'Unknown'}</td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        s.type === 'autoflower' 
                          ? 'bg-purple-500/10 text-purple-400' 
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {s.type === 'autoflower' ? 'Auto' : 'Photo'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {s.seedType === 'feminized' ? 'Fem' : 'Reg'}
                    </td>
                    <td className="p-3 text-right text-[10px] text-slate-500 font-mono">
                      {s.createdAt ? new Date(s.createdAt).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </main>
  );
}
