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
 *   Counselor Workspace Portal. Handles the flat lead-status workflow,
 *   Fresh/Carry-Forward pool view, daily trackers, and enrolled admissions.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  COUNSELING_STATUSES,
  NOT_CONTACTABLE_REASONS,
  FEE_PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  TERMINAL_STATUSES,
  getStatusStyle,
  isFreshToday,
  getTodayISTDateString
} from '../utils/statusStyles';
import RemarksModal from '../components/RemarksModal';

// Hidden from the counselor's manual Update Status dropdown only — both remain valid
// counseling_status values everywhere else (pill filters, badges, backend), so a lead
// already sitting at one of these (set earlier, e.g. by a Manager) still displays and
// filters correctly; counselors just can't newly select them from this picker anymore.
const STATUS_DROPDOWN_HIDDEN = ['Lead Punched', 'Duplicate Lead'];

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

// Human-readable labels for the sidebar tab keys, used in the header breadcrumb
// so it reads "Follow-ups Due" instead of the raw "followups" state value.
const TAB_LABELS = {
  all: 'Not Contacted Leads',
  followups: 'Follow-ups Due',
  escalation_returns: 'Escalation Returns',
  performance: 'My Performance',
  tracking: 'Daily Activity Tracker',
  history: 'Work History by Date',
  registration: 'Registration Status',
  enrolled: 'Enrolled Admissions',
  dropped: 'Dropped Leads',
  job_seekers: 'Job Seeker Candidates',
  'status_Interested': 'Interested Leads',
  'status_Call Back': 'Call Back Leads',
  'status_Cold': 'Cold Leads',
  'status_Not Interested': 'Not Interested Leads',
  'status_Not Contactable': 'Not Contactable Leads',
  'status_Lead Punched': 'Lead Punched Leads',
  'status_Duplicate Lead': 'Duplicate Leads',
  'status_Job Seeker': 'Job Seeker Leads'
};

const STATUS_ICONS = {
  'Interested': 'thumb_up',
  'Call Back': 'phone_callback',
  'Cold': 'ac_unit',
  'Not Interested': 'thumb_down',
  'Not Contactable': 'phone_disabled',
  'Lead Punched': 'assignment_turned_in',
  'Duplicate Lead': 'content_copy',
  'Job Seeker': 'work_outline'
};

const getLeadNameColor = (status) => getStatusStyle(status || 'Not Contacted').color;

export default function CounselorDashboard({ token, user, onLogout }) {
  const [leads, setLeads] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // all, followups, performance
  const [selectedLead, setSelectedLead] = useState(null);
  const [remarksModalLead, setRemarksModalLead] = useState(null);
  const [actionType, setActionType] = useState(null); // update_status, log_call, transfer, forward
  const [universities, setUniversities] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [statusSummaryPeriod, setStatusSummaryPeriod] = useState('today'); // today | week | month | all

  // General Form states
  const [remark, setRemark] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Log Call states
  const [universityDiscussed, setUniversityDiscussed] = useState('');
  const [courseDiscussed, setCourseDiscussed] = useState('');
  const [feeDiscussed, setFeeDiscussed] = useState('');

  // Update Status form states
  const [statusValue, setStatusValue] = useState('Interested');
  const [notContactableReasonValue, setNotContactableReasonValue] = useState('Not Picked');
  const [selectedUni, setSelectedUni] = useState('');
  const [leadTypeValue, setLeadTypeValue] = useState('Created');
  const [existedUniValue, setExistedUniValue] = useState('');
  const [leadTemperatureValue, setLeadTemperatureValue] = useState('');
  const [regStatusValue, setRegStatusValue] = useState('Not Registered');
  const [feeStatusValue, setFeeStatusValue] = useState('None');
  const [feeAmountPaidValue, setFeeAmountPaidValue] = useState('');
  const [feeTotalAmountValue, setFeeTotalAmountValue] = useState('');
  const [feeReminderDueAtValue, setFeeReminderDueAtValue] = useState('');

  // Transfer states
  const [transferType, setTransferType] = useState('give_up');
  const [transferReason, setTransferReason] = useState('Language barrier');

  // Forward/Escalation states
  // Must mirror ESCALATION_CATEGORIES in backend/src/index.js
  const ESCALATION_CATEGORIES = ['Finance Issue', 'Time Constraint', 'Decision Delay', 'Placement Concern', 'Other'];
  const [escalationCategory, setEscalationCategory] = useState('');

  // Search & Filter header states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('All');
  const [filterCourse, setFilterCourse] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [filterUniversity, setFilterUniversity] = useState('All');
  const [filterTemperature, setFilterTemperature] = useState('All');
  const [registrationFilter, setRegistrationFilter] = useState('All');



  // History Dates & Details State
  const [historyDates, setHistoryDates] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null); // { summary, leads }
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  // Daily Tracking States
  const [trackingDate, setTrackingDate] = useState(getTodayISTDateString());
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingCategory, setTrackingCategory] = useState('all');
  const [trackingSearch, setTrackingSearch] = useState('');

  // Today's workload snapshot for the top KPI cards (My Workload / Assigned Today /
  // Processed Today / Remaining) — a separate fetch from trackingData so switching between
  // the main work tabs and the Tracking tab's own date picker never overwrite each other.
  const [todaySnapshot, setTodaySnapshot] = useState(null);

  // Dropped Leads States
  const [droppedLeads, setDroppedLeads] = useState([]);
  const [droppedLoading, setDroppedLoading] = useState(false);

  // Enrolled Leads States
  const [enrolledLeads, setEnrolledLeads] = useState([]);
  const [enrolledLoading, setEnrolledLoading] = useState(false);

  // Job Seeker Leads States
  const [jobSeekerLeads, setJobSeekerLeads] = useState([]);
  const [jobSeekersLoading, setJobSeekersLoading] = useState(false);

  // Gamification & Animations
  const [celebrations, setCelebrations] = useState([]);
  const [particles, setParticles] = useState([]);

  // Toast notifications (replaces blocking browser alert() popups)
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, closing: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, closing: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 250);
    }, 3500);
  };

  // Always-visible count of due follow-ups, independent of which tab is active,
  // so the sidebar badge stays accurate no matter where the counselor is. A dedicated
  // COUNT query — not routed through /api/counselor/leads, which joins the whole active
  // base (leads/universities/closures) just to read a number off the end of the array.
  const [dueFollowUpsCount, setDueFollowUpsCount] = useState(0);
  const fetchDueFollowUpsCount = async () => {
    try {
      const response = await fetch(`/api/counselor/followups/count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setDueFollowUpsCount(data.count);
    } catch (err) {
      console.error(err);
    }
  };

  // Leads that came back from an escalation (sent back, or reassigned in as part of
  // resolving someone else's) — always-visible badge, same pattern as due-followups above.
  const [escalationReturns, setEscalationReturns] = useState([]);
  const fetchEscalationReturns = async () => {
    try {
      const response = await fetch(`/api/counselor/leads/escalation-returns`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setEscalationReturns(data);
    } catch (err) {
      console.error(err);
    }
  };

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

  // Universities rarely change — fetch once on mount instead of on every tab switch.
  useEffect(() => {
    fetchUniversities();
  }, []);

  useEffect(() => {
    // trackingSearch is shared across Tracking/Dropped/Enrolled/Job Seekers — it's only
    // ever cleared by clicking a category pill inside the Tracking tab itself, so leftover
    // text from one of these tabs silently pre-filters whichever of the other three is
    // opened next. Reset it on every tab switch so each tab always starts unfiltered.
    setTrackingSearch('');
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
    } else if (activeTab === 'job_seekers') {
      fetchJobSeekers();
    } else {
      // Covers 'all' / 'followups' / 'status_*' — a single unfiltered fetch of the full
      // active base. Follow-ups Due and per-status views are then derived from it
      // client-side (see filteredLeads below) instead of each being a separate,
      // differently-filtered round trip that leaves `leads` holding a partial base.
      fetchLeads();
      fetchTodaySnapshot();
    }
    fetchDueFollowUpsCount();
    fetchEscalationReturns();
  }, [activeTab]);

  // Live polling: while viewing the Daily Tracker, quietly re-fetch so today's status
  // changes and enrollments show up as they happen instead of needing a manual refresh.
  useEffect(() => {
    if (activeTab !== 'tracking') return;
    const interval = setInterval(() => {
      fetchDailyTracking(trackingDate, true);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeTab, trackingDate]);

  // Live polling: My Performance / Data Status Summary — every confirmed status change
  // should show up here as soon as it happens, not just after a manual refresh.
  useEffect(() => {
    if (activeTab !== 'performance') return;
    const interval = setInterval(() => {
      fetchPerformance(statusSummaryPeriod);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeTab, statusSummaryPeriod]);

  const fetchLeads = async () => {
    try {
      // Always the full, unfiltered active base — Not Contacted / per-status / Follow-ups
      // Due are all derived from this same array client-side (see filteredLeads), so the
      // KPI cards and sidebar counts stay correct no matter which of those tabs is active.
      const response = await fetch(`/api/counselor/leads`, {
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

  const fetchJobSeekers = async () => {
    setJobSeekersLoading(true);
    try {
      const response = await fetch('/api/counselor/leads/job-seekers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setJobSeekerLeads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setJobSeekersLoading(false);
    }
  };

  const fetchPerformance = async (period = statusSummaryPeriod) => {
    try {
      const response = await fetch(`/api/counselor/performance?period=${period}`, {
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

  const fetchDailyTracking = async (date, silent = false) => {
    if (!silent) setTrackingLoading(true);
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
      if (!silent) setTrackingLoading(false);
    }
  };

  // Reuses the same daily-tracking endpoint (today, no date param) so "Processed Today" can
  // correctly count fresh leads that were closed out today too — those leave `leads`
  // entirely once closed, so counting from `leads` alone would silently miss them.
  const fetchTodaySnapshot = async () => {
    try {
      const response = await fetch(`/api/leads/daily-tracking`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setTodaySnapshot(data);
    } catch (err) {
      console.error(err);
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
    setUniversityDiscussed('');
    setCourseDiscussed('');
    setFeeDiscussed('');

    if (type === 'update_status') {
      const currentStatus = lead.counseling_status || 'Not Contacted';
      setStatusValue(currentStatus === 'Not Contacted' ? 'Interested' : currentStatus);
      setNotContactableReasonValue(lead.not_contactable_reason || 'Not Picked');
      setSelectedUni(lead.university_id || '');
      setCourseDiscussed(lead.course_interest || '');
      setLeadTypeValue(lead.lead_type || 'Created');
      setExistedUniValue(lead.existed_university_id || '');
      setLeadTemperatureValue(lead.lead_temperature || '');
      setRegStatusValue(lead.registration_status || 'Not Registered');
      setFeeStatusValue(lead.fee_payment_status || 'None');
      setFeeAmountPaidValue(lead.fee_amount_paid || '');
      setFeeTotalAmountValue(lead.fee_total_amount || '');
      setFeeReminderDueAtValue(lead.fee_reminder_due_at ? new Date(lead.fee_reminder_due_at).toISOString().slice(0, 10) : '');
    } else {
      setSelectedUni('');
      setCourseDiscussed('');
    }

    setTransferType('give_up');
    setTransferReason('Language barrier');
    setEscalationCategory('');
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;

    let url = '';
    let method = 'POST';
    let payload = {};

    if (actionType === 'update_status') {
      if (!remark || !remark.trim()) {
        showToast('A remark is required to update the status.', 'warning');
        return;
      }
      if (statusValue === 'Not Contactable' && !notContactableReasonValue) {
        showToast('Please select a reason.', 'warning');
        return;
      }
      if ((statusValue === 'Lead Punched' || statusValue === 'Duplicate Lead') && !selectedUni) {
        showToast('Please select a university.', 'warning');
        return;
      }
      if ((statusValue === 'Lead Punched' || statusValue === 'Duplicate Lead') && !courseDiscussed) {
        showToast('Please select a course.', 'warning');
        return;
      }
      if ((statusValue === 'Interested' || statusValue === 'Lead Punched' || statusValue === 'Duplicate Lead') && leadTypeValue === 'Existed' && !existedUniValue) {
        showToast('Please select which university this lead already existed in.', 'warning');
        return;
      }
      if (statusValue === 'Call Back' && !followUpDate) {
        showToast('Please pick a date/time to call back.', 'warning');
        return;
      }

      // University/Course are only shown for Interested/Lead Punched/Duplicate Lead — don't
      // submit whatever's left in that state for any other status (e.g. pre-filled from the
      // lead's existing record, or a selection made before switching statuses); it would
      // silently overwrite the lead's university/course even though the field wasn't visible.
      const universityFieldsApply = statusValue === 'Interested' || statusValue === 'Lead Punched' || statusValue === 'Duplicate Lead';

      url = `/api/counselor/leads/${selectedLead.id}/status`;
      method = 'PUT';
      payload = {
        counselingStatus: statusValue,
        remark: remark,
        universityId: universityFieldsApply ? (selectedUni || null) : undefined,
        courseDiscussed: universityFieldsApply ? (courseDiscussed || null) : undefined,
        leadType: universityFieldsApply ? (leadTypeValue || null) : undefined,
        existedUniversityId: universityFieldsApply ? (leadTypeValue === 'Existed' ? (existedUniValue || null) : null) : undefined,
        leadTemperature: universityFieldsApply ? (leadTemperatureValue || null) : undefined
      };
      if (statusValue === 'Not Contactable') {
        payload.notContactableReason = notContactableReasonValue;
      }
      if (statusValue === 'Call Back') {
        payload.followUpDate = followUpDate;
      }
      if (statusValue === 'Lead Punched') {
        payload.registrationStatus = regStatusValue;
        payload.feePaymentStatus = feeStatusValue;
        payload.feeAmountPaid = feeAmountPaidValue !== '' ? parseFloat(feeAmountPaidValue) : undefined;
        payload.feeTotalAmount = feeTotalAmountValue !== '' ? parseFloat(feeTotalAmountValue) : undefined;
        payload.feeReminderDueAt = feeReminderDueAtValue || undefined;
      }
    } else if (actionType === 'log_call') {
      url = `/api/counselor/leads/${selectedLead.id}/follow-up`;
      payload = {
        followUpDate: followUpDate || null,
        notes: remark,
        universityId: universityDiscussed || null,
        courseDiscussed,
        feeDiscussed
      };
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const completedAction = actionType;
        const isTerminal = completedAction === 'update_status' && (
          TERMINAL_STATUSES.includes(statusValue) || (statusValue === 'Lead Punched' && feeStatusValue === 'Full')
        );
        setSelectedLead(null);
        setActionType(null);
        fetchLeads();
        fetchTodaySnapshot();
        fetchDueFollowUpsCount();
        fetchEscalationReturns();
        // Trigger gamification animations on success
        if (completedAction === 'update_status' && statusValue === 'Lead Punched' && feeStatusValue === 'Full') {
          triggerCelebration('Deal Closed! 🏆 Enrolled!');
        } else if (isTerminal) {
          triggerCelebration('Lead Processed! 💼 Status Updated');
        } else if (completedAction === 'update_status') {
          triggerCelebration('Status Updated! 👍');
        } else {
          triggerCelebration('Update Successful! 👍');
        }
      } else {
        const err = await response.json();
        showToast(err.error || 'Action failed', 'error');
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
        showToast('Transfer request submitted successfully.', 'success');
        setSelectedLead(null);
        setActionType(null);
        fetchLeads();
        fetchTodaySnapshot();
      } else {
        const err = await response.json();
        showToast(err.error || 'Failed to request transfer', 'error');
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
          remark: remark,
          category: escalationCategory
        })
      });

      if (response.ok) {
        showToast('Lead forwarded to manager successfully.', 'success');
        setSelectedLead(null);
        setActionType(null);
        fetchLeads();
        fetchTodaySnapshot();
        triggerCelebration('Lead Escalated to Manager! 🚀');
      } else {
        const err = await response.json();
        showToast(err.error || 'Failed to forward lead', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSecurityBlock = (e) => {
    e.preventDefault();
  };

  const countByStatus = (status) => {
    if (status === 'All') return leads.length;
    return leads.filter(l => (l.counseling_status || 'Not Contacted') === status).length;
  };

  const totalBaseCount = leads.length;
  const freshBaseCount = leads.filter(l => isFreshToday(l.assigned_at)).length;
  const openingCFCount = totalBaseCount - freshBaseCount;

  // Today's fresh allocation, worked out to include leads closed out today too — those
  // leave `leads` entirely once closed (no lead_assignments row left), so counting only
  // from `leads` would silently undercount "Assigned Today" and "Processed Today" by
  // however many of today's fresh leads got disposed the same day.
  const freshLeadsOpen = leads.filter(l => isFreshToday(l.assigned_at));
  const freshProcessedOpen = freshLeadsOpen.filter(l => (l.counseling_status || 'Not Contacted') !== 'Not Contacted').length;
  const freshClosedToday = todaySnapshot
    ? [...todaySnapshot.categories.enrolled, ...todaySnapshot.categories.dropped]
        .filter(l => l.assignment_assigned_at && isFreshToday(l.assignment_assigned_at)).length
    : 0;
  const todayAssignedTotal = freshBaseCount + freshClosedToday;
  const todayProcessedCount = freshProcessedOpen + freshClosedToday;
  const todayRemainingCount = freshBaseCount - freshProcessedOpen;
  const todayProcessedPct = todayAssignedTotal > 0 ? Math.round((todayProcessedCount / todayAssignedTotal) * 100) : 0;

  // Estimated time to clear what's left — derived from this counselor's own actual pace
  // today (average gap between finishing one lead and finishing the next), not a fixed
  // guess. One timestamp per lead (its latest logged action today) — NOT every individual
  // log entry — since a single lead can rack up multiple entries in one sitting (a call
  // note followed by a status change moments later); averaging every raw gap would mix in
  // those short intra-lead gaps and skew the per-lead estimate low. Needs at least 2
  // distinct leads touched today to mean anything; otherwise there's no honest basis for a
  // number and the card says so instead of showing one.
  let estimatedMinutesLeft = null;
  if (todaySnapshot && todayRemainingCount > 0) {
    const perLeadLatestTimestamp = todaySnapshot.categories.all
      .map(l => (l.activity_today || []).reduce((max, a) => Math.max(max, new Date(a.timestamp).getTime()), 0))
      .filter(ts => ts > 0)
      .sort((a, b) => a - b);
    if (perLeadLatestTimestamp.length >= 2) {
      const totalSpanMs = perLeadLatestTimestamp[perLeadLatestTimestamp.length - 1] - perLeadLatestTimestamp[0];
      const avgGapMs = totalSpanMs / (perLeadLatestTimestamp.length - 1);
      estimatedMinutesLeft = Math.round((avgGapMs * todayRemainingCount) / 60000);
    }
  }
  const formatMinutes = (mins) => {
    if (mins == null) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h} hr ${m} min` : `${m} min`;
  };

  // Get unique options dynamically from current leads list
  const uniqueDates = Array.from(new Set(leads.map(l => l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : ''))).filter(Boolean).sort((a, b) => b.localeCompare(a));
  const uniqueCourses = Array.from(new Set(leads.map(l => l.course_interest))).filter(Boolean).sort();
  const uniqueSources = Array.from(new Set(leads.map(l => l.source))).filter(Boolean).sort();
  const uniqueUniversities = Array.from(new Set(leads.map(l => l.university_name))).filter(Boolean).sort();

  const filteredLeads = leads.filter(l => {
    const currentStatus = l.counseling_status || 'Not Contacted';

    // 1. Category / Status filter based on activeTab
    if (activeTab === 'all') {
      // Main view only shows "Not Contacted" leads
      if (currentStatus !== 'Not Contacted') return false;
    } else if (activeTab === 'followups') {
      if (!l.next_follow_up_date || new Date(l.next_follow_up_date) > new Date()) return false;
    } else if (activeTab.startsWith('status_')) {
      const targetStatus = activeTab.substring(7); // 'status_'.length is 7
      if (currentStatus !== targetStatus) return false;
    }

    // 2. Upload Date filter
    if (filterDate !== 'All') {
      const uDate = l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : 'Unknown';
      if (uDate !== filterDate) return false;
    }

    // 3. Course Interest filter
    if (filterCourse !== 'All' && l.course_interest !== filterCourse) return false;

    // 4. Source filter
    if (filterSource !== 'All' && l.source !== filterSource) return false;

    // 5. University filter
    if (filterUniversity !== 'All' && l.university_name !== filterUniversity) return false;

    // 6. Lead Temperature filter (Hot/Warm/Cold intent classification)
    if (filterTemperature !== 'All' && (l.lead_temperature || 'None') !== filterTemperature) return false;

    // 7. Search Query (Name, Phone, Email, City, State, Course Interest, Source, University, Date)
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
        (l.university_name || '').toLowerCase().includes(q) ||
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
      <aside className="w-[240px] text-white flex flex-col shrink-0 animate-slide-in-left h-screen" style={{ background: '#0C2340' }}>
        <div className="flex flex-col min-h-0 flex-1">
          <div className="p-4 border-b flex flex-col items-start gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <SkillLabsLogo className="h-8 w-auto" />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Counselor Workspace</span>
          </div>

          <nav className="mt-6 space-y-4 px-4 overflow-y-auto flex-1 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
            {/* WORK QUEUE */}
            <div>
              <div className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Work Queue</div>
              <div className="space-y-1">
                <button
                  onClick={(e) => handleTabClick(setActiveTab, 'all', e)}
                  title="Leads that have not been contacted yet"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'all' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'all' ? { background: '#1BACE4' } : {}}
                >
                  {activeTab === 'all' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">view_list</span>
                  <span className="flex flex-col items-start leading-tight text-left flex-grow">
                    <span>Not Contacted Leads</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'all' ? 'text-white/70' : 'text-slate-400'}`}>Leads not yet contacted</span>
                  </span>
                  {countByStatus('Not Contacted') > 0 && (
                    <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold bg-white/20 text-white">
                      {countByStatus('Not Contacted')}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => handleTabClick(setActiveTab, 'followups', e)}
                  title="Calls you've scheduled that are due"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'followups' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'followups' ? { background: '#1BACE4' } : {}}
                >
                  {activeTab === 'followups' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">alarm</span>
                  <span className="flex flex-col items-start leading-tight text-left flex-grow">
                    <span>Follow-ups Due</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'followups' ? 'text-white/70' : 'text-slate-400'}`}>Calls scheduled for today</span>
                  </span>
                  {dueFollowUpsCount > 0 && (
                    <span key={dueFollowUpsCount} className="ml-1 shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold bg-[#EF4444] text-white animate-badge-pop">
                      {dueFollowUpsCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => handleTabClick(setActiveTab, 'escalation_returns', e)}
                  title="Leads back from your manager after an escalation"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'escalation_returns' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'escalation_returns' ? { background: '#F7941D' } : {}}
                >
                  {activeTab === 'escalation_returns' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">assignment_return</span>
                  <span className="flex flex-col items-start leading-tight text-left flex-grow">
                    <span>Escalation Returns</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'escalation_returns' ? 'text-white/70' : 'text-slate-400'}`}>Back from your manager</span>
                  </span>
                  {escalationReturns.length > 0 && (
                    <span key={escalationReturns.length} className="ml-1 shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold bg-[#F7941D] text-white animate-badge-pop">
                      {escalationReturns.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* LEAD CATEGORIES */}
            <div>
              <div className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest mt-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Lead Categories</div>
              <div className="space-y-1">
                {COUNSELING_STATUSES.filter(status => status !== 'Not Contacted').map(status => {
                  const count = countByStatus(status);
                  const icon = STATUS_ICONS[status] || 'label';
                  const tabKey = `status_${status}`;
                  const isActive = activeTab === tabKey;
                  return (
                    <button
                      key={status}
                      onClick={(e) => handleTabClick(setActiveTab, tabKey, e)}
                      title={`Leads with status: ${status}`}
                      className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${isActive ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                      style={isActive ? { background: getStatusStyle(status).color } : {}}
                    >
                      {isActive && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                      <span className="material-symbols-outlined text-lg">{icon}</span>
                      <span className="flex flex-col items-start leading-tight text-left flex-grow truncate">
                        <span>{status}</span>
                      </span>
                      {count > 0 && (
                        <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold bg-white/20 text-white">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* INSIGHTS */}
            <div>
              <div className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Insights</div>
              <div className="space-y-1">
                <button
                  onClick={(e) => handleTabClick(setActiveTab, 'performance', e)}
                  title="Your targets, conversions, and stats"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'performance' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'performance' ? { background: '#1BACE4' } : {}}
                >
                  {activeTab === 'performance' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">equalizer</span>
                  <span className="flex flex-col items-start leading-tight text-left">
                    <span>My Performance</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'performance' ? 'text-white/70' : 'text-slate-400'}`}>Targets & conversion stats</span>
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    handleTabClick(setActiveTab, 'tracking', e);
                    fetchDailyTracking(trackingDate);
                  }}
                  title="What you worked on, day by day"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'tracking' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'tracking' ? { background: '#059669' } : {}}
                >
                  {activeTab === 'tracking' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                  <span className="flex flex-col items-start leading-tight text-left">
                    <span>Daily Activity Tracker</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'tracking' ? 'text-white/70' : 'text-slate-400'}`}>Today's calls & updates</span>
                  </span>
                </button>
                <button
                  onClick={(e) => handleTabClick(setActiveTab, 'history', e)}
                  title="Look back at any past date"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'history' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'history' ? { background: '#F7941D' } : {}}
                >
                  {activeTab === 'history' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">history</span>
                  <span className="flex flex-col items-start leading-tight text-left">
                    <span>Work History by Date</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'history' ? 'text-white/70' : 'text-slate-400'}`}>Browse any previous day</span>
                  </span>
                </button>
              </div>
            </div>

            {/* OUTCOMES */}
            <div>
              <div className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Outcomes</div>
              <div className="space-y-1">
                <button
                  onClick={(e) => handleTabClick(setActiveTab, 'registration', e)}
                  title="Lead Punched leads by registration stage"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'registration' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'registration' ? { background: '#1BACE4' } : {}}
                >
                  {activeTab === 'registration' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">how_to_reg</span>
                  <span className="flex flex-col items-start leading-tight text-left">
                    <span>Registration Status</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'registration' ? 'text-white/70' : 'text-slate-400'}`}>Registered vs not registered</span>
                  </span>
                </button>
                <button
                  onClick={(e) => handleTabClick(setActiveTab, 'enrolled', e)}
                  title="Candidates who successfully enrolled"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'enrolled' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'enrolled' ? { background: '#10B981' } : {}}
                >
                  {activeTab === 'enrolled' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span className="flex flex-col items-start leading-tight text-left">
                    <span>Enrolled Admissions</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'enrolled' ? 'text-white/70' : 'text-slate-400'}`}>Successfully closed deals</span>
                  </span>
                </button>
                <button
                  onClick={(e) => handleTabClick(setActiveTab, 'job_seekers', e)}
                  title="Candidates identified as job seekers"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'job_seekers' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'job_seekers' ? { background: '#F59E0B' } : {}}
                >
                  {activeTab === 'job_seekers' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">work_outline</span>
                  <span className="flex flex-col items-start leading-tight text-left">
                    <span>Job Seeker Pool</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'job_seekers' ? 'text-white/70' : 'text-slate-400'}`}>Candidates seeking jobs only</span>
                  </span>
                </button>
                <button
                  onClick={(e) => handleTabClick(setActiveTab, 'dropped', e)}
                  title="Leads closed as not interested or duplicate"
                  className={`relative overflow-hidden w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded hover-sidebar-item transition duration-150 ${activeTab === 'dropped' ? 'text-white' : 'text-slate-300 hover:bg-white/10'}`}
                  style={activeTab === 'dropped' ? { background: '#EF4444' } : {}}
                >
                  {activeTab === 'dropped' && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/70 animate-accent-grow" />}
                  <span className="material-symbols-outlined text-lg">block</span>
                  <span className="flex flex-col items-start leading-tight text-left">
                    <span>Dropped Leads</span>
                    <span className={`text-[9.5px] font-normal ${activeTab === 'dropped' ? 'text-white/70' : 'text-slate-400'}`}>Not interested or duplicate</span>
                  </span>
                </button>
              </div>
            </div>
          </nav>
        </div>

        {/* Sidebar Profile Card — pinned to bottom */}
        <div className="shrink-0 p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.25)' }}>
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
            <span key={activeTab} className="text-xs font-semibold text-[#111C2D] font-body-sm animate-fade-in">{TAB_LABELS[activeTab] || activeTab}</span>
          </div>
          <div className="flex items-center gap-3">
            {dueFollowUpsCount > 0 && (
              <button
                onClick={(e) => handleTabClick(setActiveTab, 'followups', e)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-full hover:bg-amber-100 transition duration-150"
                title="Jump to follow-ups due"
              >
                <span className="material-symbols-outlined text-sm">alarm</span>
                {dueFollowUpsCount} follow-up{dueFollowUpsCount === 1 ? '' : 's'} due
              </button>
            )}
            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded-full animate-pulse">SECURE GATEWAY</span>
          </div>
        </header>

        {/* Dynamic Inner Screens */}
        <main className="flex-grow p-6 overflow-y-auto space-y-6 animate-fade-in" key={activeTab}>
          {(activeTab === 'all' || activeTab === 'followups' || activeTab.startsWith('status_')) && (
            <>
              {/* My Workload / Assigned Today / Processed Today / Remaining */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#CBD5E1] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <p className="text-[10px] text-[#505F76] font-label-caps uppercase font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">folder</span> My Workload
                  </p>
                  <p className="text-xl font-bold font-data-mono mt-1" style={{ color: '#1BACE4' }}>{totalBaseCount} Leads</p>
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#F0F4F8] text-[10px] font-bold">
                    <span className="text-[#F7941D]">{openingCFCount} Carry Forward</span>
                    <span className="text-green-600">{freshBaseCount} Fresh Today</span>
                  </div>
                </div>
                <div className="bg-white border border-[#CBD5E1] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <p className="text-[10px] text-[#505F76] font-label-caps uppercase font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">move_to_inbox</span> Assigned Today
                  </p>
                  <p className="text-xl font-bold font-data-mono mt-1 text-green-600">{todayAssignedTotal} Leads</p>
                  <div className="text-[10px] text-[#70787C] mt-2 pt-2 border-t border-[#F0F4F8]">Today's Allocation</div>
                </div>
                <div className="bg-white border border-[#CBD5E1] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <p className="text-[10px] text-[#505F76] font-label-caps uppercase font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-green-600">check_circle</span> Processed Today
                  </p>
                  <p className="text-xl font-bold font-data-mono mt-1 text-[#111C2D]">{todayProcessedCount} / {todayAssignedTotal}</p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                    <div className="bg-green-600 h-full rounded-full transition-all duration-500" style={{ width: `${todayProcessedPct}%` }} />
                  </div>
                  <div className="text-[10px] text-[#70787C] mt-1">{todayProcessedPct}% — contacted, updated, disposed or transferred</div>
                </div>
                <div className="bg-white border border-[#CBD5E1] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <p className="text-[10px] text-[#505F76] font-label-caps uppercase font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-600">hourglass_top</span> Remaining
                  </p>
                  <p className="text-xl font-bold font-data-mono mt-1 text-amber-600">{todayRemainingCount} Leads</p>
                  <div className="text-[10px] text-[#70787C] mt-2 pt-2 border-t border-[#F0F4F8]">Need action today</div>
                  {estimatedMinutesLeft != null ? (
                    <div className="text-[10px] text-[#70787C] mt-1">Est. time: <span className="font-bold text-[#111C2D]">{formatMinutes(estimatedMinutesLeft)}</span> at today's pace</div>
                  ) : (
                    <div className="text-[10px] text-[#CBD5E1] italic mt-1">Not enough activity today to estimate</div>
                  )}
                </div>
              </div>

              {/* Working Pipeline Table */}
              <div className="bg-white border border-[#CBD5E1] rounded shadow-sm overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-[#CBD5E1] bg-[#F9F9FF] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">
                      My Working Pipeline List ({filteredLeads.length} Data)
                    </span>
                    {(searchQuery || filterDate !== 'All' || filterCourse !== 'All' || filterSource !== 'All' || filterUniversity !== 'All' || filterTemperature !== 'All') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterDate('All');
                          setFilterCourse('All');
                          setFilterSource('All');
                          setFilterUniversity('All');
                          setFilterTemperature('All');
                        }}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-xs font-bold">close</span>
                        Clear Filters
                      </button>
                    )}
                  </div>

                  {/* Dynamic Filter Header Panel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

                    {/* University Filter */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">University</span>
                      <select
                        value={filterUniversity}
                        onChange={(e) => setFilterUniversity(e.target.value)}
                        className="text-xs p-1.5 bg-white border border-[#CBD5E1] rounded font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="All">All Universities</option>
                        {uniqueUniversities.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    {/* Lead Temperature Filter */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-label-caps">Temperature</span>
                      <select
                        value={filterTemperature}
                        onChange={(e) => setFilterTemperature(e.target.value)}
                        className="text-xs p-1.5 bg-white border border-[#CBD5E1] rounded font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="All">All Temperatures</option>
                        <option value="Hot">🔥 Hot</option>
                        <option value="Warm">🌤️ Warm</option>
                        <option value="Cold">❄️ Cold</option>
                        <option value="None">Not Set</option>
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
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Remark</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Exp</th>
                        <th className="px-4 py-3 font-semibold">Course</th>
                        <th className="px-4 py-3">University</th>
                        <th className="px-4 py-3">Graduation</th>
                        <th className="px-4 py-3 text-center sticky right-0 bg-slate-50 shadow-[-6px_0_6px_-4px_rgba(0,0,0,0.12)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#CBD5E1] text-xs font-body-sm text-[#111C2D]">
                      {filteredLeads.length === 0 ? (
                        <tr>
                          <td colSpan="11" className="p-12 text-center text-[#505F76] italic">
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
                                <td colSpan="11" className="px-4 py-2 font-extrabold text-[#0C2340] font-label-caps">
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

                              {groups[date].map(lead => {
                                const status = lead.counseling_status || 'Not Contacted';
                                const style = getStatusStyle(status);
                                const fresh = isFreshToday(lead.assigned_at);
                                return (
                                <tr key={lead.id} className="group hover:bg-slate-50/80 transition">
                                  <td className="px-4 py-3 font-semibold">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${fresh ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`} title={fresh ? 'Fresh Allocation (assigned today)' : 'Carry Forward (from a previous day)'}>
                                        {fresh ? 'FA' : 'CF'}
                                      </span>
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} title={`Status: ${status}`} />
                                      <span style={{ color: getLeadNameColor(status) }}>
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
                                  <td className="px-4 py-3 font-data-mono text-[10px]">
                                    <MaskedEmail email={lead.email} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${style.badge}`}>
                                      {status}
                                    </span>
                                    {status === 'Not Contactable' && lead.not_contactable_reason && (
                                      <div className="text-[9px] text-slate-400 mt-0.5">{lead.not_contactable_reason}</div>
                                    )}
                                    {status === 'Lead Punched' && (
                                      <div className="text-[9px] text-slate-400 mt-0.5">
                                        {lead.registration_status} · Fee: {lead.fee_payment_status}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 max-w-[180px]">
                                    <div className="flex items-center gap-1.5">
                                      {lead.lead_temperature && (
                                        <span
                                          className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                            lead.lead_temperature === 'Hot' ? 'bg-red-50 text-red-600 border-red-200' :
                                            lead.lead_temperature === 'Warm' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                            'bg-sky-50 text-sky-600 border-sky-200'
                                          }`}
                                          title={`Lead Temperature: ${lead.lead_temperature}`}
                                        >
                                          {lead.lead_temperature === 'Hot' ? '🔥' : lead.lead_temperature === 'Warm' ? '🌤️' : '❄️'} {lead.lead_temperature}
                                        </span>
                                      )}
                                      <span className="truncate text-slate-600" title={lead.status_remark || ''}>
                                        {lead.status_remark || <span className="text-slate-300 italic">No remark</span>}
                                      </span>
                                      <button
                                        onClick={() => setRemarksModalLead(lead)}
                                        className="shrink-0 text-slate-400 hover:text-[#1BACE4]"
                                        title="View all remarks"
                                      >
                                        <span className="material-symbols-outlined text-sm">forum</span>
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : (lead.city || lead.state || '—')}</td>
                                  <td className="px-4 py-3 font-data-mono">{lead.experience} Yrs</td>
                                   <td className="px-4 py-3 font-semibold">{lead.course_interest}</td>
                                   <td className="px-4 py-3">{lead.university_name || <span className="text-slate-300 italic">—</span>}</td>
                                   <td className="px-4 py-3">{lead.graduation || '—'}</td>
                                  <td className="px-4 py-3 flex items-center justify-center gap-1.5 sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-6px_0_6px_-4px_rgba(0,0,0,0.12)]">
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
                                          title="Log call & schedule follow-up"
                                        >
                                          <span className="material-symbols-outlined text-xs">notes</span>
                                        </button>

                                        {/* Update Status */}
                                        <button
                                          onClick={() => handleActionOpen(lead, 'update_status')}
                                          className="py-1 px-2 bg-[#1BACE4] hover:bg-[#1597C8] text-white rounded text-[11px] font-semibold flex items-center gap-0.5 transition"
                                          title="Update lead status"
                                        >
                                          <span className="material-symbols-outlined text-xs font-bold">edit</span>
                                          <span>Update</span>
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
                                );
                              })}
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
                  {(() => {
                    const targetPct = performance.monthlyTarget > 0
                      ? Math.min(100, (performance.monthlyEnrolledCount / performance.monthlyTarget) * 100)
                      : 0;
                    return (
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
                        style={{ width: `${targetPct}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-semibold">
                      <span className="text-[#10B981]">{targetPct.toFixed(0)}% Completed</span>
                      <span className={performance.targetLeft > 0 ? 'text-[#F7941D]' : 'text-green-600'}>
                        {performance.targetLeft > 0 ? `${performance.targetLeft} admissions left to hit goal` : 'Monthly target achieved! 🎉'}
                      </span>
                    </div>
                  </div>
                    );
                  })()}

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

                  {/* Data Report: FA / CF / Touch% */}
                  <div className="border border-[#CBD5E1] p-4 rounded">
                    <h3 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase mb-3">Data Report</h3>
                    <div className="grid grid-cols-5 gap-3 text-center">
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="text-[10px] text-[#505F76] block">Opening CF</span>
                        <span className="font-bold font-data-mono block text-lg text-amber-700 mt-1">{performance.dataReport?.openingCF ?? 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="text-[10px] text-[#505F76] block">Fresh Base</span>
                        <span className="font-bold font-data-mono block text-lg text-green-700 mt-1">{performance.dataReport?.freshBase ?? 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="text-[10px] text-[#505F76] block">Total Base</span>
                        <span className="font-bold font-data-mono block text-lg text-slate-700 mt-1">{performance.dataReport?.totalBase ?? 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="text-[10px] text-[#505F76] block">Touched</span>
                        <span className="font-bold font-data-mono block text-lg text-cyan-700 mt-1">{performance.dataReport?.touchedBase ?? 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                        <span className="text-[10px] text-[#505F76] block">Touch%</span>
                        <span className="font-bold font-data-mono block text-lg text-[#1BACE4] mt-1">{performance.dataReport?.touchPct ?? 0}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Data Status Summary */}
                  <div className="border border-[#CBD5E1] p-4 rounded">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h3 className="text-xs font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#1BACE4] text-base">call</span>
                        Data Status Summary
                      </h3>
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                        {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['all', 'All Time']].map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => { setStatusSummaryPeriod(val); fetchPerformance(val); }}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider transition ${statusSummaryPeriod === val ? 'bg-white text-[#1BACE4] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                        <span className="text-[10px] text-[#505F76] uppercase font-label-caps">Interested</span>
                        <span className="font-bold font-data-mono block text-lg text-green-700 mt-1">{performance.statusSummary?.interested || 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                        <span className="text-[10px] text-[#505F76] uppercase font-label-caps">Call Back</span>
                        <span className="font-bold font-data-mono block text-lg text-teal-700 mt-1">{performance.statusSummary?.call_back || 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                        <span className="text-[10px] text-[#505F76] uppercase font-label-caps">Cold</span>
                        <span className="font-bold font-data-mono block text-lg text-slate-500 mt-1">{performance.statusSummary?.cold || 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                        <span className="text-[10px] text-[#505F76] uppercase font-label-caps">Not Interested</span>
                        <span className="font-bold font-data-mono block text-lg text-red-700 mt-1">{performance.statusSummary?.not_interested || 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                        <span className="text-[10px] text-[#505F76] uppercase font-label-caps">Not Contactable</span>
                        <span className="font-bold font-data-mono block text-lg text-amber-700 mt-1">{performance.statusSummary?.not_contactable || 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                        <span className="text-[10px] text-[#505F76] uppercase font-label-caps">Lead Punched</span>
                        <span className="font-bold font-data-mono block text-lg text-sky-700 mt-1">{performance.statusSummary?.lead_punched || 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                        <span className="text-[10px] text-[#505F76] uppercase font-label-caps">Duplicate Lead</span>
                        <span className="font-bold font-data-mono block text-lg text-purple-700 mt-1">{performance.statusSummary?.duplicate_lead || 0}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                        <span className="text-[10px] text-[#505F76] uppercase font-label-caps">Job Seeker</span>
                        <span className="font-bold font-data-mono block text-lg text-orange-700 mt-1">{performance.statusSummary?.job_seeker || 0}</span>
                      </div>
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

                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          {Object.entries(h).filter(([k]) => k !== 'date' && k !== 'total').map(([status, count]) => (
                            <span key={status} className={`px-1.5 py-0.5 rounded font-bold ${getStatusStyle(status).badge}`}>
                              {status}: {count}
                            </span>
                          ))}
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
                      <div className="flex flex-wrap gap-4">
                        <div className="bg-white border border-[#CBD5E1] p-3 rounded min-w-[110px] text-center">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Total Handled</span>
                          <span className="text-xl font-bold font-data-mono mt-1 block text-slate-800">{historyDetail.summary.total}</span>
                        </div>
                        {Object.entries(historyDetail.summary).filter(([k]) => k !== 'total').map(([status, count]) => (
                          <div key={status} className="bg-white border border-[#CBD5E1] p-3 rounded min-w-[110px] text-center">
                            <span className="text-[10px] font-bold block uppercase tracking-wider" style={{ color: getStatusStyle(status).color }}>{status}</span>
                            <span className="text-xl font-bold font-data-mono mt-1 block" style={{ color: getStatusStyle(status).color }}>{count}</span>
                          </div>
                        ))}
                      </div>

                      {/* Detail Leads list table */}
                      <div className="bg-white border border-[#CBD5E1] rounded shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-[#CBD5E1] text-[10px] font-bold text-[#505F76] uppercase tracking-wider font-label-caps">
                                <th className="px-4 py-3">Candidate</th>
                                <th className="px-4 py-3">Phone</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Status (as of this date)</th>
                                <th className="px-4 py-3">Location</th>
                                <th className="px-4 py-3">Exp</th>
                                <th className="px-4 py-3">Course Interest</th>
                                <th className="px-4 py-3">Graduation</th>
                                <th className="px-4 py-3">Source</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#CBD5E1] font-body-sm text-[#111C2D]">
                              {historyDetail.leads.map(lead => (
                                <tr key={lead.id} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-semibold">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusStyle(lead.counseling_status).dot}`} />
                                      <span style={{ color: getLeadNameColor(lead.counseling_status) }}>
                                        {lead.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-data-mono">
                                    <MaskedPhone phone={lead.phone} />
                                  </td>
                                  <td className="px-4 py-3 font-data-mono text-[10px]">
                                    <MaskedEmail email={lead.email} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getStatusStyle(lead.counseling_status).badge}`}>
                                      {lead.counseling_status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : (lead.city || lead.state || '—')}</td>
                                  <td className="px-4 py-3 font-data-mono">{lead.experience} Yrs</td>
                                  <td className="px-4 py-3 font-semibold">{lead.course_interest}</td>
                                  <td className="px-4 py-3">{lead.graduation || '—'}</td>
                                  <td className="px-4 py-3">{lead.source}</td>
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
                      max={getTodayISTDateString()}
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
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {[
                      { key: 'all',            label: 'All Leads',       count: trackingData.summary.total,        color: '#505F76', bg: '#F8FAFC', border: '#CBD5E1' },
                      { key: 'notContacted',   label: 'Not Contacted',   count: trackingData.summary.notContacted, color: '#64748B', bg: '#F8FAFC', border: '#CBD5E1' },
                      { key: 'interested',     label: 'Interested',      count: trackingData.summary.interested,   color: '#10B981', bg: '#F0FDF4', border: '#86EFAC' },
                      { key: 'callBack',       label: 'Call Back',      count: trackingData.summary.callBack,     color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
                      { key: 'cold',           label: 'Cold',           count: trackingData.summary.cold,         color: '#94A3B8', bg: '#F8FAFC', border: '#CBD5E1' },
                      { key: 'notContactable', label: 'Not Contactable', count: trackingData.summary.notContactable, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
                      { key: 'leadPunched',    label: 'Lead Punched',    count: trackingData.summary.leadPunched,  color: '#1BACE4', bg: '#EFF9FF', border: '#BAE6FD' },
                      { key: 'enrolled',       label: 'Enrolled ✓',      count: trackingData.summary.enrolled,     color: '#0F4C5C', bg: '#F0F9FF', border: '#7DD3FC' },
                      { key: 'dropped',        label: 'Dropped/Closed',  count: trackingData.summary.dropped,      color: '#BA1A1A', bg: '#FFF1F2', border: '#FECDD3' },
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
                          trackingCategory === 'notContacted' ? 'Not Contacted Leads' :
                          trackingCategory === 'interested' ? 'Interested Leads' :
                          trackingCategory === 'callBack' ? 'Call Back Leads' :
                          trackingCategory === 'cold' ? 'Cold Leads' :
                          trackingCategory === 'notContactable' ? 'Not Contactable Leads' :
                          trackingCategory === 'leadPunched' ? 'Lead Punched Leads' :
                          trackingCategory === 'enrolled' ? 'Enrolled Leads' :
                          'Dropped / Closed Leads'
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
                                <th className="p-3">Graduation</th>
                                <th className="p-3">Company</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Touched Today</th>
                                <th className="p-3">Activity Today</th>
                                <th className="p-3">Last Updated</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F4F8] font-body-sm">
                              {rows.map(lead => {
                                const status = lead.counseling_status || (lead.final_status ? lead.final_status : 'Not Contacted');
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
                                    <td className="p-3 text-[#505F76]">{lead.graduation || '—'}</td>
                                    <td className="p-3 text-[#505F76]">{lead.current_company || '—'}</td>
                                    <td className="p-3 text-center">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${getStatusStyle(status).badge}`}>
                                        {status}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center">
                                      {/* Enrolled/Dropped rows come from `closures`, which never carries
                                          touchedToday (that field only exists on rows sourced from
                                          lead_assignments) — but closing a lead today is itself an action,
                                          so fall back to whether it has any activity logged today. */}
                                      {(lead.touchedToday ?? (lead.activity_today || []).length > 0) ? (
                                        <span className="material-symbols-outlined text-green-600 text-base">check_circle</span>
                                      ) : (
                                        <span className="material-symbols-outlined text-slate-300 text-base">radio_button_unchecked</span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      {(lead.activity_today || []).length > 0 ? (
                                        <div className="space-y-0.5">
                                          {(lead.activity_today || []).slice(0,2).map((act, ai) => (
                                            <div key={ai} className="text-[10px] text-[#505F76]">
                                              <span className="font-bold text-[#0F4C5C]">[{act.action}]</span> {act.remark ? act.remark.slice(0, 35) : ''}...
                                            </div>
                                          ))}
                                        </div>
                                      ) : <span className="text-[10px] text-[#CBD5E1] italic">No actions</span>}
                                      <button
                                        onClick={() => setRemarksModalLead(lead)}
                                        className="text-[10px] text-[#1BACE4] font-bold hover:underline mt-0.5"
                                      >
                                        View all remarks
                                      </button>
                                    </td>
                                    <td className="p-3 text-[10px] text-[#70787C] font-data-mono">
                                      {/* Enrolled/Dropped rows have no assignment_updated_at (their
                                          lead_assignments row is gone) — closed_at is the equivalent
                                          "last touched" moment for those. */}
                                      {(lead.assignment_updated_at || lead.closed_at)
                                        ? new Date(lead.assignment_updated_at || lead.closed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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
                      These are the leads you closed as Not Interested or Duplicate Lead. Job Seeker closures have their own tab.
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
                        (lead.final_status || '').toLowerCase().includes(q)
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
                              <th className="p-3">Email</th>
                              <th className="p-3">Course</th>
                              <th className="p-3">Graduation</th>
                              <th className="p-3">Closed Status</th>
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
                                <td className="p-3 text-slate-600 font-data-mono text-[10px]">
                                  <MaskedEmail email={lead.email} />
                                </td>
                                <td className="p-3">{lead.course_interest || '—'}</td>
                                <td className="p-3">{lead.graduation || '—'}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusStyle(lead.drop_stage).badge}`}>
                                    {lead.drop_stage || lead.final_status || 'Unknown'}
                                  </span>
                                </td>
                                <td className="p-3 max-w-[300px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate text-slate-600 font-normal italic" title={lead.drop_remark}>
                                      {lead.drop_remark || 'No remark provided'}
                                    </span>
                                    <button
                                      onClick={() => setRemarksModalLead(lead)}
                                      className="shrink-0 text-slate-400 hover:text-[#1BACE4]"
                                      title="View all remarks"
                                    >
                                      <span className="material-symbols-outlined text-sm">forum</span>
                                    </button>
                                  </div>
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

          {/* JOB SEEKER CANDIDATES TAB */}
          {activeTab === 'job_seekers' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#F59E0B] text-xl font-bold">work_outline</span>
                      Job Seeker Candidate Pool
                    </h2>
                    <p className="text-[11px] text-[#70787C] mt-1 font-body-sm font-normal">
                      These leads were identified as job seekers — not genuinely interested in education. They are tracked separately from dropped leads.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#CBD5E1]">search</span>
                    <input
                      type="text"
                      placeholder="Search name, phone, course..."
                      value={trackingSearch}
                      onChange={(e) => setTrackingSearch(e.target.value)}
                      className="text-xs p-2 bg-[#F9F9FF] border border-[#E2E8F0] rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-[#F59E0B]"
                    />
                  </div>
                </div>
              </div>

              {jobSeekersLoading ? (
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-10 text-center text-xs text-slate-500 italic">
                  Loading job seeker data...
                </div>
              ) : (
                <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm overflow-hidden">
                  {(() => {
                    const filtered = jobSeekerLeads.filter(lead => {
                      if (!trackingSearch) return true;
                      const q = trackingSearch.toLowerCase();
                      return (
                        (lead.name || '').toLowerCase().includes(q) ||
                        (lead.phone || '').includes(q) ||
                        (lead.course_interest || '').toLowerCase().includes(q) ||
                        (lead.drop_remark || '').toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-10 text-center text-xs text-slate-500 italic">
                          No job seeker candidates found.
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto min-w-0">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-[#FFFBEB] border-b border-[#FDE68A]">
                            <tr className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider font-label-caps">
                              <th className="p-3 pl-4">Candidate</th>
                              <th className="p-3">Phone</th>
                              <th className="p-3">Email</th>
                              <th className="p-3">Course Interest</th>
                              <th className="p-3">Current Company</th>
                              <th className="p-3">Experience</th>
                              <th className="p-3">Remark</th>
                              <th className="p-3 pr-4">Identified On</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#FEF3C7] font-body-sm text-[#111C2D]">
                            {filtered.map((lead) => (
                              <tr key={lead.id} className="hover:bg-amber-50/50 transition">
                                <td className="p-3 pl-4">
                                  <div className="font-semibold" style={{ color: '#F59E0B' }}>{lead.name}</div>
                                  <div className="text-[10px] text-slate-500">{lead.city || 'No City'}, {lead.state || 'No State'}</div>
                                </td>
                                <td className="p-3 text-slate-600 font-data-mono">
                                  <MaskedPhone phone={lead.phone} />
                                </td>
                                <td className="p-3 text-slate-600 font-data-mono text-[10px]">
                                  <MaskedEmail email={lead.email} />
                                </td>
                                <td className="p-3">{lead.course_interest || '—'}</td>
                                <td className="p-3">{lead.current_company || '—'}</td>
                                <td className="p-3 font-data-mono">{lead.experience ? `${lead.experience} Yrs` : '—'}</td>
                                <td className="p-3 max-w-[240px]">
                                  <span className="truncate text-slate-600 font-normal italic block" title={lead.drop_remark}>
                                    {lead.drop_remark || 'No remark provided'}
                                  </span>
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

          {/* ESCALATION RETURNS TAB — leads back from a manager after being forwarded */}
          {activeTab === 'escalation_returns' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#F7941D] text-xl font-bold">assignment_return</span>
                  Escalation Returns
                </h2>
                <p className="text-[11px] text-[#70787C] mt-1 font-body-sm font-normal">
                  Leads you escalated that your manager has since sent back or reassigned to you, still waiting on an updated status from you.
                </p>
              </div>

              {escalationReturns.length === 0 ? (
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-10 text-center text-xs text-slate-500 italic">
                  Nothing waiting here — every escalated lead has been acted on.
                </div>
              ) : (
                <div className="space-y-3">
                  {escalationReturns.map(lead => (
                    <div key={lead.id} className="bg-white border border-[#FDE68A] rounded-xl shadow-sm p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[#111C2D] text-sm">{lead.name}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusStyle(lead.counseling_status).badge}`}>
                              {lead.counseling_status || 'Not Contacted'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                              {lead.escalation_resolution_type === 'reassign' ? 'Reassigned to you' : 'Sent back'}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#70787C] mt-1 flex items-center gap-3 flex-wrap">
                            <span><MaskedPhone phone={lead.phone} /></span>
                            {lead.escalation_category && <span>Category: <strong className="text-[#40484B]">{lead.escalation_category}</strong></span>}
                            <span>{lead.escalation_resolved_at ? new Date(lead.escalation_resolved_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                          {lead.escalation_resolution_note && (
                            <p className="text-[11px] text-[#111C2D] mt-2 italic">
                              <span className="font-bold not-italic text-[#F7941D]">Manager's note: </span>
                              {lead.escalation_resolution_note}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setRemarksModalLead(lead)}
                            className="py-1.5 px-3 border border-[#CBD5E1] text-[#40484B] text-xs font-semibold rounded hover:bg-slate-50 transition"
                          >
                            View Remarks
                          </button>
                          <button
                            onClick={() => handleActionOpen(lead, 'log_call')}
                            className="py-1.5 px-3 border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold rounded hover:bg-teal-100 transition flex items-center gap-1"
                            title="Log call & schedule follow-up"
                          >
                            <span className="material-symbols-outlined text-sm">notes</span>
                            Log Call
                          </button>
                          <button
                            onClick={() => handleActionOpen(lead, 'update_status')}
                            className="py-1.5 px-3 bg-[#F7941D] hover:bg-[#D97706] text-white text-xs font-semibold rounded transition"
                          >
                            Update Status
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REGISTRATION STATUS TAB */}
          {activeTab === 'registration' && (
            <div className="space-y-6">
              {(() => {
                const punchedLeads = leads.filter(l => (l.counseling_status || 'Not Contacted') === 'Lead Punched');
                const registeredCount = punchedLeads.filter(l => l.registration_status === 'Registered').length;
                const notRegisteredCount = punchedLeads.length - registeredCount;
                const filtered = punchedLeads.filter(lead => {
                  if (registrationFilter !== 'All' && (lead.registration_status || 'Not Registered') !== registrationFilter) return false;
                  if (!trackingSearch) return true;
                  const q = trackingSearch.toLowerCase();
                  return (
                    (lead.name || '').toLowerCase().includes(q) ||
                    (lead.phone || '').includes(q) ||
                    (lead.course_interest || '').toLowerCase().includes(q) ||
                    (lead.university_name || '').toLowerCase().includes(q)
                  );
                });

                return (
                  <>
                    <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm p-5">
                      <h2 className="text-sm font-bold text-[#111C2D] font-label-caps uppercase flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#1BACE4] text-xl font-bold">how_to_reg</span>
                        Registration Status
                      </h2>
                      <p className="text-[11px] text-[#70787C] mt-1 font-body-sm font-normal">
                        Every Lead Punched candidate, split by whether they've completed registration at the university yet.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button
                        onClick={() => setRegistrationFilter('All')}
                        className="flex flex-col items-start p-4 rounded-xl border-2 transition hover:shadow-md text-left"
                        style={{
                          background: '#F8FAFC',
                          borderColor: registrationFilter === 'All' ? '#505F76' : '#CBD5E1',
                          boxShadow: registrationFilter === 'All' ? '0 0 0 2px #505F7633' : 'none'
                        }}
                      >
                        <span className="text-xl font-black font-data-mono text-[#505F76]">{punchedLeads.length}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider mt-1 text-[#505F76]">All Lead Punched</span>
                      </button>
                      <button
                        onClick={() => setRegistrationFilter('Registered')}
                        className="flex flex-col items-start p-4 rounded-xl border-2 transition hover:shadow-md text-left"
                        style={{
                          background: '#F0FDF4',
                          borderColor: registrationFilter === 'Registered' ? '#10B981' : '#86EFAC',
                          boxShadow: registrationFilter === 'Registered' ? '0 0 0 2px #10B98133' : 'none'
                        }}
                      >
                        <span className="text-xl font-black font-data-mono text-[#10B981]">{registeredCount}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider mt-1 text-[#10B981]">Registered</span>
                      </button>
                      <button
                        onClick={() => setRegistrationFilter('Not Registered')}
                        className="flex flex-col items-start p-4 rounded-xl border-2 transition hover:shadow-md text-left"
                        style={{
                          background: '#FFFBEB',
                          borderColor: registrationFilter === 'Not Registered' ? '#F59E0B' : '#FDE68A',
                          boxShadow: registrationFilter === 'Not Registered' ? '0 0 0 2px #F59E0B33' : 'none'
                        }}
                      >
                        <span className="text-xl font-black font-data-mono text-[#F59E0B]">{notRegisteredCount}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider mt-1 text-[#F59E0B]">Not Registered</span>
                      </button>
                    </div>

                    <div className="bg-white border border-[#CBD5E1] rounded-xl shadow-sm overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-[#F0F4F8]">
                        <h3 className="text-xs font-bold text-[#111C2D] uppercase tracking-wide font-label-caps flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-[#1BACE4]">group</span>
                          {registrationFilter === 'All' ? 'All Lead Punched Leads' : `${registrationFilter} Leads`}
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-data-mono">
                            {filtered.length} leads
                          </span>
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-[#CBD5E1]">search</span>
                          <input
                            type="text"
                            placeholder="Search name, phone, course, uni..."
                            value={trackingSearch}
                            onChange={(e) => setTrackingSearch(e.target.value)}
                            className="text-xs p-2 bg-[#F9F9FF] border border-[#E2E8F0] rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-[#1BACE4]"
                          />
                        </div>
                      </div>

                      {filtered.length === 0 ? (
                        <div className="p-10 text-center text-xs text-slate-500 italic">
                          No leads found in this category.
                        </div>
                      ) : (
                        <div className="overflow-x-auto min-w-0">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                              <tr className="text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                                <th className="p-3 pl-4">Candidate</th>
                                <th className="p-3">Phone</th>
                                <th className="p-3">University</th>
                                <th className="p-3">Course</th>
                                <th className="p-3">Registration</th>
                                <th className="p-3">Registration Date</th>
                                <th className="p-3">Fee Payment</th>
                                <th className="p-3 pr-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F4F8]">
                              {filtered.map(lead => (
                                <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                                  <td className="p-3 pl-4 font-semibold text-[#111C2D]">{lead.name}</td>
                                  <td className="p-3 font-data-mono"><MaskedPhone phone={lead.phone} /></td>
                                  <td className="p-3">{lead.university_name || <span className="text-slate-300 italic">—</span>}</td>
                                  <td className="p-3">{lead.course_interest || '—'}</td>
                                  <td className="p-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${lead.registration_status === 'Registered' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                      {lead.registration_status || 'Not Registered'}
                                    </span>
                                  </td>
                                  <td className="p-3">{lead.registration_date ? new Date(lead.registration_date).toLocaleDateString('en-IN') : '—'}</td>
                                  <td className="p-3">{lead.fee_payment_status || 'None'}</td>
                                  <td className="p-3 pr-4 text-right whitespace-nowrap">
                                    <button
                                      onClick={() => handleActionOpen(lead, 'log_call')}
                                      className="py-1.5 px-2 border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded transition mr-1.5"
                                      title="Log call & schedule follow-up"
                                    >
                                      <span className="material-symbols-outlined text-sm">notes</span>
                                    </button>
                                    <button
                                      onClick={() => handleActionOpen(lead, 'update_status')}
                                      className="py-1.5 px-3 bg-[#1BACE4] hover:bg-[#1082B0] text-white text-xs font-semibold rounded transition"
                                    >
                                      Update
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
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
                      These are the candidates who were marked Lead Punched, completed full fee payment, and are officially enrolled.
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
                              <th className="p-3">Email</th>
                              <th className="p-3">University</th>
                              <th className="p-3">Course</th>
                              <th className="p-3">Graduation</th>
                              <th className="p-3">Revenue Generated</th>
                              <th className="p-3 pr-4">Enrolled Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0] font-body-sm text-[#111C2D]">
                            {filtered.map((lead) => (
                              <tr key={lead.id} className="hover:bg-slate-50/70 transition">
                                <td className="p-3 pl-4">
                                  <div className="font-semibold text-[#10B981]">{lead.name}</div>
                                  <div className="text-[10px] text-slate-500">{lead.city || 'No City'}, {lead.state || 'No State'}</div>
                                </td>
                                <td className="p-3 text-slate-600 font-data-mono">
                                  <MaskedPhone phone={lead.phone} />
                                </td>
                                <td className="p-3 text-slate-600 font-data-mono text-[10px]">
                                  <MaskedEmail email={lead.email} />
                                </td>
                                <td className="p-3 font-semibold text-slate-700">{lead.university_name || '—'}</td>
                                <td className="p-3">{lead.course_interest || '—'}</td>
                                <td className="p-3">{lead.graduation || '—'}</td>
                                <td className="p-3 font-bold text-[#0F4C5C]">
                                  ₹{(lead.closure_revenue || 0).toLocaleString('en-IN')}
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
        </main>
      </div>

      {/* POPUP ACTION MODAL VIEWS */}

      {selectedLead && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md bg-white border border-[#CBD5E1] p-6 rounded shadow-lg animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">

            {/* UPDATE STATUS DIALOG — replaces the old L1/L2/L3 qualify/advance/closure/drop modals */}
            {actionType === 'update_status' && (
              <form onSubmit={handleActionSubmit} className="space-y-4">
                <h3 className="text-sm font-bold text-[#111C2D] font-headline-md flex items-center gap-1.5 border-b border-[#CBD5E1] pb-2">
                  <span className="material-symbols-outlined" style={{ color: getStatusStyle(statusValue).color }}>edit</span>
                  <span>Update Status — {selectedLead.name}</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Status</label>
                  <select
                    value={statusValue}
                    onChange={(e) => setStatusValue(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded font-semibold"
                    style={{ color: getStatusStyle(statusValue).color }}
                  >
                    {COUNSELING_STATUSES.filter(s => !STATUS_DROPDOWN_HIDDEN.includes(s) || s === selectedLead.counseling_status).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {(TERMINAL_STATUSES.includes(statusValue) || (statusValue === 'Lead Punched' && feeStatusValue === 'Full')) && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 font-semibold flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-sm">info</span>
                    <span>
                      {statusValue === 'Lead Punched'
                        ? 'This will mark the lead as Enrolled and remove it from your active list.'
                        : 'This will close out the lead and remove it from your active list.'}
                    </span>
                  </div>
                )}

                {statusValue === 'Not Contactable' && (
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Reason</label>
                    <select
                      value={notContactableReasonValue}
                      onChange={(e) => setNotContactableReasonValue(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                    >
                      {NOT_CONTACTABLE_REASONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}

                {statusValue === 'Call Back' && (
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Next Call-Back Date</label>
                    <input
                      type="datetime-local"
                      required
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">This lead will show up under Follow-ups Due once this date/time arrives.</p>
                  </div>
                )}

                {(statusValue === 'Interested' || statusValue === 'Lead Punched' || statusValue === 'Duplicate Lead') && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">University</label>
                      <select
                        required={statusValue === 'Lead Punched' || statusValue === 'Duplicate Lead'}
                        value={selectedUni}
                        onChange={(e) => {
                          setSelectedUni(e.target.value);
                          setCourseDiscussed(''); // Reset course when university changes
                        }}
                        className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded font-semibold text-[#111C2D]"
                      >
                        <option value="">-- Select University --</option>
                        {universities.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Course</label>
                      <select
                        required={statusValue === 'Lead Punched' || statusValue === 'Duplicate Lead'}
                        value={courseDiscussed}
                        onChange={(e) => setCourseDiscussed(e.target.value)}
                        className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded font-semibold text-[#111C2D]"
                        disabled={!selectedUni}
                      >
                        <option value="">-- Select Course --</option>
                        {(() => {
                          const selectedUniObj = universities.find(u => u.id === selectedUni);
                          if (!selectedUniObj) return null;
                          const coursesList = typeof selectedUniObj.courses === 'string'
                            ? JSON.parse(selectedUniObj.courses)
                            : selectedUniObj.courses;
                          return (coursesList || []).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ));
                        })()}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Lead Type</label>
                      <select
                        value={leadTypeValue}
                        onChange={(e) => {
                          setLeadTypeValue(e.target.value);
                          if (e.target.value !== 'Existed') setExistedUniValue('');
                        }}
                        className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded font-semibold text-[#111C2D]"
                      >
                        <option value="Created">Lead Create</option>
                        <option value="Existed">Lead Existed</option>
                      </select>
                    </div>

                    {leadTypeValue === 'Existed' && (
                      <div>
                        <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Existed In University</label>
                        <div className="flex items-center gap-2">
                          <select
                            required
                            value={existedUniValue}
                            onChange={(e) => setExistedUniValue(e.target.value)}
                            className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded font-semibold text-[#111C2D]"
                          >
                            <option value="">-- Select University --</option>
                            {universities.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => { setLeadTypeValue('Created'); setExistedUniValue(''); }}
                            className="shrink-0 text-[10px] font-bold text-[#1BACE4] hover:text-[#1082B0] whitespace-nowrap px-2 py-2 border border-[#CBD5E1] rounded"
                          >
                            Back to Lead Create
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">This lead already existed at the selected university before.</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Lead Temperature</label>
                      <select
                        value={leadTemperatureValue}
                        onChange={(e) => setLeadTemperatureValue(e.target.value)}
                        className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded font-semibold text-[#111C2D]"
                      >
                        <option value="">-- Select --</option>
                        <option value="Hot">Hot Lead</option>
                        <option value="Warm">Warm Lead</option>
                        <option value="Cold">Cold Lead</option>
                      </select>
                    </div>
                  </>
                )}

                {statusValue === 'Lead Punched' && (
                  <div className="border border-slate-200 p-3 rounded space-y-3 bg-slate-50">
                    <label className="block text-[10px] font-bold text-[#40484B] font-label-caps uppercase">Registration &amp; Fee Payment (L2)</label>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#40484B] mb-1">Registration Status</label>
                        <select
                          value={regStatusValue}
                          onChange={(e) => setRegStatusValue(e.target.value)}
                          className="w-full text-xs p-1.5 bg-white border border-[#CBD5E1] rounded"
                        >
                          {REGISTRATION_STATUSES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#40484B] mb-1">Fee Payment</label>
                        <select
                          value={feeStatusValue}
                          onChange={(e) => setFeeStatusValue(e.target.value)}
                          className="w-full text-xs p-1.5 bg-white border border-[#CBD5E1] rounded"
                        >
                          {FEE_PAYMENT_STATUSES.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(feeStatusValue === 'Partial' || feeStatusValue === 'Full') && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-[#40484B] mb-1">Amount Paid (INR)</label>
                            <input
                              type="number"
                              required
                              value={feeAmountPaidValue}
                              onChange={(e) => setFeeAmountPaidValue(e.target.value)}
                              placeholder="e.g. 25000"
                              className="w-full text-xs p-1.5 bg-white border border-[#CBD5E1] rounded font-data-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#40484B] mb-1">Total Fee (INR)</label>
                            <input
                              type="number"
                              required
                              value={feeTotalAmountValue}
                              onChange={(e) => setFeeTotalAmountValue(e.target.value)}
                              placeholder="e.g. 50000"
                              className="w-full text-xs p-1.5 bg-white border border-[#CBD5E1] rounded font-data-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#40484B] mb-1">Reminder Due Date</label>
                          <input
                            type="date"
                            value={feeReminderDueAtValue}
                            onChange={(e) => setFeeReminderDueAtValue(e.target.value)}
                            className="w-full text-xs p-1.5 bg-white border border-[#CBD5E1] rounded"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Defaults to 7 days out if left blank — shown as an in-app reminder to yourself and your Manager/Team Leader.</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">
                    Remark (required)
                  </label>
                  <textarea
                    required
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Add context from the call — this is mandatory..."
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
                    className="py-1.5 px-4 text-white text-xs font-semibold rounded"
                    style={{ background: getStatusStyle(statusValue).color }}
                  >
                    Save Status
                  </button>
                </div>
              </form>
            )}

            {/* LOG CALL DIALOG */}
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
                  <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Escalation Category</label>
                  <select
                    required
                    value={escalationCategory}
                    onChange={(e) => setEscalationCategory(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded"
                  >
                    <option value="" disabled>Select the blocking issue...</option>
                    {ESCALATION_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

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

      {remarksModalLead && (
        <RemarksModal token={token} lead={remarksModalLead} onClose={() => setRemarksModalLead(null)} />
      )}

      {/* Toast Notifications */}
      <div className="fixed top-5 right-5 z-[10000] flex flex-col items-end pointer-events-none">
        {toasts.map(t => {
          const style = t.type === 'success'
            ? { icon: 'check_circle', bg: '#0C2340', accent: '#10B981' }
            : t.type === 'error'
              ? { icon: 'error', bg: '#0C2340', accent: '#EF4444' }
              : t.type === 'warning'
                ? { icon: 'warning', bg: '#0C2340', accent: '#F59E0B' }
                : { icon: 'info', bg: '#0C2340', accent: '#1BACE4' };
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-lg shadow-2xl text-white text-xs font-semibold max-w-[320px] border-l-4 ${t.closing ? 'animate-toast-out' : 'animate-toast-in'}`}
              style={{ background: style.bg, borderColor: style.accent }}
            >
              <span className="material-symbols-outlined text-lg" style={{ color: style.accent }}>{style.icon}</span>
              <span className="leading-snug">{t.message}</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
