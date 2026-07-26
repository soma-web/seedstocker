import React from 'react';
import { Search } from 'lucide-react';

export default function StrainFilters({
  search,
  setSearch,
  selectedBreeder,
  setSelectedBreeder,
  selectedShop,
  setSelectedShop,
  sortBy = 'name_asc',
  setSortBy,
  typeFilter,
  setTypeFilter,
  seedTypeFilter,
  setSeedTypeFilter,
  onlyAvailable,
  setOnlyAvailable,
  minFloweringFilter,
  setMinFloweringFilter,
  maxFloweringFilter,
  setMaxFloweringFilter,
  selectedLetter,
  setSelectedLetter,
  breeders = []
}) {
  const letters = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];

  return (
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
        <div className="w-full lg:w-44">
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
        <div className="w-full lg:w-44">
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
            <option value="Gas Station LU">Gas Station LU</option>
            <option value="Sensi Seeds">Sensi Seeds</option>
            <option value="Dutch Passion">Dutch Passion</option>
          </select>
        </div>

        {/* Sort By Dropdown */}
        <div className="w-full lg:w-52">
          <select
            value={sortBy}
            onChange={e => setSortBy && setSortBy(e.target.value)}
            className="w-full h-12 px-4 bg-slate-950 border border-slate-900 rounded-xl text-emerald-400 font-semibold focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
          >
            <option value="name_asc">Sort: Name (A-Z)</option>
            <option value="price_asc">Sort: Price (Low → High)</option>
            <option value="price_desc">Sort: Price (High → Low)</option>
            <option value="price_per_seed_asc">Sort: Price/Seed (Low → High)</option>
            <option value="offers_desc">Sort: Most Offers</option>
            <option value="name_desc">Sort: Name (Z-A)</option>
          </select>
        </div>

      </div>

      {/* Starting Letter Filter */}
      <div className="flex flex-col gap-2 border-t border-slate-900/60 pt-4">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider select-none">Starting Letter</span>
        <div className="flex flex-wrap gap-1">
          {letters.map(letter => {
            const isSelected = (!selectedLetter && letter === 'All') || (selectedLetter === letter);
            const value = letter === 'All' ? '' : letter;
            return (
              <button
                key={letter}
                onClick={() => setSelectedLetter(value)}
                className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-extrabold shadow shadow-emerald-500/10'
                    : 'border-slate-900 bg-slate-950 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-900 pt-4">
        
        {/* Type Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Strain Type</span>
          {[
            { label: 'All', value: '' },
            { label: 'Autoflower', value: 'autoflower' },
            { label: 'Photoperiodic', value: 'photoperiodic' },
            { label: 'Fast Flowering', value: 'fast_flowering' },
            { label: 'Triploid', value: 'triploid' }
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
  );
}
