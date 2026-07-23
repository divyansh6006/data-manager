import React from 'react';

// Generalizes the 240px/#0C2340 nav-item-array sidebar pattern used by 3 of the 4
// existing dashboards (Counselor/Manager/SuperAdmin — TeamLeaderDashboard's w-64/#0A2E36
// is the outlier, not used as the shared default here).
//
// sections: [{ title, items: [{ key, label, sublabel, icon, badge, onClick }] }]
export default function Sidebar({ logo, roleLabel, sections, activeKey, footer, accent = '#7C3AED' }) {
  return (
    <aside className="w-[240px] text-white flex flex-col shrink-0 animate-slide-in-left h-screen" style={{ background: '#0C2340' }}>
      <div className="flex flex-col min-h-0 flex-1">
        <div className="p-4 border-b flex flex-col items-start gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {logo}
          {roleLabel && (
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{roleLabel}</span>
          )}
        </div>

        <nav className="mt-6 space-y-4 px-4 overflow-y-auto flex-1 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
          {sections.map(section => (
            <div key={section.title}>
              <div className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map(item => {
                  const isActive = activeKey === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={item.onClick}
                      title={item.sublabel}
                      className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${isActive ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                      style={isActive ? { background: accent } : {}}
                    >
                      {isActive && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                      <span className="material-symbols-outlined text-lg">{item.icon}</span>
                      <span className="flex flex-col items-start leading-tight text-left flex-grow min-w-0">
                        <span className="truncate w-full">{item.label}</span>
                        {item.sublabel && (
                          <span className={`text-[9.5px] font-normal truncate w-full ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{item.sublabel}</span>
                        )}
                      </span>
                      {item.badge > 0 && (
                        <span className="shrink-0 bg-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-badge-pop" style={{ color: accent }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {footer && (
        <div className="shrink-0 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {footer}
        </div>
      )}
    </aside>
  );
}
