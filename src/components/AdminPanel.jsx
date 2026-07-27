import React, { useRef, useEffect, useState } from 'react';
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
  X,
  Check,
  Zap
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../hooks/useApi';

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
  dbStrains,
  onOpenNewEntries
}) {
  const [enrichShop, setEnrichShop] = useState('');
  const [aiLimit, setAiLimit] = useState('');
  const [thcLimit, setThcLimit] = useState('15');
  const [missingThcCount, setMissingThcCount] = useState(0);
  const [missingAiDescCount, setMissingAiDescCount] = useState(0);
  const [thcProposals, setThcProposals] = useState([]);
  const [loadingThc, setLoadingThc] = useState(false);
  const [thcError, setThcError] = useState(null);

  const [cbdLimit, setCbdLimit] = useState('15');
  const [missingCbdCount, setMissingCbdCount] = useState(0);
  const [cbdProposals, setCbdProposals] = useState([]);
  const [loadingCbd, setLoadingCbd] = useState(false);
  const [cbdError, setCbdError] = useState(null);

  const [strainTypeLimit, setStrainTypeLimit] = useState('15');
  const [missingStrainTypeCount, setMissingStrainTypeCount] = useState(0);
  const [strainTypeProposals, setStrainTypeProposals] = useState([]);
  const [loadingStrainType, setLoadingStrainType] = useState(false);
  const [strainTypeError, setStrainTypeError] = useState(null);

  const [floweringLimit, setFloweringLimit] = useState('15');
  const [missingFloweringCount, setMissingFloweringCount] = useState(0);
  const [floweringProposals, setFloweringProposals] = useState([]);
  const [loadingFlowering, setLoadingFlowering] = useState(false);
  const [populatingFloweringText, setPopulatingFloweringText] = useState(false);
  const [floweringError, setFloweringError] = useState(null);

  useEffect(() => {
    apiGet('/api/strains/missing-thc')
      .then(res => setMissingThcCount(res.count))
      .catch(() => {});

    apiGet('/api/strains/missing-cbd')
      .then(res => setMissingCbdCount(res.count))
      .catch(() => {});

    apiGet('/api/strains/missing-strain-type')
      .then(res => setMissingStrainTypeCount(res.count))
      .catch(() => {});

    apiGet('/api/strains/missing-flowering-time')
      .then(res => setMissingFloweringCount(res.count))
      .catch(() => {});

    apiGet('/api/strains/missing-ai-description')
      .then(res => setMissingAiDescCount(res.count))
      .catch(() => {});
  }, [dbStrains, bulkAi.processedStrains]);

  const handleFetchThcEstimates = async () => {
    setLoadingThc(true);
    setThcError(null);
    try {
      const res = await apiPost('/api/strains/estimate-thc/bulk', { limit: Number(thcLimit) || 15 });
      if (res.proposals && res.proposals.length > 0) {
        setThcProposals(res.proposals.map(p => ({ ...p, status: 'pending' })));
      } else {
        alert('No THC proposals returned by AI. All strains might already have THC values or the AI could not find data.');
      }
    } catch (err) {
      setThcError(err.message);
    } finally {
      setLoadingThc(false);
    }
  };

  const handleAcceptThc = async (proposalIndex) => {
    const prop = thcProposals[proposalIndex];
    if (!prop || !prop.proposedThc) return;

    setThcProposals(prev => prev.map((p, idx) => idx === proposalIndex ? { ...p, status: 'saving' } : p));
    try {
      await apiPut(`/api/strains/${prop.strainId}`, { thc: prop.proposedThc });
      setThcProposals(prev => prev.filter((_, idx) => idx !== proposalIndex));
      setMissingThcCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      alert(`Failed to save THC for ${prop.name}: ${err.message}`);
      setThcProposals(prev => prev.map((p, idx) => idx === proposalIndex ? { ...p, status: 'pending' } : p));
    }
  };

  const handleRejectThc = (proposalIndex) => {
    setThcProposals(prev => prev.filter((_, idx) => idx !== proposalIndex));
  };

  const handleAcceptAllHighConfidence = async () => {
    const highConfIndices = thcProposals
      .map((p, idx) => (p.confidence === 'high' && p.status === 'pending' ? idx : null))
      .filter(idx => idx !== null);

    if (highConfIndices.length === 0) {
      alert('No high-confidence pending proposals found in the queue.');
      return;
    }

    for (const idx of highConfIndices) {
      await handleAcceptThc(idx);
    }
  };

  const handleAcceptAll = async () => {
    // Collect snapshot of proposals to accept
    const currentQueue = [...thcProposals];
    for (let i = 0; i < currentQueue.length; i++) {
      const prop = currentQueue[i];
      if (prop && prop.proposedThc) {
        try {
          await apiPut(`/api/strains/${prop.strainId}`, { thc: prop.proposedThc });
          setMissingThcCount(prev => Math.max(0, prev - 1));
        } catch (err) {
          console.error(`Failed to save THC for ${prop.name}:`, err);
        }
      }
    }
    setThcProposals([]);
  };

  const handleFetchCbdEstimates = async () => {
    setLoadingCbd(true);
    setCbdError(null);
    try {
      const res = await apiPost('/api/strains/estimate-cbd/bulk', { limit: Number(cbdLimit) || 15 });
      if (res.proposals && res.proposals.length > 0) {
        setCbdProposals(res.proposals.map(p => ({ ...p, status: 'pending' })));
      } else {
        alert('No CBD proposals returned by AI. All matching strains might already have CBD values or no matching strains found.');
      }
    } catch (err) {
      setCbdError(err.message || 'Failed to fetch CBD estimates');
    } finally {
      setLoadingCbd(false);
    }
  };

  const handleAcceptCbd = async (proposalIndex) => {
    const prop = cbdProposals[proposalIndex];
    if (!prop || !prop.proposedCbd) return;

    setCbdProposals(prev => prev.map((p, idx) => idx === proposalIndex ? { ...p, status: 'saving' } : p));
    try {
      await apiPut(`/api/strains/${prop.strainId}`, { cbd: prop.proposedCbd });
      setCbdProposals(prev => prev.filter((_, idx) => idx !== proposalIndex));
      setMissingCbdCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      alert(`Failed to save CBD for ${prop.name}: ${err.message}`);
      setCbdProposals(prev => prev.map((p, idx) => idx === proposalIndex ? { ...p, status: 'pending' } : p));
    }
  };

  const handleRejectCbd = (proposalIndex) => {
    setCbdProposals(prev => prev.filter((_, idx) => idx !== proposalIndex));
  };

  const handleAcceptAllCbdHighConfidence = async () => {
    const highConfIndices = cbdProposals
      .map((p, idx) => (p.confidence === 'high' && p.status === 'pending' ? idx : null))
      .filter(idx => idx !== null);

    if (highConfIndices.length === 0) {
      alert('No high-confidence pending proposals found in the queue.');
      return;
    }

    for (const idx of highConfIndices) {
      await handleAcceptCbd(idx);
    }
  };

  const handleAcceptAllCbd = async () => {
    const currentQueue = [...cbdProposals];
    for (let i = 0; i < currentQueue.length; i++) {
      const prop = currentQueue[i];
      if (prop && prop.proposedCbd) {
        try {
          await apiPut(`/api/strains/${prop.strainId}`, { cbd: prop.proposedCbd });
          setMissingCbdCount(prev => Math.max(0, prev - 1));
        } catch (err) {
          console.error(`Failed to save CBD for ${prop.name}:`, err);
        }
      }
    }
    setCbdProposals([]);
  };

  const handleFetchStrainTypeEstimates = async () => {
    setLoadingStrainType(true);
    setStrainTypeError(null);
    try {
      const res = await apiPost('/api/strains/estimate-strain-type/bulk', { limit: Number(strainTypeLimit) || 15 });
      if (res.proposals && res.proposals.length > 0) {
        setStrainTypeProposals(res.proposals.map(p => ({ ...p, status: 'pending' })));
      } else {
        alert('No strain type proposals returned by AI. All strains might already have strain type values or no matching strains found.');
      }
    } catch (err) {
      setStrainTypeError(err.message || 'Failed to fetch strain type estimates');
    } finally {
      setLoadingStrainType(false);
    }
  };

  const handleAcceptStrainType = async (proposalIndex) => {
    const prop = strainTypeProposals[proposalIndex];
    if (!prop || !prop.proposedStrainType) return;

    setStrainTypeProposals(prev => prev.map((p, idx) => idx === proposalIndex ? { ...p, status: 'saving' } : p));
    try {
      await apiPut(`/api/strains/${prop.strainId}`, { strainType: prop.proposedStrainType });
      setStrainTypeProposals(prev => prev.filter((_, idx) => idx !== proposalIndex));
      setMissingStrainTypeCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      alert(`Failed to save strain type for ${prop.name}: ${err.message}`);
      setStrainTypeProposals(prev => prev.map((p, idx) => idx === proposalIndex ? { ...p, status: 'pending' } : p));
    }
  };

  const handleRejectStrainType = (proposalIndex) => {
    setStrainTypeProposals(prev => prev.filter((_, idx) => idx !== proposalIndex));
  };

  const handleAcceptAllStrainTypeHighConfidence = async () => {
    const highConfIndices = strainTypeProposals
      .map((p, idx) => (p.confidence === 'high' && p.status === 'pending' ? idx : null))
      .filter(idx => idx !== null);

    if (highConfIndices.length === 0) {
      alert('No high-confidence pending proposals found in the queue.');
      return;
    }

    for (const idx of highConfIndices) {
      await handleAcceptStrainType(idx);
    }
  };

  const handleAcceptAllStrainType = async () => {
    const currentQueue = [...strainTypeProposals];
    for (let i = 0; i < currentQueue.length; i++) {
      const prop = currentQueue[i];
      if (prop && prop.proposedStrainType) {
        try {
          await apiPut(`/api/strains/${prop.strainId}`, { strainType: prop.proposedStrainType });
          setMissingStrainTypeCount(prev => Math.max(0, prev - 1));
        } catch (err) {
          console.error(`Failed to save strain type for ${prop.name}:`, err);
        }
      }
    }
    setStrainTypeProposals([]);
  };

  const handlePopulateFloweringFromText = async () => {
    setPopulatingFloweringText(true);
    try {
      const res = await apiPost('/api/strains/populate-flowering-from-text', {});
      alert(`Successfully auto-filled min/max flowering weeks for ${res.updatedCount} strains from existing text strings!`);
      apiGet('/api/strains/missing-flowering-time')
        .then(r => setMissingFloweringCount(r.count))
        .catch(() => {});
    } catch (err) {
      alert(`Failed to populate flowering times: ${err.message}`);
    } finally {
      setPopulatingFloweringText(false);
    }
  };

  const handleFetchFloweringEstimates = async () => {
    setLoadingFlowering(true);
    setFloweringError(null);
    try {
      const res = await apiPost('/api/strains/estimate-flowering-time/bulk', { limit: Number(floweringLimit) || 15 });
      if (res.proposals && res.proposals.length > 0) {
        setFloweringProposals(res.proposals.map(p => ({ ...p, status: 'pending' })));
      } else {
        alert('No flowering time proposals returned by AI. All strains might already have min/max values or no data found.');
      }
    } catch (err) {
      setFloweringError(err.message || 'Failed to fetch flowering time estimates');
    } finally {
      setLoadingFlowering(false);
    }
  };

  const handleAcceptFlowering = async (proposalIndex) => {
    const prop = floweringProposals[proposalIndex];
    if (!prop || (prop.proposedMin === null && prop.proposedMax === null)) return;

    setFloweringProposals(prev => prev.map((p, idx) => idx === proposalIndex ? { ...p, status: 'saving' } : p));
    try {
      await apiPut(`/api/strains/${prop.strainId}`, {
        floweringMin: Number(prop.proposedMin),
        floweringMax: Number(prop.proposedMax),
        floweringTime: prop.proposedTime || `${prop.proposedMin}-${prop.proposedMax} Wochen`
      });
      setFloweringProposals(prev => prev.filter((_, idx) => idx !== proposalIndex));
      setMissingFloweringCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      alert(`Failed to save flowering time for ${prop.name}: ${err.message}`);
      setFloweringProposals(prev => prev.map((p, idx) => idx === proposalIndex ? { ...p, status: 'pending' } : p));
    }
  };

  const handleRejectFlowering = (proposalIndex) => {
    setFloweringProposals(prev => prev.filter((_, idx) => idx !== proposalIndex));
  };

  const handleAcceptAllFloweringHighConfidence = async () => {
    const highConfIndices = floweringProposals
      .map((p, idx) => (p.confidence === 'high' && p.status === 'pending' ? idx : null))
      .filter(idx => idx !== null);

    if (highConfIndices.length === 0) {
      alert('No high-confidence pending proposals found in the queue.');
      return;
    }

    for (const idx of highConfIndices) {
      await handleAcceptFlowering(idx);
    }
  };

  const handleAcceptAllFlowering = async () => {
    const currentQueue = [...floweringProposals];
    for (let i = 0; i < currentQueue.length; i++) {
      const prop = currentQueue[i];
      if (prop && (prop.proposedMin !== null || prop.proposedMax !== null)) {
        try {
          await apiPut(`/api/strains/${prop.strainId}`, {
            floweringMin: Number(prop.proposedMin),
            floweringMax: Number(prop.proposedMax),
            floweringTime: prop.proposedTime || `${prop.proposedMin}-${prop.proposedMax} Wochen`
          });
          setMissingFloweringCount(prev => Math.max(0, prev - 1));
        } catch (err) {
          console.error(`Failed to save flowering time for ${prop.name}:`, err);
        }
      }
    }
    setFloweringProposals([]);
  };

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
        
        {/* Discovery Staging Shield Panel */}
        <div className="glass-panel rounded-2xl p-6 border border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-slate-950/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
                <Database className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Neue Shop-Einträge & Scrape-Prüfung (Staging)
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                    Protected Mode
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Isolierte Erkennung neuer Strains aus Online-Shops. Prüfe, verknüpfe oder importiere Funde manuell, ohne die produktive Datenbank zu gefährden.
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenNewEntries && onOpenNewEntries()}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Staging & Import Panel öffnen
            </button>
          </div>
        </div>

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
            const useChatGptVal = formData.get('useChatGpt') === 'on';
            const chatgptApiKeyVal = formData.get('chatgptApiKey');
            const chatgptModelVal = formData.get('chatgptModel');
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
              useChatGpt: useChatGptVal,
              chatgptApiKey: chatgptApiKeyVal || null,
              chatgptModel: chatgptModelVal || null,
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

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                ChatGPT API Key
              </label>
              <input
                type="password"
                name="chatgptApiKey"
                defaultValue={config.chatgptApiKey ?? ''}
                placeholder="Enter your ChatGPT API Key..."
                className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                Used to generate creative and natural German prose descriptions using OpenAI ChatGPT. Leave blank to use Gemini or local fallback engine.
              </p>
            </div>

            <div className="flex items-center justify-between bg-slate-950/60 p-4 border border-slate-900 rounded-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                  Enable ChatGPT
                </label>
                <span className="text-[11px] text-slate-500 leading-normal">
                  Route prose description synthesis to OpenAI ChatGPT.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="useChatGpt"
                  defaultChecked={config.useChatGpt}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                ChatGPT Model Name
              </label>
              <input
                type="text"
                name="chatgptModel"
                defaultValue={config.chatgptModel ?? 'gpt-4o-mini'}
                placeholder="e.g. gpt-4o-mini"
                className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                Model name identifier to pass in completions payload (e.g. <code>gpt-4o-mini</code> or <code>gpt-4o</code>).
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
                        title="Scrape Prices (Full Crawl)"
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
                        onClick={() => handleStartScrape(s.shop, 'price_quick')}
                        disabled={scraper.isScanning || sanityCheck.isRunning}
                        title="Scrape Prices from Stored URLs (Quick Update)"
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                          scraper.isScanning || sanityCheck.isRunning
                            ? 'bg-slate-950 text-slate-600 border-slate-950 cursor-not-allowed'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-300'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Quick Prices
                      </button>
                    </div>
                    <div className="flex gap-1.5">
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
                      <button
                        onClick={() => handleStartSanityCheck(s.shop)}
                        disabled={scraper.isScanning || sanityCheck.isRunning}
                        title="Run Sanity Check Test"
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                          scraper.isScanning || sanityCheck.isRunning
                            ? 'bg-slate-950 text-slate-600 border-slate-950 cursor-not-allowed'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20 hover:text-indigo-300'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" />
                        Test
                      </button>
                    </div>
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
          Paste a specific product URL from <strong>Dutch Passion</strong>, <strong>Sensi Seeds</strong>, <strong>Gas Station LU</strong>, <strong>Gas Station Co. Seeds</strong>, <strong>Zamnesia</strong>, <strong>Hans Brainfood</strong>, <strong>House of Seeds</strong>, or <strong>Barney's Farm</strong> to scrape and upsert that strain and its price offers into the database instantly.
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

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-full sm:w-64">
            <select
              value={enrichShop}
              onChange={e => setEnrichShop(e.target.value)}
              disabled={seedfinderScraper.isScanning}
              className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm font-medium"
            >
              <option value="">All Shops</option>
              <option value="Zamnesia">Zamnesia</option>
              <option value="House of Seeds">House of Seeds</option>
              <option value="Hans Brainfood">Hans Brainfood</option>
              <option value="Gas Station Co. Seeds">Gas Station Co. Seeds</option>
              <option value="Gas Station LU">Gas Station LU</option>
              <option value="Sensi Seeds">Sensi Seeds</option>
              <option value="Dutch Passion">Dutch Passion</option>
              <option value="Barney's Farm">Barney's Farm</option>
              <option value="Cannapot">Cannapot</option>
            </select>
          </div>
          <button
            onClick={() => handleStartSeedfinderScrape(enrichShop)}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Bulk AI Description Generator
          </h2>
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold self-start sm:self-auto">
            {missingAiDescCount} Strains Missing AI Description
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Synthesize natural German prose descriptions using the configured AI engine (Gemini API or local inference server) for all strains in the database.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-full sm:w-48">
            <input
              type="number"
              min="1"
              value={aiLimit}
              onChange={e => setAiLimit(e.target.value)}
              disabled={bulkAi.isScanning}
              placeholder="Limit (optional)"
              className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-emerald-500/50 text-sm font-medium"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto flex-1">
            <button
              onClick={() => handleStartBulkAi(aiLimit)}
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

      {/* AI THC Content Filler & Review Card */}
      <div className="glass-panel rounded-2xl p-6 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            AI THC Content Filler & Review
          </h2>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-semibold self-start sm:self-auto">
            {missingThcCount} Strains Missing THC
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Query the active LLM (ChatGPT / Gemini / Local LLM) to research and estimate missing THC percentages for strains based on breeder and strain name context. Review, edit, and accept proposals before saving them to the database.
        </p>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Fehlende THC-Angaben</span>
              <span className="text-2xl font-bold text-amber-400 font-mono mt-0.5 block">{missingThcCount} Strains</span>
            </div>
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Gesamt Strains</span>
              <span className="text-2xl font-bold text-slate-200 font-mono mt-0.5 block">{dbStats.strainsCount || dbStrains.length || 0}</span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">THC Datenabdeckung</span>
              <span className="text-2xl font-bold text-emerald-400 font-mono mt-0.5 block">
                {(dbStats.strainsCount || dbStrains.length) ? (
                  Math.max(0, Math.round((((dbStats.strainsCount || dbStrains.length) - missingThcCount) / (dbStats.strainsCount || dbStrains.length)) * 100)) + '%'
                ) : '100%'}
              </span>
            </div>
            <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
          <div className="w-full sm:w-48">
            <input
              type="number"
              min="1"
              max="50"
              value={thcLimit}
              onChange={e => setThcLimit(e.target.value)}
              disabled={loadingThc}
              placeholder="Batch Size (e.g. 15)"
              className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 text-sm font-medium"
            />
          </div>
          <button
            onClick={handleFetchThcEstimates}
            disabled={loadingThc || missingThcCount === 0}
            className={`px-6 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${
              loadingThc || missingThcCount === 0
                ? 'bg-slate-950 text-slate-600 border border-slate-950 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/10'
            }`}
          >
            {loadingThc ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Querying AI for THC...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Estimate Missing THC with AI
              </>
            )}
          </button>
        </div>

        {thcError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold mb-6">
            Error: {thcError}
          </div>
        )}

        {/* Proposals Queue */}
        {thcProposals.length > 0 && (
          <div className="space-y-4 border-t border-slate-900 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Pending AI Proposals ({thcProposals.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptAll}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept All ({thcProposals.filter(p => p.status === 'pending' && p.proposedThc).length})
                </button>
                <button
                  onClick={handleAcceptAllHighConfidence}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  High Confidence Only
                </button>
                <button
                  onClick={() => setThcProposals([])}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-semibold transition-all"
                >
                  Clear Queue
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-950/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-semibold">
                    <th className="p-3">Strain & Breeder</th>
                    <th className="p-3">AI Proposed THC (Editable)</th>
                    <th className="p-3">Confidence & Model</th>
                    <th className="p-3">AI Reasoning</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {thcProposals.map((prop, idx) => (
                    <tr key={prop.strainId} className="hover:bg-slate-900/20 text-slate-300">
                      <td className="p-3 font-medium">
                        <div className="font-bold text-slate-100">{prop.name}</div>
                        <div className="text-[10px] text-emerald-400">{prop.breeder || 'Unknown Breeder'}</div>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={prop.proposedThc || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setThcProposals(prev => prev.map((p, i) => i === idx ? { ...p, proposedThc: val } : p));
                          }}
                          placeholder="e.g. 22%"
                          className="w-28 h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-bold text-xs focus:outline-none focus:border-emerald-500/50"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            prop.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            prop.confidence === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {prop.confidence}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{prop.modelUsed}</span>
                        </div>
                      </td>
                      <td className="p-3 text-[11px] text-slate-400 max-w-[250px] leading-relaxed">
                        {prop.reasoning}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleAcceptThc(idx)}
                            disabled={prop.status === 'saving'}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-bold text-xs transition-all flex items-center gap-1"
                          >
                            {prop.status === 'saving' ? (
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectThc(idx)}
                            disabled={prop.status === 'saving'}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* AI CBD Content Filler & Review Card */}
      <div className="glass-panel rounded-2xl p-6 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-teal-400" />
            AI CBD Content Filler & Review (CBD / 1:1 / 1:2 / 2:1 Strains)
          </h2>
          <span className="px-3 py-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full text-xs font-semibold self-start sm:self-auto">
            {missingCbdCount} Strains Missing CBD
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Query the active LLM (ChatGPT / Gemini / Local LLM) to research and estimate missing CBD percentages or ratios (e.g. 10%, 1:1) for strains containing <strong>CBD</strong>, <strong>1:1</strong>, <strong>1:2</strong>, or <strong>2:1</strong> in their name. Review, edit, and accept proposals before saving them to the database.
        </p>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Fehlende CBD-Angaben (Filtered)</span>
              <span className="text-2xl font-bold text-teal-400 font-mono mt-0.5 block">{missingCbdCount} Strains</span>
            </div>
            <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Gesamt Strains in DB</span>
              <span className="text-2xl font-bold text-slate-200 font-mono mt-0.5 block">{dbStats.strainsCount || dbStrains.length || 0}</span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
          <div className="w-full sm:w-48">
            <input
              type="number"
              min="1"
              max="100"
              value={cbdLimit}
              onChange={e => setCbdLimit(e.target.value)}
              disabled={loadingCbd}
              placeholder="Batch size limit"
              className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500/50 text-sm font-medium"
            />
          </div>
          <button
            onClick={handleFetchCbdEstimates}
            disabled={loadingCbd || bulkAi.isScanning || scraper.isScanning}
            className={`px-6 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto ${
              loadingCbd || bulkAi.isScanning || scraper.isScanning
                ? 'bg-slate-950 text-slate-600 border border-slate-950 cursor-not-allowed'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 shadow-lg shadow-teal-500/10'
            }`}
          >
            {loadingCbd ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Querying AI for CBD...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Estimate Missing CBD with AI
              </>
            )}
          </button>
        </div>

        {cbdError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold mb-6">
            Error: {cbdError}
          </div>
        )}

        {/* Proposals Queue */}
        {cbdProposals.length > 0 && (
          <div className="space-y-4 border-t border-slate-900 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Pending AI CBD Proposals ({cbdProposals.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptAllCbd}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept All ({cbdProposals.filter(p => p.status === 'pending' && p.proposedCbd).length})
                </button>
                <button
                  onClick={handleAcceptAllCbdHighConfidence}
                  className="px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  High Confidence Only
                </button>
                <button
                  onClick={() => setCbdProposals([])}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-semibold transition-all"
                >
                  Clear Queue
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-950/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-semibold">
                    <th className="p-3">Strain & Breeder</th>
                    <th className="p-3">AI Proposed CBD (Editable)</th>
                    <th className="p-3">Confidence & Model</th>
                    <th className="p-3">AI Reasoning</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {cbdProposals.map((prop, idx) => (
                    <tr key={prop.strainId || idx} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{prop.name}</div>
                        <div className="text-[10px] text-slate-500">{prop.breeder || 'Unknown Breeder'}</div>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={prop.proposedCbd}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCbdProposals(prev => prev.map((p, i) => i === idx ? { ...p, proposedCbd: val } : p));
                          }}
                          className="w-32 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-teal-400 font-mono text-xs focus:outline-none focus:border-teal-500/50"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              prop.confidence === 'high'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : prop.confidence === 'medium'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {prop.confidence}
                          </span>
                          {prop.modelUsed && (
                            <span className="text-[10px] text-slate-500 font-mono">{prop.modelUsed}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs truncate" title={prop.reasoning}>
                        {prop.reasoning}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleAcceptCbd(idx)}
                            disabled={prop.status === 'saving'}
                            className="px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 text-xs font-semibold transition-all flex items-center gap-1"
                          >
                            {prop.status === 'saving' ? (
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectCbd(idx)}
                            disabled={prop.status === 'saving'}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* AI Strain Type Content Filler & Review Card */}
      <div className="glass-panel rounded-2xl p-6 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-400" />
            AI Strain Type Content Filler & Review
          </h2>
          <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold self-start sm:self-auto">
            {missingStrainTypeCount} Strains Missing Strain Type
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Query the active LLM (ChatGPT / Gemini / Local LLM) to research and estimate missing strain types / genetics classifications (e.g. Indica Dominant, 60% Sativa / 40% Indica, Hybrid) for all strains lacking genetics data. Review, edit, and accept proposals before saving them to the database.
        </p>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Fehlende Strain Type Angaben</span>
              <span className="text-2xl font-bold text-indigo-400 font-mono mt-0.5 block">{missingStrainTypeCount} Strains</span>
            </div>
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Gesamt Strains in DB</span>
              <span className="text-2xl font-bold text-slate-200 font-mono mt-0.5 block">{dbStats.strainsCount || dbStrains.length || 0}</span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
          <div className="w-full sm:w-48">
            <input
              type="number"
              min="1"
              max="100"
              value={strainTypeLimit}
              onChange={e => setStrainTypeLimit(e.target.value)}
              disabled={loadingStrainType}
              placeholder="Batch size limit"
              className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500/50 text-sm font-medium"
            />
          </div>
          <button
            onClick={handleFetchStrainTypeEstimates}
            disabled={loadingStrainType || bulkAi.isScanning || scraper.isScanning}
            className={`px-6 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto ${
              loadingStrainType || bulkAi.isScanning || scraper.isScanning
                ? 'bg-slate-950 text-slate-600 border border-slate-950 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 to-teal-500 hover:from-indigo-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-indigo-500/10'
            }`}
          >
            {loadingStrainType ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Querying AI for Strain Type...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Estimate Missing Strain Type with AI
              </>
            )}
          </button>
        </div>

        {strainTypeError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold mb-6">
            Error: {strainTypeError}
          </div>
        )}

        {/* Proposals Queue */}
        {strainTypeProposals.length > 0 && (
          <div className="space-y-4 border-t border-slate-900 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Pending AI Strain Type Proposals ({strainTypeProposals.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptAllStrainType}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept All ({strainTypeProposals.filter(p => p.status === 'pending' && p.proposedStrainType).length})
                </button>
                <button
                  onClick={handleAcceptAllStrainTypeHighConfidence}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  High Confidence Only
                </button>
                <button
                  onClick={() => setStrainTypeProposals([])}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-semibold transition-all"
                >
                  Clear Queue
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-950/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-semibold">
                    <th className="p-3">Strain & Breeder</th>
                    <th className="p-3">AI Proposed Strain Type (Editable)</th>
                    <th className="p-3">Confidence & Model</th>
                    <th className="p-3">AI Reasoning</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {strainTypeProposals.map((prop, idx) => (
                    <tr key={prop.strainId || idx} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{prop.name}</div>
                        <div className="text-[10px] text-slate-500">{prop.breeder || 'Unknown Breeder'}</div>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={prop.proposedStrainType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStrainTypeProposals(prev => prev.map((p, i) => i === idx ? { ...p, proposedStrainType: val } : p));
                          }}
                          className="w-48 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-indigo-400 font-mono text-xs focus:outline-none focus:border-indigo-500/50"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              prop.confidence === 'high'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : prop.confidence === 'medium'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {prop.confidence}
                          </span>
                          {prop.modelUsed && (
                            <span className="text-[10px] text-slate-500 font-mono">{prop.modelUsed}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs truncate" title={prop.reasoning}>
                        {prop.reasoning}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleAcceptStrainType(idx)}
                            disabled={prop.status === 'saving'}
                            className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 text-xs font-semibold transition-all flex items-center gap-1"
                          >
                            {prop.status === 'saving' ? (
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectStrainType(idx)}
                            disabled={prop.status === 'saving'}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* AI Flowering Weeks Content Filler & Review Card */}
      <div className="glass-panel rounded-2xl p-6 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            AI Flowering Weeks Content Filler & Review
          </h2>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-semibold self-start sm:self-auto">
            {missingFloweringCount} Strains Missing Min/Max Weeks
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Parse existing flowering time text strings into numerical <strong>min/max weeks</strong> or query the active LLM (ChatGPT / Gemini / Local LLM) to research and estimate missing flowering weeks for all strains.
        </p>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Fehlende Min/Max Wochen</span>
              <span className="text-2xl font-bold text-amber-400 font-mono mt-0.5 block">{missingFloweringCount} Strains</span>
            </div>
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex items-center justify-between">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Gesamt Strains in DB</span>
              <span className="text-2xl font-bold text-slate-200 font-mono mt-0.5 block">{dbStats.strainsCount || dbStrains.length || 0}</span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
          <button
            onClick={handlePopulateFloweringFromText}
            disabled={populatingFloweringText || loadingFlowering}
            className="px-5 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0"
          >
            {populatingFloweringText ? (
              <RotateCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
            )}
            Auto-Fill Min/Max from Existing Text Strings
          </button>

          <div className="w-full sm:w-48">
            <input
              type="number"
              min="1"
              max="100"
              value={floweringLimit}
              onChange={e => setFloweringLimit(e.target.value)}
              disabled={loadingFlowering}
              placeholder="Batch size limit"
              className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-amber-500/50 text-sm font-medium"
            />
          </div>
          <button
            onClick={handleFetchFloweringEstimates}
            disabled={loadingFlowering || bulkAi.isScanning || scraper.isScanning}
            className={`px-6 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto ${
              loadingFlowering || bulkAi.isScanning || scraper.isScanning
                ? 'bg-slate-950 text-slate-600 border border-slate-950 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 shadow-lg shadow-amber-500/10'
            }`}
          >
            {loadingFlowering ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Querying AI for Flowering Weeks...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Estimate Missing Flowering Weeks with AI
              </>
            )}
          </button>
        </div>

        {floweringError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold mb-6">
            Error: {floweringError}
          </div>
        )}

        {/* Proposals Queue */}
        {floweringProposals.length > 0 && (
          <div className="space-y-4 border-t border-slate-900 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Pending AI Flowering Weeks Proposals ({floweringProposals.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptAllFlowering}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept All ({floweringProposals.filter(p => p.status === 'pending' && (p.proposedMin !== null || p.proposedMax !== null)).length})
                </button>
                <button
                  onClick={handleAcceptAllFloweringHighConfidence}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  High Confidence Only
                </button>
                <button
                  onClick={() => setFloweringProposals([])}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs font-semibold transition-all"
                >
                  Clear Queue
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-950/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-semibold">
                    <th className="p-3">Strain & Breeder</th>
                    <th className="p-3">Min Weeks</th>
                    <th className="p-3">Max Weeks</th>
                    <th className="p-3">Confidence & Model</th>
                    <th className="p-3">AI Reasoning</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {floweringProposals.map((prop, idx) => (
                    <tr key={prop.strainId || idx} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{prop.name}</div>
                        <div className="text-[10px] text-slate-500">{prop.breeder || 'Unknown Breeder'} {prop.currentFloweringTime ? `(${prop.currentFloweringTime})` : ''}</div>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={prop.proposedMin ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFloweringProposals(prev => prev.map((p, i) => i === idx ? { ...p, proposedMin: val === '' ? null : Number(val) } : p));
                          }}
                          className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-amber-400 font-mono text-xs focus:outline-none focus:border-amber-500/50"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={prop.proposedMax ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFloweringProposals(prev => prev.map((p, i) => i === idx ? { ...p, proposedMax: val === '' ? null : Number(val) } : p));
                          }}
                          className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-amber-400 font-mono text-xs focus:outline-none focus:border-amber-500/50"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              prop.confidence === 'high'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : prop.confidence === 'medium'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {prop.confidence}
                          </span>
                          {prop.modelUsed && (
                            <span className="text-[10px] text-slate-500 font-mono">{prop.modelUsed}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs truncate" title={prop.reasoning}>
                        {prop.reasoning}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleAcceptFlowering(idx)}
                            disabled={prop.status === 'saving'}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-semibold transition-all flex items-center gap-1"
                          >
                            {prop.status === 'saving' ? (
                              <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectFlowering(idx)}
                            disabled={prop.status === 'saving'}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 text-xs transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

    </main>
  );
}
