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
  Database
} from 'lucide-react';

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
  
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM strains LIMIT 10;');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [executingQuery, setExecutingQuery] = useState(false);


  const [singleScrapeUrl, setSingleScrapeUrl] = useState('');
  const [singleScrapeResult, setSingleScrapeResult] = useState(null);
  const [singleScrapeError, setSingleScrapeError] = useState(null);
  const [runningSingleScrape, setRunningSingleScrape] = useState(false);
  
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

  const handleStartScrape = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/scrape`, { method: 'POST' });
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
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
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

            <button
              onClick={handleStartScrape}
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

      {/* Scraper Control & Log Console Panel */}
      {isScraperOpen && (
        <div className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
              
              {/* Scraper Header Status */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-900 pb-5">
                <div>
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-base">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Live System Scrape Logs
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Crawl progress, shop parsing details, and price mappings.
                  </p>
                </div>
                {scraper.isScanning ? (
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300">
                      Shop: <span className="text-emerald-400 font-medium">{scraper.currentShop || 'Queued'}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300 max-w-xs truncate">
                      Strain: <span className="text-teal-400 font-medium">{scraper.currentProduct || 'Initializing'}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300">
                      Scraped Offers: <span className="text-emerald-400 font-bold">{scraper.productsScraped}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    {scraper.endTime ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Last completed: {new Date(scraper.endTime).toLocaleString()} ({scraper.productsScraped} offers)
                      </span>
                    ) : (
                      'System idle. Click Scan Stores to begin.'
                    )}
                  </div>
                )}
              </div>

              {/* Logs Monospace Console Box */}
              <div 
                ref={logTerminalRef}
                className="h-64 bg-slate-950 border border-slate-900 rounded-xl p-4 overflow-y-auto font-mono-logs text-xs leading-relaxed text-slate-400 select-text"
              >
                {scraper.logs.length === 0 ? (
                  <div className="text-slate-600 italic flex items-center justify-center h-full gap-2">
                    <Info className="w-4 h-4" />
                    No scanner logs currently in memory. Trigger a scan to start recording logs.
                  </div>
                ) : (
                  scraper.logs.map((log, index) => (
                    <div 
                      key={index} 
                      className={`py-0.5 border-l-2 pl-3 mb-1 ${
                        log.type === 'error' ? 'border-red-500 text-red-400' :
                        log.type === 'warning' ? 'border-yellow-500 text-yellow-300' :
                        log.type === 'success' ? 'border-emerald-500 text-emerald-300' :
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
        </div>
      )}

      {/* Navigation Tabs (Only visible when debug is true) */}
      {config.debug && (
        <div className="border-b border-slate-900 bg-slate-950/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex gap-2">
            <button
              onClick={() => navigateTo('/')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                currentPath !== '/admin'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-900 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              Catalog Comparison
            </button>
            <button
              onClick={() => navigateTo('/admin')}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                currentPath === '/admin'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-900 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              System Administration
            </button>
          </div>
        </div>
      )}

      {/* Main Catalog View */}
      {currentPath !== '/admin' && (
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

          </div>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RotateCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm text-slate-500">Querying pricing database...</p>
          </div>
        ) : groupedStrains.length === 0 ? (
          <div className="glass-panel rounded-2xl py-20 text-center">
            <Info className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-slate-400 font-semibold mb-1">No seed matches found</h4>
            <p className="text-sm text-slate-600 max-w-sm mx-auto">
              Try adjusting your query/filters or click the Scan button to load initial data.
            </p>
          </div>
        ) : (
          
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
                  className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between"
                >
                  {/* Strain Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                          {strain.name}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          by <span className="text-emerald-400 font-semibold">{strain.breeder || 'Unknown Breeder'}</span>
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
                    <span className="text-[9px] text-slate-600">
                      Offers: {strain.offers.length}
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>
      )}

      {/* Admin Panel View */}
      {currentPath === '/admin' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Scraper Settings Panel */}
            <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-emerald-400" />
                Scraper Configuration Settings
              </h2>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const limit = formData.get('maxItemsPerShop');
                const debugVal = formData.get('debug') === 'on';
                handleSaveSettings({
                  maxItemsPerShop: limit === '' ? null : Number(limit),
                  debug: debugVal
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
            <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  Database Diagnostics
                </h2>

                <div className="space-y-4">
                  <div className="flex justify-between border-b border-slate-900 pb-2">
                    <span className="text-xs text-slate-500">Strains Count</span>
                    <span className="text-xs text-slate-200 font-semibold">{dbStats.strainsCount}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-2">
                    <span className="text-xs text-slate-500">Scraped Offers</span>
                    <span className="text-xs text-slate-200 font-semibold">{dbStats.offersCount}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-2">
                    <span className="text-xs text-slate-500">File Size</span>
                    <span className="text-xs text-emerald-400 font-bold">{dbStats.fileSize}</span>
                  </div>

                  <div className="border-t border-slate-900 pt-4 mt-2">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2.5 font-semibold">Currently Scraped Shops</span>
                    <div className="space-y-2">
                      {dbStats.shopStats && dbStats.shopStats.map(s => (
                        <div key={s.shop} className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <span className="block text-xs font-bold text-slate-200">{s.shop}</span>
                            <span className="block text-[9px] text-slate-500 mt-0.5">Tracking pricing offers across packages</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-xs text-slate-300 font-semibold">{s.strainsCount} strains</span>
                            <span className="block text-[9px] text-emerald-400 font-medium">{s.offersCount} offers</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-semibold">Absolute DB Path</span>
                    <span className="block text-[10px] font-mono text-slate-400 break-all leading-normal bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
                      {dbStats.dbPath}
                    </span>
                  </div>
                </div>
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
