import React, { useEffect, useRef } from 'react';
import { X, Activity, ExternalLink, ChevronDown, ChevronUp, Info } from 'lucide-react';

export default function SanityCheckPanel({
  isOpen,
  onClose,
  sanityCheck
}) {
  const sanityCheckLogsRef = useRef(null);

  useEffect(() => {
    if (sanityCheckLogsRef.current) {
      sanityCheckLogsRef.current.scrollTop = sanityCheckLogsRef.current.scrollHeight;
    }
  }, [sanityCheck.logs, isOpen]);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 rounded-2xl relative flex flex-col max-h-[85vh] overflow-hidden shadow-2xl border border-slate-800 animate-scale-up">
        
        {/* Close Button */}
        <button
          onClick={onClose}
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
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-3 font-bold">Critical Information Check (Success Rate)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {renderStat('Strain Name', sanityCheck.results.critical.name, true)}
                  {renderStat('Breeder', sanityCheck.results.critical.breeder, true)}
                  {renderStat('Price', sanityCheck.results.critical.price, true)}
                  {renderStat('Seed Count', sanityCheck.results.critical.seeds, true)}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-5">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-3 font-bold">Secondary Information Check (Completeness Rate)</span>
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
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
}
