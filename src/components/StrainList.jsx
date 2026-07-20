import React, { useState } from 'react';
import { RotateCw, Info, Sparkles, ExternalLink } from 'lucide-react';
import StrainCard from './StrainCard';

export function getFallbackDescription(strain) {
  const type = strain.type === 'autoflower' ? 'autoflowering' : 'photoperiodic';
  const seedKind = strain.seedType === 'feminized' ? 'feminized' : 'regular';
  const breeder = strain.breeder || 'an independent breeder';
  const details = [];
  if (strain.thc) details.push(`THC: ${strain.thc}`);
  if (strain.cbd) details.push(`CBD: ${strain.cbd}`);
  if (strain.strainType) details.push(`Genetics: ${strain.strainType.replace('-', ' ')}`);
  
  return `${strain.name} is a ${type} (${seedKind}) cannabis strain bred by ${breeder}. ${details.length > 0 ? 'Specifications: ' + details.join(', ') + '.' : ''}`;
}

export default function StrainList({
  currentPath,
  groupedStrains = [],
  filteredDescriptionStrains = [],
  loading,
  selectedDescriptionShops,
  setSelectedDescriptionShops,
  copiedId,
  setCopiedId,
  generatingAiId,
  handleGenerateAiForStrain,
  onOpenPriceHistory,
  onNavigate
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <RotateCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-500">Querying pricing database...</p>
      </div>
    );
  }

  const totalItems = currentPath === '/' ? groupedStrains.length : filteredDescriptionStrains.length;
  const isAll = pageSize === 'All';
  const totalPages = isAll ? 1 : Math.ceil(totalItems / pageSize);
  const startIndex = isAll ? 0 : (currentPage - 1) * pageSize;
  const endIndex = isAll ? totalItems : Math.min(startIndex + pageSize, totalItems);

  const pageGroupedStrains = isAll 
    ? groupedStrains 
    : groupedStrains.slice(startIndex, endIndex);

  const pageDescriptionStrains = isAll 
    ? filteredDescriptionStrains 
    : filteredDescriptionStrains.slice(startIndex, endIndex);

  const isEmpty = totalItems === 0;

  if (isEmpty) {
    return (
      <div className="glass-panel rounded-2xl py-20 text-center">
        <Info className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h4 className="text-slate-400 font-semibold mb-1">No seed matches found</h4>
        <p className="text-sm text-slate-600 max-w-sm mx-auto">
          Try adjusting your query/filters or click the Scan button to load initial data.
        </p>
      </div>
    );
  }

  const handleCopyProse = (id, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Pagination Statistics & Page Size selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-950/20 p-4 rounded-xl border border-slate-900/60 text-xs text-slate-400 select-none">
        <div>
          Showing <span className="text-emerald-400 font-bold font-mono">{startIndex + 1}</span> to{' '}
          <span className="text-emerald-400 font-bold font-mono">{endIndex}</span> of{' '}
          <span className="text-emerald-400 font-bold font-mono">{totalItems}</span> strains
        </div>
        <div className="flex items-center justify-end gap-2">
          <span>Strains per page:</span>
          <select
            value={pageSize}
            onChange={e => {
              const val = e.target.value;
              setPageSize(val === 'All' ? 'All' : Number(val));
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-900 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-emerald-500/50 font-bold text-xs"
          >
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={96}>96</option>
            <option value="All">All</option>
          </select>
        </div>
      </div>

      {/* Catalog Comparison view */}
      {currentPath === '/' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {pageGroupedStrains.map(strain => (
            <StrainCard
              key={strain.id}
              strain={strain}
              onOpenPriceHistory={onOpenPriceHistory}
              onNavigateToDetail={(id) => onNavigate(`/strain/${encodeURIComponent(id)}`)}
            />
          ))}
        </div>
      )}

      {/* Rewritten descriptions view */}
      {currentPath === '/rewritten-descriptions' && (
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
                {pageDescriptionStrains.map(strain => {
                  const prose = strain.aiDescription ? strain.aiDescription.description : strain.rewrittenDescription;
                  const isAi = !!strain.aiDescription;
                  const modelName = strain.aiDescription?.modelUsed;
                  return (
                    <tr key={strain.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="px-7 py-4 whitespace-nowrap">
                        <button
                          onClick={() => onNavigate(`/strain/${encodeURIComponent(strain.id)}`)}
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
                            onClick={() => handleCopyProse(strain.id, prose)}
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
                            onClick={() => handleGenerateAiForStrain(strain.id)}
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
      )}

      {/* Plant Descriptions view */}
      {currentPath === '/descriptions' && (
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
                {pageDescriptionStrains.map(strain => {
                  const hasShopDescriptions = strain.descriptions && strain.descriptions.length > 0;
                  const activeShop = selectedDescriptionShops[strain.id] || (hasShopDescriptions ? strain.descriptions[0].shop : 'Generated');
                  const activeDesc = hasShopDescriptions 
                    ? (strain.descriptions.find(d => d.shop === activeShop)?.description || strain.descriptions[0].description)
                    : getFallbackDescription(strain);

                  return (
                    <tr key={strain.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="px-7 py-4 whitespace-nowrap">
                        <button
                          onClick={() => onNavigate(`/strain/${encodeURIComponent(strain.id)}`)}
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
                                onClick={() => {
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-8 border-t border-slate-900 pt-6 select-none">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentPage === 1
                ? 'border-slate-950 bg-slate-950 text-slate-700 cursor-not-allowed'
                : 'border-slate-900 bg-slate-950 text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
          >
            Previous
          </button>
          
          {(() => {
            const pages = [];
            const maxVisible = 5;
            
            if (totalPages <= maxVisible + 2) {
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              pages.push(1);
              
              let start = Math.max(2, currentPage - 1);
              let end = Math.min(totalPages - 1, currentPage + 1);
              
              if (currentPage <= 3) {
                end = 4;
              } else if (currentPage >= totalPages - 2) {
                start = totalPages - 3;
              }
              
              if (start > 2) pages.push('...');
              for (let i = start; i <= end; i++) pages.push(i);
              if (end < totalPages - 1) pages.push('...');
              
              pages.push(totalPages);
            }
            
            return pages.map((page, idx) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-600 font-bold">
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-xl text-xs font-bold border transition-all ${
                    currentPage === page
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-extrabold shadow shadow-emerald-500/5 animate-pulse'
                      : 'border-slate-900 bg-slate-950 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                  }`}
                >
                  {page}
                </button>
              );
            });
          })()}

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentPage === totalPages
                ? 'border-slate-950 bg-slate-950 text-slate-700 cursor-not-allowed'
                : 'border-slate-900 bg-slate-950 text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
}
