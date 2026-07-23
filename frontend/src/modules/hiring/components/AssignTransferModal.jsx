import React, { useState } from 'react';
import Modal from '../../../shared/components/Modal';

export default function AssignTransferModal({ candidate, recruiters, onClose, onSubmit }) {
  const [recruiterId, setRecruiterId] = useState(candidate?.recruiter_id || '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!recruiterId) { setError('Please select a recruiter.'); return; }
    setSaving(true);
    try {
      await onSubmit({ recruiterId });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isReassign = !!candidate?.recruiter_id;

  return (
    <Modal title={`${isReassign ? 'Reassign' : 'Assign'} — ${candidate.name}`} icon="person_add" onClose={onClose} maxWidth="max-w-sm"
      footer={(
        <>
          <button type="button" onClick={onClose} className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded">Cancel</button>
          <button form="assign-form" type="submit" disabled={saving} className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded disabled:opacity-50">
            {saving ? 'Saving...' : (isReassign ? 'Reassign' : 'Assign')}
          </button>
        </>
      )}
    >
      {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{error}</div>}
      <form id="assign-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Recruiter</label>
          <select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded">
            <option value="">-- Select Recruiter --</option>
            {recruiters.map(r => <option key={r.id} value={r.id}>{r.name} ({r.load} active)</option>)}
          </select>
        </div>
      </form>
    </Modal>
  );
}
