import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../../shared/components/Modal';
import DataTable from '../../../shared/components/DataTable';
import { hiringApi } from '../services/hiringApi';

const HIRING_ROLES = [
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'hiring_team_leader', label: 'Hiring Team Leader' }
];

async function adminRequest(token, path, options = {}) {
  const response = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Super Admin only — creates and manages login credentials for the whole Hiring workspace
// (both Recruiters and Hiring Team Leaders) in one place, reusing the same generic
// /api/admin/users* endpoints Admissions' own Super Admin "Manage Users" screen uses (they
// already accept any role string, no Hiring-specific backend work needed) plus the existing
// /api/hiring/recruiters/:id/team endpoint for hiring-team assignment.
export default function RecruitersPage({ token, role, showToast }) {
  const [recruiters, setRecruiters] = useState([]);
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', email: '', password: '', role: 'recruiter', hiringTeamId: '' });
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState(null); // { id, name, email }
  const [editError, setEditError] = useState(null);

  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState(null);

  const isSuperAdmin = role === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recruiterData, teamData] = await Promise.all([
        hiringApi.listRecruiters(token),
        hiringApi.listTeams(token)
      ]);
      setRecruiters(recruiterData);
      setTeams(teamData);
      if (isSuperAdmin) {
        const users = await adminRequest(token, '/users');
        setAllUsers(users.filter(u => u.role === 'recruiter' || u.role === 'hiring_team_leader'));
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleTeamChange = async (userId, hiringTeamId) => {
    try {
      await hiringApi.setRecruiterTeam(token, userId, hiringTeamId || null);
      showToast('Team assignment updated.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      await hiringApi.createTeam(token, { name: newTeamName.trim() });
      setNewTeamName('');
      showToast('Hiring team created.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setCreateError(null);
    if (!newAccount.email.toLowerCase().endsWith('@skilllabs.net')) {
      setCreateError('Access restricted: Only @skilllabs.net accounts are permitted.');
      return;
    }
    if (!newAccount.password || newAccount.password.length < 8) {
      setCreateError('Password must be at least 8 characters long.');
      return;
    }
    setCreating(true);
    try {
      const created = await adminRequest(token, '/users', {
        method: 'POST',
        body: JSON.stringify({ name: newAccount.name, email: newAccount.email, password: newAccount.password, role: newAccount.role })
      });
      if (newAccount.hiringTeamId) {
        await hiringApi.setRecruiterTeam(token, created.id, newAccount.hiringTeamId);
      }
      showToast('Account created.', 'success');
      setNewAccount({ name: '', email: '', password: '', role: 'recruiter', hiringTeamId: '' });
      setShowCreateForm(false);
      load();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError(null);
    if (!editUser.email.toLowerCase().endsWith('@skilllabs.net')) {
      setEditError('Access restricted: Only @skilllabs.net accounts are permitted.');
      return;
    }
    try {
      await adminRequest(token, `/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editUser.name, email: editUser.email })
      });
      showToast('Account updated.', 'success');
      setEditUser(null);
      load();
    } catch (err) {
      setEditError(err.message);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetPasswordError(null);
    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      setResetPasswordError('Password must be at least 8 characters long.');
      return;
    }
    try {
      await adminRequest(token, `/users/${resetPasswordUser.id}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ password: resetPasswordValue })
      });
      showToast('Password reset.', 'success');
      setResetPasswordUser(null);
      setResetPasswordValue('');
    } catch (err) {
      setResetPasswordError(err.message);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await adminRequest(token, `/users/${user.id}/toggle`, { method: 'PUT' });
      showToast(`Account ${user.active ? 'deactivated' : 'activated'}.`, 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const recruiterColumns = [
    { key: 'name', label: 'Recruiter' },
    { key: 'email', label: 'Email', className: 'font-data-mono text-[10px]' },
    { key: 'load', label: 'Active Load' },
    { key: 'hiringTeamId', label: 'Team', render: (r) => teams.find(t => t.id === r.hiringTeamId)?.name || '—' },
    { key: 'active', label: 'Status', render: (r) => (
      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${r.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
        {r.active ? 'Active' : 'Inactive'}
      </span>
    ) }
  ];

  const accountColumns = [
    { key: 'name', label: 'Name' },
    { key: 'company_email', label: 'Email', className: 'font-data-mono text-[10px]' },
    { key: 'role', label: 'Role', render: (u) => u.role === 'hiring_team_leader' ? 'Hiring Team Leader' : 'Recruiter' },
    { key: 'hiring_team_id', label: 'Team', render: (u) => (
      <select
        value={u.hiring_team_id || ''}
        onChange={(e) => handleTeamChange(u.id, e.target.value)}
        className="text-[10px] p-1 bg-white dark:bg-slate-800 dark:text-white border border-[#CBD5E1] dark:border-slate-600 rounded"
      >
        <option value="">-- No Team --</option>
        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    ) },
    { key: 'active', label: 'Status', render: (u) => (
      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${u.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
        {u.active ? 'Active' : 'Inactive'}
      </span>
    ) },
    { key: 'actions', label: '', className: 'text-right', render: (u) => (
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => setEditUser({ id: u.id, name: u.name, email: u.company_email })} className="p-1 border border-[#CBD5E1] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded" title="Edit">
          <span className="material-symbols-outlined text-sm">edit</span>
        </button>
        <button onClick={() => setResetPasswordUser(u)} className="p-1 border border-[#CBD5E1] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded" title="Reset password">
          <span className="material-symbols-outlined text-sm">key</span>
        </button>
        <button onClick={() => handleToggleActive(u)} className="p-1 border border-[#CBD5E1] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded" title={u.active ? 'Deactivate' : 'Activate'}>
          <span className="material-symbols-outlined text-sm">{u.active ? 'block' : 'check_circle'}</span>
        </button>
      </div>
    ) }
  ];

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] dark:text-white font-label-caps mb-3">Hiring Teams</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {teams.map(t => (
              <span key={t.id} className="px-2 py-1 bg-violet-50 border border-violet-200 text-violet-700 text-xs rounded-full font-semibold">
                {t.name} {t.leader_name ? `— ${t.leader_name}` : ''}
              </span>
            ))}
            {teams.length === 0 && <span className="text-xs text-slate-400 italic">No hiring teams yet.</span>}
          </div>
          <form onSubmit={handleCreateTeam} className="flex gap-2">
            <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="New team name" className="text-xs p-2 bg-[#F9F9FF] border border-[#CBD5E1] rounded flex-grow" />
            <button type="submit" className="text-xs font-bold py-2 px-3 rounded bg-[#7C3AED] hover:bg-[#6D28D9] text-white">Create Team</button>
          </form>
        </div>
      )}

      {isSuperAdmin && (
        <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] dark:text-white font-label-caps">Hiring Team Accounts ({allUsers.length})</span>
            <button onClick={() => setShowCreateForm(v => !v)} className="text-[10px] font-bold py-1.5 px-3 rounded bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">person_add</span> New Account
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateAccount} className="p-4 border-b border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 space-y-3">
              {createError && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{createError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Name</label>
                  <input value={newAccount.name} onChange={(e) => setNewAccount(a => ({ ...a, name: e.target.value }))} required className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Company Email</label>
                  <input type="email" value={newAccount.email} onChange={(e) => setNewAccount(a => ({ ...a, email: e.target.value }))} placeholder="name@skilllabs.net" required className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Password</label>
                  <input type="text" value={newAccount.password} onChange={(e) => setNewAccount(a => ({ ...a, password: e.target.value }))} placeholder="Min. 8 characters" required className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Role</label>
                  <select value={newAccount.role} onChange={(e) => setNewAccount(a => ({ ...a, role: e.target.value }))} className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded">
                    {HIRING_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Hiring Team (optional)</label>
                  <select value={newAccount.hiringTeamId} onChange={(e) => setNewAccount(a => ({ ...a, hiringTeamId: e.target.value }))} className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded">
                    <option value="">-- No Team --</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateForm(false)} className="py-1.5 px-3 border border-[#CBD5E1] dark:border-slate-700 dark:text-slate-300 text-xs font-semibold rounded">Cancel</button>
                <button type="submit" disabled={creating} className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          <DataTable columns={accountColumns} rows={allUsers} loading={loading} emptyMessage="No Hiring accounts yet." />
        </div>
      )}

      {!isSuperAdmin && (
        <div className="bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider text-[#111C2D] dark:text-white font-label-caps">Recruiters ({recruiters.length})</span>
          </div>
          <DataTable columns={recruiterColumns} rows={recruiters} loading={loading} emptyMessage="No recruiters found." />
        </div>
      )}

      {editUser && (
        <Modal title="Edit Account" icon="edit" onClose={() => setEditUser(null)} maxWidth="max-w-sm"
          footer={(
            <>
              <button type="button" onClick={() => setEditUser(null)} className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded">Cancel</button>
              <button form="edit-user-form" type="submit" className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded">Save</button>
            </>
          )}
        >
          {editError && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{editError}</div>}
          <form id="edit-user-form" onSubmit={handleEditSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Name</label>
              <input value={editUser.name} onChange={(e) => setEditUser(u => ({ ...u, name: e.target.value }))} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Company Email</label>
              <input type="email" value={editUser.email} onChange={(e) => setEditUser(u => ({ ...u, email: e.target.value }))} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
            </div>
          </form>
        </Modal>
      )}

      {resetPasswordUser && (
        <Modal title={`Reset Password — ${resetPasswordUser.name}`} icon="key" onClose={() => setResetPasswordUser(null)} maxWidth="max-w-sm"
          footer={(
            <>
              <button type="button" onClick={() => setResetPasswordUser(null)} className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded">Cancel</button>
              <button form="reset-password-form" type="submit" className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded">Reset</button>
            </>
          )}
        >
          {resetPasswordError && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{resetPasswordError}</div>}
          <form id="reset-password-form" onSubmit={handleResetPasswordSubmit} className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Set a new password for <strong>{resetPasswordUser.company_email}</strong>.</p>
            <div>
              <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">New Password</label>
              <input type="text" value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} placeholder="Min. 8 characters" className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
