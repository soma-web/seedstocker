import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  RotateCw,
  Terminal,
  ExternalLink,
  Sparkles,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  Flame,
  CheckCircle2,
  TrendingDown,
  X,
  Database,
  Trash2,
  Activity,
  Coins
} from 'lucide-react';
import StrainDetailPage from './StrainDetailPage';

const API_BASE_URL = 'http://localhost:3002';

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
  const logTerminalRef = useRef(null);

  const [sanityCheck, setSanityCheck] = useState({
    isOpen: false,
    isRunning: false,
    shop: null,
    progress: 0,
    total: 0,
    logs: [],
    results: null
  });
  const pollIntervalRef = useRef(null);
  const sanityCheckLogsRef = useRef(null);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (selectedBreeder) q.set('breeder', selectedBreeder);
      if (typeFilter) q.set('type', typeFilter);
      if (seedTypeFilter) q.set('seedType', seedTypeFilter);

      const [strainsRes, breedersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/strains?${q.toString()}`),
        fetch(`${API_BASE_URL}/api/breeders`)
      ]);

      if (strainsRes.ok) {
        const data = await strainsRes.json();
        setStrains(data);
      }
      if (breedersRes.ok) {
        const data = await breedersRes.json();
        setBreeders(data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch scraper status
  const fetchScraperStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/scrape/status`);
      if (res.ok) {
        const data = await res.json();
        setScraper(data);
      }
    } catch (err) {
      console.error('Error fetching scraper status:', err);
    }
  };
  const handleGenerateAiForStrain = async (strainId) => {
    setGeneratingAiId(strainId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/strains/${strainId}/generate-ai-description`, {
        method: 'POST'
      });
      if (res.ok) {
        // Refresh the full strains list to reflect the new AI description
        await fetchData();
      }
    } catch (err) {
      console.error('AI generation failed:', err);
    } finally {
      setGeneratingAiId(null);
    }
  };


  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const fetchDbStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/db/stats`);
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
      }
      const resStrains = await fetch(`${API_BASE_URL}/api/db/strains`);
      if (resStrains.ok) {
        const dataStrains = await resStrains.json();
        setDbStrains(dataStrains);
      }
    } catch (err) {
      console.error('Error fetching db stats:', err);
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
    
    // Poll more frequently if scraper is scanning
    const interval = setInterval(() => {
      fetchScraperStatus();
      if (scraper.isScanning) {
        // Also refresh strain listing in the background to show live scraped strains
        fetchData();
      }
    }, scraper.isScanning ? 1500 : 5000);

    return () => clearInterval(interval);
  }, [scraper.isScanning]);

  // Auto-scroll scraper console logs to bottom
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [scraper.logs]);

  const handleStartScrape = async (shopName = null, modeOverride = null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: shopName, mode: modeOverride || scrapeMode })
      });
      if (res.ok) {
        setScraper(prev => ({ ...prev, isScanning: true, logs: [] }));
        setIsScraperOpen(true);
      }
    } catch (err) {
      alert(`Failed to trigger scraper: ${err.message}`);
    }
  };

  const handleSaveSettings = async (updatedConfig) => {
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (!data.debug) {
          navigateTo('/');
        }
        alert('Settings saved successfully!');
      }
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
      const res = await fetch(`${API_BASE_URL}/api/db/reset`, { method: 'POST' });
      if (res.ok) {
        alert('Database cleared and vacuumed successfully.');
        fetchDbStats();
        fetchData();
      }
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
      const res = await fetch(`${API_BASE_URL}/api/db/clear-shop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: shopName })
      });
      if (res.ok) {
        alert(`Successfully cleared all entries for ${shopName}.`);
        fetchDbStats();
        fetchData();
      }
    } catch (err) {
      alert(`Failed to clear shop: ${err.message}`);
    }
  };

  const pollSanityCheck = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/scrape/sanity-check/status`);
        if (res.ok) {
          const data = await res.json();
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

      const res = await fetch(`${API_BASE_URL}/api/scrape/sanity-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: shopName })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server error starting sanity check');
      }

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

  useEffect(() => {
    if (sanityCheckLogsRef.current) {
      sanityCheckLogsRef.current.scrollTop = sanityCheckLogsRef.current.scrollHeight;
    }
  }, [sanityCheck.logs]);

  const getPercent = (stat) => {
    if (!stat) return 0;
    const total = stat.success + stat.fail;
    if (total === 0) return 0;
    return Math.round((stat.success / total) * 100);
  };

  const renderStat = (label, stat, isCritical = true) => {
    const percent = getPercent(stat);
    const total = stat.success + stat.fail;
    const isHealthy = percent === 100;
    
    let colorClass = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10';
    if (!isHealthy) {
      if (isCritical) {
        colorClass = 'text-red-400 bg-red-500/5 border-red-500/10';
      } else {
        colorClass = 'text-amber-400 bg-amber-500/5 border-amber-500/10';
      }
    }

    return (
      <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${colorClass}`}>
        <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 leading-normal">{label}</span>
        <div className="flex items-baseline justify-between mt-1 gap-1">
          <span className="text-base font-bold font-mono">{percent}%</span>
          <span className="text-[9px] font-medium text-slate-500">{stat.success}/{total}</span>
        </div>
      </div>
    );
  };

  const handleOpenPriceHistory = async (strainId, name, breeder) => {
    setPriceHistoryMeta({ name, breeder });
    setIsPriceHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/strains/${strainId}/price-history`);
      if (res.ok) {
        const data = await res.json();
        setPriceHistoryData(data);
        const sizes = Array.from(new Set(data.map(item => item.seeds))).sort((a, b) => Number(a) - Number(b));
        if (sizes.length > 0) {
          setSelectedChartSize(Number(sizes[0]));
        }
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
      const res = await fetch(`${API_BASE_URL}/api/db/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sqlQuery })
      });
      const data = await res.json();
      if (res.ok) {
        setQueryResult(data);
        if (data.type === 'write') {
          fetchDbStats();
          fetchData();
        }
      } else {
        setQueryError(data.error || 'Failed to execute query.');
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
      const res = await fetch(`${API_BASE_URL}/api/scrape/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: singleScrapeUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setSingleScrapeResult(data);
        fetchDbStats();
        fetchData();
        setSingleScrapeUrl('');
      } else {
        setSingleScrapeError(data.error || 'Failed to scrape single product.');
      }
    } catch (err) {
      setSingleScrapeError(err.message);
    } finally {
      setRunningSingleScrape(false);
    }
  };

  const getCheapestOffersMap = (offers) => {
    const grouped = {};
    offers.forEach(o => {
      if (!grouped[o.seeds]) grouped[o.seeds] = [];
      grouped[o.seeds].push(o);
    });

    const cheapestMap = {};
    Object.keys(grouped).forEach(seeds => {
      const prices = grouped[seeds].map(o => o.price);
      cheapestMap[seeds] = Math.min(...prices);
    });
    return cheapestMap;
  };

  const getShopLogoColor = (shop) => {
    if (shop === 'Zamnesia') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    if (shop === 'Hans Brainfood') return 'text-lime-400 bg-lime-500/10 border-lime-500/20';
    if (shop === 'Gas Station Co. Seeds') return 'text-red-400 bg-red-500/10 border-red-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };

  const getFallbackDescription = (strain) => {
    const type = strain.type === 'autoflower' ? 'autoflowering' : 'photoperiodic';
    const seedKind = strain.seedType === 'feminized' ? 'feminized' : 'regular';
    const breeder = strain.breeder || 'an independent breeder';
    const details = [];
    if (strain.thc) details.push(`THC: ${strain.thc}`);
    if (strain.cbd) details.push(`CBD: ${strain.cbd}`);
    if (strain.strainType) details.push(`Genetics: ${strain.strainType.replace('-', ' ')}`);
    
    return `${strain.name} is a ${type} (${seedKind}) cannabis strain bred by ${breeder}. ${details.length > 0 ? 'Specifications: ' + details.join(', ') + '.' : ''}`;
  };

  const handleCopyProse = (id, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  const groupedStrains = groupStrainsByName(
    strains
      .filter(strain => {
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
      })
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

  const filteredDescriptionStrains = strains.filter(strain => {
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

  // â”€â”€ Strain detail page routing â”€â”€
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

      {/* Scraper Control & Log Console Modal */}
      {isScraperOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl glass-panel rounded-2xl p-6 relative overflow-hidden shadow-2xl border border-slate-800 animate-fade-in">
            
            {/* Close Button */}
            <button
              onClick={() => setIsScraperOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-900"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scraper Header Status */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-900 pb-5">
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2 text-base">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  Live System Scrape Logs
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Crawl progress, shop parsing details, and price mappings.
                </p>
              </div>
              {scraper.isScanning ? (
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-900 text-slate-300">
                    Shop: <span className="text-emerald-400 font-semibold">{scraper.currentShop || 'Queued'}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-900 text-slate-300 max-w-[200px] truncate">
                    Strain: <span className="text-teal-400 font-semibold">{scraper.currentProduct || 'Initializing'}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-900 text-slate-300">
                    Offers: <span className="text-emerald-400 font-bold">{scraper.productsScraped}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  {scraper.endTime ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5 rounded-lg font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Scrape completed ({scraper.productsScraped} offers)
                    </span>
                  ) : (
                    'Initializing scraper...'
                  )}
                </div>
              )}
            </div>

            {/* Logs Monospace Console Box */}
            <div 
              ref={logTerminalRef}
              className="h-96 bg-slate-950 border border-slate-900 rounded-xl p-4 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 select-text"
            >
              {scraper.logs.length === 0 ? (
                <div className="text-slate-600 italic flex items-center justify-center h-full gap-2">
                  <Info className="w-4 h-4" />
                  No scanner logs currently in memory.
                </div>
              ) : (
                scraper.logs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`py-0.5 border-l-2 pl-3 mb-1 ${
                      log.type === 'error' ? 'border-red-500 text-red-400 bg-red-500/5' :
                      log.type === 'warning' ? 'border-yellow-500 text-yellow-300 bg-yellow-500/5' :
                      log.type === 'success' ? 'border-emerald-500 text-emerald-300 bg-emerald-500/5' :
                      'border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="text-slate-600 mr-2 text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

      {/* Price History Modal */}
      {isPriceHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl glass-panel rounded-2xl p-6 relative overflow-hidden shadow-2xl border border-slate-800 animate-scale-up">
            
            {/* Close Button */}
            <button
              onClick={() => setIsPriceHistoryOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-900"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="mb-6 border-b border-slate-900 pb-5">
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-base">
                <TrendingDown className="w-5 h-5 text-emerald-400" />
                Price History: {priceHistoryMeta.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Breeder: <span className="text-emerald-400 font-semibold">{priceHistoryMeta.breeder || 'Unknown'}</span>
              </p>
            </div>

            {/* Modal Body */}
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RotateCw className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-xs text-slate-500">Retrieving price timeline...</p>
              </div>
            ) : priceHistoryData.length === 0 ? (
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-8 text-center text-xs text-slate-500">
                <Info className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                No historical price records found for this strain. Price points are recorded when rescrapes detect a price shift.
              </div>
            ) : (() => {
              const packSizes = Array.from(new Set(priceHistoryData.map(item => item.seeds))).sort((a, b) => Number(a) - Number(b));
              const activeSize = packSizes.includes(selectedChartSize) ? selectedChartSize : (packSizes[0] || 3);
              const chartFilteredData = priceHistoryData.filter(item => Number(item.seeds) === activeSize);
              
              const allPrices = chartFilteredData.map(d => d.price);
              const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 100;
              const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
              const priceRange = maxPrice - minPrice;
              const yMin = minPrice - (priceRange * 0.15 || 2);
              const yMax = maxPrice + (priceRange * 0.15 || 2);
              
              const allDates = chartFilteredData.map(d => new Date(d.fetchedAt).getTime());
              const maxDate = allDates.length > 0 ? Math.max(...allDates) : Date.now();
              const minDate = allDates.length > 0 ? Math.min(...allDates) : Date.now() - 86400000;
              const dateRange = maxDate - minDate;

              const getSvgX = (dateStr) => {
                if (dateRange === 0) return 300;
                const val = new Date(dateStr).getTime();
                return 50 + ((val - minDate) / dateRange) * 480;
              };

              const getSvgY = (priceVal) => {
                const spread = yMax - yMin;
                if (spread === 0) return 80;
                return 130 - ((priceVal - yMin) / spread) * 100;
              };

              const shopsInData = Array.from(new Set(chartFilteredData.map(d => d.shop)));
              const shopLines = shopsInData.map(shopName => {
                const pts = chartFilteredData
                  .filter(d => d.shop === shopName)
                  .sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
                return { shop: shopName, points: pts };
              });

              const colorMap = {
                'Zamnesia': { stroke: '#10b981' },
                'House of Seeds': { stroke: '#0ea5e9' },
                'Hans Brainfood': { stroke: '#a855f7' }
              };
              const defaultColors = { stroke: '#94a3b8' };

              return (
                <div className="space-y-5">
                  {/* Pack Size Pills Selection */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Select Pack Size</span>
                    <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-900">
                      {packSizes.map(size => (
                        <button
                          key={size}
                          onClick={() => setSelectedChartSize(Number(size))}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                            activeSize === Number(size)
                              ? 'bg-emerald-500 text-slate-950'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {size} Seeds
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SVG Price Trend Line Chart */}
                  {chartFilteredData.length > 0 && (
                    <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3 border-b border-slate-900/60 pb-2">
                        <span className="text-[10px] text-slate-400 font-bold">Price Trend (EUR)</span>
                        <div className="flex gap-3 text-[10px]">
                          {shopsInData.map(shop => {
                            const colors = colorMap[shop] || defaultColors;
                            return (
                              <div key={shop} className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.stroke }} />
                                <span className="text-slate-500 font-medium">{shop}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="h-40 w-full">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160">
                          {/* Horizontal Grid lines */}
                          <line x1="50" y1="30" x2="550" y2="30" stroke="#1e293b" strokeDasharray="3,3" />
                          <line x1="50" y1="80" x2="550" y2="80" stroke="#1e293b" strokeDasharray="3,3" strokeOpacity="0.5" />
                          <line x1="50" y1="130" x2="550" y2="130" stroke="#1e293b" strokeDasharray="3,3" />

                          {/* Grid Labels */}
                          <text x="10" y="34" className="fill-slate-600 text-[9px] font-mono font-bold">€{yMax.toFixed(2)}</text>
                          <text x="10" y="134" className="fill-slate-600 text-[9px] font-mono font-bold">€{yMin.toFixed(2)}</text>

                          {/* Draw Lines */}
                          {shopLines.map(line => {
                            const colors = colorMap[line.shop] || defaultColors;
                            if (line.points.length < 2) return null;
                            const pathD = line.points.map((p, idx) => {
                              const x = getSvgX(p.fetchedAt);
                              const y = getSvgY(p.price);
                              return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                            }).join(' ');

                            return (
                              <path
                                key={line.shop}
                                d={pathD}
                                fill="none"
                                stroke={colors.stroke}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            );
                          })}

                          {/* Draw Points */}
                          {shopLines.map(line => {
                            const colors = colorMap[line.shop] || defaultColors;
                            return line.points.map(p => {
                              const x = getSvgX(p.fetchedAt);
                              const y = getSvgY(p.price);
                              return (
                                <g key={p.id} className="group">
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="4"
                                    fill="#020617"
                                    stroke={colors.stroke}
                                    strokeWidth="2"
                                    className="transition-all duration-100 cursor-pointer hover:r-6"
                                  />
                                  {/* Tooltip Overlay */}
                                  <text
                                    x={x}
                                    y={y - 12}
                                    textAnchor="middle"
                                    className="opacity-0 group-hover:opacity-100 fill-emerald-400 text-[9px] font-bold font-mono transition-opacity duration-100 pointer-events-none"
                                  >
                                    €{p.price.toFixed(2)}
                                  </text>
                                </g>
                              );
                            });
                          })}
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Chronological Table View */}
                  <div className="overflow-x-auto max-h-56 rounded-xl border border-slate-900 bg-slate-950/40">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-semibold">
                          <th className="p-3">Date</th>
                          <th className="p-3">Shop</th>
                          <th className="p-3">Pack Size</th>
                          <th className="p-3">Price</th>
                          <th className="p-3 text-right">Trend / Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60 text-slate-300">
                        {priceHistoryData.map((item, index) => {
                          const sameGroup = priceHistoryData.slice(index + 1);
                          const previous = sameGroup.find(x => x.shop === item.shop && x.seeds === item.seeds);
                          
                          let diffIndicator = null;
                          if (previous) {
                            const diff = item.price - previous.price;
                            if (diff > 0) {
                              diffIndicator = <span className="text-red-400 font-bold">↑ +€{diff.toFixed(2)}</span>;
                            } else if (diff < 0) {
                              diffIndicator = <span className="text-emerald-400 font-bold">↓ -€{Math.abs(diff).toFixed(2)}</span>;
                            } else {
                              diffIndicator = <span className="text-slate-500">—</span>;
                            }
                          } else {
                            diffIndicator = <span className="text-slate-500 italic text-[10px]">First tracked</span>;
                          }

                          return (
                            <tr key={item.id} className="hover:bg-slate-900/20">
                              <td className="p-3 font-mono text-[10px] text-slate-500">
                                {new Date(item.fetchedAt).toLocaleString()}
                              </td>
                              <td className="p-3 font-bold text-slate-200">{item.shop}</td>
                              <td className="p-3">{item.seeds} Seeds</td>
                              <td className="p-3 text-emerald-400 font-semibold">€{item.price.toFixed(2)}</td>
                              <td className="p-3 text-right">{diffIndicator}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* Sanity Check Modal */}
      {sanityCheck.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-slate-900 rounded-2xl relative flex flex-col max-h-[85vh] overflow-hidden shadow-2xl border border-slate-800 animate-scale-up">
            
            {/* Close Button */}
            <button
              onClick={() => {
                setSanityCheck(prev => ({ ...prev, isOpen: false }));
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base">
                  Sanity Check: {sanityCheck.shop}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Testing scraper reliability by processing a random 50-product sample in-memory.
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
              
              {/* Progress and status */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400 font-medium">
                    {sanityCheck.isRunning ? 'Analyzing shop catalog...' : 'Check Completed'}
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {sanityCheck.progress} / {sanityCheck.total} products checked
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${sanityCheck.total > 0 ? (sanityCheck.progress / sanityCheck.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Live console logs */}
              <div className="space-y-2">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Live Testing Logs</span>
                <div 
                  ref={sanityCheckLogsRef}
                  className="bg-black/60 font-mono text-[10px] text-slate-300 p-4 rounded-xl border border-slate-950 h-44 overflow-y-auto space-y-1 select-text scrollbar-thin scroll-smooth"
                >
                  {sanityCheck.logs.map((log, idx) => {
                    let color = 'text-slate-300';
                    if (log.includes('[ERROR]')) color = 'text-red-400';
                    else if (log.includes('[WARNING]')) color = 'text-amber-400';
                    else if (log.includes('[SUCCESS]')) color = 'text-emerald-400';
                    return (
                      <div key={idx} className={`${color} leading-relaxed break-all`}>
                        {log}
                      </div>
                    );
                  })}
                  {sanityCheck.logs.length === 0 && (
                    <div className="text-slate-600 italic">Initializing runner...</div>
                  )}
                </div>
              </div>

              {/* Statistics Results */}
              {sanityCheck.results && (
                <div className="space-y-4">
                  <div className="border-t border-slate-800 pt-5">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-3 font-bold font-bold">Critical Information Check (Success Rate)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {renderStat('Strain Name', sanityCheck.results.critical.name, true)}
                      {renderStat('Breeder', sanityCheck.results.critical.breeder, true)}
                      {renderStat('Price', sanityCheck.results.critical.price, true)}
                      {renderStat('Seed Count', sanityCheck.results.critical.seeds, true)}
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-5">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-3 font-bold font-bold">Secondary Information Check (Completeness Rate)</span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {renderStat('THC', sanityCheck.results.secondary.thc, false)}
                      {renderStat('CBD', sanityCheck.results.secondary.cbd, false)}
                      {renderStat('Genetics', sanityCheck.results.secondary.strainType, false)}
                      {renderStat('Type (Fem/Reg)', sanityCheck.results.secondary.seedType, false)}
                      {renderStat('Flowering (Auto/Photo)', sanityCheck.results.secondary.type, false)}
                    </div>
                  </div>

                  {sanityCheck.results.failures.length > 0 && (
                    <div className="border-t border-slate-800 pt-5">
                      <span className="block text-[10px] text-red-500 uppercase tracking-wider mb-2 font-semibold">Failed Pages ({sanityCheck.results.failures.length})</span>
                      <div className="max-h-36 overflow-y-auto border border-red-500/10 rounded-xl bg-red-500/5 divide-y divide-red-500/10 text-[10px] font-mono scrollbar-thin">
                        {sanityCheck.results.failures.map((f, idx) => (
                          <div key={idx} className="p-2.5 flex flex-col gap-1">
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline font-bold break-all flex items-center gap-1">
                              {f.url}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            <span className="text-slate-500">{f.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sanityCheck.results.criticalFailures && sanityCheck.results.criticalFailures.length > 0 && (
                    <div className="border-t border-slate-800 pt-5">
                      <span className="block text-[10px] text-amber-500 uppercase tracking-wider mb-2 font-semibold">Missing Critical Details ({sanityCheck.results.criticalFailures.length})</span>
                      <div className="max-h-40 overflow-y-auto border border-amber-500/10 rounded-xl bg-amber-500/5 divide-y divide-amber-500/10 text-[10px] font-mono scrollbar-thin">
                        {sanityCheck.results.criticalFailures.map((f, idx) => (
                          <div key={idx} className="p-2.5 flex flex-col gap-1">
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline font-bold break-all flex items-center gap-1">
                              {f.url}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            <div className="text-slate-400 flex flex-wrap gap-1.5 mt-0.5 items-center">
                              <span>Missing critical fields:</span>
                              {f.fields.map(field => (
                                <span key={field} className="px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-red-400 text-[8px] font-bold uppercase tracking-wider">
                                  {field}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sanityCheck.results.secondaryFailures && sanityCheck.results.secondaryFailures.length > 0 && (
                    <div className="border-t border-slate-800 pt-5">
                      <span className="block text-[10px] text-sky-400 uppercase tracking-wider mb-2 font-semibold">Missing Secondary Details ({sanityCheck.results.secondaryFailures.length})</span>
                      <div className="max-h-40 overflow-y-auto border border-sky-500/10 rounded-xl bg-sky-500/5 divide-y divide-sky-500/10 text-[10px] font-mono scrollbar-thin">
                        {sanityCheck.results.secondaryFailures.map((f, idx) => (
                          <div key={idx} className="p-2.5 flex flex-col gap-1">
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline font-bold break-all flex items-center gap-1">
                              {f.url}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            <div className="text-slate-400 flex flex-wrap gap-1.5 mt-0.5 items-center">
                              <span>Missing optional fields:</span>
                              {f.fields.map(field => (
                                <span key={field} className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/25 text-sky-400 text-[8px] font-bold uppercase tracking-wider">
                                  {field}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex justify-end">
              <button
                onClick={() => {
                  setSanityCheck(prev => ({ ...prev, isOpen: false }));
                  if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                  }
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}

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

        {/* Filter Controls Row */}
        <div className="glass-panel rounded-2xl p-5 mb-8 flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-500 absolute left-4 top-3.5" />
              <input
                type="text"
                placeholder="Search strain names, breeders..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
              />
            </div>

            {/* Breeder Dropdown */}
            <div className="w-full lg:w-48">
              <select
                value={selectedBreeder}
                onChange={e => setSelectedBreeder(e.target.value)}
                className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
              >
                <option value="">All Breeders</option>
                {breeders.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Shop Dropdown */}
            <div className="w-full lg:w-48">
              <select
                value={selectedShop}
                onChange={e => setSelectedShop(e.target.value)}
                className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
              >
                <option value="">All Shops</option>
                <option value="Zamnesia">Zamnesia</option>
                <option value="House of Seeds">House of Seeds</option>
                <option value="Hans Brainfood">Hans Brainfood</option>
                <option value="Gas Station Co. Seeds">Gas Station Co. Seeds</option>
              </select>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-900 pt-4">
            
            {/* Type Toggles (Auto vs Photo) */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Strain Type</span>
              {[
                { label: 'All', value: '' },
                { label: 'Autoflower', value: 'autoflower' },
                { label: 'Photoperiodic', value: 'photoperiodic' }
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setTypeFilter(t.value)}
                  className={`px-4 h-9 rounded-lg text-xs font-semibold border transition-all ${
                    typeFilter === t.value
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-900 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Seed Type Toggles (Fem vs Reg) */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Seed Type</span>
              {[
                { label: 'All', value: '' },
                { label: 'Feminized', value: 'feminized' },
                { label: 'Regular', value: 'regular' }
              ].map(st => (
                <button
                  key={st.value}
                  onClick={() => setSeedTypeFilter(st.value)}
                  className={`px-4 h-9 rounded-lg text-xs font-semibold border transition-all ${
                    seedTypeFilter === st.value
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-900 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Availability Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Stock</span>
              <button
                onClick={() => setOnlyAvailable(prev => !prev)}
                className={`px-4 h-9 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                  onlyAvailable
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold'
                    : 'border-slate-900 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${onlyAvailable ? 'bg-emerald-500 shadow shadow-emerald-500/50' : 'bg-slate-500'}`} />
                Only In Stock
              </button>
            </div>

            {/* Flowering Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Flowering</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="Min"
                  min="1"
                  max="25"
                  value={minFloweringFilter}
                  onChange={e => setMinFloweringFilter(e.target.value)}
                  className="w-16 h-9 px-2 bg-slate-950 border border-slate-900 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors text-xs font-semibold font-mono text-center"
                />
                <span className="text-slate-600 text-xs">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min="1"
                  max="25"
                  value={maxFloweringFilter}
                  onChange={e => setMaxFloweringFilter(e.target.value)}
                  className="w-16 h-9 px-2 bg-slate-950 border border-slate-900 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors text-xs font-semibold font-mono text-center"
                />
                <span className="text-xs text-slate-500 font-semibold ml-1">weeks</span>
              </div>
            </div>

          </div>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RotateCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm text-slate-500">Querying pricing database...</p>
          </div>
        ) : (currentPath === '/' ? groupedStrains.length === 0 : filteredDescriptionStrains.length === 0) ? (
          <div className="glass-panel rounded-2xl py-20 text-center">
            <Info className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-slate-400 font-semibold mb-1">No seed matches found</h4>
            <p className="text-sm text-slate-600 max-w-sm mx-auto">
              Try adjusting your query/filters or click the Scan button to load initial data.
            </p>
          </div>
        ) : currentPath === '/' ? (
          
          /* Strains Comparison Catalog Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groupedStrains.map(strain => {
              const cheapestMap = getCheapestOffersMap(strain.offers);
              
              const sortedOffers = [...strain.offers].sort((a, b) => {
                if (a.shop !== b.shop) {
                  return a.shop.localeCompare(b.shop);
                }
                return Number(a.seeds) - Number(b.seeds);
              });

              return (
                <div
                  key={strain.id}
                  className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between cursor-pointer group/card"
                  onClick={() => navigateTo(`/strain/${encodeURIComponent(strain.id)}`)} 
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigateTo(`/strain/${encodeURIComponent(strain.id)}`)}
                  aria-label={`View details for ${strain.name}`}
                >
                  {/* Strain Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                          {strain.name}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center flex-wrap gap-2">
                          by <span className="text-emerald-400 font-semibold">{strain.breeder || 'Unknown Breeder'}</span>
                          <button
                            onClick={() => handleOpenPriceHistory(strain.id, strain.name, strain.breeder)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-emerald-400 transition-colors bg-slate-900/60 border border-slate-900 hover:border-emerald-500/20 px-2 py-0.5 rounded"
                            title="View price history chart & details"
                          >
                            <TrendingDown className="w-3.5 h-3.5" />
                            History
                          </button>
                        </p>
                      </div>

                      {/* Attribute Tags */}
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          strain.type === 'autoflower' 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {strain.type === 'autoflower' ? 'Auto' : 'Photo'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 tracking-wider">
                          {strain.seedType === 'feminized' ? 'Fem' : 'Reg'}
                        </span>
                        {strain.thc && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 tracking-wider">
                            {strain.thc} THC
                          </span>
                        )}
                        {strain.strainType && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/10 border border-sky-500/20 text-sky-400 tracking-wider">
                            {strain.strainType.replace('-', ' ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Comparison Packs Table View */}
                    <div className="my-5 overflow-hidden rounded-xl border border-slate-900 bg-slate-950/40">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-950/80 border-b border-slate-900/80 text-[10px] text-slate-500 uppercase font-semibold">
                              <th className="p-3">Shop</th>
                              <th className="p-3">Breeder</th>
                              <th className="p-3">Pack</th>
                              <th className="p-3">Price</th>
                              <th className="p-3 text-right">Link</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900/60">
                            {sortedOffers.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="p-4 text-center text-slate-600 italic">No offers fetched yet.</td>
                              </tr>
                            ) : (
                              sortedOffers.map(o => {
                                const isCheapestForSize = cheapestMap[o.seeds] === o.price;
                                return (
                                  <tr key={o.id} className="hover:bg-slate-900/20 transition-colors">
                                    <td className="p-3 font-medium whitespace-nowrap flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                                        o.availability === 'available' ? 'bg-emerald-500 shadow shadow-emerald-500/40' :
                                        o.availability === 'orderable' ? 'bg-amber-500 shadow shadow-amber-500/40' :
                                        'bg-red-500 shadow shadow-red-500/40'
                                      }`} title={
                                        o.availability === 'available' ? 'Available' :
                                        o.availability === 'orderable' ? 'Orderable' :
                                        'Out of stock'
                                      } />
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getShopLogoColor(o.shop)}`}>
                                        {o.shop}
                                      </span>
                                    </td>
                                    <td className="p-3 text-slate-300 font-medium truncate max-w-[110px]" title={o.breeder}>
                                      {o.breeder || 'Unknown'}
                                    </td>
                                    <td className="p-3 text-slate-400 font-mono">
                                      {o.seeds} Seed{Number(o.seeds) > 1 ? 's' : ''}
                                    </td>
                                    <td className="p-3 font-mono whitespace-nowrap">
                                      <span className={`font-bold text-xs ${isCheapestForSize ? 'text-emerald-400' : 'text-slate-300'}`}>
                                        €{o.price.toFixed(2)}
                                      </span>
                                      {isCheapestForSize && (
                                        <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20 ml-1.5" title="Cheapest price for this pack size">
                                          <Flame className="w-2.5 h-2.5 animate-pulse" />
                                          Best
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right">
                                      <a
                                        href={o.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                                      >
                                        Buy
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Summary / Meta */}
                  <div className="flex items-center justify-between border-t border-slate-900/60 pt-4 mt-2">
                    <span className="text-[10px] text-slate-600 flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                      Lowest price details listed
                    </span>
                    <span className="text-[10px] text-emerald-500/60 group-hover/card:text-emerald-400 transition-colors font-semibold">
                      View Details →
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        ) : currentPath === '/rewritten-descriptions' ? (
          /* Legally Safe Rewritten Prose View */
          <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in border border-slate-900 bg-slate-950/40 backdrop-blur-md">
            <div className="px-7 py-5 border-b border-slate-900 bg-slate-950/20">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Legally Safe Prose Descriptions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Uniquely structured prose written automatically by the backend combining original keywords and specs.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-900 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    <th className="px-7 py-4">Strain</th>
                    <th className="px-7 py-4">Breeder</th>
                    <th className="px-7 py-4 max-w-[550px]">Rewritten Prose</th>
                    <th className="px-7 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {filteredDescriptionStrains.map(strain => {
                    const prose = strain.aiDescription ? strain.aiDescription.description : strain.rewrittenDescription;
                    const isAi = !!strain.aiDescription;
                    const modelName = strain.aiDescription?.modelUsed;
                    return (
                      <tr key={strain.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-7 py-4 whitespace-nowrap">
                          <button
                            onClick={() => navigateTo(`/strain/${encodeURIComponent(strain.id)}`)}
                            className="font-bold text-slate-200 hover:text-emerald-400 transition-colors text-sm text-left block"
                          >
                            {strain.name}
                          </button>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider ${
                              strain.type === 'autoflower' 
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {strain.type === 'autoflower' ? 'Auto' : 'Photo'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 tracking-wider">
                              {strain.seedType === 'feminized' ? 'Fem' : 'Reg'}
                            </span>
                          </div>
                        </td>
                        <td className="px-7 py-4 text-slate-400 text-sm font-medium whitespace-nowrap">
                          {strain.breeder || 'Unknown'}
                        </td>
                        <td className="px-7 py-4 text-slate-300 text-xs leading-relaxed max-w-[550px]">
                          {isAi && (
                            <span className="inline-block px-1.5 py-0.5 text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded font-semibold uppercase tracking-normal mb-1.5">
                              AI ({modelName})
                            </span>
                          )}
                          {prose ? (
                            <p>{prose}</p>
                          ) : (
                            <span className="text-slate-600 italic">
                              No description scraped yet. Store prose is generated on scan.
                            </span>
                          )}
                        </td>
                        <td className="px-7 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const p = strain.aiDescription ? strain.aiDescription.description : strain.rewrittenDescription;
                                if (!p) return;
                                navigator.clipboard.writeText(p);
                                setCopiedId(strain.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              disabled={!prose}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                !prose 
                                  ? 'bg-slate-950 text-slate-700 border-slate-950 cursor-not-allowed'
                                  : copiedId === strain.id
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700'
                              }`}
                            >
                              {copiedId === strain.id ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateAiForStrain(strain.id);
                              }}
                              disabled={generatingAiId === strain.id}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                generatingAiId === strain.id
                                  ? 'bg-purple-900/30 border-purple-700/40 text-purple-400 cursor-wait'
                                  : 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/50'
                              }`}
                            >
                              <Sparkles className={`w-3 h-3 ${generatingAiId === strain.id ? 'animate-spin' : ''}`} />
                              {generatingAiId === strain.id ? '…' : isAi ? 'Regen.' : 'AI'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Plant Descriptions Catalog View */
          <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in border border-slate-900 bg-slate-950/40 backdrop-blur-md">
            <div className="px-7 py-5 border-b border-slate-900 bg-slate-950/20">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Strain Descriptions Catalog
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed plant characteristics, growth details, and effects parsed from store pages.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-900 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    <th className="px-7 py-4">Strain</th>
                    <th className="px-7 py-4">Breeder</th>
                    <th className="px-7 py-4">Source Shop</th>
                    <th className="px-7 py-4 max-w-[500px]">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {filteredDescriptionStrains.map(strain => {
                    const hasShopDescriptions = strain.descriptions && strain.descriptions.length > 0;
                    const activeShop = selectedDescriptionShops[strain.id] || (hasShopDescriptions ? strain.descriptions[0].shop : 'Generated');
                    const activeDesc = hasShopDescriptions 
                      ? (strain.descriptions.find(d => d.shop === activeShop)?.description || strain.descriptions[0].description)
                      : getFallbackDescription(strain);

                    return (
                      <tr key={strain.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-7 py-4 whitespace-nowrap">
                          <button
                            onClick={() => navigateTo(`/strain/${encodeURIComponent(strain.id)}`)}
                            className="font-bold text-slate-200 hover:text-emerald-400 transition-colors text-sm text-left block"
                          >
                            {strain.name}
                          </button>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider ${
                              strain.type === 'autoflower' 
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {strain.type === 'autoflower' ? 'Auto' : 'Photo'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 tracking-wider">
                              {strain.seedType === 'feminized' ? 'Fem' : 'Reg'}
                            </span>
                            {strain.thc && (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 tracking-wider">
                                {strain.thc} THC
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-7 py-4 text-slate-400 text-sm font-medium whitespace-nowrap">
                          {strain.breeder || 'Unknown'}
                        </td>
                        <td className="px-7 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                            {hasShopDescriptions ? (
                              strain.descriptions.map(desc => (
                                <button
                                  key={desc.shop}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDescriptionShops(prev => ({ ...prev, [strain.id]: desc.shop }));
                                  }}
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                    activeShop === desc.shop
                                      ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-sm shadow-emerald-500/20'
                                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                  }`}
                                >
                                  {desc.shop}
                                </button>
                              ))
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-slate-500 border border-slate-800/80">
                                Generated Fallback
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-7 py-4 text-slate-300 text-xs leading-relaxed max-w-[500px]">
                          <p className={!hasShopDescriptions ? 'italic text-slate-400/85' : ''}>
                            {activeDesc}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
      )}
      {/* Admin Panel View */}
      {currentPath === '/admin' && (
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
                handleSaveSettings({
                  maxItemsPerShop: limit === '' ? null : Number(limit),
                  debug: debugVal,
                  geminiApiKey: geminiApiKeyVal || null,
                  useLocalLlm: useLocalLlmVal,
                  localLlmUrl: localLlmUrlVal || null,
                  localLlmModel: localLlmModelVal || null
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
              Paste a specific product URL from <strong>Zamnesia</strong> or <strong>House of Seeds</strong> to scrape and upsert that strain and its price offers into the database instantly.
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
      )}



    </div>
  );
}
