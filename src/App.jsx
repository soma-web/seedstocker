import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  Terminal,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import StrainDetailPage from './StrainDetailPage';

// Custom Hooks & API helpers
import { apiGet, apiPost } from './hooks/useApi';

// Subcomponents
import StrainFilters from './components/StrainFilters';
import StrainList from './components/StrainList';
import AdminPanel from './components/AdminPanel';
import ScraperPanel from './components/ScraperPanel';
import SeedfinderPanel from './components/SeedfinderPanel';
import BulkAiPanel from './components/BulkAiPanel';
import PriceHistoryModal from './components/PriceHistoryModal';
import SanityCheckPanel from './components/SanityCheckPanel';

export default function App() {
  const [strains, setStrains] = useState([]);
  const [breeders, setBreeders] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedBreeder, setSelectedBreeder] = useState('');
  const [selectedShop, setSelectedShop] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [config, setConfig] = useState({ maxItemsPerShop: 20, debug: false });
  const [dbStats, setDbStats] = useState({ strainsCount: 0, offersCount: 0, fileSize: '0.00 MB', dbPath: '', shopStats: [] });
  const [dbStrains, setDbStrains] = useState([]);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [savingSettings, setSavingSettings] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);
  const [seedTypeFilter, setSeedTypeFilter] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [minFloweringFilter, setMinFloweringFilter] = useState('');
  const [maxFloweringFilter, setMaxFloweringFilter] = useState('');
  const [selectedDescriptionShops, setSelectedDescriptionShops] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [generatingAiId, setGeneratingAiId] = useState(null);
  const [scrapeMode, setScrapeMode] = useState('price');
  const [selectedLetter, setSelectedLetter] = useState('');
  
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM strains LIMIT 10;');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [executingQuery, setExecutingQuery] = useState(false);

  const [singleScrapeUrl, setSingleScrapeUrl] = useState('');
  const [singleScrapeResult, setSingleScrapeResult] = useState(null);
  const [singleScrapeError, setSingleScrapeError] = useState(null);
  const [runningSingleScrape, setRunningSingleScrape] = useState(false);
  
  const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false);
  const [priceHistoryData, setPriceHistoryData] = useState([]);
  const [priceHistoryMeta, setPriceHistoryMeta] = useState({ name: '', breeder: '' });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedChartSize, setSelectedChartSize] = useState(3);
  
  const [scraper, setScraper] = useState({
    isScanning: false,
    startTime: null,
    endTime: null,
    currentShop: null,
    currentProduct: null,
    productsScraped: 0,
    logs: []
  });
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [sanityCheck, setSanityCheck] = useState({
    isOpen: false,
    isRunning: false,
    shop: null,
    progress: 0,
    total: 0,
    logs: [],
    results: null
  });
  const [seedfinderScraper, setSeedfinderScraper] = useState({
    isScanning: false,
    startTime: null,
    endTime: null,
    currentProduct: null,
    productsScraped: 0,
    logs: []
  });
  const [isSeedfinderOpen, setIsSeedfinderOpen] = useState(false);
  const [bulkAi, setBulkAi] = useState({
    isScanning: false,
    startTime: null,
    endTime: null,
    totalStrains: 0,
    processedStrains: 0,
    currentStrain: null,
    logs: []
  });
  const [isBulkAiOpen, setIsBulkAiOpen] = useState(false);
  const pollIntervalRef = useRef(null);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (selectedBreeder) q.set('breeder', selectedBreeder);
      if (typeFilter) q.set('type', typeFilter);
      if (seedTypeFilter) q.set('seedType', seedTypeFilter);

      const [strainsData, breedersData] = await Promise.all([
        apiGet(`/api/strains?${q.toString()}`),
        apiGet('/api/breeders')
      ]);

      setStrains(strainsData);
      setBreeders(breedersData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch scraper status
  const fetchScraperStatus = async () => {
    try {
      const data = await apiGet('/api/scrape/status');
      setScraper(data);
    } catch (err) {
      console.error('Error fetching scraper status:', err);
    }
  };

  const handleGenerateAiForStrain = async (strainId) => {
    setGeneratingAiId(strainId);
    try {
      await apiPost(`/api/strains/${strainId}/generate-ai-description`);
      await fetchData();
    } catch (err) {
      console.error('AI generation failed:', err);
    } finally {
      setGeneratingAiId(null);
    }
  };

  const fetchConfig = async () => {
    try {
      const data = await apiGet('/api/config');
      setConfig(data);
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const fetchDbStats = async () => {
    try {
      const [stats, strainsData] = await Promise.all([
        apiGet('/api/db/stats'),
        apiGet('/api/db/strains')
      ]);
      setDbStats(stats);
      setDbStrains(strainsData);
    } catch (err) {
      console.error('Error fetching db stats:', err);
    }
  };

  const fetchSeedfinderStatus = async () => {
    try {
      const data = await apiGet('/api/seedfinder-scrape/status');
      setSeedfinderScraper(data);
    } catch (err) {
      console.error('Error fetching seedfinder status:', err);
    }
  };

  const fetchBulkAiStatus = async () => {
    try {
      const data = await apiGet('/api/strains/generate-ai-descriptions/status');
      setBulkAi(data);
    } catch (err) {
      console.error('Error fetching bulk AI status:', err);
    }
  };

  // Load config and listen to route changes on mount
  useEffect(() => {
    fetchConfig();
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Load db stats when debug is enabled and path is /admin
  useEffect(() => {
    if (config.debug && currentPath === '/admin') {
      fetchDbStats();
    }
  }, [config.debug, currentPath]);

  // Effect to fetch initial strains and breeders
  useEffect(() => {
    fetchData();
  }, [search, selectedBreeder, typeFilter, seedTypeFilter]);

  // Effect to poll scraper status
  useEffect(() => {
    fetchScraperStatus();
    const interval = setInterval(() => {
      fetchScraperStatus();
      if (scraper.isScanning) {
        fetchData();
      }
    }, scraper.isScanning ? 1500 : 5000);
    return () => clearInterval(interval);
  }, [scraper.isScanning]);

  // Effect to poll seedfinder scraper status
  useEffect(() => {
    fetchSeedfinderStatus();
    const interval = setInterval(() => {
      fetchSeedfinderStatus();
      if (seedfinderScraper.isScanning) {
        fetchData();
      }
    }, seedfinderScraper.isScanning ? 1500 : 5000);
    return () => clearInterval(interval);
  }, [seedfinderScraper.isScanning]);

  // Effect to poll bulk AI status
  useEffect(() => {
    fetchBulkAiStatus();
    const interval = setInterval(() => {
      fetchBulkAiStatus();
      if (bulkAi.isScanning) {
        fetchData();
      }
    }, bulkAi.isScanning ? 1500 : 5000);
    return () => clearInterval(interval);
  }, [bulkAi.isScanning]);

  const handleStartScrape = async (shopName = null, modeOverride = null) => {
    try {
      await apiPost('/api/scrape', { shop: shopName, mode: modeOverride || scrapeMode });
      setScraper(prev => ({ ...prev, isScanning: true, logs: [] }));
      setIsScraperOpen(true);
    } catch (err) {
      alert(`Failed to trigger scraper: ${err.message}`);
    }
  };

  const handleStartSeedfinderScrape = async (shopName = '') => {
    console.log('Starting Seedfinder scrape for shop:', shopName);
    try {
      await apiPost('/api/seedfinder-scrape', { shop: shopName || null });
      setSeedfinderScraper(prev => ({ ...prev, isScanning: true, logs: [] }));
      setIsSeedfinderOpen(true);
    } catch (err) {
      alert(`Failed to trigger seedfinder scraper: ${err.message}`);
    }
  };

  const handleStartBulkAi = async () => {
    try {
      await apiPost('/api/strains/generate-ai-descriptions');
      setBulkAi(prev => ({ ...prev, isScanning: true, logs: [] }));
      setIsBulkAiOpen(true);
    } catch (err) {
      alert(`Failed to trigger bulk AI description generation: ${err.message}`);
    }
  };

  const handleStopBulkAi = async () => {
    try {
      await apiPost('/api/strains/generate-ai-descriptions/stop');
      alert('Stopping bulk AI description generation...');
    } catch (err) {
      alert(`Failed to stop bulk AI description generation: ${err.message}`);
    }
  };

  const handleSaveSettings = async (updatedConfig) => {
    setSavingSettings(true);
    try {
      const data = await apiPost('/api/config', updatedConfig);
      setConfig(data);
      if (!data.debug) {
        navigateTo('/');
      }
      alert('Settings saved successfully!');
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetDb = async () => {
    if (!window.confirm('WARNING: Are you sure you want to delete all strains and offers? This action is permanent.')) {
      return;
    }
    setResettingDb(true);
    try {
      await apiPost('/api/db/reset');
      alert('Database cleared and vacuumed successfully.');
      fetchDbStats();
      fetchData();
    } catch (err) {
      alert(`Failed to reset database: ${err.message}`);
    } finally {
      setResettingDb(false);
    }
  };

  const handleClearShop = async (shopName) => {
    if (!window.confirm(`Are you sure you want to delete all entries and offers tracked for "${shopName}"?`)) {
      return;
    }
    try {
      await apiPost('/api/db/clear-shop', { shop: shopName });
      alert(`Successfully cleared all entries for ${shopName}.`);
      fetchDbStats();
      fetchData();
    } catch (err) {
      alert(`Failed to clear shop: ${err.message}`);
    }
  };

  const pollSanityCheck = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await apiGet('/api/scrape/sanity-check/status');
        setSanityCheck(prev => ({
          ...prev,
          isRunning: data.isRunning,
          progress: data.progress,
          total: data.total,
          logs: data.logs,
          results: data.results
        }));
        if (!data.isRunning) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          fetchData();
        }
      } catch (err) {
        console.error('Error polling sanity check status:', err);
      }
    }, 1000);
  };

  const handleStartSanityCheck = async (shopName) => {
    try {
      setSanityCheck({
        isOpen: true,
        isRunning: true,
        shop: shopName,
        progress: 0,
        total: 50,
        logs: [`[${new Date().toLocaleTimeString()}] Triggering sanity check for ${shopName}...`],
        results: null
      });

      await apiPost('/api/scrape/sanity-check', { shop: shopName });
      pollSanityCheck();
    } catch (err) {
      setSanityCheck(prev => ({
        ...prev,
        isRunning: false,
        logs: [...prev.logs, `[ERROR] Failed to start: ${err.message}`]
      }));
    }
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleOpenPriceHistory = async (strainId, name, breeder) => {
    setPriceHistoryMeta({ name, breeder });
    setIsPriceHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const data = await apiGet(`/api/strains/${strainId}/price-history`);
      setPriceHistoryData(data);
      const sizes = Array.from(new Set(data.map(item => item.seeds))).sort((a, b) => Number(a) - Number(b));
      if (sizes.length > 0) {
        setSelectedChartSize(Number(sizes[0]));
      }
    } catch (err) {
      console.error('Failed fetching price history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExecuteQuery = async () => {
    if (!sqlQuery.trim()) return;
    setExecutingQuery(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const data = await apiPost('/api/db/query', { query: sqlQuery });
      setQueryResult(data);
      if (data.type === 'write') {
        fetchDbStats();
        fetchData();
      }
    } catch (err) {
      setQueryError(err.message);
    } finally {
      setExecutingQuery(false);
    }
  };

  const handleSingleScrape = async () => {
    if (!singleScrapeUrl.trim()) return;
    setRunningSingleScrape(true);
    setSingleScrapeError(null);
    setSingleScrapeResult(null);
    try {
      const data = await apiPost('/api/scrape/single', { url: singleScrapeUrl });
      setSingleScrapeResult(data);
      fetchDbStats();
      fetchData();
      setSingleScrapeUrl('');
    } catch (err) {
      setSingleScrapeError(err.message);
    } finally {
      setRunningSingleScrape(false);
    }
  };

  const groupStrainsByName = (strainsList) => {
    const groupedMap = new Map();
    for (const s of strainsList) {
      const key = s.name.toLowerCase().trim();
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          id: s.id,
          name: s.name,
          breedersList: new Set([s.breeder]),
          type: s.type,
          seedType: s.seedType,
          thc: s.thc,
          cbd: s.cbd,
          strainType: s.strainType,
          offers: [...s.offers]
        });
      } else {
        const existing = groupedMap.get(key);
        if (s.breeder) {
          existing.breedersList.add(s.breeder);
        }
        existing.offers.push(...s.offers);
      }
    }

    return Array.from(groupedMap.values()).map(g => ({
      ...g,
      breeder: Array.from(g.breedersList).filter(Boolean).join(', ')
    }));
  };

  const filteredStrainsWithFlowering = strains.filter(strain => {
    if (selectedLetter) {
      const firstChar = strain.name.trim().charAt(0).toUpperCase();
      if (selectedLetter === '#') {
        if (/[A-Z]/i.test(firstChar)) return false;
      } else {
        if (firstChar !== selectedLetter) return false;
      }
    }
    if (minFloweringFilter) {
      const minVal = parseInt(minFloweringFilter, 10);
      if (!isNaN(minVal)) {
        if (strain.floweringMin === null || strain.floweringMin === undefined || strain.floweringMin < minVal) {
          return false;
        }
      }
    }
    if (maxFloweringFilter) {
      const maxVal = parseInt(maxFloweringFilter, 10);
      if (!isNaN(maxVal)) {
        if (strain.floweringMax === null || strain.floweringMax === undefined || strain.floweringMax > maxVal) {
          return false;
        }
      }
    }
    return true;
  });

  const groupedStrains = groupStrainsByName(
    filteredStrainsWithFlowering
      .map(strain => {
        let filteredOffers = strain.offers;
        if (selectedShop) {
          filteredOffers = filteredOffers.filter(o => o.shop === selectedShop);
        }
        if (onlyAvailable) {
          filteredOffers = filteredOffers.filter(o => o.availability === 'available' || o.availability === 'orderable');
        }
        return { ...strain, offers: filteredOffers };
      })
      .filter(strain => strain.offers.length > 0)
  );

  const filteredDescriptionStrains = filteredStrainsWithFlowering;

  // ── Strain detail page routing ──
  const strainDetailMatch = currentPath.match(/^\/strain\/(.+)$/);
  if (strainDetailMatch) {
    return (
      <StrainDetailPage
        strainId={decodeURIComponent(strainDetailMatch[1])}
        onBack={() => navigateTo('/')}
        onNavigate={(path) => navigateTo(path)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20 selection:bg-emerald-500/30 selection:text-emerald-400">
      
      {/* Navbar Banner */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                SeedStocker
              </h1>
              <p className="text-xs text-slate-500">Cannabis Seed Price Comparison Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsScraperOpen(!isScraperOpen)}
              className={`flex items-center gap-2 px-4 h-11 rounded-xl text-sm font-medium border transition-all ${
                scraper.isScanning 
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 animate-pulse'
                  : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-900'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span className="hidden sm:inline">Scraper System</span>
              {scraper.isScanning ? (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              ) : (
                isScraperOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <select
              value={scrapeMode}
              onChange={e => setScrapeMode(e.target.value)}
              disabled={scraper.isScanning}
              className="h-11 px-3 bg-slate-950 border border-slate-900 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm font-medium"
            >
              <option value="price">Price Scan (Fast)</option>
              <option value="metadata">Metadata Scan (DOM)</option>
            </select>

            <button
              onClick={() => handleStartScrape()}
              disabled={scraper.isScanning}
              className={`flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-semibold shadow-lg transition-all ${
                scraper.isScanning
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/10'
              }`}
            >
              <RotateCw className={`w-4 h-4 ${scraper.isScanning ? 'animate-spin' : ''}`} />
              <span>Scan Stores</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-900 bg-slate-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-2">
          <button
            onClick={() => navigateTo('/')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentPath === '/'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            Catalog Comparison
          </button>
          <button
            onClick={() => navigateTo('/descriptions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentPath === '/descriptions'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            Plant Descriptions
          </button>
          <button
            onClick={() => navigateTo('/rewritten-descriptions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentPath === '/rewritten-descriptions'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            Rewritten Prose
          </button>
          {config.debug && (
            <button
              onClick={() => navigateTo('/admin')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                currentPath === '/admin'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              System Administration
            </button>
          )}
        </div>
      </div>

      {/* Main Catalog / Descriptions View */}
      {(currentPath === '/' || currentPath === '/descriptions' || currentPath === '/rewritten-descriptions') && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          
          <StrainFilters
            search={search}
            setSearch={setSearch}
            selectedBreeder={selectedBreeder}
            setSelectedBreeder={setSelectedBreeder}
            selectedShop={selectedShop}
            setSelectedShop={setSelectedShop}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            seedTypeFilter={seedTypeFilter}
            setSeedTypeFilter={setSeedTypeFilter}
            onlyAvailable={onlyAvailable}
            setOnlyAvailable={setOnlyAvailable}
            minFloweringFilter={minFloweringFilter}
            setMinFloweringFilter={setMinFloweringFilter}
            maxFloweringFilter={maxFloweringFilter}
            setMaxFloweringFilter={setMaxFloweringFilter}
            selectedLetter={selectedLetter}
            setSelectedLetter={setSelectedLetter}
            breeders={breeders}
          />

          <StrainList
            key={`${search}-${selectedBreeder}-${selectedShop}-${typeFilter}-${seedTypeFilter}-${onlyAvailable}-${minFloweringFilter}-${maxFloweringFilter}-${selectedLetter}`}
            currentPath={currentPath}
            groupedStrains={groupedStrains}
            filteredDescriptionStrains={filteredDescriptionStrains}
            loading={loading}
            selectedDescriptionShops={selectedDescriptionShops}
            setSelectedDescriptionShops={setSelectedDescriptionShops}
            copiedId={copiedId}
            setCopiedId={setCopiedId}
            generatingAiId={generatingAiId}
            handleGenerateAiForStrain={handleGenerateAiForStrain}
            onOpenPriceHistory={handleOpenPriceHistory}
            onNavigate={navigateTo}
          />

        </main>
      )}

      {/* Admin Panel View */}
      {currentPath === '/admin' && (
        <AdminPanel
          config={config}
          savingSettings={savingSettings}
          handleSaveSettings={handleSaveSettings}
          dbStats={dbStats}
          handleResetDb={handleResetDb}
          resettingDb={resettingDb}
          handleStartScrape={handleStartScrape}
          scraper={scraper}
          handleStartSanityCheck={handleStartSanityCheck}
          sanityCheck={sanityCheck}
          handleClearShop={handleClearShop}
          singleScrapeUrl={singleScrapeUrl}
          setSingleScrapeUrl={setSingleScrapeUrl}
          handleSingleScrape={handleSingleScrape}
          runningSingleScrape={runningSingleScrape}
          singleScrapeError={singleScrapeError}
          singleScrapeResult={singleScrapeResult}
          handleStartSeedfinderScrape={handleStartSeedfinderScrape}
          seedfinderScraper={seedfinderScraper}
          isSeedfinderOpen={isSeedfinderOpen}
          setIsSeedfinderOpen={setIsSeedfinderOpen}
          handleStartBulkAi={handleStartBulkAi}
          bulkAi={bulkAi}
          handleStopBulkAi={handleStopBulkAi}
          isBulkAiOpen={isBulkAiOpen}
          setIsBulkAiOpen={setIsBulkAiOpen}
          sqlQuery={sqlQuery}
          setSqlQuery={setSqlQuery}
          handleExecuteQuery={handleExecuteQuery}
          executingQuery={executingQuery}
          queryError={queryError}
          queryResult={queryResult}
          dbStrains={dbStrains}
        />
      )}

      {/* Global Scraper Logs Panel Modal */}
      <ScraperPanel
        isOpen={isScraperOpen}
        onClose={() => setIsScraperOpen(false)}
        scraper={scraper}
      />

      {/* Seedfinder Scraper enrichment Logs Modal */}
      <SeedfinderPanel
        isOpen={isSeedfinderOpen}
        onClose={() => setIsSeedfinderOpen(false)}
        seedfinderScraper={seedfinderScraper}
      />

      {/* Bulk AI Description Logs Modal */}
      <BulkAiPanel
        isOpen={isBulkAiOpen}
        onClose={() => setIsBulkAiOpen(false)}
        bulkAi={bulkAi}
        onStop={handleStopBulkAi}
      />

      {/* Price History timeline modal */}
      <PriceHistoryModal
        isOpen={isPriceHistoryOpen}
        onClose={() => setIsPriceHistoryOpen(false)}
        priceHistoryMeta={priceHistoryMeta}
        loadingHistory={loadingHistory}
        priceHistoryData={priceHistoryData}
        selectedChartSize={selectedChartSize}
        setSelectedChartSize={setSelectedChartSize}
      />

      {/* Sanity Check sample validation modal */}
      <SanityCheckPanel
        isOpen={sanityCheck.isOpen}
        onClose={() => {
          setSanityCheck(prev => ({ ...prev, isOpen: false }));
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }}
        sanityCheck={sanityCheck}
      />

    </div>
  );
}
