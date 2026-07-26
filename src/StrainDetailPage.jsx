import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Flame,
  TrendingDown,
  Info,
  RotateCw,
  Leaf,
  ShoppingCart,
  Star,
  Sparkles,
  Package,
  Trash2
} from 'lucide-react';

import { API_BASE_URL } from './hooks/useApi';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getShopColor(shop) {
  if (shop === 'Zamnesia') return { pill: 'text-orange-400 bg-orange-500/10 border-orange-500/20', accent: '#f97316' };
  if (shop === 'Hans Brainfood') return { pill: 'text-lime-400 bg-lime-500/10 border-lime-500/20', accent: '#84cc16' };
  if (shop === 'Gas Station Co. Seeds') return { pill: 'text-red-400 bg-red-500/10 border-red-500/20', accent: '#ef4444' };
  if (shop === 'Gas Station LU') return { pill: 'text-purple-400 bg-purple-500/10 border-purple-500/20', accent: '#a855f7' };
  if (shop === 'Sensi Seeds') return { pill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', accent: '#10b981' };
  if (shop === 'Dutch Passion') return { pill: 'text-amber-400 bg-amber-500/10 border-amber-500/20', accent: '#f59e0b' };
  if (shop === "Barney's Farm" || shop === "Barneys Farm") return { pill: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', accent: '#eab308' };
  return { pill: 'text-blue-400 bg-blue-500/10 border-blue-500/20', accent: '#38bdf8' };
}

function getTypeStyle(type) {
  if (type === 'autoflower') {
    return {
      gradient: 'linear-gradient(135deg, #1e0a2e 0%, #0f172a 45%, #031410 100%)',
      radial: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
      pill: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      label: '⚡ Autoflower',
      textColor: 'text-purple-400',
      glowColor: 'rgba(139,92,246,0.12)'
    };
  }
  if (type === 'fast_flowering') {
    return {
      gradient: 'linear-gradient(135deg, #2e0a1a 0%, #0f172a 45%, #18031a 100%)',
      radial: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)',
      pill: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      label: '🚀 Fast Flowering',
      textColor: 'text-pink-400',
      glowColor: 'rgba(236,72,153,0.12)'
    };
  }
  if (type === 'triploid') {
    return {
      gradient: 'linear-gradient(135deg, #0a202e 0%, #0f172a 45%, #031a18 100%)',
      radial: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
      pill: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      label: '🧬 Triploid',
      textColor: 'text-cyan-400',
      glowColor: 'rgba(6,182,212,0.12)'
    };
  }
  if (type === 'regular') {
    return {
      gradient: 'linear-gradient(135deg, #1c1c1c 0%, #0f172a 45%, #0f172a 100%)',
      radial: 'radial-gradient(circle, rgba(148,163,184,0.12) 0%, transparent 70%)',
      pill: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      label: '🌿 Regular',
      textColor: 'text-slate-400',
      glowColor: 'rgba(148,163,184,0.12)'
    };
  }
  // photoperiodic is the default
  return {
    gradient: 'linear-gradient(135deg, #031a0e 0%, #0f172a 45%, #001a1a 100%)',
    radial: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
    pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    label: '🌱 Photoperiodic',
    textColor: 'text-emerald-400',
    glowColor: 'rgba(16,185,129,0.1)'
  };
}

function getCheapestMap(offers) {
  const grouped = {};
  offers.forEach(o => {
    if (!grouped[o.seeds]) grouped[o.seeds] = [];
    grouped[o.seeds].push(o);
  });
  const map = {};
  Object.keys(grouped).forEach(s => {
    map[s] = Math.min(...grouped[s].map(o => o.price));
  });
  return map;
}

function buildDescription(strain) {
  const typeLabelMap = {
    'autoflower': 'autoflowering',
    'photoperiodic': 'photoperiodic',
    'fast_flowering': 'fast flowering',
    'triploid': 'triploid',
    'regular': 'regular'
  };
  const type = typeLabelMap[strain.type] || strain.type || 'photoperiodic';
  const seedKind = strain.seedType === 'feminized' ? 'feminized' : 'regular';
  const shopCount = new Set((strain.offers || []).map(o => o.shop)).size;
  const breeder = strain.breeder || 'an independent breeder';
  const lowestPrice = strain.offers?.length > 0 ? Math.min(...strain.offers.map(o => o.price)) : null;
  const packs = Array.from(new Set((strain.offers || []).map(o => o.seeds))).sort((a, b) => Number(a) - Number(b));
  return [
    `${strain.name} is a ${type} cannabis strain produced by ${breeder}.`,
    packs.length > 0
      ? `It is sold as ${seedKind} seeds in pack sizes of ${packs.join(', ')} seeds.`
      : `It is sold as ${seedKind} seeds.`,
    shopCount > 0
      ? `Currently tracked at ${shopCount} shop${shopCount > 1 ? 's' : ''}${lowestPrice !== null ? `, with prices starting from €${lowestPrice.toFixed(2)}` : ''}.`
      : 'No offers are currently being tracked for this strain.'
  ].join(' ');
}

// â”€â”€ Price History Chart Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PriceHistorySection({ strainId }) {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSize, setActiveSize] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/strains/${strainId}/price-history`);
        if (res.ok) {
          const data = await res.json();
          setHistoryData(data);
          const sizes = Array.from(new Set(data.map(d => d.seeds))).sort((a, b) => Number(a) - Number(b));
          if (sizes.length > 0) setActiveSize(Number(sizes[0]));
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [strainId]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 gap-3">
      <RotateCw className="w-5 h-5 text-emerald-400 animate-spin" />
      <span className="text-sm text-slate-500">Loading price history…</span>
    </div>
  );

  if (historyData.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      <TrendingDown className="w-8 h-8 text-slate-700" />
      <p className="text-sm text-slate-500">No price history recorded yet.</p>
      <p className="text-xs text-slate-600">Price changes are tracked automatically on each scrape run.</p>
    </div>
  );

  const packSizes = Array.from(new Set(historyData.map(d => d.seeds))).sort((a, b) => Number(a) - Number(b));
  const currentSize = packSizes.includes(activeSize) ? activeSize : Number(packSizes[0]);
  const filtered = historyData.filter(d => Number(d.seeds) === currentSize);
  const allPrices = filtered.map(d => d.price);
  const maxP = Math.max(...allPrices);
  const minP = Math.min(...allPrices);
  const range = maxP - minP;
  const yMin = minP - (range * 0.15 || 3);
  const yMax = maxP + (range * 0.15 || 3);
  const allDates = filtered.map(d => new Date(d.fetchedAt).getTime());
  const maxDate = Math.max(...allDates);
  const minDate = Math.min(...allDates);
  const dateRange = maxDate - minDate;
  const getSvgX = dateStr => dateRange === 0 ? 300 : 50 + ((new Date(dateStr).getTime() - minDate) / dateRange) * 480;
  const getSvgY = price => {
    const spread = yMax - yMin;
    return spread === 0 ? 80 : 130 - ((price - yMin) / spread) * 100;
  };
  const shops = Array.from(new Set(filtered.map(d => d.shop)));
  const colorMap = { 'Zamnesia': '#f97316', 'House of Seeds': '#38bdf8', 'Hans Brainfood': '#84cc16', 'Gas Station Co. Seeds': '#ef4444', 'Gas Station LU': '#a855f7', 'Sensi Seeds': '#10b981', 'Dutch Passion': '#f59e0b', "Barney's Farm": '#eab308' };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest shrink-0">Pack Size</span>
        <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-900">
          {packSizes.map(size => (
            <button
              key={size}
              onClick={() => setActiveSize(Number(size))}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                currentSize === Number(size) ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {size} Seeds
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 border-b border-slate-900/60 pb-2">
          <span className="text-[10px] text-slate-400 font-bold">Price Trend (EUR)</span>
          <div className="flex gap-3 text-[10px]">
            {shops.map(shop => (
              <div key={shop} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorMap[shop] || '#94a3b8' }} />
                <span className="text-slate-500">{shop}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-44 w-full">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160">
            <line x1="50" y1="30" x2="550" y2="30" stroke="#1e293b" strokeDasharray="3,3" />
            <line x1="50" y1="80" x2="550" y2="80" stroke="#1e293b" strokeDasharray="3,3" strokeOpacity="0.5" />
            <line x1="50" y1="130" x2="550" y2="130" stroke="#1e293b" strokeDasharray="3,3" />
            <text x="10" y="34" className="fill-slate-600 text-[9px] font-mono font-bold">€{yMax.toFixed(2)}</text>
            <text x="10" y="134" className="fill-slate-600 text-[9px] font-mono font-bold">€{yMin.toFixed(2)}</text>
            {shops.map(shop => {
              const pts = filtered.filter(d => d.shop === shop).sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
              if (pts.length < 2) return null;
              const color = colorMap[shop] || '#94a3b8';
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getSvgX(p.fetchedAt).toFixed(1)} ${getSvgY(p.price).toFixed(1)}`).join(' ');
              return <path key={shop} d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
            })}
            {shops.map(shop => {
              const color = colorMap[shop] || '#94a3b8';
              return filtered.filter(d => d.shop === shop).map(p => {
                const x = getSvgX(p.fetchedAt);
                const y = getSvgY(p.price);
                return (
                  <g key={p.id} className="group">
                    <circle cx={x} cy={y} r="4" fill="#020617" stroke={color} strokeWidth="2" className="cursor-pointer" />
                    <text x={x} y={y - 12} textAnchor="middle" className="opacity-0 group-hover:opacity-100 fill-emerald-400 text-[9px] font-bold font-mono transition-opacity pointer-events-none">
                      €{p.price.toFixed(2)}
                    </text>
                  </g>
                );
              });
            })}
          </svg>
        </div>
      </div>

      <div className="overflow-x-auto max-h-64 rounded-xl border border-slate-900 bg-slate-950/40">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-semibold text-[10px]">
              <th className="p-3">Date</th><th className="p-3">Shop</th><th className="p-3">Pack</th><th className="p-3">Price</th><th className="p-3 text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60 text-slate-300">
            {historyData.map((item, index) => {
              const prev = historyData.slice(index + 1).find(x => x.shop === item.shop && x.seeds === item.seeds);
              let indicator = prev
                ? (item.price > prev.price
                  ? <span className="text-red-400 font-bold">&uarr; +€{(item.price - prev.price).toFixed(2)}</span>
                  : item.price < prev.price
                    ? <span className="text-emerald-400 font-bold">&darr; &minus;€{Math.abs(item.price - prev.price).toFixed(2)}</span>
                    : <span className="text-slate-500">&mdash;</span>)
                : <span className="text-slate-600 italic text-[9px]">First</span>;
              return (
                <tr key={item.id} className="hover:bg-slate-900/20">
                  <td className="p-3 font-mono text-[10px] text-slate-500">{new Date(item.fetchedAt).toLocaleString()}</td>
                  <td className="p-3 font-bold">{item.shop}</td>
                  <td className="p-3">{item.seeds} Seeds</td>
                  <td className="p-3 text-emerald-400 font-semibold">€{item.price.toFixed(2)}</td>
                  <td className="p-3 text-right">{indicator}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────

export default function StrainDetailPage({ strainId, onBack, onNavigate }) {
  const [strain, setStrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('shops');
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    name: '',
    breeder: '',
    type: '',
    seedType: '',
    thc: '',
    cbd: '',
    strainType: '',
    floweringTime: '',
    floweringMin: '',
    floweringMax: '',
    environment: '',
    plantHeight: '',
    harvestMonth: '',
    effects: '',
    rating: '',
    seedfinderUrl: '',
    harvestYield: '',
    genetics: '',
    rewrittenDescription: ''
  });

  const handleStartEdit = () => {
    setEditFields({
      name: strain.name || '',
      breeder: strain.breeder || '',
      type: strain.type || 'photoperiodic',
      seedType: strain.seedType || 'feminized',
      thc: strain.thc || '',
      cbd: strain.cbd || '',
      strainType: strain.strainType || '',
      floweringTime: strain.floweringTime || '',
      floweringMin: strain.floweringMin !== null ? String(strain.floweringMin) : '',
      floweringMax: strain.floweringMax !== null ? String(strain.floweringMax) : '',
      environment: strain.environment || '',
      plantHeight: strain.plantHeight || '',
      harvestMonth: strain.harvestMonth || '',
      effects: strain.effects || '',
      rating: strain.rating !== null ? String(strain.rating) : '',
      seedfinderUrl: strain.seedfinderUrl || '',
      harvestYield: strain.harvestYield || '',
      genetics: strain.genetics || '',
      rewrittenDescription: strain.rewrittenDescription || ''
    });
    setIsEditing(false); // reset editing state if toggled back, but here we explicitly open:
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/strains/${strainId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...editFields,
          floweringMin: editFields.floweringMin === '' ? null : Number(editFields.floweringMin),
          floweringMax: editFields.floweringMax === '' ? null : Number(editFields.floweringMax),
          rating: editFields.rating === '' ? null : Number(editFields.rating)
        })
      });
      if (res.ok) {
        setIsEditing(false);
        const refreshRes = await fetch(`${API_BASE_URL}/api/strains/${strainId}/detail`);
        if (refreshRes.ok) setStrain(await refreshRes.json());
      } else {
        const err = await res.json();
        alert('Update failed: ' + (err.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Could not connect to server');
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setLoading(true);
    setStrain(null);
    setImgLoaded(false);
    setImgError(false);
    setActiveSection('shops');
    setCopied(false);
    async function load() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/strains/${strainId}/detail`);
        if (res.ok) {
          const data = await res.json();
          setStrain(data);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [strainId]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <RotateCw className="w-10 h-10 text-emerald-400 animate-spin" />
      <p className="text-slate-400 text-sm">Loading strain details…</p>
    </div>
  );

  if (!strain) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <Info className="w-10 h-10 text-slate-600" />
      <p className="text-slate-400">Strain not found.</p>
      <button onClick={onBack} className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-colors">
        Back to Catalog
      </button>
    </div>
  );

  const sortedOffers = [...(strain.offers || [])].sort((a, b) => {
    if (Number(a.seeds) !== Number(b.seeds)) return Number(a.seeds) - Number(b.seeds);
    return Number(a.price) - Number(b.price);
  });
  const cheapestMap = getCheapestMap(strain.offers || []);
  const shopSet = new Set((strain.offers || []).map(o => o.shop));
  const lowestPrice = strain.offers?.length > 0 ? Math.min(...strain.offers.map(o => o.price)) : null;
  const packs = Array.from(new Set((strain.offers || []).map(o => o.seeds))).sort((a, b) => Number(a) - Number(b));
  const isAuto = strain.type === 'autoflower';
  const typeStyle = getTypeStyle(strain.type);
  const displayLabelMap = {
    'autoflower': 'Autoflower',
    'fast_flowering': 'Fast Flowering',
    'triploid': 'Triploid',
    'regular': 'Regular',
    'photoperiodic': 'Photoperiodic'
  };
  const typeDisplayVal = displayLabelMap[strain.type] || 'Photoperiodic';

  const allBreeders = [
    { id: strain.id, breeder: strain.breeder || 'Unknown' },
    ...((strain.siblings || []).map(s => ({ id: s.id, breeder: s.breeder || 'Unknown' })))
  ].sort((a, b) => a.breeder.localeCompare(b.breeder));
  const hasMultipleBreeders = allBreeders.length > 1;

  const plantImageSrc = `https://source.unsplash.com/featured/1400x560/?cannabis,marijuana,plant,${encodeURIComponent(strain.name.split(' ')[0] || 'cannabis')}`;

  const handleCopyProse = () => {
    const prose = strain.aiDescription ? strain.aiDescription.description : strain.rewrittenDescription;
    if (!prose) return;
    navigator.clipboard.writeText(prose);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${strain.name}"? This will permanently remove all associated offers, price history, and descriptions.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/strains/${strainId}`, { method: 'DELETE' });
      if (res.ok) {
        onBack();
      } else {
        const err = await res.json();
        alert('Delete failed: ' + (err.error || 'Unknown error'));
      }
    } catch {
      alert('Could not connect to server');
    }
  };

  const handleGenerateAi = async () => {
    setAiGenerating(true);
    setAiError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/strains/${strainId}/generate-ai-description`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        // Refresh strain data to pick up new description
        const refreshRes = await fetch(`${API_BASE_URL}/api/strains/${strainId}/detail`);
        if (refreshRes.ok) setStrain(await refreshRes.json());
      } else {
        const err = await res.json();
        setAiError(err.error || 'AI generation failed');
      }
    } catch (e) {
      setAiError('Could not connect to server');
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950" style={{ animation: 'pageFadeIn 0.3s ease-out' }}>
      <style>{`
        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ─── HERO ──────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ height: '460px' }}>

        {!imgError && (
          <img
            src={plantImageSrc}
            alt={`${strain.name} cannabis plant`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ opacity: imgLoaded ? 0.22 : 0 }}
          />
        )}

        <div
          className="absolute inset-0 bg-gradient-to-br"
          style={{
            background: typeStyle.gradient,
            opacity: imgLoaded ? 1 : 1
          }}
        />

        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: typeStyle.radial }} />
        <div className="absolute -bottom-20 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)' }} />

        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/50 via-transparent to-slate-950/50" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-between py-7">

          <div className="self-start flex items-center gap-2 flex-wrap">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 h-10 rounded-xl border border-slate-800/80 bg-slate-950/50 text-slate-300 hover:text-white hover:border-slate-700 backdrop-blur-md transition-all text-sm font-medium group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to Catalog
            </button>
            {!isEditing ? (
              <>
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-2 px-4 h-10 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-305 hover:text-white hover:border-slate-700 backdrop-blur-md transition-all text-sm font-medium"
                >
                  Edit Details
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 h-10 rounded-xl border border-red-800/40 bg-red-950/30 text-red-400 hover:text-red-300 hover:bg-red-900/40 hover:border-red-700/60 backdrop-blur-md transition-all text-sm font-medium group"
                >
                  <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-2 px-4 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all text-sm font-bold shadow-md shadow-emerald-500/20"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-2 px-4 h-10 rounded-xl border border-slate-800 bg-slate-950 text-slate-450 hover:text-slate-200 transition-all text-sm font-medium"
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {isEditing ? (
                <>
                  <div className="flex flex-col gap-1 animate-pulse">
                    <span className="text-[8px] uppercase tracking-widest font-bold text-slate-500">Strain Type</span>
                    <select
                      value={editFields.type}
                      onChange={e => setEditFields({ ...editFields, type: e.target.value })}
                      className="bg-slate-900 border border-slate-800 text-slate-250 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="photoperiodic">🌱 Photoperiodic</option>
                      <option value="autoflower">⚡ Autoflower</option>
                      <option value="fast_flowering">🚀 Fast Flowering</option>
                      <option value="triploid">🧬 Triploid</option>
                      <option value="regular">🌿 Regular</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 animate-pulse">
                    <span className="text-[8px] uppercase tracking-widest font-bold text-slate-500">Seed Type</span>
                    <select
                      value={editFields.seedType}
                      onChange={e => setEditFields({ ...editFields, seedType: e.target.value })}
                      className="bg-slate-900 border border-slate-800 text-slate-250 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-500"
                    >
                      <option value="feminized">♀ Feminized</option>
                      <option value="regular">Regular</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${typeStyle.pill}`}>
                    {typeStyle.label}
                  </span>
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border bg-slate-900/70 text-slate-300 border-slate-700">
                    {strain.seedType === 'feminized' ? '♀ Feminized' : 'Regular'}
                  </span>
                </>
              )}
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-1 mb-3 animate-pulse">
                <span className="text-[8px] uppercase tracking-widest font-bold text-slate-500">Strain Name</span>
                <input
                  type="text"
                  value={editFields.name}
                  onChange={e => setEditFields({ ...editFields, name: e.target.value })}
                  className="text-2xl sm:text-3xl font-black tracking-tight leading-none text-white bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl w-full max-w-2xl focus:outline-none focus:border-emerald-500"
                  placeholder="Strain Name"
                />
              </div>
            ) : (
              <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-none text-white mb-3" style={{ textShadow: '0 2px 40px rgba(0,0,0,0.6)' }}>
                {strain.name}
              </h1>
            )}

            {isEditing ? (
              <div className="flex flex-col gap-1 mb-4 animate-pulse">
                <span className="text-[8px] uppercase tracking-widest font-bold text-slate-500">Breeder</span>
                <div className="flex items-center gap-2 text-emerald-400">
                  <Leaf className="w-4 h-4" />
                  <input
                    type="text"
                    value={editFields.breeder}
                    onChange={e => setEditFields({ ...editFields, breeder: e.target.value })}
                    className="text-sm font-semibold text-emerald-350 bg-slate-900/60 border border-slate-800 px-3 py-1 rounded-lg w-full max-w-md focus:outline-none focus:border-emerald-500"
                    placeholder="Breeder"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-lg mb-4">
                <Leaf className="w-5 h-5" />
                <span>{strain.breeder || 'Unknown Breeder'}</span>
              </div>
            )}

            {hasMultipleBreeders && (
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest shrink-0">Breeder</span>
                <div className="flex flex-wrap gap-1.5 bg-slate-950/60 backdrop-blur-md border border-slate-800/80 p-1 rounded-xl">
                  {allBreeders.map(b => (
                    <button
                      key={b.id}
                      onClick={() => onNavigate && onNavigate(`/strain/${encodeURIComponent(b.id)}`)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        b.id === strain.id
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      {b.breeder}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {lowestPrice !== null && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-sm">
                  <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 font-bold">From €{lowestPrice.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
                <ShoppingCart className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300 font-semibold">{shopSet.size} Shop{shopSet.size !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
                <Package className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300 font-semibold">{sortedOffers.length} Offer{sortedOffers.length !== 1 ? 's' : ''}</span>
              </div>
              {packs.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
                  <Star className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-300 font-semibold">{packs.join(' / ')} Seeds</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        <div className="glass-panel rounded-2xl p-7">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            About This Strain
            {strain.aiDescription && !isEditing && (
              <span className="ml-2 px-1.5 py-0.5 text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded font-semibold uppercase tracking-normal">
                AI ({strain.aiDescription.modelUsed})
              </span>
            )}
          </h2>
          {isEditing ? (
            <div className="w-full space-y-2">
              <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-550">Custom Prose Description</label>
              <textarea
                value={editFields.rewrittenDescription}
                onChange={e => setEditFields({ ...editFields, rewrittenDescription: e.target.value })}
                className="w-full h-32 bg-slate-900/60 border border-slate-800 text-slate-200 p-4 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                placeholder="Write a custom description for this strain..."
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <p className="text-slate-300 leading-relaxed text-base max-w-3xl">
                {(strain.aiDescription ? strain.aiDescription.description : strain.rewrittenDescription) || buildDescription(strain)}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {((strain.aiDescription ? strain.aiDescription.description : strain.rewrittenDescription)) && (
                  <button
                    onClick={handleCopyProse}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                      copied
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy Prose'}
                  </button>
                )}
                <button
                  onClick={handleGenerateAi}
                  disabled={aiGenerating}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    aiGenerating
                      ? 'bg-purple-900/30 border-purple-700/40 text-purple-400 cursor-wait'
                      : 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/50'
                  }`}
                >
                  <Sparkles className={`w-3 h-3 ${aiGenerating ? 'animate-spin' : ''}`} />
                  {aiGenerating ? 'Generating…' : strain.aiDescription ? 'Regenerate AI' : 'Generate AI'}
                </button>
              </div>
            </div>
          )}
          {aiError && !isEditing && (
            <p className="mt-2 text-[10px] text-red-400 font-medium">{aiError}</p>
          )}

          {isEditing ? (
            <div className="mt-8 border-t border-slate-900 pt-6">
              <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-4">Strain Specifications</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* 1. Genetics (Lineage) */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Lineage / Genetics</label>
                  <input
                    type="text"
                    value={editFields.genetics}
                    onChange={e => setEditFields({ ...editFields, genetics: e.target.value })}
                    className="w-full bg-slate-900 text-sky-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Skunk #1 x Northern Lights"
                  />
                </div>

                {/* 2. Genetics Type */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Genetics Type (e.g. Indica/Sativa)</label>
                  <input
                    type="text"
                    value={editFields.strainType}
                    onChange={e => setEditFields({ ...editFields, strainType: e.target.value })}
                    className="w-full bg-slate-900 text-sky-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. indica-dominant"
                  />
                </div>

                {/* 3. THC */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">THC Content</label>
                  <input
                    type="text"
                    value={editFields.thc}
                    onChange={e => setEditFields({ ...editFields, thc: e.target.value })}
                    className="w-full bg-slate-900 text-rose-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 20%"
                  />
                </div>

                {/* 4. CBD */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">CBD Content</label>
                  <input
                    type="text"
                    value={editFields.cbd}
                    onChange={e => setEditFields({ ...editFields, cbd: e.target.value })}
                    className="w-full bg-slate-900 text-indigo-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 1%"
                  />
                </div>

                {/* 5. Flowering Time Prose */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Flowering Time (Prose)</label>
                  <input
                    type="text"
                    value={editFields.floweringTime}
                    onChange={e => setEditFields({ ...editFields, floweringTime: e.target.value })}
                    className="w-full bg-slate-900 text-lime-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 8-9 weeks"
                  />
                </div>

                {/* 6. Flowering Min */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Flowering Min (Weeks)</label>
                  <input
                    type="number"
                    value={editFields.floweringMin}
                    onChange={e => setEditFields({ ...editFields, floweringMin: e.target.value })}
                    className="w-full bg-slate-900 text-lime-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="Min weeks"
                  />
                </div>

                {/* 7. Flowering Max */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Flowering Max (Weeks)</label>
                  <input
                    type="number"
                    value={editFields.floweringMax}
                    onChange={e => setEditFields({ ...editFields, floweringMax: e.target.value })}
                    className="w-full bg-slate-900 text-lime-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="Max weeks"
                  />
                </div>

                {/* 8. Environment */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Environment</label>
                  <select
                    value={editFields.environment}
                    onChange={e => setEditFields({ ...editFields, environment: e.target.value })}
                    className="w-full bg-slate-900 text-teal-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Environment</option>
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="both">Both (Indoor/Outdoor)</option>
                  </select>
                </div>

                {/* 9. Plant Height */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Plant Height</label>
                  <input
                    type="text"
                    value={editFields.plantHeight}
                    onChange={e => setEditFields({ ...editFields, plantHeight: e.target.value })}
                    className="w-full bg-slate-900 text-amber-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Tall, Medium, Short"
                  />
                </div>

                {/* 10. Yield */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Harvest Yield</label>
                  <input
                    type="text"
                    value={editFields.harvestYield}
                    onChange={e => setEditFields({ ...editFields, harvestYield: e.target.value })}
                    className="w-full bg-slate-900 text-amber-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Heavy, Medium"
                  />
                </div>

                {/* 11. Harvest Month */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Harvest Month</label>
                  <input
                    type="text"
                    value={editFields.harvestMonth}
                    onChange={e => setEditFields({ ...editFields, harvestMonth: e.target.value })}
                    className="w-full bg-slate-900 text-amber-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Late October"
                  />
                </div>

                {/* 12. Effects */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Effects / High</label>
                  <input
                    type="text"
                    value={editFields.effects}
                    onChange={e => setEditFields({ ...editFields, effects: e.target.value })}
                    className="w-full bg-slate-900 text-orange-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Relaxed, Uplifting"
                  />
                </div>

                {/* 13. Rating */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Rating (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={editFields.rating}
                    onChange={e => setEditFields({ ...editFields, rating: e.target.value })}
                    className="w-full bg-slate-900 text-yellow-400 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 4.5"
                  />
                </div>

                {/* 14. Seedfinder URL */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-1.5 md:col-span-2 lg:col-span-3">
                  <label className="block text-[9px] uppercase tracking-widest font-bold text-slate-600">Seedfinder URL</label>
                  <input
                    type="text"
                    value={editFields.seedfinderUrl}
                    onChange={e => setEditFields({ ...editFields, seedfinderUrl: e.target.value })}
                    className="w-full bg-slate-900 text-slate-300 text-sm font-bold px-2.5 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: 'Strain Type', value: typeDisplayVal, color: typeStyle.textColor },
                { label: 'Seed Type',   value: strain.seedType === 'feminized' ? 'Feminized' : 'Regular', color: 'text-teal-400' },
                { label: 'Genetics',    value: strain.strainType ? strain.strainType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-') : 'Not available', color: 'text-sky-400' },
                { label: 'THC',         value: strain.thc || 'Not available', color: 'text-rose-400' },
                { label: 'CBD',         value: strain.cbd || 'Not available', color: 'text-indigo-400' },
                { label: 'Flowering',   value: strain.floweringMin && strain.floweringMax ? (strain.floweringMin === strain.floweringMax ? `${strain.floweringMin} weeks` : `${strain.floweringMin}–${strain.floweringMax} weeks`) : (strain.floweringTime ? `${strain.floweringTime} weeks` : 'Not available'), color: 'text-lime-400' },
                { label: 'Breeder',     value: strain.breeder || 'Unknown', color: 'text-slate-200' },
                { label: 'Pack Sizes',  value: packs.length > 0 ? packs.join(', ') + ' Seeds' : 'Not available', color: 'text-amber-400' },
              ].map(attr => (
                <div key={attr.label} className="bg-slate-950/60 border border-slate-900 rounded-xl p-4">
                  <span className="block text-[9px] uppercase tracking-widest font-bold text-slate-600 mb-1.5">{attr.label}</span>
                  <span className={`block text-sm font-bold truncate ${attr.color}`}>{attr.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-900/60 border border-slate-800 p-1 rounded-xl w-fit">
          {[
            { id: 'shops',   icon: ShoppingCart, label: 'Shop Availability' },
            { id: 'history', icon: TrendingDown,  label: 'Price History' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-5 h-10 rounded-lg text-sm font-semibold transition-all ${
                activeSection === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* â”€â”€ Shop Availability â”€â”€ */}
        {activeSection === 'shops' && (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-7 py-5 border-b border-slate-900">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                Where to Buy
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">All shops currently stocking this strain, compared by price.</p>
            </div>

            {sortedOffers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Info className="w-8 h-8 text-slate-700" />
                <p className="text-slate-500 text-sm">No shop offers are being tracked yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-900 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      <th className="px-7 py-4">Shop</th>
                      <th className="px-7 py-4">Pack Size</th>
                      <th className="px-7 py-4">Price</th>
                      <th className="px-7 py-4">Availability</th>
                      <th className="px-7 py-4 text-right">Direct Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/50">
                    {sortedOffers.map(o => {
                      const isBest = cheapestMap[o.seeds] === o.price;
                      const shopStyle = getShopColor(o.shop);
                      return (
                        <tr key={o.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="px-7 py-4">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${shopStyle.pill}`}>
                              {o.shop}
                            </span>
                          </td>
                          <td className="px-7 py-4 font-mono text-slate-400 text-sm">
                            {o.seeds} Seed{Number(o.seeds) > 1 ? 's' : ''}
                          </td>
                          <td className="px-7 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-black font-mono text-lg ${isBest ? 'text-emerald-400' : 'text-slate-200'}`}>
                                €{o.price.toFixed(2)}
                              </span>
                              {isBest && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                  <Flame className="w-2.5 h-2.5 animate-pulse" /> Best Price
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-7 py-4">
                            <span className={`inline-flex items-center gap-2 text-sm font-semibold ${
                              o.availability === 'available' ? 'text-emerald-400' :
                              o.availability === 'orderable' ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                o.availability === 'available'  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' :
                                o.availability === 'orderable'  ? 'bg-amber-500  shadow-[0_0_6px_rgba(245,158,11,0.6)]' :
                                'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                              }`} />
                              {o.availability === 'available'  ? 'In Stock' :
                               o.availability === 'orderable'  ? 'Orderable' : 'Out of Stock'}
                            </span>
                          </td>
                          <td className="px-7 py-4 text-right">
                            <a
                              href={o.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-all"
                            >
                              Buy Now
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ Price History â”€â”€ */}
        {activeSection === 'history' && (
          <div className="glass-panel rounded-2xl p-7">
            <div className="mb-6 border-b border-slate-900 pb-5">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-emerald-400" />
                Price History
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Price changes recorded each time the scraper detects a shift.</p>
            </div>
            <PriceHistorySection strainId={strainId} />
          </div>
        )}

      </div>
    </div>
  );
}

