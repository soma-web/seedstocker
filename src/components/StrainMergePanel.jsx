import React, { useState, useMemo } from 'react';
import { 
  GitMerge, 
  Search, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCw, 
  Trash2, 
  Info, 
  X, 
  Check 
} from 'lucide-react';
import { apiPost } from '../hooks/useApi';

export default function StrainMergePanel({ dbStrains = [], onRefreshData, onRefreshDbStats }) {
  const [targetId, setTargetId] = useState('');
  const [sourceId, setSourceId] = useState('');

  const [targetSearch, setTargetSearch] = useState('');
  const [sourceSearch, setSourceSearch] = useState('');

  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);

  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState(null);
  const [mergeSuccess, setMergeSuccess] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Filter strains for autocomplete
  const filteredTargetStrains = useMemo(() => {
    if (!targetSearch.trim()) return dbStrains.slice(0, 20);
    const q = targetSearch.toLowerCase();
    return dbStrains.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.breeder && s.breeder.toLowerCase().includes(q)) ||
      s.id.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [dbStrains, targetSearch]);

  const filteredSourceStrains = useMemo(() => {
    if (!sourceSearch.trim()) return dbStrains.slice(0, 20);
    const q = sourceSearch.toLowerCase();
    return dbStrains.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.breeder && s.breeder.toLowerCase().includes(q)) ||
      s.id.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [dbStrains, sourceSearch]);

  const handleSelectTarget = (strain) => {
    setTargetId(strain.id);
    setTargetSearch(`${strain.name} (${strain.breeder || 'Kein Züchter'})`);
    setShowTargetDropdown(false);
    setPreview(null);
    setMergeSuccess(null);
    setMergeError(null);
  };

  const handleSelectSource = (strain) => {
    setSourceId(strain.id);
    setSourceSearch(`${strain.name} (${strain.breeder || 'Kein Züchter'})`);
    setShowSourceDropdown(false);
    setPreview(null);
    setMergeSuccess(null);
    setMergeError(null);
  };

  const handleLoadPreview = async () => {
    if (!targetId || !sourceId) {
      setPreviewError('Bitte wählen Sie sowohl einen Ziel-Strain als auch einen Quell-Strain aus.');
      return;
    }
    if (targetId === sourceId) {
      setPreviewError('Ziel-Strain und Quell-Strain dürfen nicht identisch sein.');
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);
    setMergeError(null);
    setMergeSuccess(null);

    try {
      const res = await apiPost('/api/strains/merge-preview', { targetId, sourceId });
      setPreview(res);
    } catch (err) {
      setPreviewError(err.message || 'Fehler beim Laden der Vorschau.');
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteMerge = async () => {
    if (!targetId || !sourceId) return;

    setMerging(true);
    setMergeError(null);
    setMergeSuccess(null);

    try {
      const res = await apiPost('/api/strains/merge', { targetId, sourceId });
      setMergeSuccess(res.message);
      setPreview(null);
      setShowConfirm(false);
      setSourceId('');
      setSourceSearch('');

      if (onRefreshData) onRefreshData();
      if (onRefreshDbStats) onRefreshDbStats();
    } catch (err) {
      setMergeError(err.message || 'Fehler beim Zusammenführen der Strains.');
      setShowConfirm(false);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <GitMerge className="w-5 h-5 text-indigo-400" />
          Strain Zusammenführung & Duplikat-Bereinigung
        </h2>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          Admin Tool
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-6">
        Führe zwei doppelte Strains sicher zusammen. Alle verknüpften Angebote, Preishistorien und Shop-Beschreibungen des Quell-Strains werden auf den Ziel-Strain übertragen. Anschließend wird das Duplikat gelöscht.
      </p>

      {/* Selectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Target Strain Selector */}
        <div className="relative">
          <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            1. Ziel-Strain (WIRD BEHALTEN)
          </label>
          <div className="relative">
            <input
              type="text"
              value={targetSearch}
              onChange={(e) => {
                setTargetSearch(e.target.value);
                setShowTargetDropdown(true);
                if (!e.target.value) setTargetId('');
              }}
              onFocus={() => setShowTargetDropdown(true)}
              placeholder="Ziel-Strain suchen (z. B. Gorilla Glue)..."
              className="w-full h-12 pl-10 pr-10 bg-slate-950 border border-emerald-500/30 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-sm font-medium"
            />
            <Search className="w-4 h-4 text-emerald-400/60 absolute left-3.5 top-4" />
            {targetSearch && (
              <button
                onClick={() => { setTargetSearch(''); setTargetId(''); setPreview(null); }}
                className="absolute right-3 top-4 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showTargetDropdown && filteredTargetStrains.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-900">
              {filteredTargetStrains.map((s) => (
                <div
                  key={`target-${s.id}`}
                  onClick={() => handleSelectTarget(s)}
                  className="p-3 hover:bg-emerald-500/10 cursor-pointer transition-colors text-xs flex justify-between items-center"
                >
                  <div>
                    <span className="font-semibold text-slate-200">{s.name}</span>
                    <span className="text-slate-500 text-[10px] ml-2">({s.breeder || 'Kein Züchter'})</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{s.id.substring(0, 8)}...</span>
                </div>
              ))}
            </div>
          )}
          {targetId && (
            <div className="mt-2 text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Selected ID: {targetId}
            </div>
          )}
        </div>

        {/* Source Strain Selector */}
        <div className="relative">
          <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" />
            2. Quell-Strain (WIRD GELÖSCHT & ZUSAMMENGEFÜHRT)
          </label>
          <div className="relative">
            <input
              type="text"
              value={sourceSearch}
              onChange={(e) => {
                setSourceSearch(e.target.value);
                setShowSourceDropdown(true);
                if (!e.target.value) setSourceId('');
              }}
              onFocus={() => setShowSourceDropdown(true)}
              placeholder="Duplikat / Quell-Strain suchen..."
              className="w-full h-12 pl-10 pr-10 bg-slate-950 border border-red-500/30 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500 text-sm font-medium"
            />
            <Search className="w-4 h-4 text-red-400/60 absolute left-3.5 top-4" />
            {sourceSearch && (
              <button
                onClick={() => { setSourceSearch(''); setSourceId(''); setPreview(null); }}
                className="absolute right-3 top-4 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showSourceDropdown && filteredSourceStrains.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-900">
              {filteredSourceStrains.map((s) => (
                <div
                  key={`source-${s.id}`}
                  onClick={() => handleSelectSource(s)}
                  className="p-3 hover:bg-red-500/10 cursor-pointer transition-colors text-xs flex justify-between items-center"
                >
                  <div>
                    <span className="font-semibold text-slate-200">{s.name}</span>
                    <span className="text-slate-500 text-[10px] ml-2">({s.breeder || 'Kein Züchter'})</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{s.id.substring(0, 8)}...</span>
                </div>
              ))}
            </div>
          )}
          {sourceId && (
            <div className="mt-2 text-[11px] text-red-400 font-mono flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Selected ID: {sourceId}
            </div>
          )}
        </div>
      </div>

      {/* Load Preview Button */}
      <div className="flex gap-4 items-center mb-6">
        <button
          onClick={handleLoadPreview}
          disabled={!targetId || !sourceId || loadingPreview}
          className={`px-6 h-12 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            !targetId || !sourceId || loadingPreview
              ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
          }`}
        >
          {loadingPreview ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              Vorschau wird geladen...
            </>
          ) : (
            <>
              <GitMerge className="w-4 h-4" />
              Vorschau anzeigen
            </>
          )}
        </button>
      </div>

      {previewError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold mb-6 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {previewError}
        </div>
      )}

      {mergeError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold mb-6 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {mergeError}
        </div>
      )}

      {mergeSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-semibold mb-6 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {mergeSuccess}
        </div>
      )}

      {/* Preview Card */}
      {preview && (
        <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400" />
            Vorschau der Zusammenführung
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mb-6">
            {/* Target Card */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-xs space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 uppercase">
                Ziel-Strain (Bleibt erhalten)
              </span>
              <div className="font-bold text-slate-100 text-sm">{preview.target.name}</div>
              <div className="text-slate-400">Züchter: <span className="text-slate-200">{preview.target.breeder || 'Keiner'}</span></div>
              <div className="text-slate-400 font-mono text-[10px]">ID: {preview.target.id}</div>
            </div>

            {/* Transfer Summary */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs text-center space-y-2">
              <ArrowRight className="w-6 h-6 text-indigo-400 mx-auto" />
              <div className="font-bold text-slate-200">Übertragene Daten</div>
              <div className="text-indigo-400 font-mono text-xs">
                {preview.summary.offersCount} Angebote
              </div>
              <div className="text-slate-400 text-[11px]">
                {preview.summary.priceHistoryCount} Preishistorie-Einträge
              </div>
              {preview.summary.newShopsToTransfer.length > 0 && (
                <div className="text-emerald-400 text-[11px]">
                  +{preview.summary.newShopsToTransfer.length} Shop-Beschreibungen ({preview.summary.newShopsToTransfer.join(', ')})
                </div>
              )}
              {preview.summary.metadataToFill.length > 0 && (
                <div className="text-amber-400 text-[11px]">
                  +{preview.summary.metadataToFill.length} ergänzte Felder ({preview.summary.metadataToFill.map(m => m.label).join(', ')})
                </div>
              )}
            </div>

            {/* Source Card */}
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-xs space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 uppercase">
                Quell-Strain (Wird gelöscht)
              </span>
              <div className="font-bold text-slate-100 text-sm">{preview.source.name}</div>
              <div className="text-slate-400">Züchter: <span className="text-slate-200">{preview.source.breeder || 'Keiner'}</span></div>
              <div className="text-slate-400 font-mono text-[10px]">ID: {preview.source.id}</div>
            </div>
          </div>

          {/* Action Confirmation */}
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
            >
              <GitMerge className="w-4 h-4" />
              Strains jetzt zusammenführen & Duplikat löschen
            </button>
          ) : (
            <div className="bg-red-950/60 border border-red-500/50 p-4 rounded-xl text-center space-y-3">
              <div className="text-xs font-bold text-red-200">
                Bist du sicher? {preview.source.name} wird gelöscht und alle Daten werden in {preview.target.name} zusammengeführt.
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleExecuteMerge}
                  disabled={merging}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  {merging ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      Führe zusammen...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Ja, endgültig zusammenführen
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={merging}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
