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
 *   Manager Executive Portal. Displays aggregated performance charts, targets,
 *   lead assignment controls, and system-wide analytical breakdowns.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

const SkillLabsLogo = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" className={className}>
    <text x="0" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="38" fill="#1BACE4" letterSpacing="-1.5">Skill</text>
    <text x="92" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="300" fontSize="38" fill="#F7941D" letterSpacing="-1.5">Labs</text>
  </svg>
);

const MaskedPhone = ({ phone }) => {
  const [revealed, setRevealed] = useState(false);

  if (!phone) return <span className="text-slate-400 italic">No phone</span>;

  const mask = (p) => {
    const clean = p.replace(/\s+/g, '');
    if (clean.length <= 4) return '****';
    return clean.slice(0, 2) + '*'.repeat(clean.length - 4) + clean.slice(-2);
  };

  return (
    <span 
      onClick={() => setRevealed(!revealed)}
      className="cursor-pointer font-data-mono hover:text-[#1BACE4] transition select-none inline-flex items-center gap-1 group"
      title="Click to reveal phone number"
    >
      <span className="material-symbols-outlined text-[14px] text-slate-400 group-hover:text-[#1BACE4] transition">
        {revealed ? 'visibility' : 'visibility_off'}
      </span>
      <span>{revealed ? phone : mask(phone)}</span>
    </span>
  );
};

const MaskedEmail = ({ email }) => {
  const [revealed, setRevealed] = useState(false);

  if (!email) return <span className="text-slate-400 italic">No email</span>;

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
    <span 
      onClick={() => setRevealed(!revealed)}
      className="cursor-pointer font-data-mono hover:text-[#1BACE4] transition select-none inline-flex items-center gap-1 group"
      title="Click to reveal email"
    >
      <span className="material-symbols-outlined text-[14px] text-slate-400 group-hover:text-[#1BACE4] transition">
        {revealed ? 'visibility' : 'visibility_off'}
      </span>
      <span>{revealed ? email : maskEmail(email)}</span>
    </span>
  );
};

export default function ManagerDashboard({ token, user, onLogout, onBackToAdmin }) {
  const [activeTab, setActiveTab] = useState('reports'); // upload, pool, distribute, repository, reports, universities
  const [counselors, setCounselors] = useState([]);

  // Gamification & Animations
  const [celebrations, setCelebrations] = useState([]);
  const [particles, setParticles] = useState([]);

  const triggerCelebration = (text) => {
    const id = Date.now() + Math.random();
    setCelebrations(prev => [...prev, { id, text }]);
    const newParticles = Array.from({ length: 40 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 85 + Math.random() * 125;
      const tx = `${Math.cos(angle) * velocity}px`;
      const ty = `${Math.sin(angle) * velocity - 45}px`;
      const rot = `${Math.random() * 360}deg`;
      const size = 5 + Math.random() * 8;
      const colors = ['#1BACE4', '#F7941D', '#10B981', '#8B5CF6', '#EF4444', '#FFD700'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return { id: id + i, tx, ty, rot, size, color, left: '50vw', top: '50vh' };
    });
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setCelebrations(prev => prev.filter(c => c.id !== id));
    }, 2000);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id < id || p.id >= id + 40));
    }, 1200);
  };

  const handleTabClick = (setter, value, e) => {
    setter(value);
    const clientX = e.clientX || window.innerWidth / 2;
    const clientY = e.clientY || window.innerHeight / 2;
    const id = Date.now() + Math.random();
    const clickParticles = Array.from({ length: 12 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 25 + Math.random() * 45;
      const tx = `${Math.cos(angle) * velocity}px`;
      const ty = `${Math.sin(angle) * velocity}px`;
      const rot = `${Math.random() * 360}deg`;
      const size = 3 + Math.random() * 5;
      const colors = ['#1BACE4', '#F7941D', '#10B981', '#8B5CF6'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return { id: id + i, tx, ty, rot, size, color, left: `${clientX}px`, top: `${clientY}px` };
    });
    setParticles(prev => [...prev, ...clickParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id < id || p.id >= id + 12));
    }, 1200);
  };
  
  // Lead pool & distribution state
  const [poolLeads, setPoolLeads] = useState([]);
  const [filters, setFilters] = useState({
    city: '',
    state: '',
    source: '',
    interest: '',
    min_exp: '',
    max_exp: '',
    start_date: '',
    end_date: '',
    university_id: '',
    upload_batch_id: ''
  });

  const [dynamicFilterOptions, setDynamicFilterOptions] = useState({
    cities: [],
    states: [],
    courses: [],
    sources: []
  });

  // Custom Timeline Report state
  const [timelineStartDate, setTimelineStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5); // Default to 5 months ago
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [timelineEndDate, setTimelineEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [timelineSummary, setTimelineSummary] = useState({
    summary: {
      total_uploaded: 0,
      clean_rows: 0,
      duplicate_rows: 0,
      invalid_rows: 0,
      total_distributed: 0,
      enrolled: 0,
      lost: 0,
      revenue: 0
    },
    batches: [],
    counselors: []
  });
  const [timelineLeads, setTimelineLeads] = useState([]);
  const [timelineSearchQuery, setTimelineSearchQuery] = useState('');
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Dropped Leads States
  const [managerDroppedLeads, setManagerDroppedLeads] = useState([]);
  const [droppedSearchQuery, setDroppedSearchQuery] = useState('');
  const [droppedLoading, setDroppedLoading] = useState(false);

  // Lead Journey Decompositions States
  const [decompositions, setDecompositions] = useState([]);
  const [decompositionsLoading, setDecompositionsLoading] = useState(false);
  const [decompStartDate, setDecompStartDate] = useState(
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) // default 90 days (3 months)
  );
  const [decompEndDate, setDecompEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [decompSearch, setDecompSearch] = useState('');

  // Forwarded Leads States
  const [forwardedLeads, setForwardedLeads] = useState([]);
  const [forwardedSearchQuery, setForwardedSearchQuery] = useState('');
  const [forwardedLoading, setForwardedLoading] = useState(false);
  const [resolveModalLead, setResolveModalLead] = useState(null); // lead selected for resolution
  const [resolveAction, setResolveAction] = useState('send_back'); // send_back or reassign
  const [resolveTargetCounselor, setResolveTargetCounselor] = useState('');
  const [resolveRemark, setResolveRemark] = useState('');
  
  // Manual distribution state
  const [allocations, setAllocations] = useState({}); // counselorId -> count
  const [counselorTargets, setCounselorTargets] = useState({}); // counselorId -> target count
  const [selectedBatchId, setSelectedBatchId] = useState(null);

  // Master Lead list & detail drawer
  const [masterLeads, setMasterLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadTimeline, setLeadTimeline] = useState([]);

  // Reports state
  const [metrics, setMetrics] = useState({ stages: [], closures: [], unassigned: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [sourceBreakdown, setSourceBreakdown] = useState([]);
  const [uploadTrend, setUploadTrend] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Universities Management State
  const [universitiesList, setUniversitiesList] = useState([]);
  const [uniName, setUniName] = useState('');
  const [uniCourses, setUniCourses] = useState('');
  const [uniFees, setUniFees] = useState('');
  const [uniEligibility, setUniEligibility] = useState('');
  const [uniSpecializations, setUniSpecializations] = useState('');
  const [editingUniId, setEditingUniId] = useState(null);
  const [uniFormError, setUniFormError] = useState(null);
  const [uniFormSuccess, setUniFormSuccess] = useState(false);
  const [universitiesLoading, setUniversitiesLoading] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [manualMapping, setManualMapping] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);


  // Transfer queue state
  const [queue, setQueue] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [resolutionType, setResolutionType] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [resolveTargetCouns, setResolveTargetCouns] = useState('');

  // Data Vault state
  const [vaultBatches, setVaultBatches] = useState([]);
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultDetail, setVaultDetail] = useState(null); // { batch, distributions } for selected batch
  const [vaultDetailLoading, setVaultDetailLoading] = useState(false);

  // Modal for Enrolled/Dropped leads details in Vault Batch
  const [conversionLeadsModal, setConversionLeadsModal] = useState(null);
  const [conversionLeadsLoading, setConversionLeadsLoading] = useState(false);

  // Modal for counselor's campaign leads with search
  const [campaignLeadsModal, setCampaignLeadsModal] = useState(null);
  const [campaignLeadsLoading, setCampaignLeadsLoading] = useState(false);
  const [campaignLeadsSearch, setCampaignLeadsSearch] = useState('');

  // Daily Status Tracker state
  const [trackingDate, setTrackingDate] = useState(new Date().toISOString().slice(0, 10));
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingCategory, setTrackingCategory] = useState('all');
  const [trackingSearch, setTrackingSearch] = useState('');

  // Activity Logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityCounselorFilter, setActivityCounselorFilter] = useState('');
  const [activityActionFilter, setActivityActionFilter] = useState('');
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [activitySearch, setActivitySearch] = useState('');

  // Master Repository search & filter states
  const [repoSearch, setRepoSearch] = useState('');
  const [repoCounselorFilter, setRepoCounselorFilter] = useState('');
  const [repoStageFilter, setRepoStageFilter] = useState('');

  // L3 students search query
  const [l3SearchQuery, setL3SearchQuery] = useState('');

  // Load counselors, leads, metrics, transfer requests, and location learnings
  useEffect(() => {
    fetchCounselors();
    fetchMasterLeads();
    fetchMetrics();
    fetchQueue();
    fetchUniversities();
    if (activeTab === 'vault' || activeTab === 'pool') fetchVaultBatches('');
    if (activeTab === 'pool') {
      fetchPoolData(filters);
      fetchDynamicFilters(filters.upload_batch_id);
    }
    if (activeTab === 'reports') fetchAllReportData();
    if (activeTab === 'tracking') fetchDailyTracking(trackingDate);
    if (activeTab === 'activity') fetchActivityLogs();
    if (activeTab === 'timeline') {
      fetchTimelineReportData();
      fetchTimelineLeads();
    }
    if (activeTab === 'dropped') {
      fetchManagerDroppedLeads();
    }
    if (activeTab === 'decompositions') {
      fetchDecompositions();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'decompositions') {
      fetchDecompositions();
    }
  }, [decompStartDate, decompEndDate]);

  const fetchDecompositions = async () => {
    setDecompositionsLoading(true);
    try {
      const query = new URLSearchParams();
      if (decompStartDate) query.append('startDate', decompStartDate);
      if (decompEndDate) query.append('endDate', decompEndDate);

      const response = await fetch(`/api/manager/leads/decompositions?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setDecompositions(data);
      }
    } catch (err) {
      console.error('Failed to fetch decompositions', err);
    } finally {
      setDecompositionsLoading(false);
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
      if (response.ok) setActivityLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setActivityLoading(false);
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

  const fetchQueue = async () => {
    try {
      const response = await fetch('/api/transfers/queue', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setQueue(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVaultBatches = async (dateFilter) => {
    setVaultLoading(true);
    try {
      const params = dateFilter ? `?date=${dateFilter}` : '';
      const response = await fetch(`/api/vault/batches${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setVaultBatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setVaultLoading(false);
    }
  };

  const fetchVaultDetail = async (batchId) => {
    setVaultDetailLoading(true);
    try {
      const response = await fetch(`/api/vault/batches/${batchId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setVaultDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setVaultDetailLoading(false);
    }
  };

  const fetchConversionLeads = async (batchId, status, fileName) => {
    setConversionLeadsLoading(true);
    setConversionLeadsModal({ batchId, status, file_name: fileName, leads: [] });
    try {
      const response = await fetch(`/api/vault/batches/${batchId}/conversions?status=${status}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setConversionLeadsModal({ batchId, status, file_name: fileName, leads: data });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConversionLeadsLoading(false);
    }
  };

  const fetchCampaignLeads = async (batchId, counselorId, batchName, counselorName) => {
    setCampaignLeadsLoading(true);
    setCampaignLeadsSearch('');
    setCampaignLeadsModal({ batchId, counselorId, batch_name: batchName, counselor_name: counselorName, leads: [] });
    try {
      const response = await fetch(`/api/vault/batches/${batchId}/counselors/${counselorId}/leads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCampaignLeadsModal({ batchId, counselorId, batch_name: batchName, counselor_name: counselorName, leads: data });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCampaignLeadsLoading(false);
    }
  };

  const handleDownloadBatch = async (batchId, originalFileName) => {
    try {
      const response = await fetch(`/api/leads/export/batch/${batchId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${originalFileName}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download batch Excel file.');
    }
  };

  const handleDownloadAllLeads = async () => {
    try {
      const response = await fetch('/api/leads/export/all', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all_leads_export.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download all leads Excel file.');
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('WARNING: Deleting this batch will permanently remove all associated leads and their assignments, follow-ups, and logs. This action cannot be undone.\n\nAre you sure you want to delete this batch?')) {
      return;
    }
    try {
      const response = await fetch(`/api/vault/batches/${batchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete upload batch');
      }
      triggerCelebration('Vault Cleansed! 🧹 Batch Deleted');
      alert('Batch and associated leads deleted successfully.');
      // Refresh vault batches
      fetchVaultBatches(vaultSearch);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to delete upload batch.');
    }
  };

  const fetchTimelineReportData = async () => {
    setTimelineLoading(true);
    try {
      const response = await fetch(`/api/reports/custom-timeline?start_date=${timelineStartDate}&end_date=${timelineEndDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTimelineSummary(data);
      }
    } catch (err) {
      console.error('Failed to fetch timeline report summary', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  const fetchTimelineLeads = async (searchVal = '') => {
    try {
      const searchParam = searchVal ? `&search=${encodeURIComponent(searchVal)}` : '';
      const response = await fetch(`/api/reports/custom-timeline/leads?start_date=${timelineStartDate}&end_date=${timelineEndDate}${searchParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTimelineLeads(data);
      }
    } catch (err) {
      console.error('Failed to fetch timeline leads list', err);
    }
  };

  const fetchManagerDroppedLeads = async () => {
    setDroppedLoading(true);
    try {
      const response = await fetch('/api/manager/leads/dropped', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setManagerDroppedLeads(data);
      }
    } catch (err) {
      console.error('Failed to fetch manager dropped leads', err);
    } finally {
      setDroppedLoading(false);
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
      console.error('Failed to fetch forwarded leads', err);
    } finally {
      setForwardedLoading(false);
    }
  };

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

  const handleDownloadTimelineReport = async () => {
    try {
      const response = await fetch(`/api/reports/custom-timeline/export?start_date=${timelineStartDate}&end_date=${timelineEndDate}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Timeline export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timeline_report_${timelineStartDate}_to_${timelineEndDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download custom timeline Excel report.');
    }
  };

  const handleResolveOpen = (req, type) => {
    setSelectedRequest(req);
    setResolutionType(type);
    setResolveNote('');
    setResolveTargetCouns(req.target_counselor_id || '');
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      const response = await fetch(`/api/transfers/resolve/${selectedRequest.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          outcome: resolutionType,
          note: resolveNote,
          overrideTargetCounselorId: resolveTargetCouns
        })
      });

      if (response.ok) {
        setSelectedRequest(null);
        setResolutionType('');
        fetchQueue();
        fetchCounselors();
        fetchMasterLeads();
        fetchMetrics();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to resolve request');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCounselors = async () => {
    try {
      const response = await fetch('/api/users/counselors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCounselors(data);
        // Initialize allocations & targets
        const initialAllocs = {};
        const initialTargets = {};
        data.forEach(c => {
          initialAllocs[c.id] = 0;
          initialTargets[c.id] = c.monthlyTarget || 10;
        });
        setAllocations(initialAllocs);
        setCounselorTargets(initialTargets);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUniversities = async () => {
    setUniversitiesLoading(true);
    try {
      const response = await fetch('/api/universities', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setUniversitiesList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setUniversitiesLoading(false);
    }
  };

  const handleSaveUniversity = async (e) => {
    e.preventDefault();
    setUniFormError(null);
    setUniFormSuccess(false);
    if (!uniName.trim() || !uniCourses.trim()) {
      setUniFormError('Name and Courses are required.');
      return;
    }
    const coursesArr = uniCourses.split(',').map(c => c.trim()).filter(Boolean);
    const specsArr = uniSpecializations.split(',').map(s => s.trim()).filter(Boolean);
    let feesObj = {};
    if (uniFees.trim()) {
      uniFees.split(',').forEach(pair => {
        const parts = pair.split(':');
        if (parts.length === 2) {
          const c = parts[0].trim();
          const f = parseFloat(parts[1].trim());
          if (c && !isNaN(f)) feesObj[c] = f;
        }
      });
    }
    const payload = { name: uniName, courses: coursesArr, fees: feesObj, eligibility: uniEligibility, specializations: specsArr };
    try {
      const url = editingUniId ? `/api/admin/universities/${editingUniId}` : '/api/admin/universities';
      const method = editingUniId ? 'PUT' : 'POST';
      const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) {
        setUniFormError(data.error || 'Failed to save university.');
      } else {
        setUniFormSuccess(true);
        setUniName(''); setUniCourses(''); setUniFees(''); setUniEligibility(''); setUniSpecializations(''); setEditingUniId(null);
        fetchUniversities();
      }
    } catch (err) {
      setUniFormError('Failed to connect to backend server.');
    }
  };

  const handleEditUniversity = (uni) => {
    setEditingUniId(uni.id);
    setUniName(uni.name);
    setUniCourses(Array.isArray(uni.courses) ? uni.courses.join(', ') : '');
    setUniFees(uni.fees && typeof uni.fees === 'object' ? Object.entries(uni.fees).map(([c, f]) => `${c}: ${f}`).join(', ') : '');
    setUniEligibility(uni.eligibility || '');
    setUniSpecializations(Array.isArray(uni.specializations) ? uni.specializations.join(', ') : '');
    setUniFormError(null); setUniFormSuccess(false);
  };

  const handleDeleteUniversity = async (uniId) => {
    if (!window.confirm('Delete this university?')) return;
    try {
      const response = await fetch(`/api/admin/universities/${uniId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) alert(data.error || 'Failed to delete university');
      else fetchUniversities();
    } catch (err) { console.error(err); }
  };

  const handleTargetInputChange = (counselorId, value) => {
    setCounselorTargets(prev => ({
      ...prev,
      [counselorId]: parseInt(value, 10) || 0
    }));
  };

  const handleSaveTarget = async (counselorId) => {
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const targetCount = counselorTargets[counselorId] || 10;
      const response = await fetch('/api/manager/targets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          counselorId,
          targetCount,
          targetMonth: currentMonth
        })
      });

      if (response.ok) {
        alert('Monthly enrollment target updated successfully.');
        fetchCounselors();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update monthly target.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMasterLeads = async () => {
    try {
      const response = await fetch('/api/leads/master', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMasterLeads(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/reports/pipeline', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMetrics(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllReportData = async () => {
    setReportLoading(true);
    try {
      const [pipelineRes, leaderRes, sourceRes, trendRes] = await Promise.all([
        fetch('/api/reports/pipeline', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/reports/counselor-leaderboard', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/reports/source-breakdown', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/reports/upload-trend', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      const [pipeline, leader, source, trend] = await Promise.all([
        pipelineRes.json(), leaderRes.json(), sourceRes.json(), trendRes.json()
      ]);
      if (pipelineRes.ok) setMetrics(pipeline);
      if (leaderRes.ok) setLeaderboard(leader);
      if (sourceRes.ok) setSourceBreakdown(source);
      if (trendRes.ok) setUploadTrend(trend);
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const fetchTimeline = async (leadId) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/timeline`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setLeadTimeline(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectLead = (lead) => {
    setSelectedLead(lead);
    fetchTimeline(lead.id);
  };

  // Run lead pool search
  const fetchPoolData = async (filterObj) => {
    const params = new URLSearchParams();
    Object.keys(filterObj).forEach(key => {
      if (filterObj[key]) params.append(key, filterObj[key]);
    });

    try {
      const response = await fetch(`/api/leads/pool?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setPoolLeads(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchPool = () => {
    fetchPoolData(filters);
  };

  const fetchDynamicFilters = async (batchId) => {
    try {
      const param = batchId ? `?upload_batch_id=${batchId}` : '';
      const response = await fetch(`/api/leads/pool-filters${param}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setDynamicFilterOptions({
          cities: data.cities || [],
          states: data.states || [],
          courses: data.courses || [],
          sources: data.sources || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch dynamic filters', err);
    }
  };

  const handleSelectBatch = (batchId) => {
    const nextFilters = {
      ...filters,
      upload_batch_id: batchId || '',
      city: '',
      state: '',
      interest: '',
      source: ''
    };
    setFilters(nextFilters);
    fetchPoolData(nextFilters);
    fetchDynamicFilters(batchId);
  };

  // Preview / Analysis file handler
  const handlePreviewSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!uploadFile) return;

    setPreviewLoading(true);
    setUploadError(null);
    setUploadResult(null);
    setPreviewData(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await fetch('/api/leads/upload-preview', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadError(data.error || 'Failed to analyze file');
      } else {
        setPreviewData(data);
        setManualMapping(data.autoMapping || {});
      }
    } catch (err) {
      setUploadError('Failed to connect to backend server.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Upload file handler (confirmed with mapping)
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploadLoading(true);
    setUploadError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('mapping', JSON.stringify(manualMapping));

    try {
      const response = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadError(data.error || 'Upload failed');
      } else {
        setUploadResult(data);
        setSelectedBatchId(data.batchId);
        setPreviewData(null);
        setUploadFile(null);
        fetchMasterLeads();
        fetchMetrics();
        triggerCelebration('File Uploaded! 📁 Data Imported');
      }
    } catch (err) {
      setUploadError('Failed to connect to backend server.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setManualMapping({});
    setUploadFile(null);
    setUploadError(null);
    setUploadResult(null);
  };

  // Manual allocation input changes
  const handleAllocChange = (counselorId, val) => {
    const intVal = parseInt(val, 10) || 0;
    setAllocations(prev => ({
      ...prev,
      [counselorId]: intVal
    }));
  };

  // Distribute leads
  const handleDistribute = async () => {
    const finalAllocations = Object.keys(allocations)
      .map(cid => ({ counselorId: cid, count: allocations[cid] }))
      .filter(a => a.count > 0);

    try {
      const response = await fetch('/api/leads/distribute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          allocations: finalAllocations,
          filterCriteria: filters,
          sourceBatchId: selectedBatchId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Distribution failed');
      } else {
        triggerCelebration('Data Distributed! 🎯 Leads Assigned');
        alert(data.message);
        // Reset state
        fetchCounselors();
        fetchMasterLeads();
        fetchMetrics();
        setPoolLeads([]);
        setActiveTab('repository');
      }
    } catch (err) {
      console.error(err);
      alert('Error during lead distribution');
    }
  };

  // Calculate allocations helper
  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const totalPoolAvailable = poolLeads.length;
  const remainingInPool = totalPoolAvailable - totalAllocated;

  // Security prevention handler
  const handleSecurityBlock = (e) => {
    e.preventDefault();
  };

  const repositoryFilteredLeads = masterLeads.filter(lead => {
    if (repoSearch) {
      const s = repoSearch.toLowerCase();
      const matches =
        (lead.name || '').toLowerCase().includes(s) ||
        (lead.phone || '').includes(s) ||
        (lead.email || '').toLowerCase().includes(s) ||
        (lead.city || '').toLowerCase().includes(s) ||
        (lead.state || '').toLowerCase().includes(s) ||
        (lead.source || '').toLowerCase().includes(s);
      if (!matches) return false;
    }
    if (repoCounselorFilter && lead.counselor_id !== repoCounselorFilter) {
      return false;
    }
    if (repoStageFilter) {
      if (repoStageFilter === 'unassigned') {
        if (lead.counselor_name) return false;
      } else if (lead.stage !== repoStageFilter) {
        return false;
      }
    }
    return true;
  });

  return (
    <div 
      className="min-h-screen bg-[#F8FAFC] flex text-[#111C2D]"
      onContextMenu={handleSecurityBlock}
      onCopy={handleSecurityBlock}
      onCut={handleSecurityBlock}
      onPaste={handleSecurityBlock}
      style={{ userSelect: 'none' }} // Prevents text selection
    >
      {/* Sidebar */}
      <div className="w-[240px] h-screen text-white flex flex-col shrink-0 animate-slide-in-left" style={{ background: '#0C2340' }}>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b flex flex-col items-start gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <SkillLabsLogo className="h-8 w-auto" />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>CRM Admin Portal</span>
          </div>

          <div className="p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 font-label-caps">Role</p>
            <p className="text-sm font-semibold mt-1 font-body-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base" style={{ color: '#1BACE4' }}>manage_accounts</span>
              <span>Manager Operations</span>
            </p>
          </div>

          <nav className="mt-4 space-y-1 px-2">
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'reports', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'reports' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'reports' ? { background: '#1BACE4' } : {}}
            >
              <span className="material-symbols-outlined text-lg">finance</span>
              <span>Reports & Funnel</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'timeline', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'timeline' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'timeline' ? { background: '#D97706' } : {}}
            >
               <span className="material-symbols-outlined text-lg">calendar_month</span>
               <span>Timeline Reports</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'upload', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'upload' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'upload' ? { background: '#1BACE4' } : {}}
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              <span>Upload Data</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'pool', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'pool' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'pool' ? { background: '#1BACE4' } : {}}
            >
              <span className="material-symbols-outlined text-lg">filter_alt</span>
              <span>Filter & Pool</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'distribute', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'distribute' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'distribute' ? { background: '#1BACE4' } : {}}
            >
              <span className="material-symbols-outlined text-lg">group_work</span>
              <span>Data Distribution</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'repository', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'repository' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'repository' ? { background: '#1BACE4' } : {}}
            >
              <span className="material-symbols-outlined text-lg">dataset</span>
              <span>Master Repository</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'transfers', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'transfers' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'transfers' ? { background: '#1BACE4' } : {}}
            >
              <span className="material-symbols-outlined text-lg">sync_alt</span>
              <span>Transfer Queue</span>
              {queue.length > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold font-data-mono">
                  {queue.length}
                </span>
              )}
            </button>
            <button
              onClick={(e) => {
                handleTabClick(setActiveTab, 'vault', e);
                fetchVaultBatches('');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'vault' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'vault' ? { background: '#F7941D' } : {}}
            >
              <span className="material-symbols-outlined text-lg">inventory_2</span>
              <span>Data Vault</span>
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
                 handleTabClick(setActiveTab, 'decompositions', e);
                 fetchDecompositions();
               }}
               className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'decompositions' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
               style={activeTab === 'decompositions' ? { background: '#0D9488' } : {}}
             >
               <span className="material-symbols-outlined text-lg">history_edu</span>
               <span>Lead Journeys & Audits</span>
             </button>
             <button
               onClick={(e) => {
                 handleTabClick(setActiveTab, 'dropped', e);
                 fetchManagerDroppedLeads();
               }}
               className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 active:scale-95 ${activeTab === 'dropped' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
               style={activeTab === 'dropped' ? { background: '#EF4444' } : {}}
             >
               <span className="material-symbols-outlined text-lg">block</span>
               <span>Dropped Leads</span>
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
              <span>Forwarded Leads</span>
            </button>
            <button
              onClick={(e) => {
                handleTabClick(setActiveTab, 'universities', e);
                fetchUniversities();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded active:scale-95 transition duration-150 ${activeTab === 'universities' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'universities' ? { background: '#1BACE4' } : {}}
            >
              <span className="material-symbols-outlined text-lg">school</span>
              <span>Universities</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#114D5D]">
          <div className="text-xs text-slate-300 truncate font-body-sm">{user.name}</div>
          <div className="text-[10px] text-slate-400 truncate mb-3 font-data-mono">{user.email}</div>
          {onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 mb-2 bg-[#F7941D] hover:bg-[#D97706] text-white text-xs font-bold rounded transition duration-150 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Back to Admin Portal</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#BA1A1A] hover:bg-[#93000A] text-white text-xs font-semibold rounded transition duration-150"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col h-screen overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-[56px] border-b border-[#E2E8F0] bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#70787C] font-label-caps">Workspace</span>
            <span className="text-xs text-[#E2E8F0]">/</span>
            <span className="text-xs font-semibold text-[#111C2D] font-body-sm capitalize">{activeTab} panel</span>
          </div>
          <div className="text-xs font-medium text-[#40484B] font-body-sm">
            Due Today: <span className="text-[#0F4C5C] font-bold font-data-mono">{metrics.unassigned} data unassigned</span>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-grow p-6 overflow-y-auto animate-fade-in" key={activeTab}>
          {/* UPLOAD LEADS VIEW */}
          {activeTab === 'upload' && (
            <div className="max-w-4xl bg-white border border-[#E2E8F0] p-6 rounded space-y-6">
              <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps border-b border-[#E2E8F0] pb-3 mb-4">
                Excel/CSV Data Upload & Cleansing Workspace
              </h2>

              {!previewData ? (
                /* STEP 1: Select and Analyze File */
                <form onSubmit={handlePreviewSubmit} className="space-y-6">
                  <div className="border-2 border-dashed border-[#E2E8F0] hover:border-[#0F4C5C] rounded-lg p-8 text-center cursor-pointer transition">
                    <span className="material-symbols-outlined text-4xl text-[#70787C] mb-2">cloud_upload</span>
                    <p className="text-xs font-semibold text-[#111C2D] font-body-sm">Drag and drop file here, or select from computer</p>
                    <p className="text-[11px] text-[#70787C] mt-1 font-body-sm">Supports Excel (.xlsx, .xls) and CSV</p>
                    <input
                      type="file"
                      required
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        setUploadFile(e.target.files[0]);
                        setUploadResult(null);
                        setUploadError(null);
                      }}
                      className="mt-4 block w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                    />
                  </div>

                  {uploadFile && (
                    <div className="flex items-center gap-2 p-2 bg-[#F0F3FF] border border-[#E7EEFF] rounded text-xs text-[#0F4C5C] font-body-sm">
                      <span className="material-symbols-outlined text-lg">insert_drive_file</span>
                      <span className="font-semibold truncate">{uploadFile.name}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={previewLoading || !uploadFile}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#0F4C5C] hover:bg-[#0A333E] text-white text-xs font-semibold rounded disabled:opacity-50 transition"
                  >
                    {previewLoading ? (
                      <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">analytics</span>
                        <span>Analyze File & Map Columns</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* STEP 2: Preview Mapping & Confirm Import */
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">
                        Verify Column Mapping
                      </h3>
                      <span className="text-[10px] bg-[#E2E8F0] text-slate-700 px-2 py-0.5 rounded font-data-mono">
                        {uploadFile.name}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#70787C]">
                      Review matches below. Adjust dropdowns for any unmatched or misaligned columns. Fields marked with <span className="text-[#BA1A1A] font-bold">*</span> are required.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {previewData.systemFields.map((field) => {
                        const isMapped = !!manualMapping[field.key];
                        return (
                          <div key={field.key} className="flex items-center justify-between bg-white border border-[#E2E8F0] p-2 rounded text-xs">
                            <span className="font-semibold flex items-center gap-1">
                              {field.label}
                              {field.required && <span className="text-[#BA1A1A] font-bold">*</span>}
                            </span>
                            <select
                              value={manualMapping[field.key] || ''}
                              onChange={(e) => setManualMapping(prev => ({ ...prev, [field.key]: e.target.value || null }))}
                              className={`text-[11px] p-1 bg-white border rounded w-48 ${
                                isMapped ? 'border-[#E2E8F0] text-slate-800' : 'border-amber-300 bg-amber-50/20 text-amber-800 italic'
                              }`}
                            >
                              <option value="">-- Unmapped --</option>
                              {previewData.headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mapping Preview Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#40484B] font-label-caps">
                      Data Mapping Preview (First 5 Rows)
                    </h4>
                    <div className="border border-[#E2E8F0] rounded overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                            {previewData.systemFields.map((field) => (
                              <th key={field.key} className="p-2 border-r border-[#E2E8F0]">
                                {field.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {previewData.previewRows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-[#F8FAFC]">
                              {previewData.systemFields.map((field) => {
                                const val = row[manualMapping[field.key]];
                                return (
                                  <td key={field.key} className="p-2 border-r border-[#E2E8F0] text-[11px] font-data-mono">
                                    {val !== undefined && val !== null ? String(val) : <span className="text-slate-400 italic">null</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
                    <button
                      onClick={handleCancelPreview}
                      className="py-1.5 px-3 border border-[#E2E8F0] text-xs font-semibold rounded hover:bg-[#F8FAFC]"
                    >
                      Cancel & Choose File
                    </button>
                    <button
                      onClick={handleUploadSubmit}
                      disabled={uploadLoading || !manualMapping.name || !manualMapping.phone}
                      className="py-1.5 px-4 bg-[#0F4C5C] hover:bg-[#0A333E] text-white text-xs font-semibold rounded disabled:opacity-50 transition flex items-center gap-1.5"
                    >
                      {uploadLoading ? (
                        <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                      )}
                      <span>Confirm & Import Leads</span>
                    </button>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 text-[#BA1A1A] text-xs rounded font-body-sm">
                  {uploadError}
                </div>
              )}

              {uploadResult && (
                <div className="border border-[#E2E8F0] rounded p-4 bg-[#F8FAFC]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps mb-3">
                    Upload Cleansing Report
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white border border-[#E2E8F0] p-3 text-center rounded">
                      <div className="text-lg font-bold text-[#111C2D] font-data-mono">{uploadResult.total}</div>
                      <div className="text-[10px] text-[#70787C] font-label-caps mt-1">Total Rows</div>
                    </div>
                    <div className="bg-white border border-green-200 p-3 text-center rounded">
                      <div className="text-lg font-bold text-green-600 font-data-mono">{uploadResult.clean}</div>
                      <div className="text-[10px] text-green-700 font-label-caps mt-1">Clean Data</div>
                    </div>
                    <div className="bg-white border border-amber-200 p-3 text-center rounded">
                      <div className="text-lg font-bold text-amber-500 font-data-mono">{uploadResult.duplicate}</div>
                      <div className="text-[10px] text-amber-700 font-label-caps mt-1">Duplicates</div>
                    </div>
                    <div className="bg-white border border-red-200 p-3 text-center rounded">
                      <div className="text-lg font-bold text-red-600 font-data-mono">{uploadResult.invalid}</div>
                      <div className="text-[10px] text-red-700 font-label-caps mt-1">Invalid</div>
                    </div>
                  </div>

                  {/* Invalid rows detail review panel */}
                  {uploadResult.invalidDetails && uploadResult.invalidDetails.length > 0 && (
                    <div className="mt-4 border-t border-[#E2E8F0] pt-4">
                      <h4 className="text-xs font-bold text-[#BA1A1A] uppercase tracking-wider mb-2 font-label-caps flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        {uploadResult.invalid} Rows Need Review (Failed Validation / Parse Errors)
                      </h4>
                      <div className="max-h-48 overflow-y-auto border border-red-100 rounded bg-red-50/50 p-2 text-xs divide-y divide-red-100">
                        {uploadResult.invalidDetails.map((detail, idx) => (
                          <div key={idx} className="py-1.5 flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-700">Row {detail.rowNumber}: {detail.name || 'Unknown'}</span>
                            <span className="text-[#BA1A1A] font-medium">{detail.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => {
                        setPoolLeads([]);
                        setFilters({ ...filters, start_date: new Date().toISOString().split('T')[0] });
                        setActiveTab('pool');
                      }}
                      className="flex items-center gap-1.5 py-1.5 px-3 bg-[#0F4C5C] hover:bg-[#0A333E] text-white text-xs font-semibold rounded transition"
                    >
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                      <span>Go to Data Distribution</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FILTER & POOL VIEW */}
          {activeTab === 'pool' && (
            <div className="space-y-6">
              {/* Excel Batch Distribution Showcase */}
              <div className="bg-white border border-[#E2E8F0] p-6 rounded shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F4C5C] font-label-caps mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">table_chart</span>
                  <span>Excel Batch Distribution & Segregation Showcase</span>
                </h3>
                {vaultBatches.length === 0 ? (
                  <p className="text-xs text-[#70787C] italic">No uploaded batches found. Go to the Upload tab to import leads.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* All Batches option */}
                    <div 
                      onClick={() => handleSelectBatch('')}
                      className={`border p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                        !filters.upload_batch_id 
                          ? 'border-[#1BACE4] bg-[#F0F9FF] shadow-sm' 
                          : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-slate-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-slate-600 text-lg">folder_open</span>
                          <span className="text-xs font-bold text-slate-800">All Uploaded Batches</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          Distribute from the entire unassigned lead pool across all uploaded Excel files.
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-200/60 pt-3">
                        <span className="text-[10px] text-slate-500 font-semibold font-data-mono">
                          Pool-wide distribution
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          !filters.upload_batch_id ? 'bg-[#1BACE4] text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {!filters.upload_batch_id ? 'Selected' : 'Select'}
                        </span>
                      </div>
                    </div>

                    {/* Individual batches */}
                    {vaultBatches.map(b => {
                      const totalClean = b.clean_rows || 0;
                      const remClean = b.remaining_clean_count !== undefined ? b.remaining_clean_count : totalClean;
                      const distClean = b.distributed_clean_count !== undefined ? b.distributed_clean_count : 0;
                      const progressPct = totalClean > 0 ? (distClean / totalClean) * 100 : 0;
                      const isSelected = filters.upload_batch_id === b.id;

                      return (
                        <div 
                          key={b.id}
                          onClick={() => handleSelectBatch(b.id)}
                          className={`border p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected 
                              ? 'border-[#0F4C5C] bg-[#F0FDF4] shadow-sm' 
                              : 'border-[#CBD5E1] hover:border-slate-400 bg-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 truncate">
                                <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-[#0F4C5C]' : 'text-slate-650'}`}>table_view</span>
                                <span className="text-xs font-bold text-slate-800 truncate" title={b.file_name}>{b.file_name}</span>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400 font-data-mono shrink-0">
                                {totalClean} clean
                              </span>
                            </div>
                            
                            <div className="space-y-1 mt-3">
                              <div className="flex justify-between text-[10px] text-[#70787C] font-semibold">
                                <span>Segregation:</span>
                                <span>{progressPct.toFixed(0)}% Distributed</span>
                              </div>
                              {/* Smooth Progress Bar */}
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div className="bg-[#0F4C5C]" style={{ width: `${progressPct}%` }}></div>
                              </div>
                            </div>
                            
                            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed font-body-xs">
                              Out of <strong>{totalClean}</strong> clean leads, <strong>{distClean}</strong> have been distributed, and <strong>{remClean}</strong> are left.
                            </p>
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="text-[9px] text-[#70787C] font-data-mono truncate max-w-[130px]">
                              Uploaded: {new Date(b.upload_date).toLocaleDateString('en-IN')}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase flex items-center gap-0.5 ${
                              isSelected ? 'bg-[#0F4C5C] text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isSelected && <span className="material-symbols-outlined text-xs">done</span>}
                              {isSelected ? 'Selected' : 'Select'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Filter Bar */}
              <div className="bg-white border border-[#E2E8F0] p-4 rounded">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] font-label-caps mb-3">
                  Data Pool Filtering Parameters
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#70787C] mb-1 font-body-sm">City</label>
                    <select
                      value={filters.city}
                      onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                      className="w-full text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded font-semibold text-slate-800"
                    >
                      <option value="">-- All Cities --</option>
                      {dynamicFilterOptions.cities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#70787C] mb-1 font-body-sm">State</label>
                    <select
                      value={filters.state}
                      onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                      className="w-full text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded font-semibold text-slate-800"
                    >
                      <option value="">-- All States --</option>
                      {dynamicFilterOptions.states.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#70787C] mb-1 font-body-sm">Course Interest</label>
                    <select
                      value={filters.interest}
                      onChange={(e) => setFilters({ ...filters, interest: e.target.value })}
                      className="w-full text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded font-semibold text-slate-800"
                    >
                      <option value="">-- All Courses --</option>
                      {dynamicFilterOptions.courses.map(course => (
                        <option key={course} value={course}>{course}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#70787C] mb-1 font-body-sm">Lead Source</label>
                    <select
                      value={filters.source}
                      onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                      className="w-full text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded font-semibold text-slate-800"
                    >
                      <option value="">-- All Sources --</option>
                      {dynamicFilterOptions.sources.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#70787C] mb-1 font-body-sm">Min Experience (Yrs)</label>
                    <input
                      type="number"
                      value={filters.min_exp}
                      onChange={(e) => setFilters({ ...filters, min_exp: e.target.value })}
                      className="w-full text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#70787C] mb-1 font-body-sm">Interested University</label>
                    <select
                      value={filters.university_id}
                      onChange={(e) => setFilters({ ...filters, university_id: e.target.value })}
                      className="w-full text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded font-semibold text-slate-800"
                    >
                      <option value="">-- All Universities --</option>
                      {universitiesList.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#70787C] mb-1 font-body-sm">Excel Upload Batch</label>
                    <select
                      value={filters.upload_batch_id}
                      onChange={(e) => handleSelectBatch(e.target.value)}
                      className="w-full text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded font-bold text-[#0F4C5C]"
                    >
                      <option value="">-- All Upload Batches --</option>
                      {vaultBatches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.file_name} ({b.clean_rows} Clean)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={handleSearchPool}
                    className="flex items-center gap-1.5 py-1.5 px-4 bg-[#0F4C5C] hover:bg-[#0A333E] text-white text-xs font-semibold rounded transition"
                  >
                    <span className="material-symbols-outlined text-base">search</span>
                    <span>Apply Filters</span>
                  </button>
                </div>
              </div>

              {/* Pool results */}
              <div className="bg-white border border-[#E2E8F0] rounded overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">
                    Filtered Unassigned Pool ({poolLeads.length} data found)
                  </span>
                  
                  {poolLeads.length > 0 && (
                    <button
                      onClick={() => setActiveTab('distribute')}
                      className="flex items-center gap-1 py-1 px-3 bg-[#0F4C5C] hover:bg-[#0A333E] text-white text-xs font-semibold rounded"
                    >
                      <span className="material-symbols-outlined text-base">group_work</span>
                      <span>Send to Distribution</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                        <th className="p-3">Name</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">City/State</th>
                        <th className="p-3">Experience</th>
                        <th className="p-3">Interest</th>
                        <th className="p-3">University</th>
                        <th className="p-3">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-xs font-body-sm text-[#111C2D]">
                      {poolLeads.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="p-8 text-center text-[#70787C]">
                            No matching data found. Adjust your filters above and click Apply.
                          </td>
                        </tr>
                      ) : (
                        poolLeads.map(lead => (
                          <tr key={lead.id} className="hover:bg-[#F1F5F9] transition">
                            <td className="p-3 font-semibold">{lead.name}</td>
                            <td className="p-3 font-data-mono"><MaskedPhone phone={lead.phone} /></td>
                            <td className="p-3 font-data-mono"><MaskedEmail email={lead.email} /></td>
                            <td className="p-3">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : (lead.city || lead.state || '—')}</td>
                            <td className="p-3 font-data-mono">{lead.experience} Yrs</td>
                            <td className="p-3">{lead.course_interest}</td>
                            <td className="p-3">{lead.university_name ? <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded text-[10px] text-[#0F4C5C] font-semibold">{lead.university_name}</span> : '—'}</td>
                            <td className="p-3">
                              <span className="px-1.5 py-0.5 bg-[#F0F3FF] border border-[#E7EEFF] rounded text-[10px] text-[#0F4C5C]">
                                {lead.source}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LEAD DISTRIBUTION VIEW */}
          {activeTab === 'distribute' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E2E8F0] p-6 rounded w-full">
                <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps border-b border-[#E2E8F0] pb-3 mb-6 flex justify-between">
                  <span>Manual Count Allocation Distribution Dashboard</span>
                  <span className="text-[#0F4C5C] font-semibold text-xs font-data-mono">
                    Pool Available: {totalPoolAvailable} Data
                  </span>
                </h2>

                {totalPoolAvailable === 0 ? (
                  <div className="p-6 text-center border border-[#E2E8F0] rounded bg-[#F8FAFC]">
                    <span className="material-symbols-outlined text-4xl text-[#70787C] mb-2">filter_none</span>
                    <p className="text-xs font-semibold text-[#111C2D]">No leads in distribution pool.</p>
                    <p className="text-[11px] text-[#70787C] mt-1 mb-4">Go to the Filter & Pool tab first to search and populate leads.</p>
                    <button
                      onClick={() => setActiveTab('pool')}
                      className="py-1.5 px-3 bg-[#0F4C5C] hover:bg-[#0A333E] text-white text-xs font-semibold rounded"
                    >
                      Filter Leads
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Left Column: Counselor allocations table (3 cols) */}
                    <div className="lg:col-span-3 space-y-6">
                      <div className="border border-[#E2E8F0] rounded overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                              <th className="p-3">Counselor</th>
                              <th className="p-3 text-center">Current Active Load</th>
                              <th className="p-3 text-center">Monthly Target</th>
                              <th className="p-3 text-right">Assign Lead Count</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0] text-xs font-body-sm text-[#111C2D]">
                            {counselors.map(c => (
                              <tr key={c.id} className="hover:bg-[#F8FAFC]">
                                <td className="p-3 font-semibold">{c.name}</td>
                                <td className="p-3 text-center font-data-mono">{c.load} leads</td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <input
                                      type="number"
                                      min="1"
                                      value={counselorTargets[c.id] || ''}
                                      onChange={(e) => handleTargetInputChange(c.id, e.target.value)}
                                      className="w-16 text-center text-xs p-1 bg-white border border-[#E2E8F0] rounded font-data-mono"
                                    />
                                    <button
                                      onClick={() => handleSaveTarget(c.id)}
                                      className="px-2 py-1 bg-[#1BACE4] hover:bg-[#1597C8] text-white font-bold rounded text-[9px] uppercase transition"
                                    >
                                      Set
                                    </button>
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    max={remainingInPool + (allocations[c.id] || 0)}
                                    value={allocations[c.id] || 0}
                                    onChange={(e) => handleAllocChange(c.id, e.target.value)}
                                    className="w-24 text-right text-xs p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded font-data-mono focus:ring-1 focus:ring-[#0F4C5C]"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Totals panel */}
                      <div className="grid grid-cols-3 gap-4 bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded">
                        <div className="text-center">
                          <div className="text-xs text-[#70787C] uppercase font-label-caps">Available Pool</div>
                          <div className="text-xl font-bold mt-1 font-data-mono text-[#111C2D]">{totalPoolAvailable}</div>
                        </div>
                        <div className="text-center border-x border-[#E2E8F0]">
                          <div className="text-xs text-[#70787C] uppercase font-label-caps">Allocated</div>
                          <div className="text-xl font-bold mt-1 font-data-mono text-[#0F4C5C]">{totalAllocated}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-[#70787C] uppercase font-label-caps">Remaining</div>
                          <div className={`text-xl font-bold mt-1 font-data-mono ${remainingInPool < 0 ? 'text-[#BA1A1A]' : 'text-[#70787C]'}`}>
                            {remainingInPool}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
                        <button
                          onClick={() => {
                            const resetAlloc = {};
                            counselors.forEach(c => { resetAlloc[c.id] = 0; });
                            setAllocations(resetAlloc);
                          }}
                          className="py-1.5 px-3 border border-[#E2E8F0] text-xs font-semibold rounded hover:bg-[#F8FAFC]"
                        >
                          Reset Counts
                        </button>
                        <button
                          onClick={handleDistribute}
                          disabled={totalAllocated <= 0 || remainingInPool < 0}
                          className="py-1.5 px-4 bg-[#0F4C5C] hover:bg-[#0A333E] text-white text-xs font-semibold rounded disabled:opacity-50 transition"
                        >
                          Atomic Reconcile & Assign
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Visual load comparison charts (2 cols) */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-xl shadow-sm h-[320px] flex flex-col justify-between">
                        <h4 className="text-xs font-bold text-[#40484B] uppercase tracking-wider font-label-caps flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-[#0f4c5c]">bar_chart</span>
                          Proposed Counselor Load Share
                        </h4>
                        <div className="flex-1 w-full mt-2">
                          {(() => {
                            const chartData = counselors.map(c => ({
                              name: c.name.split(' ')[0],
                              'Current Active Load': c.load,
                              'Proposed New': allocations[c.id] || 0
                            }));
                            return (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={true} vertical={false} />
                                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#70787C' }} />
                                  <YAxis tick={{ fontSize: 9, fill: '#70787C' }} />
                                  <Tooltip contentStyle={{ fontSize: 10 }} />
                                  <Legend wrapperStyle={{ fontSize: 9 }} />
                                  <Bar dataKey="Current Active Load" stackId="a" fill="#1BACE4" />
                                  <Bar dataKey="Proposed New" stackId="a" fill="#F7941D" />
                                </BarChart>
                              </ResponsiveContainer>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="bg-[#F0FDF4] border border-[#DCFCE7] p-4 rounded-xl shadow-sm text-xs space-y-2">
                        <h4 className="text-xs font-bold text-green-800 uppercase tracking-wider font-label-caps flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-green-700">info</span>
                          Distribution Rules Enforced
                        </h4>
                        <ul className="list-disc pl-4 space-y-1 text-green-700 text-[11px] leading-snug">
                          <li><strong>Zero double allocation:</strong> No single lead can be assigned to two counselors.</li>
                          <li><strong>Atomic assignments:</strong> Allocating the leads is all-or-nothing.</li>
                          <li><strong>Load balance:</strong> Compare proposed loads to ensure fair counselor roster work shares.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MASTER LEAD REPOSITORY VIEW */}
          {activeTab === 'repository' && (
            <div className="space-y-6 relative animate-fade-in">
              <div className="bg-white border border-[#E2E8F0] rounded overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC]">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#0F4C5C]">dataset</span>
                      All System Data Workspace
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      Showing {repositoryFilteredLeads.length} of {masterLeads.length} total leads
                    </p>
                  </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Search Bar */}
                      <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] px-2.5 py-1.5 rounded-lg">
                        <span className="material-symbols-outlined text-[#70787C] text-sm">search</span>
                        <input
                          type="text"
                          placeholder="Search name, phone, city..."
                          value={repoSearch}
                          onChange={(e) => setRepoSearch(e.target.value)}
                          className="text-xs focus:outline-none w-48 font-body-sm bg-white"
                        />
                        {repoSearch && (
                          <button onClick={() => setRepoSearch('')} className="text-slate-400 hover:text-red-500 flex items-center">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        )}
                      </div>

                      {/* Counselor Filter */}
                      <select
                        value={repoCounselorFilter}
                        onChange={(e) => setRepoCounselorFilter(e.target.value)}
                        className="text-xs p-2 bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                      >
                        <option value="">All Counselors</option>
                        {counselors.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>

                      {/* Stage Filter */}
                      <select
                        value={repoStageFilter}
                        onChange={(e) => setRepoStageFilter(e.target.value)}
                        className="text-xs p-2 bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0F4C5C]"
                      >
                        <option value="">All Stages</option>
                        <option value="unassigned">Unassigned Pool</option>
                        <option value="L1">Level 1 (Qualification)</option>
                        <option value="L2">Level 2 (Counseling)</option>
                        <option value="L3">Level 3 (Closure)</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                          <th className="p-3">Data Name</th>
                          <th className="p-3">Masked Phone</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">City/State</th>
                          <th className="p-3">Experience</th>
                          <th className="p-3">Source</th>
                          <th className="p-3">Owner Counselor</th>
                          <th className="p-3">Pipeline Stage</th>
                          <th className="p-3">Data Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs font-body-sm text-[#111C2D]">
                        {repositoryFilteredLeads.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="p-8 text-center text-[#70787C] italic">
                              No leads match your search and filter criteria.
                            </td>
                          </tr>
                        ) : (
                          repositoryFilteredLeads.map(lead => (
                            <tr
                              key={lead.id}
                              onClick={() => handleSelectLead(lead)}
                              className="hover:bg-[#F1F5F9] cursor-pointer transition"
                            >
                              <td className="p-3 font-semibold text-[#0F4C5C] hover:underline">{lead.name}</td>
                              <td className="p-3 font-data-mono"><MaskedPhone phone={lead.phone} /></td>
                              <td className="p-3 font-data-mono"><MaskedEmail email={lead.email} /></td>
                              <td className="p-3">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : (lead.city || lead.state || '—')}</td>
                              <td className="p-3 font-data-mono">{lead.experience} Yrs</td>
                              <td className="p-3">
                                <span className="px-1.5 py-0.5 bg-[#F0F3FF] border border-[#E7EEFF] rounded text-[10px] font-medium text-[#0F4C5C]">
                                  {lead.source}
                                </span>
                              </td>
                              <td className="p-3 font-medium text-slate-700">
                                {lead.counselor_name ? (
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-[#0F4C5C]">person</span>
                                    {lead.counselor_name}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Unassigned</span>
                                )}
                              </td>
                            <td className="p-3">
                              {lead.stage ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  lead.stage === 'L1' ? 'bg-slate-100 text-slate-700' :
                                  lead.stage === 'L2' ? 'bg-amber-100 text-amber-700 font-medium' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {lead.stage}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">None</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                                lead.status === 'clean' ? 'text-green-600 bg-green-50 border border-green-200' :
                                lead.status === 'duplicate' ? 'text-amber-600 bg-amber-50 border border-amber-200' :
                                'text-red-600 bg-red-50 border border-red-200'
                              }`}>
                                {lead.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lead detail drawer (slide over) */}
              {selectedLead && (
                <div className="fixed inset-y-0 right-0 z-50 w-[450px] bg-white border-l border-[#CBD5E1] shadow-2xl flex flex-col h-screen">
                  {/* Drawer Header */}
                  <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
                    <div>
                      <h3 className="text-sm font-bold text-[#111C2D] font-headline-md">{selectedLead.name}</h3>
                      <p className="text-[11px] text-[#70787C] font-data-mono">Lead ID: {selectedLead.id}</p>
                    </div>
                    <button
                      onClick={() => setSelectedLead(null)}
                      className="p-1 text-[#70787C] hover:text-[#111C2D] rounded hover:bg-[#E2E8F0] flex items-center"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  {/* Drawer Content */}
                  <div className="flex-grow p-4 overflow-y-auto space-y-6">
                    {/* Basic details */}
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#70787C] font-label-caps border-b border-[#E2E8F0] pb-1 mb-2">
                        Details
                      </h4>
                      <table className="w-full text-xs text-left">
                        <tbody>
                          <tr>
                            <td className="py-1 text-[#70787C] w-24">Phone</td>
                            <td className="py-1 font-data-mono"><MaskedPhone phone={selectedLead.phone} /></td>
                          </tr>
                          <tr>
                            <td className="py-1 text-[#70787C]">Email</td>
                            <td className="py-1 font-data-mono"><MaskedEmail email={selectedLead.email} /></td>
                          </tr>
                          <tr>
                            <td className="py-1 text-[#70787C]">Location</td>
                            <td className="py-1">{selectedLead.city && selectedLead.state ? `${selectedLead.city}, ${selectedLead.state}` : (selectedLead.city || selectedLead.state || '—')}</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-[#70787C]">Experience</td>
                            <td className="py-1 font-data-mono">{selectedLead.experience} Yrs</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-[#70787C]">Salary</td>
                            <td className="py-1 font-data-mono">₹{parseFloat(selectedLead.salary || 0).toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-[#70787C]">Graduation</td>
                            <td className="py-1">{selectedLead.graduation || '—'}</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-[#70787C]">Course Interest</td>
                            <td className="py-1 font-semibold">{selectedLead.course_interest}</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-[#70787C]">Owner</td>
                            <td className="py-1 font-semibold text-[#0F4C5C]">{selectedLead.counselor_name || 'Unassigned'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Timeline Activity logs */}
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#70787C] font-label-caps border-b border-[#E2E8F0] pb-1 mb-3">
                        Activity & Compliance Audit Log
                      </h4>
                      
                      <div className="relative border-l border-[#E2E8F0] pl-4 space-y-4 ml-1">
                        {leadTimeline.length === 0 ? (
                          <div className="text-xs text-[#70787C] italic">No activity logged.</div>
                        ) : (
                          leadTimeline.map(log => (
                            <div key={log.id} className="relative text-xs">
                              {/* Circle icon marker */}
                              <div className="absolute -left-[21px] top-0.5 bg-[#0F4C5C] border-2 border-white w-2.5 h-2.5 rounded-full"></div>
                              <div className="flex justify-between text-[10px] text-[#70787C] font-data-mono">
                                <span>{new Date(log.timestamp).toLocaleString()}</span>
                                <span className="font-semibold text-slate-600">{log.user_name || 'System'}</span>
                              </div>
                              <div className="font-bold text-[#111C2D] capitalize mt-0.5">{log.action}</div>
                              {log.remark && <p className="text-[11px] text-[#40484B] mt-0.5 italic">{log.remark}</p>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REPORTS & FUNNEL VIEW */}
          {activeTab === 'reports' && (
            <div className="space-y-6">

              {/* Refresh button */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0F4C5C]">analytics</span>
                    Reports & Pipeline Intelligence
                  </h2>
                  <p className="text-[11px] text-[#70787C] mt-0.5 font-body-sm">Real-time CRM pipeline metrics, conversion analytics, and counselor performance.</p>
                </div>
                <button
                  onClick={fetchAllReportData}
                  disabled={reportLoading}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-[#0F4C5C] hover:bg-[#0A333E] text-white text-xs font-semibold rounded transition disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-sm ${reportLoading ? 'animate-spin' : ''}`}>refresh</span>
                  Refresh
                </button>
              </div>

              {/* Unassigned leads pending action banner */}
              {metrics.unassigned > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0 mt-0.5">info</span>
                    <div>
                      <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider font-label-caps">Leads Pending Distribution</h4>
                      <p className="text-xs text-amber-700 mt-1">
                        You have <span className="font-bold font-data-mono text-amber-900">{metrics.unassigned}</span> unassigned leads in your data pool. You can filter and distribute them to counselors to begin operations.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPoolLeads([]);
                      setFilters(prev => ({
                        ...prev,
                        location: '',
                        source: '',
                        interest: '',
                        min_exp: '',
                        max_exp: '',
                        start_date: '',
                        end_date: ''
                      }));
                      setActiveTab('pool');
                    }}
                    className="py-1.5 px-4 bg-amber-650 hover:bg-amber-700 text-white text-xs font-bold rounded uppercase tracking-wider transition shrink-0 self-end sm:self-center"
                  >
                    Go to Lead Pool
                  </button>
                </div>
              )}

              {/* Security Audit & Log Monitoring Indicators */}
              <div className="bg-[#EEF2F6] border border-[#CBD5E1] p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-[#40484B] font-body-sm shadow-inner">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0F4C5C] text-base animate-pulse">shield</span>
                  <span><strong>System Security Monitoring Status:</strong> Auditable & Active</span>
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-ping"></span>
                  <span className="text-[10px] text-slate-500">Auto-logging all exports & downloads</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-[#E2E8F0] px-2 py-0.5 rounded font-bold uppercase tracking-wider font-label-caps text-slate-700">Domain Filter: @company.com</span>
                  <span className="text-[10px] bg-[#E2E8F0] px-2 py-0.5 rounded font-bold uppercase tracking-wider font-label-caps text-slate-700">Log Feed: ENFORCED</span>
                </div>
              </div>

              {/* KPI Summary Cards */}
              {(() => {
                const enrolled = metrics.closures.find(c => c.final_status === 'enrolled');
                const lost = metrics.closures.find(c => c.final_status === 'lost');
                const enrolledCount = parseInt(enrolled?.count || 0, 10);
                const lostCount = parseInt(lost?.count || 0, 10);
                const revenue = parseFloat(enrolled?.total_revenue || 0);
                const totalClosed = enrolledCount + lostCount;
                const convRate = totalClosed > 0 ? ((enrolledCount / totalClosed) * 100).toFixed(1) : '0.0';
                const totalActive = metrics.stages.reduce((s, r) => s + parseInt(r.count || 0, 10), 0);
                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-[#E2E8F0] rounded p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-blue-50 rounded"><span className="material-symbols-outlined text-blue-600 text-base">people</span></div>
                        <span className="text-[11px] text-[#70787C] font-label-caps uppercase">Active Leads</span>
                      </div>
                      <div className="text-2xl font-bold text-[#111C2D] font-data-mono">{totalActive}</div>
                      <div className="text-[10px] text-[#70787C] mt-1">In L1 / L2 / L3 pipeline</div>
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-amber-50 rounded"><span className="material-symbols-outlined text-amber-500 text-base">inbox</span></div>
                        <span className="text-[11px] text-[#70787C] font-label-caps uppercase">Unassigned</span>
                      </div>
                      <div className="text-2xl font-bold text-amber-500 font-data-mono">{metrics.unassigned}</div>
                      <div className="text-[10px] text-[#70787C] mt-1">Clean leads pending distribution</div>
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-green-50 rounded"><span className="material-symbols-outlined text-green-600 text-base">check_circle</span></div>
                        <span className="text-[11px] text-[#70787C] font-label-caps uppercase">Enrolled</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600 font-data-mono">{enrolledCount}</div>
                      <div className="text-[10px] text-[#70787C] mt-1">Successfully closed</div>
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-red-50 rounded"><span className="material-symbols-outlined text-red-500 text-base">cancel</span></div>
                        <span className="text-[11px] text-[#70787C] font-label-caps uppercase">Lost</span>
                      </div>
                      <div className="text-2xl font-bold text-red-500 font-data-mono">{lostCount}</div>
                      <div className="text-[10px] text-[#70787C] mt-1">Closed as lost / dropped</div>
                    </div>

                  </div>
                );
              })()}

              {/* Row 1: Pipeline Funnel + Conversion Donut */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Pipeline Funnel Bar Chart */}
                <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] font-label-caps mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0F4C5C] text-base">filter_alt</span>
                    CRM Pipeline Funnel (L1 → L2 → L3)
                  </h3>
                  {(() => {
                    const l1 = parseInt(metrics.stages.find(s => s.stage === 'L1')?.count || 0, 10);
                    const l2 = parseInt(metrics.stages.find(s => s.stage === 'L2')?.count || 0, 10);
                    const l3 = parseInt(metrics.stages.find(s => s.stage === 'L3')?.count || 0, 10);
                    const funnelData = [
                      { stage: 'L1 — Qualification', leads: l1, fill: '#3B82F6' },
                      { stage: 'L2 — Counseling', leads: l2, fill: '#8B5CF6' },
                      { stage: 'L3 — Closure', leads: l3, fill: '#14B8A6' },
                    ];
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#70787C' }} />
                          <YAxis dataKey="stage" type="category" width={140} tick={{ fontSize: 10, fill: '#40484B' }} />
                          <Tooltip
                            contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }}
                            formatter={(v) => [v + ' leads', 'Active']}
                          />
                          <Bar dataKey="leads" radius={[0, 4, 4, 0]}>
                            {funnelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                {/* Conversion Donut */}
                <div className="bg-white border border-[#E2E8F0] rounded p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] font-label-caps mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0F4C5C] text-base">donut_large</span>
                    Closure Breakdown
                  </h3>
                  {(() => {
                    const enrolled = parseInt(metrics.closures.find(c => c.final_status === 'enrolled')?.count || 0, 10);
                    const lost = parseInt(metrics.closures.find(c => c.final_status === 'lost')?.count || 0, 10);
                    const active = metrics.stages.reduce((s, r) => s + parseInt(r.count || 0, 10), 0);
                    const donutData = [
                      { name: 'Enrolled', value: enrolled, color: '#22C55E' },
                      { name: 'Lost', value: lost, color: '#EF4444' },
                      { name: 'Active', value: active, color: '#3B82F6' },
                    ].filter(d => d.value > 0);
                    if (donutData.length === 0) return <div className="flex items-center justify-center h-40 text-xs text-[#70787C] italic">No closure data yet.</div>;
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={donutData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                            {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </div>

              {/* Row 2: Counselor Leaderboard */}
              <div className="bg-white border border-[#E2E8F0] rounded p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] font-label-caps mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0F4C5C] text-base">leaderboard</span>
                  Counselor Performance Leaderboard
                </h3>
                {leaderboard.length === 0 ? (
                  <div className="text-xs text-[#70787C] italic text-center py-8">No counselor data available.</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Bar Chart */}
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={leaderboard.slice(0, 8)} margin={{ left: 0, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#70787C' }} interval={0} angle={-20} textAnchor="end" height={40} />
                        <YAxis tick={{ fontSize: 10, fill: '#70787C' }} />
                        <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="L1" name="L1 Active" fill="#3B82F6" radius={[2,2,0,0]} />
                        <Bar dataKey="L2" name="L2 Active" fill="#8B5CF6" radius={[2,2,0,0]} />
                        <Bar dataKey="L3" name="L3 Active" fill="#14B8A6" radius={[2,2,0,0]} />
                        <Bar dataKey="enrolled" name="Enrolled" fill="#22C55E" radius={[2,2,0,0]} />
                        <Bar dataKey="lost" name="Lost" fill="#EF4444" radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Leaderboard Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border border-[#E2E8F0] rounded">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] text-[#70787C] uppercase tracking-wider font-label-caps">
                            <th className="p-2">#</th>
                            <th className="p-2">Counselor</th>
                            <th className="p-2 text-center text-blue-600">L1</th>
                            <th className="p-2 text-center text-violet-600">L2</th>
                            <th className="p-2 text-center text-teal-600">L3</th>
                            <th className="p-2 text-center text-green-600">✅</th>
                            <th className="p-2 text-center text-red-500">❌</th>
                            <th className="p-2 text-right text-[#0F4C5C]">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {leaderboard.map((c, i) => (
                            <tr key={c.id} className="hover:bg-[#F8FAFC] transition">
                              <td className="p-2 text-[#70787C] font-data-mono">{i + 1}</td>
                              <td className="p-2 font-semibold text-[#111C2D]">{c.name}</td>
                              <td className="p-2 text-center font-data-mono text-blue-600">{c.L1}</td>
                              <td className="p-2 text-center font-data-mono text-violet-600">{c.L2}</td>
                              <td className="p-2 text-center font-data-mono text-teal-600">{c.L3}</td>
                              <td className="p-2 text-center font-data-mono text-green-600 font-bold">{c.enrolled}</td>
                              <td className="p-2 text-center font-data-mono text-red-500">{c.lost}</td>
                              <td className="p-2 text-right font-data-mono text-[#0F4C5C] font-bold">₹{Number(c.revenue).toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 3: Lead Source Pie + Upload Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Lead Source Pie */}
                <div className="bg-white border border-[#E2E8F0] rounded p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] font-label-caps mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0F4C5C] text-base">pie_chart</span>
                    Lead Source Breakdown
                  </h3>
                  {sourceBreakdown.length === 0 ? (
                    <div className="text-xs text-[#70787C] italic text-center py-8">No source data yet.</div>
                  ) : (() => {
                    const COLORS = ['#0F4C5C','#3B82F6','#8B5CF6','#14B8A6','#F59E0B','#EF4444','#22C55E','#64748B'];
                    const pieData = sourceBreakdown.map(s => ({ name: s.source, value: parseInt(s.count, 10) }));
                    return (
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }} formatter={(v) => [v + ' leads', 'Count']} />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                {/* Upload Trend Area Chart */}
                <div className="bg-white border border-[#E2E8F0] rounded p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#40484B] font-label-caps mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0F4C5C] text-base">trending_up</span>
                    14-Day Upload Trend
                  </h3>
                  {uploadTrend.length === 0 ? (
                    <div className="text-xs text-[#70787C] italic text-center py-8">No upload history in last 14 days.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={uploadTrend} margin={{ left: 0, right: 10 }}>
                        <defs>
                          <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0F4C5C" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#0F4C5C" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradClean" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#70787C' }} tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                        <YAxis tick={{ fontSize: 10, fill: '#70787C' }} />
                        <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }} labelFormatter={d => new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        <Area type="monotone" dataKey="total" name="Total Uploaded" stroke="#0F4C5C" strokeWidth={2} fill="url(#gradTotal)" dot={{ r: 3, fill: '#0F4C5C' }} />
                        <Area type="monotone" dataKey="clean" name="Clean Leads" stroke="#22C55E" strokeWidth={2} fill="url(#gradClean)" dot={{ r: 3, fill: '#22C55E' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* L3 Confirmed Joins Panel */}
              <div className="bg-white border border-[#E2E8F0] rounded p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#14B8A6]">school</span>
                      Level 3 Closure Pipeline & Admissions Confirmed to Join
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Track students finalized or close to finalizing admission choices.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">Search:</span>
                    <input
                      type="text"
                      placeholder="Search name, university..."
                      value={l3SearchQuery}
                      onChange={(e) => setL3SearchQuery(e.target.value)}
                      className="text-xs p-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none w-48 font-body-sm"
                    />
                  </div>
                </div>

                {(() => {
                  const l3Leads = masterLeads.filter(l => {
                    if (l.stage !== 'L3') return false;
                    if (!l3SearchQuery) return true;
                    const s = l3SearchQuery.toLowerCase();
                    return (
                      (l.name || '').toLowerCase().includes(s) ||
                      (l.phone || '').includes(s) ||
                      (l.university_name || '').toLowerCase().includes(s) ||
                      (l.course_interest || '').toLowerCase().includes(s) ||
                      (l.counselor_name || '').toLowerCase().includes(s)
                    );
                  });

                  if (l3Leads.length === 0) {
                    return <div className="text-xs text-[#70787C] italic text-center py-6">No Level 3 closure students currently in the pipeline matching search criteria.</div>;
                  }
                  return (
                    <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                            <th className="p-3">Candidate</th>
                            <th className="p-3">Masked Phone</th>
                            <th className="p-3">University Finalized</th>
                            <th className="p-3">Course / Spec</th>
                            <th className="p-3">Counselor</th>
                            <th className="p-3 text-right">Revenue Generated</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                          {l3Leads.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-50 transition">
                              <td className="p-3 font-semibold text-[#0F4C5C]">{lead.name}</td>
                              <td className="p-3 font-data-mono"><MaskedPhone phone={lead.phone} /></td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-[#0F4C5C] text-[10px] font-bold rounded">
                                  {lead.university_name || 'TBD / In Discussion'}
                                </span>
                              </td>
                              <td className="p-3">{lead.course_interest || '—'}</td>
                              <td className="p-3 font-medium text-slate-700">{lead.counselor_name || 'Unassigned'}</td>
                              <td className="p-3 text-right font-bold font-data-mono text-[#059669]">
                                ₹{parseFloat(lead.salary || 0).toLocaleString()}
                              </td>
                              <td className="p-3">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  L3 Active
                                </span>
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

          {/* TIMELINE REPORTS VIEW */}
          {activeTab === 'timeline' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header + Date Picker Bar */}
              <div className="bg-white border border-[#E2E8F0] rounded p-5 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#D97706]">calendar_month</span>
                    Timeline Reports & Deep Funnel Analysis
                  </h2>
                  <p className="text-[11px] text-[#70787C] mt-1 font-body-sm">Aggregate, analyze, and export lead distribution & enrollment conversions for any date window.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#70787C] font-semibold">From:</span>
                    <input
                      type="date"
                      value={timelineStartDate}
                      onChange={(e) => setTimelineStartDate(e.target.value)}
                      className="text-xs p-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded focus:outline-none focus:border-[#D97706] font-semibold text-slate-800"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#70787C] font-semibold">To:</span>
                    <input
                      type="date"
                      value={timelineEndDate}
                      onChange={(e) => setTimelineEndDate(e.target.value)}
                      className="text-xs p-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded focus:outline-none focus:border-[#D97706] font-semibold text-slate-800"
                    />
                  </div>
                  <button
                    onClick={() => { fetchTimelineReportData(); fetchTimelineLeads(timelineSearchQuery); }}
                    className="py-1.5 px-3 bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-semibold rounded transition flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">sync</span>
                    Fetch Report
                  </button>
                  <button
                    onClick={handleDownloadTimelineReport}
                    className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Download Excel
                  </button>
                </div>
              </div>

              {timelineLoading && (
                <div className="flex items-center justify-center py-20 gap-2 text-[#70787C] text-sm bg-white border border-[#E2E8F0] rounded shadow-sm">
                  <span className="material-symbols-outlined animate-spin text-xl text-[#D97706]">sync</span>
                  <span>Generating Custom Timeline Report Summary...</span>
                </div>
              )}

              {!timelineLoading && (
                <>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Uploads Card */}
                    <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm flex items-center gap-4 hover:shadow transition">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded">
                        <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#70787C] uppercase font-bold font-label-caps">Total Data Uploaded</p>
                        <h4 className="text-xl font-extrabold text-[#111C2D] font-headline-md mt-0.5">
                          {timelineSummary.summary.total_uploaded}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 font-body-xs leading-none">
                          Clean: {timelineSummary.summary.clean_rows} · Dup: {timelineSummary.summary.duplicate_rows}
                        </p>
                      </div>
                    </div>

                    {/* Distributed Card */}
                    <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm flex items-center gap-4 hover:shadow transition">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded">
                        <span className="material-symbols-outlined text-2xl">share</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#70787C] uppercase font-bold font-label-caps">Leads Distributed</p>
                        <h4 className="text-xl font-extrabold text-[#111C2D] font-headline-md mt-0.5">
                          {timelineSummary.summary.total_distributed}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 font-body-xs leading-none">
                          Allocated to counselor workflows
                        </p>
                      </div>
                    </div>

                    {/* Conversions Card */}
                    <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm flex items-center gap-4 hover:shadow transition">
                      <div className="p-3 bg-green-50 text-green-600 rounded">
                        <span className="material-symbols-outlined text-2xl">verified_user</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#70787C] uppercase font-bold font-label-caps">Conversions / Drops</p>
                        <h4 className="text-xl font-extrabold text-[#111C2D] font-headline-md mt-0.5 flex items-baseline gap-1.5">
                          <span className="text-green-600">{timelineSummary.summary.enrolled}</span>
                          <span className="text-slate-300 text-sm">/</span>
                          <span className="text-red-500 text-sm">{timelineSummary.summary.lost}</span>
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 font-body-xs leading-none">
                          Conversion Rate: {timelineSummary.summary.total_distributed > 0 ? ((timelineSummary.summary.enrolled / timelineSummary.summary.total_distributed) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>

                    {/* Revenue Card */}
                    <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm flex items-center gap-4 hover:shadow transition">
                      <div className="p-3 bg-emerald-50 text-[#0F4C5C] rounded">
                        <span className="material-symbols-outlined text-2xl">payments</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#70787C] uppercase font-bold font-label-caps">Closure Revenue</p>
                        <h4 className="text-xl font-extrabold text-[#111C2D] font-headline-md mt-0.5">
                          ₹{timelineSummary.summary.revenue.toLocaleString('en-IN')}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 font-body-xs leading-none">
                          From finalized admissions
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section: Upload Batches */}
                  <div className="bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-500 text-lg">folder_open</span>
                        Excel Batches Uploaded in Selected Timeline
                      </h3>
                    </div>
                    {timelineSummary.batches.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#70787C] italic">No Excel batches were uploaded during this date range.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#40484B] font-bold">
                              <th className="p-3 font-semibold">File Name</th>
                              <th className="p-3 font-semibold">Upload Date</th>
                              <th className="p-3 font-semibold">Uploaded By</th>
                              <th className="p-3 font-semibold text-center">Total Rows</th>
                              <th className="p-3 font-semibold text-center">Clean</th>
                              <th className="p-3 font-semibold text-center">Duplicates</th>
                              <th className="p-3 font-semibold text-center">Invalid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timelineSummary.batches.map(b => (
                              <tr key={b.id} className="border-b border-[#E2E8F0]/70 hover:bg-slate-50 transition">
                                <td className="p-3 font-bold text-slate-700 truncate max-w-[250px]" title={b.file_name}>{b.file_name}</td>
                                <td className="p-3 text-slate-500">{new Date(b.upload_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                <td className="p-3 text-slate-600 font-semibold">{b.uploader_name || 'System'}</td>
                                <td className="p-3 text-center text-slate-700 font-data-mono font-semibold">{b.total_rows}</td>
                                <td className="p-3 text-center text-green-600 font-data-mono font-semibold">{b.clean_rows}</td>
                                <td className="p-3 text-center text-amber-600 font-data-mono font-semibold">{b.duplicate_rows}</td>
                                <td className="p-3 text-center text-red-500 font-data-mono font-semibold">{b.invalid_rows}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section: Counselor Allocations & Funnel */}
                  <div className="bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-500 text-lg">group</span>
                        Counselor Workload & Conversion Funnel (Date Range)
                      </h3>
                    </div>
                    {timelineSummary.counselors.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#70787C] italic">No active distribution or closure activity in this period.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#40484B] font-bold">
                              <th className="p-3 font-semibold">Counselor Name</th>
                              <th className="p-3 font-semibold text-center">Level 1</th>
                              <th className="p-3 font-semibold text-center">Level 2</th>
                              <th className="p-3 font-semibold text-center">Level 3</th>
                              <th className="p-3 font-semibold text-center text-green-600">Enrolled</th>
                              <th className="p-3 font-semibold text-center text-red-500">Lost/Dropped</th>
                              <th className="p-3 font-semibold text-right">Revenue Generated</th>
                              <th className="p-3 font-semibold text-center">Conversion %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timelineSummary.counselors.map(c => {
                              const totalAssigned = c.L1 + c.L2 + c.L3 + c.enrolled + c.lost;
                              const conversionRate = totalAssigned > 0 ? ((c.enrolled / totalAssigned) * 100).toFixed(1) : 0;
                              return (
                                <tr key={c.id} className="border-b border-[#E2E8F0]/70 hover:bg-slate-50 transition">
                                  <td className="p-3 font-bold text-slate-700">{c.name}</td>
                                  <td className="p-3 text-center text-blue-500 font-data-mono font-semibold">{c.L1}</td>
                                  <td className="p-3 text-center text-violet-500 font-data-mono font-semibold">{c.L2}</td>
                                  <td className="p-3 text-center text-teal-650 font-data-mono font-semibold">{c.L3}</td>
                                  <td className="p-3 text-center text-green-600 font-bold font-data-mono">{c.enrolled}</td>
                                  <td className="p-3 text-center text-red-500 font-bold font-data-mono">{c.lost}</td>
                                  <td className="p-3 text-right text-slate-700 font-semibold font-data-mono">₹{c.revenue.toLocaleString('en-IN')}</td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      conversionRate >= 15 ? 'bg-green-50 text-green-700 border border-green-200' :
                                      conversionRate >= 5 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                      'bg-slate-55 text-slate-600 border border-slate-200'
                                    }`}>
                                      {conversionRate}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section: Detailed Student List */}
                  <div className="bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-slate-500 text-lg">school</span>
                        Student Detailed Ledger (Timeline Records)
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#70787C] font-semibold">Search:</span>
                        <input
                          type="text"
                          placeholder="Search name, phone, email..."
                          value={timelineSearchQuery}
                          onChange={(e) => { setTimelineSearchQuery(e.target.value); fetchTimelineLeads(e.target.value); }}
                          className="text-xs p-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded focus:outline-none w-48 font-body-sm font-semibold"
                        />
                      </div>
                    </div>
                    {timelineLeads.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#70787C] italic">No student entries match search/date timeline settings.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#40484B] font-bold">
                              <th className="p-3 font-semibold">Student Name</th>
                              <th className="p-3 font-semibold">Contact</th>
                              <th className="p-3 font-semibold">Excel Batch</th>
                              <th className="p-3 font-semibold">Course Interest</th>
                              <th className="p-3 font-semibold">Counselor</th>
                              <th className="p-3 font-semibold text-center">Data Status</th>
                              <th className="p-3 font-semibold text-center">Pipeline / Closure</th>
                              <th className="p-3 font-semibold text-right">Revenue</th>
                              <th className="p-3 font-semibold text-center">Upload Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timelineLeads.map(l => (
                              <tr key={l.id} className="border-b border-[#E2E8F0]/70 hover:bg-slate-50 transition">
                                <td className="p-3 font-bold text-slate-700">{l.name}</td>
                                <td className="p-3">
                                  <div className="text-slate-600 font-semibold"><MaskedPhone phone={l.phone} /></div>
                                  <div className="text-[10px] text-slate-500 font-normal mt-0.5"><MaskedEmail email={l.email} /></div>
                                </td>
                                <td className="p-3 text-slate-500 font-medium truncate max-w-[130px]" title={l.batch_name}>{l.batch_name || 'Seed'}</td>
                                <td className="p-3 text-slate-600 font-semibold">{l.course_interest || 'N/A'}</td>
                                <td className="p-3 text-slate-600 font-bold">{l.counselor_name || <span className="text-slate-400 italic">Unassigned</span>}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    l.status === 'clean' ? 'bg-green-50 text-green-700 border border-green-200' :
                                    l.status === 'duplicate' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    'bg-red-50 text-red-700 border border-red-200'
                                  }`}>
                                    {l.status}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  {l.closure_status ? (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                      l.closure_status === 'enrolled' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                                    }`}>
                                      {l.closure_status}
                                    </span>
                                  ) : l.stage ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                      Stage: {l.stage}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Unassigned</span>
                                  )}
                                </td>
                                <td className="p-3 text-right text-slate-700 font-bold font-data-mono">
                                  {l.closure_revenue > 0 ? `₹${l.closure_revenue.toLocaleString('en-IN')}` : '—'}
                                </td>
                                <td className="p-3 text-center text-slate-500 font-data-mono">
                                  {new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TRANSFER QUEUE VIEW */}
          {activeTab === 'transfers' && (
            <div className="bg-white border border-[#E2E8F0] rounded overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">
                  Pending Counselor Reassignments & Transfers
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps font-headline-xs">
                      <th className="p-3">Candidate</th>
                      <th className="p-3">Requesting Counselor</th>
                      <th className="p-3">Request Type</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Target Assignment</th>
                      <th className="p-3 font-data-mono">Time Pending</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-xs font-body-sm text-[#111C2D]">
                    {queue.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-[#70787C] italic">
                          No pending transfer or reassignment requests.
                        </td>
                      </tr>
                    ) : (
                      queue.map(req => (
                        <tr key={req.id} className="hover:bg-[#F1F5F9] transition">
                          <td className="p-3 font-semibold">{req.lead_name}</td>
                          <td className="p-3">{req.requester_name}</td>
                          <td className="p-3 capitalize">
                            {req.request_type === 'give_up' ? (
                              <span className="px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded text-[10px] font-bold">
                                Give Up (Lost / Reassign)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-sky-50 border border-sky-200 text-sky-700 rounded text-[10px] font-bold">
                                Direct Transfer
                              </span>
                            )}
                          </td>
                           <td className="p-3">{req.reason}</td>
                           <td className="p-3 font-semibold text-[#0F4C5C]">
                             {req.target_name || 'Unspecified (Pool / Open)'}
                           </td>
                           <td className="p-3 font-data-mono">{req.hours_pending} hours</td>
                           <td className="p-3 text-center flex items-center justify-center gap-2">
                             <button
                               onClick={() => handleResolveOpen(req, 'approved')}
                               className="py-1 px-2.5 bg-green-600 hover:bg-green-700 text-white rounded text-[11px] font-semibold"
                             >
                               Approve
                             </button>
                             <button
                               onClick={() => handleResolveOpen(req, 'rejected')}
                               className="py-1 px-2.5 bg-[#BA1A1A] hover:bg-[#93000A] text-white rounded text-[11px] font-semibold"
                             >
                               Reject
                             </button>
                           </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DATA VAULT VIEW */}
          {activeTab === 'vault' && (
            <div className="space-y-4">
              {/* Header + Search Bar */}
              <div className="bg-white border border-[#E2E8F0] rounded p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0F4C5C]">inventory_2</span>
                    Data Vault — Excel Upload History
                  </h2>
                  <p className="text-[11px] text-[#70787C] mt-1 font-body-sm">Permanent archive of all uploaded batches with pipeline & conversion intelligence.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadAllLeads}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition mr-2"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Download All Stored Leads
                  </button>
                  <input
                    type="date"
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    className="text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#0F4C5C] focus:ring-1 focus:ring-[#0F4C5C]"
                  />
                  <button
                    onClick={() => fetchVaultBatches(vaultSearch)}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-[#0F4C5C] hover:bg-[#0A333E] text-white text-xs font-semibold rounded transition"
                  >
                    <span className="material-symbols-outlined text-sm">search</span>
                    Search
                  </button>
                  {vaultSearch && (
                    <button
                      onClick={() => { setVaultSearch(''); fetchVaultBatches(''); }}
                      className="text-xs text-[#70787C] hover:text-[#BA1A1A] underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Loading */}
              {vaultLoading && (
                <div className="flex items-center justify-center py-12 gap-2 text-[#70787C] text-xs">
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  Loading vault data...
                </div>
              )}

              {/* Empty state */}
              {!vaultLoading && vaultBatches.length === 0 && (
                <div className="bg-white border border-[#E2E8F0] rounded p-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-[#70787C] mb-2">folder_open</span>
                  <p className="text-sm font-semibold text-[#40484B]">No batches found</p>
                  <p className="text-[11px] text-[#70787C] mt-1">
                    {vaultSearch ? `No uploads found for ${vaultSearch}. Try a different date.` : 'Upload your first Excel file to see it here.'}
                  </p>
                </div>
              )}

              {/* Batch Cards */}
              {!vaultLoading && vaultBatches.map(batch => (
                <div key={batch.id} className="bg-white border border-[#E2E8F0] rounded overflow-hidden">
                  {/* Card Header */}
                  <div className="p-4 border-b border-[#E2E8F0] flex items-start justify-between gap-4 bg-[#F8FAFC]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#E6F1F3] rounded">
                        <span className="material-symbols-outlined text-[#0F4C5C] text-xl">table_view</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#111C2D] font-headline-sm">{batch.file_name}</p>
                        <p className="text-[11px] text-[#70787C] font-body-sm mt-0.5">
                          Uploaded by <strong>{batch.uploader_name || 'Unknown'}</strong> &nbsp;·&nbsp;
                          {new Date(batch.upload_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {batch.distribution_count > 0 && (
                        <span className="px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold rounded">
                          {batch.distribution_count} Distribution{batch.distribution_count > 1 ? 's' : ''}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          if (vaultDetail && vaultDetail.batch.id === batch.id) {
                            setVaultDetail(null);
                          } else {
                            fetchVaultDetail(batch.id);
                          }
                        }}
                        className="flex items-center gap-1 py-1 px-2.5 border border-[#0F4C5C] text-[#0F4C5C] hover:bg-[#0F4C5C] hover:text-white text-[11px] font-semibold rounded transition"
                      >
                        <span className="material-symbols-outlined text-sm">group</span>
                        {vaultDetail && vaultDetail.batch.id === batch.id ? 'Hide Details' : 'Distribution Details'}
                      </button>
                      <button
                        onClick={() => handleDownloadBatch(batch.id, batch.file_name)}
                        className="flex items-center gap-1 py-1 px-2.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold rounded transition"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Download Excel
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="flex items-center gap-1 py-1 px-2.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold rounded transition"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Card Body: Stats Grid */}
                  <div className="p-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
                    {/* Upload cleansing counts */}
                    <div className="col-span-2 md:col-span-4 lg:col-span-4 grid grid-cols-4 gap-3">
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3 text-center">
                        <div className="text-base font-bold text-[#111C2D] font-data-mono">{batch.total_rows}</div>
                        <div className="text-[10px] text-[#70787C] font-label-caps mt-1">Total Rows</div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
                        <div className="text-base font-bold text-green-600 font-data-mono">{batch.clean_rows}</div>
                        <div className="text-[10px] text-green-700 font-label-caps mt-1">Clean</div>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
                        <div className="text-base font-bold text-amber-500 font-data-mono">{batch.duplicate_rows}</div>
                        <div className="text-[10px] text-amber-700 font-label-caps mt-1">Duplicates</div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
                        <div className="text-base font-bold text-red-600 font-data-mono">{batch.invalid_rows}</div>
                        <div className="text-[10px] text-red-700 font-label-caps mt-1">Invalid</div>
                      </div>
                    </div>

                    {/* Pipeline Stage counts */}
                    <div className="col-span-2 md:col-span-4 lg:col-span-3 grid grid-cols-3 gap-3">
                      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                        <div className="text-base font-bold text-blue-600 font-data-mono">{batch.stages.L1}</div>
                        <div className="text-[10px] text-blue-700 font-label-caps mt-1">Level 1</div>
                      </div>
                      <div className="bg-violet-50 border border-violet-200 rounded p-3 text-center">
                        <div className="text-base font-bold text-violet-600 font-data-mono">{batch.stages.L2}</div>
                        <div className="text-[10px] text-violet-700 font-label-caps mt-1">Level 2</div>
                      </div>
                      <div className="bg-teal-50 border border-teal-200 rounded p-3 text-center">
                        <div className="text-base font-bold text-teal-600 font-data-mono">{batch.stages.L3}</div>
                        <div className="text-[10px] text-teal-700 font-label-caps mt-1">Level 3</div>
                      </div>
                    </div>
                  </div>

                  {/* Conversion Strip */}
                  <div className="px-4 pb-4 flex items-center gap-4 flex-wrap">
                    <button
                      onClick={() => fetchConversionLeads(batch.id, 'enrolled', batch.file_name)}
                      className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 px-2.5 py-1 rounded-full text-green-700 hover:bg-green-100 transition shadow-sm font-semibold"
                    >
                      <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                      <span>Enrolled: <strong className="font-data-mono">{batch.conversions.enrolled}</strong></span>
                    </button>
                    <div className="text-[#E2E8F0]">|</div>
                    <button
                      onClick={() => fetchConversionLeads(batch.id, 'lost', batch.file_name)}
                      className="flex items-center gap-1.5 text-xs bg-red-50 border border-red-200 px-2.5 py-1 rounded-full text-red-700 hover:bg-red-100 transition shadow-sm font-semibold"
                    >
                      <span className="material-symbols-outlined text-red-500 text-sm">cancel</span>
                      <span>Lost: <strong className="font-data-mono">{batch.conversions.lost}</strong></span>
                    </button>
                    <div className="text-[#E2E8F0]">|</div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="material-symbols-outlined text-[#0F4C5C] text-base">currency_rupee</span>
                      <span className="font-semibold text-[#111C2D]">Revenue:</span>
                      <span className="font-bold text-[#0F4C5C] font-data-mono">
                        ₹{Number(batch.conversions.revenue || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {batch.conversions.enrolled + batch.conversions.lost > 0 && (
                      <>
                        <div className="text-[#E2E8F0]">|</div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="material-symbols-outlined text-amber-500 text-base">percent</span>
                          <span className="font-semibold text-[#111C2D]">Conversion Rate:</span>
                          <span className="font-bold text-amber-600 font-data-mono">
                            {((batch.conversions.enrolled / (batch.conversions.enrolled + batch.conversions.lost)) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Distribution Detail Drawer */}
                  {vaultDetail && vaultDetail.batch.id === batch.id && (
                    <div className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
                      {vaultDetailLoading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-[#70787C] text-xs">
                          <span className="material-symbols-outlined animate-spin">sync</span>
                          Loading distribution details...
                        </div>
                      ) : vaultDetail.distributions.length === 0 ? (
                        <div className="p-6 text-center text-[11px] text-[#70787C] italic">
                          No distribution events recorded for this batch.
                        </div>
                      ) : (
                        vaultDetail.distributions.map((dist, di) => (
                          <div key={dist.id} className="p-4 border-b border-[#E2E8F0] last:border-b-0">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="material-symbols-outlined text-[#0F4C5C] text-base">group_work</span>
                              <span className="text-xs font-bold text-[#111C2D]">
                                Distribution #{di + 1}
                              </span>
                              <span className="text-[10px] text-[#70787C] font-body-sm">
                                — {new Date(dist.distributed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                &nbsp;by&nbsp;<strong>{dist.distributor_name || 'Unknown'}</strong>
                                &nbsp;·&nbsp;<strong>{dist.total_leads}</strong> leads distributed
                              </span>
                            </div>

                            {dist.allocations.length === 0 ? (
                              <p className="text-[11px] text-[#70787C] italic ml-6">No counselor allocations recorded.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border border-[#E2E8F0] rounded text-xs">
                                  <thead>
                                    <tr className="bg-white border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                                      <th className="p-2.5">Counselor</th>
                                      <th className="p-2.5">Email</th>
                                      <th className="p-2.5 text-center">Assigned</th>
                                      <th className="p-2.5 text-center text-blue-600">L1</th>
                                      <th className="p-2.5 text-center text-violet-600">L2</th>
                                      <th className="p-2.5 text-center text-teal-600">L3</th>
                                      <th className="p-2.5 text-center text-green-600">Enrolled</th>
                                      <th className="p-2.5 text-center text-red-500">Lost</th>
                                      <th className="p-2.5 text-right text-[#0F4C5C]">Revenue</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#F0F4F8] font-body-sm">
                                    {dist.allocations.map(alloc => (
                                      <tr key={alloc.id} className="hover:bg-white transition">
                                        <td className="p-2.5">
                                          <button
                                            onClick={() => fetchCampaignLeads(batch.id, alloc.counselor_id, batch.file_name, alloc.counselor_name)}
                                            className="text-[#0F4C5C] hover:underline font-semibold text-left transition"
                                          >
                                            {alloc.counselor_name}
                                          </button>
                                        </td>
                                        <td className="p-2.5 text-[#70787C] font-data-mono">{alloc.counselor_email}</td>
                                        <td className="p-2.5 text-center font-bold font-data-mono">{alloc.requested_count}</td>
                                        <td className="p-2.5 text-center font-data-mono text-blue-600">{alloc.stages.L1}</td>
                                        <td className="p-2.5 text-center font-data-mono text-violet-600">{alloc.stages.L2}</td>
                                        <td className="p-2.5 text-center font-data-mono text-teal-600">{alloc.stages.L3}</td>
                                        <td className="p-2.5 text-center font-data-mono text-green-600 font-bold">{alloc.conversions.enrolled}</td>
                                        <td className="p-2.5 text-center font-data-mono text-red-500">{alloc.conversions.lost}</td>
                                        <td className="p-2.5 text-right font-data-mono text-[#0F4C5C] font-bold">
                                          ₹{Number(alloc.conversions.revenue || 0).toLocaleString('en-IN')}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* DAILY STATUS TRACKER TAB */}
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
                                              <span className="font-bold text-[#0F4C5C]">[{act.action}]</span> {act.remark ? act.remark.slice(0, 40) : ''}{'...' }
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

          {/* ACTIVITY LOGS TAB */}
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
          {activeTab === 'universities' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form */}
              <div className="bg-white border border-[#E2E8F0] p-6 rounded shadow-sm h-fit">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps border-b border-[#E2E8F0] pb-2 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1BACE4] text-base">school</span>
                  <span>{editingUniId ? 'Edit University' : 'Register University'}</span>
                </h3>
                {uniFormError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-[#BA1A1A] text-xs rounded">{uniFormError}</div>}
                {uniFormSuccess && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded font-semibold">University saved successfully!</div>}
                <form onSubmit={handleSaveUniversity} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">University Name</label>
                    <input type="text" required placeholder="e.g. Boston University" value={uniName} onChange={(e) => setUniName(e.target.value)} className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Courses (comma separated)</label>
                    <input type="text" required placeholder="e.g. Online MBA, Executive MBA" value={uniCourses} onChange={(e) => setUniCourses(e.target.value)} className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Fees Mapping (Course: Amount)</label>
                    <input type="text" placeholder="e.g. Online MBA: 24000, Exec MBA: 35000" value={uniFees} onChange={(e) => setUniFees(e.target.value)} className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Specializations (comma separated)</label>
                    <input type="text" placeholder="e.g. Finance, Marketing, Operations" value={uniSpecializations} onChange={(e) => setUniSpecializations(e.target.value)} className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Eligibility Criteria</label>
                    <textarea placeholder="e.g. Bachelor's degree with 3+ years experience" value={uniEligibility} onChange={(e) => setUniEligibility(e.target.value)} rows="3" className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-grow py-2 bg-[#1BACE4] hover:bg-[#1597C8] text-white text-xs font-bold rounded transition">
                      {editingUniId ? 'Update University' : 'Add University'}
                    </button>
                    {editingUniId && (
                      <button type="button" onClick={() => { setEditingUniId(null); setUniName(''); setUniCourses(''); setUniFees(''); setUniEligibility(''); setUniSpecializations(''); }} className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded transition">Cancel</button>
                    )}
                  </div>
                </form>
              </div>

              {/* Universities table */}
              <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">Registered Universities</span>
                  <span className="text-[10px] bg-slate-200 text-slate-800 py-0.5 px-2 rounded-full font-bold">Total: {universitiesList.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                        <th className="p-3">University Details</th>
                        <th className="p-3">Courses &amp; Fees</th>
                        <th className="p-3">Specializations</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-[#111C2D]">
                      {universitiesLoading ? (
                        <tr><td colSpan="4" className="p-8 text-center text-[#70787C] italic">Loading universities...</td></tr>
                      ) : universitiesList.length === 0 ? (
                        <tr><td colSpan="4" className="p-8 text-center text-[#70787C] italic">No universities registered yet.</td></tr>
                      ) : universitiesList.map(uni => (
                        <tr key={uni.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 space-y-1">
                            <div className="font-semibold text-sm text-[#0F4C5C]">{uni.name}</div>
                            {uni.eligibility && <div className="text-[10px] text-slate-500 italic"><strong>Eligibility:</strong> {uni.eligibility}</div>}
                          </td>
                          <td className="p-3 space-y-1">
                            {uni.courses && Array.isArray(uni.courses) && uni.courses.map(course => {
                              const feeVal = uni.fees && uni.fees[course];
                              return (
                                <div key={course} className="flex justify-between gap-4 text-[11px]">
                                  <span className="font-medium">{course}</span>
                                  {feeVal !== undefined && <span className="text-[#059669] font-semibold font-data-mono">₹{feeVal.toLocaleString()}</span>}
                                </div>
                              );
                            })}
                          </td>
                          <td className="p-3">
                            {uni.specializations && Array.isArray(uni.specializations) ? (
                              <div className="flex flex-wrap gap-1">
                                {uni.specializations.map(spec => (
                                  <span key={spec} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-[10px] text-slate-700 rounded-full font-medium">{spec}</span>
                                ))}
                              </div>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button onClick={() => handleEditUniversity(uni)} className="px-2 py-1 bg-slate-100 hover:bg-[#1BACE4] hover:text-white border border-[#CBD5E1] rounded text-[#003441] text-[10px] font-bold uppercase transition">Edit</button>
                            <button onClick={() => handleDeleteUniversity(uni.id)} className="px-2 py-1 bg-red-50 hover:bg-[#BA1A1A] hover:text-white border border-red-200 text-[#BA1A1A] text-[10px] font-bold uppercase transition">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dropped' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#EF4444] text-xl font-bold">block</span>
                      Dropped & Lost Leads Repository
                    </h2>
                    <p className="text-[11px] text-[#70787C] mt-1 font-body-sm font-normal">
                      Monitor and review all leads dropped across all counselors, including reasons, remarks, and stage dropped.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#CBD5E1]">search</span>
                    <input
                      type="text"
                      placeholder="Search name, phone, counselor, reason..."
                      value={droppedSearchQuery}
                      onChange={(e) => setDroppedSearchQuery(e.target.value)}
                      className="text-xs p-2 bg-[#F9F9FF] border border-[#E2E8F0] rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-[#EF4444]"
                    />
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              {(() => {
                const l1Count = managerDroppedLeads.filter(l => l.drop_stage === 'L1').length;
                const l2Count = managerDroppedLeads.filter(l => l.drop_stage === 'L2').length;
                const l3Count = managerDroppedLeads.filter(l => l.drop_stage === 'L3').length;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-[#CBD5E1] rounded-xl p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Total Drops</p>
                        <h4 className="text-2xl font-bold text-slate-800 mt-1 font-data-mono">{managerDroppedLeads.length}</h4>
                      </div>
                      <span className="material-symbols-outlined text-3xl text-slate-400">archive</span>
                    </div>
                    <div className="bg-white border border-[#CBD5E1] rounded-xl p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider font-label-caps">Dropped at L1</p>
                        <h4 className="text-2xl font-bold text-orange-600 mt-1 font-data-mono">{l1Count}</h4>
                      </div>
                      <span className="material-symbols-outlined text-3xl text-orange-400 font-bold">arrow_forward</span>
                    </div>
                    <div className="bg-white border border-[#CBD5E1] rounded-xl p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider font-label-caps">Dropped at L2</p>
                        <h4 className="text-2xl font-bold text-blue-600 mt-1 font-data-mono">{l2Count}</h4>
                      </div>
                      <span className="material-symbols-outlined text-3xl text-blue-400 font-bold">arrow_forward</span>
                    </div>
                    <div className="bg-white border border-[#CBD5E1] rounded-xl p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider font-label-caps">Dropped at L3</p>
                        <h4 className="text-2xl font-bold text-purple-600 mt-1 font-data-mono">{l3Count}</h4>
                      </div>
                      <span className="material-symbols-outlined text-3xl text-purple-400 font-bold">arrow_forward</span>
                    </div>
                  </div>
                );
              })()}

              {/* Leads Table */}
              {droppedLoading ? (
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-10 text-center text-xs text-slate-500 italic">
                  Loading dropped leads data...
                </div>
              ) : (
                <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm overflow-hidden">
                  {(() => {
                    const filtered = managerDroppedLeads.filter(lead => {
                      if (!droppedSearchQuery) return true;
                      const q = droppedSearchQuery.toLowerCase();
                      return (
                        (lead.name || '').toLowerCase().includes(q) ||
                        (lead.phone || '').includes(q) ||
                        (lead.counselor_name || '').toLowerCase().includes(q) ||
                        (lead.course_interest || '').toLowerCase().includes(q) ||
                        (lead.drop_stage || '').toLowerCase().includes(q) ||
                        (lead.drop_remark || '').toLowerCase().includes(q) ||
                        (lead.status || '').toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-10 text-center text-xs text-slate-500 italic">
                          No dropped leads match the query.
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto min-w-0">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <tr className="text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                              <th className="p-3 pl-4">Candidate</th>
                              <th className="p-3">Phone</th>
                              <th className="p-3">Assigned Counselor</th>
                              <th className="p-3">Stage Dropped At</th>
                              <th className="p-3">Course</th>
                              <th className="p-3">Drop Status/Reason</th>
                              <th className="p-3">Remarks</th>
                              <th className="p-3 pr-4">Dropped Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                            {filtered.map((lead) => (
                              <tr key={lead.id} className="hover:bg-slate-50/70 transition">
                                <td className="p-3 pl-4">
                                  <div className="font-semibold text-[#1BACE4]">{lead.name}</div>
                                  <div className="text-[10px] text-slate-500">{lead.city || 'No City'}, {lead.state || 'No State'}</div>
                                </td>
                                <td className="p-3 text-slate-600 font-data-mono"><MaskedPhone phone={lead.phone} /></td>
                                <td className="p-3 font-semibold text-slate-700">{lead.counselor_name || <span className="text-slate-400 italic">Unassigned</span>}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    lead.drop_stage === 'L1' ? 'bg-orange-100 text-orange-700' :
                                    lead.drop_stage === 'L2' ? 'bg-blue-100 text-blue-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {lead.drop_stage || 'Unknown'}
                                  </span>
                                </td>
                                <td className="p-3">{lead.course_interest || '—'}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    lead.status === 'invalid' ? 'bg-red-100 text-red-700' :
                                    lead.status === 'duplicate' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-700'
                                  }`}>
                                    {lead.status || 'closed'}
                                  </span>
                                </td>
                                <td className="p-3 max-w-[300px] truncate text-slate-600 font-normal italic" title={lead.drop_remark}>
                                  {lead.drop_remark || 'No remark provided'}
                                </td>
                                <td className="p-3 pr-4 text-[10px] text-slate-500 font-data-mono">
                                  {lead.closed_at
                                    ? new Date(lead.closed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {activeTab === 'decompositions' && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 border border-[#CBD5E1] rounded-2xl shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-[#111C2D] font-display uppercase tracking-wider">Lead Journey & Audit Decompositions</h2>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Trace the stage-by-stage lifecycle history of candidates including qualification, advanced punch, registration, documents, and closure.
                  </p>
                </div>
                
                {/* Actions & Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">From:</label>
                    <input
                      type="date"
                      value={decompStartDate}
                      onChange={(e) => setDecompStartDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-[#1BACE4]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">To:</label>
                    <input
                      type="date"
                      value={decompEndDate}
                      onChange={(e) => setDecompEndDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-[#1BACE4]"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (decompositions.length === 0) return;
                      // Generate CSV Export
                      const headers = [
                        'Lead ID', 'Candidate Name', 'Phone', 'Email', 'City', 'State', 'Course Interest', 'Source', 'Target University',
                        'L1 Qualified Date', 'L1 Counselor', 'L1 Remarks',
                        'L2 Punch Date', 'L2 Counselor', 'L2 Remarks',
                        'L3 Reg Date', 'L3 Reg Counselor', 'L3 Reg Remarks',
                        'L3 Docs Verified Date', 'L3 Docs Counselor', 'L3 Docs Remarks',
                        'L3 Fees/Closure Date', 'L3 Fees Counselor', 'L3 Fees Remarks',
                        'Final Status', 'Closed Revenue', 'Drop Stage', 'Drop Reason/Remarks'
                      ];

                      const rows = decompositions.map(j => {
                        const escapeCSV = (val) => {
                          if (val === null || val === undefined) return '';
                          const str = String(val).replace(/"/g, '""');
                          return `"${str}"`;
                        };
                        
                        const formatDate = (ts) => {
                          if (!ts) return '';
                          return new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                        };

                        return [
                          escapeCSV(j.id),
                          escapeCSV(j.name),
                          escapeCSV(j.phone),
                          escapeCSV(j.email),
                          escapeCSV(j.city),
                          escapeCSV(j.state),
                          escapeCSV(j.course_interest),
                          escapeCSV(j.source),
                          escapeCSV(j.university_name),
                          escapeCSV(formatDate(j.l1?.date)),
                          escapeCSV(j.l1?.counselor),
                          escapeCSV(j.l1?.remark),
                          escapeCSV(formatDate(j.l2?.date)),
                          escapeCSV(j.l2?.counselor),
                          escapeCSV(j.l2?.remark),
                          escapeCSV(formatDate(j.l3_reg?.date)),
                          escapeCSV(j.l3_reg?.counselor),
                          escapeCSV(j.l3_reg?.remark),
                          escapeCSV(formatDate(j.l3_docs?.date)),
                          escapeCSV(j.l3_docs?.counselor),
                          escapeCSV(j.l3_docs?.remark),
                          escapeCSV(formatDate(j.l3_fees?.date)),
                          escapeCSV(j.l3_fees?.counselor),
                          escapeCSV(j.l3_fees?.remark),
                          escapeCSV(j.final_status),
                          escapeCSV(j.closure_revenue),
                          escapeCSV(j.drop_stage),
                          escapeCSV(j.drop_remark)
                        ].join(',');
                      });

                      const csvContent = [headers.join(','), ...rows].join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.setAttribute('href', url);
                      link.setAttribute('download', `lead_decompositions_export_${decompStartDate}_to_${decompEndDate}.csv`);
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    disabled={decompositions.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white rounded text-xs font-bold uppercase transition active:scale-95 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>Export Bulk CSV ({decompositions.length})</span>
                  </button>
                </div>
              </div>

              {/* Real-time search filter */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">search</span>
                </span>
                <input
                  type="text"
                  placeholder="Filter journeys by name, phone, course, or counselor..."
                  value={decompSearch}
                  onChange={(e) => setDecompSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#111C2D] outline-none shadow-sm focus:ring-1 focus:ring-[#1BACE4] transition"
                />
              </div>

              {/* Journey table */}
              {decompositionsLoading ? (
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-10 text-center text-xs text-slate-500 italic">
                  Compiling stage audit records...
                </div>
              ) : (
                <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm overflow-hidden">
                  {(() => {
                    const filtered = decompositions.filter(j => {
                      if (!decompSearch) return true;
                      const q = decompSearch.toLowerCase();
                      return (
                        (j.name || '').toLowerCase().includes(q) ||
                        (j.phone || '').includes(q) ||
                        (j.course_interest || '').toLowerCase().includes(q) ||
                        (j.source || '').toLowerCase().includes(q) ||
                        (j.university_name || '').toLowerCase().includes(q) ||
                        (j.l1?.counselor || '').toLowerCase().includes(q) ||
                        (j.l2?.counselor || '').toLowerCase().includes(q) ||
                        (j.l3_reg?.counselor || '').toLowerCase().includes(q) ||
                        (j.l3_docs?.counselor || '').toLowerCase().includes(q) ||
                        (j.l3_fees?.counselor || '').toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-10 text-center text-xs text-slate-500 italic">
                          No journey audit logs found for the selected period.
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto min-w-0">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <tr className="text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps border-b border-[#E2E8F0]">
                              <th className="p-3 pl-4 border-r border-[#E2E8F0]" colSpan={3}>Lead Overview</th>
                              <th className="p-3 text-center border-r border-[#E2E8F0]" colSpan={2}>L1 Qualification</th>
                              <th className="p-3 text-center border-r border-[#E2E8F0]" colSpan={2}>L2 Lead Punch</th>
                              <th className="p-3 text-center border-r border-[#E2E8F0]" colSpan={6}>L3 Onboarding milestones</th>
                            </tr>
                            <tr className="text-[9px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps bg-[#F1F5F9]">
                              <th className="p-2 pl-4">Candidate</th>
                              <th className="p-2">Course / Source</th>
                              <th className="p-2 border-r border-[#CBD5E1]">University</th>
                              
                              <th className="p-2 text-center">Qualified Date</th>
                              <th className="p-2 border-r border-[#CBD5E1]">L1 Counselor</th>
                              
                              <th className="p-2 text-center">Punched Date</th>
                              <th className="p-2 border-r border-[#CBD5E1]">L2 Counselor</th>
                              
                              <th className="p-2 text-center">Reg Date</th>
                              <th className="p-2 text-center">Docs Date</th>
                              <th className="p-2 text-center">Fees Date</th>
                              <th className="p-2">L3 Counselor</th>
                              <th className="p-2">Final Status</th>
                              <th className="p-2 pr-4">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                            {filtered.map(j => {
                              const formatDate = (ts) => {
                                if (!ts) return '—';
                                return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' +
                                       new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                              };

                              return (
                                <tr key={j.id} className="hover:bg-slate-50/70 transition">
                                  {/* Lead Overview */}
                                  <td className="p-3 pl-4">
                                    <div className="font-semibold text-[#1BACE4]">{j.name}</div>
                                    <div className="text-[10px] text-slate-500 font-data-mono"><MaskedPhone phone={j.phone} /></div>
                                  </td>
                                  <td className="p-3">
                                    <div>{j.course_interest || '—'}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">{j.source || '—'}</div>
                                  </td>
                                  <td className="p-3 border-r border-[#E2E8F0]">
                                    <span className="font-semibold text-slate-700">{j.university_name || '—'}</span>
                                  </td>

                                  {/* L1 Qualification */}
                                  <td className="p-3 text-center text-slate-500 font-data-mono text-[10px]">{formatDate(j.l1?.date)}</td>
                                  <td className="p-3 border-r border-[#E2E8F0] text-center font-medium text-slate-600" title={j.l1?.remark}>
                                    {j.l1?.counselor || '—'}
                                  </td>

                                  {/* L2 Punch */}
                                  <td className="p-3 text-center text-slate-500 font-data-mono text-[10px]">{formatDate(j.l2?.date)}</td>
                                  <td className="p-3 border-r border-[#E2E8F0] text-center font-medium text-slate-600" title={j.l2?.remark}>
                                    {j.l2?.counselor || '—'}
                                  </td>

                                  {/* L3 Milestones */}
                                  <td className="p-3 text-center text-slate-500 font-data-mono text-[10px]">{formatDate(j.l3_reg?.date)}</td>
                                  <td className="p-3 text-center text-slate-500 font-data-mono text-[10px]">{formatDate(j.l3_docs?.date)}</td>
                                  <td className="p-3 text-center text-slate-500 font-data-mono text-[10px]">{formatDate(j.l3_fees?.date)}</td>
                                  <td className="p-3 font-medium text-slate-600">
                                    {j.l3_fees?.counselor || j.l3_docs?.counselor || j.l3_reg?.counselor || '—'}
                                  </td>
                                  <td className="p-3">
                                    {j.final_status ? (
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                        j.final_status === 'enrolled' ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {j.final_status}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 uppercase">
                                        In Progress
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 pr-4 font-bold text-[#059669] font-data-mono">
                                    {j.closure_revenue ? `₹${j.closure_revenue.toLocaleString()}` : '—'}
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
              )}
            </div>
          )}

          {/* FORWARDED LEADS PANEL */}
          {activeTab === 'forwarded' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#CBD5E1] p-5 rounded shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4 mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#D97706] text-xl">shortcut</span>
                      Escalated / Forwarded Leads Essentials
                    </h2>
                    <p className="text-[11px] text-[#70787C] mt-1 font-body-sm">
                      Review and resolve client files escalated by counselors for manager intervention.
                    </p>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Search candidate, counselor, or remark..."
                      value={forwardedSearchQuery}
                      onChange={(e) => setForwardedSearchQuery(e.target.value)}
                      className="text-xs p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                    />
                  </div>
                </div>

                {forwardedLoading ? (
                  <div className="p-10 text-center">
                    <span className="material-symbols-outlined animate-spin text-3xl text-slate-400">sync</span>
                    <p className="text-xs text-slate-500 font-semibold mt-2">Loading escalated cases...</p>
                  </div>
                ) : (() => {
                  const q = forwardedSearchQuery.toLowerCase().trim();
                  const filtered = forwardedLeads.filter(lead => {
                    if (!q) return true;
                    return (
                      (lead.name || '').toLowerCase().includes(q) ||
                      (lead.counselor_name || '').toLowerCase().includes(q) ||
                      (lead.forward_remark || '').toLowerCase().includes(q) ||
                      (lead.course_interest || '').toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-10 text-center text-xs text-slate-500 italic">
                        No forwarded leads match the query.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto min-w-0">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <tr className="text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                            <th className="p-3 pl-4">Candidate</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3">Escalated By</th>
                            <th className="p-3">Stage</th>
                            <th className="p-3">Disposition</th>
                            <th className="p-3">Escalation Remark</th>
                            <th className="p-3">Date Escalated</th>
                            <th className="p-3 pr-4 text-center">Manager Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                          {filtered.map((lead) => (
                            <tr key={lead.id} className="hover:bg-slate-50/70 transition">
                              <td className="p-3 pl-4">
                                <div className="font-semibold text-[#1BACE4]">{lead.name}</div>
                                <div className="text-[10px] text-slate-500">{lead.city || 'No City'}, {lead.state || 'No State'}</div>
                              </td>
                              <td className="p-3 text-slate-600 font-data-mono">
                                <MaskedPhone phone={lead.phone} />
                              </td>
                              <td className="p-3 font-semibold text-slate-700">{lead.counselor_name}</td>
                              <td className="p-3">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E6F8FE] text-[#1BACE4] border border-[#1BACE4]/20">
                                  {lead.stage}
                                </span>
                              </td>
                              <td className="p-3 font-semibold">{lead.disposition || 'None'}</td>
                              <td className="p-3 max-w-[250px] truncate text-slate-600 font-normal italic" title={lead.forward_remark}>
                                {lead.forward_remark || 'No remark'}
                              </td>
                              <td className="p-3 text-[10px] text-slate-500 font-data-mono">
                                {lead.forwarded_at
                                  ? new Date(lead.forwarded_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                  : '—'}
                              </td>
                              <td className="p-3 pr-4 text-center">
                                <button
                                  onClick={() => {
                                    setResolveModalLead(lead);
                                    setResolveAction('send_back');
                                    setResolveRemark('');
                                    setResolveTargetCounselor('');
                                  }}
                                  className="px-2.5 py-1 bg-[#D97706] hover:bg-[#B45309] text-white text-[11px] font-bold rounded-lg transition"
                                >
                                  Resolve Case
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
        </main>
      </div>

      {/* RESOLUTION MODAL */}

      {selectedRequest && resolutionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md bg-white border border-[#CBD5E1] p-6 rounded shadow-lg animate-in fade-in zoom-in-95 duration-150 text-[#111C2D]">
            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <h3 className="text-sm font-bold text-[#111C2D] font-headline-md">
                Reassignment Decision: {resolutionType === 'approved' ? 'Approval' : 'Rejection'}
              </h3>
              
              <p className="text-xs text-[#40484B] font-body-sm">
                Requested for lead <strong>{selectedRequest.lead_name}</strong> by <strong>{selectedRequest.requester_name}</strong>
              </p>

              {resolutionType === 'approved' && (
                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Target Counselor Assignment</label>
                  <select
                    required
                    value={resolveTargetCouns}
                    onChange={(e) => setResolveTargetCouns(e.target.value)}
                    className="w-full text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded"
                  >
                    <option value="">-- Select Target Counselor --</option>
                    {counselors.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Active Load: {c.load})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Decision Comment / Remarks</label>
                <textarea
                  required
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Enter notes justifying the transfer decision..."
                  className="w-full text-xs p-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded h-20"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => { setSelectedRequest(null); setResolutionType(''); }}
                  className="py-1.5 px-3 border border-[#E2E8F0] text-xs font-semibold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`py-1.5 px-4 text-white text-xs font-semibold rounded ${
                    resolutionType === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-[#BA1A1A] hover:bg-[#93000A]'
                  }`}
                >
                  Confirm Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONVERSION LEADS MODAL */}
      {conversionLeadsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-5xl bg-white border border-[#CBD5E1] p-6 rounded shadow-xl animate-in fade-in zoom-in-95 duration-150 text-[#111C2D] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-3 mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md uppercase tracking-wider flex items-center gap-2">
                  <span className={`material-symbols-outlined ${conversionLeadsModal.status === 'enrolled' ? 'text-green-600' : 'text-red-500'}`}>
                    {conversionLeadsModal.status === 'enrolled' ? 'check_circle' : 'cancel'}
                  </span>
                  {conversionLeadsModal.status === 'enrolled' ? 'Enrolled Candidates' : 'Dropped / Lost Candidates'}
                </h3>
                <p className="text-[11px] text-[#70787C] font-body-sm mt-0.5">
                  From batch: <strong>{conversionLeadsModal.file_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConversionLeadsModal(null)}
                className="p-1 text-[#70787C] hover:text-[#111C2D] rounded hover:bg-[#E2E8F0] flex items-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {conversionLeadsLoading ? (
              <div className="flex-grow flex items-center justify-center p-8 gap-2 text-[#70787C] text-xs">
                <span className="material-symbols-outlined animate-spin">sync</span>
                Loading details...
              </div>
            ) : conversionLeadsModal.leads.length === 0 ? (
              <div className="flex-grow p-8 text-center text-xs text-[#70787C] italic">
                No candidates found in this status.
              </div>
            ) : (
              <div className="flex-grow overflow-y-auto border border-[#E2E8F0] rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps sticky top-0">
                      <th className="p-3">Candidate</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Location</th>
                      <th className="p-3">Experience</th>
                      <th className="p-3">Course / University</th>
                      <th className="p-3">Counselor</th>
                      {conversionLeadsModal.status === 'enrolled' && <th className="p-3 text-right">Revenue</th>}
                      <th className="p-3">Closure Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-xs font-body-sm text-[#111C2D]">
                    {conversionLeadsModal.leads.map(lead => (
                      <tr key={lead.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-semibold">{lead.name}</td>
                        <td className="p-3 font-data-mono"><MaskedPhone phone={lead.phone} /></td>
                        <td className="p-3 font-data-mono text-[10px] text-slate-650"><MaskedEmail email={lead.email} /></td>
                        <td className="p-3">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : (lead.city || lead.state || '—')}</td>
                        <td className="p-3 font-data-mono">{lead.experience} Yrs</td>
                        <td className="p-3">
                          <div>{lead.course_interest || '—'}</div>
                          {lead.university_name && (
                            <span className="text-[10px] bg-blue-50 border border-blue-100 text-[#0F4C5C] px-1 py-0.5 rounded font-semibold mt-0.5 inline-block">
                              {lead.university_name}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-700">{lead.counselor_name || 'Unassigned'}</span>
                        </td>
                        {conversionLeadsModal.status === 'enrolled' && (
                          <td className="p-3 text-right font-bold font-data-mono text-green-600">
                            ₹{Number(lead.revenue || 0).toLocaleString('en-IN')}
                          </td>
                        )}
                        <td className="p-3 text-[10px] text-[#70787C] font-data-mono">
                          {lead.closed_at ? new Date(lead.closed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => setConversionLeadsModal(null)}
                className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGN LEADS MODAL */}
      {campaignLeadsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-5xl bg-white border border-[#CBD5E1] p-6 rounded shadow-xl animate-in fade-in zoom-in-95 duration-150 text-[#111C2D] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-3 mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0F4C5C]">
                    campaign
                  </span>
                  Campaign Counselor Leads List
                </h3>
                <p className="text-[11px] text-[#70787C] font-body-sm mt-0.5">
                  Campaign: <strong>{campaignLeadsModal.batch_name}</strong> &nbsp;·&nbsp;
                  Counselor: <strong>{campaignLeadsModal.counselor_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCampaignLeadsModal(null)}
                className="p-1 text-[#70787C] hover:text-[#111C2D] rounded hover:bg-[#E2E8F0] flex items-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Filter Search Bar for Leads inside this Campaign */}
            <div className="mb-4 flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] px-3 py-1.5 rounded-lg w-72">
                <span className="material-symbols-outlined text-slate-500 text-sm">search</span>
                <input
                  type="text"
                  placeholder="Filter candidate details..."
                  value={campaignLeadsSearch}
                  onChange={(e) => setCampaignLeadsSearch(e.target.value)}
                  className="text-xs bg-[#F8FAFC] focus:outline-none w-full font-body-sm"
                />
                {campaignLeadsSearch && (
                  <button onClick={() => setCampaignLeadsSearch('')} className="text-slate-400 hover:text-red-500 flex items-center">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-450 font-semibold uppercase tracking-wider font-label-caps">
                (Type name, phone, city, or university to filter results)
              </span>
            </div>

            {campaignLeadsLoading ? (
              <div className="flex-grow flex items-center justify-center p-8 gap-2 text-[#70787C] text-xs">
                <span className="material-symbols-outlined animate-spin">sync</span>
                Loading campaign details...
              </div>
            ) : (
              (() => {
                const searchStr = campaignLeadsSearch.toLowerCase();
                const filtered = campaignLeadsModal.leads.filter(lead => {
                  if (!searchStr) return true;
                  return (
                    (lead.name || '').toLowerCase().includes(searchStr) ||
                    (lead.phone || '').includes(searchStr) ||
                    (lead.email || '').toLowerCase().includes(searchStr) ||
                    (lead.city || '').toLowerCase().includes(searchStr) ||
                    (lead.state || '').toLowerCase().includes(searchStr) ||
                    (lead.course_interest || '').toLowerCase().includes(searchStr) ||
                    (lead.university_name || '').toLowerCase().includes(searchStr)
                  );
                });

                return filtered.length === 0 ? (
                  <div className="flex-grow p-8 text-center text-xs text-[#70787C] italic">
                    {campaignLeadsModal.leads.length === 0 ? 'No candidates assigned in this campaign.' : 'No candidates match the filter.'}
                  </div>
                ) : (
                  <div className="flex-grow overflow-y-auto border border-[#E2E8F0] rounded">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps sticky top-0">
                          <th className="p-3">Candidate</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Location</th>
                          <th className="p-3">Experience</th>
                          <th className="p-3">Course / University</th>
                          <th className="p-3 text-center">Stage</th>
                          <th className="p-3 text-center">Disposition</th>
                          <th className="p-3">Last Activity Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs font-body-sm text-[#111C2D]">
                        {filtered.map(lead => (
                          <tr key={lead.id} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-semibold">{lead.name}</td>
                            <td className="p-3 font-data-mono"><MaskedPhone phone={lead.phone} /></td>
                            <td className="p-3 font-data-mono text-[10px] text-slate-650"><MaskedEmail email={lead.email} /></td>
                            <td className="p-3">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : (lead.city || lead.state || '—')}</td>
                            <td className="p-3 font-data-mono">{lead.experience} Yrs</td>
                            <td className="p-3">
                              <div>{lead.course_interest || '—'}</div>
                              {lead.university_name && (
                                <span className="text-[10px] bg-blue-50 border border-blue-100 text-[#0F4C5C] px-1 py-0.5 rounded font-semibold mt-0.5 inline-block">
                                  {lead.university_name}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                lead.stage === 'L1' ? 'bg-slate-100 text-slate-700' :
                                lead.stage === 'L2' ? 'bg-amber-100 text-amber-700 font-medium' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {lead.stage}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {lead.disposition && lead.disposition !== 'None' ? (
                                <span className="text-[10px] font-bold text-[#0F4C5C] bg-[#EFF9FF] px-2 py-0.5 rounded-full">
                                  {lead.disposition}
                                </span>
                              ) : <span className="text-slate-400 italic text-[10px]">None</span>}
                            </td>
                            <td className="p-3 text-[10px] text-[#70787C] font-data-mono">
                              {lead.assigned_updated_at ? new Date(lead.assigned_updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
            
            <div className="flex justify-end gap-3 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => setCampaignLeadsModal(null)}
                className="py-1.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESCALATION RESOLUTION MODAL */}
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
                <div><span className="font-bold text-slate-700">Escalation Reason:</span> <span className="italic text-slate-650">"{resolveModalLead.forward_remark || 'None'}"</span></div>
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
            <span className="text-[10px] text-slate-300 font-bold font-data-mono tracking-wider">MANAGER MILESTONE 🚀</span>
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
