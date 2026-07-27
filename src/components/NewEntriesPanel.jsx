import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Link2, 
  RotateCw, 
  Play, 
  Sparkles, 
  ExternalLink, 
  ShieldAlert, 
  Trash2, 
  Layers, 
  Check, 
  Info,
  ChevronRight,
  Database
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../hooks/useApi';

export default function NewEntriesPanel({
  isOpen,
  onClose,
  dbStrains = [],
  onRefreshData
}) {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ pendingCount: 0, approvedCount: 0, rejectedCount: 0, mergedCount: 0 });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [shopFilter, setShopFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  // Client-side filters
  const [breederFilter, setBreederFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState(''); // '' | 'match' | 'new'

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Merge modal state
  const [mergeTargetEntry, setMergeTargetEntry] = useState(null);
  const [selectedMergeStrainId, setSelectedMergeStrainId] = useState('');
  const [mergeSearchTerm, setMergeSearchTerm] = useState('');

  // Auto-select first matching strain when searching or opening merge modal
  useEffect(() => {
    if (!mergeTargetEntry) return;
    const term = (mergeSearchTerm || '').toLowerCase().trim();
    const filtered = dbStrains.filter(s => {
      if (!term) return true;
      return (
        (s.name && s.name.toLowerCase().includes(term)) ||
        (s.breeder && s.breeder.toLowerCase().includes(term))
      );
    });

    if (filtered.length > 0) {
      const isValid = filtered.some(s => s.id === selectedMergeStrainId);
      if (!isValid) {
        setSelectedMergeStrainId(filtered[0].id);
      }
    } else {
      setSelectedMergeStrainId('');
    }
  }, [mergeSearchTerm, mergeTargetEntry, dbStrains]);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (statusFilter) query.append('status', statusFilter);
      if (shopFilter) query.append('shop', shopFilter);
      if (searchTerm) query.append('search', searchTerm);

      const res = await apiGet(`/api/new-entries?${query.toString()}`);
      setEntries(Array.isArray(res) ? res : []);

      const statsRes = await apiGet('/api/new-entries/stats');
      if (statsRes && !statsRes.error) {
        setStats(statsRes);
      }
    } catch (err) {
      setError(err.message || 'Fehler beim Laden der Shop-Einträge.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEntries();
      setSelectedIds([]);
    }
  }, [isOpen, statusFilter, shopFilter]);

  // Reset to page 1 whenever filters or data change
  useEffect(() => { setCurrentPage(1); }, [breederFilter, typeFilter, matchFilter, shopFilter, statusFilter, entries]);

  if (!isOpen) return null;

  const handleUpdateEntry = async (id, fields) => {
    try {
      const res = await apiPut(`/api/new-entries/${id}`, fields);
      if (res.success) {
        if (fields.extractedName !== undefined) {
          fetchEntries();
        } else {
          setEntries(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e));
        }
      } else {
        alert('Aktualisierung fehlgeschlagen: ' + (res.error || 'Unbekannter Fehler'));
      }
    } catch (err) {
      alert(`Fehler beim Aktualisieren: ${err.message}`);
    }
  };

  const handleStartDiscoveryScrape = async () => {
    setActionLoading(true);
    try {
      await apiPost('/api/scraper/discovery', { shop: shopFilter || null });
      alert('Discovery-Scrape im Hintergrund gestartet! Der Scraper sammelt neue Produkte im Staging.');
      fetchEntries();
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (ids) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;

    setActionLoading(true);
    try {
      const res = await apiPost('/api/new-entries/approve', { ids: idList });
      if (res.success) {
        fetchEntries();
        setSelectedIds([]);
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      alert(`Fehler beim Freigeben: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (ids) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;

    setActionLoading(true);
    try {
      const res = await apiPost('/api/new-entries/reject', { ids: idList });
      if (res.success) {
        fetchEntries();
        setSelectedIds([]);
      }
    } catch (err) {
      alert(`Fehler beim Ablehnen: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeTargetEntry || !selectedMergeStrainId) return;

    setActionLoading(true);
    try {
      const res = await apiPost('/api/new-entries/merge', {
        id: mergeTargetEntry.id,
        targetStrainId: selectedMergeStrainId
      });
      if (res.success) {
        setMergeTargetEntry(null);
        setSelectedMergeStrainId('');
        fetchEntries();
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      alert(`Fehler beim Zuordnen: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearStaging = async () => {
    if (!window.confirm('Möchtest du alle abgelehnten und verarbeiteten Staging-Einträge löschen?')) return;
    setActionLoading(true);
    try {
      await apiPost('/api/new-entries/clear', { clearAll: true });
      fetchEntries();
    } catch (err) {
      alert(`Fehler beim Bereinigen: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelectAll = () => {
    const pageIds = pagedEntries.map(e => e.id);
    const allPageSelected = pageIds.every(id => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const uniqueShopsFromEntries = entries.map(e => e.shop).filter(Boolean);
  const registeredShops = stats.allShops || [];
  const availableShops = Array.from(new Set([...registeredShops, ...uniqueShopsFromEntries])).sort();

  // Unique breeders from loaded entries for filter dropdown
  const availableBreeders = Array.from(new Set(entries.map(e => e.extractedBreeder).filter(Boolean))).sort();

  // Apply client-side filters on top of server-side results
  const filteredEntries = entries.filter(e => {
    if (breederFilter && (e.extractedBreeder || '') !== breederFilter) return false;
    if (typeFilter && (e.type || 'photoperiodic') !== typeFilter) return false;
    if (matchFilter === 'match' && !e.suggestedStrainId) return false;
    if (matchFilter === 'new' && e.suggestedStrainId) return false;
    return true;
  });

  const hasClientFilters = breederFilter || typeFilter || matchFilter;

  // Pagination derived
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedEntries = pageSize === 0
    ? filteredEntries
    : filteredEntries.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto flex flex-col glass-panel rounded-2xl p-6 relative shadow-2xl border border-slate-800 animate-scale-up">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Neue Shop-Einträge & Scrape-Prüfung
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Staging Shield Active
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Prüfe und importiere Neufunde aus den Shops sicher in deine produktive Datenbank.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleStartDiscoveryScrape}
              disabled={actionLoading}
              title={shopFilter ? `Discovery-Scrape für ${shopFilter} starten` : 'Discovery-Scrape für alle Shops starten'}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-900 font-semibold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-slate-900" />
              {shopFilter ? `Discovery: ${shopFilter}` : 'Discovery-Scrape starten (Alle Shops)'}
            </button>
            <button
              onClick={fetchEntries}
              disabled={loading}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors"
              title="Aktualisieren"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className={`p-3.5 rounded-xl border transition-all ${statusFilter === 'pending' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Ausstehende Funde</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.pendingCount}</div>
          </div>

          <div className={`p-3.5 rounded-xl border transition-all ${statusFilter === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Freigegeben / Importiert</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.approvedCount}</div>
          </div>

          <div className={`p-3.5 rounded-xl border transition-all ${statusFilter === 'merged' ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Zugeordnet / Gemerged</span>
              <Link2 className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-teal-400 mt-1">{stats.mergedCount}</div>
          </div>

          <div className={`p-3.5 rounded-xl border transition-all ${statusFilter === 'rejected' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Abgelehnt</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{stats.rejectedCount}</div>
          </div>
        </div>

        {/* Filter & Controls Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4 bg-slate-950/70 p-3 rounded-xl border border-slate-900">
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              {['pending', 'approved', 'merged', 'rejected', 'all'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md capitalize transition-colors ${
                    statusFilter === st ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st === 'pending' ? 'Ausstehend' : st === 'approved' ? 'Importiert' : st === 'merged' ? 'Zugeordnet' : st === 'rejected' ? 'Abgelehnt' : 'Alle'}
                </button>
              ))}
            </div>

            {/* Shop Filter */}
            <select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="">Alle Shops ({availableShops.length})</option>
              {availableShops.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Breeder Filter */}
            <select
              value={breederFilter}
              onChange={(e) => setBreederFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="">Alle Breeder</option>
              {availableBreeders.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="">Alle Typen</option>
              <option value="photoperiodic">🌱 Photoperiodic</option>
              <option value="autoflower">⚡ Autoflower</option>
              <option value="fast_flowering">🚀 Fast Flowering</option>
              <option value="triploid">🧬 Triploid</option>
            </select>

            {/* Match Filter */}
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              {[['', 'Alle'], ['match', '✓ Match'], ['new', '✦ Neu']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setMatchFilter(val)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    matchFilter === val
                      ? val === 'match'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                        : val === 'new'
                        ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {hasClientFilters && (
              <button
                onClick={() => { setBreederFilter(''); setTypeFilter(''); setMatchFilter(''); }}
                className="px-2 py-1 text-[10px] text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 rounded-lg transition-colors flex items-center gap-1"
                title="Filter zurücksetzen"
              >
                <X className="w-3 h-3" /> Filter
              </button>
            )}

            {/* Page size */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">Zeige:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>Alle</option>
              </select>
            </div>
          </div>

          {/* Search Box & Bulk Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-60">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Name oder Breeder suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchEntries()}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <button
                  onClick={() => handleApprove(selectedIds)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {selectedIds.length} Importieren
                </button>
                <button
                  onClick={() => handleReject(selectedIds)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {selectedIds.length} Ablehnen
                </button>
              </div>
            )}

            <button
              onClick={handleClearStaging}
              disabled={actionLoading}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 rounded-lg transition-colors"
              title="Bearbeitete Staging-Einträge löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Entry Count */}
        {!loading && entries.length > 0 && (
          <div className="flex items-center gap-2 mb-2 px-1 text-[10px] text-slate-500">
            <span>
              {filteredEntries.length === entries.length
                ? `${entries.length} Einträge`
                : `${filteredEntries.length} von ${entries.length} Einträgen`}
            </span>
            {hasClientFilters && filteredEntries.length !== entries.length && (
              <span className="text-amber-400">· Filter aktiv</span>
            )}
          </div>
        )}

        {/* Entries Table / List */}
        <div className="flex-1 overflow-y-auto min-h-[350px] border border-slate-900 rounded-xl bg-slate-950/50">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-500 text-xs italic">
              <RotateCw className="w-5 h-5 animate-spin mr-2 text-emerald-400" />
              Lade Staging-Funde...
            </div>
          ) : pagedEntries.length === 0 && filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-xs gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
              <span>Keine Eintragsfunde für die aktuellen Filter vorhanden.</span>
              {hasClientFilters && (
                <button
                  onClick={() => { setBreederFilter(''); setTypeFilter(''); setMatchFilter(''); }}
                  className="text-[10px] text-teal-400 hover:text-teal-300 underline"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800 z-10">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={pagedEntries.length > 0 && pagedEntries.every(e => selectedIds.includes(e.id))}
                      onChange={toggleSelectAll}
                      title={pageSize !== 0 ? 'Alle Seiten auswählen' : undefined}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950"
                    />
                  </th>
                  <th className="p-3">Shop & Titel</th>
                  <th className="p-3">Erkannter Strain / Breeder</th>
                  <th className="p-3">Spezifikationen</th>
                  <th className="p-3">Möglicher Match (Datenbank)</th>
                  <th className="p-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {pagedEntries.map((entry) => {
                  const isSelected = selectedIds.includes(entry.id);
                  return (
                    <tr 
                      key={entry.id}
                      className={`hover:bg-slate-900/40 transition-colors ${
                        isSelected ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(entry.id)}
                          className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950"
                        />
                      </td>

                      {/* Shop & Product Title */}
                      <td className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-emerald-400">
                            {entry.shop}
                          </span>
                          {entry.shopProductUrl ? (
                            <a
                              href={entry.shopProductUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 hover:underline"
                              title="Produkt im Shop öffnen"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Shop-Link</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-600 italic">Kein Link</span>
                          )}
                        </div>
                        <div className="font-medium text-slate-200 text-xs max-w-xs truncate" title={entry.rawTitle}>
                          {entry.rawTitle}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <span className="text-slate-500">Erkannter Name:</span>
                          <span className="bg-slate-900 border border-slate-800 text-teal-300 font-semibold px-1.5 py-0.5 rounded text-[11px]">{entry.extractedName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {entry.seeds}x Samen | {entry.price} €
                        </div>
                      </td>

                      {/* Extracted Strain & Breeder */}
                      <td className="p-3">
                        <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          {entry.status === 'pending' ? (
                            <input
                              key={entry.id + '_name_' + (entry.extractedName || '')}
                              type="text"
                              defaultValue={entry.extractedName || ''}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val && val !== entry.extractedName) {
                                  handleUpdateEntry(entry.id, { extractedName: val });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                }
                              }}
                              disabled={actionLoading}
                              className="bg-slate-900/60 hover:bg-slate-900 focus:bg-slate-900 border border-slate-800 focus:border-teal-500 text-slate-100 font-bold px-2 py-0.5 rounded text-xs focus:outline-none w-full max-w-[180px] transition-all"
                            />
                          ) : (
                            <span>{entry.extractedName}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-teal-400 font-medium mt-0.5">
                          {entry.status === 'pending' ? (
                            <input
                              key={entry.id + '_breeder_' + (entry.extractedBreeder || '')}
                              type="text"
                              defaultValue={entry.extractedBreeder || ''}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val !== (entry.extractedBreeder || '')) {
                                  handleUpdateEntry(entry.id, { extractedBreeder: val });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                }
                              }}
                              disabled={actionLoading}
                              placeholder="Breeder..."
                              className="bg-slate-900/40 hover:bg-slate-900 focus:bg-slate-900 border border-slate-800 focus:border-teal-500/50 text-teal-300 font-medium px-2 py-0.5 rounded text-[11px] focus:outline-none w-full max-w-[180px] transition-all"
                            />
                          ) : (
                            <span>{entry.extractedBreeder || 'Unknown Breeder'}</span>
                          )}
                        </div>
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          <select
                            value={entry.type || 'photoperiodic'}
                            onChange={(e) => handleUpdateEntry(entry.id, { type: e.target.value })}
                            disabled={entry.status !== 'pending' || actionLoading}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer font-bold transition-colors"
                          >
                            <option value="photoperiodic">🌱 Photo</option>
                            <option value="autoflower">⚡ Auto</option>
                            <option value="fast_flowering">🚀 Fast</option>
                            <option value="triploid">🧬 Trip</option>
                          </select>

                          <select
                            value={entry.seedType || 'feminized'}
                            onChange={(e) => handleUpdateEntry(entry.id, { seedType: e.target.value })}
                            disabled={entry.status !== 'pending' || actionLoading}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer font-bold transition-colors"
                          >
                            <option value="feminized">♀ Fem</option>
                            <option value="regular">Reg</option>
                          </select>
                        </div>
                      </td>

                      {/* Specifications */}
                      <td className="p-3 text-[11px] text-slate-400">
                        <div>THC: <span className="text-slate-200">{entry.thc || '-'}</span></div>
                        <div>CBD: <span className="text-slate-200">{entry.cbd || '-'}</span></div>
                        <div>Typ: <span className="text-slate-200">{entry.strainType || '-'}</span></div>
                      </td>

                      {/* Suggested Database Match */}
                      <td className="p-3">
                        {entry.suggestedStrainName ? (
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px]">
                            <div className="text-amber-300 font-medium flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              Möglicher Treffer:
                            </div>
                            <div className="font-semibold text-slate-100 mt-0.5">
                              {entry.suggestedStrainName}
                            </div>
                            <button
                              onClick={() => {
                                setMergeTargetEntry(entry);
                                setSelectedMergeStrainId(entry.suggestedStrainId);
                                setMergeSearchTerm(entry.suggestedStrainName || entry.extractedName || '');
                              }}
                              className="mt-1 text-[10px] text-teal-300 hover:text-teal-200 flex items-center gap-0.5 underline"
                            >
                              <Link2 className="w-2.5 h-2.5" />
                              Hierzu ordnen
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic">
                            100% Neuer Strain (Kein Treffer in DB)
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        {entry.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(entry.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                              title="Als neuen Strain freigeben & importieren"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Import
                            </button>
                            <button
                              onClick={() => {
                                setMergeTargetEntry(entry);
                                setSelectedMergeStrainId(entry.suggestedStrainId || '');
                                setMergeSearchTerm(entry.extractedName || '');
                              }}
                              disabled={actionLoading}
                              className="p-1.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 rounded-lg transition-colors"
                              title="Mit bestehendem Strain verknüpfen"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleReject(entry.id)}
                              disabled={actionLoading}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg transition-colors"
                              title="Ablehnen"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            entry.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            entry.status === 'merged' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {entry.status === 'approved' ? 'Importiert' : entry.status === 'merged' ? 'Zugeordnet' : 'Abgelehnt'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && pageSize !== 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-3 border-t border-slate-900 mt-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              className="px-2 py-1 text-[11px] rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              «
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…'
                  ? <span key={`ellipsis-${i}`} className="px-1 text-slate-600 text-[11px]">…</span>
                  : <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors ${
                        p === safePage
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {p}
                    </button>
              )}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ›
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              className="px-2 py-1 text-[11px] rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              »
            </button>
          </div>
        )}

      </div>

      {/* Merge Modal */}
      {mergeTargetEntry && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-800 shadow-2xl relative flex flex-col max-h-[85vh]">
            <button
              onClick={() => setMergeTargetEntry(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-3">
              <Link2 className="w-5 h-5 text-teal-400" />
              Shop-Angebot zu bestehendem Strain ordnen
            </h3>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-xs mb-4">
              <div className="text-slate-400 flex items-center justify-between mb-1">
                <span>Gefundenes Shop-Angebot:</span>
                <span className="font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400">
                  {mergeTargetEntry.shop}
                </span>
              </div>
              <div className="font-bold text-slate-100 text-sm">{mergeTargetEntry.extractedName}</div>
              <div className="text-slate-400 text-[11px] mt-1 flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span>{mergeTargetEntry.seeds}x Samen — {mergeTargetEntry.price} €</span>
                {mergeTargetEntry.shopProductUrl && (
                  <a
                    href={mergeTargetEntry.shopProductUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Shop-Link öffnen</span>
                  </a>
                )}
              </div>
            </div>

            {/* Search Filter Box */}
            <div className="mb-3">
              <label className="block text-xs text-slate-300 font-medium mb-1">
                Bestehende Strains in der Datenbank durchsuchen:
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Strain-Name oder Breeder eingeben..."
                  value={mergeSearchTerm}
                  onChange={(e) => setMergeSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-xs rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-teal-500"
                />
                {mergeSearchTerm && (
                  <button
                    onClick={() => setMergeSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filtered Strain List */}
            {(() => {
              const filteredMergeStrains = dbStrains.filter(s => {
                if (!mergeSearchTerm.trim()) return true;
                const term = mergeSearchTerm.toLowerCase();
                return (
                  (s.name && s.name.toLowerCase().includes(term)) ||
                  (s.breeder && s.breeder.toLowerCase().includes(term))
                );
              });

              return (
                <div className="flex-1 flex flex-col min-h-0 mb-4">
                  <div className="text-[11px] text-slate-400 mb-1 flex justify-between">
                    <span>Gefundene Strains:</span>
                    <span className="font-semibold text-teal-400">{filteredMergeStrains.length} / {dbStrains.length}</span>
                  </div>
                  <select
                    value={selectedMergeStrainId}
                    onChange={(e) => setSelectedMergeStrainId(e.target.value)}
                    onDoubleClick={() => {
                      if (selectedMergeStrainId && !actionLoading) handleMerge();
                    }}
                    size={7}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-xs rounded-xl p-2 focus:outline-none focus:border-teal-500 select-text overflow-y-auto"
                  >
                    {filteredMergeStrains.length === 0 ? (
                      <option disabled className="p-2 text-slate-500">Keine passenden Strains gefunden</option>
                    ) : (
                      filteredMergeStrains.map(s => (
                        <option 
                          key={s.id} 
                          value={s.id}
                          className="p-2 border-b border-slate-900/50 hover:bg-teal-500/20 cursor-pointer text-xs"
                        >
                          {s.name} ({s.breeder || 'Unknown Breeder'})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-900">
              <button
                onClick={() => setMergeTargetEntry(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl text-xs"
              >
                Abbrechen
              </button>
              <button
                onClick={handleMerge}
                disabled={!selectedMergeStrainId || actionLoading}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-slate-950 font-bold rounded-xl text-xs disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    Wird zugeordnet...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Zuordnen & Speichern
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
