import React, { useState, useCallback } from 'react';
import Sidebar from '../../../shared/components/Sidebar';
import ToastContainer from '../../../shared/components/ToastContainer';
import CommandPalette from '../../../shared/components/CommandPalette';
import useToast from '../../../shared/hooks/useToast';
import useDarkMode from '../../../shared/hooks/useDarkMode';
import useKeyboardShortcut from '../../../shared/hooks/useKeyboardShortcut';
import HiringLogo from '../components/HiringLogo';
import { hiringApi } from '../services/hiringApi';
import DashboardHome from '../sections/DashboardHome';
import CandidatesPage from '../sections/CandidatesPage';
import InterviewsPage from '../sections/InterviewsPage';
import CallbacksPage from '../sections/CallbacksPage';
import SettingsPage from '../sections/SettingsPage';

const NAV_LABELS = {
  dashboard: 'Dashboard', candidates: 'Candidates', interviews: 'Interview Schedule',
  callbacks: 'Callbacks', settings: 'Settings'
};

// Module-level, not `{}` inside the component — a literal recreated on every render gets a
// new reference each time, and every section below keys its data-fetch useCallback/useEffect
// on this exact prop. That churn alone was enough to retrigger full refetches on every
// unrelated re-render of this shell (e.g. the pending-transfers poll), which is how a stale
// background response could land after a user's click and silently overwrite it.
const EMPTY_SCOPE = {};

export default function RecruiterDashboard({ token, user, onLogout }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const { toasts, showToast } = useToast();
  const [isDark, toggleDark] = useDarkMode();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOverride, setSearchOverride] = useState(null);
  const [statusFilterOverride, setStatusFilterOverride] = useState(null);
  const scope = EMPTY_SCOPE;

  const goToCandidatesWithStatus = (status) => {
    setActiveSection('candidates');
    setStatusFilterOverride({ status, ts: Date.now() });
  };

  useKeyboardShortcut('k', () => setPaletteOpen(true), { ctrlOrCmd: true });

  const sections = [
    { title: 'Workspace', items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', sublabel: 'Your daily overview', onClick: () => setActiveSection('dashboard') },
      { key: 'candidates', label: 'Candidates', icon: 'group', sublabel: 'Your assigned candidates', onClick: () => setActiveSection('candidates') },
      { key: 'interviews', label: 'Interview Schedule', icon: 'event', sublabel: 'Upcoming & past interviews', onClick: () => setActiveSection('interviews') },
      { key: 'callbacks', label: 'Callbacks', icon: 'phone_callback', sublabel: 'Scheduled call back times', onClick: () => setActiveSection('callbacks') }
    ]},
    { title: 'Insights', items: [
      { key: 'settings', label: 'Settings', icon: 'settings', sublabel: 'Profile & appearance', onClick: () => setActiveSection('settings') }
    ]}
  ];

  const navItemsForPalette = sections.flatMap(s => s.items.map(i => ({ key: i.key, label: i.label, icon: i.icon, onSelect: i.onClick })));

  const searchCandidates = useCallback((q) => hiringApi.listCandidates(token, { search: q }), [token]);
  const selectCandidate = (candidate) => {
    setActiveSection('candidates');
    // Wrap in a fresh object each time so CandidatesPage's effect re-fires even if the
    // same candidate is picked twice in a row (e.g. reselecting after manually closing).
    // Filters by phone (unique) rather than name, since candidates can share a name.
    setSearchOverride({ search: candidate.phone, ts: Date.now() });
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="h-screen overflow-hidden bg-[#F9F9FF] dark:bg-slate-950 flex text-[#111C2D] dark:text-slate-100">
        <Sidebar
          logo={<HiringLogo className="h-8 w-auto" />}
          roleLabel="Recruiter Workspace"
          sections={sections}
          activeKey={activeSection}
          accent="#7C3AED"
          footer={(
            <div className="p-4 space-y-2">
              <button
                onClick={() => setPaletteOpen(true)}
                className="w-full flex items-center justify-between gap-2 py-1.5 px-2.5 text-[11px] font-semibold rounded border border-white/10 text-slate-300 hover:bg-white/10"
              >
                <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">search</span> Quick search</span>
                <kbd className="text-[9px] font-bold border border-white/20 rounded px-1">Ctrl K</kbd>
              </button>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                </div>
                <button onClick={onLogout} className="shrink-0 text-slate-400 hover:text-white" title="Logout">
                  <span className="material-symbols-outlined text-lg">logout</span>
                </button>
              </div>
            </div>
          )}
        />

        <main className="flex-grow p-6 overflow-y-auto space-y-6 animate-fade-in" key={activeSection}>
          <div className="mb-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-label-caps">Recruiter Portal</span>
            <h1 className="text-lg font-bold text-[#111C2D] dark:text-white font-headline-md">{NAV_LABELS[activeSection]}</h1>
          </div>

          {activeSection === 'dashboard' && <DashboardHome token={token} scope={scope} showToast={showToast} user={user} role="recruiter" onNavigateToCandidates={goToCandidatesWithStatus} />}
          {activeSection === 'candidates' && <CandidatesPage token={token} role="recruiter" scope={scope} showToast={showToast} searchOverride={searchOverride} statusFilterOverride={statusFilterOverride} />}
          {activeSection === 'interviews' && <InterviewsPage token={token} role="recruiter" showToast={showToast} />}
          {activeSection === 'callbacks' && <CallbacksPage token={token} showToast={showToast} />}
          {activeSection === 'settings' && <SettingsPage user={user} isDark={isDark} onToggleDark={toggleDark} />}
        </main>
      </div>
      <ToastContainer toasts={toasts} />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={navItemsForPalette}
        onSearchCandidates={searchCandidates}
        onSelectCandidate={selectCandidate}
      />
    </div>
  );
}
