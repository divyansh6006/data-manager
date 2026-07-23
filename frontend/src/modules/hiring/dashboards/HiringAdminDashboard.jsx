import React, { useState, useEffect, useCallback } from 'react';
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
import UploadDataPage from '../sections/UploadDataPage';
import DistributePage from '../sections/DistributePage';
import RecruitersPage from '../sections/RecruitersPage';
import InterviewsPage from '../sections/InterviewsPage';
import CallbacksPage from '../sections/CallbacksPage';
import TransferApprovalsPage from '../sections/TransferApprovalsPage';
import AnalyticsPage from '../sections/AnalyticsPage';
import SettingsPage from '../sections/SettingsPage';
import DailyTrackerPage from '../sections/DailyTrackerPage';
import RepositoryPage from '../sections/RepositoryPage';

const NAV_LABELS = {
  dashboard: 'Dashboard', candidates: 'Candidates', upload: 'Upload Data', distribute: 'Distribute',
  recruiters: 'Recruiters', transfers: 'Transfer Approvals',
  interviews: 'Interview Schedule', callbacks: 'Callbacks',
  dailyTracker: 'Daily Tracker', repository: 'Master Repository',
  analytics: 'Analytics', settings: 'Settings'
};

// Module-level, not `{}` inside the component — a literal recreated on every render gets a
// new reference each time, and every section below keys its data-fetch useCallback/useEffect
// on this exact prop. That churn alone was enough to retrigger full refetches on every
// unrelated re-render of this shell (e.g. the pending-transfers poll below), which is how a
// stale background response could land after a user's click and silently overwrite it.
const EMPTY_SCOPE = {};

// Full-featured Hiring view — used when Super Admin selects the Hiring workspace. Gives
// everything a "Hiring Manager" would normally do (per spec, there is no separate manager
// role — Super Admin absorbs it directly), reusing the same sections as
// HiringTeamLeaderDashboard, just unrestricted in scope (super_admin sees every team).
export default function HiringAdminDashboard({ token, user, onLogout, onBackToAdmin }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const { toasts, showToast } = useToast();
  const [isDark, toggleDark] = useDarkMode();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOverride, setSearchOverride] = useState(null);
  const [statusFilterOverride, setStatusFilterOverride] = useState(null);
  const [pendingTransfers, setPendingTransfers] = useState(0);
  const scope = EMPTY_SCOPE;

  useEffect(() => {
    const fetchCount = () => hiringApi.listTransferRequests(token).then(r => setPendingTransfers(r.length)).catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 8000);
    return () => clearInterval(interval);
  }, [token]);

  const goToCandidatesWithStatus = (status) => {
    setActiveSection('candidates');
    setStatusFilterOverride({ status, ts: Date.now() });
  };

  useKeyboardShortcut('k', () => setPaletteOpen(true), { ctrlOrCmd: true });

  const sections = [
    { title: 'Workspace', items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', sublabel: 'Organization overview', onClick: () => setActiveSection('dashboard') },
      { key: 'candidates', label: 'Candidates', icon: 'group', sublabel: 'All candidates', onClick: () => setActiveSection('candidates') },
      { key: 'upload', label: 'Upload Data', icon: 'upload_file', sublabel: 'Excel/CSV import & mapping', onClick: () => setActiveSection('upload') },
      { key: 'distribute', label: 'Distribute', icon: 'call_split', sublabel: 'Allocate candidates to recruiters', onClick: () => setActiveSection('distribute') },
      { key: 'recruiters', label: 'Recruiters', icon: 'badge', sublabel: 'Manage recruiters & teams', onClick: () => setActiveSection('recruiters') },
      { key: 'transfers', label: 'Transfer Approvals', icon: 'swap_horiz', sublabel: 'Review candidate transfer requests', badge: pendingTransfers > 0 ? pendingTransfers : null, onClick: () => setActiveSection('transfers') },
      { key: 'interviews', label: 'Interview Schedule', icon: 'event', sublabel: 'Upcoming & past interviews', onClick: () => setActiveSection('interviews') },
      { key: 'callbacks', label: 'Callbacks', icon: 'phone_callback', sublabel: 'Scheduled call back times', onClick: () => setActiveSection('callbacks') }
    ]},
    { title: 'Reporting', items: [
      { key: 'dailyTracker', label: 'Daily Tracker', icon: 'today', sublabel: 'What happened today, by status', onClick: () => setActiveSection('dailyTracker') },
      { key: 'repository', label: 'Master Repository', icon: 'database', sublabel: 'Every candidate, every status', onClick: () => setActiveSection('repository') }
    ]},
    { title: 'Insights', items: [
      { key: 'analytics', label: 'Analytics', icon: 'insights', sublabel: 'Trends & funnels', onClick: () => setActiveSection('analytics') },
      { key: 'settings', label: 'Settings', icon: 'settings', sublabel: 'Profile & appearance', onClick: () => setActiveSection('settings') }
    ]}
  ];

  const navItemsForPalette = sections.flatMap(s => s.items.map(i => ({ key: i.key, label: i.label, icon: i.icon, onSelect: i.onClick })));
  const searchCandidates = useCallback((q) => hiringApi.listCandidates(token, { search: q }), [token]);
  const selectCandidate = (candidate) => {
    setActiveSection('candidates');
    setSearchOverride({ search: candidate.phone, ts: Date.now() });
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="h-screen overflow-hidden bg-[#F9F9FF] dark:bg-slate-950 flex text-[#111C2D] dark:text-slate-100">
        <Sidebar
          logo={<HiringLogo className="h-8 w-auto" />}
          roleLabel="Super Admin — Hiring"
          sections={sections}
          activeKey={activeSection}
          accent="#7C3AED"
          footer={(
            <div className="p-3 space-y-2">
              <button
                onClick={() => setPaletteOpen(true)}
                className="w-full flex items-center justify-between gap-2 py-1.5 px-2.5 text-[11px] font-semibold rounded border border-white/10 text-slate-300 hover:bg-white/10"
              >
                <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">search</span> Quick search</span>
                <kbd className="text-[9px] font-bold border border-white/20 rounded px-1">Ctrl K</kbd>
              </button>
              {onBackToAdmin && (
                <button
                  onClick={onBackToAdmin}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg text-white bg-[#F7941D] hover:bg-[#E08518] shadow-md transition duration-150 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">swap_horiz</span>
                  <span>Switch to Admissions</span>
                </button>
              )}
              <div className="flex items-center justify-between gap-2 px-1">
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
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-label-caps">Hiring Workspace</span>
            <h1 className="text-lg font-bold text-[#111C2D] dark:text-white font-headline-md">{NAV_LABELS[activeSection]}</h1>
          </div>

          {activeSection === 'dashboard' && <DashboardHome token={token} scope={scope} showToast={showToast} user={user} role="super_admin" onNavigateToCandidates={goToCandidatesWithStatus} />}
          {activeSection === 'candidates' && <CandidatesPage token={token} role="super_admin" scope={scope} showToast={showToast} searchOverride={searchOverride} statusFilterOverride={statusFilterOverride} />}
          {activeSection === 'upload' && <UploadDataPage token={token} showToast={showToast} />}
          {activeSection === 'distribute' && <DistributePage token={token} showToast={showToast} />}
          {activeSection === 'recruiters' && <RecruitersPage token={token} role="super_admin" showToast={showToast} />}
          {activeSection === 'transfers' && <TransferApprovalsPage token={token} showToast={showToast} />}
          {activeSection === 'interviews' && <InterviewsPage token={token} role="super_admin" showToast={showToast} />}
          {activeSection === 'callbacks' && <CallbacksPage token={token} showToast={showToast} />}
          {activeSection === 'dailyTracker' && <DailyTrackerPage token={token} showToast={showToast} />}
          {activeSection === 'repository' && <RepositoryPage token={token} showToast={showToast} />}
          {activeSection === 'analytics' && <AnalyticsPage token={token} scope={scope} showToast={showToast} />}
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
