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
 *   Counselor Workspace Portal. Handles multi-stage lead qualifications,
 *   sub-stage pipeline filters, daily trackers, and enrolled admissions.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';

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

const getLeadNameColor = (stage, disposition) => {
  if (disposition === 'Interested') return '#10B981'; // Emerald Green
  if (disposition === 'Not Interested') return '#EF4444'; // Red
  if (disposition === 'Not Picked Up') return '#F59E0B'; // Amber
  if (disposition === 'Switched Off') return '#64748B'; // Slate
  if (stage === 'L1') return '#1BACE4'; // SkillLabs Blue
  if (stage === 'L2') return '#8B5CF6'; // Purple
  if (stage === 'L3') return '#059669'; // Darker Emerald for L3
  return '#111C2D';
};

export default function CounselorDashboard({ token, user, onLogout }) {
  const [leads, setLeads] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // all, followups, performance
  const [selectedLead, setSelectedLead] = useState(null);
  const [actionType, setActionType] = useState(null); // l1_qualify, l2_advance, l3_closure, log_call, drop, transfer
  const [universities, setUniversities] = useState([]);
  const [performance, setPerformance] = useState(null);

  // General Form states
  const [remark, setRemark] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // L1 Triage states
  const [isWorkingPref, setIsWorkingPref] = useState(false);
  const [budget, setBudget] = useState('');
  const [isEligible, setIsEligible] = useState(true);

  // L2 Call Log states
  const [universityDiscussed, setUniversityDiscussed] = useState('');
  const [courseDiscussed, setCourseDiscussed] = useState('');
  const [feeDiscussed, setFeeDiscussed] = useState('');

  // L3 Closure states
  const [selectedUni, setSelectedUni] = useState('');
  const [appStatus, setAppStatus] = useState('Submitted');
  const [docDegree, setDocDegree] = useState(false);
  const [docTranscripts, setDocTranscripts] = useState(false);
  const [docIdProof, setDocIdProof] = useState(false);
  const [docWorkExp, setDocWorkExp] = useState(false);
  const [revenue, setRevenue] = useState('');

  // L1 Restructure states
  const [l1InterestStatus, setL1InterestStatus] = useState('Interested'); // Interested, Not Interested
  const [l1Confirmed, setL1Confirmed] = useState(false);

  // L3 Restructure states
  const [regNumber, setRegNumber] = useState('');
  const [feesPaid, setFeesPaid] = useState(false);
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [feeReceiptConfirmed, setFeeReceiptConfirmed] = useState(false);

  // Drop states
  const [crossReason, setCrossReason] = useState('Not interested');

  // Transfer states
  const [transferType, setTransferType] = useState('give_up');
  const [transferReason, setTransferReason] = useState('Language barrier');

  // Call Quality Filter State
  const [filterDisposition, setFilterDisposition] = useState('All');

  // Search & Filter header states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('All');
  const [filterCourse, setFilterCourse] = useState('All');
  const [filterSource, setFilterSource] = useState('All');

  // Stage Level tab filter state
  const [stageTab, setStageTab] = useState('All'); // All, L1, L2, L3

  // History Dates & Details State
  const [historyDates, setHistoryDates] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null); // { summary, leads }
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  // Daily Tracking States
  const [trackingDate, setTrackingDate] = useState(new Date().toISOString().slice(0, 10));
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingCategory, setTrackingCategory] = useState('all');
  const [trackingSearch, setTrackingSearch] = useState('');

  // Dropped Leads States
  const [droppedLeads, setDroppedLeads] = useState([]);
  const [droppedLoading, setDroppedLoading] = useState(false);

  // Enrolled Leads States
  const [enrolledLeads, setEnrolledLeads] = useState([]);
  const [enrolledLoading, setEnrolledLoading] = useState(false);

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

  useEffect(() => {
    if (activeTab === 'performance') {
      fetchPerformance();
    } else if (activeTab === 'history') {
      fetchHistoryDates();
    } else if (activeTab === 'tracking') {
      fetchDailyTracking(trackingDate);
    } else if (activeTab === 'dropped') {
      fetchDroppedLeads();
    } else if (activeTab === 'enrolled') {
      fetchEnrolledLeads();
    } else {
      fetchLeads();
    }
    fetchUniversities();
  }, [activeTab]);

  const handleDispositionChange = async (leadId, val) => {
    try {
      const response = await fetch(`/api/counselor/leads/${leadId}/disposition`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ disposition: val })
      });

      if (response.ok) {
        fetchLeads();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update quality status');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeads = async () => {
    try {
      const isDue = activeTab === 'followups' ? 'true' : 'false';
      const response = await fetch(`/api/counselor/leads?is_due_followup=${isDue}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setLeads(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDroppedLeads = async () => {
    setDroppedLoading(true);
    try {
      const response = await fetch('/api/counselor/leads/dropped', {
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

  const fetchEnrolledLeads = async () => {
    setEnrolledLoading(true);
    try {
      const response = await fetch('/api/counselor/leads/enrolled', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setEnrolledLeads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEnrolledLoading(false);
    }
  };

  const fetchPerformance = async () => {
    try {
      const response = await fetch('/api/counselor/performance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setPerformance(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistoryDates = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/counselor/history/dates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setHistoryDates(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchHistoryDetail = async (date) => {
    setSelectedHistoryDate(date);
    setHistoryDetailLoading(true);
    try {
      const response = await fetch(`/api/counselor/history/dates/${date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setHistoryDetail(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryDetailLoading(false);
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTrackingLoading(false);
    }
  };

  const fetchUniversities = async () => {
    try {
      const response = await fetch('/api/universities', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setUniversities(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionOpen = (lead, type) => {
    setSelectedLead(lead);
    setActionType(type);

    // Reset Form fields
    setRemark('');
    setFollowUpDate('');

    setIsWorkingPref(false);
    setBudget('');
    setIsEligible(true);

    setUniversityDiscussed('');
    setCourseDiscussed('');
    setFeeDiscussed('');

    setSelectedUni('');
    setAppStatus('Submitted');
    setDocDegree(false);
    setDocTranscripts(false);
    setDocIdProof(false);
    setDocWorkExp(false);
    setRevenue('');

    setL1InterestStatus('Interested');
    setL1Confirmed(false);
    setRegNumber('');
    setFeesPaid(false);
    setPaymentMode('UPI');
    setFeeReceiptConfirmed(false);

    setCrossReason('Not interested');
    setTransferType('give_up');
    setTransferReason('Language barrier');
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;

    let url = `/api/counselor/leads/${selectedLead.id}/action`;
    let payload = {};

    if (actionType === 'l1_qualify') {
      if (l1InterestStatus === 'Not Interested') {
        payload = {
          outcome: 'cross',
          reason: crossReason,
          remark
        };
      } else {
        if (!l1Confirmed) {
          alert('Please confirm that this candidate is interested.');
          return;
        }
        payload = {
          outcome: 'tick',
          remark,
          followUpDate
        };
      }
    } else if (actionType === 'l2_advance') {
      if (!selectedUni) {
        alert('Please select a university');
        return;
      }
      payload = {
        outcome: 'tick',
        remark,
        universityId: selectedUni,
        courseDiscussed: courseDiscussed,
        budget: parseFloat(budget || 0),
        isWorkingPref,
        isEligible
      };
    } else if (actionType === 'l3_registration') {
      payload = {
        outcome: 'tick',
        remark: remark || 'Entered candidate registration number',
        universityId: selectedUni || selectedLead.university_id,
        docChecklist: {
          registrationNumber: regNumber,
          degree: docDegree,
          transcripts: docTranscripts,
          idProof: docIdProof,
          workExp: docWorkExp,
          documentsSubmitted: false,
          feesPaid: false,
          paymentMode: 'UPI',
          feeReceiptConfirmed: false,
          feesConfirmed: false
        },
        applicationStatus: appStatus
      };
    } else if (actionType === 'l3_documents') {
      payload = {
        outcome: 'tick',
        remark: remark || 'Verified and submitted candidate verification documents',
        universityId: selectedUni || selectedLead.university_id,
        docChecklist: {
          registrationNumber: regNumber,
          degree: docDegree,
          transcripts: docTranscripts,
          idProof: docIdProof,
          workExp: docWorkExp,
          documentsSubmitted: true,
          feesPaid: false,
          paymentMode: 'UPI',
          feeReceiptConfirmed: false,
          feesConfirmed: false
        },
        applicationStatus: appStatus
      };
    } else if (actionType === 'l3_closure') {
      if (!selectedUni && !selectedLead.university_id) {
        alert('Please select a university');
        return;
      }
      if (!feesPaid) {
        alert('Please confirm that the fees have been paid to enroll.');
        return;
      }
      if (!feeReceiptConfirmed) {
        alert('Please confirm that the admissions fee receipt has been generated.');
        return;
      }
      payload = {
        outcome: 'tick',
        remark: remark || 'Admission fully closed & candidate enrolled',
        universityId: selectedUni || selectedLead.university_id,
        revenue: parseFloat(revenue || 0),
        docChecklist: {
          registrationNumber: regNumber,
          degree: docDegree,
          transcripts: docTranscripts,
          idProof: docIdProof,
          workExp: docWorkExp,
          documentsSubmitted: true,
          feesPaid: feesPaid,
          paymentMode: paymentMode,
          feeReceiptConfirmed: feeReceiptConfirmed,
          feesConfirmed: true
        },
        applicationStatus: appStatus
      };
    } else if (actionType === 'log_call') {
      url = `/api/counselor/leads/${selectedLead.id}/follow-up`;
      payload = {
        followUpDate: followUpDate || null,
        notes: remark,
        university_id: universityDiscussed || null,
        courseDiscussed,
        feeDiscussed
      };
    } else if (actionType === 'drop') {
      payload = {
        outcome: 'cross',
        reason: crossReason,
        remark
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const completedAction = actionType;
        setSelectedLead(null);
        setActionType(null);
        fetchLeads();
        // Trigger gamification animations on success
        if (completedAction === 'l1_qualify') {
          triggerCelebration('Lead Qualified! ⚡ L2 Active');
        } else if (completedAction === 'l2_advance') {
          triggerCelebration('Lead Advanced! 🚀 Moved to L3 Registrations');
        } else if (completedAction === 'l3_registration') {
          triggerCelebration('Lead Registered! 📝 Moved to L3 Documents');
        } else if (completedAction === 'l3_documents') {
          triggerCelebration('Documents Verified! 📂 Moved to L3 Fees');
        } else if (completedAction === 'l3_closure') {
          triggerCelebration('Deal Closed! 🏆 Enrolled!');
        } else if (completedAction === 'drop') {
          triggerCelebration('Lead Processed! 💼 Pipeline Updated');
        } else {
          triggerCelebration('Update Successful! 👍');
        }
      } else {
        const err = await response.json();
        alert(err.error || 'Action failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      const response = await fetch('/api/transfers/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leadId: selectedLead.id,
          requestType: transferType,
          reason: transferReason,
          note: remark
        })
      });

      if (response.ok) {
        alert('Transfer request submitted successfully.');
        setSelectedLead(null);
        setActionType(null);
        fetchLeads();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to request transfer');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleForwardSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;

    try {
      const response = await fetch(`/api/counselor/leads/${selectedLead.id}/forward`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          remark: remark
        })
      });

      if (response.ok) {
        alert('Lead forwarded to manager successfully.');
        setSelectedLead(null);
        setActionType(null);
        fetchLeads();
        triggerCelebration('Lead Escalated to Manager! 🚀');
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to forward lead');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const parseDocStatus = (status) => {
    if (!status) return {};
    if (typeof status === 'string') {
      try {
        return JSON.parse(status);
      } catch (e) {
        return {};
      }
    }
    return status;
  };

  const getLeadSubStage = (l) => {
    if (l.stage === 'L1') return 'L1';
    if (l.stage === 'L2') {
      return (l.disposition || 'None') === 'Interested' ? 'L2_Punch' : 'L2_Followups';
    }
    if (l.stage === 'L3') {
      const docStatus = parseDocStatus(l.documents_status);
      if (!docStatus.registrationNumber) return 'L3_Registrations';
      if (!docStatus.documentsSubmitted) return 'L3_Documents';
      return 'L3_Fees';
    }
    return '';
  };

  const countByStage = (subStage) => {
    if (subStage === 'L1') return leads.filter(l => l.stage === 'L1').length;
    if (subStage === 'L2') return leads.filter(l => l.stage === 'L2').length;
    if (subStage === 'L3') return leads.filter(l => l.stage === 'L3').length;
    return leads.filter(l => getLeadSubStage(l) === subStage).length;
  };

  const handleSecurityBlock = (e) => {
    e.preventDefault();
  };

  // Get unique options dynamically from current leads list
  const uniqueDates = Array.from(new Set(leads.map(l => l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : ''))).filter(Boolean).sort((a, b) => b.localeCompare(a));
  const uniqueCourses = Array.from(new Set(leads.map(l => l.course_interest))).filter(Boolean).sort();
  const uniqueSources = Array.from(new Set(leads.map(l => l.source))).filter(Boolean).sort();

  const filteredLeads = leads.filter(l => {
    // 1. Stage Level filter
    if (stageTab !== 'All') {
      const subStage = getLeadSubStage(l);
      if (stageTab === 'L1' && l.stage !== 'L1') return false;
      if (stageTab === 'L2' && l.stage !== 'L2') return false;
      if (stageTab === 'L3' && l.stage !== 'L3') return false;
      if (stageTab !== 'L1' && stageTab !== 'L2' && stageTab !== 'L3' && subStage !== stageTab) return false;
    }
    
    // 2. Disposition / Quality filter
    if (filterDisposition !== 'All' && (l.disposition || 'None') !== filterDisposition) return false;

    // 3. Upload Date filter
    if (filterDate !== 'All') {
      const uDate = l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : 'Unknown';
      if (uDate !== filterDate) return false;
    }

    // 4. Course Interest filter
    if (filterCourse !== 'All' && l.course_interest !== filterCourse) return false;

    // 5. Source filter
    if (filterSource !== 'All' && l.source !== filterSource) return false;

    // 6. Search Query (Name, Phone, Email, City, State, Course Interest, Source, Date)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const uDateStr = l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : '';
      const match =
        (l.name || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.city || '').toLowerCase().includes(q) ||
        (l.state || '').toLowerCase().includes(q) ||
        (l.course_interest || '').toLowerCase().includes(q) ||
        (l.source || '').toLowerCase().includes(q) ||
        uDateStr.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div
      className="min-h-screen bg-[#F9F9FF] flex text-[#111C2D] overflow-hidden"
      onContextMenu={handleSecurityBlock}
      onCopy={handleSecurityBlock}
      onCut={handleSecurityBlock}
      onPaste={handleSecurityBlock}
      style={{ userSelect: 'none' }}
    >
      {/* Sidebar Layout */}
      <aside className="w-[240px] text-white flex flex-col justify-between shrink-0 animate-slide-in-left" style={{ background: '#0C2340' }}>
        <div>
          <div className="p-4 border-b flex flex-col items-start gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <SkillLabsLogo className="h-8 w-auto" />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Counselor Workspace</span>
          </div>

          <nav className="mt-6 space-y-1 px-4">
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'all', e)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'all' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'all' ? { background: '#1BACE4' } : {}}
            >
               <span className="material-symbols-outlined text-lg">view_list</span>
               <span>My Assigned Data</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'followups', e)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'followups' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'followups' ? { background: '#1BACE4' } : {}}
            >
               <span className="material-symbols-outlined text-lg">alarm</span>
               <span>Follow-ups Due</span>
            </button>
             <button
              onClick={(e) => handleTabClick(setActiveTab, 'performance', e)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'performance' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'performance' ? { background: '#1BACE4' } : {}}
            >
               <span className="material-symbols-outlined text-lg">equalizer</span>
               <span>My Performance</span>
            </button>
            <button
              onClick={(e) => {
                handleTabClick(setActiveTab, 'tracking', e);
                fetchDailyTracking(trackingDate);
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'tracking' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'tracking' ? { background: '#059669' } : {}}
            >
               <span className="material-symbols-outlined text-lg">calendar_month</span>
               <span>Daily Activity Tracker</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'history', e)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'history' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'history' ? { background: '#F7941D' } : {}}
            >
               <span className="material-symbols-outlined text-lg">history</span>
               <span>Work History by Date</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'enrolled', e)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'enrolled' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'enrolled' ? { background: '#10B981' } : {}}
            >
               <span className="material-symbols-outlined text-lg">check_circle</span>
               <span>Enrolled Admissions</span>
            </button>
            <button
              onClick={(e) => handleTabClick(setActiveTab, 'dropped', e)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'dropped' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
              style={activeTab === 'dropped' ? { background: '#EF4444' } : {}}
            >
               <span className="material-symbols-outlined text-lg">block</span>
               <span>Dropped Leads</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Profile Card */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.25)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs uppercase"
              style={{ background: '#1BACE4' }}>
              {user.name.substring(0, 2)}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold leading-none">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-data-mono truncate mt-1">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full mt-4 flex items-center justify-center gap-1.5 py-1.5 bg-[#BA1A1A] hover:bg-[#93000A] text-white text-xs font-semibold rounded transition duration-150"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Panels */}
      <div className="flex-grow flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-[56px] border-b border-[#CBD5E1] bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#505F76] font-label-caps">Counselor Portal</span>
            <span className="text-[#CBD5E1] text-xs">/</span>
            <span className="text-xs font-semibold text-[#111C2D] font-body-sm capitalize">{activeTab} Workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded-full animate-pulse">SECURE GATEWAY</span>
          </div>
        </header>

        {/* Dynamic Inner Screens */}
        <main className="flex-grow p-6 overflow-y-auto space-y-6 animate-fade-in" key={activeTab}>
          {(activeTab === 'all' || activeTab === 'followups') && (
            <>
              {/* Stage Counter Indicators */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border border-[#CBD5E1] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <p className="text-[10px] text-[#505F76] font-label-caps uppercase font-bold">L1 Qualification</p>
                  <p className="text-xl font-bold font-data-mono mt-1" style={{ color: '#1BACE4' }}>{countByStage('L1')} Data</p>
                </div>
                <div className="bg-white border border-[#CBD5E1] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <p className="text-[10px] text-[#505F76] font-label-caps uppercase font-bold">L2 Counseling</p>
                  <p className="text-xl font-bold font-data-mono mt-1" style={{ color: '#1BACE4' }}>{countByStage('L2')} Data</p>
                </div>
                <div className="bg-white border border-[#CBD5E1] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <p className="text-[10px] text-[#505F76] font-label-caps uppercase font-bold">L3 Final Closures</p>
                  <p className="text-xl font-bold font-data-mono text-green-600 mt-1">{countByStage('L3')} Data</p>
                </div>
                <div className="bg-teal-50 border border-teal-200 p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <p className="text-[10px] text-teal-800 font-label-caps uppercase font-bold">Workspace View</p>
                  <p className="text-xl font-bold font-data-mono text-teal-950 mt-1">
                    {activeTab === 'followups' ? 'Scheduled Due' : 'All Assigned'}
                  </p>
                </div>
              </div>

              {/* LEVEL SEPARATION SUB-TABS */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-xl w-full">
                <button
                  onClick={(e) => handleTabClick(setStageTab, 'All', e)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95 ${
                    stageTab === 'All'
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Assigned ({leads.length})
                </button>
                <div className="h-4 w-px bg-slate-300 mx-1"></div>
                <button
                  onClick={(e) => handleTabClick(setStageTab, 'L1', e)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95 ${
                    stageTab === 'L1'
                      ? 'bg-white text-[#1BACE4] shadow-sm border border-[#1BACE4]/20'
                      : 'text-slate-500 hover:text-[#1BACE4]'
                  }`}
                >
                  Level 1 (Qualification) ({countByStage('L1')})
                </button>
                <div className="h-4 w-px bg-slate-300 mx-1"></div>
                
                {/* L2 Stage & Sections */}
                <div className="flex items-center gap-1 bg-purple-50 border border-purple-100 p-0.5 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-purple-750 px-1 font-label-caps">L2:</span>
                  <button
                    onClick={(e) => handleTabClick(setStageTab, 'L2_Followups', e)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all ${
                      stageTab === 'L2_Followups'
                        ? 'bg-white text-purple-700 shadow-sm border border-purple-200 font-bold'
                        : 'text-slate-500 hover:text-purple-650'
                    }`}
                  >
                    Followups ({countByStage('L2_Followups')})
                  </button>
                  <button
                    onClick={(e) => handleTabClick(setStageTab, 'L2_Punch', e)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all ${
                      stageTab === 'L2_Punch'
                        ? 'bg-white text-purple-750 shadow-sm border border-purple-200 font-bold'
                        : 'text-slate-500 hover:text-purple-700'
                    }`}
                  >
                    Lead Punch ({countByStage('L2_Punch')})
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-300 mx-1"></div>

                {/* L3 Stage & Sections */}
                <div className="flex items-center gap-1 bg-green-50 border border-green-100 p-0.5 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-green-750 px-1 font-label-caps">L3:</span>
                  <button
                    onClick={(e) => handleTabClick(setStageTab, 'L3_Registrations', e)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all ${
                      stageTab === 'L3_Registrations'
                        ? 'bg-white text-green-700 shadow-sm border border-green-200 font-bold'
                        : 'text-slate-500 hover:text-green-650'
                    }`}
                  >
                    Registrations ({countByStage('L3_Registrations')})
                  </button>
                  <button
                    onClick={(e) => handleTabClick(setStageTab, 'L3_Documents', e)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all ${
                      stageTab === 'L3_Documents'
                        ? 'bg-white text-green-750 shadow-sm border border-green-200 font-bold'
                        : 'text-slate-500 hover:text-green-700'
                    }`}
                  >
                    Documents ({countByStage('L3_Documents')})
                  </button>
                  <button
                    onClick={(e) => handleTabClick(setStageTab, 'L3_Fees', e)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-all ${
                      stageTab === 'L3_Fees'
                        ? 'bg-white text-green-800 shadow-sm border border-green-300 font-bold'
                        : 'text-slate-500 hover:text-green-850'
                    }`}
                  >
                    Fees ({countByStage('L3_Fees')})
                  </button>
                </div>
              </div>

              {/* Working Pipeline Table */}
              <div className="bg-white border border-[#CBD5E1] rounded shadow-sm overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-[#CBD5E1] bg-[#F9F9FF] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">
                      My Working Pipeline List ({filteredLeads.length} Data)
                    </span>
                    {(searchQuery || filterDate !== 'All' || filterCourse !== 'All' || filterSource !== 'All' || filterDisposition !== 'All') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterDate('All');
                          setFilterCourse('All');
                          setFilterSource('All');
                          setFilterDisposition('All');
                        }}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-xs font-bold">close</span>
                        Clear Filters
                      </button>
                    )}
                  </div>
                  
                  {/* Dynamic Filter Header Panel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    {/* Search Input */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Search Lead</span>
                      <input
                        type="text"
                        placeholder="Search name, phone, email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs p-1.5 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:ring-1 focus:ring-primary font-semibold text-slate-700"
                      />
                    </div>

                    {/* Date Uploaded filter */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Upload Date</span>
                      <select
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="text-xs p-1.5 bg-white border border-[#CBD5E1] rounded font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="All">All Dates</option>
                        {uniqueDates.map(d => (
                          <option key={d} value={d}>
                            {new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Course Filter */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Course Interest</span>
                      <select
                        value={filterCourse}
                        onChange={(e) => setFilterCourse(e.target.value)}
                        className="text-xs p-1.5 bg-white border border-[#CBD5E1] rounded font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="All">All Courses</option>
                        {uniqueCourses.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Source Filter */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Lead Source</span>
                      <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="text-xs p-1.5 bg-white border border-[#CBD5E1] rounded font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="All">All Sources</option>
                        {uniqueSources.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quality Filter */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Call Quality</span>
                      <select
                        value={filterDisposition}
                        onChange={(e) => setFilterDisposition(e.target.value)}
                        className="text-xs p-1.5 bg-white border border-[#CBD5E1] rounded font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="All">All Qualities</option>
                        <option value="None">None</option>
                        <option value="Interested">Interested</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Not Picked Up">Not Picked Up</option>
                        <option value="Switched Off">Switched Off</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#CBD5E1] text-[10px] font-bold text-[#505F76] uppercase tracking-wider font-label-caps">
                        <th className="px-4 py-3">Candidate</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Quality</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Exp</th>
                        <th className="px-4 py-3 font-semibold">Course</th>
                        <th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#CBD5E1] text-xs font-body-sm text-[#111C2D]">
                      {filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="p-12 text-center text-[#505F76] italic">
                            Your pipeline is clean. No data matches the selected search/filters.
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const groups = {};
                          filteredLeads.forEach(lead => {
                            const dateKey = lead.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : 'Unknown';
                            if (!groups[dateKey]) groups[dateKey] = [];
                            groups[dateKey].push(lead);
                          });

                          const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

                          return sortedDates.map(date => (
                            <React.Fragment key={date}>
                              {/* Date Group Header Row */}
                              <tr className="bg-slate-100/90 border-y border-[#CBD5E1]">
                                <td colSpan="8" className="px-4 py-2 font-extrabold text-[#0C2340] font-label-caps">
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-[#D97706]">calendar_month</span>
                                    <span>
                                      Uploaded: {date === 'Unknown' ? 'Unknown Date' : new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </span>
                                    <span className="text-[10px] bg-[#E2E8F0] text-slate-700 px-2 py-0.5 rounded-full font-bold ml-2">
                                      {groups[date].length} leads
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {groups[date].map(lead => (
                                <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                                  <td className="px-4 py-3 font-semibold">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${lead.stage === 'L1' ? 'bg-[#E6F8FE] text-[#1BACE4] border border-[#1BACE4]/20' :
                                          lead.stage === 'L2' ? 'bg-purple-50 text-purple-600 border border-purple-200' :
                                            'bg-green-50 text-green-600 border border-green-200'
                                        }`}>
                                        {lead.stage}
                                      </span>
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${lead.disposition === 'Interested' ? 'bg-green-500 animate-pulse' :
                                          lead.disposition === 'Not Interested' ? 'bg-red-500' :
                                            lead.disposition === 'Not Picked Up' ? 'bg-amber-500' :
                                              lead.disposition === 'Switched Off' ? 'bg-slate-400' :
                                                'bg-blue-400'
                                        }`} title={`Quality: ${lead.disposition || 'None'}`} />
                                      <span style={{ color: getLeadNameColor(lead.stage, lead.disposition) }}>
                                        {lead.name}
                                      </span>
                                      {lead.is_forwarded ? (
                                        <span className="ml-2 text-[9px] bg-amber-100 border border-amber-200 text-amber-800 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider font-label-caps animate-pulse">
                                          Escalated
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-data-mono">
                                    <MaskedPhone phone={lead.phone} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={lead.disposition || 'None'}
                                      onChange={(e) => handleDispositionChange(lead.id, e.target.value)}
                                      className={`text-[11px] p-1 bg-white border border-[#CBD5E1] rounded font-semibold focus:outline-none focus:ring-1 focus:ring-primary ${lead.disposition === 'Interested' ? 'text-green-700 bg-green-50/50 border-green-200' :
                                          lead.disposition === 'Not Interested' ? 'text-red-700 bg-red-50/50 border-red-200' :
                                            lead.disposition === 'Not Picked Up' ? 'text-amber-700 bg-amber-50/50 border-amber-200' :
                                              lead.disposition === 'Switched Off' ? 'text-slate-700 bg-slate-100 border-slate-300' :
                                                'text-slate-600'
                                        }`}
                                    >
                                      <option value="None">None</option>
                                      <option value="Interested">Interested</option>
                                      <option value="Not Interested">Not Interested</option>
                                      <option value="Not Picked Up">Not Picked Up</option>
                                      <option value="Switched Off">Switched Off</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-3">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : (lead.city || lead.state || '—')}</td>
                                  <td className="px-4 py-3 font-data-mono">{lead.experience} Yrs</td>
                                   <td className="px-4 py-3 font-semibold">{lead.course_interest}</td>
                                   <td className="px-4 py-3">
                                     <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${lead.stage === 'L1' ? 'bg-slate-100 text-slate-700' :
                                         lead.stage === 'L2' ? 'bg-amber-100 text-amber-700 font-medium' :
                                           'bg-green-100 text-green-700'
                                       }`}>
                                       {lead.stage}
                                     </span>
                                   </td>
                                  <td className="px-4 py-3 flex items-center justify-center gap-1.5">
                                    {lead.is_forwarded ? (
                                      <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider font-label-caps flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                                        <span>Under Review</span>
                                      </span>
                                    ) : (
                                      <>
                                        {/* Log Call notes action */}
                                        <button
                                          onClick={() => handleActionOpen(lead, 'log_call')}
                                          className="py-1 px-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-0.5 transition"
                                          title="Log call remarks"
                                        >
                                          <span className="material-symbols-outlined text-xs">notes</span>
                                        </button>

                                         {/* Stage qualification (Tick) */}
                                         <button
                                           disabled={lead.disposition !== 'Interested'}
                                           onClick={() => {
                                             if (lead.stage === 'L1') {
                                               handleActionOpen(lead, 'l1_qualify');
                                             } else if (lead.stage === 'L2') {
                                               handleActionOpen(lead, 'l2_advance');
                                             } else if (lead.stage === 'L3') {
                                               const subStage = getLeadSubStage(lead);
                                               if (subStage === 'L3_Registrations') {
                                                 handleActionOpen(lead, 'l3_registration');
                                               } else if (subStage === 'L3_Documents') {
                                                 handleActionOpen(lead, 'l3_documents');
                                               } else {
                                                 handleActionOpen(lead, 'l3_closure');
                                               }
                                             }
                                           }}
                                           className={`py-1 px-2 text-white rounded text-[11px] font-semibold flex items-center gap-0.5 transition ${
                                             lead.disposition === 'Interested'
                                               ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                                               : 'bg-green-600/40 cursor-not-allowed'
                                           }`}
                                           title={lead.disposition !== 'Interested' ? "Mark lead as 'Interested' first to qualify" : "Advance Stage"}
                                         >
                                           <span className="material-symbols-outlined text-xs font-bold">done</span>
                                           <span>Qualify</span>
                                         </button>
 
                                         {/* Reject/Drop data (Cross) */}
                                         <button
                                           disabled={lead.disposition !== 'Not Interested'}
                                           onClick={() => handleActionOpen(lead, 'drop')}
                                           className={`py-1 px-2 text-white rounded text-[11px] font-semibold flex items-center gap-0.5 transition ${
                                             lead.disposition === 'Not Interested'
                                               ? 'bg-[#BA1A1A] hover:bg-[#93000A] cursor-pointer'
                                               : 'bg-[#BA1A1A]/40 cursor-not-allowed'
                                           }`}
                                           title={lead.disposition !== 'Not Interested' ? "Mark lead as 'Not Interested' first to drop" : "Drop data"}
                                         >
                                           <span className="material-symbols-outlined text-xs font-bold">close</span>
                                           <span>Drop</span>
                                         </button>

                                        {/* Transfer request */}
                                        <button
                                          onClick={() => handleActionOpen(lead, 'transfer')}
                                          className="p-1 border border-[#CBD5E1] hover:bg-slate-100 text-[#505F76] rounded flex items-center transition"
                                          title="Reassignment"
                                        >
                                          <span className="material-symbols-outlined text-xs font-bold">swap_horiz</span>
                                        </button>

                                        {/* Forward to Manager */}
                                        <button
                                          onClick={() => handleActionOpen(lead, 'forward')}
                                          className="p-1 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded flex items-center transition"
                                          title="Forward to Manager"
                                        >
                                          <span className="material-symbols-outlined text-xs font-bold">shortcut</span>
                                        </button>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ));
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'performance' && (
            /* Counselor Personal Performance analytics */
            <div className="bg-white border border-[#CBD5E1] p-6 rounded shadow-sm max-w-2xl space-y-6">
              <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps border-b border-[#CBD5E1] pb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                <span>My Performance Statistics</span>
              </h2>

              {performance ? (
                <div className="space-y-6">
                  {/* Monthly target progress card */}
                  <div className="bg-slate-50 border border-[#CBD5E1] p-5 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase">Monthly Enrollment Goal</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Enforced targets for {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold font-data-mono text-[#1BACE4]">{performance.monthlyEnrolledCount}</span>
                        <span className="text-xs text-slate-400"> / {performance.monthlyTarget} closed</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#1BACE4] h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (performance.monthlyEnrolledCount / performance.monthlyTarget) * 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-semibold">
                      <span className="text-[#10B981]">{((performance.monthlyEnrolledCount / performance.monthlyTarget) * 100).toFixed(0)}% Completed</span>
                      <span className={performance.targetLeft > 0 ? 'text-[#F7941D]' : 'text-green-600'}>
                        {performance.targetLeft > 0 ? `${performance.targetLeft} admissions left to hit goal` : 'Monthly target achieved! 🎉'}
                      </span>
                    </div>
                  </div>

                  {/* Grid numbers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-[#CBD5E1] p-4 rounded text-center">
                      <p className="text-[10px] font-bold text-[#505F76] uppercase tracking-wide font-label-caps">Confirmed Admissions</p>
                      <p className="text-2xl font-bold font-data-mono text-green-700 mt-2">{performance.enrolledCount} Enrolled</p>
                    </div>
                    <div className="bg-slate-50 border border-[#CBD5E1] p-4 rounded text-center">
                      <p className="text-[10px] font-bold text-[#505F76] uppercase tracking-wide font-label-caps">Archived/Lost Data</p>
                      <p className="text-2xl font-bold font-data-mono text-red-700 mt-2">{performance.lostCount} Dropped</p>
                    </div>
                  </div>

                  {/* Active Pipeline load */}
                  <div className="border border-[#CBD5E1] p-4 rounded">
                    <h3 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase mb-3">Current Active Working Backlog</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="text-[11px] text-[#505F76]">L1 Stage:</span>
                        <span className="font-bold font-data-mono block text-lg text-slate-700 mt-1">{performance.activeAssignments.L1}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="text-[11px] text-[#505F76]">L2 Stage:</span>
                        <span className="font-bold font-data-mono block text-lg text-amber-700 mt-1">{performance.activeAssignments.L2}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="text-[11px] text-[#505F76]">L3 Stage:</span>
                        <span className="font-bold font-data-mono block text-lg text-green-700 mt-1">{performance.activeAssignments.L3}</span>
                      </div>
                    </div>
                  </div>

                  {/* Follow-up activity metrics */}
                  <div className="border border-[#CBD5E1] p-4 rounded flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase">Call Activity Rate</h4>
                      <p className="text-[11px] text-[#505F76] mt-1">Tracks schedules created and logged against pending backlog.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#003441]">{performance.completedFollowups} Calls Completed</p>
                      <p className="text-[11px] text-[#BA1A1A] mt-1 font-bold">{performance.pendingFollowups} Follow-ups Pending</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic">Roster details are locked to your active session. Calculations are run against database audit streams.</p>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 italic">Calculating performance indicators...</div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {!selectedHistoryDate ? (
                /* Date History Selection list */
                <div className="bg-white border border-[#CBD5E1] p-6 rounded shadow-sm">
                  <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps border-b border-[#CBD5E1] pb-3 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#F7941D]">calendar_today</span>
                    <span>Work History &amp; Assigned Roster by Date</span>
                  </h2>

                  {/* Date Range Filters */}
                  <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-6">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">From Date:</label>
                      <input
                        type="date"
                        value={historyStartDate}
                        onChange={(e) => setHistoryStartDate(e.target.value)}
                        className="text-xs p-1 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:ring-1 focus:ring-[#1BACE4]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">To Date:</label>
                      <input
                        type="date"
                        value={historyEndDate}
                        onChange={(e) => setHistoryEndDate(e.target.value)}
                        className="text-xs p-1 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:ring-1 focus:ring-[#1BACE4]"
                      />
                    </div>
                    {(historyStartDate || historyEndDate) && (
                      <button
                        onClick={() => { setHistoryStartDate(''); setHistoryEndDate(''); }}
                        className="text-[10px] font-bold bg-[#BA1A1A] hover:bg-[#93000A] text-white py-1 px-2.5 rounded transition"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>

                  {historyLoading && (
                    <div className="p-8 text-center text-slate-400 italic">Querying worked calendar dates...</div>
                  )}

                  {!historyLoading && historyDates.length === 0 && (
                    <div className="p-8 text-center text-slate-400 italic">No historical distribution data recorded.</div>
                  )}

                  {!historyLoading && historyDates.length > 0 && historyDates.filter(h => {
                    if (historyStartDate && h.date < historyStartDate) return false;
                    if (historyEndDate && h.date > historyEndDate) return false;
                    return true;
                  }).length === 0 && (
                      <div className="p-8 text-center text-slate-400 italic">No work history found within the selected date range.</div>
                    )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {historyDates.filter(h => {
                      if (historyStartDate && h.date < historyStartDate) return false;
                      if (historyEndDate && h.date > historyEndDate) return false;
                      return true;
                    }).map(h => (
                      <div
                        key={h.date}
                        onClick={() => fetchHistoryDetail(h.date)}
                        className="bg-slate-50 border border-slate-200 p-4 rounded-xl cursor-pointer hover:border-[#1BACE4] hover:shadow transition"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                          <span className="text-xs font-bold text-slate-800">
                            {new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 py-0.5 px-2 rounded-full font-bold">
                            {h.total} leads
                          </span>
                        </div>

                        <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                          <div className="bg-blue-50/50 p-1.5 rounded">
                            <span className="text-blue-600 font-bold block">{h.L1}</span>
                            <span className="text-slate-400">L1</span>
                          </div>
                          <div className="bg-purple-50/50 p-1.5 rounded">
                            <span className="text-purple-600 font-bold block">{h.L2}</span>
                            <span className="text-slate-400">L2</span>
                          </div>
                          <div className="bg-green-50/50 p-1.5 rounded border border-green-100">
                            <span className="text-green-600 font-bold block">{h.L3}</span>
                            <span className="text-slate-400">L3</span>
                          </div>
                          <div className="bg-emerald-50 p-1.5 rounded border border-emerald-100">
                            <span className="text-emerald-700 font-bold block">{h.enrolled}</span>
                            <span className="text-emerald-500 font-bold">Closed</span>
                          </div>
                          <div className="bg-rose-50 p-1.5 rounded border border-rose-100">
                            <span className="text-red-600 font-bold block">{h.lost}</span>
                            <span className="text-slate-400">Lost</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Date History Details drill down */
                <div className="space-y-4">
                  {/* Summary row */}
                  <div className="bg-white border border-[#CBD5E1] p-4 rounded shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setSelectedHistoryDate(null); setHistoryDetail(null); }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 flex items-center"
                      >
                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                      </button>
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[#111C2D]">
                          Worked Leads details on {new Date(selectedHistoryDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </h2>
                      </div>
                    </div>
                  </div>

                  {historyDetailLoading && (
                    <div className="p-12 text-center text-slate-400 italic">Querying worked records for this day...</div>
                  )}

                  {historyDetail && (
                    <>
                      {/* Metric cards */}
                      <div className="grid grid-cols-5 gap-4 text-center">
                        <div className="bg-white border border-[#CBD5E1] p-3 rounded">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Total Handled</span>
                          <span className="text-xl font-bold font-data-mono mt-1 block text-slate-800">{historyDetail.summary.total}</span>
                        </div>
                        <div className="bg-blue-50/30 border border-blue-100 p-3 rounded">
                          <span className="text-[10px] text-blue-600 font-bold block uppercase tracking-wider">Level 1</span>
                          <span className="text-xl font-bold font-data-mono mt-1 block text-blue-600">{historyDetail.summary.L1}</span>
                        </div>
                        <div className="bg-purple-50/30 border border-purple-100 p-3 rounded">
                          <span className="text-[10px] text-purple-600 font-bold block uppercase tracking-wider">Level 2</span>
                          <span className="text-xl font-bold font-data-mono mt-1 block text-purple-600">{historyDetail.summary.L2}</span>
                        </div>
                        <div className="bg-green-50/30 border border-green-100 p-3 rounded">
                          <span className="text-[10px] text-green-600 font-bold block uppercase tracking-wider">Level 3</span>
                          <span className="text-xl font-bold font-data-mono mt-1 block text-green-600">{historyDetail.summary.L3}</span>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded">
                          <span className="text-[10px] text-emerald-700 font-bold block uppercase tracking-wider">Enrolled Admissions</span>
                          <span className="text-xl font-bold font-data-mono mt-1 block text-emerald-700">{historyDetail.summary.enrolled}</span>
                        </div>
                      </div>

                      {/* Detail Leads list table */}
                      <div className="bg-white border border-[#CBD5E1] rounded shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-[#CBD5E1] text-[10px] font-bold text-[#505F76] uppercase tracking-wider font-label-caps">
                                <th className="px-4 py-3">Candidate</th>
                                <th className="px-4 py-3">Phone</th>
                                <th className="px-4 py-3">Quality Status</th>
                                <th className="px-4 py-3">Location</th>
                                <th className="px-4 py-3">Exp</th>
                                <th className="px-4 py-3">Course Interest</th>
                                <th className="px-4 py-3">Source</th>
                                <th className="px-4 py-3">Roster Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#CBD5E1] font-body-sm text-[#111C2D]">
                              {historyDetail.leads.map(lead => (
                                <tr key={lead.id} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-semibold">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${lead.disposition === 'Interested' ? 'bg-green-500 animate-pulse' :
                                          lead.disposition === 'Not Interested' ? 'bg-red-500' :
                                            lead.disposition === 'Not Picked Up' ? 'bg-amber-500' :
                                              lead.disposition === 'Switched Off' ? 'bg-slate-400' :
                                                'bg-blue-400'
                                        }`} />
                                      <span style={{ color: getLeadNameColor(lead.stage, lead.disposition) }}>
                                        {lead.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-data-mono">
                                    <MaskedPhone phone={lead.phone} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${lead.disposition === 'Interested' ? 'bg-green-50 text-green-700 border border-green-200' :
                                        lead.disposition === 'Not Interested' ? 'bg-red-50 text-red-700 border border-red-200' :
                                          lead.disposition === 'Not Picked Up' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                            lead.disposition === 'Switched Off' ? 'bg-slate-100 text-slate-700 border border-slate-300' :
                                              'bg-slate-50 text-slate-500'
                                      }`}>
                                      {lead.disposition || 'None'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : (lead.city || lead.state || '—')}</td>
                                  <td className="px-4 py-3 font-data-mono">{lead.experience} Yrs</td>
                                  <td className="px-4 py-3 font-semibold">{lead.course_interest}</td>
                                  <td className="px-4 py-3">{lead.source}</td>
                                  <td className="px-4 py-3">
                                    {lead.stage ? (
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${lead.stage === 'L1' ? 'bg-[#E6F8FE] text-[#1BACE4] border border-[#1BACE4]/20' :
                                          lead.stage === 'L2' ? 'bg-purple-50 text-purple-600 border border-purple-200' :
                                            'bg-green-50 text-green-600 border border-green-200'
                                        }`}>
                                        Active in {lead.stage}
                                      </span>
                                    ) : (
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${lead.closure_status === 'enrolled' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-red-800'
                                        }`}>
                                        Closed — {lead.closure_status || 'Lost'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
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
                      My Daily Lead Status — {trackingDate}
                    </h2>
                    <p className="text-[11px] text-[#70787C] mt-1 font-body-sm">Track your assigned leads' activity and status for any given day.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold text-[#505F76] uppercase tracking-wider font-label-caps">Select Date:</label>
                    <input
                      type="date"
                      value={trackingDate}
                      max={new Date().toISOString().slice(0,10)}
                      onChange={(e) => { setTrackingDate(e.target.value); }}
                      className="text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#059669]"
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
                  <p className="text-sm text-[#70787C]">Select a date and click <strong>Load</strong> to view your daily lead status.</p>
                </div>
              )}

              {!trackingLoading && trackingData && (
                <>
                  {/* Summary Pills */}
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { key: 'all',          label: 'All Activity',    count: trackingData.summary.total,           color: '#505F76', bg: '#F8FAFC', border: '#CBD5E1' },
                      { key: 'L1',           label: 'Level 1',         count: trackingData.summary.L1,              color: '#1BACE4', bg: '#EFF9FF', border: '#BAE6FD' },
                      { key: 'L2',           label: 'Level 2',         count: trackingData.summary.L2,              color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
                      { key: 'L3',           label: 'Level 3',         count: trackingData.summary.L3,              color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
                      { key: 'interested',   label: 'Interested',      count: trackingData.summary.interested,      color: '#10B981', bg: '#F0FDF4', border: '#86EFAC' },
                      { key: 'enrolled',     label: 'Enrolled ✓',      count: trackingData.summary.enrolled,        color: '#0F4C5C', bg: '#F0F9FF', border: '#7DD3FC' },
                      { key: 'not_interested', label: 'Not Interested',count: trackingData.summary.not_interested,  color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
                      { key: 'not_picked_up',  label: 'Not Picked Up', count: trackingData.summary.not_picked_up,  color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
                      { key: 'switched_off',   label: 'Switched Off',  count: trackingData.summary.switched_off,   color: '#64748B', bg: '#F8FAFC', border: '#CBD5E1' },
                      { key: 'dropped',      label: 'Dropped/Lost',    count: trackingData.summary.dropped,         color: '#BA1A1A', bg: '#FFF1F2', border: '#FECDD3' },
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
                          placeholder="Search name, phone, city..."
                          value={trackingSearch}
                          onChange={(e) => setTrackingSearch(e.target.value)}
                          className="text-xs p-2 bg-[#F9F9FF] border border-[#E2E8F0] rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-[#059669]"
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
                          (lead.course_interest || '').toLowerCase().includes(q)
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
                                <th className="p-3 text-center">Stage</th>
                                <th className="p-3">Disposition</th>
                                <th className="p-3">Activity Today</th>
                                <th className="p-3">Last Updated</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F4F8] font-body-sm">
                              {rows.map(lead => {
                                const stageColors = { L1: '#1BACE4', L2: '#8B5CF6', L3: '#059669' };
                                const dispColors = {
                                  'Interested': '#10B981', 'Not Interested': '#EF4444',
                                  'Not Picked Up': '#F59E0B', 'Switched Off': '#64748B'
                                };
                                return (
                                  <tr key={lead.id} className="hover:bg-[#F9F9FF] transition">
                                    <td className="p-3 pl-4">
                                      <div className="font-semibold text-[#111C2D]">{lead.name || '—'}</div>
                                      <div className="text-[10px] text-[#70787C] font-data-mono">{lead.source || ''}</div>
                                    </td>
                                    <td className="p-3 font-data-mono text-[#111C2D]">
                                      <MaskedPhone phone={lead.phone} />
                                    </td>
                                    <td className="p-3 text-[#505F76] font-data-mono text-[10px]"><MaskedEmail email={lead.email} /></td>
                                    <td className="p-3">
                                      <div className="text-[#111C2D]">{lead.city || '—'}</div>
                                      <div className="text-[10px] text-[#70787C]">{lead.state || ''}</div>
                                    </td>
                                    <td className="p-3 text-center font-data-mono">{lead.experience != null ? lead.experience : '—'}</td>
                                    <td className="p-3 text-[#0F4C5C] font-semibold">{lead.course_interest || '—'}</td>
                                    <td className="p-3 text-[#505F76]">{lead.current_company || '—'}</td>
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
                                          {(lead.activity_today || []).slice(0,2).map((act, ai) => (
                                            <div key={ai} className="text-[10px] text-[#505F76]">
                                              <span className="font-bold text-[#0F4C5C]">[{act.action}]</span> {act.remark ? act.remark.slice(0, 35) : ''}...
                                            </div>
                                          ))}
                                          {(lead.activity_today || []).length > 2 && (
                                            <div className="text-[10px] text-[#1BACE4] font-bold">+{(lead.activity_today || []).length - 2} more</div>
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

          {/* DROPPED LEADS TAB */}
          {activeTab === 'dropped' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#EF4444] text-xl font-bold">block</span>
                      My Dropped & Lost Leads
                    </h2>
                    <p className="text-[11px] text-[#70787C] mt-1 font-body-sm font-normal">
                      These are the leads that you dropped or closed as lost, along with the stage and reason they were dropped.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#CBD5E1]">search</span>
                    <input
                      type="text"
                      placeholder="Search name, phone, course, reason..."
                      value={trackingSearch}
                      onChange={(e) => setTrackingSearch(e.target.value)}
                      className="text-xs p-2 bg-[#F9F9FF] border border-[#E2E8F0] rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-[#EF4444]"
                    />
                  </div>
                </div>
              </div>

              {droppedLoading ? (
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-10 text-center text-xs text-slate-500 italic">
                  Loading dropped leads data...
                </div>
              ) : (
                <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm overflow-hidden">
                  {(() => {
                    const filtered = droppedLeads.filter(lead => {
                      if (!trackingSearch) return true;
                      const q = trackingSearch.toLowerCase();
                      return (
                        (lead.name || '').toLowerCase().includes(q) ||
                        (lead.phone || '').includes(q) ||
                        (lead.course_interest || '').toLowerCase().includes(q) ||
                        (lead.drop_stage || '').toLowerCase().includes(q) ||
                        (lead.drop_remark || '').toLowerCase().includes(q) ||
                        (lead.status || '').toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-10 text-center text-xs text-slate-500 italic">
                          No dropped leads found.
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
                              <th className="p-3">Course</th>
                              <th className="p-3">Original Stage</th>
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
                                <td className="p-3 text-slate-600 font-data-mono">
                                  <MaskedPhone phone={lead.phone} />
                                </td>
                                <td className="p-3">{lead.course_interest || '—'}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    lead.drop_stage === 'L1' ? 'bg-orange-100 text-orange-700' :
                                    lead.drop_stage === 'L2' ? 'bg-blue-100 text-blue-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {lead.drop_stage || 'Unknown'}
                                  </span>
                                </td>
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

          {/* ENROLLED LEADS TAB */}
          {activeTab === 'enrolled' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#10B981] text-xl font-bold">check_circle</span>
                      My Enrolled Admissions
                    </h2>
                    <p className="text-[11px] text-[#70787C] mt-1 font-body-sm font-normal">
                      These are the candidates who successfully completed all L3 stages, paid their fees, and are officially enrolled.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#CBD5E1]">search</span>
                    <input
                      type="text"
                      placeholder="Search name, phone, course, uni..."
                      value={trackingSearch}
                      onChange={(e) => setTrackingSearch(e.target.value)}
                      className="text-xs p-2 bg-[#F9F9FF] border border-[#E2E8F0] rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                    />
                  </div>
                </div>
              </div>

              {enrolledLoading ? (
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-10 text-center text-xs text-slate-500 italic">
                  Loading enrolled admissions data...
                </div>
              ) : (
                <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm overflow-hidden">
                  {(() => {
                    const filtered = enrolledLeads.filter(lead => {
                      if (!trackingSearch) return true;
                      const q = trackingSearch.toLowerCase();
                      return (
                        (lead.name || '').toLowerCase().includes(q) ||
                        (lead.phone || '').includes(q) ||
                        (lead.course_interest || '').toLowerCase().includes(q) ||
                        (lead.university_name || '').toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-10 text-center text-xs text-slate-500 italic">
                          No enrolled admissions found.
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
                              <th className="p-3">University</th>
                              <th className="p-3">Course</th>
                              <th className="p-3">Registration Number</th>
                              <th className="p-3">Revenue Generated</th>
                              <th className="p-3 pr-4">Enrolled Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                            {filtered.map((lead) => {
                              const docStatus = parseDocStatus(lead.documents_status);
                              return (
                                <tr key={lead.id} className="hover:bg-slate-50/70 transition">
                                  <td className="p-3 pl-4">
                                    <div className="font-semibold text-[#10B981]">{lead.name}</div>
                                    <div className="text-[10px] text-slate-500">{lead.city || 'No City'}, {lead.state || 'No State'}</div>
                                  </td>
                                  <td className="p-3 text-slate-600 font-data-mono">
                                    <MaskedPhone phone={lead.phone} />
                                  </td>
                                  <td className="p-3 font-semibold text-slate-700">{lead.university_name || '—'}</td>
                                  <td className="p-3">{lead.course_interest || '—'}</td>
                                  <td className="p-3 font-data-mono font-bold text-slate-800">
                                    {docStatus.registrationNumber || '—'}
                                  </td>
                                  <td className="p-3 font-bold text-[#0F4C5C]">
                                    ₹{(lead.closure_revenue || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td className="p-3 pr-4 text-[10px] text-slate-500 font-data-mono">
                                    {lead.closed_at
                                      ? new Date(lead.closed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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
              )}
            </div>
          )}
        </main>
      </div>

      {/* POPUP ACTION MODAL VIEWS */}

      {selectedLead && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md bg-white border border-[#CBD5E1] p-6 rounded shadow-lg animate-in fade-in zoom-in-95 duration-150">

            {/* L1 QUALIFY DIALOG */}
            {actionType === 'l1_qualify' && (
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined text-green-600">check_circle</span>
                  <span>Qualify Triage — {selectedLead.name}</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Candidate Interest Status</label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`flex items-center justify-center gap-2 p-2.5 border rounded cursor-pointer transition ${l1InterestStatus === 'Interested' ? 'border-[#1BACE4] bg-[#E6F8FE] text-[#1BACE4] font-bold' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                      <input
                        type="radio"
                        name="l1Interest"
                        value="Interested"
                        checked={l1InterestStatus === 'Interested'}
                        onChange={() => setL1InterestStatus('Interested')}
                        className="sr-only"
                      />
                      <span className="material-symbols-outlined text-sm">thumb_up</span>
                      <span className="text-xs">Yes, Interested</span>
                    </label>
                    <label className={`flex items-center justify-center gap-2 p-2.5 border rounded cursor-pointer transition ${l1InterestStatus === 'Not Interested' ? 'border-red-600 bg-red-50 text-red-700 font-bold' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                      <input
                        type="radio"
                        name="l1Interest"
                        value="Not Interested"
                        checked={l1InterestStatus === 'Not Interested'}
                        onChange={() => setL1InterestStatus('Not Interested')}
                        className="sr-only"
                      />
                      <span className="material-symbols-outlined text-sm">thumb_down</span>
                      <span className="text-xs">No, Not Interested</span>
                    </label>
                  </div>
                </div>

                {l1InterestStatus === 'Interested' ? (
                  <>
                    <div className="p-3 bg-[#F0F9FF] border border-[#CBD5E1] rounded-lg">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          required
                          checked={l1Confirmed}
                          onChange={(e) => setL1Confirmed(e.target.checked)}
                          className="rounded text-primary focus:ring-primary mt-0.5"
                        />
                        <span className="text-[11px] font-semibold text-slate-700 leading-snug">
                          I confirm that this candidate has shown interest in our courses and I want to advance them to Level 2.
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">First L2 Follow-up Due Date</label>
                      <input
                        type="datetime-local"
                        required
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Triage Remarks</label>
                      <textarea
                        required
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder="Provide details about the initial interaction..."
                        className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-20"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Drop Reason</label>
                      <select
                        value={crossReason}
                        onChange={(e) => setCrossReason(e.target.value)}
                        className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                      >
                        <option value="Not interested">Not interested / Bad Response</option>
                        <option value="Wrong number">Wrong Number / Invalid contact</option>
                        <option value="Ineligible profile">Ineligible / Under-qualified</option>
                        <option value="Duplicate lead">Duplicate lead record</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Drop Remarks</label>
                      <textarea
                        required
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder="Provide drop details/reasons..."
                        className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-20"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(null); setActionType(null); }}
                    className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`py-1.5 px-4 text-white text-xs font-semibold rounded ${l1InterestStatus === 'Interested' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                  >
                    {l1InterestStatus === 'Interested' ? 'Confirm Interested' : 'Drop Lead'}
                  </button>
                </div>
              </form>
            )}

            {/* L2 ADVANCE DIALOG */}
            {actionType === 'l2_advance' && (
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined text-green-600">done_all</span>
                  <span>Lead Punch (L2 Advance to L3) — {selectedLead.name}</span>
                </h3>

                <p className="text-[11px] text-[#505F76] leading-relaxed">
                  Enter candidate profiling and program details to punch and advance this lead to Level 3 application status.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Target University</label>
                    <select
                      required
                      value={selectedUni}
                      onChange={(e) => setSelectedUni(e.target.value)}
                      className="w-full text-xs p-1.5 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                    >
                      <option value="">-- Select University --</option>
                      {universities.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Target Program/Course</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Online MBA"
                      value={courseDiscussed}
                      onChange={(e) => setCourseDiscussed(e.target.value)}
                      className="w-full text-xs p-1.5 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50 bg-white">
                    <input
                      type="checkbox"
                      checked={isWorkingPref}
                      onChange={(e) => setIsWorkingPref(e.target.checked)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-semibold text-slate-700">Working Professional</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50 bg-white">
                    <input
                      type="checkbox"
                      checked={isEligible}
                      onChange={(e) => setIsEligible(e.target.checked)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-semibold text-slate-700">Eligible Profile</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Candidate Budget (INR)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 250000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded font-data-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Lead Punch Remarks</label>
                  <textarea
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Enter candidate program preferences, budget validation details..."
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-20"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(null); setActionType(null); }}
                    className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded"
                  >
                    Punch & Advance
                  </button>
                </div>
              </form>
            )}

            {/* L2 LOG CALL DIALOG */}
            {actionType === 'log_call' && (
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined text-teal-600">call</span>
                  <span>Log Call Remark & Schedule Follow-up</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">University Discussed</label>
                    <select
                      value={universityDiscussed}
                      onChange={(e) => setUniversityDiscussed(e.target.value)}
                      className="w-full text-xs p-1.5 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                    >
                      <option value="">-- Select University --</option>
                      {universities.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Course Interest</label>
                    <input
                      type="text"
                      placeholder="e.g. Online MBA"
                      value={courseDiscussed}
                      onChange={(e) => setCourseDiscussed(e.target.value)}
                      className="w-full text-xs p-1.5 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">EMI/Fee Options Discussed</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Credila EMI, ₹24,000/sem"
                    value={feeDiscussed}
                    onChange={(e) => setFeeDiscussed(e.target.value)}
                    className="w-full text-xs p-1.5 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Next Follow-up Due Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Call Notes</label>
                  <textarea
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Provide specific points from discussion..."
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-20"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(null); setActionType(null); }}
                    className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded"
                  >
                    Log & Re-schedule
                  </button>
                </div>
              </form>
            )}

            {/* L3 REGISTRATION DIALOG */}
            {actionType === 'l3_registration' && (
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined text-green-700">app_registration</span>
                  <span>L3: Candidate Registration — {selectedLead.name}</span>
                </h3>

                <p className="text-[11px] text-[#505F76] leading-relaxed">
                  Enter the official university portal registration number generated for this candidate.
                </p>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Registration Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. REG-2026-9876"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded font-data-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Application State</label>
                  <select
                    value={appStatus}
                    onChange={(e) => setAppStatus(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                  >
                    <option value="Submitted">Submitted</option>
                    <option value="In Review">In Review</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Registration Notes</label>
                  <textarea
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Enter registration details, application portal context..."
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-20"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(null); setActionType(null); }}
                    className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded"
                  >
                    Save & Move to Documents
                  </button>
                </div>
              </form>
            )}

            {/* L3 DOCUMENTS DIALOG */}
            {actionType === 'l3_documents' && (
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined text-green-700">upload_file</span>
                  <span>L3: Verify Documents — {selectedLead.name}</span>
                </h3>

                <p className="text-[11px] text-[#505F76] leading-relaxed">
                  Verify and check off the document checklist submitted by the candidate.
                </p>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded text-[11px] font-semibold font-data-mono text-slate-700">
                  Registration Number: <span className="text-slate-900 font-bold">{regNumber}</span>
                </div>

                {/* Documents checklist */}
                <div className="border border-slate-200 p-3 rounded space-y-2 bg-slate-50">
                  <label className="block text-[10px] font-bold text-[#40484B] font-label-caps uppercase">Verification Documents Checklist</label>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={docDegree} onChange={(e) => setDocDegree(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                      <span>Degree Certificate</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={docTranscripts} onChange={(e) => setDocTranscripts(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                      <span>Transcripts</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={docIdProof} onChange={(e) => setDocIdProof(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                      <span>ID Proof Card</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={docWorkExp} onChange={(e) => setDocWorkExp(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                      <span>Work Exp Letter</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Verification Remarks</label>
                  <textarea
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Enter document validation notes, checklist confirmations..."
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-20"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(null); setActionType(null); }}
                    className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded"
                  >
                    Submit & Move to Fees
                  </button>
                </div>
              </form>
            )}

            {/* L3 CLOSURE DIALOG */}
            {actionType === 'l3_closure' && (
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined text-green-700">stars</span>
                  <span>L3: Fees Payment & Enrollment — {selectedLead.name}</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 border border-slate-200 rounded text-[10px] text-slate-600 font-data-mono">
                  <div>Reg No: <span className="font-bold text-slate-800">{regNumber}</span></div>
                  <div>Docs Verified: <span className="font-bold text-green-700">Yes</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Application State</label>
                    <select
                      value={appStatus}
                      onChange={(e) => setAppStatus(e.target.value)}
                      className="w-full text-xs p-1.5 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                    >
                      <option value="Submitted">Submitted</option>
                      <option value="In Review">In Review</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Revenue / Fee Collected (INR)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 24000"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                      className="w-full text-xs p-1.5 bg-[#F9F9FF] border border-[#CBD5E1] rounded font-data-mono"
                    />
                  </div>
                </div>

                {/* Fees Payment section */}
                <div className="border border-slate-200 p-3 rounded space-y-3 bg-[#F0FDF4] border-[#BBF7D0]">
                  <label className="block text-[10px] font-bold text-green-800 font-label-caps uppercase">Fees Payment Details</label>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
                    <label className="flex items-center gap-1.5 font-semibold text-green-950 cursor-pointer">
                      <input type="checkbox" checked={feesPaid} onChange={(e) => setFeesPaid(e.target.checked)} className="rounded text-green-600 focus:ring-green-600" />
                      <span>Fees Paid</span>
                    </label>
                    <div>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full text-xs p-1 bg-white border border-[#CBD5E1] rounded focus:outline-none focus:ring-1 focus:ring-green-600"
                        disabled={!feesPaid}
                      >
                        <option value="UPI">UPI / GPay</option>
                        <option value="Net Banking">Net Banking</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Cash">Cash Deposit</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-1.5 font-semibold text-green-950 col-span-2 cursor-pointer">
                      <input type="checkbox" checked={feeReceiptConfirmed} onChange={(e) => setFeeReceiptConfirmed(e.target.checked)} className="rounded text-green-600 focus:ring-green-600" disabled={!feesPaid} />
                      <span>Admissions Fee Receipt Confirmed</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Admission Summary Remarks</label>
                  <textarea
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Enter final closure details, receipt references..."
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-20"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(null); setActionType(null); }}
                    className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded"
                  >
                    Close Deal & Enroll
                  </button>
                </div>
              </form>
            )}

            {/* DROP DIALOG */}
            {actionType === 'drop' && (
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined text-[#BA1A1A]">cancel</span>
                  <span>Close / Archive Data ({selectedLead.name})</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Drop Reason Category</label>
                  <select
                    value={crossReason}
                    onChange={(e) => setCrossReason(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                  >
                    <option value="Not interested">Not interested</option>
                    <option value="Wrong number">Wrong number / Busy</option>
                    <option value="Duplicate upload">Duplicate entry</option>
                    <option value="Ineligible">Ineligible (Qualification mismatch)</option>
                    <option value="Budget issue">Budget constraints</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Remarks</label>
                  <textarea
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Provide specific reason description details..."
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-20"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(null); setActionType(null); }}
                    className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-[#BA1A1A] hover:bg-[#93000A] text-white text-xs font-semibold rounded"
                  >
                    Confirm Drop Data
                  </button>
                </div>
              </form>
            )}

            {/* TRANSFER DIALOG */}
            {actionType === 'transfer' && (
              <form onSubmit={handleTransferSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined text-[#505F76]">swap_horiz</span>
                  <span>Request Reassignment Queue</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Transfer Type</label>
                  <select
                    value={transferType}
                    onChange={(e) => setTransferType(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                  >
                    <option value="give_up">Give up data ownership</option>
                    <option value="request_lead">Request specific data allocation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Reason Category</label>
                  <select
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                  >
                    <option value="Language barrier">Language barrier</option>
                    <option value="Wrong specialization">Wrong specialization interest</option>
                    <option value="Overloaded">Counselor load balance exceeded</option>
                    <option value="Candidate requested">Candidate requested someone else</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Context / Rationale</label>
                  <textarea
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Provide explanation detail for the Team Leader..."
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-20"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(null); setActionType(null); }}
                    className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-[#003441] hover:bg-[#002731] text-white text-xs font-semibold rounded"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}

            {/* FORWARD TO MANAGER DIALOG */}
            {actionType === 'forward' && (
              <form onSubmit={handleForwardSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined text-[#F7941D]">shortcut</span>
                  <span>Forward / Escalate to Manager — {selectedLead.name}</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Escalation Reason / Counselor Remark</label>
                  <textarea
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Provide specific details why you are forwarding this lead to the manager (e.g. discount requested, language barrier, direct manager review)..."
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded h-24"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 border-t border-[#CBD5E1] pt-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(null); setActionType(null); }}
                    className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 bg-[#F7941D] hover:bg-[#D97706] text-white text-xs font-semibold rounded"
                  >
                    Forward Lead
                  </button>
                </div>
              </form>
            )}

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
            <span className="text-[10px] text-slate-300 font-bold font-data-mono tracking-wider">+100 XP LEVEL UP! ⚡</span>
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
