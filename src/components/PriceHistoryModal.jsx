import React from 'react';
import { TrendingDown, X, Info, RotateCw } from 'lucide-react';

export default function PriceHistoryModal({
  isOpen,
  onClose,
  priceHistoryMeta,
  loadingHistory,
  priceHistoryData = [],
  selectedChartSize,
  setSelectedChartSize
}) {
  if (!isOpen) return null;

  const colorMap = {
    'Zamnesia': { stroke: '#f97316' },
    'House of Seeds': { stroke: '#0ea5e9' },
    'Hans Brainfood': { stroke: '#a855f7' },
    'Gas Station Co. Seeds': { stroke: '#ef4444' },
    'Gas Station LU': { stroke: '#14b8a6' },
    'Sensi Seeds': { stroke: '#10b981' },
    'Dutch Passion': { stroke: '#f59e0b' },
    "Barney's Farm": { stroke: '#eab308' }
  };
  const defaultColors = { stroke: '#94a3b8' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl glass-panel rounded-2xl p-6 relative overflow-hidden shadow-2xl border border-slate-800 animate-scale-up">
        
        {/* Close Button */}
        <button
          onClick={onClose}
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
  );
}
