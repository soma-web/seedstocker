import React from 'react';
import { TrendingDown, Flame, ExternalLink } from 'lucide-react';

export function getCheapestOffersMap(offers) {
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
}

export function getShopLogoColor(shop) {
  if (shop === 'Zamnesia') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  if (shop === 'Hans Brainfood') return 'text-lime-400 bg-lime-500/10 border-lime-500/20';
  if (shop === 'Gas Station Co. Seeds') return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (shop === 'Gas Station LU') return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
  if (shop === 'Sensi Seeds') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (shop === 'Dutch Passion') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
}

export default function StrainCard({
  strain,
  onOpenPriceHistory,
  onNavigateToDetail
}) {
  const cheapestMap = getCheapestOffersMap(strain.offers);
  const lowestPrice = strain.offers?.length > 0 ? Math.min(...strain.offers.map(o => o.price)) : null;
  
  const sortedOffers = [...strain.offers].sort((a, b) => {
    if (Number(a.seeds) !== Number(b.seeds)) {
      return Number(a.seeds) - Number(b.seeds);
    }
    return Number(a.price) - Number(b.price);
  });

  return (
    <div
      className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between cursor-pointer group/card"
      onClick={() => onNavigateToDetail(strain.id)} 
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onNavigateToDetail(strain.id)}
      aria-label={`View details for ${strain.name}`}
    >
      {/* Strain Card Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2 flex-wrap">
              {strain.name}
              {lowestPrice !== null && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                  from €{lowestPrice.toFixed(2)}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center flex-wrap gap-2">
              by <span className="text-emerald-400 font-semibold">{strain.breeder || 'Unknown Breeder'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPriceHistory(strain.id, strain.name, strain.breeder);
                }}
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
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${(() => {
              if (strain.type === 'autoflower') return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
              if (strain.type === 'fast_flowering') return 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
              if (strain.type === 'triploid') return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
              if (strain.type === 'regular') return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
              return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            })()}`}>
              {(() => {
                if (strain.type === 'autoflower') return 'Auto';
                if (strain.type === 'fast_flowering') return 'Fast';
                if (strain.type === 'triploid') return 'Trip';
                if (strain.type === 'regular') return 'Reg';
                return 'Photo';
              })()}
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
                            onClick={e => e.stopPropagation()}
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
}
