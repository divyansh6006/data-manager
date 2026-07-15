/**
 * ============================================================================
 * Skill Labs Data Manager - Core Application Service
 *
 * Designed and Developed by:
 *   DIVYANSH KUMAR SHARMA
 *   Associate Product Manager - AI Product and Platforms
 *   Skill Labs Resource Service Private Limited
 *   Phone: +91 6006291486
 *   Email: divyansh6005@gmail.com
 *
 * Description:
 *   Team Leader Operations Portal. Tracks counselor activity logs, daily track
 *   metrics, and handles escalated/transferred lead approvals for their team.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';

// Reusable Masked Phone Component
const MaskedPhone = ({ phone }) => {
  const [visible, setVisible] = useState(false);

  if (!phone) return <span className="text-slate-400 italic font-body-sm">—</span>;

  const maskNumber = (num) => {
    if (num.length <= 4) return num;
    return num.slice(0, 2) + '*'.repeat(num.length - 4) + num.slice(-2);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-data-mono font-bold tracking-wide">
        {visible ? phone : maskNumber(phone)}
      </span>
      <button
        onClick={() => setVisible(!visible)}
        type="button"
        className="p-0.5 hover:bg-slate-100 rounded text-slate-500 transition active:scale-90 flex items-center justify-center"
        title={visible ? "Hide number" : "Show number"}
      >
        <span className="material-symbols-outlined text-[14px]">
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </span>
  );
};

// Reusable Masked Email Component
const MaskedEmail = ({ email }) => {
  const [visible, setVisible] = useState(false);

  if (!email) return <span className="text-slate-400 italic font-body-sm">—</span>;

  const maskEmail = (str) => {
    const parts = str.split('@');
    if (parts.length !== 2) return str;
    const [user, domain] = parts;
    if (user.length <= 2) {
      return user[0] + '*' + '@' + domain;
    }
    return user[0] + '*'.repeat(user.length - 2) + user.slice(-1) + '@' + domain;
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-data-mono">
        {visible ? email : maskEmail(email)}
      </span>
      <button
        onClick={() => setVisible(!visible)}
        type="button"
        className="p-0.5 hover:bg-slate-100 rounded text-slate-500 transition active:scale-90 flex items-center justify-center"
        title={visible ? "Hide email" : "Show email"}
      >
        <span className="material-symbols-outlined text-[14px]">
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </span>
  );
};

const SkillLabsLogo = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" className={className}>
    <text x="0" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="38" fill="#1BACE4" letterSpacing="-1.5">Skill</text>
    <text x="92" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="300" fontSize="38" fill="#F7941D" letterSpacing="-1.5">Labs</text>
  </svg>
);

export default function TeamLeaderDashboard({ token, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('reports'); // reports, tracking, activity, transfers, forwarded, dropped
  const [counselors, setCounselors] = useState([]);

  // Gamification & Animations
  const [celebrations, setCelebrations] = useState([]);
  const [particles, setParticles] = useState([]);

  const triggerCelebration = (text) => {
    const id = Date.now() + Math.random();
    setCelebrations(prev => [...prev, { id, text }]);
    const newParticles = Array.from({ length: 40 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      return {
        id: id + i,
        left: '50%',
        top: '50%',
        size: 5 + Math.random() * 8,
        color: ['#1BACE4', '#F7941D', '#34D399', '#A78BFA', '#F472B6'][Math.floor(Math.random() * 5)],
        tx: `${Math.cos(angle) * speed * 25}px`,
        ty: `${Math.sin(angle) * speed * 25}px`,
        rot: `${Math.random() * 360}deg`
      };
    });
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setCelebrations(prev => prev.filter(c => c.id !== id));
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 3000);
  };

  const handleTabClick = (setTab, tab, e) => {
    setTab(tab);
    if (!e) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const clickParticles = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      return {
        id: `tab-click-${Date.now()}-${i}-${Math.random()}`,
        left: `${x}px`,
        top: `${y}px`,
        size: 4 + Math.random() * 4,
        color: '#F7941D',
        tx: `${Math.cos(angle) * speed * 15}px`,
        ty: `${Math.sin(angle) * speed * 15}px`,
        rot: '0deg'
      };
    });
    setParticles(prev => [...prev, ...clickParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !clickParticles.find(cp => cp.id === p.id)));
    }, 800);
  };

  // State Variables
  const [transferRequests, setTransferRequests] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [resolutionType, setResolutionType] = useState(null); // approved, rejected
  const [resolutionNote, setResolutionNote] = useState('');
  const [overrideTarget, setOverrideTarget] = useState('');

  const [forwardedLeads, setForwardedLeads] = useState([]);
  const [forwardedLoading, setForwardedLoading] = useState(false);
  const [resolveModalLead, setResolveModalLead] = useState(null);
  const [resolveAction, setResolveAction] = useState('send_back');
  const [resolveTargetCounselor, setResolveTargetCounselor] = useState('');
  const [resolveRemark, setResolveRemark] = useState('');

  const [droppedLeads, setDroppedLeads] = useState([]);
  const [droppedLoading, setDroppedLoading] = useState(false);
  const [droppedSearchQuery, setDroppedSearchQuery] = useState('');

  const [metrics, setMetrics] = useState({ stages: [], closures: [], unassigned: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [sourceBreakdown, setSourceBreakdown] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const [forwardedSearchQuery, setForwardedSearchQuery] = useState('');

  // Daily Status Tracker States
  const [trackingDate, setTrackingDate] = useState(new Date().toISOString().slice(0, 10));
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingCategory, setTrackingCategory] = useState('all');
  const [trackingSearch, setTrackingSearch] = useState('');

  // Counselor Activity Logs States
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityCounselorFilter, setActivityCounselorFilter] = useState('');
  const [activityActionFilter, setActivityActionFilter] = useState('');
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState('');
  const [activitySearch, setActivitySearch] = useState('');

  // Initial Data Load
  useEffect(() => {
    fetchCounselors();
    fetchReports();
  }, []);

  const fetchCounselors = async () => {
    try {
      const response = await fetch('/api/users/counselors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCounselors(data);
      }
    } catch (err) {
      console.error('Failed to fetch team counselors', err);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [pipelineRes, leaderboardRes, sourceRes] = await Promise.all([
        fetch('/api/reports/pipeline', { headers }),
        fetch('/api/reports/counselor-leaderboard', { headers }),
        fetch('/api/reports/source-breakdown', { headers })
      ]);

      if (pipelineRes.ok && leaderboardRes.ok && sourceRes.ok) {
        setMetrics(await pipelineRes.json());
        setLeaderboard(await leaderboardRes.json());
        setSourceBreakdown(await sourceRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch team reports', err);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchDailyTracking = async (date) => {
    setTrackingLoading(true);
    try {
      const response = await fetch(`/api/leads/daily-tracking?date=${date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTrackingData(data);
        setTrackingCategory('all');
      } else {
        console.error('Tracking error:', data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTrackingLoading(false);
    }
  };

  const fetchActivityLogs = async (params = {}) => {
    setActivityLoading(true);
    try {
      const query = new URLSearchParams();
      if (params.counselor_id || activityCounselorFilter) query.append('counselor_id', params.counselor_id ?? activityCounselorFilter);
      if (params.action_type !== undefined ? params.action_type : activityActionFilter) query.append('action_type', params.action_type ?? activityActionFilter);
      if (params.date_from !== undefined ? params.date_from : activityDateFrom) query.append('date_from', params.date_from ?? activityDateFrom);
      if (params.date_to !== undefined ? params.date_to : activityDateTo) query.append('date_to', params.date_to ?? activityDateTo);
      if (params.search !== undefined ? params.search : activitySearch) query.append('search', params.search ?? activitySearch);

      const response = await fetch(`/api/logs/counselor-activity?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setActivityLogs(data);
      } else {
        console.error('Activity logs error:', data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchTransferQueue = async () => {
    setTransfersLoading(true);
    try {
      const response = await fetch('/api/transfers/queue', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTransferRequests(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTransfersLoading(false);
    }
  };

  const fetchForwardedLeads = async () => {
    setForwardedLoading(true);
    try {
      const response = await fetch('/api/manager/leads/forwarded', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setForwardedLeads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setForwardedLoading(false);
    }
  };

  const fetchDroppedLeads = async () => {
    setDroppedLoading(true);
    try {
      const response = await fetch('/api/manager/leads/dropped', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setDroppedLeads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDroppedLoading(false);
    }
  };

  // Transfer Queue Handlers
  const handleResolveTransfer = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !resolutionType) return;

    try {
      const response = await fetch(`/api/transfers/resolve/${selectedRequest.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          outcome: resolutionType,
          note: resolutionNote,
          overrideTargetCounselorId: resolutionType === 'approved' ? overrideTarget : undefined
        })
      });

      if (response.ok) {
        alert('Transfer request resolved successfully.');
        setSelectedRequest(null);
        setResolutionType(null);
        setResolutionNote('');
        setOverrideTarget('');
        fetchTransferQueue();
        fetchCounselors();
        triggerCelebration('Transfer Resolved! 🚀');
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to resolve transfer request');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Forwarded Resolution Handlers
  const handleResolveForwardSubmit = async (e) => {
    e.preventDefault();
    if (!resolveModalLead) return;

    try {
      const response = await fetch(`/api/manager/leads/${resolveModalLead.id}/resolve-forward`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: resolveAction,
          targetCounselorId: resolveAction === 'reassign' ? resolveTargetCounselor : undefined,
          managerRemark: resolveRemark
        })
      });

      if (response.ok) {
        alert('Lead escalation resolved successfully.');
        setResolveModalLead(null);
        setResolveRemark('');
        setResolveTargetCounselor('');
        fetchForwardedLeads();
        fetchCounselors();
        triggerCelebration('Escalation Resolved! 👍');
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to resolve escalation');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-[#111C2D]" style={{ userSelect: 'none' }}>
      
      {/* Sidebar */}
      <div className="w-64 bg-[#0A2E36] text-white flex flex-col justify-between shrink-0 border-r" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div>
          <div className="p-4 border-b flex flex-col items-start gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <SkillLabsLogo className="h-8 w-auto" />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Team Leader Portal</span>
          </div>

          <div className="p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 font-label-caps">Role</p>
            <p className="text-sm font-semibold mt-1 font-body-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base" style={{ color: '#F7941D' }}>supervisor_account</span>
              <span>Team Leader</span>
            </p>
          </div>

          <nav className="mt-4 space-y-1 px-2">
            <button
              onClick={(e) => {
                handleTabClick(setActiveTab, 'reports', e);
                fetchReports();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'reports' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'reports' ? { background: '#1BACE4' } : {}}
            >
              <span className="material-symbols-outlined text-lg">monitoring</span>
              <span>Team Performance</span>
            </button>
            <button
              onClick={(e) => {
                handleTabClick(setActiveTab, 'tracking', e);
                fetchDailyTracking(trackingDate);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'tracking' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'tracking' ? { background: '#059669' } : {}}
            >
              <span className="material-symbols-outlined text-lg">calendar_month</span>
              <span>Daily Tracker</span>
            </button>
            <button
              onClick={(e) => {
                handleTabClick(setActiveTab, 'activity', e);
                fetchActivityLogs();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'activity' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'activity' ? { background: '#7C3AED' } : {}}
            >
              <span className="material-symbols-outlined text-lg">manage_history</span>
              <span>Activity Logs</span>
            </button>
            <button
              onClick={(e) => {
                handleTabClick(setActiveTab, 'transfers', e);
                fetchTransferQueue();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'transfers' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'transfers' ? { background: '#1BACE4' } : {}}
            >
              <span className="material-symbols-outlined text-lg">swap_horiz</span>
              <span>Transfer Approvals</span>
            </button>
            <button
              onClick={(e) => {
                handleTabClick(setActiveTab, 'forwarded', e);
                fetchForwardedLeads();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'forwarded' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'forwarded' ? { background: '#D97706' } : {}}
            >
              <span className="material-symbols-outlined text-lg">shortcut</span>
              <span>Escalated Leads</span>
            </button>
            <button
              onClick={(e) => {
                handleTabClick(setActiveTab, 'dropped', e);
                fetchDroppedLeads();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'dropped' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'dropped' ? { background: '#EF4444' } : {}}
            >
              <span className="material-symbols-outlined text-lg">block</span>
              <span>Dropped Leads</span>
            </button>
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="text-xs text-slate-300 truncate font-body-sm">{user.name}</div>
          <div className="text-[10px] text-slate-400 truncate mb-3 font-data-mono">{user.email}</div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#BA1A1A] hover:bg-[#93000A] text-white text-xs font-semibold rounded transition duration-150 active:scale-95"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0">
        
        {/* Header */}
        <header className="h-14 bg-white border-b border-[#CBD5E1] flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-800 font-label-caps">
              {activeTab === 'reports' ? 'Performance Analytics' :
               activeTab === 'tracking' ? 'Daily Status Tracker' :
               activeTab === 'activity' ? 'Counselor Activity Logs' :
               activeTab === 'transfers' ? 'Transfer Approvals' :
               activeTab === 'forwarded' ? 'Escalated Cases' :
               'Dropped Lead Repository'}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded bg-[#F1F5F9] border border-slate-200 text-slate-655 font-bold uppercase tracking-wider font-label-caps">
              Active Team Scope
            </span>
          </div>
        </header>

        {/* Scrollable container */}
        <main className="flex-grow p-6 overflow-y-auto min-w-0">
          
          {/* REPORTS PANEL */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              
              {/* Performance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-[#CBD5E1] p-5 rounded-lg shadow-sm">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Total L1 Leads</p>
                  <p className="text-2xl font-black text-[#1BACE4] mt-1 font-headline-lg">
                    {metrics.stages.find(s => s.stage === 'L1')?.count || 0}
                  </p>
                </div>
                <div className="bg-white border border-[#CBD5E1] p-5 rounded-lg shadow-sm">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Total L2 Leads</p>
                  <p className="text-2xl font-black text-purple-700 mt-1 font-headline-lg">
                    {metrics.stages.find(s => s.stage === 'L2')?.count || 0}
                  </p>
                </div>
                <div className="bg-white border border-[#CBD5E1] p-5 rounded-lg shadow-sm">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Admission Closures (L3 Won)</p>
                  <p className="text-2xl font-black text-green-700 mt-1 font-headline-lg">
                    {metrics.closures.find(c => c.final_status === 'enrolled')?.count || 0}
                  </p>
                </div>
              </div>

              {/* Roster Leaderboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Counselor Leaderboard (2 cols) */}
                <div className="lg:col-span-2 bg-white border border-[#CBD5E1] p-5 rounded-lg shadow-sm">
                  <div className="border-b border-[#E2E8F0] pb-3 mb-4 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase">Counselor Performance Board</h3>
                    <span className="text-[10px] text-slate-500 italic font-body-sm">Sorted by Enrolments</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">
                          <th className="p-3 pl-4">Counselor</th>
                          <th className="p-3 text-center">L1 active</th>
                          <th className="p-3 text-center">L2 active</th>
                          <th className="p-3 text-center">L3 active</th>
                          <th className="p-3 text-center text-green-700">Enrolled (Won)</th>
                          <th className="p-3 text-center text-[#BA1A1A]">Dropped (Lost)</th>
                          <th className="p-3 pr-4 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                        {leaderboard.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="p-6 text-center text-slate-400 italic">No counselors active.</td>
                          </tr>
                        ) : leaderboard.map((c, i) => (
                          <tr key={c.id || i} className="hover:bg-slate-50 transition">
                            <td className="p-3 pl-4 font-semibold text-slate-800">{c.name}</td>
                            <td className="p-3 text-center font-data-mono">{c.L1}</td>
                            <td className="p-3 text-center font-data-mono">{c.L2}</td>
                            <td className="p-3 text-center font-data-mono">{c.L3}</td>
                            <td className="p-3 text-center font-bold text-green-700 font-data-mono">{c.enrolled}</td>
                            <td className="p-3 text-center font-bold text-[#BA1A1A] font-data-mono">{c.lost}</td>
                            <td className="p-3 pr-4 text-right font-data-mono font-semibold">₹{(c.revenue || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Source Share (1 col) */}
                <div className="bg-white border border-[#CBD5E1] p-5 rounded-lg shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                      <h3 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase">Lead Sources Share</h3>
                    </div>
                    <div className="space-y-3">
                      {sourceBreakdown.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-6">No lead sources mapped.</p>
                      ) : sourceBreakdown.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                          <span className="font-semibold text-slate-700">{s.source}</span>
                          <span className="font-bold text-slate-900 bg-slate-200 px-2 py-0.5 rounded-full font-data-mono">{s.count} leads</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

            {/* DAILY TRACKER PANEL */}
          {activeTab === 'tracking' && (
            <div className="space-y-6">
              {/* Header bar with date picker */}
              <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#059669] text-xl">calendar_month</span>
                      Daily Lead Status Tracker
                    </h2>
                    <p className="text-[11px] text-[#70787C] mt-1 font-body-sm">View all leads active on a given day, categorized by pipeline stage and disposition.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold text-[#505F76] uppercase tracking-wider font-label-caps">Select Date:</label>
                    <input
                      type="date"
                      value={trackingDate}
                      max={new Date().toISOString().slice(0,10)}
                      onChange={(e) => { setTrackingDate(e.target.value); }}
                      className="text-xs p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#059669]"
                    />
                    <button
                      onClick={() => fetchDailyTracking(trackingDate)}
                      className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">search</span>
                      Load
                    </button>
                  </div>
                </div>
              </div>

              {trackingLoading && (
                <div className="p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-[#059669] border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-xs text-[#70787C] italic">Loading daily status data...</p>
                </div>
              )}

              {!trackingLoading && !trackingData && (
                <div className="bg-white border border-dashed border-[#CBD5E1] rounded-xl p-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-[#CBD5E1] block mb-3">calendar_today</span>
                  <p className="text-sm text-[#70787C]">Select a date and click <strong>Load</strong> to view daily lead status.</p>
                </div>
              )}

              {!trackingLoading && trackingData && (
                <>
                  {/* Summary Pills */}
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { key: 'all',          label: 'All Activity',    count: trackingData.summary.total,        color: '#505F76', bg: '#F8FAFC',   border: '#CBD5E1' },
                      { key: 'L1',           label: 'Level 1',         count: trackingData.summary.L1,           color: '#1BACE4', bg: '#EFF9FF',   border: '#BAE6FD' },
                      { key: 'L2',           label: 'Level 2',         count: trackingData.summary.L2,           color: '#8B5CF6', bg: '#F5F3FF',   border: '#DDD6FE' },
                      { key: 'L3',           label: 'Level 3',         count: trackingData.summary.L3,           color: '#059669', bg: '#ECFDF5',   border: '#A7F3D0' },
                      { key: 'interested',   label: 'Interested',      count: trackingData.summary.interested,   color: '#10B981', bg: '#F0FDF4',   border: '#86EFAC' },
                      { key: 'enrolled',     label: 'Enrolled ✓',      count: trackingData.summary.enrolled,     color: '#0F4C5C', bg: '#F0F9FF',   border: '#7DD3FC' },
                      { key: 'not_interested', label: 'Not Interested',count: trackingData.summary.not_interested, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
                      { key: 'not_picked_up',  label: 'Not Picked Up', count: trackingData.summary.not_picked_up,  color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
                      { key: 'switched_off',   label: 'Switched Off',  count: trackingData.summary.switched_off,   color: '#64748B', bg: '#F8FAFC', border: '#CBD5E1' },
                      { key: 'dropped',      label: 'Dropped/Lost',    count: trackingData.summary.dropped,      color: '#BA1A1A', bg: '#FFF1F2',   border: '#FECDD3' },
                    ].map(pill => (
                      <button
                        key={pill.key}
                        onClick={() => { setTrackingCategory(pill.key); setTrackingSearch(''); }}
                        className="flex flex-col items-center p-3 rounded-xl border-2 transition hover:shadow-md font-body-sm"
                        style={{
                          background: pill.bg,
                          borderColor: trackingCategory === pill.key ? pill.color : pill.border,
                          boxShadow: trackingCategory === pill.key ? `0 0 0 2px ${pill.color}33` : 'none'
                        }}
                      >
                        <span className="text-xl font-black font-data-mono" style={{ color: pill.color }}>{pill.count}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: pill.color }}>{pill.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Lead Table */}
                  <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-[#F0F4F8]">
                      <h3 className="text-xs font-bold text-[#111C2D] uppercase tracking-wide font-label-caps flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-[#059669]">group</span>
                        {
                          trackingCategory === 'all' ? 'All Active Leads' :
                          trackingCategory === 'L1' ? 'Level 1 Leads' :
                          trackingCategory === 'L2' ? 'Level 2 Leads' :
                          trackingCategory === 'L3' ? 'Level 3 Leads' :
                          trackingCategory === 'interested' ? 'Interested Leads' :
                          trackingCategory === 'enrolled' ? 'Enrolled Leads' :
                          trackingCategory === 'not_interested' ? 'Not Interested' :
                          trackingCategory === 'not_picked_up' ? 'Not Picked Up' :
                          trackingCategory === 'switched_off' ? 'Switched Off' :
                          'Dropped / Lost Leads'
                        }
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-data-mono">
                          {(trackingData.categories[trackingCategory] || []).length} leads
                        </span>
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-[#CBD5E1]">search</span>
                        <input
                          type="text"
                          placeholder="Search name, phone, email, city..."
                          value={trackingSearch}
                          onChange={(e) => setTrackingSearch(e.target.value)}
                          className="text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-[#059669]"
                        />
                      </div>
                    </div>

                    {(() => {
                      const rows = (trackingData.categories[trackingCategory] || []).filter(lead => {
                        if (!trackingSearch) return true;
                        const q = trackingSearch.toLowerCase();
                        return (
                          (lead.name || '').toLowerCase().includes(q) ||
                          (lead.phone || '').includes(q) ||
                          (lead.email || '').toLowerCase().includes(q) ||
                          (lead.city || '').toLowerCase().includes(q) ||
                          (lead.state || '').toLowerCase().includes(q) ||
                          (lead.course_interest || '').toLowerCase().includes(q) ||
                          (lead.counselor_name || '').toLowerCase().includes(q)
                        );
                      });

                      if (rows.length === 0) return (
                        <div className="p-10 text-center text-[#70787C] italic text-xs">
                          {trackingSearch ? 'No leads match your search.' : 'No leads found in this category for the selected date.'}
                        </div>
                      );

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                              <tr className="text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                                <th className="p-3 pl-4">Candidate</th>
                                <th className="p-3">Phone</th>
                                <th className="p-3">Email</th>
                                <th className="p-3">Location</th>
                                <th className="p-3">Exp (Yrs)</th>
                                <th className="p-3">Course Interest</th>
                                <th className="p-3">Company</th>
                                <th className="p-3">Counselor</th>
                                <th className="p-3 text-center">Stage</th>
                                <th className="p-3">Disposition</th>
                                <th className="p-3">Today's Activity</th>
                                <th className="p-3">Last Updated</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F4F8] font-body-sm">
                              {rows.map(lead => {
                                const stageColors = { L1: '#1BACE4', L2: '#8B5CF6', L3: '#059669' };
                                const dispColors = {
                                  'Interested': '#10B981', 'Not Interested': '#EF4444',
                                  'Not Picked Up': '#F59E0B', 'Switched Off': '#64748B', 'None': '#CBD5E1'
                                };
                                return (
                                  <tr key={lead.id} className="hover:bg-[#F8FAFC] transition">
                                    <td className="p-3 pl-4">
                                      <div className="font-semibold text-[#111C2D]">{lead.name || '—'}</div>
                                      <div className="text-[10px] text-[#70787C] font-data-mono">{lead.source || ''}</div>
                                    </td>
                                    <td className="p-3 font-data-mono text-[#111C2D]"><MaskedPhone phone={lead.phone} /></td>
                                    <td className="p-3 text-[#505F76] font-data-mono text-[10px]"><MaskedEmail email={lead.email} /></td>
                                    <td className="p-3">
                                      <div className="text-[#111C2D]">{lead.city || '—'}</div>
                                      <div className="text-[10px] text-[#70787C]">{lead.state || ''}</div>
                                    </td>
                                    <td className="p-3 text-center font-data-mono">{lead.experience != null ? lead.experience : '—'}</td>
                                    <td className="p-3 text-[#0F4C5C] font-semibold">{lead.course_interest || '—'}</td>
                                    <td className="p-3 text-[#505F76]">{lead.current_company || '—'}</td>
                                    <td className="p-3">
                                      <span className="text-[11px] font-semibold text-[#111C2D]">{lead.counselor_name || '—'}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                      {lead.stage ? (
                                        <span className="inline-block px-2 py-0.5 rounded text-white text-[10px] font-bold font-data-mono" style={{ background: stageColors[lead.stage] || '#CBD5E1' }}>
                                          {lead.stage}
                                        </span>
                                      ) : '—'}
                                    </td>
                                    <td className="p-3">
                                      {lead.disposition && lead.disposition !== 'None' ? (
                                        <span className="text-[10px] font-semibold" style={{ color: dispColors[lead.disposition] || '#505F76' }}>
                                          {lead.disposition}
                                        </span>
                                      ) : <span className="text-[10px] text-[#CBD5E1]">None</span>}
                                    </td>
                                    <td className="p-3">
                                      {(lead.activity_today || []).length > 0 ? (
                                        <div className="space-y-0.5">
                                          {(lead.activity_today || []).slice(0,3).map((act, ai) => (
                                            <div key={ai} className="text-[10px] text-[#505F76]">
                                              <span className="font-bold text-[#0F4C5C]">[{act.action}]</span> {act.remark ? act.remark.slice(0, 40) : ''}{act.remark && act.remark.length > 40 ? '...' : ''}
                                            </div>
                                          ))}
                                          {(lead.activity_today || []).length > 3 && (
                                            <div className="text-[10px] text-[#1BACE4] font-bold">+{(lead.activity_today || []).length - 3} more</div>
                                          )}
                                        </div>
                                      ) : <span className="text-[10px] text-[#CBD5E1] italic">No actions</span>}
                                    </td>
                                    <td className="p-3 text-[10px] text-[#70787C] font-data-mono">
                                      {lead.assignment_updated_at
                                        ? new Date(lead.assignment_updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                        : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ACTIVITY LOGS PANEL */}
          {activeTab === 'activity' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#7C3AED] text-xl">manage_history</span>
                      Counselor Activity Logs
                    </h2>
                    <p className="text-[11px] text-[#70787C] mt-1 font-body-sm">Track every call, action, login, stage change and remark made by your counselors in real-time.</p>
                  </div>
                  <button
                    onClick={() => fetchActivityLogs({
                      counselor_id: activityCounselorFilter,
                      action_type: activityActionFilter,
                      date_from: activityDateFrom,
                      date_to: activityDateTo,
                      search: activitySearch
                    })}
                    className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                  >
                    <span className="material-symbols-outlined text-base">refresh</span>
                    Refresh
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#505F76] uppercase tracking-wider mb-1 font-label-caps">Counselor</label>
                    <select
                      value={activityCounselorFilter}
                      onChange={(e) => setActivityCounselorFilter(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    >
                      <option value="">All Counselors</option>
                      {counselors.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#505F76] uppercase tracking-wider mb-1 font-label-caps">Action Type</label>
                    <select
                      value={activityActionFilter}
                      onChange={(e) => setActivityActionFilter(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    >
                      <option value="">All Actions</option>
                      <option value="login">🔐 Login</option>
                      <option value="logout">🚪 Logout</option>
                      <option value="call">📞 Call / Log</option>
                      <option value="tick">✅ Advance Stage (Tick)</option>
                      <option value="cross">❌ Drop Lead (Cross)</option>
                      <option value="note">📝 Remark / Note</option>
                      <option value="distributed">📦 Lead Assigned</option>
                      <option value="status_change">🔄 Disposition Change</option>
                      <option value="transfer">🔀 Transfer Request</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#505F76] uppercase tracking-wider mb-1 font-label-caps">From Date</label>
                    <input
                      type="date"
                      value={activityDateFrom}
                      onChange={(e) => setActivityDateFrom(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#505F76] uppercase tracking-wider mb-1 font-label-caps">To Date</label>
                    <input
                      type="date"
                      value={activityDateTo}
                      max={new Date().toISOString().slice(0,10)}
                      onChange={(e) => setActivityDateTo(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#505F76] uppercase tracking-wider mb-1 font-label-caps">Search</label>
                    <input
                      type="text"
                      placeholder="Name, lead, remark..."
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchActivityLogs()}
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => fetchActivityLogs({
                      counselor_id: activityCounselorFilter,
                      action_type: activityActionFilter,
                      date_from: activityDateFrom,
                      date_to: activityDateTo,
                      search: activitySearch
                    })}
                    className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-lg transition"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>

              {/* Logs Table */}
              <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[#F0F4F8] bg-[#F8FAFC]">
                  <span className="text-xs font-bold text-[#111C2D] uppercase tracking-wide font-label-caps flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#7C3AED]">receipt_long</span>
                    Activity Log Feed
                  </span>
                  <span className="text-[10px] bg-[#EDE9FE] text-[#7C3AED] px-2 py-0.5 rounded-full font-bold font-data-mono">
                    {activityLogs.length} entries
                  </span>
                </div>

                {activityLoading ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-[#7C3AED] border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-xs text-[#70787C] italic">Loading activity logs...</p>
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="p-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-[#CBD5E1] block mb-3">history_toggle_off</span>
                    <p className="text-sm text-[#70787C]">No activity logs found for the selected filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <tr className="text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                          <th className="p-3 pl-4">Timestamp</th>
                          <th className="p-3">Counselor</th>
                          <th className="p-3 text-center">Action</th>
                          <th className="p-3">Lead</th>
                          <th className="p-3">Details / Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F4F8] font-body-sm">
                        {activityLogs.map(log => {
                          const actionConfig = {
                            login:         { label: 'Login',      color: '#1BACE4', bg: '#EFF9FF' },
                            logout:        { label: 'Logout',     color: '#64748B', bg: '#F8FAFC' },
                            call:          { label: 'Call',       color: '#0F4C5C', bg: '#F0F9FF' },
                            tick:          { label: 'Advance',    color: '#059669', bg: '#ECFDF5' },
                            cross:         { label: 'Dropped',    color: '#BA1A1A', bg: '#FFF1F2' },
                            note:          { label: 'Remark',     color: '#8B5CF6', bg: '#F5F3FF' },
                            distributed:   { label: 'Assigned',   color: '#F7941D', bg: '#FFF7ED' },
                            status_change: { label: 'Disposition',color: '#D97706', bg: '#FFFBEB' },
                            transfer:      { label: 'Transfer',   color: '#0891B2', bg: '#ECFEFF' },
                          };
                          const ac = actionConfig[log.action] || { label: log.action, color: '#505F76', bg: '#F8FAFC' };
                          return (
                            <tr key={log.id} className="hover:bg-[#F8FAFC] transition">
                              <td className="p-3 pl-4 text-[10px] text-[#70787C] font-data-mono whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                                })}
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-[#111C2D]">{log.counselor_name || '—'}</div>
                                <div className="text-[10px] text-[#70787C] font-data-mono">{log.counselor_email || ''}</div>
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ background: ac.bg, color: ac.color }}
                                >
                                  {ac.label}
                                </span>
                              </td>
                              <td className="p-3">
                                {log.lead_name ? (
                                  <>
                                    <div className="font-semibold text-[#111C2D]">{log.lead_name}</div>
                                    <div className="text-[10px] text-[#70787C] font-data-mono">{log.lead_phone || ''}</div>
                                    {log.lead_course && <div className="text-[10px] text-[#0F4C5C]">{log.lead_course}</div>}
                                  </>
                                ) : (
                                  <span className="text-[10px] text-[#CBD5E1] italic">System event</span>
                                )}
                              </td>
                              <td className="p-3 text-[#40484B] max-w-xs">
                                <p className="text-[11px] leading-snug line-clamp-2">{log.remark || '—'}</p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TRANSFERS PANEL */}
          {activeTab === 'transfers' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#CBD5E1] p-5 rounded-lg shadow-sm">
                
                <div className="border-b border-[#E2E8F0] pb-3 mb-4">
                  <h3 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#1BACE4]">swap_horiz</span>
                    <span>Reassignment Queue (Team-Scoped)</span>
                  </h3>
                </div>

                {transfersLoading ? (
                  <p className="p-10 text-center text-xs text-slate-500 font-semibold">Loading transfer requests...</p>
                ) : transferRequests.length === 0 ? (
                  <p className="p-10 text-center text-xs text-slate-400 italic">No transfer requests pending approval.</p>
                ) : (
                  <div className="overflow-x-auto min-w-0">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">
                          <th className="p-3 pl-4">Lead Name</th>
                          <th className="p-3">Requested By</th>
                          <th className="p-3">Transfer Type</th>
                          <th className="p-3">Reason</th>
                          <th className="p-3">Notes</th>
                          <th className="p-3">Hours Pending</th>
                          <th className="p-3 pr-4 text-center">Decide</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                        {transferRequests.map(req => (
                          <tr key={req.id} className="hover:bg-slate-50/70 transition">
                            <td className="p-3 pl-4 font-semibold text-[#1BACE4]">{req.lead_name}</td>
                            <td className="p-3 font-semibold text-slate-700">{req.requester_name}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-slate-100 border text-slate-650 rounded-[4px] font-bold text-[9px] uppercase">
                                {req.request_type === 'give_up' ? 'Release' : 'Reassignment'}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-amber-800">{req.reason}</td>
                            <td className="p-3 max-w-[200px] truncate italic text-slate-600 font-normal" title={req.note}>"{req.note || 'No notes'}"</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${req.is_escalated ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
                                {req.hours_pending} hrs {req.is_escalated && '(!)'}
                              </span>
                            </td>
                            <td className="p-3 pr-4 text-center flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => { setSelectedRequest(req); setResolutionType('approved'); }}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded text-[10px] uppercase transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => { setSelectedRequest(req); setResolutionType('rejected'); }}
                                className="px-2 py-1 bg-[#BA1A1A] hover:bg-[#93000A] text-white font-bold rounded text-[10px] uppercase transition"
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ESCALATED PANEL */}
          {activeTab === 'forwarded' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#CBD5E1] p-5 rounded-lg shadow-sm">
                
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4 mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#D97706]">shortcut</span>
                      <span>Escalated Leads Desk</span>
                    </h3>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Search candidate or counselor..."
                      value={forwardedSearchQuery}
                      onChange={(e) => setForwardedSearchQuery(e.target.value)}
                      className="text-xs p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg w-64 focus:outline-none"
                    />
                  </div>
                </div>

                {forwardedLoading ? (
                  <p className="p-10 text-center text-xs text-slate-500 font-semibold">Loading escalated leads...</p>
                ) : (() => {
                  const q = forwardedSearchQuery.toLowerCase().trim();
                  const filtered = forwardedLeads.filter(lead => {
                    if (!q) return true;
                    return (
                      (lead.name || '').toLowerCase().includes(q) ||
                      (lead.counselor_name || '').toLowerCase().includes(q) ||
                      (lead.forward_remark || '').toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return <p className="p-10 text-center text-xs text-slate-400 italic">No escalated leads pending review.</p>;
                  }

                  return (
                    <div className="overflow-x-auto min-w-0">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">
                            <th className="p-3 pl-4">Candidate</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3">Forwarded By</th>
                            <th className="p-3">Stage</th>
                            <th className="p-3">Remark</th>
                            <th className="p-3">Date Escalated</th>
                            <th className="p-3 pr-4 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                          {filtered.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-50/70 transition">
                              <td className="p-3 pl-4">
                                <div className="font-semibold text-[#1BACE4]">{lead.name}</div>
                                <div className="text-[10px] text-slate-500">{lead.city || 'No City'}, {lead.state || 'No State'}</div>
                              </td>
                              <td className="p-3 text-slate-650 font-data-mono">
                                <MaskedPhone phone={lead.phone} />
                              </td>
                              <td className="p-3 font-semibold text-slate-700">{lead.counselor_name}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E6F8FE] text-[#1BACE4] border border-[#1BACE4]/20">
                                  {lead.stage}
                                </span>
                              </td>
                              <td className="p-3 max-w-[200px] truncate italic text-slate-600 font-normal" title={lead.forward_remark}>"{lead.forward_remark || 'No remarks'}"</td>
                              <td className="p-3 text-[10px] text-slate-500 font-data-mono">
                                {lead.forwarded_at ? new Date(lead.forwarded_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="p-3 pr-4 text-center">
                                <button
                                  onClick={() => {
                                    setResolveModalLead(lead);
                                    setResolveAction('send_back');
                                    setResolveRemark('');
                                    setResolveTargetCounselor('');
                                  }}
                                  className="px-2.5 py-1 bg-[#D97706] hover:bg-[#B45309] text-white text-[11px] font-bold rounded-lg transition active:scale-95"
                                >
                                  Resolve
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

              </div>
            </div>
          )}



          {/* DROPPED PANEL */}
          {activeTab === 'dropped' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#CBD5E1] p-5 rounded-lg shadow-sm">
                
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4 mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#EF4444]">block</span>
                      <span>Team's Dropped Leads</span>
                    </h3>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Search dropped candidate name..."
                      value={droppedSearchQuery}
                      onChange={(e) => setDroppedSearchQuery(e.target.value)}
                      className="text-xs p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg w-64 focus:outline-none"
                    />
                  </div>
                </div>

                {droppedLoading ? (
                  <p className="p-10 text-center text-xs text-slate-500 font-semibold">Loading dropped leads history...</p>
                ) : (() => {
                  const q = droppedSearchQuery.toLowerCase().trim();
                  const filtered = droppedLeads.filter(lead => {
                    if (!q) return true;
                    return (
                      (lead.name || '').toLowerCase().includes(q) ||
                      (lead.counselor_name || '').toLowerCase().includes(q) ||
                      (lead.drop_remark || '').toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return <p className="p-10 text-center text-xs text-slate-400 italic">No dropped leads log found.</p>;
                  }

                  return (
                    <div className="overflow-x-auto min-w-0">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">
                            <th className="p-3 pl-4">Candidate</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3">Dropped By</th>
                            <th className="p-3">Stage Dropped</th>
                            <th className="p-3">Remarks / Reason</th>
                            <th className="p-3 pr-4">Dropped Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                          {filtered.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-50/70 transition">
                              <td className="p-3 pl-4">
                                <div className="font-semibold text-[#1BACE4]">{lead.name}</div>
                                <div className="text-[10px] text-slate-500">{lead.city || 'No City'}, {lead.state || 'No State'}</div>
                              </td>
                              <td className="p-3 text-slate-655 font-data-mono">
                                <MaskedPhone phone={lead.phone} />
                              </td>
                              <td className="p-3 font-semibold text-slate-700">{lead.counselor_name}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 border border-red-200 text-red-700 uppercase">
                                  {lead.drop_stage || 'Unknown'}
                                </span>
                              </td>
                              <td className="p-3 max-w-[200px] truncate italic text-slate-600 font-normal" title={lead.drop_remark}>"{lead.drop_remark || 'No remark'}"</td>
                              <td className="p-3 pr-4 text-[10px] text-slate-500 font-data-mono">
                                {lead.closed_at ? new Date(lead.closed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

              </div>
            </div>
          )}

        </main>
      </div>

      {/* RESOLUTION DECISION MODAL FOR TRANSFERS */}
      {selectedRequest && resolutionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md bg-white border border-[#CBD5E1] p-6 rounded shadow-lg animate-in fade-in zoom-in-95 duration-150 text-[#111C2D]">
            <form onSubmit={handleResolveTransfer} className="space-y-4">
              <h3 className="text-sm font-bold text-[#111C2D] font-headline-md">
                Transfer Request Action: {resolutionType === 'approved' ? 'Approval' : 'Rejection'}
              </h3>
              
              <p className="text-xs text-[#40484B] font-body-sm">
                Review request for student <strong>{selectedRequest.lead_name}</strong> submitted by counselor <strong>{selectedRequest.requester_name}</strong>.
              </p>

              {resolutionType === 'approved' && (
                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Select Target Counselor</label>
                  <select
                    required
                    value={overrideTarget}
                    onChange={(e) => setOverrideTarget(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded-lg"
                  >
                    <option value="">Select Counselor...</option>
                    {counselors.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Load: {c.load || 0})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Resolution Remarks / Decision note</label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Provide resolution details/instructions..."
                  className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded-lg h-20"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                <button
                  type="button"
                  onClick={() => { setSelectedRequest(null); setResolutionType(null); }}
                  className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-1.5 px-4 bg-[#1BACE4] hover:bg-[#1597C8] text-white text-xs font-bold rounded-lg transition"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL FOR ESCALATIONS */}
      {resolveModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md bg-white border border-[#CBD5E1] p-6 rounded shadow-lg animate-in fade-in zoom-in-95 duration-150 text-[#111C2D]">
            <form onSubmit={handleResolveForwardSubmit} className="space-y-4">
              <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                <span className="material-symbols-outlined text-[#D97706]">gavel</span>
                <span>Resolve Escalated Lead — {resolveModalLead.name}</span>
              </h3>
              
              <div className="text-xs space-y-1.5 bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                <div><span className="font-bold text-slate-700">Forwarded By:</span> {resolveModalLead.counselor_name}</div>
                <div><span className="font-bold text-slate-700">Original Stage:</span> {resolveModalLead.stage}</div>
                <div><span className="font-bold text-slate-700">Escalation Reason:</span> <span className="italic text-slate-655">"{resolveModalLead.forward_remark || 'None'}"</span></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Select Action</label>
                <select
                  value={resolveAction}
                  onChange={(e) => setResolveAction(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                >
                  <option value="send_back">Send back to original counselor ({resolveModalLead.counselor_name})</option>
                  <option value="reassign">Reassign to another counselor</option>
                </select>
              </div>

              {resolveAction === 'reassign' && (
                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Target Counselor</label>
                  <select
                    required
                    value={resolveTargetCounselor}
                    onChange={(e) => setResolveTargetCounselor(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                  >
                    <option value="">Select Counselor...</option>
                    {counselors.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Load: {c.load || 0})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Manager Remark / Decision Note</label>
                <textarea
                  required
                  value={resolveRemark}
                  onChange={(e) => setResolveRemark(e.target.value)}
                  placeholder="Provide resolution details/instructions..."
                  className="w-full text-xs p-2 bg-white border border-[#CBD5E1] rounded-lg h-20 focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => setResolveModalLead(null)}
                  className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-1.5 px-4 bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold rounded-lg transition"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Celebrations */}
      {celebrations.map(c => (
        <div
          key={c.id}
          className="fixed z-[9999] pointer-events-none text-center animate-celebrate-text"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="bg-[#0C2340] text-white px-6 py-4 rounded-2xl shadow-2xl border-2 border-[#1BACE4] flex flex-col items-center gap-1.5 min-w-[200px]">
            <span className="material-symbols-outlined text-4xl text-[#FFD700] animate-bounce">emoji_events</span>
            <span className="text-sm font-black uppercase tracking-wider">{c.text}</span>
            <span className="text-[10px] text-slate-300 font-bold font-data-mono tracking-wider">TEAM MILESTONE 🚀</span>
          </div>
        </div>
      ))}

      {/* Confetti Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="fixed z-[9998] pointer-events-none rounded-full animate-confetti-particle"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            '--tx': p.tx,
            '--ty': p.ty,
            '--rot': p.rot
          }}
        />
      ))}

    </div>
  );
}
