import React, { useEffect, useRef } from 'react';
import { X, Database, CheckCircle2, Info } from 'lucide-react';

export default function SeedfinderPanel({
  isOpen,
  onClose,
  seedfinderScraper
}) {
  const seedfinderLogTerminalRef = useRef(null);

  useEffect(() => {
    if (seedfinderLogTerminalRef.current) {
      seedfinderLogTerminalRef.current.scrollTop = seedfinderLogTerminalRef.current.scrollHeight;
    }
  }, [seedfinderScraper.logs, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl glass-panel rounded-2xl p-6 relative overflow-hidden shadow-2xl border border-slate-800 animate-scale-up">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-900"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-900 pb-5">
          <div>
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-base">
              <Database className="w-5 h-5 text-emerald-400" />
              Seedfinder.eu Enrichment Logs
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Metadata enrichment progress, strain matching, and field updates.
            </p>
          </div>
          {seedfinderScraper.isScanning ? (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-900 text-slate-300 max-w-[200px] truncate">
                Strain: <span className="text-teal-400 font-semibold">{seedfinderScraper.currentProduct || 'Initializing'}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-900 text-slate-300">
                Processed: <span className="text-emerald-400 font-bold">{seedfinderScraper.productsScraped}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              {seedfinderScraper.endTime ? (
                <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5 rounded-lg font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Enrichment completed ({seedfinderScraper.productsScraped} strains)
                </span>
              ) : (
                'Initializing enrichment...'
              )}
            </div>
          )}
        </div>

        {/* Logs Monospace Console Box */}
        <div 
          ref={seedfinderLogTerminalRef}
          className="h-96 bg-slate-950 border border-slate-900 rounded-xl p-4 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 select-text"
        >
          {seedfinderScraper.logs.length === 0 ? (
            <div className="text-slate-600 italic flex items-center justify-center h-full gap-2">
              <Info className="w-4 h-4" />
              No enrichment logs currently in memory.
            </div>
          ) : (
            seedfinderScraper.logs.map((log, index) => (
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
  );
}
