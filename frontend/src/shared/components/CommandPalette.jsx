import React, { useState, useEffect, useRef, useMemo } from 'react';
import useDebounce from '../hooks/useDebounce';

// Ctrl+K / Cmd+K quick-nav + quick-search overlay. navItems are always shown (filtered by
// label match); if onSearchCandidates is provided and the query is 2+ chars, live search
// results are appended below. Arrow keys move the highlight, Enter activates, Escape closes.
export default function CommandPalette({ isOpen, onClose, navItems = [], onSearchCandidates, onSelectCandidate, accent = '#7C3AED' }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [candidateResults, setCandidateResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setCandidateResults([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !onSearchCandidates || debouncedQuery.trim().length < 2) {
      setCandidateResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    onSearchCandidates(debouncedQuery.trim())
      .then((results) => { if (!cancelled) setCandidateResults(results.slice(0, 8)); })
      .catch(() => { if (!cancelled) setCandidateResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, isOpen, onSearchCandidates]);

  const filteredNav = useMemo(() => {
    if (!query.trim()) return navItems;
    const q = query.trim().toLowerCase();
    return navItems.filter(i => i.label.toLowerCase().includes(q));
  }, [navItems, query]);

  const allResults = useMemo(() => [
    ...filteredNav.map(i => ({ type: 'nav', ...i })),
    ...candidateResults.map(c => ({ type: 'candidate', key: `cand-${c.id}`, label: c.name, sublabel: c.phone, candidate: c }))
  ], [filteredNav, candidateResults]);

  useEffect(() => { setActiveIndex(0); }, [allResults.length]);

  if (!isOpen) return null;

  const activate = (item) => {
    if (!item) return;
    if (item.type === 'candidate') {
      onSelectCandidate && onSelectCandidate(item.candidate);
    } else {
      item.onSelect && item.onSelect();
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, allResults.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); activate(allResults[activeIndex]); }
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-start justify-center bg-black bg-opacity-40 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E2E8F0] dark:border-slate-700">
          <span className="material-symbols-outlined text-slate-400">search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages or candidates... (Name, phone, email)"
            className="flex-grow text-sm bg-transparent outline-none text-[#111C2D] dark:text-white placeholder-slate-400"
          />
          <kbd className="text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filteredNav.length > 0 && (
            <div className="px-2">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Go to</p>
              {filteredNav.map((item, idx) => {
                const globalIdx = idx;
                return (
                  <button
                    key={item.key}
                    onClick={() => activate({ type: 'nav', ...item })}
                    onMouseEnter={() => setActiveIndex(globalIdx)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left text-sm ${activeIndex === globalIdx ? 'text-white' : 'text-[#111C2D] dark:text-slate-200'}`}
                    style={activeIndex === globalIdx ? { background: accent } : {}}
                  >
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          {onSearchCandidates && debouncedQuery.trim().length >= 2 && (
            <div className="px-2 mt-1">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Candidates {searching ? '(searching...)' : ''}
              </p>
              {candidateResults.length === 0 && !searching && (
                <p className="px-2.5 py-2 text-xs text-slate-400 italic">No matching candidates.</p>
              )}
              {candidateResults.map((c, idx) => {
                const globalIdx = filteredNav.length + idx;
                return (
                  <button
                    key={c.id}
                    onClick={() => activate({ type: 'candidate', candidate: c })}
                    onMouseEnter={() => setActiveIndex(globalIdx)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left ${activeIndex === globalIdx ? 'text-white' : 'text-[#111C2D] dark:text-slate-200'}`}
                    style={activeIndex === globalIdx ? { background: accent } : {}}
                  >
                    <span className="material-symbols-outlined text-lg">person</span>
                    <span className="flex-grow min-w-0">
                      <span className="block text-sm truncate">{c.name}</span>
                      <span className={`block text-[10px] font-data-mono truncate ${activeIndex === globalIdx ? 'text-white/70' : 'text-slate-400'}`}>{c.phone}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {allResults.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-slate-400 italic">No results.</p>
          )}
        </div>
      </div>
    </div>
  );
}
