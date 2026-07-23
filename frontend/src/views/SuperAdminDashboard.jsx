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
 *   Super Admin System Configuration Portal. Manages database seed entries,
 *   global user creations, and instance configurations.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import ManagerDashboard from './ManagerDashboard';
import HiringAdminDashboard from '../modules/hiring/dashboards/HiringAdminDashboard';
import { hiringApi } from '../modules/hiring/services/hiringApi';

const ADMISSIONS_ROLES = ['counselor', 'team_leader', 'manager', 'super_admin'];
const HIRING_ROLES = ['recruiter', 'hiring_team_leader'];


const SkillLabsLogo = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" className={className}>
    <text x="0" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="38" fill="#1BACE4" letterSpacing="-1.5">Skill</text>
    <text x="92" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="300" fontSize="38" fill="#F7941D" letterSpacing="-1.5">Labs</text>
  </svg>
);

export default function SuperAdminDashboard({ token, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('audit'); // audit, users, protocols, repository, universities
  const [viewingManager, setViewingManager] = useState(false);
  const [viewingHiring, setViewingHiring] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

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
  const [actionType, setActionType] = useState('');

  // User Management State
  const [usersSubTab, setUsersSubTab] = useState('admissions'); // 'admissions' | 'hiring' — kept as separate
  // registries so the two workspaces' distinct role sets (and permission implications) never
  // get mixed into one dropdown/list, and so a hiring team assignment can't be mistaken for an
  // Admissions team assignment (they're different tables: users.team_id vs users.hiring_team_id).
  const [usersList, setUsersList] = useState([]);
  const [teamsList, setTeamsList] = useState([]);
  const [hiringTeamsList, setHiringTeamsList] = useState([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('counselor');
  const [newUserTeamId, setNewUserTeamId] = useState('');
  const [userFormError, setUserFormError] = useState(null);
  const [userFormSuccess, setUserFormSuccess] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserError, setEditUserError] = useState(null);

  // Repository stats state
  const [repoStats, setRepoStats] = useState({ leads: 0, raw: 0, clean: 0, duplicate: 0, invalid: 0 });

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

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchLogs();
    } else if (activeTab === 'users') {
      fetchUsers();
      fetchTeams();
      fetchHiringTeams();
    } else if (activeTab === 'repository') {
      fetchRepositoryStats();
      // Reuse logs for audit compliance exports — deliberately unfiltered by actionType,
      // which belongs to the Audit tab's dropdown. Passing the current actionType through
      // here left the Repository tab's log list (and its client-side "no repository
      // transaction logs" empty state) silently filtered by whatever the Audit tab's
      // dropdown happened to be set to, even though that filter isn't shown on this tab.
      fetchLogs(true);
    } else if (activeTab === 'universities') {
      fetchUniversities();
    }
  }, [activeTab, actionType]);

  const fetchLogs = async (ignoreActionTypeFilter = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionType && !ignoreActionTypeFilter) params.append('action_type', actionType);

      const response = await fetch(`/api/audit/logs?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setUsersList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/admin/teams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTeamsList(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHiringTeams = async () => {
    try {
      const data = await hiringApi.listTeams(token);
      setHiringTeamsList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const switchUsersSubTab = (subTab) => {
    setUsersSubTab(subTab);
    setUserFormError(null);
    setUserFormSuccess(false);
    setNewUserRole(subTab === 'hiring' ? 'recruiter' : 'counselor');
    setNewUserTeamId('');
  };

  const fetchRepositoryStats = async () => {
    try {
      // Fetch stats from the Data Status + Data Report reporting APIs
      const [statusRes, reportRes] = await Promise.all([
        fetch('/api/reports/data-status', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/reports/data-report', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [data, report] = await Promise.all([statusRes.json(), reportRes.json()]);
      if (statusRes.ok && reportRes.ok) {
        const activeCount = report.aggregate.totalBase;
        const enrolled = parseInt(data.closuresSummary.find(c => c.final_status === 'enrolled')?.count || 0, 10);
        // Total across every closure outcome (enrolled/lost/duplicate/job_seeker/etc.),
        // not just enrolled+lost — hand-picking those two undercounted "Total Leased Data
        // Rows" by every Duplicate Lead and Job Seeker closure.
        const allClosures = data.closuresSummary.reduce((sum, c) => sum + parseInt(c.count || 0, 10), 0);
        setRepoStats({
          leads: activeCount + allClosures + data.unassigned,
          raw: data.unassigned,
          clean: activeCount,
          enrolled
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(false);

    if (!newUserEmail.toLowerCase().endsWith('@skilllabs.net')) {
      setUserFormError('Access restricted: Only @skilllabs.net accounts are permitted.');
      return;
    }
    if (!newUserPassword || newUserPassword.length < 8) {
      setUserFormError('Password must be at least 8 characters long.');
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          // users.team_id has a foreign key into the Admissions `teams` table — a Hiring
          // team's id (from hiringTeamsList) is a completely different table (hiring_teams)
          // and would violate that FK constraint if sent here. Hiring team assignment is
          // applied separately below via hiringApi.setRecruiterTeam once the account exists.
          teamId: usersSubTab === 'hiring' ? null : (newUserTeamId || null)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setUserFormError(data.error || 'Failed to create user account.');
      } else {
        // Hiring roles don't have a teamId column of their own (users.hiring_team_id is a
        // separate column from users.team_id, added later for the Hiring workspace) — assign
        // it via the dedicated hiring endpoint once the account exists.
        if (usersSubTab === 'hiring' && newUserTeamId) {
          try {
            await hiringApi.setRecruiterTeam(token, data.id, newUserTeamId);
          } catch (teamErr) {
            console.error(teamErr);
          }
        }
        setUserFormSuccess(true);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole(usersSubTab === 'hiring' ? 'recruiter' : 'counselor');
        setNewUserTeamId('');
        fetchUsers();
        triggerCelebration('User Account Created! 👤');
      }
    } catch (err) {
      setUserFormError('Failed to connect to backend server.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetPasswordError(null);
    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      setResetPasswordError('Password must be at least 8 characters long.');
      return;
    }
    try {
      const response = await fetch(`/api/admin/users/${resetPasswordUser.id}/reset-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: resetPasswordValue })
      });
      const data = await response.json();
      if (!response.ok) {
        setResetPasswordError(data.error || 'Failed to reset password.');
      } else {
        setResetPasswordUser(null);
        setResetPasswordValue('');
        triggerCelebration('Password Reset! 🔑');
      }
    } catch (err) {
      setResetPasswordError('Failed to connect to backend server.');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setEditUserError(null);
    if (!editUserEmail.toLowerCase().endsWith('@skilllabs.net')) {
      setEditUserError('Access restricted: Only @skilllabs.net accounts are permitted.');
      return;
    }
    try {
      const response = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editUserName, email: editUserEmail })
      });
      const data = await response.json();
      if (!response.ok) {
        setEditUserError(data.error || 'Failed to update user.');
      } else {
        setEditUser(null);
        fetchUsers();
        triggerCelebration('User Updated! ✏️');
      }
    } catch (err) {
      setEditUserError('Failed to connect to backend server.');
    }
  };

  const handleHiringTeamChange = async (userId, hiringTeamId) => {
    try {
      await hiringApi.setRecruiterTeam(token, userId, hiringTeamId || null);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update team assignment');
    }
  };

  const handleToggleUser = async (userId) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to update user status');
      } else {
        fetchUsers();
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
      if (response.ok) {
        setUniversitiesList(data);
      }
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
      const pairs = uniFees.split(',');
      for (const pair of pairs) {
        const parts = pair.split(':');
        if (parts.length === 2) {
          const course = parts[0].trim();
          const feeVal = parseFloat(parts[1].trim());
          if (course && !isNaN(feeVal)) {
            feesObj[course] = feeVal;
          }
        }
      }
    }

    const payload = {
      name: uniName,
      courses: coursesArr,
      fees: feesObj,
      eligibility: uniEligibility,
      specializations: specsArr
    };

    try {
      const url = editingUniId
        ? `/api/admin/universities/${editingUniId}`
        : '/api/admin/universities';
      const method = editingUniId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        setUniFormError(data.error || 'Failed to save university.');
      } else {
        setUniFormSuccess(true);
        setUniName('');
        setUniCourses('');
        setUniFees('');
        setUniEligibility('');
        setUniSpecializations('');
        setEditingUniId(null);
        fetchUniversities();
        triggerCelebration(editingUniId ? 'University Updated! 🎓' : 'University Created! 🎓');
      }
    } catch (err) {
      setUniFormError('Failed to connect to backend server.');
    }
  };

  const handleEditUniversity = (uni) => {
    setEditingUniId(uni.id);
    setUniName(uni.name);
    setUniCourses(Array.isArray(uni.courses) ? uni.courses.join(', ') : '');
    let feesStr = '';
    if (uni.fees && typeof uni.fees === 'object') {
      feesStr = Object.entries(uni.fees).map(([c, f]) => `${c}: ${f}`).join(', ');
    }
    setUniFees(feesStr);
    setUniEligibility(uni.eligibility || '');
    setUniSpecializations(Array.isArray(uni.specializations) ? uni.specializations.join(', ') : '');
    setUniFormError(null);
    setUniFormSuccess(false);
  };

  const handleDeleteUniversity = async (uniId) => {
    if (!window.confirm('Are you sure you want to delete this university?')) return;
    try {
      const response = await fetch(`/api/admin/universities/${uniId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to delete university');
      } else {
        fetchUniversities();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSecurityBlock = (e) => {
    e.preventDefault();
  };

  if (viewingManager) {
    return (
      <ManagerDashboard
        token={token}
        user={{ ...user, role: 'manager' }}
        onLogout={onLogout}
        onBackToAdmin={() => setViewingManager(false)}
      />
    );
  }

  if (viewingHiring) {
    return (
      <HiringAdminDashboard
        token={token}
        user={{ ...user, role: 'hiring_team_leader' }}
        onLogout={onLogout}
        onBackToAdmin={() => setViewingHiring(false)}
      />
    );
  }

  return (
    <div 
      className="min-h-screen bg-[#F8FAFC] flex text-[#111C2D]"
      onContextMenu={handleSecurityBlock}
      onCopy={handleSecurityBlock}
      onCut={handleSecurityBlock}
      onPaste={handleSecurityBlock}
      style={{ userSelect: 'none' }}
    >
      {/* Sidebar */}
      <div className="w-[240px] text-white flex flex-col justify-between shrink-0 animate-slide-in-left" style={{ background: '#0C2340' }}>
        <div>
          <div className="p-4 border-b flex flex-col items-start gap-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <SkillLabsLogo className="h-8 w-auto" />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>CRM Admin Portal</span>
          </div>

          <div className="p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 font-label-caps">Role</p>
            <p className="text-sm font-semibold mt-1 font-body-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base" style={{ color: '#F7941D' }}>admin_panel_settings</span>
              <span>Super Admin Portal</span>
            </p>
          </div>

          <div className="p-3 px-4 border-b space-y-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Workspace</p>
              <button
                onClick={(e) => {
                  handleTabClick(() => {}, 'manager_portal', e);
                  setViewingManager(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg text-white bg-[#F7941D] hover:bg-[#E08518] shadow-md transition duration-150 active:scale-95"
              >
                <span className="material-symbols-outlined text-base">supervisor_account</span>
                <span>Admissions</span>
              </button>
            </div>
            <button
              onClick={(e) => {
                handleTabClick(() => {}, 'hiring_portal', e);
                setViewingHiring(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg text-white bg-[#7C3AED] hover:bg-[#6D28D9] shadow-md transition duration-150 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">work</span>
              <span>Hiring</span>
            </button>
          </div>

          <nav className="mt-4 space-y-1 px-2">
            <button 
              onClick={(e) => handleTabClick(setActiveTab, 'audit', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white transition duration-150 active:scale-95 ${activeTab === 'audit' ? 'bg-[#1BACE4]' : 'hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined text-lg">policy</span>
              <span>System &amp; Audit Trail</span>
            </button>
            <button 
              onClick={(e) => handleTabClick(setActiveTab, 'users', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white transition duration-150 active:scale-95 ${activeTab === 'users' ? 'bg-[#1BACE4]' : 'hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined text-lg">people</span>
              <span>Users &amp; Roles</span>
            </button>
            <button 
              onClick={(e) => handleTabClick(setActiveTab, 'protocols', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white transition duration-150 active:scale-95 ${activeTab === 'protocols' ? 'bg-[#1BACE4]' : 'hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined text-lg">enhanced_encryption</span>
              <span>Security Protocols</span>
            </button>
            <button 
              onClick={(e) => handleTabClick(setActiveTab, 'repository', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white transition duration-150 active:scale-95 ${activeTab === 'repository' ? 'bg-[#1BACE4]' : 'hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined text-lg">database</span>
              <span>Data Repository</span>
            </button>
            <button 
              onClick={(e) => handleTabClick(setActiveTab, 'universities', e)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white transition duration-150 active:scale-95 ${activeTab === 'universities' ? 'bg-[#1BACE4]' : 'hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined text-lg">school</span>
              <span>Universities</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="text-xs text-slate-300 truncate font-body-sm">{user.name}</div>
          <div className="text-[10px] text-slate-500 truncate mb-3 font-data-mono">{user.email}</div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#BA1A1A] hover:bg-[#93000A] text-white text-xs font-semibold rounded transition duration-150"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col h-screen overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-[56px] border-b border-[#E2E8F0] bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#70787C] font-label-caps">Compliance Center</span>
            <span className="text-xs text-[#E2E8F0]">/</span>
            <span className="text-xs font-semibold text-[#111C2D] font-body-sm capitalize">{activeTab} Console</span>
          </div>
        </header>

        {/* Workspace views */}
        <main className="flex-grow p-6 overflow-y-auto space-y-6 animate-fade-in" key={activeTab}>

          {/* TAB 1: SYSTEM & AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <>
              {/* Health & Compliance Cards */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white border border-[#E2E8F0] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#70787C] font-label-caps border-b border-[#E2E8F0] pb-2 mb-3">
                    System Diagnostics
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>Server Status:</span>
                      <span className="font-bold text-green-600 uppercase">Enforced / Active</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2">
                      <span>Database engine:</span>
                      <span className="font-data-mono font-semibold">PostgreSQL (Primary Engine)</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2">
                      <span>SSO domain restriction:</span>
                      <span className="font-semibold text-[#1BACE4]">@skilllabs.net ONLY</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#70787C] font-label-caps border-b border-[#E2E8F0] pb-2 mb-3">
                    Active Security Policies
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span>Anti-Copy / Right Click:</span>
                      <span className="px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 font-bold rounded text-[9px] uppercase">
                        Enforced
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                      <span>Phone Masking (Display-Only):</span>
                      <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded text-[9px] uppercase" title="Masks digits on-screen for shoulder-surfing protection; the assigned counselor's browser still receives the full number to enable dialing.">
                        UI-Level
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                      <span>Click-to-Call gateway:</span>
                      <span className="px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 font-bold rounded text-[9px] uppercase">
                        Enforced
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] p-4 rounded shadow-sm hover-card-lift hover:shadow-md">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#70787C] font-label-caps border-b border-[#E2E8F0] pb-2 mb-3">
                    Database Backups Log
                  </h3>
                  <div className="space-y-2 text-[11px] font-data-mono">
                    <div className="flex justify-between">
                      <span>2026-07-06 00:00 (Daily)</span>
                      <span className="text-green-600 font-bold">SUCCESS (1.2MB)</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1.5">
                      <span>2026-07-05 00:00 (Daily)</span>
                      <span className="text-green-600 font-bold">SUCCESS (1.2MB)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Trail list */}
              <div className="bg-white border border-[#E2E8F0] rounded overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">
                    Security Compliance &amp; Operation Logs Audit Trail
                  </span>
                  
                  <div>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="text-xs p-1 bg-white border border-[#E2E8F0] rounded"
                    >
                      <option value="">-- Filter Action --</option>
                      <option value="login">Login Events</option>
                      <option value="export">Exports Logs</option>
                      <option value="distributed">Distribution</option>
                      <option value="transfer_approve">Reassignments</option>
                      <option value="tick">Counselor Ticks</option>
                      <option value="cross">Counselor Crosses</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">User Executed</th>
                        <th className="p-3">Action Type</th>
                        <th className="p-3">Details / Audit Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-xs font-data-mono text-[#111C2D] bg-black bg-opacity-5">
                      {loading ? (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-slate-500">
                            Querying audit records...
                          </td>
                        </tr>
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-slate-500">
                            No audit records found.
                          </td>
                        </tr>
                      ) : (
                        logs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-100 transition">
                            <td className="p-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="p-3 font-semibold text-[#1BACE4]">
                              {log.user_name || 'System / Batch'} ({log.user_email || 'sso'})
                            </td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                log.action === 'login' ? 'bg-blue-100 text-blue-800' :
                                log.action === 'export' ? 'bg-red-100 text-red-800' :
                                'bg-slate-200 text-slate-800'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3 font-body-sm text-[#40484B]">{log.remark || 'No remark logged.'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: USER & ROLES MANAGEMENT */}
          {activeTab === 'users' && (() => {
            const isHiring = usersSubTab === 'hiring';
            const scopedUsers = usersList.filter(u => isHiring ? HIRING_ROLES.includes(u.role) : ADMISSIONS_ROLES.includes(u.role));
            const accent = isHiring ? '#7C3AED' : '#1BACE4';
            return (
            <div className="space-y-4">
              {/* Workspace sub-tabs — Admissions and Hiring accounts are deliberately kept in
                  separate registries: different role sets, different team tables
                  (team_id vs hiring_team_id), so the permissions granted by each can't be
                  confused with one another. */}
              <div className="flex gap-2 border-b border-[#E2E8F0] pb-3">
                <button
                  type="button"
                  onClick={() => switchUsersSubTab('admissions')}
                  className={`text-xs font-bold py-2 px-4 rounded-lg transition flex items-center gap-1.5 ${
                    !isHiring ? 'bg-[#1BACE4] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">school</span>
                  Admissions Team
                </button>
                <button
                  type="button"
                  onClick={() => switchUsersSubTab('hiring')}
                  className={`text-xs font-bold py-2 px-4 rounded-lg transition flex items-center gap-1.5 ${
                    isHiring ? 'bg-[#7C3AED] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">badge</span>
                  Hiring Team
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Form to Add Account */}
                <div className="bg-white border border-[#E2E8F0] p-6 rounded shadow-sm h-fit">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps border-b border-[#E2E8F0] pb-2 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base" style={{ color: accent }}>person_add</span>
                    Register {isHiring ? 'Hiring' : 'Admissions'} Account
                  </h3>

                  {userFormError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-[#BA1A1A] text-xs rounded">
                      {userFormError}
                    </div>
                  )}
                  {userFormSuccess && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded font-semibold">
                      User account registered successfully!
                    </div>
                  )}

                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Company Email</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. john@skilllabs.net"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                      />
                      <p className="text-[10px] text-[#70787C] mt-1">* Must be a @skilllabs.net email address.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Password</label>
                      <input
                        type="text"
                        required
                        placeholder="Minimum 8 characters"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                      />
                      <p className="text-[10px] text-[#70787C] mt-1">* Share this password with the user securely; it will not be shown again.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Access Role &amp; Permission</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                        className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none"
                      >
                        {isHiring ? (
                          <>
                            <option value="recruiter">Recruiter (Candidate Pipeline)</option>
                            <option value="hiring_team_leader">Hiring Team Leader (Distribution &amp; Queue)</option>
                          </>
                        ) : (
                          <>
                            <option value="counselor">Counselor (Lead Processing)</option>
                            <option value="team_leader">Team Leader (Distribution &amp; Queue)</option>
                            <option value="manager">Manager (Reporting &amp; Uploads)</option>
                            <option value="super_admin">Super Admin (System Controls)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {isHiring ? (
                      <div>
                        <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Hiring Team Assignment</label>
                        <select
                          value={newUserTeamId}
                          onChange={(e) => setNewUserTeamId(e.target.value)}
                          className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none"
                        >
                          <option value="">-- No Team --</option>
                          {hiringTeamsList.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : newUserRole === 'counselor' && (
                      <div>
                        <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Team Assignment</label>
                        <select
                          value={newUserTeamId}
                          onChange={(e) => setNewUserTeamId(e.target.value)}
                          className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none"
                        >
                          <option value="">-- No Team (General Pool) --</option>
                          {teamsList.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2 text-white text-xs font-bold rounded transition"
                      style={{ backgroundColor: accent }}
                    >
                      Create {isHiring ? 'Hiring' : 'Admissions'} Account
                    </button>
                  </form>
                </div>

                {/* Users table */}
                <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">
                      {isHiring ? 'Hiring Team' : 'Admissions'} Accounts &amp; Access Controls Registry
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-800 py-0.5 px-2 rounded-full font-bold">
                      Total: {scopedUsers.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                          <th className="p-3">User Details</th>
                          <th className="p-3">Role</th>
                          <th className="p-3">Team</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs font-body-sm text-[#111C2D]">
                        {usersLoading ? (
                          <tr>
                            <td colSpan="5" className="p-8 text-center text-[#70787C] italic">Loading users registry...</td>
                          </tr>
                        ) : scopedUsers.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-8 text-center text-[#70787C] italic">No {isHiring ? 'hiring team' : 'admissions'} users registered yet.</td>
                          </tr>
                        ) : (
                          scopedUsers.map(u => (
                            <tr key={u.id} className="hover:bg-[#F8FAFC]">
                              <td className="p-3">
                                <div className="font-semibold text-slate-800">{u.name}</div>
                                <div className="text-[10px] text-slate-500 font-data-mono mt-0.5">{u.company_email}</div>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                                  u.role === 'super_admin' ? 'bg-red-50 border border-red-200 text-red-700' :
                                  u.role === 'manager' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                                  u.role === 'team_leader' ? 'bg-blue-50 border border-blue-200 text-blue-700' :
                                  u.role === 'hiring_team_leader' ? 'bg-violet-50 border border-violet-200 text-violet-700' :
                                  u.role === 'recruiter' ? 'bg-purple-50 border border-purple-200 text-purple-700' :
                                  'bg-green-50 border border-green-200 text-green-700'
                                }`}>
                                  {u.role.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500 font-semibold">
                                {isHiring ? (
                                  <select
                                    value={u.hiring_team_id || ''}
                                    onChange={(e) => handleHiringTeamChange(u.id, e.target.value)}
                                    className="text-[10px] p-1 bg-white border border-[#CBD5E1] rounded"
                                  >
                                    <option value="">-- No Team --</option>
                                    {hiringTeamsList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </select>
                                ) : (u.team_name || '—')}
                              </td>
                              <td className="p-3 text-center">
                                {u.active ? (
                                  <span className="px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 font-bold rounded text-[10px] uppercase">Active</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 font-bold rounded text-[10px] uppercase">Suspended</span>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => { setEditUser(u); setEditUserName(u.name); setEditUserEmail(u.company_email); setEditUserError(null); }}
                                  className="text-[10px] font-bold py-1 px-2.5 rounded transition bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 mr-1.5"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setResetPasswordUser(u); setResetPasswordValue(''); setResetPasswordError(null); }}
                                  className="text-[10px] font-bold py-1 px-2.5 rounded transition bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 mr-1.5"
                                >
                                  Reset Password
                                </button>
                                <button
                                  type="button"
                                  disabled={u.id === user.id}
                                  onClick={() => handleToggleUser(u.id)}
                                  className={`text-[10px] font-bold py-1 px-2.5 rounded transition ${
                                    u.id === user.id ? 'bg-slate-100 text-slate-300 cursor-not-allowed' :
                                    u.active ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100' :
                                    'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100'
                                  }`}
                                >
                                  {u.active ? 'Deactivate' : 'Activate'}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* TAB 3: SECURITY PROTOCOLS */}
          {activeTab === 'protocols' && (
            <div className="space-y-6">
              
              {/* Security protocols showcase card */}
              <div className="bg-white border border-[#E2E8F0] p-6 rounded shadow-sm">
                <h2 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[#1BACE4]">shield</span>
                  Active Enterprise Security Protocols Showcase
                </h2>
                <p className="text-xs text-[#70787C] mb-6">Security mechanisms currently compiled, tested, and strictly enforced across all user scopes.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* P1 */}
                  <div className="border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC]">
                    <div className="flex items-center gap-2 text-[#1BACE4] mb-3">
                      <span className="material-symbols-outlined text-2xl">content_cut</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider font-label-caps">Anti-Copy &amp; Paste</h4>
                    </div>
                    <p className="text-[11px] text-[#40484B] leading-relaxed">
                      Prevents counselors from copying customer phone numbers, emails, or student details to local clipboards. Blocked at DOM event level.
                    </p>
                    <span className="mt-4 inline-block px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold rounded">ENFORCED</span>
                  </div>

                  {/* P2 */}
                  <div className="border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC]">
                    <div className="flex items-center gap-2 text-[#F7941D] mb-3">
                      <span className="material-symbols-outlined text-2xl">visibility_off</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider font-label-caps">Phone Number Masking</h4>
                    </div>
                    <p className="text-[11px] text-[#40484B] leading-relaxed">
                      Masks the middle digits of client phone numbers on-screen by default, revealed on click. This is a shoulder-surfing/screen-share deterrent, not a data-access boundary — the assigned counselor's browser always holds the real number to enable dialing.
                    </p>
                    <span className="mt-4 inline-block px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded">UI-LEVEL ONLY</span>
                  </div>

                  {/* P3 */}
                  <div className="border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC]">
                    <div className="flex items-center gap-2 text-indigo-500 mb-3">
                      <span className="material-symbols-outlined text-2xl">domain</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider font-label-caps">Email SSO Locking</h4>
                    </div>
                    <p className="text-[11px] text-[#40484B] leading-relaxed">
                      Restricts authentication and credential creation strictly to organization SSO domains. Only verified <strong>@skilllabs.net</strong> addresses can join.
                    </p>
                    <span className="mt-4 inline-block px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold rounded">ENFORCED</span>
                  </div>

                  {/* P4 */}
                  <div className="border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC]">
                    <div className="flex items-center gap-2 text-rose-500 mb-3">
                      <span className="material-symbols-outlined text-2xl">phonelink_lock</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider font-label-caps">Conflict Footprints</h4>
                    </div>
                    <p className="text-[11px] text-[#40484B] leading-relaxed">
                      Automatically detects login conflicts. If a user logs in from a new machine, they must explicitly terminate the footprint of the old active session.
                    </p>
                    <span className="mt-4 inline-block px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold rounded">ENFORCED</span>
                  </div>

                </div>
              </div>

              {/* compliance checklist */}
              <div className="bg-white border border-[#E2E8F0] p-6 rounded shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps border-b border-[#E2E8F0] pb-2 mb-4">
                  Organization-Wide Security Audits Compliance Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs p-2.5 bg-amber-50/50 border border-amber-200/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-600">verified_user</span>
                      <span className="font-semibold text-slate-800">Compliance Audit logs integrity</span>
                    </div>
                    <span className="font-data-mono text-[10px] text-amber-700 font-bold" title="System-level events (logins, account changes, batch deletions) are permanent and never targeted by any delete query. Per-lead activity notes are removed only when that lead's own batch is deleted via Data Repository.">PARTIAL (system events permanent; per-lead notes follow their lead)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2.5 bg-green-50/50 border border-green-200/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-green-600">verified_user</span>
                      <span className="font-semibold text-slate-800">Click-to-Call Gateway Integration</span>
                    </div>
                    <span className="font-data-mono text-[10px] text-green-700 font-bold">ACTIVE (Gateway dial mask verified)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2.5 bg-green-50/50 border border-green-200/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-green-600">verified_user</span>
                      <span className="font-semibold text-slate-800">Knex query string binding protection</span>
                    </div>
                    <span className="font-data-mono text-[10px] text-green-700 font-bold">ACTIVE (SQL injection protected)</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: DATA REPOSITORY */}
          {activeTab === 'repository' && (
            <div className="space-y-6">
              
              {/* Repository Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm">
                  <div className="text-[10px] text-[#70787C] font-label-caps uppercase font-bold mb-1">Total Leased Data Rows</div>
                  <div className="text-2xl font-bold font-data-mono text-slate-800">{repoStats.leads}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Archived in database repository</div>
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm">
                  <div className="text-[10px] text-[#70787C] font-label-caps uppercase font-bold mb-1">Unassigned Raw Pool</div>
                  <div className="text-2xl font-bold font-data-mono text-[#1BACE4]">{repoStats.raw}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Ready for counselor mapping</div>
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm">
                  <div className="text-[10px] text-[#70787C] font-label-caps uppercase font-bold mb-1">Active Pipeline Data</div>
                  <div className="text-2xl font-bold font-data-mono text-[#F7941D]">{repoStats.clean}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Currently owned by counselors</div>
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded p-4 shadow-sm">
                  <div className="text-[10px] text-[#70787C] font-label-caps uppercase font-bold mb-1">Total Enrolled Closures</div>
                  <div className="text-2xl font-bold font-data-mono text-green-600">{repoStats.enrolled}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Verified converted student deals</div>
                </div>
              </div>

              {/* Data Export logs list */}
              <div className="bg-white border border-[#E2E8F0] rounded overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">
                    Audit Log of Data Exports, Distributions &amp; Database Actions
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">User Executed</th>
                        <th className="p-3">Action Type</th>
                        <th className="p-3">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] font-data-mono text-[#111C2D]">
                      {logs.filter(l => l.action !== 'login').length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-[#70787C] italic">No repository transaction logs recorded.</td>
                        </tr>
                      ) : (
                        logs.filter(l => l.action !== 'login').map(log => (
                          <tr key={log.id} className="hover:bg-[#F8FAFC]">
                            <td className="p-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="p-3 font-semibold text-[#1BACE4]">{log.user_name || 'System'}</td>
                            <td className="p-3">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-bold rounded uppercase">
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3 font-body-sm text-[#40484B]">{log.remark}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'universities' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form to Add / Edit University */}
              <div className="bg-white border border-[#E2E8F0] p-6 rounded shadow-sm h-fit">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps border-b border-[#E2E8F0] pb-2 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#1BACE4] text-base">school</span>
                  <span>{editingUniId ? 'Edit University' : 'Register University'}</span>
                </h3>

                {uniFormError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-[#BA1A1A] text-xs rounded">
                    {uniFormError}
                  </div>
                )}
                {uniFormSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded font-semibold">
                    University saved successfully!
                  </div>
                )}

                <form onSubmit={handleSaveUniversity} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">University Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Boston University"
                      value={uniName}
                      onChange={(e) => setUniName(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Courses (comma separated)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Online MBA, Executive MBA, iMBA"
                      value={uniCourses}
                      onChange={(e) => setUniCourses(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Fees Mapping (e.g. Course1: 24000, Course2: 35000)</label>
                    <input
                      type="text"
                      placeholder="e.g. Online MBA: 24000, Executive MBA: 35000"
                      value={uniFees}
                      onChange={(e) => setUniFees(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Specializations (comma separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Finance, Marketing, Operations"
                      value={uniSpecializations}
                      onChange={(e) => setUniSpecializations(e.target.value)}
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Eligibility Criteria</label>
                    <textarea
                      placeholder="e.g. Bachelor's degree with 3+ years experience"
                      value={uniEligibility}
                      onChange={(e) => setUniEligibility(e.target.value)}
                      rows="3"
                      className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-grow py-2 bg-[#1BACE4] hover:bg-[#1597C8] text-white text-xs font-bold rounded transition"
                    >
                      {editingUniId ? 'Update University' : 'Add University'}
                    </button>
                    {editingUniId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUniId(null);
                          setUniName('');
                          setUniCourses('');
                          setUniFees('');
                          setUniEligibility('');
                          setUniSpecializations('');
                        }}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Universities table */}
              <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] font-label-caps">
                    Registered Universities
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-800 py-0.5 px-2 rounded-full font-bold">
                    Total: {universitiesList.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#70787C] uppercase tracking-wider font-label-caps">
                        <th className="p-3">University Details</th>
                        <th className="p-3">Courses</th>
                        <th className="p-3">Fees</th>
                        <th className="p-3">Specializations</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-[#111C2D]">
                      {universitiesLoading ? (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-[#70787C] italic">Loading universities...</td>
                        </tr>
                      ) : universitiesList.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-[#70787C] italic">No universities registered yet.</td>
                        </tr>
                      ) : (
                        universitiesList.map(uni => (
                          <tr key={uni.id} className="hover:bg-slate-50 transition">
                            <td className="p-3 space-y-1">
                              <div className="font-semibold text-sm text-[#0F4C5C]">{uni.name}</div>
                              {uni.eligibility && (
                                <div className="text-[10px] text-slate-500 italic">
                                  <strong>Eligibility:</strong> {uni.eligibility}
                                </div>
                              )}
                            </td>
                            <td className="p-3 space-y-1">
                              {uni.courses && Array.isArray(uni.courses) && uni.courses.map(course => (
                                <div key={course} className="text-[11px] font-medium">{course}</div>
                              ))}
                            </td>
                            <td className="p-3 space-y-1">
                              {uni.courses && Array.isArray(uni.courses) && uni.courses.map(course => {
                                const feeVal = uni.fees && uni.fees[course];
                                return (
                                  <div key={course} className="text-[11px] font-data-mono">
                                    {feeVal !== undefined ? (
                                      <span className="text-[#059669] font-semibold">₹{feeVal.toLocaleString()}</span>
                                    ) : (
                                      <span className="text-slate-300 italic">—</span>
                                    )}
                                  </div>
                                );
                              })}
                            </td>
                            <td className="p-3">
                              {uni.specializations && Array.isArray(uni.specializations) ? (
                                <div className="flex flex-wrap gap-1">
                                  {uni.specializations.map(spec => (
                                    <span key={spec} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-[10px] text-slate-700 rounded-full font-medium">
                                      {spec}
                                    </span>
                                  ))}
                                </div>
                              ) : '—'}
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => handleEditUniversity(uni)}
                                className="px-2 py-1 bg-slate-100 hover:bg-[#1BACE4] hover:text-white border border-[#CBD5E1] rounded text-[#003441] text-[10px] font-bold uppercase transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUniversity(uni.id)}
                                className="px-2 py-1 bg-red-50 hover:bg-[#BA1A1A] hover:text-white border border-red-200 text-[#BA1A1A] text-[10px] font-bold uppercase transition"
                              >
                                Delete
                              </button>
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

        </main>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-2xl p-6">
            <h3 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps mb-1">Edit User</h3>
            <p className="text-xs text-[#70787C] mb-4">
              Update the name and email for this account.
            </p>
            {editUserError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded font-semibold">
                {editUserError}
              </div>
            )}
            <form onSubmit={handleEditUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#40484B] mb-1 font-label-caps uppercase">Company Email</label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
                />
                <p className="text-[10px] text-[#70787C] mt-1">* Must be a @skilllabs.net email address.</p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setEditUser(null); setEditUserError(null); }}
                  className="text-xs font-semibold py-1.5 px-3 rounded border border-[#E2E8F0] text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold py-1.5 px-3 rounded bg-[#1BACE4] hover:bg-[#1597C8] text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-2xl p-6">
            <h3 className="text-sm font-bold text-[#111C2D] uppercase tracking-wide font-label-caps mb-1">Reset Password</h3>
            <p className="text-xs text-[#70787C] mb-4">
              Set a new password for <strong>{resetPasswordUser.name}</strong> ({resetPasswordUser.company_email}).
            </p>
            {resetPasswordError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded font-semibold">
                {resetPasswordError}
              </div>
            )}
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                placeholder="New password (min 8 characters)"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded focus:outline-none focus:border-[#1BACE4]"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setResetPasswordUser(null); setResetPasswordValue(''); setResetPasswordError(null); }}
                  className="text-xs font-semibold py-1.5 px-3 rounded border border-[#E2E8F0] text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold py-1.5 px-3 rounded bg-[#1BACE4] hover:bg-[#1597C8] text-white"
                >
                  Reset Password
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
            <span className="text-[10px] text-slate-300 font-bold font-data-mono tracking-wider">ADMIN ACTION COMPLETE ⚡</span>
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
